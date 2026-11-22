# frozen_string_literal: true
require_relative '../lib/calendar'
require_relative '../lib/month_calendar_art'
require_relative 'days_off_pages'
require 'fileutils'
require 'cgi'
require 'rexml/document'
module Pages
 extend self
 include DaysOffPages
 ROOT=File.expand_path('..',__dir__)
 DATA=Kalendorius::DATA
 HOLIDAY_YEARS=JSON.parse(File.read("#{ROOT}/data/holiday-years.json")).freeze
 WEEKDAY_NAMES=%w[pirmadienis antradienis trečiadienis ketvirtadienis penktadienis šeštadienis sekmadienis].freeze
 MANIFEST=JSON.parse(File.read("#{ROOT}/site/assets/data/manifest.json"))['assets']
 EDITORIAL=JSON.parse(File.read("#{ROOT}/data/holiday-editorial.json"))
 LITHUANIAN_DATES=JSON.parse(File.read("#{ROOT}/site/_data/lithuanian_dates.json"))
 LOCAL_DATES=LITHUANIAN_DATES.fetch('commemorations')
 COMMEMORATIVE_DATES=EDITORIAL.fetch('commemorations')+LOCAL_DATES
 ARTICLE_SEO_TITLES={
  'feb16'=>'Vasario 16-oji: Lietuvos valstybės atkūrimas',
  'mar11'=>'Kovo 11-oji: Lietuvos nepriklausomybės atkūrimas',
  'statehood'=>'Valstybės diena: Mindaugo karūnavimas',
  'all-souls'=>'Vėlinės: Mirusiųjų atminimo diena',
  'assumption'=>'Žolinė: Švč. Mergelės Marijos ėmimas į dangų'
 }.freeze
 def editorial_articles;EDITORIAL['articles']+EDITORIAL['commemorations'];end
 def article_for_id(id);editorial_articles.find { |a|a['id']==id };end
 def holiday_page_url(id)
  article=editorial_articles.find { |a|Array(a['holiday_ids']).include?(id) }
  article ? "/sventes/#{article['slug']}/" : nil
 end
 def esc(s);CGI.escapeHTML(s.to_s);end
 def preserve_authored_source?(target)
  return false unless File.file?(target)
  File.open(target,'r:utf-8') do |file|
   return false unless file.gets&.strip=='---'
   file.each_line do |line|
    break if line.strip=='---'
    return true if line.match?(/\Apreserve_source:\s*true\s*\z/)
   end
  end
  false
 end
 def source_citations(article,source_ids)
  ids=Array(source_ids)&Array(article['sources'])
  links=ids.filter_map do |sid|
   source=EDITORIAL['sources'][sid]
   "<a href=\"#{esc(source['url'])}\" rel=\"noopener\">#{esc(source['title'])}</a>" if source
  end
  links.empty? ? '' : "<p class=\"claim-source\">Šaltinis: #{links.join(' · ')}</p>"
 end
 def holiday_figure(article)
  media=EDITORIAL.fetch('media',{})[article['documentary_image']]
  return "<figure class=\"holiday-art\"><img src=\"/assets/visuals/holiday-#{esc(article['slug'])}.svg\" width=\"360\" height=\"240\" alt=\"#{esc(article['image_alt'])}\" loading=\"eager\" decoding=\"async\" fetchpriority=\"high\"><figcaption>Originali dekoratyvinė vektorinė iliustracija; tai nėra dokumentinė istorinio įvykio nuotrauka.</figcaption></figure>" unless media

  caption=media['caption_lt']||article['image_alt']
  credit="Nuotrauka: <a href=\"#{esc(media['commons_url'])}\" title=\"#{esc(media['work_title'])}\" rel=\"noopener\">„#{esc(media['work_title'])}“</a> — #{esc(media['author'])}."
  if media['source_url']
   credit+=" <a href=\"#{esc(media['source_url'])}\" rel=\"noopener\">#{esc(media['source_name'])}</a>."
  end
  "<figure class=\"holiday-art holiday-art--documentary\"><img src=\"#{esc(media['src'])}\" srcset=\"#{esc(media['srcset'])}\" sizes=\"(max-width: 700px) 90vw, 360px\" width=\"#{media['width']}\" height=\"#{media['height']}\" alt=\"#{esc(article['image_alt'])}\" loading=\"eager\" decoding=\"async\" fetchpriority=\"high\"><figcaption><span class=\"holiday-art__caption\">#{esc(caption)}</span><span class=\"holiday-art__credit\">#{credit} Šaltinis: <a href=\"#{esc(media['commons_url'])}\" rel=\"noopener\">Wikimedia Commons</a>. Licencija: <a href=\"#{esc(media['license_url'])}\" rel=\"noopener\">#{esc(media['license_name'])}</a>. #{esc(media['change_note'])}</span></figcaption></figure>"
 end
 def write_holiday_illustration(article)
  sprite=REXML::Document.new(File.read("#{ROOT}/site/assets/visuals/holiday-motifs.svg"))
  motif=sprite.root.elements.to_a('symbol').find { |element|element.attributes['id']==article['motif'] }
  return unless motif
  inner=motif.children.map(&:to_s).join
  File.write("#{ROOT}/site/assets/visuals/holiday-#{article['slug']}.svg","<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 360 240\" role=\"img\" aria-label=\"#{esc(article['image_alt'])}\">#{inner}</svg>")
 end
 def page(path,title,desc,html,tool=false,robots=nil,planner=false,phase_module=nil)
  target="#{ROOT}/site/#{path.empty? ? 'index' : path}/index.html"
  # Tool pages with preserve_source in front matter are hand-authored. The
  # generator still creates every other route, but must not replace these
  # richer interactive pages during a release build.
  return if preserve_authored_source?(target)
  FileUtils.mkdir_p(File.dirname(target))
  html=print_html(path,visual_html(path,html))
  metadata={'title'=>title,'description'=>desc,'tool'=>tool}
  metadata['workdays']=true if path.match?(%r{\Adarbo-dienos/(?:202[789]|2030)\z})
  print=html[/data-print-root="art" data-print-paper="(portrait|landscape)" data-print-size="(A[34])"/,0]
  if print
   orientation=print[/data-print-paper="(portrait|landscape)"/,1]
   size=print[/data-print-size="(A[34])"/,1]
   metadata['print_paper']="#{size} #{orientation}"
  end
  metadata['hero_share']=true if path.match?(/\A(?:202[789]|2030)\z/)
  metadata['robots']=robots if robots
  metadata['planner']=true if planner
  metadata['workdays']=true if path.match?(%r{\Adarbo-dienos/(?:202[789]|2030)\z})
  metadata['phase_module']=phase_module if phase_module
  metadata['days_off']=true if path.start_with?('nedarbo-dienos/')
  metadata['holiday_editorial']=true if path=='sventes' || path.start_with?('sventes/')
  File.write(target,"---\n#{metadata.map { |k,v| "#{k}: #{v.to_json}" }.join("\n")}\n---\n#{html}")
 end
 def title(y,m);"#{y} m. #{DATA['months'][m-1][2]} kalendorius";end
 def month_url(y,m);"/#{y}/#{DATA['months'][m-1][0]}/";end
 def source
  "<div class=\"source-note\">Teisės aktų duomenys sutikrinti 2026-10-16. 2026 m. iki spalio 31 d. taikytas tuo metu galiojęs DK 123 str.; 2027–2030 m. datos apskaičiuotos su nuo 2027-01-01 numatyta galioti suvestine redakcija. <a href=\"#{esc(EDITORIAL['sources']['labour-code-2027']['url'])}\" rel=\"noopener\">Darbo kodekso 123 straipsnis nuo 2027-01-01</a>. Savaitgalį pasitaikanti šventė automatiškai neperkeliama į pirmadienį. Atmintinos dienos pateikiamos atskirai ir savaime nesuteikia nedarbo dienos statuso.</div>"
 end
 def static_month(y,m,day_plans: false)
  month=Kalendorius.month(y,m);html='<table class="static-month"><caption class="visually-hidden">'+title(y,m)+'</caption><thead><tr><th scope="col">Sav.</th>'+DATA['weekdays'].map { |d|"<th scope=\"col\">#{d}</th>" }.join+'</tr></thead><tbody>'
  month['grid'].each_slice(7).take(month['weeks']).each do |week|
   html+="<tr><th scope=\"row\">#{week.first['isoWeek']}</th>"
   week.each do |d|
    hs=d['inMonth'] ? month['days'][d['day']-1]['holidays'] : []
    cs=d['inMonth'] ? COMMEMORATIVE_DATES.select { |a|a['month']==m && a['day']==d['day'] } : []
    if d['inMonth']
     holiday_links=hs.filter_map { |h|url=holiday_page_url(h['id']);url && [h['name'],url] }
     commemoration_links=cs.map { |a|[a['title'],"/sventes/#{a['slug']}/"] }
     labels=(holiday_links+commemoration_links).map(&:first)
     date_target=holiday_links.first||commemoration_links.first
     spoken_label=(["#{d['day']} d.",d['date']]+labels).join(': ')
     day_markup=%(<time datetime="#{d['date']}">#{d['day']}</time>)
     date=if date_target
      %(<a class="calendar-holiday-date" href="#{date_target[1]}" aria-label="#{esc(spoken_label)}" title="#{esc(labels.join(' · '))}">#{day_markup}<span class="calendar-day-marker" aria-hidden="true"></span></a>)
     elsif day_plans
      %(<a class="calendar-plan-date" href="/mano-diena/?data=#{d['date']}" aria-label="#{d['date']}: dienos planas">#{day_markup}</a>)
     else
      day_markup
     end
     classes=[];classes<<'holiday' if hs.any?;classes<<'commemoration-day' if cs.any?
     html+="<td class=\"#{classes.join(' ')}\">#{date}</td>"
    else
     html+='<td></td>'
    end
   end
   html+='</tr>'
  end
  html+'</tbody></table>'
 end
 def calendar_records_table(title, label, rows, annual_holiday_page)
  headings = ['Data', 'Diena', title, 'Statusas'].map { |label| %(<th scope="col" role="columnheader">#{label}</th>) }.join
  yearly = annual_holiday_page ? ' holiday-year-table' : ''
  body = rows.map do |date, name, url, status|
   name_markup = url ? %(<a href="#{esc(url)}">#{esc(name)}</a>) : esc(name)
   %(<tr role="row">
    <td class="calendar-record__date" role="cell"><a href="#{month_url(date.year,date.month)}"><time datetime="#{date.iso8601}">#{date.iso8601}</time></a></td>
    <td class="calendar-record__weekday" role="cell">#{WEEKDAY_NAMES[date.cwday-1]}</td>
    <td class="calendar-record__name" role="cell">#{name_markup}</td>
    <td class="calendar-record__status" role="cell">#{esc(status)}</td>
   </tr>)
  end.join
  %(<div class="table-scroll calendar-records#{yearly}"><table class="data-table" role="table" aria-label="#{label}"><thead role="rowgroup"><tr role="row">#{headings}</tr></thead><tbody role="rowgroup">#{body}</tbody></table></div>)
 end
 def holiday_table(y,month=nil,annual_holiday_page=false)
  holidays=Kalendorius.holidays(y)
  holidays=holidays.select { |entry| Date.iso8601(entry['date']).month == month } if month
  return '<p>Šį mėnesį įstatyme nustatytų šventinių dienų nėra.</p>' if holidays.empty?

  rows = holidays.map do |holiday|
   url=holiday_page_url(holiday['id'])
   url+="?metai=#{y}" if url && annual_holiday_page
   [Date.iso8601(holiday['date']), holiday['legalName'] || holiday['name'], url, 'Šventinė diena · DK 123 str.']
  end
  calendar_records_table('Šventė', 'Šventinės dienos', rows, annual_holiday_page)
 end
 def commemoration_table(y,month=nil,annual_holiday_page=false)
  records=COMMEMORATIVE_DATES
  records=records.select { |entry| entry['month'] == month } if month
  return '' if records.empty?

  holidays=Kalendorius.holidays(y).map { |entry| entry.fetch('date') }
  rows = records.sort_by { |entry| [entry['month'],entry['day'],entry['title']] }.map do |entry|
   date=Date.new(y,entry['month'],entry['day'],Date::GREGORIAN)
   url="/sventes/#{entry['slug']}/"
   url+="?metai=#{y}" if annual_holiday_page && EDITORIAL.fetch('commemorations').include?(entry)
   status=holidays.include?(date.iso8601) ? 'Sutampa su šventine diena' : 'Atmintina diena'
   [date, entry['title'], url, status]
  end
  guidance='<h2>Atmintinos dienos</h2><p class="calendar-records-note">Atmintinos dienos statusas savaime nesuteikia nedarbo dienos. Kai data sutampa su Darbo kodekse nustatyta švente, tai pažymėta sąraše.</p>'
  guidance + calendar_records_table('Atmintina diena', 'Atmintinos dienos', rows, annual_holiday_page)
 end
 def occurrence_dates(article,year)
  ids=Array(article['holiday_ids'])
  return [Date.new(year,article['month'],article['day'],Date::GREGORIAN)] if ids.empty?
  ids.filter_map { |id|h=Kalendorius.holidays(year).find { |item|item['id']==id };Date.iso8601(h['date']) if h }
 end
 def next_occurrence(article)
  if ENV['K365_BUILD_DATE']
   today=Date.iso8601(ENV.fetch('K365_BUILD_DATE'))
  else
   previous=ENV['TZ'];ENV['TZ']='Europe/Vilnius';today=Date.today;ENV['TZ']=previous
  end
  (today.year..today.year+10).flat_map { |y|occurrence_dates(article,y) }.sort.find { |d|d>=today }
 end
 def generate_holiday_articles
  editorial_articles.each do |article|
   write_holiday_illustration(article)
   upcoming=next_occurrence(article);links=[]
   related=Array(article['related']).filter_map { |id|r=article_for_id(id);"<a href=\"/sventes/#{r['slug']}/\">#{esc(r['title'])}</a>" if r }
   yearrows=(2027..2029).flat_map do |y|
    occurrence_dates(article,y).map do |d|
     weekday=WEEKDAY_NAMES[d.cwday-1];month=month_url(y,d.month);ics="/assets/holiday-ics/#{article['slug']}-#{d.iso8601}.ics"
     write_holiday_ics(article,d)
     "<tr><th scope=\"row\">#{y}</th><td><time datetime=\"#{d.iso8601}\">#{d.iso8601}</time></td><td>#{weekday}</td><td><a href=\"#{month}\" aria-label=\"#{esc(DATA['months'][d.month-1][2].capitalize)} #{y} kalendorius\">#{DATA['months'][d.month-1][2].capitalize} kalendorius</a></td><td class=\"holiday-actions\"><a class=\"button\" href=\"/?prideti=#{CGI.escape(article['slug'])}&amp;data=#{d.iso8601}\">Įtraukti į mano kalendorių</a><a class=\"button\" href=\"#{ics}\" download aria-label=\"Atsisiųsti #{esc(article['title'])}, #{d.iso8601}, ICS failą\">Atsisiųsti ICS</a></td></tr>"
    end
   end.join
   rows=yearrows.empty? ? '<p>2027–2029 m. įrašų nėra.</p>' : '<div class="table-scroll"><table class="data-table holiday-occurrences"><caption>Datos 2027–2029 metais</caption><thead><tr><th scope="col">Metai</th><th scope="col">Data</th><th scope="col">Savaitės diena</th><th scope="col">Kalendorius</th><th scope="col">Veiksmas</th></tr></thead><tbody>'+yearrows+'</tbody></table></div>'
   current=upcoming ? "<p class=\"holiday-next\"><strong>Kita data pagal Europe/Vilnius kalendorių:</strong> <time data-next-occurrence datetime=\"#{upcoming.iso8601}\">#{WEEKDAY_NAMES[upcoming.cwday-1]}, #{upcoming.iso8601}</time> (skaičiuojama pagal vietos datą).</p>" : ''
   ids=Array(article['holiday_ids'])
   date_rule=if ids.empty?
    "Kasmet #{DATA['months'][article['month']-1][2]} #{article['day']} d."
   elsif ids.any? { |id|%w[easter easter-monday].include?(id) }
    'Velykų sekmadienis ir pirmadienis pagal vakarietiškąją Grigaliaus kalendoriaus tradiciją; antrasis įrašas yra kita diena po sekmadienio.'
   elsif ids.any? { |id|%w[mothers fathers].include?(id) }
    h=Kalendorius.holidays(2027).find { |item|item['id']==ids.first };"Pirmasis #{DATA['months'][h['month']-1][2]} sekmadienis (data kasmet kinta)."
   else
    dates=ids.filter_map { |id|h=Kalendorius.holidays(2027).find { |item|item['id']==id };Date.iso8601(h['date']) if h }
    if dates.length>1 && dates.map(&:month).uniq.length==1 && dates.map(&:day)==(dates.first.day..dates.last.day).to_a
     "Kasmet #{DATA['months'][dates.first.month-1][2]} #{dates.first.day}–#{dates.last.day} d."
    elsif dates.any?
     dates.map { |d|"Kasmet #{DATA['months'][d.month-1][2]} #{d.day} d." }.join(' ir ')
    else
     'Data apskaičiuojama pagal kalendoriaus taisyklę.'
    end
   end
   # Keep citations adjacent to the claims they support. Legislation remains in
   # the legal-status block and source list; it must not appear beside cultural
   # history unless the paragraph is specifically about a legal obligation.
   history_source_ids=article['sources']-%w[e-tar-versions labour-code labour-code-future labour-code-2027 memoriam-law flag-law]
   status_class=Array(article['holiday_ids']).empty? ? 'status-badge status-badge--commemoration' : 'status-badge'
   context_html=Array(article['context_sections']).each_with_index.map do |context,index|
    heading,body,explicit_source_ids=context
    # Context citations are authored with the passage, never inferred from
    # words in its heading. This prevents a cultural/algorithm paragraph from
    # inheriting unrelated labor-law citations.
    context_sources=Array(explicit_source_ids || history_source_ids) & article['sources']
    "<section aria-labelledby=\"#{article['slug']}-kontekstas-#{index+1}\"><h2 id=\"#{article['slug']}-kontekstas-#{index+1}\">#{esc(heading)}</h2><p>#{esc(body)}</p>#{source_citations(article,context_sources)}</section>"
   end.join
   detail = <<~HTML
    <article class="holiday-article" data-holiday-id="#{article['id']}">
     <header class="holiday-hero holiday-hero--#{article['motif']}">
      <div class="holiday-hero__copy"><p class="eyebrow">Lietuvos kalendorinis gidas</p><h1>#{esc(article['title'])}</h1><p class="page-intro">#{esc(article['summary'])}</p><span class="#{status_class}">#{esc(article['category'])}</span>#{current}</div>
      #{holiday_figure(article)}
     </header>
     <div class="holiday-article__body">
      <section aria-labelledby="kas-tai"><h2 id="kas-tai">Kas tai?</h2><p>#{esc(article['what'])}</p>#{source_citations(article,%w[labour-code labour-code-future labour-code-2027 memoriam-law])}<p><strong>Kada švenčiama:</strong> #{esc(date_rule)}</p></section>
      <section aria-labelledby="datos"><h2 id="datos">Tikslios datos ir savaitės dienos</h2><p>Datos apskaičiuojamos pagal bendrą svetainės kalendoriaus variklį. Jei ta pati data minima ir kaip atmintina diena, jos statusas nurodomas atskirai nuo Darbo kodekso šventinių dienų.</p>#{rows}</section>
      <section aria-labelledby="istorija"><h2 id="istorija">Istorinė ir kalendorinė reikšmė</h2><p>#{esc(article['history'])}</p>#{source_citations(article,history_source_ids)}</section>
      <section aria-labelledby="paprociai"><h2 id="paprociai">Papročiai ir simboliai</h2><p>#{esc(article['traditions'])}</p>#{source_citations(article,history_source_ids)}</section>
      #{context_html}
      <section class="panel holiday-practical" aria-labelledby="praktika"><h2 id="praktika">Ką verta žinoti planuojant</h2><p>#{esc(article['practical'])}</p><p>Susiję įrankiai: <a href="/sventes/2027/">metinis švenčių sąrašas</a> · <a href="/atostogu-planavimas/">atostogų planuoklis</a> · <a href="/darbo-dienos/2027/">darbo dienų kalendorius</a>.</p><button class="button" type="button" data-print>Spausdinti puslapį</button></section>
      <section aria-labelledby="duk"><h2 id="duk">Dažnai užduodami klausimai</h2>#{article['faq'].map { |q,a| "<details class=\"holiday-faq\"><summary>#{esc(q)}</summary><p>#{esc(a)}</p></details>" }.join}</section>
      <section class="holiday-sources" aria-labelledby="saltiniai"><h2 id="saltiniai">Šaltiniai ir nuorodos</h2><ul>#{article['sources'].map { |sid|s=EDITORIAL['sources'][sid]; "<li><a href=\"#{esc(s['url'])}\" rel=\"noopener\">#{esc(s['title'])}</a> <span>#{esc(s['publisher'])}</span></li>" }.join}</ul><p>Tai bendro pobūdžio kalendoriaus informacija, o ne individuali teisinė konsultacija. Teisės aktų redakcijos sutikrintos 2026-10-16. 2027–2029 m. DK 123 straipsnio datos tikrintos ir pagal nuo 2027-01-01 numatytą galioti redakciją; 2026 m. lapkričio 1 d. įsigaliosiantys pakeitimai atskirti nuo peržiūros dieną galiojusio teksto. Puslapiuose, kuriuose aptariama atmintina diena, jos statusas atskiriamas nuo DK 123 straipsnio švenčių. Kultūrinių teiginių nuorodos pateiktos prie jų; regionų ir šeimų pavyzdžiai neapibendrinami visai Lietuvai. Nepriklausomas teisininkas ar gimtakalbis lietuvių redaktorius puslapio neperžiūrėjo.</p></section>
      <nav class="holiday-related" aria-label="Susiję straipsniai"><h2>Susijusios datos</h2>#{related.join(' · ')}</nav>
      <p class="source-note">Paskutinį kartą tikrinta: #{EDITORIAL['research_date']}. Datų lentelė nurodo kalendorines datas; konkrečių renginių programos ir vėlesnės teisės aktų redakcijos tikrinamos atskirai.</p>
     </div>
    </article>
   HTML
   structured={"@context"=>"https://schema.org","@type"=>"Article","headline"=>article['title'],"description"=>article['meta_description']||article['summary'],"inLanguage"=>"lt-LT","dateModified"=>EDITORIAL['research_date'],"mainEntityOfPage"=>"https://kalendorius365.lt/sventes/#{article['slug']}/"}
   detail+="<script type=\"application/ld+json\">#{JSON.generate(structured)}</script>"
   page("sventes/#{article['slug']}",ARTICLE_SEO_TITLES.fetch(article['id'],article['title']+' – data, reikšmė ir papročiai'),article['meta_description']||article['summary'],detail)
  end
 end
 def write_holiday_ics(article,date)
  path="#{ROOT}/site/assets/holiday-ics/#{article['slug']}-#{date.iso8601}.ics"
  FileUtils.mkdir_p(File.dirname(path))
  nextday=date+1;uid="#{article['slug']}-#{date.iso8601}@kalendorius365.lt"
  summary=article['title'].gsub(/[\\,;]/) { |c|"\\#{c}" }.gsub("\n",'\\n')
  url="https://kalendorius365.lt/sventes/#{article['slug']}/"
  body=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Kalendorius365.lt//Lietuviu kalendorius//LT","CALSCALE:GREGORIAN","BEGIN:VEVENT","UID:#{uid}","DTSTAMP:#{EDITORIAL['research_date'].delete('-')}T000000Z","DTSTART;VALUE=DATE:#{date.strftime('%Y%m%d')}","DTEND;VALUE=DATE:#{nextday.strftime('%Y%m%d')}","SUMMARY:#{summary}","URL:#{url}","END:VEVENT","END:VCALENDAR"].join("\r\n")+"\r\n"
  File.write(path,body)
 end
 def intro(title,desc,links='')
  "<div class=\"page-heading\"><div><h1>#{title}</h1><p class=\"page-intro\">#{desc}</p></div><div class=\"toolbar-group\">#{links}</div></div>"
 end
 def yearlinks(path='', current: nil)
  years=HOLIDAY_YEARS
  years.map { |y|%(<a class="button" href="/#{path}#{y}/"#{' aria-current="page"' if y==current}>#{y}</a>) }.join
 end
 def gallery(items,compact=false)
  '<div class="gallery'+(compact ? ' compact-gallery' : '')+'">'+items.map do |e|
   imported=e['filenameStem']
   alt=imported ? e['alt'] : e['kind']=='monthly' ? "#{title(e['year'],e['month'])}: #{e['name']}, spausdinamas A4 maketas" : "#{e['year']} #{e['name']} – spausdinamas kalendorius"
   id=e['design'];smallw=e['landscape'] ? 680 : 481;smallh=e['landscape'] ? 481 : 680
   description=imported ? e['description'] : e['kind']=='monthly' ? 'Mėnesio kalendoriaus dizainas spausdinimui.' : e['kind']=='annual' ? 'Visi 12 mėnesių viename A4 lape. ISO savaičių numeriai ir šventinių dienų žymėjimas.' : "Nedatuotas planuoklis#{e['rows'] ? ", #{e['rows']} eilutės" : ''}. #{e['category']=='day' ? 'Skirtas vienai dienai.' : e['sunday'] ? 'Pradžia sekmadienį.' : 'Pradžia pirmadienį.'}"
   layout=e['layout'];paper=e['paper']||'A4';holiday=imported && e['holidayInformation'] ? 'true' : 'false'
   pdf_name=File.basename(e['pdf']);webp_name=File.basename(e['webp'])
   detail_srcset=PrintPreviewDetails.srcset(e)
   detail_attrs=detail_srcset ? %( data-detail-srcset="#{esc(detail_srcset)}") : ''
   "<article class=\"design-card\" id=\"dizainas-#{e['stem']}\" data-style=\"#{e['style']}\" data-layout=\"#{layout}\" data-design=\"#{id}\" data-paper=\"#{paper}\" data-holidays=\"#{holiday}\" data-pdf-name=\"#{esc(pdf_name)}\" data-webp-name=\"#{esc(webp_name)}\"><a class=\"preview-link\" href=\"#{download_href(e,'webp')}\" target=\"_blank\" rel=\"noopener\" aria-label=\"Peržiūrėti: #{esc(e['name'])}\" title=\"#{esc(imported ? e['title'] : e['name'])}\"><img src=\"#{e['preview']}\"#{detail_attrs} srcset=\"#{e['smallPreview']||'/assets/previews-small/'+File.basename(e['preview'])} 340w, #{e['preview']} 680w\" sizes=\"(max-width: 600px) 45vw, (max-width: 1100px) 25vw, 18vw\" width=\"#{smallw}\" height=\"#{smallh}\" loading=\"lazy\" decoding=\"async\" fetchpriority=\"low\" alt=\"#{esc(alt)}\"></a><div class=\"design-info\"><h2><span class=\"design-number\">#{id}</span>#{esc(e['name'])}</h2><span class=\"design-style\">#{e['style']=='bw' ? 'Juodai baltas' : 'Spalvotas'} · #{paper} · #{e['landscape'] ? 'Gulsčias' : 'Stačias'}</span><p>#{esc(description)}</p><div class=\"design-actions\"><a class=\"button select-design\" href=\"#{download_href(e,'webp')}\" data-stem=\"#{e['stem']}\">Peržiūrėti</a><a class=\"button\" href=\"#{download_href(e,'pdf')}\" download=\"#{esc(pdf_name)}\">Atsisiųsti PDF</a><a class=\"button\" href=\"#{download_href(e,'webp')}\" download=\"#{esc(webp_name)}\">Atsisiųsti vaizdą</a><a class=\"button\" href=\"#{download_href(e,'pdf')}\" target=\"_blank\" rel=\"noopener\">Spausdinti PDF ↗</a></div></div></article>"
  end.join+'</div>'
 end
 BLANK_GROUPS={
  'month'=>['Mėnesio kalendoriai','Mėnesiui'],
  'week'=>['Savaitės ir darbo planai','Savaitei'],
  'day'=>['Dienos planai','Dienai'],
  'family'=>['Šeimos planai','Šeimai'],
  'school'=>['Mokyklos ir pamokų planai','Mokyklai'],
  'shift'=>['Pamainų planai','Pamainoms']
 }.freeze
 BLANK_COPY={
  '01'=>'Savaitė prasideda pirmadienį; palikta vietos svarbiems prioritetams.',
  '02'=>'Savaitė prasideda sekmadienį; dienų langeliai patogiam užrašymui.',
  '03'=>'Septynių dienų savaitės lapas su atskiromis rašymo eilutėmis.',
  '04'=>'Atviras, lengvai pildomas mėnesio planavimo tinklelis.',
  '05'=>'Horizontalus mėnesio kalendorius su tikslais ir svarbiausiomis datomis.',
  '06'=>'Šeimos savaitės apžvalga bendriems planams ir keturiems nariams.',
  '07'=>'Darbo savaitės planas su vieta dienos užduotims ir rezultatui.',
  '08'=>'Mokyklos savaitės planas su dienomis ir pamokų vietomis.',
  '09'=>'Ramesnio dizaino mėnesio tinklelis su didesnėmis savaitės antraštėmis.',
  '10'=>'Kontrastingas mėnesio lapas su aiškia antrašte ir darbo zona.',
  '11'=>'Septynių dienų lapas su laiko blokais nuo 03 iki 12 valandos.',
  '12'=>'Savaitės lapas svarbiausiems darbams ir užrašams susidėlioti.',
  '13'=>'Dienos laiko juosta su atskiromis užduočių ir užrašų zonomis.',
  '14'=>'Dienos planas svarbiausiems darbams, užduotims ir pastaboms.',
  '15'=>'Savaitės šeimos planas bendriems planams ir keturiems nariams.',
  '16'=>'Šeimos bendrų veiklų savaitės planas su spalvotomis įrašų eilutėmis.',
  '17'=>'Penkių dienų pamokų tvarkaraščio tinklelis su šešiomis pamokomis.',
  '18'=>'Mokymosi savaitės planas su vieta pamokoms ir užduotims.',
  '19'=>'Savaitinis pamainų žiniaraštis su dienomis ir pamainų žymomis.',
  '20'=>'Mėnesio pamainų planas su dienomis ir šešiomis savaitinėmis eilutėmis.'
 }.freeze
 def blank_group(asset)
  return 'month' if asset['layout']=='month'
  return 'day' if asset['layout'].start_with?('daily-')
  return 'family' if asset['layout']=='family'
  return 'school' if asset['layout']=='school'
  asset['category']||'week'
 end
 def blank_alt(asset)
  orientation=asset['landscape'] ? 'horizontalus' : 'vertikalus'
  if asset['layout']=='month'
   "#{asset['name']}, A4 formato #{orientation} lapas; #{asset['rows']} eilučių tinklelis, savaitė prasideda #{asset['sunday'] ? 'sekmadienį' : 'pirmadienį'}. Kalendorius365 žyma lapo apačioje."
  else
   description=BLANK_COPY.fetch(asset['design']).sub(/[.!?]+\z/,'')
   "#{asset['name']}, A4 formato #{orientation} lapas. #{description}. Kalendorius365 žyma lapo apačioje."
  end
 end
 def blank_asset_card(asset,variants)
  id=asset['design'];group=blank_group(asset);paper=asset['paper']||'A4';name=asset['name'];alt=blank_alt(asset)
  w=asset['landscape'] ? 680 : 481;h=asset['landscape'] ? 481 : 680;pdf=File.basename(asset['pdf']);webp=File.basename(asset['webp'])
  variant_control=''
  if variants.length>1
   variant_control='<label class="blank-row-choice"><span>Tinklelio eilutės</span><select data-blank-rows data-tools-readiness inert aria-busy="true" aria-label="'+esc(name)+': savaitinių eilučių skaičius">'+variants.map do |option|
    %Q!<option value="#{esc(option['stem'])}" data-variant-stem="#{esc(option['stem'])}" data-preview="#{esc(option['preview'])}" data-webp="#{esc(download_href(option,'webp'))}" data-pdf="#{esc(download_href(option,'pdf'))}" data-alt="#{esc(blank_alt(option))}" data-pdf-name="#{esc(File.basename(option['pdf']))}" data-webp-name="#{esc(File.basename(option['webp']))}" data-width="#{option['landscape'] ? 680 : 481}" data-height="#{option['landscape'] ? 481 : 680}">#{option['rows']} eilutės</option>!
   end.join+'</select></label>'
  end
  # Keep every alternate share landing reachable to crawlers and usable when
  # scripts are unavailable; the interactive share link still follows the
  # selected row count when the page is running normally.
  variant_share_fallback=variants.drop(1).map do |option|
   %Q!<p><a href="/dalintis/kalendorius/#{esc(option['stem'])}/">#{option['rows']} eilučių kalendoriaus peržiūra ir bendrinimas</a></p>!
  end.join
  variant_share_fallback='<noscript>'+variant_share_fallback+'</noscript>' unless variant_share_fallback.empty?
  variants_data=variants.map { |option|%Q!<span data-variant-stem="#{esc(option['stem'])}" data-preview="#{esc(option['preview'])}" data-webp="#{esc(download_href(option,'webp'))}" data-pdf="#{esc(download_href(option,'pdf'))}" data-alt="#{esc(blank_alt(option))}" data-pdf-name="#{esc(File.basename(option['pdf']))}" data-webp-name="#{esc(File.basename(option['webp']))}" data-width="#{option['landscape'] ? 680 : 481}" data-height="#{option['landscape'] ? 481 : 680}"></span>! }.join
  %Q!<article class="design-card blank-design-card" id="dizainas-#{esc(asset['stem'])}" data-style="#{esc(asset['style'])}" data-layout="#{esc(asset['layout'])}" data-category="#{group}" data-design="#{id}" data-paper="#{paper}" data-pdf-name="#{esc(pdf)}" data-webp-name="#{esc(webp)}"><a class="preview-link" href="#{download_href(asset,'webp')}" target="_blank" rel="noopener" aria-label="Padidinti: #{esc(name)}" title="#{esc(name)}"><img src="#{asset['preview']}" srcset="#{asset['smallPreview']||'/assets/previews-small/'+File.basename(asset['preview'])} 340w, #{asset['preview']} 680w" sizes="(max-width: 600px) 90vw, (max-width: 1050px) 42vw, 30vw" width="#{w}" height="#{h}" loading="lazy" decoding="async" fetchpriority="low" alt="#{esc(alt)}"></a><div class="design-info"><span class="blank-design-card__eyebrow">#{BLANK_GROUPS.fetch(group)[0]}</span><h3><span class="design-number">#{id}</span>#{esc(name)}</h3><p>#{esc(BLANK_COPY.fetch(id))}</p>#{variant_control}#{variant_share_fallback}<span class="design-style">#{asset['style']=='bw' ? 'Nespalvotas' : 'Spalvotas'} · #{paper} · #{asset['landscape'] ? 'Gulsčias' : 'Stačias'}</span><div class="design-actions"><a class="button select-design" href="#{download_href(asset,'webp')}" data-stem="#{esc(asset['stem'])}">Peržiūrėti</a><a class="button" href="#{download_href(asset,'pdf')}" data-download-kind="pdf" download="#{esc(pdf)}">PDF</a><a class="button" href="#{download_href(asset,'webp')}" data-download-kind="webp" download="#{esc(webp)}">Vaizdas</a></div><div class="blank-card-variants" hidden>#{variants_data}</div></div></article>!
 end
 def blank_gallery(items)
  grouped=items.group_by { |asset|asset['design'] }.sort_by { |design,_|design }
  filters='<nav class="design-filters blank-filters" aria-label="Planuoklių kategorijos" role="group">'+[['all','Visi planai'],*BLANK_GROUPS.map { |key,(_,label)|[key,label] }].map { |key,label|%Q!<button type="button" data-design-filter="#{key}" aria-pressed="#{key=='all'}">#{label}</button>! }.join+'</nav>'
  sections=BLANK_GROUPS.map do |key,(heading,_label)|
   designs=grouped.map { |_,variants|variants.sort_by { |asset|asset['rows']||99 } }.select { |variants|blank_group(variants.first)==key }
   next if designs.empty?
   count=designs.length;cards=designs.map { |variants|blank_asset_card(variants.first,variants) }.join
   %Q!<section class="blank-category" data-blank-section="#{key}"><div class="blank-category__heading"><h2>#{heading}</h2><span>#{count} maketai</span></div><div class="gallery blank-gallery">#{cards}</div></section>!
  end.compact.join
  first=items.find { |asset|asset['stem']=='tuscias-01-5-eilutes' }||items.first
  preview=%Q!<section class="blank-featured panel" id="perziura" aria-labelledby="blank-featured-title"><a class="blank-featured__image" id="preview-full" href="#{download_href(first,'webp')}" target="_blank" rel="noopener"><img id="selected-preview" src="#{first['preview']}" width="#{first['landscape'] ? 680 : 481}" height="#{first['landscape'] ? 481 : 680}" alt="#{esc(blank_alt(first))}" fetchpriority="high" decoding="async"></a><div class="blank-featured__copy"><span class="eyebrow">Spaudai paruošta kolekcija</span><h2 id="blank-featured-title"><span id="preview-title">#{esc(first['name'])}</span></h2><p id="preview-format" class="badge">A4 · Vertikalus · 5 eilučių</p><p>Pasirinkite planavimo lapą, atsisiųskite PDF spaudai arba didelės raiškos vaizdą peržiūrai. Mėnesio maketuose galima keisti 5 ir 6 eilučių tinklelius.</p><div class="blank-featured__actions"><a id="selected-pdf" class="button primary" href="#{download_href(first,'pdf')}" download="#{esc(File.basename(first['pdf']))}">Atsisiųsti PDF</a><a id="selected-webp" class="button" href="#{download_href(first,'webp')}" download="#{esc(File.basename(first['webp']))}">Atsisiųsti vaizdą</a><a id="selected-print" class="button" href="#{download_href(first,'pdf')}" target="_blank" rel="noopener">Spausdinti ↗</a></div><small>PDF spausdinkite A4 formatu ir 100 % dydžiu. Spausdinamame lape išsaugotas Lato šriftas ir Kalendorius365™ žyma.</small></div></section>!
  related='<nav class="blank-related" aria-label="Susiję kalendoriai ir planavimo įrankiai"><h2>Susiję kalendoriai ir įrankiai</h2><p><a href="/2027/">2027 metų kalendorius</a> · <a href="/menesiai/">Mėnesių kalendoriai</a> · <a href="/kurti-kalendoriu/">Sukurkite datuotą kalendorių</a> · <a href="/savaitiniai-planuokliai/">Savaitės planuokliai</a> · <a href="/dienos-planuoklis/">Dienos planuoklis</a> · <a href="/pamoku-tvarkarascio-sablonai/">Pamokų tvarkaraščiai</a> · <a href="/darbo-grafiko-sablonai/">Pamainų grafikai</a></p><p>PDF faile tekstas ir tinklelio linijos išlieka vektoriniai. Spausdinkite A4 formatu, pasirinkę 100 % mastelį ir išjungę automatinį „talpinti puslapyje“ keitimą.</p></nav>'
  preview+filters+sections+related
 end
 def run
  generate_months
  HOLIDAY_YEARS.each { |year|generate_year(year) }
  HOLIDAY_YEARS.each { |y|generate_holidays(y);generate_work(y);generate_weeks(y);generate_days_off(y) }
  generate_holiday_articles
  links=[['2027/','2027 metų kalendorius','Visi mėnesiai, šventės ir metiniai failai.'],['2028/','2028 metų kalendorius','Keliamieji metai ir 29 dienų vasaris.'],['2029/','2029 metų kalendorius','Įprastiniai metai: 365 dienos ir 10 metinių kalendoriaus maketų.']]
  cards=->(arr){'<div class="resource-grid">'+arr.map { |url,name,desc|resource_card(url,name,desc) }.join+'</div>'}
  year_facts=[[2027,365,'nekeliamieji metai','penktadienį','penktadienį'],[2028,366,'keliamieji metai, vasaris turi 29 dienas','šeštadienį','sekmadienį'],[2029,365,'nekeliamieji metai','pirmadienį','pirmadienį'],[2030,365,'nekeliamieji metai','antradienį','antradienį']]
  year_cards='<section class="resource-grid year-directory-grid" aria-label="Pasirinkti metų kalendorių">'+year_facts.map { |y,days,kind,start_day,end_day|"<article class=\"panel year-directory-card\"><h2>#{y}</h2><p><strong>#{days} dienos</strong> · #{kind}</p><p>Prasideda #{start_day} ir baigiasi #{end_day}.</p><a class=\"button\" href=\"/#{y}/\">Peržiūrėti #{y} metų kalendorių</a></article>" }.join+'</section>'
  year_comparison='<section class="panel year-comparison"><h2>Palyginti dvejus metus</h2><p>Kalendorinių dienų skaičius yra tikslus; darbo dienų ir valandų suma čia remiasi standartine penkių darbo dienų, 8 valandų grafiko prielaida ir parodytu švenčių rinkiniu.</p><form id="year-comparison-form" class="form-row"><label>Pirmi metai<select id="year-compare-a"><option>2027</option><option>2028</option><option>2029</option><option>2030</option></select></label><label>Antri metai<select id="year-compare-b"><option>2028</option><option>2027</option><option>2029</option><option>2030</option></select></label><button type="submit">Palyginti metus</button></form><div id="year-comparison-result" class="year-comparison-result" role="status" aria-live="polite"></div></section>'
  year_intro=intro('Metų kalendoriai','Pasirinkite metus ir palyginkite tikslų dienų skaičių su standartinio penkių darbo dienų grafiko prielaidomis.')
  year_note='<p>Metų puslapiuose rasite mėnesių kalendorius ir tik tuos PDF bei vaizdo failus, kurie paruošti pasirinktiems metams. Kitų metų datų matematinį kalendorių galite kurti <a href="/kurti-kalendoriu/">kalendoriaus kūrimo įrankyje</a>; nepatvirtintos šventės pažymimos atskirai.</p>'
  page('metai','Metų kalendoriai','2027–2030 m. lietuviški kalendoriai: palyginkite metus ir peržiūrėkite mėnesius, Lietuvos šventes bei spausdinimo parinktis.',year_intro+year_cards+year_comparison+year_note,true)
  MonthCalendarArt.generate(ROOT,DATA['months'])
  monthcards=HOLIDAY_YEARS.map do |year|
   entries=DATA['months'].each_with_index.map do |month,i|
    theme=MonthCalendarArt::THEMES.fetch(i)
    %(<a class="month-directory-card" href="/#{year}/#{month[0]}/"><img class="month-directory-card__art" src="/assets/visuals/month-calendars/#{year}-#{month[0]}.svg" width="240" height="240" alt="" aria-hidden="true" loading="lazy" decoding="async"><div class="month-directory-card__copy"><span class="month-directory-card__season">#{theme[0]}</span><h3>#{month[1]}</h3><p>#{Kalendorius.month(year,i+1)['length']} d. · 10 dizainų</p><span class="month-directory-card__cta">Peržiūrėti kalendorius <span aria-hidden="true">↗</span></span></div></a>)
   end.join
   %(<section class="month-directory-year" aria-labelledby="months-#{year}"><h2 id="months-#{year}">#{year} metai</h2><div class="month-directory-grid">#{entries}</div></section>)
  end.join
  page('menesiai','Mėnesių kalendoriai 2027–2030','Pasirinkite 2027–2030 m. mėnesio kalendorių su Lietuvos šventėmis. Atsisiųskite parengtą maketą arba spausdinkite kalendorių naršyklėje.',intro('Mėnesių kalendoriai','Pasirinkite mėnesį, peržiūrėkite šventes, spausdinkite kalendorių arba pasirinkite atsisiunčiamą maketą.')+monthcards)
  school=DATA['school'];rows=school['periods'].map { |p|"<tr><td>#{p['name']}</td><td>#{p['start']} – #{p['end']}</td><td>#{p['stage']}</td></tr>" }.join
  page('mokiniu-atostogos','Mokinių atostogos 2026–2027','Oficialios 2026–2027 mokslo metų mokinių atostogos Lietuvoje: rudens, Kalėdų, žiemos ir Velykų laikotarpiai pagal ugdymo pakopą.',intro('Mokinių atostogos','2026–2027 mokslo metai. Datos nurodytos imtinai.')+'<div class="table-scroll"><table class="data-table"><thead><tr><th>Atostogos</th><th>Laikotarpis</th><th>Ugdymo pakopa</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+"<div class=\"source-note\">Šaltinis: <a href=\"#{school['source']}\">Švietimo, mokslo ir sporto ministerija</a>. Peržiūrėta #{school['reviewed']}. Velykų atostogos skiriasi pagal ugdymo pakopą. Vasaros pradžia priklauso nuo klasės ir ugdymo plano; vienos datos visiems neteikiame.</div><h2>2027–2028 mokslo metai</h2><p>Šių mokslo metų tvarkaraštis mūsų šaltiniuose dar nepatvirtintas. Spėjamų datų neskelbiame.</p><a href=\"/2027/\">2027 metų kalendorius</a>")
  generate_tools
  generate_phase4
  privacy_policy=File.read("#{ROOT}/site/_includes/privacy-policy-lt.html")
  page('privatumas','Privatumo politika ir duomenų saugojimas','Kaip Kalendorius365 parenka miestą, tvarko orų užklausas, saugo naršyklės nuostatas ir naudoja lankomumo analitiką. Sužinokite apie savo teises.',privacy_policy)
  File.write("#{ROOT}/site/404.html", "---\nlayout: default\ntitle: Puslapis nerastas\ndescription: Ieškomo puslapio nėra. Raskite Kalendorius365 metų ir mėnesių kalendorius.\n---\n{% include 404-lt.html %}\n")
 end
 def generate_months
  HOLIDAY_YEARS.each do |y|
   (1..12).each do |m|
    items=MANIFEST.select { |e|e['kind']=='monthly' && e['year']==y && e['month']==m };next if items.empty?
    mo=Kalendorius.month(y,m);work=Kalendorius.work_month(y,m);first=items.find { |e|e['design']==(y==2027 && m==1 ? '06' : y==2028 && m==2 ? '02' : '01') }||items.first
    prev=Date.new(y,m,1)<<1;nxt=Date.new(y,m,1)>>1
    link=method(:month_navigation_link)
    monthnav=calendar_sidebar(y,m)
    stats='<div class="month-stats">'+[[mo['length'],'Kalendorinės dienos'],[work['days'],'Darbo dienos'],[work['weekends'],'Savaitgalio dienos'],[mo['days'].count { |d|d['holidays'].any? },'Šventinės dienos'],[mo['weeks'],'ISO savaičių eilutės']].map { |n,l|"<span class=\"badge\">#{l}: <strong>#{n}</strong></span>" }.join+'</div>'
    preview="<section class=\"large-preview panel\" id=\"perziura\"><div class=\"panel-title\"><h2 id=\"preview-title\">#{first['name']}</h2><span id=\"preview-format\">#{first['paper']} · #{first['landscape'] ? 'Gulsčias' : 'Stačias'}</span></div><a id=\"preview-full\" href=\"#{download_href(first,'webp')}\" target=\"_blank\" rel=\"noopener\">#{selected_calendar_image(first)}</a></section>"
    first_weekday=WEEKDAY_NAMES[mo['days'].first['weekday']-1]
    last_weekday=WEEKDAY_NAMES[mo['days'].last['weekday']-1]
    iso_weeks=mo['days'].map { |d|d['isoWeek'] }.uniq.join(', ')
    options=items.map { |e| "<option value=\"#{e['stem']}\" #{e['stem']==first['stem'] ? 'selected' : ''}>#{e['design']}. #{e['name']}</option>" }.join
    actions="<aside class=\"download-panel panel\"><h2>Atsisiuntimo parinktys</h2><label>Dizainas<select id=\"design-picker\" data-tools-readiness inert aria-busy=\"true\">#{options}</select></label><p>Lietuviškos datos · A3 · PDF ir 600 PPI raiškos vaizdai.</p><div class=\"download-actions\"><a class=\"button primary full-width\" id=\"selected-pdf\" href=\"#{download_href(first,'pdf')}\" download=\"#{esc(File.basename(first['pdf']))}\">Atsisiųsti PDF</a><a class=\"button full-width\" id=\"selected-webp\" href=\"#{download_href(first,'webp')}\" download=\"#{esc(File.basename(first['webp']))}\">Atsisiųsti vaizdą</a><a class=\"button full-width\" id=\"selected-print\" href=\"#{download_href(first,'pdf')}\" target=\"_blank\" rel=\"noopener\">Atidaryti PDF spausdinimui ↗</a></div><small>PDF spausdinkite pasirinkę A3 formatą ir 100 % dydį. Individualias datas kurkite <a href=\"/kurti-kalendoriu/\">kalendoriaus kūrimo įrankyje</a>.</small><h2>#{DATA['months'][m-1][1]}: datos</h2><p>Mėnesio trukmė – #{mo['length']} d. Pirmoji mėnesio diena – #{first_weekday}; paskutinė – #{last_weekday}. ISO savaitės: #{iso_weeks}.</p></aside>"
    filters='<div class="design-filters segmented" role="group" aria-label="Kalendoriaus išdėstymas">'+[['all','Visi dizainai'],['portrait','Vertikalūs'],['landscape','Horizontalūs'],['holidays','Su pažymėtomis šventėmis']].map { |v,l|"<button data-design-filter=\"#{v}\" aria-pressed=\"#{v=='all'}\">#{l}</button>" }.join+'</div>'
    guidance="Mėnesio trukmė – #{mo['length']} d.; kalendoriaus tinklelyje – #{mo['weeks']} eilutės. Pirmoji mėnesio diena – #{first_weekday}; paskutinė – #{last_weekday}. Pagal įprastą penkių darbo dienų savaitę: darbo dienų – #{work['days']}, apskaičiuota darbo trukmė – #{work['hours']} val.#{work['shortened'].any? ? ' Sutrumpintos darbo dienos: '+work['shortened'].join(', ')+'.' : ' Prieššventinių darbo dienų trumpinimų nėra.'}"
    planning_2030 = y==2030 ? screen_month_planning(mo,work) : ''
    statutory_dates = y==2030 ? planning_2030 : "<h2>Šventinės dienos</h2>#{holiday_table(y,m)}"
    month_answer="#{y} m. #{DATA['months'][m-1][2]} mėnesio kalendorinių dienų skaičius – #{mo['length']}, darbo dienų – #{work['days']} pagal penkių dienų savaitę. Spausdinimui paruošti 10 A3 dizainų."
    content='<div class="print-layout">'+monthnav+'<div class="month-heading">'+calendar_period_intro(title(y,m),month_answer,link.call(prev,'‹ Ankstesnis')+link.call(nxt,'Kitas ›')+'<a class="button" href="#menesio-datos">Peržiūrėti mėnesio datas</a>',"month-calendars/#{y}-#{DATA['months'][m-1][0]}")+stats+'</div>'+preview+actions+'<section class="monthly-collection"><h2>10 kalendoriaus dizainų</h2>'+filters+gallery(items,true)+"<h2>Mėnesio planavimas</h2><p>#{guidance}</p><p>Rinkitės vertikalų arba horizontalų maketą. Kiekvieno dizaino kortelėje nurodyta, ar jame pažymėtos šventinės dienos.</p>#{month_context(y,m)}<section class=\"month-overview\" id=\"menesio-datos\"><h2>Mėnesio datos</h2>#{calendar_date_help}#{static_month(y,m,day_plans: true)}</section>#{statutory_dates}"+commemoration_table(y,m)+source+"<nav class=\"adjacent\" aria-label=\"Susiję kalendoriai\">#{link.call(prev,'‹ Ankstesnis mėnuo')}<a href=\"/#{y}/\">#{y} metų kalendorius</a><a href=\"#{month_url(y==2027 ? 2028 : 2027,m)}\">Tas pats mėnuo #{y==2027 ? 2028 : 2027} metais</a>#{link.call(nxt,'Kitas mėnuo ›')}<a href=\"/sventes/\">Lietuvos šventės ir atmintinos dienos</a><a href=\"/tuscias-kalendorius/\">Tušti kalendoriai</a></nav></section></div>"
    page("#{y}/#{DATA['months'][m-1][0]}",title(y,m)+' – PDF ir vaizdai',"#{title(y,m)} su Lietuvos šventėmis. Mėnesio trukmė – #{mo['length']} d., darbo dienų – #{work['days']}. Dešimt A3 dizainų, PDF ir 600 PPI raiškos vaizdai.",content,true)
   end
  end
 end
 def month_context(year, month)
  slug=DATA['months'][month-1][0]
  genitive=DATA['months'][month-1][2]
  %(<p>Prieš planuodami datas pasitikrinkite <a href="/sventes/#{year}/#{slug}/">#{genitive} švenčių ir minėjimų gide</a>. Sveikinimams pravers <a href="/vardadieniai/#{slug}/">#{genitive} vardadieniai</a>, o dangaus stebėjimams – <a href="/menulio-kalendorius/#{year}/#{slug}/">#{genitive} Mėnulio kalendorius</a>. Darbo dienų ir valandų įverčius rasite <a href="/darbo-dienos/#{year}/">#{year} m. darbo kalendoriuje</a>.</p>)
 end
 def calendar_period_intro(title, description, links, image)
  art=%(<img class="calendar-period-art" src="/assets/visuals/#{image}.svg" width="86" height="86" decoding="async" alt="" aria-hidden="true">)
  %(<div class="page-heading calendar-period-heading"><div class="calendar-period-heading__copy">#{art}<div><h1>#{title}</h1><p class="page-intro">#{description}</p></div></div><div class="toolbar-group">#{links}</div></div>)
 end
 def month_navigation_link(date,label)
  return '' unless (2027..2030).cover?(date.year)
  %(<a class="button" href="#{month_url(date.year,date.month)}">#{label}</a>)
 end
 def calendar_date_help
  '<p class="calendar-date-help">Paspauskite datą ir atverkite dienos planą. Pažymėtos datos atveria šventės arba atmintinos dienos aprašą.</p>'
 end
 def calendar_sidebar(year, month = nil)
  years=[2027,2028,2029,2030].map do |candidate|
   route=month ? month_url(candidate,month) : "/#{candidate}/"
   %(<a href="#{route}"#{candidate==year ? ' aria-current="true"' : ''}>#{candidate}</a>)
  end.join
  months=DATA['months'].each_with_index.map do |entry,i|
   number=i+1
   %(<a href="#{month_url(year,number)}"#{number==month ? ' aria-current="page"' : ''}><span class="month-sidebar__number">#{format('%02d',number)}</span><strong>#{entry[1]}</strong><span aria-hidden="true">›</span></a>)
  end.join
  preview=month ? %(<details><summary>#{DATA['months'][month-1][1]} #{year}</summary>#{static_month(year,month)}</details>) : ''
  %(<aside class="month-sidebar panel" aria-label="Mėnesio navigacija"><p class="month-sidebar__title">Pasirinkite metus</p><nav class="month-sidebar__years" aria-label="Metų kalendoriai">#{years}</nav><nav class="month-sidebar__months" aria-label="Metų mėnesiai">#{months}</nav>#{preview}<hr><a href="/#{year}/">#{year} metų kalendorius</a><a href="/sventes/">Lietuvos šventės</a><a href="/darbo-dienos/#{year}/">#{year} m. darbo dienos</a><a href="/kurti-kalendoriu/">Kurti savo</a></aside>)
 end
 def screen_month_planning(facts, work)
  year, month = facts.values_at('year', 'month')
  month_name = DATA.fetch('months').fetch(month - 1).fetch(2)
  days = facts.fetch('days')
  holidays = days.select { |day| day.fetch('holidays').any? }
  long_breaks = days.chunk { |day| day.fetch('weekday') >= 6 || day.fetch('holidays').any? }
    .filter_map { |off, dates| dates if off && dates.length >= 3 }
  breakdown = [
   ['Darbo dienos', work.fetch('days')],
   ['Šeštadieniai ir sekmadieniai', work.fetch('weekends')],
   ['Šventinės dienos pirmadieniais–penktadieniais', work.fetch('holidays')],
   ['Darbo laikas, val.', work.fetch('hours')]
  ].map { |label, value| "<div><dt>#{label}</dt><dd>#{value}</dd></div>" }.join
  day_label = ->(day) { "<time datetime=\"#{day['date']}\">#{month_name} #{day['day']} d.</time>" }
  break_list = long_breaks.map do |dates|
   "<li>#{day_label.call(dates.first)} – #{day_label.call(dates.last)} (#{dates.length} d.)</li>"
  end.join
  break_description = if break_list.empty?
   '<p>Šio mėnesio ribose nėra trijų ar daugiau iš eilės einančių poilsio dienų pagal penkių dienų grafiką.</p>'
  else
   "<p>Trys ar daugiau poilsio dienų iš eilės šio mėnesio ribose:</p><ul>#{break_list}</ul>"
  end
  short_days = work.fetch('shortened').map do |key|
   day = days.find { |item| item.fetch('date') == key }
   day_label.call(day)
  end
  shortened = short_days.empty? ? 'Šio mėnesio modelyje prieššventinių darbo dienų trumpinimų nėra.' :
   "Šiame grafike viena valanda trumpinama šiomis datomis: #{short_days.join(', ')}."
  <<~HTML
    <section class="panel content-guide screen-calendar-plan" aria-labelledby="screen-month-plan">
      <h2 id="screen-month-plan">#{year} m. #{month_name} darbo ir poilsio dienos</h2>
      <p>Skaičiuojama pagal penkių dienų, 40 valandų darbo savaitę. Savaitgalį sutapusios šventės dar kartą neatimamos.</p>
      <dl class="screen-calendar-plan__metrics">#{breakdown}</dl>
      #{break_description}
      <p>#{shortened} Jei dirbate šeštadieniais, palyginkite <a href="/darbo-dienos/#{year}/">penkių ir šešių dienų savaitės modelius</a>.</p>
      #{holidays.empty? ? '<p>Šį mėnesį šventinių dienų pagal Darbo kodeksą nėra.</p>' : "<h3>Šio mėnesio šventinės dienos</h3>#{holiday_table(year, month)}"}
    </section>
  HTML
 end
 def screen_year_planning(year)
  work = (1..12).map { |month| Kalendorius.work_month(year, month) }
  rows = work.map do |item|
   month = item.fetch('month')
   "<tr><th scope=\"row\"><a href=\"#{month_url(year, month)}#screen-month-plan\">#{DATA['months'][month - 1][1]}</a></th><td>#{item['days']}</td><td>#{item['holidays']}</td><td>#{item['hours']}</td></tr>"
  end.join
  <<~HTML
    <section class="panel content-guide screen-calendar-plan">
      <h2>#{year} m. planavimas pagal darbo dienas</h2>
      <p>Per metus pagal įprastą penkių dienų grafiką skaičiuojamos #{work.sum { |item| item['days'] }} darbo dienos ir #{work.sum { |item| item['hours'] }} darbo valandos. Pasirinkus mėnesį matyti ir švenčių datos bei ilgesni poilsio tarpai.</p>
      <div class="table-scroll"><table class="data-table">
        <caption>Penkių dienų darbo savaitė ir prieššventiniai trumpinimai</caption>
        <thead><tr><th scope="col">Mėnuo</th><th scope="col">Darbo dienos</th><th scope="col">Šventės darbo dienomis</th><th scope="col">Darbo valandos</th></tr></thead><tbody>#{rows}</tbody>
      </table></div>
      <p>Kitokiam grafikui tinka <a href="/darbo-dienos/#{year}/">darbo dienų kalendorius su dviem savaitės modeliais</a>. Mėnesių tinklelius galite spausdinti naršyklėje, o individualų maketą susikurti <a href="/kurti-kalendoriu/?metai=#{year}&amp;menuo=0">kalendoriaus kūrimo įrankyje</a>.</p>
    </section>
  HTML
 end
 def calendar_year_header(year, lead)
  %({% include tool-page-head.html icon="year-#{year}" title="#{year} metų kalendorius" lead="#{lead}" action="#metu-apzvalga" action_label="Peržiūrėti metų datas" %})
 end
 def calendar_year_overview(year,months)
  %(<section class="annual-overview" id="metu-apzvalga" aria-labelledby="annual-overview-title"><header><h2 id="annual-overview-title">#{year} m. kalendorius pagal mėnesius</h2><button type="button" data-print>Spausdinti metų apžvalgą</button></header>#{calendar_date_help}<div class="year-grid annual-sheet">#{months}</div></section>)
 end
 def year_context(year)
  %(<p>Poilsio planą palyginkite su <a href="/sventes/#{year}/">#{year} m. šventinių dienų sąrašu</a>. Darbo grafiko savaites patikrinkite <a href="/savaites/#{year}/">#{year} m. ISO savaičių lentelėje</a>. Jei planuojate stebėjimus, atverkite <a href="/menulio-kalendorius/#{year}/">#{year} m. Mėnulio fazių kalendorių</a>.</p>)
 end
 def generate_year(y)
  months=(1..12).map do |month|
   label=DATA['months'][month-1][1]
   %(<section class="year-month"><h3><a href="#{month_url(y,month)}">#{label} <span aria-hidden="true">→</span></a></h3>#{static_month(y,month,day_plans: true)}</section>)
  end.join
  items=MANIFEST.select { |entry|entry['kind']=='annual' && entry['year']==y }
  first=items.find { |entry|entry['design']==(y==2027 ? '06' : '01') }||items.first
  days=Date.gregorian_leap?(y) ? '366 dienos, vasaris turi 29 dienas' : '365 dienos'
  workdays = (1..12).sum { |m| Kalendorius.work_month(y, m).fetch('days') }
  heading=calendar_year_header(y, "#{days}. Pagal penkių dienų savaitę darbo dienų – #{workdays}. Žemiau rasite 12 mėnesių datas ir metinius PDF šablonus.")
  featured=<<~HTML
   <section class="annual-templates" id="metiniai-sablonai" aria-labelledby="annual-templates-title">
     <header class="annual-templates__header">
       <img src="/assets/visuals/shell/pdf.svg" class="shell-art" alt="" aria-hidden="true" width="78" height="78">
       <div><h2 id="annual-templates-title">#{y} m. kalendoriaus šablonai</h2><p>Pasirinkite vieną iš dešimties A3 maketų. Atsisiųskite PDF spausdinimui arba vaizdą.</p></div>
     </header>
     <div class="annual-templates__feature">#{annual_preview(first)}#{annual_downloads(items,first)}</div>
     #{annual_print_quality(first)}
     #{gallery(items,true)}
   </section>
  HTML
  overview=calendar_year_overview(y,months)
  overview+=screen_year_planning(y) if y==2030
  dates=%(<h2>Lietuvos šventinės dienos</h2>#{holiday_table(y)}#{commemoration_table(y)}#{source}#{year_context(y)}<nav class="guide-actions" aria-label="#{y} m. datos"><a href="/darbo-dienos/#{y}/">Darbo dienos ir valandos</a><a href="/nedarbo-dienos/#{y}/">Nedarbo dienos #{y} m.</a><a href="/sventes/">Lietuvos šventės</a></nav>)
  html=%(<div class="year-workspace annual-workspace">#{calendar_sidebar(y)}<div>#{heading}#{featured}#{overview}#{dates}</div></div>)
  page(y.to_s,"#{y} metų kalendorius – atsisiųsti ir spausdinti","#{y} metų kalendorius su visais 12 mėnesių, Lietuvos šventėmis ir ISO savaitėmis. Mėnesių kolekcijos ir metiniai A3 PDF bei vaizdo failai.",html,true)
 end
 def generate_holidays(y)
  annual=MANIFEST.find { |e|e['kind']=='annual' && e['year']==y }
  statutory = Kalendorius.holidays(y).uniq { |holiday| holiday.fetch('date') }
  weekday_count = statutory.count { |holiday| Date.iso8601(holiday.fetch('date')).cwday <= 5 }
  intro="#{y} m. Lietuvos šventinių dienų – #{statutory.length}, iš jų pirmadienį–penktadienį – #{weekday_count}. Pagal Darbo kodeksą švenčių dienomis paprastai nedirbama, tačiau taikomos įstatyme numatytos išimtys."
  html=calendar_period_intro("#{y} metų šventinės dienos Lietuvoje",intro,yearlinks('sventes/', current: y),"shell/year-#{y}")
  html+=%(<p id="next-holiday" class="source-note" data-holiday-year="#{y}" hidden></p>)+holiday_table(y,nil,true)+commemoration_table(y,nil,true)+source
  html+=%(<p class="source-note">2030 m. datos apskaičiuotos pagal paskelbtą švenčių tvarką. Iki 2030 m. ji gali pasikeisti.</p>) if y==2030
  html+=%(<p>Darbo ir poilsio laiką palyginkite <a href="/darbo-dienos/#{y}/">#{y} m. darbo dienų lentelėje</a>, o mėnesių tinklelius rasite <a href="/#{y}/">#{y} metų kalendoriuje</a>.</p>)
  html+=%(<p><a href="/nedarbo-dienos/#{y}/">Laisvos dienos #{y} m. ir ilgieji savaitgaliai</a></p>)
  html+='<p><a href="/sventes/">Visų švenčių ir atmintinų dienų paaiškinimai</a></p>'
  html+="<h2>Šventės spausdinamame kalendoriuje</h2><p>Metiniame lape šventinės dienos išskirtos raudonai, o pilnas jų sąrašas pateiktas aukščiau.</p><a class=\"button\" href=\"#{download_href(annual,'pdf')}\" download>Metų PDF su šventėmis</a> <a class=\"button\" href=\"#{download_href(annual,'webp')}\" download>Metų kalendoriaus vaizdas</a>" if annual
  page("sventes/#{y}","#{y} metų šventinės dienos Lietuvoje","Lietuvos šventinės dienos #{y} metais: tikslios datos, savaitės dienos, Velykos, Motinos ir Tėvo diena bei oficialūs teisės šaltiniai.",html,true)
 end
 def generate_work(y)
  tables=[false,true].map do |six|
   stats=(1..12).map { |m|Kalendorius.work_month(y,m,six) }
   rows=stats.map { |s|"<tr><td><a href=\"#{month_url(y,s['month'])}\">#{DATA['months'][s['month']-1][1]}</a></td><td>#{s['days']}</td><td>#{s['weekends']}</td><td>#{s['holidays']}</td><td>#{s['shortened'].length}</td><td>#{s['hours']}</td></tr>" }.join
   totals=%w[days weekends holidays].map { |k|stats.sum { |s|s[k] } }+[stats.sum { |s|s['shortened'].length },stats.sum { |s|s['hours'] }]
   short=stats.flat_map { |s|s['shortened'] }
   "<section data-work-table=\"#{six ? 6 : 5}\" #{six ? 'hidden' : ''}><div class=\"table-scroll\"><table class=\"data-table\"><caption>#{six ? 'Šešių' : 'Penkių'} dienų savaitė</caption><thead><tr><th>Mėnuo</th><th>Darbo dienos</th><th>Poilsio dienos</th><th>Šventės darbo dienomis</th><th>Trumpinimai (1 val.)</th><th>Darbo valandos</th></tr></thead><tbody>#{rows}</tbody><tfoot><tr><td>Iš viso</td>#{totals.map { |n|"<td>#{n}</td>" }.join}</tr></tfoot></table></div><h2>Prieššventinės darbo dienos</h2><p>#{short.empty? ? 'Nėra.' : short.join(', ')}.</p></section>"
  end.join
  comparison='<section class="workday-compare panel" aria-labelledby="workday-compare-title"><div class="workday-compare__heading"><span>Du 40 valandų darbo savaitės pavyzdžiai</span><h2 id="workday-compare-title">Palyginkite 5 ir 6 dienų grafiką</h2><p>Abu skaičiai apskaičiuoti iš žemiau pateiktų mėnesio lentelių, taikant tą patį švenčių rinkinį ir švenčių išvakarės trumpinimus.</p></div><div class="workday-compare__grid" role="group" aria-label="Standartinių savaitės grafikų metiniai skaičiai"><article data-work-compare="5"><h3>5 dienos per savaitę</h3><p><strong data-work-days>—</strong><span>darbo dienų</span></p><p><strong data-work-hours>—</strong><span>darbo valandų</span></p></article><article data-work-compare="6"><h3>6 dienos per savaitę</h3><p><strong data-work-days>—</strong><span>darbo dienų</span></p><p><strong data-work-hours>—</strong><span>darbo valandų</span></p></article></div><p id="workday-compare-delta" role="status" aria-live="polite">Skaičiai įkeliami iš mėnesio lentelių.</p></section>'
  # The comparison remains useful before JavaScript and when scripting is disabled.
  comparison=comparison.sub('<section class="workday-compare ', '<section id="workday-compare" class="workday-compare ')
  comparison_totals={}
  [5,6].each do |schedule|
   stats=(1..12).map { |m|Kalendorius.work_month(y,m,schedule==6) }
   total_days=stats.sum { |item|item['days'] };total_hours=stats.sum { |item|item['hours'] }
   comparison_totals[schedule]=[total_days,total_hours]
   comparison=comparison.sub(%r{<article data-work-compare="#{schedule}">.*?</article>}m) { |block|block.sub('<strong data-work-days>—',"<strong data-work-days>#{total_days}").sub('<strong data-work-hours>—',"<strong data-work-hours>#{total_hours}") }
  end
  comparison=comparison.sub('Skaičiai įkeliami iš mėnesio lentelių.',"Šešių ir penkių dienų savaitės modelių skirtumas: darbo dienų – #{comparison_totals[6][0]-comparison_totals[5][0]}, valandų – #{comparison_totals[6][1]-comparison_totals[5][1]}.")
  html=calendar_period_intro("#{y} metų darbo dienų kalendorius","#{y} m. pagal 5 dienų savaitę numatyta #{comparison_totals[5][0]} darbo d. ir #{comparison_totals[5][1]} val., pagal 6 dienų savaitę – #{comparison_totals[6][0]} darbo d. ir #{comparison_totals[6][1]} val.",yearlinks('darbo-dienos/', current: y),"shell/year-#{y}")+comparison+'<div class="toolbar-group"><label>Darbo savaitė<select id="work-schedule"><option value="5">5 dienos · 40 valandų</option><option value="6">6 dienos · 40 valandų</option></select></label><button id="work-csv">Atsisiųsti CSV suvestinę</button><button data-print>Spausdinti lentelę</button></div>'+tables+'<h2>Skaičiavimo metodika</h2><p>Penkių dienų savaitė: pirmadienis–penktadienis, 8 valandos per dieną. Šešių dienų pavyzdys: pirmadienis–penktadienis po 7 valandas, šeštadienis 5 valandas (40 valandų per savaitę). Šventinės dienos iš darbo dienų atimamos. Savaitgalio šventės neperkeliamos.</p><p>Pagal Darbo kodekso 112 straipsnio 6 dalį, švenčių dienos išvakarėse numatyta darbo diena trumpinama viena valanda, išskyrus pagal sutrumpintą darbo laiko normą dirbančius darbuotojus. Nuo 2026-11-01 šios dalies redakcija taip pat nustato, kad darbo užmokestis paliekamas; kai atlygis priklauso nuo darbo normų, už trumpintą valandą mokamas vidutinis darbo užmokestis, o kai dėl darbo organizavimo ypatumų ar nepertraukiamos veiklos trumpinti neįmanoma – kaip už viršvalandinį darbą. Skaičiuoklė pateikia tik 5 arba 6 dienų standartinio grafiko aritmetinį įvertį ir neapskaičiuoja šių individualių darbo užmokesčio išimčių, atostogų, suminės apskaitos ar pamaininio darbo. Tai bendro pobūdžio planavimo įrankis, o ne individuali darbo teisės konsultacija.</p>'+source+"<p><a href=\"/datos-skaiciuokle/\">Apskaičiuoti pasirinktą laikotarpį</a> · <a href=\"/#{y}/\">#{y} metų kalendorius</a></p>"
  page("darbo-dienos/#{y}","#{y} metų darbo dienų kalendorius","#{y} metų darbo dienų, valandų, švenčių ir prieššventinių trumpinimų suvestinė. Palyginkite 5 ir 6 dienų savaitę, atverkite mėnesius ir patikrinkite pasirinktos datos statusą.",html,true)
 end
 def generate_weeks(y)
  total=Date.new(y,12,28).cweek
  rows=(1..total).map { |w|a=Date.commercial(y,w,1);b=a+6;"<tr><th scope=\"row\">#{w}</th><td><time datetime=\"#{a}\">#{a}</time></td><td><time datetime=\"#{b}\">#{b}</time></td></tr>" }.join
  first = Date.commercial(y, 1, 1)
  last = Date.commercial(y, total, 7)
  weeks_intro = "#{y} m. turi #{total} ISO savaites. Jos prasideda #{first.iso8601} ir baigiasi #{last.iso8601}. Kiekviena savaitė trunka nuo pirmadienio iki sekmadienio."
  content=calendar_period_intro("#{y} metų savaičių numeriai",weeks_intro,'{% include week-year-links.html %}',"shell/year-#{y}")+%({% include week-year-tools.html year=#{y} %})+"<div class=\"table-scroll week-year-table\"><table class=\"data-table\"><caption>#{y} m. ISO savaičių datos</caption><thead><tr><th>ISO savaitė</th><th>Pirmadienis</th><th>Sekmadienis</th></tr></thead><tbody>#{rows}</tbody></table></div><a href=\"/#{y}/\">#{y} metų kalendorius</a>"
  content+=%(<p class="source-note">Patikrinkite, kaip taikoma <a href="https://www.gnu.org/software/emacs/manual/html_node/calc/ISO-8601.html">ISO savaitės taisyklė</a>. Jei reikia suskaičiuoti ne savaites, o pasirinkto laikotarpio darbo dienas, atverkite <a href="/datos-skaiciuokle/">datų skaičiuoklę</a>.</p>)
  page("savaites/#{y}","#{y} metų savaičių numeriai","Visos #{y} metų ISO savaitės: tikslūs pirmadienio–sekmadienio intervalai ir dabartinės savaitės numerio įrankis. Metų sandūros paaiškinimas.",content,true)
 end
 def generate_tools
  page('datos-skaiciuokle','Datos skaičiuoklė – dienų skirtumas ir darbo dienos','Skaičiuokite tikslią laikotarpio trukmę, darbo dienas su Lietuvos šventėmis ir pridėkite kalendorinių arba darbo dienų prie datos.',intro('Datos skaičiuoklė','Skaičiuokite tikslius intervalus, darbo dienas su Lietuvos šventėmis ir datas po kalendorinių ar darbo dienų.')+<<~HTML,true)
   <section class="date-hero" aria-label="Datos planavimo įrankio pristatymas">
    <div class="date-hero__copy"><span class="date-hero__eyebrow">Lietuvos kalendorius · tikslus planavimas</span><h2>Kiek dienų yra tarp dviejų datų?</h2><p>Nuo 2028 m. vasario 28 d. iki kovo 1 d. praeina 2 kalendorinės dienos. Įskaičiavus abi datas gaunamos 3 dienos, nes 2028 m. vasaris turi 29 dienas. Įveskite savo datas, kad apskaičiuotumėte trukmę ir darbo dienas.</p><div class="date-hero__features"><span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3.5h12a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 16V5A1.5 1.5 0 0 1 4 3.5Z"/><path d="M6 2v3m8-3v3M3 7h14m-9 4 2 2 4-4"/></svg>Valstybinės šventės</span><span><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.3"/><path d="M10 5.5V10l3 2"/></svg>Darbo dienų skaičiuoklė</span></div></div>
    <div class="date-hero__art"><img src="/assets/visuals/shell/date-range.svg" width="420" height="220" alt="Du kalendoriaus lapai su pažymėtomis datomis, sujungti rodykle" decoding="async"></div>
   </section>
   <section class="panel calculator date-calculator" aria-labelledby="date-calculator-title"><div class="date-calculator__heading"><div><span class="date-calculator__step">1 · Pasirinkite laikotarpį</span><h2 id="date-calculator-title">Datos intervalo skaičiuoklė</h2><p>Pasirinkite, ar įtraukti pabaigos datą į kalendorinių dienų skaičių. Skaičiuojant darbo dienas visada įtraukiamos abi datos ir atmetamos Lietuvos švenčių dienos.</p></div><span class="date-calculator__badge"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3.5h12A1.5 1.5 0 0 1 17.5 5v11a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 16V5A1.5 1.5 0 0 1 4 3.5Z"/><path d="M6 2v3m8-3v3M3 7h14M6.5 10h2m3 0h2m-7 3h2m3 0h2"/></svg>Data lieka jūsų įrenginyje</span></div><form id="calculator" data-tools-readiness inert aria-busy="true"><div class="date-inputs"><label>Pradžios data<input name="start" type="date" min="1900-01-01" max="2100-12-31" required></label><button class="date-swap" type="button" id="date-swap" aria-label="Sukeisti pradžios ir pabaigos datas" title="Sukeisti datas"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h11m0 0-3-3m3 3-3 3M16 14H5m0 0 3 3m-3-3 3-3"/></svg></button><label>Pabaigos data<input name="end" type="date" min="1900-01-01" max="2100-12-31" required></label></div><div class="date-presets" role="group" aria-label="Greitai pasirinkti laikotarpį"><span>Greitai pasirinkti</span><button type="button" data-range="week">Ši savaitė</button><button type="button" data-range="month">Šis mėnuo</button><button type="button" data-range="year">Šie metai</button><button type="button" data-range="30">30 dienų</button></div><label class="check date-inclusive"><input name="inclusive" type="checkbox">Įtraukti abi ribines datas į kalendorinių dienų skaičių</label><div class="date-adjust"><label for="date-offset">Nuo pradžios datos apskaičiuoti</label><div class="date-adjust__fields"><input id="date-offset" name="offset" type="number" min="-36600" max="36600" value="0"><select name="offset-unit" aria-label="Dienų rūšis"><option value="calendar">kalendorinių dienų</option><option value="workday">darbo dienų</option></select><span>(neigiamas skaičius atima)</span></div></div><div class="date-form-actions"><button class="primary" type="submit"><svg class="icon" aria-hidden="true" focusable="false"><use href="/assets/visuals/home-icons.svg?v=icons-20261016a#calendar"></use></svg>Apskaičiuoti</button><button type="button" id="copy-date-result"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="7" width="10" height="11" rx="2"/><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>Kopijuoti rezultatą</button><button type="button" id="share-date-result"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="15" cy="4" r="2.2"/><circle cx="5" cy="10" r="2.2"/><circle cx="15" cy="16" r="2.2"/><path d="m7 9 6-4m-6 6 6 4"/></svg>Dalytis nuoroda</button></div><p id="date-calculator-status" class="date-calculator__status" role="status" aria-live="polite"></p></form><div id="calc-result" class="result date-result" aria-live="polite" aria-atomic="true">Pasirinkite datas, kad pamatytumėte dienų ir darbo laiko suvestinę.</div><div id="calc-chart" class="date-chart" aria-live="polite"></div><div class="date-method"><span><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.3"/><path d="M10 5.5V10l3 2"/></svg></span><p>Kalendorinė trukmė pateikiama metais, mėnesiais ir dienomis. Darbo dienos skaičiuojamos imtinai, pirmadieniais–penktadieniais, atmetant Lietuvos šventes. Valandos remiasi standartine 5 dienų savaite ir gali neapimti jūsų darbo grafiko išimčių.</p></div></section>
   <section class="date-method-panel"><div><span class="date-calculator__step">Skaičiavimo metodika</span><h2>Aiškios prielaidos, patikimi planai</h2><p>Dienų skirtumas skaičiuojamas pagal kalendorines datas, todėl vasaros laiko pokyčiai rezultato nekeičia. Įtraukus abi ribines datas prie kalendorinių dienų pridedama viena diena. Darbo dienų skaičius visada įtraukia pradžios ir pabaigos datas, neįtraukia savaitgalių bei Lietuvos švenčių. Standartinių darbo valandų skaičiavime atsižvelgiama į prieššventinės dienos trumpinimą.</p><a href="/darbo-dienos/2027/">Peržiūrėti darbo dienų kalendorių <span aria-hidden="true">→</span></a></div><div class="date-method-panel__mark" aria-hidden="true"><img src="/assets/visuals/shell/date-stopwatch.svg" width="112" height="112" alt="" aria-hidden="true" loading="lazy" decoding="async"></div></section>
   <section class="panel calculator"><h2>Kiek liko laiko?</h2><label>Pasirinkta data<input type="date" id="countdown-date" data-tools-readiness inert aria-busy="true"></label><p id="countdown-result" class="result" aria-live="polite"></p><p id="countdown-standard"></p></section>
  HTML
  # The personal editor is an authored source page with its own scoped modules.
  # Never replace it with the legacy generator during release preparation.
  editor_source=File.read("#{ROOT}/site/kurti-kalendoriu/index.html")
  abort 'Personal calendar editor source is missing' unless editor_source.include?('calendar_editor: true') && editor_source.include?('id="calendar-editor"')
 end
 def generate_phase4
  html=intro('Atostogų planuoklis','Palyginkite ilgiausią vientisą poilsį, atostogų dienų efektyvumą ir kelis atskirus laikotarpius 2027–2030 metais.')+<<~HTML
   <section class="panel leave-legal-note" aria-labelledby="leave-legal-title">
    <h2 id="leave-legal-title">Ką šis skaičiavimas parodo</h2>
    <p>Pasirinkite darbo savaitę, atostogų dienų likutį ir tinkamą laiką. Skaičiuoklė remiasi Lietuvos įstatyme nustatytomis švenčių dienomis; šventės į atostogų dienų skaičių neįtraukiamos. Rezultatus derinkite su savo darbo grafiku ir darbdaviu.</p>
    <details class="leave-legal-details"><summary>Teisinės taisyklės, skaičiavimo ribos ir oficialūs šaltiniai</summary>
     <p>Daugumai įprastų darbuotojų DK 126 straipsnis nustato bent 20 darbo dienų atostogas dirbant penkias dienas per savaitę arba 24 darbo dienas dirbant šešias; kai kurioms grupėms įstatymas suteikia ilgesnes atostogas. DK 128 straipsnyje numatyta, kad bent viena kasmetinių atostogų dalis paprastai turi būti bent 10 darbo dienų (penkiadienis grafikas) arba 12 darbo dienų (šešiadienis grafikas); kitokiam darbo dienų skaičiui taikoma dviejų savaičių taisyklė. Rezultatų kortelės parodo matematinius variantus ir savaime šių sąlygų ar darbdavio patvirtinimo negarantuoja.</p>
     <p>Įrankis neapskaičiuoja asmeninio sukaupto likučio, pailgintos ar papildomos atostogų trukmės, atostoginių, suminės apskaitos ar pamainų. Darbo grafikas, darbo santykių aplinkybės ir kitos normos gali pakeisti individualų rezultatą. Oficialūs šaltiniai: <a href="https://www.e-tar.lt/rs/actualedition/f6d686707e7011e6b969d7ae07280e89/jlrUauipfr/" rel="noopener">Darbo kodekso 126 straipsnis</a>, <a href="https://www.e-tar.lt/rs/actualedition/f6d686707e7011e6b969d7ae07280e89/jlrUauipfr/" rel="noopener">128 straipsnis</a> ir <a href="https://vdi.lrv.lt/lt/darbo-teise/darbdaviams/kasmetines-minimaliosios-mokamos-atostogos/" rel="noopener">VDI paaiškinimas</a>.</p>
     <p>Darbdavys turi patvirtinti atostogų laiką. Skaičiuoklė pateikia bendro pobūdžio planavimo informaciją, o ne individualią teisinę konsultaciją.</p>
    </details>
   </section>
   <form id="leave-planner" class="panel leave-form" novalidate>
    <fieldset class="leave-fieldset"><legend>1. Pasirinkite planą</legend>
     <div class="leave-input-grid">
      <label>Planavimo metai<select name="year">#{HOLIDAY_YEARS.map { |year| %(<option value="#{year}">#{year}</option>) }.join}</select></label>
      <label>Turimas atostogų dienų likutis<input name="budget" type="number" min="0" max="60" step="1" value="20" inputmode="numeric"><small>Įrašykite savo likutį; 20 ar 24 dienos yra tik dažnos minimalios normos, ne jūsų asmeninis likutis.</small></label>
      <label>Darbo savaitė<select name="schedule"><option value="5">5 dienos · pirmadienis–penktadienis</option><option value="6">6 dienos · pirmadienis–šeštadienis</option><option value="custom">Pasirinkti savaitės dienas</option></select></label>
      <label>Pageidaujamas metų laikas<select name="season"><option value="all">Visi mėnesiai</option><option value="spring">Pavasaris · kovas–gegužė</option><option value="summer">Vasara · birželis–rugpjūtis</option><option value="autumn">Ruduo · rugsėjis–lapkritis</option><option value="winter">Žiema · gruodis–vasaris</option></select></label>
      <label>Mažiausias poilsio laikotarpis (kalendorinėmis dienomis)<input name="minDays" type="number" min="1" max="60" step="1" value="3"></label>
      <label>Didžiausias poilsio laikotarpis (kalendorinėmis dienomis)<input name="maxDays" type="number" min="1" max="60" step="1" value="21"></label>
      <label>Kelių atskirų laikotarpių planas<select name="maxPeriods"><option value="2">Iki 2 laikotarpių</option><option value="3">Iki 3 laikotarpių</option><option value="4" selected>Iki 4 laikotarpių</option><option value="6">Iki 6 laikotarpių</option><option value="8">Iki 8 laikotarpių</option><option value="10">Iki 10 laikotarpių</option></select></label>
     </div>
     <fieldset id="custom-weekdays" class="weekday-picker" hidden><legend>Jūsų įprastos darbo dienos</legend>
      #{DATA['weekdays'].each_with_index.map { |day,index|"<label><input type=\"checkbox\" name=\"custom-weekday\" value=\"#{index}\" #{index<5 ? 'checked' : ''}>#{day}</label>" }.join}
     </fieldset>
    </fieldset>
    <details class="leave-advanced"><summary>Iš anksto suplanuotos dienos ir individualūs apribojimai</summary>
     <div class="leave-input-grid">
      <label>Jau suplanuotos atostogų darbo datos<small>Biudžetą sunaudoja ir pasiūlymai prie jų nebus prijungti. ISO datos; atskirkite kableliu, kabliataškiu arba nauja eilute.</small><textarea name="booked" rows="2" placeholder="2027-06-14, 2027-12-20"></textarea></label>
      <label>Grafiko papildomos poilsio datos<small>Pasirinktiniai poilsio laikai, kurie nesunaudoja čia įvesto atostogų dienų likučio.</small><textarea name="customRest" rows="2" placeholder="2027-02-15"></textarea></label>
      <label>Atostogų prašymui netinkamos darbo datos<small>Šios darbo dienos nutraukia vientisą siūlomą laikotarpį.</small><textarea name="blackouts" rows="2" placeholder="2027-09-10"></textarea></label>
     </div>
    </details>
    <div class="leave-actions"><button class="primary" type="submit">Apskaičiuoti ir palyginti planus</button><button type="button" id="reset-leave">Atkurti pradinius nustatymus</button><button type="button" id="leave-print">Spausdinti rezultatą</button></div>
   </form>
   <p id="leave-error" class="leave-error" role="alert"></p>
   <section id="leave-summary" class="leave-summary" aria-live="polite" aria-atomic="true"></section>
   <section id="leave-results" class="leave-results" aria-label="Atostogų planų variantai"></section>
   <section id="leave-detail" aria-live="polite"></section>
   <section class="panel leave-evaluation"><h2>Įvertinti savo pasirinktą laikotarpį</h2><p>Galima rinktis datas ir 2026–2031 metų intervale, taip pat per metų sandūrą. Skaičiuojamos abiejų metų šventės; intervalas negali viršyti 90 dienų.</p><div class="leave-input-grid"><label>Pradžia<input type="date" name="evalStart" form="leave-planner"></label><label>Pabaiga<input type="date" name="evalEnd" form="leave-planner"></label></div><div id="custom-evaluation" aria-live="polite"></div><button type="button" id="evaluate-period">Įvertinti šį laikotarpį</button></section>
   <section class="panel leave-faq" aria-labelledby="leave-faq-title"><h2 id="leave-faq-title">Atostogų planavimas Lietuvoje: dažni klausimai</h2>
    <h3>Kiek kasmetinių atostogų dienų skaičiuoti?</h3><p>Daugumai darbuotojų, įprastai dirbančių penkias dienas per savaitę, nustatytas minimumas yra 20 darbo dienų; dirbant šešias dienas – 24. Tam tikroms darbuotojų grupėms priklauso ilgesnės atostogos. Trumpesnei ar kitokiai darbo savaitei taikoma savaitėmis išreikšta taisyklė. Įrašykite savo tikrąjį likutį, nes individualios teisės priklauso nuo aplinkybių. Plačiau: <a href="/darbo-dienos/2027/">2027 m. darbo dienų kalendorius</a>.</p>
    <h3>Ar šventinė diena sumažina atostogų likutį?</h3><p>Pagal Darbo kodekso 126 straipsnį į kasmetinių atostogų trukmę neįskaitomos įstatyme nurodytos švenčių dienos. Skaičiuoklė jas rodo atskirai ir neįtraukia į reikalingų atostogų darbo dienų skaičių; savaitgalio šventės į pirmadienį neperkeliamos. Peržiūrėkite <a href="/sventes/2027/">2027 m. Lietuvos švenčių sąrašą</a>.</p>
    <h3>Kada geriausia atostogauti 2027–2030 metais?</h3><p>Pasirinkite darbo savaitę, atostogų likutį ir jums tinkamus mėnesius. Palyginimas parodo ilgiausią vientisą pertrauką, poilsio dienų ir atostogų dienų santykį bei kelis tarpusavyje atskirtus laikotarpius. Rezultate atverkite „Dienų eiga“, kad patikrintumėte kiekvieną datą.</p>
    <h3>Ar mano įvesti duomenys siunčiami į serverį?</h3><p>Ne. Įvestos datos ir planavimo parinktys išsaugomos tik šiame įrenginyje esančioje naršyklėje. Statinis Lietuvos švenčių kalendorius įkeliamas skaičiavimui; įvestas asmeninis planas svetainėje neįrašomas ir bendrinimo nuoroda nekuriama. <a href="/privatumas/">Privatumo paaiškinimas</a>.</p>
   </section>
   <section class="panel leave-source-note"><h2>Metodika ir ribos</h2><p>Optimizatorius generuoja galimus nepertraukiamus intervalus iki pasirinktos maksimalios trukmės. Vieno laikotarpio reitinge pirmiausia vertinamas bendras laisvų kalendorinių dienų skaičius; efektyvumo reitinge lyginamas laisvų dienų ir papildomų atostogų darbo dienų santykis. Kelių laikotarpių parinkimas dinaminiu programavimu didina bendrą intervalų dienų skaičių pagal jūsų turimą atostogų dienų skaičių; lygiųjų atveju renkamasi mažiau atostogų dienų, tada mažiau atskirų intervalų, paskui ankstesnės datos. Tarp dviejų atskirų pasiūlymų paliekama bent viena pagal grafiką dirbama diena.</p><p>Šventinė diena į atostogų dienų skaičių neįtraukiama, o savaitgalio šventė automatiškai neperkeliama. Jau suplanuotos datos atimamos iš nurodyto dienų likučio ir sąmoningai laikomos atskirai; darbo dienų apribojimai išjungia per juos einantį kandidatą. Įvesti nustatymai saugomi tik šioje naršyklėje; į serverį, nuorodas ar analitiką nesiunčiami. Dalijimosi nuorodos nekuriamos.</p><p>Algoritmo aprėptis: skaičiuojant daugiausia 60 dienų trukmės intervalus, intervalų sudarymas yra O(N·L), o kelių pertraukų paieška – O(N·B·K·L), kur N – metų dienų skaičius, L – maksimali atkarpa, B – likęs atostogų dienų skaičius, K – pasirinktų laikotarpių riba. Rezultatas apskaičiuojamas deterministiškai.</p></section>
  HTML
  page('atostogu-planavimas','Atostogų planavimas 2027–2030 – dienų skaičiuoklė','Planuokite atostogas Lietuvoje pagal darbo savaitę, šventes ir dienų likutį. Palyginkite poilsio bei atostogų dienas ir kelis laikotarpius.',html,true,nil,true)
 end
end
require_relative '../lib/print_layout'
require_relative '../lib/page_designs'
require_relative '../lib/visual_design'
Pages.run
require_relative '../lib/discovery_pages'
DiscoveryPages.run
Pages.generate_blank
require_relative '../lib/phase_5_6_8_pages'
Phase568Pages.run
require_relative '../lib/zodiac_pages'
ZodiacPages.run
require_relative '../lib/horoscopes_pages'
HoroscopesPages.run
system('python3',File.join(Pages::ROOT,'scripts/lunar/pages.py'),exception:true)
system('python3',File.join(Pages::ROOT,'scripts/monthly_holidays/pages.py'),exception:true)
system('python3',File.join(Pages::ROOT,'scripts/holiday_phase2/pages.py'),exception:true)
system(ENV.fetch('K365_NODE','node'),File.join(Pages::ROOT,'scripts/seasons/prepare.mjs'),exception:true)
system('python3',File.join(Pages::ROOT,'scripts/seasons/pages.py'),exception:true)
require_relative '../lib/namedays_pages'
NamedaysPages.run
search_page=<<~HTML
 <section class="search-page" aria-labelledby="search-page-title">
  <header class="search-page__heading dark-surface">
   <div>
    <h1 id="search-page-title" data-dark-accent>Raskite datą, vietovę ar įrankį</h1>
    <p>Vienoje vietoje ieškokite Lietuvos vietovių orų, nedarbo dienų, kalendorių, horoskopų ir planavimo įrankių.</p>
   </div>
   {% include shell-art.html name="search-glass" size=136 %}
  </header>
  <div class="search-page__hero">
   <noscript>
    <style>#site-search-page-form,.search-page__quick,.search-page__results{display:none}</style>
    <section class="panel" aria-labelledby="search-no-js-title">
     <h2 id="search-no-js-title">Pasirinkite svetainės skiltį</h2>
     <p>Interaktyviai paieškai reikia įjungto JavaScript. Visą svetainės turinį galite pasiekti šiomis nuorodomis.</p>
     <nav id="search-no-js-nav" aria-label="Svetainės skiltys"><ul>
      <li><a href="/2027/">2027 m. kalendorius</a> · <a href="/2028/">2028 m. kalendorius</a> · <a href="/2029/">2029 m. kalendorius</a> · <a href="/2030/">2030 m. kalendorius</a></li>
      <li><a href="/sventes/">Lietuvos šventės ir atmintinos dienos</a></li>
      <li><a href="/nedarbo-dienos/2027/">Nedarbo Dienos 2027–2030</a> · <a href="/orai/">Lietuvos vietovių orai</a></li>
      <li><a href="/vardadieniai/">Vardadieniai pagal datą</a></li>
      <li><a href="/horoskopai/">Horoskopai</a> · <a href="/zodiakas/">Zodiako ženklai</a></li>
      <li><a href="/saule/">Saulėtekis ir saulėlydis</a> · <a href="/menulio-kalendorius/">Mėnulio kalendorius</a> · <a href="/metu-laikai/">Metų laikai</a></li>
      <li><a href="/tuscias-kalendorius/">Spausdinami kalendoriai</a> · <a href="/irankiai/">Įrankiai ir planuokliai</a></li>
     </ul></nav>
    </section>
   </noscript>
   <form id="site-search-page-form" class="search-page__form panel" role="search" action="/paieska/" method="get">
    <label for="site-search-page-query">Ko ieškote?</label>
    <div class="search-page__controls">
     <input id="site-search-page-query" name="q" type="search" placeholder="Pvz., orai Kaune, nedarbo dienos…" autocomplete="off">
     <label class="search-page__category">Skiltis<select id="site-search-category" name="skiltis"><option value="all">Visa svetainė</option><option value="weather">Orai</option><option value="calendar">Kalendoriai</option><option value="holiday">Šventės</option><option value="planning">Planavimas ir darbo laikas</option><option value="school">Mokykla</option><option value="astronomy">Astronomija</option><option value="horoscope">Horoskopai</option><option value="tools">Įrankiai</option><option value="privacy">Svetainės informacija</option><option value="home">Pagrindinis puslapis</option></select></label>
     <button class="primary" type="submit">Ieškoti</button>
     <button id="site-search-clear" type="button">Išvalyti</button>
    </div>
   </form>
   <nav class="search-page__quick" aria-label="Populiarios paieškos temos">
    <span>Greita paieška:</span>
    <button type="button" data-search-query="Nedarbo Dienos">Nedarbo Dienos</button>
    <button type="button" data-search-query="Orai Vilniuje">Orai Vilniuje</button>
    <button type="button" data-search-query="Lietuvos šventės">Lietuvos šventės</button>
    <button type="button" data-search-query="2029 gegužė">2029 m. gegužė</button>
    <button type="button" data-search-query="atostogų planavimas">Atostogų planavimas</button>
    <button type="button" data-search-query="saulėtekis">Saulėtekis</button>
    <button type="button" data-search-query="Mėnulio fazės">Mėnulio fazės</button>
    <button type="button" data-search-query="horoskopai">Horoskopai</button>
   </nav>
  </div>
  <section class="search-page__results panel" aria-labelledby="site-search-page-heading">
   <div class="search-page__results-head"><div><span class="eyebrow">Svetainės katalogas</span><h2 id="site-search-page-heading">Visi svetainės puslapiai</h2></div><p id="site-search-page-status" role="status" aria-live="polite" aria-atomic="true">Įveskite paieškos žodį arba naršykite puslapius pagal skiltį.</p></div>
   <ul id="site-search-page-results" class="search-page__list" tabindex="-1"></ul>
   <nav id="site-search-pagination" class="search-page__pagination" aria-label="Paieškos rezultatų puslapiai"></nav>
  </section>
  <p class="search-page__tip">Paieška atpažįsta lietuviškas raides, dažnas žodžių galūnes ir panašiai parašytus žodžius. Asmeniniai kalendoriaus įrašai saugomi tik jūsų naršyklėje ir į bendrą paiešką neįtraukiami.</p>
 </section>
HTML
Pages.page('paieska','Paieška – orai, kalendoriai ir nedarbo dienos','Raskite Lietuvos miestų, miestelių ir kaimų orus, 2027–2030 m. nedarbo dienas, kalendorius, horoskopus ir planavimo įrankius.',search_page)
search_aliases={
 '/vardadieniai/'=>'vardadienis varduvės vardai vardas šiandien rytoj vardų kalendorius name day nameday isim günü',
 '/zodiakas/'=>'zodiako ženklas pagal gimimo dieną stichijos ženklų palyginimas burc hesapla zodiac sign finder aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces',
 '/'=>'šiandien asmeninis kalendorius įvykiai užrašai pastabos užduotys laikas laikrodis orai paieška dienos planai weather calendar events takvim',
 '/paieska/'=>'paieška paieska rasti puslapis puslapiai rezultatai search find all pages',
 '/sventes/'=>'valstybinės nedarbo šventinės atmintinos dienos holiday holidays bayram resmi tatil',
 '/atostogu-planavimas/'=>'ilgieji savaitgaliai poilsio dienos atostogos dienų skaičiuoklė vacation leave tatil',
 '/horoskopai/'=>'zodiakas zodiako ženklai astrologija ascendentas kylantis ženklas horoscope zodiac rising sign burc burcu burclar',
 '/horoskopai/avinas/'=>'aries ram koç koc koç burcu',
 '/horoskopai/jautis/'=>'taurus boğa boga boğa burcu',
 '/horoskopai/dvyniai/'=>'gemini ikizler ikizler burcu',
 '/horoskopai/vezys/'=>'cancer yengeç yengec yengeç burcu',
 '/horoskopai/liutas/'=>'leo aslan aslan burcu',
 '/horoskopai/mergele/'=>'virgo başak basak başak burcu',
 '/horoskopai/svarstykles/'=>'libra terazi terazi burcu',
 '/horoskopai/skorpionas/'=>'scorpio akrep akrep burcu',
 '/horoskopai/saulys/'=>'sagittarius yay yay burcu',
 '/horoskopai/oziaragis/'=>'capricorn oğlak oglak oğlak burcu',
 '/horoskopai/vandenis/'=>'aquarius kova kova burcu',
 '/horoskopai/zuvys/'=>'pisces balık balik balık burcu',
 '/metu-laikai/'=>'metų laikai astronominiai meteorologiniai seasons equinox solstice mevsimler',
 '/pavasario-lygiadienis/'=>'pavasario lygiadienis spring equinox ilkbahar ekinoks',
 '/vasaros-saulegriza/'=>'vasaros saulėgrįža ilgiausia diena summer solstice yaz gündönümü',
 '/rudens-lygiadienis/'=>'rudens lygiadienis autumn equinox sonbahar ekinoks',
 '/ziemos-saulegriza/'=>'žiemos saulėgrįža trumpiausia diena winter solstice kış gündönümü',
 '/saule/'=>'saulėtekis saulėlydis saulės laikai dienos šviesa sunrise sunset solar daylight',
 '/menulio-fazes/'=>'jaunatis pilnatis mėnulio kalendorius ketvirčiai moon phases lunar',
 '/irankiai/'=>'skaičiuoklės planuokliai tvarkaraščiai šablonai įrankiai calculator planner tools',
 '/tuscias-kalendorius/'=>'atsisiųsti spausdinti pdf webp kalendoriaus šablonas download print',
 '/nedarbo-dienos/'=>'laisvos dienos nedarbo dienos poilsio dienos ilgieji savaitgaliai šventinės dienos',
 '/darbo-dienos/'=>'darbo valandos darbo dienos sutrumpinta darbo diena workdays working hours',
 '/mokiniu-atostogos/'=>'mokyklos atostogų datos žiemos pavasario vasaros rudens school holidays',
 '/privatumas/'=>'duomenų saugojimas slapukai naršyklė vietiniai įrašai privacy data'
}
search_plain_text = lambda do |html|
 text=html.to_s.gsub(/<!--.*?-->/m,' ')
 text=text.gsub(%r{<(script|style|svg|noscript|template)\b[^>]*>.*?</\1\s*>}im,' ')
 text=text.gsub(/\{%.*?%\}|\{\{.*?\}\}/m,' ')
 CGI.unescapeHTML(text.gsub(/<[^>]*>/,' ').gsub(/\s+/,' ')).strip
end
search_category = lambda do |url|
 case url
 when '/' then 'home'
 when %r{\A/(?:20\d{2})(?:/|\z)} then 'calendar'
 when %r{\A/orai/} then 'weather'
 when %r{\A/(?:sventes|nedarbo-dienos)/} then 'holiday'
 when %r{\A/(?:horoskopai|zodiakas)/} then 'horoscope'
 when %r{\A/(?:saule|menulio-fazes|menulio-kalendorius|astronominis-kalendorius|metu-laikai|pavasario-lygiadienis|vasaros-saulegriza|rudens-lygiadienis|ziemos-saulegriza)/} then 'astronomy'
 when %r{\A/(?:mokiniu-atostogos|pamoku-tvarkarastis|pamoku-tvarkarascio-sablonai)/} then 'school'
 when %r{\A/(?:darbo-dienos|atostogu-planavimas|pamainu-grafikas|savaites|savaitiniai-planuokliai|dienos-planuoklis|seimos-kalendorius)/} then 'planning'
 when %r{\A/privatumas/} then 'privacy'
 else 'tools'
 end
end
date_guides = Pages::LITHUANIAN_DATES.transform_values do |entries|
  entries.to_h { |entry| [entry.fetch('slug'), entry] }
end
civic_guides = nil
horoscope_signs = ZodiacPages.catalog.to_h { |sign| [sign.fetch('url'), sign] }
solar_cities = SunrisePage.cities.to_h { |city| ["/saule/#{city.fetch('id')}/", city] }
search=Dir.glob("#{Pages::ROOT}/site/**/index.html").filter_map do |path|
raw=File.read(path); fm=raw[/\A---\s*\n(.*?)\n---\s*\n/m,1]; next unless fm
require 'yaml'; front=YAML.safe_load(fm); next unless front && front['title']
# Generated share destinations and immutable horoscope snapshots are useful
# landing pages, but should not outrank canonical calendar/tool pages in site search.
next if front['share_archive'] || front['robots'].to_s.split(/[^a-z]+/i).include?('noindex')
 url='/'+path.delete_prefix("#{Pages::ROOT}/site/").delete_suffix('index.html')
 url='/' if url.empty?
 path_terms=url.delete_prefix('/').delete_suffix('/').tr('/-','  ')
 aliases=search_aliases.select { |prefix,_|url==prefix || (prefix!='/' && url.start_with?(prefix)) }.values.join(' ')
 calendar_month_aliases={
  'sausis'=>'january januar ocak', 'vasaris'=>'february februar subat şubat', 'kovas'=>'march mart',
  'balandis'=>'april nisan', 'geguze'=>'may mayis mayıs', 'birzelis'=>'june juni haziran',
  'liepa'=>'july temmuz', 'rugpjutis'=>'august agustos ağustos', 'rugsejis'=>'september eylul eylül',
  'spalis'=>'october oktober ekim', 'lapkritis'=>'november november kasim kasım',
  'gruodis'=>'december dezember aralik aralık'
 }
 aliases+=' '+calendar_month_aliases.fetch(url.split('/').reject(&:empty?).last,'') if url.match?(%r{\A/(?:(?:menulio-kalendorius|sventes)/)?20\d{2}/})
 aliases+=' metinis kalendorius metų spausdinamas mėnesio pdf webp' if url.match?(%r{^/20\d\d/})
 body=raw.sub(/\A---\s*\n.*?\n---\s*\n/m,'')
 body=body.gsub(%r{<template\b[^>]*>.*?</template\s*>}im,' ')
 solar_city = solar_cities[url]
 body = body.gsub(%r{<select\b[^>]*>.*?</select>}im, '') if solar_city
 headings=body.scan(%r{<h[1-4]\b[^>]*>(.*?)</h[1-4]>}im).flatten.map { |chunk|search_plain_text.call(chunk) }.reject(&:empty?).uniq.join(' ')
 headings=front.fetch('title').to_s if headings.empty?
 if front['local_date_type']
  entry = date_guides.fetch(front.fetch('local_date_type')).fetch(front.fetch('local_date_slug'))
  headings = entry.fetch('title')
  body = entry.values_at('title', 'city', 'location', 'date', 'summary', 'context', 'visit').compact.join(' ')
 elsif front['civic']
  civic_guides ||= JSON.parse(File.read("#{Pages::ROOT}/site/_data/civic.json")).fetch('pages')
  entry = civic_guides.fetch(front.fetch('civic'))
  sections = entry.fetch('sections')
  headings = [entry.fetch('title'), *sections.map(&:first)].join(' ')
  body = [entry.fetch('intro'), *entry.fetch('facts').flatten, *entry.fetch('steps').flatten, *sections.flatten].join(' ')
 end
 # Search only needs each page's searchable vocabulary, not repeated copies of
 # its full prose. The client turns this field into a Set of words for ranking,
 # so keep each normalized term once and avoid downloading redundant text.
 content=search_plain_text.call(body).downcase.unicode_normalize(:nfd)
  .gsub(/\p{Mn}/,'').tr('ł','l').gsub('&',' ir ').gsub(/[’'`]/,'')
  .scan(/[\p{L}\p{N}]+/).uniq.join(' ')
 item = {'title'=>front['title'].to_s,'url'=>url,'description'=>front['description'].to_s,
  'keywords'=>[path_terms,aliases].join(' ').strip,'headings'=>headings,'content'=>content,
  'category'=>search_category.call(url)}
 item['solarCity'] = solar_city.values_at('name', 'locative') if solar_city
 item['horoscopeSign'] = horoscope_signs[url].values_at('name', 'genitive') if horoscope_signs.key?(url)
 item
end
# Keep genuine name/date entities on their canonical hub record rather than
# creating duplicate pages or thousands of thin name landing routes.
nameday_hub=search.find { |item|item['url']=='/vardadieniai/' }
if nameday_hub
 names={}
 JSON.parse(File.read("#{Pages::ROOT}/data/namedays/cc-by-sa-4.0/snapshot.json")).fetch('records').each do |record|
  record.fetch('names').each { |name|(names[name]||=[]) << record.fetch('date') }
 end
 nameday_hub['namedays']=names.transform_values { |dates|dates.uniq.sort }
end
search.concat([
 {'title'=>'Pridėti įvykį į kalendorių','url'=>'/#add-event','description'=>'Atverkite pasirinktos dienos įvykio kūrimo mygtuką.','keywords'=>'naujas susitikimas gimtadienis priminimas renginys planas new event birthday reminder','category'=>'home','action'=>true},
 {'title'=>'Dienos užrašai','url'=>'/#daily-note','description'=>'Pereikite į šios dienos užrašų lauką. Įrašai saugomi tik naršyklėje.','keywords'=>'pastabos užrašyti išsaugoti note dienos planai notes','category'=>'home','action'=>true},
 {'title'=>'Užduočių sąrašas','url'=>'/#task-title','description'=>'Pereikite į šios dienos užduoties įvedimo lauką.','keywords'=>'užduotis darbai sąrašas atlikti checklist task tasks','category'=>'home','action'=>true},
 {'title'=>'Kalendoriaus dienų ir įvykių paieška','url'=>'/#search','description'=>'Ieškokite datos arba įvykio asmeniniame kalendoriuje.','keywords'=>'filtruoti kalendorius konkreti data įvykis search filter date','category'=>'home','action'=>true},
 {'title'=>'Pasirinkti orų miestą','url'=>'/#weather-city','description'=>'Pasirinkite miestą, kurio orus norite matyti.','keywords'=>'oras orai temperatūra miestas vilnius kaunas klaipėda weather city temperature','category'=>'home','action'=>true},
 {'title'=>'Kalendoriaus sluoksniai ir kategorijos','url'=>'/#layers','description'=>'Rodykite arba slėpkite šventes, asmeninius ir darbinius įvykius.','keywords'=>'filtrai sluoksniai darbo šeima sveikata mokslai categories filters','category'=>'home','action'=>true},
 {'title'=>'Kalendoriaus atsarginė kopija','url'=>'/#backup','description'=>'Atsisiųskite arba atkurkite savo kalendoriaus duomenų kopiją.','keywords'=>'eksportuoti importuoti atsarginė kopija json duomenys backup export import','category'=>'home','action'=>true},
])
# Keep the generated index stable across filesystems and Ruby runtimes so the
# source and published copies remain byte-for-byte identical.
search.sort_by! { |item|[item['category'],item['url']] }
File.write("#{Pages::ROOT}/site/assets/data/search.json",JSON.generate(search))
# A crawlable, keyboard-accessible catalogue remains available while the search
# module is loading and when JavaScript is disabled. It links canonical URLs,
# never query-string or tracking variants.
catalogue=search.reject { |item|item['action'] || item['url']=='/paieska/' }.sort_by { |item|[item['category'],item['url']] }.group_by { |item|item['category'] }
catalogue_labels={'calendar'=>'Kalendoriai','holiday'=>'Šventės','planning'=>'Planavimas ir darbo laikas','school'=>'Mokykla','astronomy'=>'Astronomija','horoscope'=>'Horoskopai','weather'=>'Orai','tools'=>'Įrankiai','privacy'=>'Svetainės informacija','home'=>'Pradžia'}
catalogue_html='<section class="panel search-catalogue" aria-labelledby="search-catalogue-title"><h2 id="search-catalogue-title">Puslapiai pagal skiltį</h2><p>Visą sąrašą galite naršyti ir be paieškos.</p>'+catalogue.map do |category,items|
 '<details><summary>'+Pages.esc(catalogue_labels.fetch(category,category))+'</summary><ul>'+items.map { |item|'<li><a href="'+Pages.esc(item['url'])+'">'+Pages.esc(item['title'])+'</a></li>' }.join+'</ul></details>'
end.join+'</section>'
search_source=File.join(Pages::ROOT,'site/paieska/index.html')
File.write(search_source,File.read(search_source)+catalogue_html)
