# frozen_string_literal: true
require_relative '../lib/calendar'
require 'fileutils'
require 'cgi'
require 'rexml/document'
module Pages
 extend self
 ROOT=File.expand_path('..',__dir__)
 DATA=Kalendorius::DATA
 WEEKDAY_NAMES=%w[pirmadienis antradienis trečiadienis ketvirtadienis penktadienis šeštadienis sekmadienis].freeze
 MANIFEST=JSON.parse(File.read("#{ROOT}/site/assets/data/manifest.json"))['assets']
 EDITORIAL=JSON.parse(File.read("#{ROOT}/data/holiday-editorial.json"))
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
  FileUtils.mkdir_p(File.dirname(target))
  html=print_html(path,visual_html(path,html))
  metadata={'title'=>title,'description'=>desc,'tool'=>tool}
  paper=html[/data-print-root="art" data-print-paper="(portrait|landscape)"/,1]
  metadata['print_paper']="A4 #{paper}" if paper
  metadata['robots']=robots if robots
  metadata['planner']=true if planner
  metadata['phase_module']=phase_module if phase_module
  metadata['holiday_editorial']=true if path=='sventes' || path.start_with?('sventes/')
  File.write(target,"---\n#{metadata.map { |k,v| "#{k}: #{v.to_json}" }.join("\n")}\n---\n#{html}")
 end
 def title(y,m);"#{y} m. #{DATA['months'][m-1][2]} kalendorius";end
 def month_url(y,m);"/#{y}/#{DATA['months'][m-1][0]}/";end
 def source
  "<div class=\"source-note\">Teisės aktų duomenys sutikrinti 2026-10-16. 2026 m. iki spalio 31 d. taikytas tuo metu galiojęs DK 123 str.; 2027–2029 m. datos sutikrintos su nuo 2027-01-01 numatyta galioti suvestine redakcija. <a href=\"#{esc(EDITORIAL['sources']['labour-code-2027']['url'])}\" rel=\"noopener\">Darbo kodekso 123 straipsnis nuo 2027-01-01</a>. Savaitgalį pasitaikanti šventė automatiškai neperkeliama į pirmadienį. Atmintinos dienos pateikiamos atskirai ir savaime nesuteikia nedarbo dienos statuso.</div>"
 end
 def static_month(y,m)
  month=Kalendorius.month(y,m);html='<table class="static-month"><caption class="visually-hidden">'+title(y,m)+'</caption><thead><tr><th scope="col">Sav.</th>'+DATA['weekdays'].map { |d|"<th scope=\"col\">#{d}</th>" }.join+'</tr></thead><tbody>'
  month['grid'].each_slice(7).take(month['weeks']).each do |week|
   html+="<tr><th scope=\"row\">#{week.first['isoWeek']}</th>"
   week.each do |d|
    hs=d['inMonth'] ? month['days'][d['day']-1]['holidays'] : []
    cs=d['inMonth'] ? EDITORIAL['commemorations'].select { |a|a['month']==m && a['day']==d['day'] } : []
    if d['inMonth']
     holiday_links=hs.filter_map { |h|url=holiday_page_url(h['id']);url && [h['name'],url] }
     commemoration_links=cs.map { |a|[a['title'],"/sventes/#{a['slug']}/"] }
     labels=(holiday_links+commemoration_links).map(&:first)
     date_target=holiday_links.first||commemoration_links.first
     spoken_label=([d['date']]+labels).join(': ')
     date=date_target ? "<a class=\"calendar-holiday-date\" href=\"#{date_target[1]}\" aria-label=\"#{esc(spoken_label)}\" title=\"#{esc(labels.join(' · '))}\"><time datetime=\"#{d['date']}\">#{d['day']}</time><span class=\"calendar-day-marker\" aria-hidden=\"true\"></span></a>" : "<time datetime=\"#{d['date']}\">#{d['day']}</time>"
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
 def holiday_table(y,month=nil)
  hs=Kalendorius.holidays(y);hs=hs.select { |h|Date.iso8601(h['date']).month==month } if month
  return '<p>Šį mėnesį įstatyme nustatytų šventinių dienų nėra.</p>' if hs.empty?
  '<div class="table-scroll"><table class="data-table"><thead><tr><th scope="col">Data</th><th scope="col">Diena</th><th scope="col">Šventė</th><th scope="col">Statusas</th></tr></thead><tbody>'+hs.map { |h|d=Date.iso8601(h['date']);url=holiday_page_url(h['id']);name=esc(h['legalName']||h['name']);"<tr><td><a href=\"#{month_url(y,d.month)}\"><time datetime=\"#{h['date']}\">#{h['date']}</time></a></td><td>#{WEEKDAY_NAMES[d.cwday-1]}</td><td>#{url ? "<a href=\"#{url}\">#{name}</a>" : name}</td><td>Šventinė diena · DK 123 str.</td></tr>" }.join+'</tbody></table></div>'
 end
 def commemoration_table(y,month=nil)
  records=EDITORIAL['commemorations'];records=records.select { |a|a['month']==month } if month
  return '' if records.empty?
  '<h2>Atmintinos dienos</h2><div class="table-scroll"><table class="data-table"><thead><tr><th scope="col">Data</th><th scope="col">Diena</th><th scope="col">Atmintina diena</th><th scope="col">Teisinė reikšmė</th></tr></thead><tbody>'+records.map do |a|
   d=Date.new(y,a['month'],a['day'],Date::GREGORIAN);"<tr><td><a href=\"#{month_url(y,d.month)}\"><time datetime=\"#{d.iso8601}\">#{d.iso8601}</time></a></td><td>#{WEEKDAY_NAMES[d.cwday-1]}</td><td><a href=\"/sventes/#{a['slug']}/\">#{esc(a['title'])}</a></td><td>Atmintinos dienos statusas pats savaime nesuteikia nedarbo dienos; data gali sutapti su DK 123 str. švente</td></tr>"
  end.join+'</tbody></table></div>'
 end
 def occurrence_dates(article,year)
  ids=Array(article['holiday_ids'])
  return [Date.new(year,article['month'],article['day'],Date::GREGORIAN)] if ids.empty?
  ids.filter_map { |id|h=Kalendorius.holidays(year).find { |item|item['id']==id };Date.iso8601(h['date']) if h }
 end
 def next_occurrence(article)
  previous=ENV['TZ'];ENV['TZ']='Europe/Vilnius';today=Date.today;ENV['TZ']=previous
  (today.year..today.year+10).flat_map { |y|occurrence_dates(article,y) }.sort.find { |d|d>=today }
 end
 def generate_holiday_hub
  articles=editorial_articles
  cards=articles.map do |a|
   date=next_occurrence(a)
   "<article class=\"holiday-card\" data-holiday-id=\"#{esc(a['id'])}\"><span class=\"holiday-card__category\">#{esc(a['category'])}</span><h2><a href=\"/sventes/#{a['slug']}/\">#{esc(a['title'])}</a></h2><p>#{esc(a['summary'])}</p><p class=\"holiday-card__date\">Kita data: <time data-next-occurrence datetime=\"#{date.iso8601}\">#{date.iso8601}</time></p><a class=\"text-link\" href=\"/sventes/#{a['slug']}/\">Skaityti apie dieną <span aria-hidden=\"true\">→</span></a></article>"
  end.join
  introhtml=intro('Lietuvos šventės ir atmintinos dienos','Švenčių datos, savaitės dienos, teisinis statusas ir kultūros bei istorijos šaltiniai. Atskirai pažymėtos šventinės ir atmintinos dienos.',yearlinks('sventes/'))
  legal="<section class=\"panel holiday-legal-summary\"><h2>Kaip skaityti statusą</h2><p><strong>Šventinė diena</strong> reiškia, kad pagal Darbo kodekso 123 straipsnį paprastai nedirbama; kodekse numatytos išimtys. <strong>Atmintina diena</strong> įrašyta į Atmintinų dienų įstatymą, tačiau šis statusas savaime nesuteikia nedarbo dienos. Darbo grafikas ir taikoma teisės akto redakcija turi reikšmės.</p><p>Teisės aktų duomenys sutikrinti 2026-10-16. 2027–2029 m. švenčių sąrašas sutikrintas su DK 123 straipsnio suvestine redakcija, numatyta nuo 2027-01-01; jos 123 straipsnio sąrašas sutampa su 2026 m. galiojančia redakcija. Šaltiniai: <a href=\"#{esc(EDITORIAL['sources']['labour-code']['url'])}\">DK 123 straipsnis (2026 m. redakcija)</a>, <a href=\"#{esc(EDITORIAL['sources']['labour-code-2027']['url'])}\">DK 123 straipsnis (nuo 2027-01-01)</a> ir <a href=\"#{esc(EDITORIAL['sources']['memoriam-law']['url'])}\">Atmintinų dienų įstatymas</a>.</p></section>"
  years=yearlinks('sventes/')
  page('sventes','Lietuvos šventės ir atmintinos dienos','Lietuvos šventės ir atmintinos dienos: 2027–2029 m. datos, savaitės dienos, nedarbo dienų statusas, tradicijos ir istoriniai šaltiniai.',introhtml+legal+"<section class=\"holiday-hub\"><h2>Švenčių reikšmė ir tradicijos</h2><div class=\"holiday-card-grid\">#{cards}</div></section><section class=\"panel\"><h2>Metų sąrašai</h2><p>Pasirinkite metus ir peržiūrėkite švenčių datas, savaitės dienas bei jų teisinį statusą.</p>#{years}</section><nav class=\"adjacent\" aria-label=\"Susiję įrankiai\"><a href=\"/atostogu-planavimas/\">Atostogų planavimas</a><a href=\"/darbo-dienos/2027/\">Darbo dienų skaičiavimas</a><a href=\"/menesiai/\">Mėnesių kalendoriai</a></nav>")
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
 def yearlinks(path='')
  [2027,2028,2029].map { |y|"<a class=\"button\" href=\"/#{path}#{y}/\">#{y}</a>" }.join
 end
 DESCRIPTIONS={
 '01'=>'Subalansuotas tinklelis, daug ramios baltos erdvės ir aiškūs skaičiai.',
 '02'=>'Ryškus mėnesio numeris, stambūs juodi skaičiai ir atvira rašymo erdvė.',
 '03'=>'Tikslus juodai baltas biuro tinklelis, rašymo linijos ir prioritetų skiltis.',
 '04'=>'Dideli datos skaičiai ir atskiras švenčių sąrašas, lengva skaityti iš toliau.',
 '05'=>'Dienų sąrašas ir keturios atskiros šeimos narių planavimo skiltys.',
 '06'=>'Lietuvos spalvų juosta, įprasta tipografija ir svarbių datų erdvė.',
 '07'=>'Originalūs vektoriniai lapų motyvai ir lengva įprasta tipografija.',
 '08'=>'Mėnesio planas, mokslo tikslai ir atsiskaitymų vieta.',
 '09'=>'Asimetriškas tinklelis, geometrinis akcentas ir atskira užrašų juosta.',
 '10'=>'Tamsi antraštė, stiprus kontrastas ir svarbiausių planų erdvė.'}
 def gallery(items,compact=false)
  '<div class="gallery'+(compact ? ' compact-gallery' : '')+'">'+items.map do |e|
   alt=e['kind']=='monthly' ? "#{title(e['year'],e['month'])}: #{e['name']}, spausdinamas A4 maketas" : "#{e['year']} #{e['name']} – spausdinamas kalendorius"
   filter=e['style'];id=e['design'];dims=e['dimensions'];smallw=e['landscape'] ? 680 : 481;smallh=e['landscape'] ? 481 : 680
   "<article class=\"design-card\" id=\"dizainas-#{e['stem']}\" data-style=\"#{filter}\" data-layout=\"#{e['layout']}\" data-design=\"#{id}\"><a class=\"preview-link\" href=\"#{download_href(e,'webp')}\" target=\"_blank\" rel=\"noopener\" aria-label=\"Peržiūrėti: #{esc(e['name'])}\"><img src=\"#{e['preview']}\" srcset=\"/assets/previews-small/#{File.basename(e['preview'])} 340w, #{e['preview']} 680w\" sizes=\"(max-width: 600px) 45vw, (max-width: 1100px) 25vw, 18vw\" width=\"#{smallw}\" height=\"#{smallh}\" loading=\"lazy\" decoding=\"async\" fetchpriority=\"low\" alt=\"#{esc(alt)}\"></a><div class=\"design-info\"><h2><span class=\"design-number\">#{id}</span>#{esc(e['name'])}</h2><p>#{esc(e['kind']=='monthly' ? DESCRIPTIONS[id] : e['kind']=='annual' ? 'Visi 12 mėnesių viename A4 lape. ISO savaičių numeriai ir šventinių dienų žymėjimas.' : "Nedatuotas planuoklis#{e['rows'] ? ", #{e['rows']} eilutės" : ''}. #{e['category']=='day' ? 'Skirtas vienai dienai.' : e['sunday'] ? 'Pradžia sekmadienį.' : 'Pradžia pirmadienį.'}")}</p><div class=\"design-actions\"><a class=\"button select-design\" href=\"#{download_href(e,'webp')}\" data-stem=\"#{e['stem']}\">Peržiūrėti</a><a class=\"button\" href=\"#{download_href(e,'pdf')}\" download>Atsisiųsti PDF</a><a class=\"button\" href=\"#{download_href(e,'webp')}\" download>Atsisiųsti WebP</a><a class=\"button\" href=\"#{download_href(e,'pdf')}\" target=\"_blank\" rel=\"noopener\">Spausdinti PDF ↗</a></div></div></article>"
  end.join+'</div>'
 end
 def run
  generate_months
  [2027,2028,2029].each { |y|generate_year(y);generate_holidays(y);generate_work(y);generate_weeks(y) }
  generate_holiday_hub
  generate_holiday_articles
  blank=MANIFEST.select { |e|e['kind']=='blank' }
  page('tuscias-kalendorius','Tuščias kalendorius – PDF šablonai','Nedatuoti mėnesio, savaitės, šeimos ir mokyklos kalendoriai. PDF ir WebP, pirmadienio arba sekmadienio pradžia, penkios ar šešios eilutės.',intro('Tuščias kalendorius','Nedatuoti lapai: datas ir planus įrašykite patys. Mėnesio tinkleliams rinkitės 5 arba 6 eilutes; savaitės planuokliams eilučių keisti nereikia.')+'<p class="source-note">PDF atidarykite spausdinimui ir pasirinkite tikrąjį dydį (100 %). Lape jau paliktos saugios paraštės. WebP skirtas aukštos raiškos vaizdui.</p>'+gallery(blank))
  links=[['2027/','2027 metų kalendorius','Visi mėnesiai, šventės ir metiniai failai.'],['2028/','2028 metų kalendorius','Keliamieji metai ir 29 dienų vasaris.'],['2029/','2029 metų kalendorius','Įprastiniai metai: 365 dienos ir 10 metinių kalendoriaus maketų.']]
  cards=->(arr){'<div class="resource-grid">'+arr.map { |url,name,desc|resource_card(url,name,desc) }.join+'</div>'}
  page('metai','Metų kalendoriai','2027, 2028 ir 2029 metų lietuviški kalendoriai: visų mėnesių apžvalga, Lietuvos šventės ir metiniai PDF bei WebP failai.',intro('Metų kalendoriai','Matykite visus metus ir rinkitės lapą spausdinimui.')+cards.call(links))
  monthcards=[2027,2028,2029].map { |y|"<h2>#{y} metai</h2>"+cards.call(DATA['months'].each_with_index.map { |m,i|["#{y}/#{m[0]}/",m[1],"#{Kalendorius.month(y,i+1)['length']} d. · 10 dizainų"] }) }.join
  page('menesiai','Mėnesių kalendoriai – 2027–2029','Pasirinkite 2027, 2028 ar 2029 metų mėnesį. Kiekvienam mėnesiui – dešimt skirtingų A4 kalendorių su Lietuvos šventėmis, PDF ir WebP.',intro('Mėnesių kalendoriai','Pasirinkite mėnesį ir peržiūrėkite dešimt jo kalendoriaus maketų.')+monthcards)
  tools=[['vardadieniai/','Vardadieniai','Šiandienos vardai, paieška, visų mėnesių sąrašai ir įrašai kalendoriui.'],['metai/','Metų kalendoriai','2027–2029 metų kalendorių, mėnesių ir spausdinamų metinių lapų apžvalga.'],['atostogu-planavimas/','Atostogų planuoklis','Palyginkite ilgą pertrauką, dienų santykį ir kelių laikotarpių planus.'],['pamainu-grafikas/','Pamainų grafiko planuoklis','Kartojami ciklai, dieninės ir naktinės pamainos, valandos ir ICS.'],['pamoku-tvarkarastis/','Pamokų tvarkaraštis','Redaguojamas savaitės tvarkaraštis ir vietinis namų darbų sąrašas.'],['datos-skaiciuokle/','Datos skaičiuoklė','Dienų skirtumas, darbo dienos, dienų pridėjimas prie datos ir likęs laikas.'],['kurti-kalendoriu/','Kalendoriaus kūrėjas','Pasirinkite datą, popierių, šventes ir savo įvykius.'],['saule/','Saulėtekis ir saulėlydis','Penki Lietuvos miestai, civilinė prieblanda ir dienos ilgumas.'],['menulio-fazes/','Mėnulio fazės','Jaunatis, ketvirčiai ir pilnatis Lietuvos vietos laiku.'],['menulio-kalendorius/','Mėnulio kalendorius','Kasdieniai Mėnulio vaizdai, mėnesių spaudiniai ir 2027 metų plakatas.'],['astronominis-kalendorius/','Astronominis kalendorius','Lygiadieniai, saulėgrįžos, Saulė ir Mėnulis vienoje vietoje.'],['savaitiniai-planuokliai/','Savaitės planuoklis','Atsisiunčiami nedatuoti PDF ir WebP.'],['dienos-planuoklis/','Dienos planuoklis','Dienos laiko juosta ir prioritetai.'],['seimos-kalendorius/','Šeimos savaitės planas','Kelios planavimo skiltys viename lape.'],['pamoku-tvarkarascio-sablonai/','Pamokų tvarkaraščio šablonai','Spausdinami mokyklos savaitės tinkleliai.'],['darbo-grafiko-sablonai/','Darbo grafiko šablonai','Nedatuoti pamainų grafikai.'],['savaites/2027/','ISO savaitės','Savaičių numeriai ir tikslūs intervalai.'],['mokiniu-atostogos/','Mokinių atostogos','Patikrintos 2026–2027 mokslo metų atostogų datos.'],['darbo-dienos/2027/','Darbo dienų kalendorius','Mėnesių darbo dienos, valandos ir trumpinimai.'],['tuscias-kalendorius/','Tušti planuokliai','Nedatuoti failai rašymui ranka.']]
  page('irankiai','Kalendoriaus, darbo ir astronomijos įrankiai','Lietuviški kalendoriai, datų ir darbo laiko skaičiuoklės, pamainų bei pamokų planuokliai, saulės ir Mėnulio duomenys.',intro('Įrankiai aiškiems planams','Pasirinkite kalendorių, skaičiuoklę ar planuoklį. Prie kiekvieno įrankio rasite jo paskirtį ir naudojimo paaiškinimą.')+cards.call(tools))
  school=DATA['school'];rows=school['periods'].map { |p|"<tr><td>#{p['name']}</td><td>#{p['start']} – #{p['end']}</td><td>#{p['stage']}</td></tr>" }.join
  page('mokiniu-atostogos','Mokinių atostogos 2026–2027','Oficialios 2026–2027 mokslo metų mokinių atostogos Lietuvoje: rudens, Kalėdų, žiemos ir Velykų laikotarpiai pagal ugdymo pakopą.',intro('Mokinių atostogos','2026–2027 mokslo metai. Datos nurodytos imtinai.')+'<div class="table-scroll"><table class="data-table"><thead><tr><th>Atostogos</th><th>Laikotarpis</th><th>Ugdymo pakopa</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+"<div class=\"source-note\">Šaltinis: <a href=\"#{school['source']}\">Švietimo, mokslo ir sporto ministerija</a>. Peržiūrėta #{school['reviewed']}. Velykų atostogos skiriasi pagal ugdymo pakopą. Vasaros pradžia priklauso nuo klasės ir ugdymo plano; vienos datos visiems neteikiame.</div><h2>2027–2028 mokslo metai</h2><p>Šių mokslo metų tvarkaraštis mūsų šaltiniuose dar nepatvirtintas. Spėjamų datų neskelbiame.</p><a href=\"/2027/\">2027 metų kalendorius</a>")
  generate_tools
  generate_phase4
  privacy_policy=File.read("#{ROOT}/site/_includes/privacy-policy-lt.html")
  page('privatumas','Privatumo politika ir duomenų saugojimas','Sužinokite, kokius duomenis Kalendorius365 tvarko, kas saugoma tik jūsų naršyklėje, kaip veikia orų užklausa, Cloudflare saugumas ir jūsų teisės.',privacy_policy)
  File.write("#{ROOT}/site/404.html", "---\nlayout: default\ntitle: Puslapis nerastas\ndescription: Ieškomo puslapio nėra. Raskite Kalendorius365 metų ir mėnesių kalendorius.\n---\n{% include 404-lt.html %}\n")
 end
 def generate_months
  [2027,2028,2029].each do |y|
   (1..12).each do |m|
    items=MANIFEST.select { |e|e['kind']=='monthly' && e['year']==y && e['month']==m };next if items.empty?
    mo=Kalendorius.month(y,m);work=Kalendorius.work_month(y,m);first=items.find { |e|e['design']==(y==2027 && m==1 ? '06' : y==2028 && m==2 ? '02' : '01') }||items.first
    prev=Date.new(y,m,1)<<1;nxt=Date.new(y,m,1)>>1
    link=->(d,label){[2027,2028,2029].include?(d.year) ? "<a class=\"button\" href=\"#{month_url(d.year,d.month)}\">#{label}</a>" : '' }
    monthnav='<aside class="month-sidebar panel" aria-label="Mėnesio navigacija"><p class="month-sidebar__title">'+DATA['months'][m-1][1]+" #{y}</p>"+static_month(y,m)+'<nav aria-label="Metų mėnesiai">'+DATA['months'].each_with_index.map { |mm,i|"<a #{i+1==m ? 'aria-current="page"' : ''} href=\"#{month_url(y,i+1)}\">▦ #{mm[1]}</a>" }.join+"</nav><hr><a href=\"/#{y}/\">#{y} metų kalendorius</a><a href=\"/sventes/#{y}/\">Šventės #{y}</a><a href=\"/darbo-dienos/#{y}/\">Darbo laikas</a><a href=\"/kurti-kalendoriu/\">Kurti savo</a></aside>"
    stats='<div class="month-stats">'+[[mo['length'],'Kalendorinės dienos'],[work['days'],'Darbo dienos'],[work['weekends'],'Savaitgalio dienos'],[mo['days'].count { |d|d['holidays'].any? },'Šventinės dienos'],[mo['weeks'],'ISO savaičių eilutės']].map { |n,l|"<span class=\"badge\">#{l}: <strong>#{n}</strong></span>" }.join+'</div>'
    preview="<section class=\"large-preview panel\" id=\"perziura\"><div class=\"panel-title\"><h2 id=\"preview-title\">#{first['name']}</h2><span id=\"preview-format\">A4 · #{first['landscape'] ? 'Gulsčias' : 'Stačias'}</span></div><a id=\"preview-full\" href=\"#{download_href(first,'webp')}\" target=\"_blank\" rel=\"noopener\"><img id=\"selected-preview\" src=\"#{first['preview']}\" width=\"481\" height=\"680\" alt=\"#{title(y,m)} – #{first['name']}\" loading=\"eager\" decoding=\"async\" fetchpriority=\"high\"></a></section>"
    first_weekday=WEEKDAY_NAMES[mo['days'].first['weekday']-1]
    last_weekday=WEEKDAY_NAMES[mo['days'].last['weekday']-1]
    iso_weeks=mo['days'].map { |d|d['isoWeek'] }.uniq.join(', ')
    actions="<aside class=\"download-panel panel\"><h2>Atsisiuntimo parinktys</h2><label>Dizainas<select id=\"design-picker\">#{items.map { |e|"<option value=\"#{e['stem']}\" #{e['stem']==first['stem'] ? 'selected' : ''}>#{e['design']}. #{e['name']}</option>" }.join}</select></label><p>Pradžia pirmadienį · Lietuvos šventės · A4 · PDF ir WebP.</p><a class=\"button primary full-width\" id=\"selected-pdf\" href=\"#{download_href(first,'pdf')}\" download>Atsisiųsti PDF</a><a class=\"button full-width\" id=\"selected-webp\" href=\"#{download_href(first,'webp')}\" download>Atsisiųsti WebP</a><a class=\"button full-width\" id=\"selected-print\" href=\"#{download_href(first,'pdf')}\" target=\"_blank\" rel=\"noopener\">Atidaryti PDF spausdinimui ↗</a><small>PDF peržiūros lange pasirinkite spausdinimą ir 100 % mastelį. Individualias parinktis keiskite <a href=\"/kurti-kalendoriu/\">kūrėjo įrankyje</a>.</small><h2>#{DATA['months'][m-1][1]}: datos</h2><p>Mėnesio trukmė – #{mo['length']} d. Pirmoji mėnesio diena – #{first_weekday}; paskutinė – #{last_weekday}. ISO savaitės: #{iso_weeks}.</p></aside>"
    filters='<div class="design-filters segmented" role="group" aria-label="Dizainų grupės">'+[['all','Visi dizainai'],['bw','Juodai balti'],['color','Spalvoti'],['03','Biurui'],['05','Šeimai'],['08','Mokyklai'],['04','Dideli skaičiai']].map { |v,l|"<button data-design-filter=\"#{v}\" aria-pressed=\"#{v=='all'}\">#{l}</button>" }.join+'</div>'
    guidance="Mėnesio trukmė – #{mo['length']} d.; kalendoriaus tinklelyje – #{mo['weeks']} eilutės. Pirmoji mėnesio diena – #{first_weekday}; paskutinė – #{last_weekday}. Pagal įprastą penkių darbo dienų savaitę: darbo dienų – #{work['days']}, apskaičiuota darbo trukmė – #{work['hours']} val.#{work['shortened'].any? ? ' Sutrumpintos darbo dienos: '+work['shortened'].join(', ')+'.' : ' Prieššventinių darbo dienų trumpinimų nėra.'}"
    content='<div class="print-layout">'+monthnav+'<div class="month-heading">'+intro(title(y,m),'Atsisiųskite ir spausdinkite. 5 juodai balti ir 5 spalvoti dizainai. Tikros datos, Lietuvos šventės, vektorinis PDF ir 600 PPI WebP.',link.call(prev,'‹ Ankstesnis')+link.call(nxt,'Kitas ›'))+stats+'</div>'+preview+actions+'<section class="monthly-collection"><h2>10 kalendoriaus dizainų</h2>'+filters+gallery(items,true)+"<h2>Mėnesio planavimas</h2><p>#{guidance}</p><p>Biurui rinkitės trečiojo dizaino tinklelio linijas, šeimos planams – keturias asmenines skiltis, o didesniems skaičiams – ketvirtąjį dizainą. Visi failai paruošti A4 lapui; orientacija priklauso nuo kompozicijos.</p><div class=\"month-overview\">#{static_month(y,m)}</div><h2>Šventinės dienos</h2>"+holiday_table(y,m)+commemoration_table(y,m)+source+"<nav class=\"adjacent\" aria-label=\"Susiję kalendoriai\">#{link.call(prev,'‹ Ankstesnis mėnuo')}<a href=\"/#{y}/\">#{y} metų kalendorius</a><a href=\"#{month_url(y==2027 ? 2028 : 2027,m)}\">Tas pats mėnuo #{y==2027 ? 2028 : 2027} metais</a>#{link.call(nxt,'Kitas mėnuo ›')}<a href=\"/sventes/\">Lietuvos šventės ir atmintinos dienos</a><a href=\"/tuscias-kalendorius/\">Tušti kalendoriai</a><a href=\"/darbo-dienos/#{y}/\">Darbo dienos</a></nav></section></div>"
    page("#{y}/#{DATA['months'][m-1][0]}",title(y,m)+' – PDF ir WebP',"#{title(y,m)} su Lietuvos šventėmis. Mėnesio trukmė – #{mo['length']} d., darbo dienų – #{work['days']}. 10 A4 maketų PDF ir 600 PPI WebP formatais.",content,true)
   end
  end
 end
 def generate_year(y)
  months='<div class="year-grid">'+(1..12).map { |m|"<section class=\"year-month\"><h2><a href=\"#{month_url(y,m)}\">#{DATA['months'][m-1][1]} ↗</a></h2>#{static_month(y,m)}</section>" }.join+'</div>'
  items=MANIFEST.select { |e|e['kind']=='annual' && e['year']==y }
  html=intro("#{y} metų kalendorius","#{Date.gregorian_leap?(y) ? 'Keliamieji metai: 366 dienos ir vasario 29-oji.' : '365 dienos, 12 mėnesių ir vieta naujiems planams.'} Spustelėję mėnesio pavadinimą rasite dešimt jo kalendoriaus maketų.",yearlinks)+"<button data-print>Spausdinti metų apžvalgą</button>"+months+'<h2>Metiniai kalendoriai spausdinimui</h2><p>A4 gulsčias lapas. Mažesni mėnesių tinkleliai skirti metų apžvalgai, o kasdieniams įrašams rinkitės mėnesio lapus. A3 failų neteikiame.</p>'+gallery(items)+'<h2>Lietuvos šventinės dienos</h2>'+holiday_table(y)+commemoration_table(y)+source+"<p><a href=\"/savaites/#{y}/\">ISO savaitės</a> · <a href=\"/darbo-dienos/#{y}/\">Darbo dienos ir valandos</a> · <a href=\"/sventes/\">Švenčių ir atmintinų dienų paaiškinimai</a></p>"
  page(y.to_s,"#{y} metų kalendorius – atsisiųsti ir spausdinti","#{y} metų kalendorius su visais 12 mėnesių, Lietuvos šventėmis ir ISO savaitėmis. Mėnesių kolekcijos ir metiniai A4 PDF bei WebP failai.",html)
 end
 def generate_holidays(y)
  annual=MANIFEST.find { |e|e['kind']=='annual' && e['year']==y }
  html=intro("#{y} metų šventinės dienos Lietuvoje",'Įstatyme nustatytos šventinės dienos ir jų savaitės dienos. Pagal Darbo kodeksą šiomis dienomis paprastai nedirbama, tačiau taikomos įstatyme numatytos išimtys.',yearlinks('sventes/'))+'<p id="next-holiday" class="source-note"></p>'+holiday_table(y)+commemoration_table(y)+source+'<p><a href="/sventes/">Visų švenčių ir atmintinų dienų paaiškinimai</a></p>'
  html+="<h2>Šventės spausdinamame kalendoriuje</h2><p>Metiniame lape šventinės dienos išskirtos raudonai, o pilnas jų sąrašas pateiktas aukščiau.</p><a class=\"button\" href=\"#{download_href(annual,'pdf')}\" download>Metų PDF su šventėmis</a> <a class=\"button\" href=\"#{download_href(annual,'webp')}\" download>Metų WebP</a>" if annual
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
  html=intro("#{y} metų darbo dienų kalendorius",'Darbo dienos, poilsio dienos ir darbo valandų įvertis pagal pasirinktą standartinį grafiką.',yearlinks('darbo-dienos/'))+'<div class="toolbar-group"><label>Darbo savaitė<select id="work-schedule"><option value="5">5 dienos · 40 valandų</option><option value="6">6 dienos · 40 valandų</option></select></label><button id="work-csv">Atsisiųsti CSV suvestinę</button><button data-print>Spausdinti lentelę</button></div>'+tables+'<h2>Skaičiavimo metodika</h2><p>Penkių dienų savaitė: pirmadienis–penktadienis, 8 valandos per dieną. Šešių dienų pavyzdys: pirmadienis–penktadienis po 7 valandas, šeštadienis 5 valandas (40 valandų per savaitę). Šventinės dienos iš darbo dienų atimamos. Savaitgalio šventės neperkeliamos.</p><p>Pagal Darbo kodekso 112 straipsnio 6 dalį, švenčių dienos išvakarėse numatyta darbo diena trumpinama viena valanda, išskyrus pagal sutrumpintą darbo laiko normą dirbančius darbuotojus. Nuo 2026-11-01 šios dalies redakcija taip pat nustato, kad darbo užmokestis paliekamas; kai atlygis priklauso nuo darbo normų, už trumpintą valandą mokamas vidutinis darbo užmokestis, o kai dėl darbo organizavimo ypatumų ar nepertraukiamos veiklos trumpinti neįmanoma – kaip už viršvalandinį darbą. Skaičiuoklė pateikia tik 5 arba 6 dienų standartinio grafiko aritmetinį įvertį ir neapskaičiuoja šių individualių darbo užmokesčio išimčių, atostogų, suminės apskaitos ar pamaininio darbo. Tai bendro pobūdžio planavimo įrankis, o ne individuali darbo teisės konsultacija.</p>'+source+"<p><a href=\"/datos-skaiciuokle/\">Apskaičiuoti pasirinktą laikotarpį</a> · <a href=\"/#{y}/\">#{y} metų kalendorius</a></p>"
  page("darbo-dienos/#{y}","#{y} metų darbo dienų kalendorius","#{y} metų darbo dienos ir darbo valandos pagal mėnesius. Penkių arba šešių dienų savaitė, šventės, prieššventiniai trumpinimai ir metodika.",html,true)
 end
 def generate_weeks(y)
  total=Date.new(y,12,28).cweek
  rows=(1..total).map { |w|a=Date.commercial(y,w,1);b=a+6;"<tr><td>#{w}</td><td><time datetime=\"#{a}\">#{a}</time></td><td><time datetime=\"#{b}\">#{b}</time></td></tr>" }.join
  page("savaites/#{y}","#{y} metų savaičių numeriai","Visos #{y} metų ISO savaitės: tikslūs pirmadienio–sekmadienio intervalai ir dabartinės savaitės numerio įrankis. Metų sandūros paaiškinimas.",intro("#{y} metų savaičių numeriai",'ISO savaitė prasideda pirmadienį. Pirmoji ISO metų savaitė apima sausio 4-ąją; metų sandūroje savaitės metai gali skirtis nuo kalendorinių metų.',yearlinks('savaites/'))+'<div class="panel calculator"><label>Pasirinkite datą<input type="date" id="iso-date"></label><p id="iso-result" class="result" aria-live="polite"></p></div>'+"<div class=\"table-scroll\"><table class=\"data-table\"><thead><tr><th>ISO savaitė</th><th>Pirmadienis</th><th>Sekmadienis</th></tr></thead><tbody>#{rows}</tbody></table></div><a href=\"/#{y}/\">#{y} metų kalendorius</a>",true)
 end
 def generate_tools
  page('datos-skaiciuokle','Datos skaičiuoklė – dienos ir darbo laikas','Skaičiuokite dienas ir savaites tarp datų, darbo dienas su Lietuvos šventėmis, pridėkite ar atimkite dienas ir sužinokite savaitės dieną.',intro('Datos skaičiuoklė','Sužinokite dienų skirtumą, pridėkite dienų prie datos arba apskaičiuokite darbo laiką.')+<<~HTML,true)
   <section class="panel calculator"><form id="calculator"><div class="form-row"><label>Pradžios data<input name="start" type="date" required></label><label>Pabaigos data<input name="end" type="date" required></label></div><label class="check"><input name="inclusive" type="checkbox">Įtraukti abi ribines datas (darbo dienos visada imtinai)</label><label>Pridėti arba atimti dienas<input name="offset" type="number" min="-36600" max="36600" value="0"></label><button class="primary" type="submit">Skaičiuoti</button></form><div id="calc-result" class="result" aria-live="polite">Pasirinkite datas.</div></section><h2>Kaip skaičiuojama</h2><p>Darbo dienų prielaidos ir teisės aktų šaltiniai pateikti <a href="/darbo-dienos/2027/">darbo dienų kalendoriuje</a>. Dienų skirtumas skaičiuojamas tarp kalendorinių datų, todėl vasaros laiko pokyčiai rezultato nekeičia. Įtraukus abi ribines datas pridedama viena diena. Darbo dienos skaičiuojamos pirmadieniais–penktadieniais, atmetant Lietuvos šventes. Valandos ir prieššventiniai trumpinimai pateikiami pagal standartinės savaitės prielaidas. Taikomas peržiūrėtas dabartinis švenčių rinkinys; istorinės teisės aktų redakcijos neatkuriamos.</p><section class="panel calculator"><h2>Kiek liko laiko?</h2><label>Pasirinkta data<input type="date" id="countdown-date"></label><p id="countdown-result" class="result" aria-live="polite"></p><p id="countdown-standard"></p></section>
  HTML
  # The personal editor is an authored source page with its own scoped modules.
  # Never replace it with the legacy generator during release preparation.
  editor_source=File.read("#{ROOT}/site/kurti-kalendoriu/index.html")
  abort 'Personal calendar editor source is missing' unless editor_source.include?('calendar_editor: true') && editor_source.include?('id="calendar-editor"')
 end
 def generate_phase4
  html=intro('Atostogų planuoklis','Palyginkite ilgiausią vientisą poilsį, atostogų dienų efektyvumą ir kelis atskirus laikotarpius 2027 arba 2028 metais.')+<<~HTML
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
      <label>Planavimo metai<select name="year"><option value="2027">2027</option><option value="2028">2028</option></select></label>
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
   <section class="panel leave-evaluation"><h2>Įvertinti savo pasirinktą laikotarpį</h2><p>Galima rinktis datas ir per 2026–2029 metų sandūrą. Skaičiuojamos abiejų metų šventės; intervalas negali viršyti 90 dienų.</p><div class="leave-input-grid"><label>Pradžia<input type="date" name="evalStart" form="leave-planner"></label><label>Pabaiga<input type="date" name="evalEnd" form="leave-planner"></label></div><div id="custom-evaluation" aria-live="polite"></div><button type="button" id="evaluate-period">Įvertinti šį laikotarpį</button></section>
   <section class="panel leave-faq" aria-labelledby="leave-faq-title"><h2 id="leave-faq-title">Atostogų planavimas Lietuvoje: dažni klausimai</h2>
    <h3>Kiek kasmetinių atostogų dienų skaičiuoti?</h3><p>Daugumai darbuotojų, įprastai dirbančių penkias dienas per savaitę, nustatytas minimumas yra 20 darbo dienų; dirbant šešias dienas – 24. Tam tikroms darbuotojų grupėms priklauso ilgesnės atostogos. Trumpesnei ar kitokiai darbo savaitei taikoma savaitėmis išreikšta taisyklė. Įrašykite savo tikrąjį likutį, nes individualios teisės priklauso nuo aplinkybių. Plačiau: <a href="/darbo-dienos/2027/">2027 m. darbo dienų kalendorius</a>.</p>
    <h3>Ar šventinė diena sumažina atostogų likutį?</h3><p>Pagal Darbo kodekso 126 straipsnį į kasmetinių atostogų trukmę neįskaitomos įstatyme nurodytos švenčių dienos. Skaičiuoklė jas rodo atskirai ir neįtraukia į reikalingų atostogų darbo dienų skaičių; savaitgalio šventės į pirmadienį neperkeliamos. Peržiūrėkite <a href="/sventes/2027/">2027 m. Lietuvos švenčių sąrašą</a>.</p>
    <h3>Kada geriausia atostogauti 2027 ar 2028 metais?</h3><p>Pasirinkite darbo savaitę, atostogų likutį ir jums tinkamus mėnesius. Palyginimas parodo ilgiausią vientisą pertrauką, poilsio dienų ir atostogų dienų santykį bei kelis tarpusavyje atskirtus laikotarpius. Rezultate atverkite „Dienų eiga“, kad patikrintumėte kiekvieną datą.</p>
    <h3>Ar mano įvesti duomenys siunčiami į serverį?</h3><p>Ne. Įvestos datos ir planavimo parinktys išsaugomos tik šiame įrenginyje esančioje naršyklėje. Statinis Lietuvos švenčių kalendorius įkeliamas skaičiavimui; įvestas asmeninis planas svetainėje neįrašomas ir bendrinimo nuoroda nekuriama. <a href="/privatumas/">Privatumo paaiškinimas</a>.</p>
   </section>
   <section class="panel leave-source-note"><h2>Metodika ir ribos</h2><p>Optimizatorius generuoja galimus nepertraukiamus intervalus iki pasirinktos maksimalios trukmės. Vieno laikotarpio reitinge pirmiausia vertinamas bendras laisvų kalendorinių dienų skaičius; efektyvumo reitinge lyginamas laisvų dienų ir papildomų atostogų darbo dienų santykis. Kelių laikotarpių parinkimas dinaminiu programavimu didina bendrą intervalų dienų skaičių pagal jūsų turimą atostogų dienų skaičių; lygiųjų atveju renkamasi mažiau atostogų dienų, tada mažiau atskirų intervalų, paskui ankstesnės datos. Tarp dviejų atskirų pasiūlymų paliekama bent viena pagal grafiką dirbama diena.</p><p>Šventinė diena į atostogų dienų skaičių neįtraukiama, o savaitgalio šventė automatiškai neperkeliama. Jau suplanuotos datos atimamos iš nurodyto dienų likučio ir sąmoningai laikomos atskirai; darbo dienų apribojimai išjungia per juos einantį kandidatą. Įvesti nustatymai saugomi tik šioje naršyklėje; į serverį, nuorodas ar analitiką nesiunčiami. Dalijimosi nuorodos nekuriamos.</p><p>Algoritmo aprėptis: skaičiuojant daugiausia 60 dienų trukmės intervalus, intervalų sudarymas yra O(N·L), o kelių pertraukų paieška – O(N·B·K·L), kur N – metų dienų skaičius, L – maksimali atkarpa, B – likęs atostogų dienų skaičius, K – pasirinktų laikotarpių riba. Rezultatas apskaičiuojamas deterministiškai.</p></section>
  HTML
  page('atostogu-planavimas','Atostogų planavimas 2027–2028 – dienų skaičiuoklė','Planuokite atostogas Lietuvoje pagal darbo savaitę, šventes ir dienų likutį. Palyginkite poilsio bei atostogų dienas ir kelis laikotarpius.',html,true,nil,true)
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
  <div class="search-page__hero">
   <span class="eyebrow">Visos svetainės paieška</span>
   <h1 id="search-page-title">Raskite reikalingą datą ar įrankį</h1>
   <p>Ieškokite visuose Kalendorius365 puslapiuose: švenčių, 2027–2029 m. kalendorių, darbo ir mokinių atostogų, planuoklių, Saulės bei Mėnulio duomenų ir horoskopų.</p>
   <noscript>
    <style>#site-search-page-form,.search-page__quick,.search-page__results{display:none}</style>
    <section class="panel" aria-labelledby="search-no-js-title">
     <h2 id="search-no-js-title">Pasirinkite svetainės skiltį</h2>
     <p>Interaktyviai paieškai reikia įjungto JavaScript. Visą svetainės turinį galite pasiekti šiomis nuorodomis.</p>
     <nav id="search-no-js-nav" aria-label="Svetainės skiltys"><ul>
      <li><a href="/2027/">2027 m. kalendorius</a> · <a href="/2028/">2028 m. kalendorius</a> · <a href="/2029/">2029 m. kalendorius</a></li>
      <li><a href="/sventes/">Lietuvos šventės ir atmintinos dienos</a></li>
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
     <input id="site-search-page-query" name="q" type="search" placeholder="Pvz., Velykos 2028, saulėlydis Kaune…" autocomplete="off">
     <label class="search-page__category">Skiltis<select id="site-search-category" name="skiltis"><option value="all">Visa svetainė</option><option value="calendar">Kalendoriai</option><option value="holiday">Šventės</option><option value="planning">Planavimas ir darbo laikas</option><option value="school">Mokykla</option><option value="astronomy">Astronomija</option><option value="horoscope">Horoskopai</option><option value="tools">Įrankiai</option><option value="privacy">Svetainės informacija</option><option value="home">Pagrindinis puslapis</option></select></label>
     <button class="primary" type="submit">Ieškoti</button>
     <button id="site-search-clear" type="button">Išvalyti</button>
    </div>
   </form>
   <nav class="search-page__quick" aria-label="Populiarios paieškos temos">
    <span>Greita paieška:</span>
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
Pages.page('paieska','Paieška – visi kalendoriaus puslapiai','Ieškokite visoje „Kalendorius365“ svetainėje: kalendorių, Lietuvos švenčių, darbo ir mokinių atostogų, astronomijos, planuoklių bei įrankių.',search_page)
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
 when %r{\A/sventes/} then 'holiday'
 when %r{\A/(?:horoskopai|zodiakas)/} then 'horoscope'
 when %r{\A/(?:saule|menulio-fazes|menulio-kalendorius|astronominis-kalendorius|metu-laikai|pavasario-lygiadienis|vasaros-saulegriza|rudens-lygiadienis|ziemos-saulegriza)/} then 'astronomy'
 when %r{\A/(?:mokiniu-atostogos|pamoku-tvarkarastis|pamoku-tvarkarascio-sablonai)/} then 'school'
 when %r{\A/(?:darbo-dienos|atostogu-planavimas|pamainu-grafikas|savaites|savaitiniai-planuokliai|dienos-planuoklis|seimos-kalendorius)/} then 'planning'
 when %r{\A/privatumas/} then 'privacy'
 else 'tools'
 end
end
search=Dir.glob("#{Pages::ROOT}/site/**/index.html").filter_map do |path|
 raw=File.read(path); fm=raw[/\A---\s*\n(.*?)\n---\s*\n/m,1]; next unless fm
 require 'yaml'; front=YAML.safe_load(fm); next unless front && front['title']
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
 headings=body.scan(%r{<h[1-4]\b[^>]*>(.*?)</h[1-4]>}im).flatten.map { |chunk|search_plain_text.call(chunk) }.reject(&:empty?).uniq.join(' ')
 # Search only needs each page's searchable vocabulary, not repeated copies of
 # its full prose. The client turns this field into a Set of words for ranking,
 # so keep each normalized term once and avoid downloading redundant text.
 content=search_plain_text.call(body).downcase.unicode_normalize(:nfd)
  .gsub(/\p{Mn}/,'').tr('ł','l').gsub('&',' ir ').gsub(/[’'`]/,'')
  .scan(/[\p{L}\p{N}]+/).uniq.join(' ')
 {'title'=>front['title'].to_s,'url'=>url,'description'=>front['description'].to_s,
  'keywords'=>[path_terms,aliases].join(' ').strip,'headings'=>headings,'content'=>content,
  'category'=>search_category.call(url)}
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
File.write("#{Pages::ROOT}/site/assets/data/search.json",JSON.generate(search))
# A crawlable, keyboard-accessible catalogue remains available while the search
# module is loading and when JavaScript is disabled. It links canonical URLs,
# never query-string or tracking variants.
catalogue=search.reject { |item|item['action'] || item['url']=='/paieska/' }.sort_by { |item|[item['category'],item['url']] }.group_by { |item|item['category'] }
catalogue_labels={'calendar'=>'Kalendoriai','holiday'=>'Šventės','planning'=>'Planavimas ir darbo laikas','school'=>'Mokykla','astronomy'=>'Astronomija','horoscope'=>'Horoskopai','tools'=>'Įrankiai','privacy'=>'Svetainės informacija','home'=>'Pradžia'}
catalogue_html='<section class="panel search-catalogue" aria-labelledby="search-catalogue-title"><h2 id="search-catalogue-title">Puslapiai pagal skiltį</h2><p>Visą sąrašą galite naršyti ir be paieškos.</p>'+catalogue.map do |category,items|
 '<details><summary>'+Pages.esc(catalogue_labels.fetch(category,category))+'</summary><ul>'+items.map { |item|'<li><a href="'+Pages.esc(item['url'])+'">'+Pages.esc(item['title'])+'</a></li>' }.join+'</ul></details>'
end.join+'</section>'
search_source=File.join(Pages::ROOT,'site/paieska/index.html')
File.write(search_source,File.read(search_source)+catalogue_html)
