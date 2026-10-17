# frozen_string_literal: true
require 'json'
require 'cgi'
require 'date'
require 'digest'
require 'fileutils'

module NamedaysPages
  extend self
  ROOT = File.expand_path('..', __dir__)
  MONTHS = [%w[sausis Sausis Sausio], %w[vasaris Vasaris Vasario], %w[kovas Kovas Kovo],
            %w[balandis Balandis Balandžio], %w[geguze Gegužė Gegužės], %w[birzelis Birželis Birželio],
            %w[liepa Liepa Liepos], %w[rugpjutis Rugpjūtis Rugpjūčio], %w[rugsejis Rugsėjis Rugsėjo],
            %w[spalis Spalis Spalio], %w[lapkritis Lapkritis Lapkričio], %w[gruodis Gruodis Gruodžio]].freeze
  NOTES = [
    ['Metų pradžios planai', 'Sausis turi 31 dieną. Metų pradžioje patogu pasižymėti artimųjų vardadienius ir pasirinkti, kurias datas įtraukti į asmeninį kalendorių.'],
    ['Ypatinga vasario 29-oji', 'Vasario sąraše yra ir 29-oji: ji kalendoriuje pasirodo tik keliamaisiais metais. 2027 ir 2029 m. ši data neperkeliama, o 2028 m. rodoma savo vietoje.'],
    ['Pavasario pradžios datos', 'Kovas turi 31 dieną. Vardadieniai lieka susieti su mėnesio diena, nors savaitės diena ir Lietuvos vasaros laiko pradžia kasmet gali skirtis.'],
    ['Balandžio susitikimai', 'Balandžio sąraše – 30 dienų. Vardadienis ir Velykos yra skirtingos datos: vardadienis šiame kalendoriuje nekinta, o Velykų sekmadienis kasmet apskaičiuojamas atskirai.'],
    ['Gegužė artimiesiems', 'Gegužė turi 31 dieną. Motinos diena minima pirmąjį gegužės sekmadienį; ji nėra tas pats, kas konkretaus vardo vardadienis.'],
    ['Birželio vardai ir Joninės', 'Birželio sąraše – 30 dienų. Joninių ir Rasų tradiciją bei birželio 24-osios šventės statusą rasite atskirame švenčių kalendoriuje. Pats vardadienis nesuteikia nedarbo dienos statuso.'],
    ['Vasaros planai', 'Liepa turi 31 dieną. Pasirinkite vardą ir konkrečią jo datą, kad į kelionės ar šeimos planą įtrauktumėte tik norimą įrašą.'],
    ['Rugpjūčio pasveikinimai', 'Rugpjūtis turi 31 dieną. To paties vardo pasikartojimai išsaugoti: kiekvienas įrašas susietas su savo dienos straipsniu, todėl galite pasirinkti artimųjų minimą datą.'],
    ['Rudens pradžios ritmas', 'Rugsėjis turi 30 dienų. Prieš įtraukdami vardadienį į mokslų ar darbo planus pasirinkite metus – savaitės dienos keičiasi, o vardų sąrašas išlieka tas pats.'],
    ['Spalio datos', 'Spalis turi 31 dieną. Vardadieniai yra visos dienos įvykiai, todėl rudens laiko persukimas nekeičia eksportuojamos kalendorinės datos.'],
    ['Lapkričio kalendorius', 'Lapkritis turi 30 dienų. Visų Šventųjų diena ir Vėlinės pateikiamos švenčių kalendoriuje; šiame sąraše ieškokite vardų pagal konkrečią mėnesio dieną.'],
    ['Metų pabaigos pasveikinimai', 'Gruodis turi 31 dieną. Gruodžio 31-osios vardadieniai išlieka paskutinėje metų dienoje, o mygtukas „Rytoj“ metų sandūroje pereina į sausio 1-ąją.']
  ].freeze
  def esc(s); CGI.escapeHTML(s.to_s); end
  def data
    @data ||= JSON.parse(File.read(File.join(ROOT, 'data/namedays/cc-by-sa-4.0/snapshot.json')))
  end
  def rows; data.fetch('records'); end
  def month_rows(month); rows.select { |r| r['date'].start_with?(format('%02d-', month)) }; end
  def icon(type)
    paths = {'search'=>'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
      'calendar'=>'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v5m10-5v5M3 11h18M8 15h2m4 0h2m-8 3h2"/>',
      'download'=>'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
      'source'=>'<path d="M9 15 15 9m-6-3 2-2a5 5 0 0 1 7 7l-2 2m-7-2-2 2a5 5 0 0 0 7 7l2-2"/>',
      'plus'=>'<path d="M12 4v16M4 12h16"/>', 'arrow'=>'<path d="M5 19 19 5M7 5h12v12"/>'}
    %(<svg class="nd-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">#{paths.fetch(type)}</svg>)
  end
  def write_page(path, title, description, body, month = nil)
    meta = {'title'=>title,'description'=>description,'namedays'=>true,'namedays_month'=>month,
      'og_image'=>'/assets/visuals/namedays/vardadieniai-1200x630.png',
      'og_image_alt'=>'Vardadienių kalendoriaus lapas, botaninės šakelės ir subtili dovana.'}
    target = File.join(ROOT, 'site', path, 'index.html')
    FileUtils.mkdir_p(File.dirname(target))
    File.write(target, "---\n#{meta.map { |k,v| "#{k}: #{v.to_json}" }.join("\n")}\n---\n#{body}")
  end
  def edition; rows.map { |r| r.fetch('fetched_at')[0,10] }.max; end
  def attribution
    <<~HTML
      <section class="nd-panel nd-source-note" id="saltiniai" aria-labelledby="nd-sources-title"><p class="nd-eyebrow">Kilmė ir duomenų redakcija · #{esc(edition)}</p><h2 id="nd-sources-title">Aiškus šaltinis kiekvienai dienai</h2>
      <p>Vardų sąrašų šaltinis – <strong>lietuviškos Vikipedijos bendraautoriai</strong>. Iš nurodytų straipsnių skyrelių „Vardadieniai“ Kalendorius365 išskyrė vardus, suvienodino tarpus ir Unicode rašmenų formą. Prie kiekvienos dienos rasite konkrečią straipsnio redakciją ir autorių istoriją.</p>
      <p>Vardadienių sąrašai, jų ištraukos ir susistemintas duomenų rinkinys platinami pagal <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>: nurodykite autorius ir šaltinį, pažymėkite pakeitimus, o pritaikytą medžiagą platinkite tomis pačiomis sąlygomis. <a href="/assets/data/namedays/cc-by-sa-4.0.json" download>Atsisiųsti visą rinkinį su šaltiniais (JSON)</a> · <a href="/assets/data/namedays/LICENCIJA.txt">Licencijos ir pakeitimų paaiškinimas</a>.</p>
      <p>Tai bendruomenės redaguojamas kalendorius, <strong>ne valstybės vardadienių registras</strong>. Skirtingų kalendorių datos ir vardų variantai gali skirtis. Vardadienis savaime nėra įstatyminė nedarbo diena.</p>
      <details><summary>Metodika, rašyba ir atnaujinimas</summary><ul><li>Aprėptis: 366 mėnesio dienos, įskaitant vasario 29-ąją. Pirminio šaltinio vardų rašyba išsaugota; paieška be diakritinių ženklų nekeičia rodomų vardų.</li><li>Vardų formoms pasitikrinti: <a href="https://data.gov.lt/datasets/2664/">VLKK vardų lingvistiniai duomenys</a>. Tai rašybos pagalbinis šaltinis, o ne vardadienių datų registras; jo duomenų į šį rinkinį neimportavome.</li><li>Abėcėlė: <a href="https://emokykla.lt/upload/files/2024/07/08/rasyba-2022-1.pdf">„Lietuvių kalbos rašyba“</a>. Paieška rikiuojama pagal lietuvių kalbos taisykles.</li><li>Šaltinių atnaujinimai tikrinami prieš paskelbiant naują duomenų redakciją. „Šiandien“ ir „Rytoj“ apskaičiuojami jūsų įrenginyje pagal Europe/Vilnius laiko juostą; kasdien siųsti užklausų Vikipedijai nereikia.</li><li><a href="https://www.mediawiki.org/wiki/Wikimedia_APIs/Content_reuse">Wikimedia turinio pakartotinio naudojimo gairės</a> · <a href="https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content">Wikimedia turinio licencijavimas</a>. Wikimedia šio produkto neremia ir nepatvirtina.</li></ul></details></section>
    HTML
  end
  def source_link(r)
    %(<a href="#{esc(r['source_revision'])}">„#{esc(r['source_title'])}“ · redakcija #{r['source_revision_id']}</a> · <a href="#{esc(r['source_history'])}">autorių istorija</a>)
  end
  def month_cards
    '<nav class="nd-months" aria-label="Vardadieniai pagal mėnesį">' + MONTHS.each_with_index.map do |m,i|
      %(<a class="nd-month-card" href="/vardadieniai/#{m[0]}/"><img src="/assets/visuals/namedays/month-#{format('%02d',i+1)}.svg" width="288" height="288" alt="" aria-hidden="true" loading="lazy" decoding="async"><span><strong>#{m[1]}</strong><small>Dienų: #{month_rows(i+1).length}</small></span></a>)
    end.join + '</nav>'
  end
  def search
    alphabet = 'A Ą B C Č D E Ę Ė F G H I Į Y J K L M N O P R S Š T U Ų Ū V Z Ž'.split
    <<~HTML
      <section class="nd-panel" aria-labelledby="nd-search-title"><p class="nd-eyebrow">Raskite vardą ir visas jo datas</p><h2 id="nd-search-title">Kada jūsų vardadienis?</h2>
      <div class="nd-search-controls"><div><label for="nd-query">Vardas arba jo dalis</label><input id="nd-query" type="search" maxlength="80" placeholder="Pvz., Živilė arba zivile" autocomplete="off" aria-controls="nd-results"></div><div><label for="nd-month-filter">Mėnuo</label><select id="nd-month-filter"><option value="">Visi mėnesiai</option>#{MONTHS.each_with_index.map { |m,i| "<option value=\"#{i+1}\">#{m[1]}</option>" }.join}</select></div></div>
      <div class="nd-alphabet" role="group" aria-label="Vardo pirmoji raidė"><button type="button" data-letter="" aria-pressed="true">Visi</button>#{alphabet.map { |l| "<button type=\"button\" data-letter=\"#{l}\" aria-pressed=\"false\">#{l}</button>" }.join}</div>
      <div class="nd-search-meta"><p id="nd-search-status" class="nd-search-status" role="status" aria-live="polite">Paieška parengiama iš vietinio duomenų rinkinio…</p><button type="button" class="nd-search-reset" id="nd-reset" hidden>Valyti filtrus</button></div><ul id="nd-results" class="nd-search-results"></ul><button type="button" class="nd-button nd-button--light" id="nd-more" hidden>Rodyti daugiau vardų</button>
      <noscript><p>Paieškai įjunkite JavaScript arba naudokite žemiau pateiktus mėnesių sąrašus – visi vardai pasiekiami ir be JavaScript.</p></noscript></section>
    HTML
  end
  def controls(month = nil)
    r = month_rows(month || 1).first
    date = "2027-#{r['date']}"
    <<~HTML
      <section class="nd-panel" id="pasirinkta-data" aria-labelledby="nd-date-title"><p class="nd-eyebrow">Konkreti diena · jūsų planams</p><h2 id="nd-date-title">Pasirinkite datą</h2>
      <div class="nd-date-fields"><div><label for="nd-date">Kalendorinė data</label><input type="date" id="nd-date" min="1900-01-01" max="2100-12-31" value="#{date}"></div><div><label for="nd-year">Kalendoriaus metai</label><select id="nd-year">#{[2027,2028,2029].map { |y| "<option value=\"#{y}\">#{y}</option>" }.join}</select></div></div>
      <div class="nd-date-actions"><button class="nd-button nd-button--light" type="button" id="nd-today">Šiandien</button><button class="nd-button nd-button--light" type="button" id="nd-tomorrow">Rytoj</button></div>
      #{month ? '<h3 id="nd-calendar-title" class="nd-calendar-title">Pasirinkto mėnesio dienos</h3><nav id="nd-calendar" class="nd-calendar" aria-labelledby="nd-calendar-title"></nav><p class="nd-muted" id="nd-calendar-note"></p>' : ''}
      <div class="nd-selection" aria-live="polite" aria-atomic="true"><h3 id="nd-selected-title">#{MONTHS[(month||1)-1][2]} 1 d.</h3><p id="nd-selected-names">#{esc(r['names'].join(', '))}</p><p class="nd-source-link" id="nd-selected-source">#{source_link(r)}</p></div>
      <form class="nd-export" id="nd-export-form"><h3>Įtraukite į savo kalendorių</h3><label for="nd-export-name">Kieno vardadienį pažymėti?</label><select id="nd-export-name"><option value="">Visi šios dienos vardai</option></select>
      <label class="nd-check"><input type="checkbox" id="nd-recurring"><span>Kartoti kasmet tą pačią mėnesio dieną. Vasario 29-oji kartojasi tik keliamaisiais metais.</span></label>
      <div class="nd-date-actions"><button class="nd-button" type="submit" id="nd-ics">#{icon('download')} Atsisiųsti ICS</button><button class="nd-button nd-button--light" type="button" id="nd-add">#{icon('plus')} Į mano kalendorių</button></div>
      <p class="nd-feedback" id="nd-feedback" role="status" aria-live="polite"></p><p><a id="nd-file-link" href="#nd-export-form" download hidden>Išsaugoti parengtą ICS failą</a></p><small>ICS – failas jūsų kalendoriaus programai. Įrašas svetainėje saugomas tik šioje naršyklėje; sinchronizavimas tarp įrenginių nevyksta.</small><p><a id="nd-open-calendar" href="/">Atverti asmeninį kalendorių →</a></p></form>
      <noscript><p>Žemiau prie kiekvienos dienos rasite veikiantį kasmetinio ICS failo atsisiuntimą. Interaktyviam datos parinkimui reikia JavaScript.</p></noscript></section>
    HTML
  end
  def static_days(month)
    '<ol class="nd-days">' + month_rows(month).map do |r|
      day = r['date'][-2,2].to_i
      %(<li id="diena-#{format('%02d',day)}" data-day="#{r['date']}"><span class="nd-day-num" aria-hidden="true">#{format('%02d',day)}</span><div><h3>#{MONTHS[month-1][2]} #{day} d.</h3><div class="nd-static-names">#{r['names'].map { |n| "<span>#{esc(n)}</span>" }.join}</div><a class="nd-day-select" href="#pasirinkta-data" data-select-day="#{r['date']}">Pasirinkti datą #{icon('arrow')}</a><span class="nd-source-link">#{source_link(r)}</span><a class="nd-source-link" href="/assets/namedays-ics/#{r['date']}.ics" download>Kasmetinis dienos ICS</a></div></li>)
    end.join + '</ol>'
  end
  def write_data
    keys = rows.map { |r| r['date'] }
    expected = (Date.new(2028,1,1)..Date.new(2028,12,31)).map { |d| d.strftime('%m-%d') }
    raise 'Incomplete or invalid name-day snapshot' unless keys == expected && rows.all? { |r| !r['names'].empty? && r['source_revision_id'].is_a?(Integer) && r['license']=='CC-BY-SA-4.0' }
    out = File.join(ROOT,'site/assets/data/namedays'); FileUtils.mkdir_p(out)
    FileUtils.cp(File.join(ROOT,'data/namedays/cc-by-sa-4.0/snapshot.json'),File.join(out,'cc-by-sa-4.0.json'))
    FileUtils.cp(File.join(ROOT,'data/namedays/cc-by-sa-4.0/LICENCIJA.txt'),File.join(out,'LICENCIJA.txt'))
    compact = data.merge('records'=>rows.map { |r| r.reject { |k,_| %w[source_section_html transforms api_sha256 section_sha256].include?(k) } },'months'=>MONTHS,'edition'=>edition)
    json = JSON.generate(compact); File.write(File.join(out,'calendar.json'),json)
    @digest = Digest::SHA256.hexdigest(json)[0,12]
    icsdir=File.join(ROOT,'site/assets/namedays-ics');FileUtils.mkdir_p(icsdir)
    rows.each do |r|
      date=Date.iso8601("#{r['date']=='02-29' ? 2028 : 2027}-#{r['date']}")
      description="#{r['names'].join(', ')}. Lietuviškos Vikipedijos bendraautoriai; Kalendorius365 išskyrė ir susistemino vardus. CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/\n#{r['source_page']}\n#{r['source_revision']}"
      escape=->(s){s.gsub('\\','\\\\').gsub("\n",'\\n').gsub(';','\\;').gsub(',','\\,')}
      lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Kalendorius365//Vardadieniai//LT','CALSCALE:GREGORIAN','BEGIN:VEVENT',"UID:vardadieniai-#{r['date']}@kalendorius365.lt","DTSTAMP:#{DateTime.iso8601(r['fetched_at']).new_offset(0).strftime('%Y%m%dT%H%M%SZ')}","DTSTART;VALUE=DATE:#{date.strftime('%Y%m%d')}","DTEND;VALUE=DATE:#{(date+1).strftime('%Y%m%d')}",'RRULE:FREQ=YEARLY','SUMMARY:Dienos vardadieniai',"DESCRIPTION:#{escape.call(description)}",'END:VEVENT','END:VCALENDAR']
      folded=lines.map do |line|
        parts=[''];line.each_char { |c| parts << ' ' if parts.last.bytesize+c.bytesize>74;parts[-1]+=c };parts.join("\r\n")
      end
      File.binwrite(File.join(icsdir,"#{r['date']}.ics"),folded.join("\r\n")+"\r\n")
    end
  end
  def wrapper(html, month = nil)
    %(<article class="nd-app" data-namedays-source="/assets/data/namedays/calendar.json?v=#{@digest}"#{month ? " data-namedays-month=\"#{month}\"" : ''}>#{html}</article>)
  end
  def hub
    fallback=MONTHS.each_with_index.map do |m,i|
      %(<details><summary>#{m[2]} vardadieniai · visas sąrašas</summary><ul>#{month_rows(i+1).map { |r| "<li><a href=\"/vardadieniai/#{m[0]}/#diena-#{r['date'][-2,2]}\">#{m[2]} #{r['date'][-2,2].to_i} d.</a> – #{esc(r['names'].join(', '))}</li>" }.join}</ul></details>)
    end.join
    body=<<~HTML
      <header class="nd-hero"><div><p class="nd-eyebrow">Vardai, datos ir maži dėmesio ženklai</p><h1>Vardadieniai: prisiminkite, ką pasveikinti</h1><p class="nd-hero__lead">Raskite savo ar artimo žmogaus vardą, patikrinkite visas jo datas ir vienu pasirinkimu įtraukite vardadienį į kalendorių.</p><div class="nd-hero__links"><a class="nd-button" href="#nd-search-title">#{icon('search')} Rasti vardadienį</a><a class="nd-button nd-button--light" href="#menesiai">Visi mėnesiai ↓</a></div></div><img class="nd-hero__image" src="/assets/visuals/namedays/hero.svg" width="560" height="440" alt="Vardadienių kalendoriaus lapas, subtili dovana, žiedai ir žalios šakelės." fetchpriority="high" decoding="async"></header>
      <section class="nd-panel" id="siandien" aria-labelledby="nd-today-title"><div class="nd-toolbar"><div><p class="nd-eyebrow">Lietuvos data · Europe/Vilnius</p><h2 id="nd-today-title">Vardadieniai šiandien</h2></div><a href="#saltiniai">Duomenų šaltiniai</a></div><div id="nd-live-day"><p>Šiandienos ir rytojaus vardai parodomi pagal Lietuvos datą. Žemiau galite naršyti visą metų sąrašą.</p></div><nav id="nd-week" class="nd-week" aria-label="Artimiausių septynių dienų vardadieniai"></nav></section>
      <div class="nd-tools">#{search}#{controls}</div>
      <section id="menesiai" aria-labelledby="nd-months-title"><p class="nd-eyebrow">Visų metų vardadienių kalendorius</p><h2 id="nd-months-title">Dvylika mėnesių pasveikinimams</h2>#{month_cards}</section>
      <section class="nd-context" aria-label="Kaip naudotis vardadienių kalendoriumi"><div><h2>Vienas vardas, kelios datos?</h2><p>Taip pasitaiko. Paieška parodo visus šio rinkinio pasikartojimus. Pasirinkite jūsų šeimoje ar aplinkoje minimą datą.</p></div><div><h2>Vardadienis nėra gimtadienis</h2><p>Vardadienis siejamas su vardui kalendoriuje priskirta diena. Jis nepriklauso nuo žmogaus gimimo metų.</p></div><div><h2>Jūsų kalendoriuje</h2><p>Atsisiųskite vienkartinį ar kasmetinį ICS įrašą arba pridėkite vardadienį į <a href="/">asmeninį kalendorių</a>. <a href="/sventes/">Šventes</a> planuokite atskirai.</p></div></section>
      <section class="nd-panel nd-fallback" aria-labelledby="nd-all-title"><h2 id="nd-all-title">Visi vardadieniai pagal datą</h2><p class="nd-muted">Pilnas sąrašas skaitomas ir be JavaScript. Konkretūs straipsniai bei redakcijos nurodyti mėnesių puslapiuose.</p>#{fallback}</section>
      #{attribution}
    HTML
    write_page('vardadieniai','Vardadieniai šiandien – vardų paieška ir kalendorius','Raskite šiandienos, rytojaus ir visų metų vardadienius. Ieškokite vardo, pasirinkite datą ir įtraukite ją į kalendorių. Lietuviški sąrašai su šaltiniais.',wrapper(body))
  end
  def month_page(month)
    m=MONTHS[month-1];previous=MONTHS[(month+10)%12];following=MONTHS[month%12]
    note=NOTES[month-1]
    body=<<~HTML
      <header class="nd-hero nd-hero--month"><div><p class="nd-eyebrow">Vardadieniai pagal nurodytą kalendorių</p><h1>#{m[2]} vardadieniai</h1><p class="nd-hero__lead">#{note[1]}</p><div class="nd-hero__links"><a class="nd-button" href="#dienu-sarasas">#{icon('calendar')} Visos dienos</a><a href="/vardadieniai/#siandien">Kas švenčia šiandien? →</a></div></div><img class="nd-hero__image" src="/assets/visuals/namedays/month-#{format('%02d',month)}.svg" width="288" height="288" alt="" aria-hidden="true" decoding="async"></header>
      <nav class="nd-month-nav" aria-label="Ankstesnio ir kito mėnesio vardadieniai"><a href="/vardadieniai/#{previous[0]}/">←&nbsp;#{previous[2]} vardadieniai</a><a href="/vardadieniai/">Visi mėnesiai</a><a href="/vardadieniai/#{following[0]}/">#{following[2]} vardadieniai&nbsp;→</a></nav>
      <div class="nd-tools">#{search}#{controls(month)}</div>
      <section id="dienu-sarasas" aria-labelledby="nd-days-title"><p class="nd-eyebrow">Dienų: #{month_rows(month).length} · vardai su pirminio šaltinio rašyba</p><h2 id="nd-days-title">#{m[2]} vardadieniai pagal dieną</h2><p class="nd-muted">Vardų sąrašas nepriklauso nuo pasirinktų metų. Metai keičia savaitės dienas ir vasario 29-osios buvimą kalendoriuje.</p>#{static_days(month)}</section>
      <aside class="nd-panel"><h2>#{note[0]}</h2><p>Planuojate susitikimus ar pasveikinimus? <a href="/2027/#{m[0]}/">2027 m. #{m[2].downcase} kalendorius spausdinimui</a> padės matyti mėnesį viename lape. Atskirai peržiūrėkite <a href="/sventes/2027/#{m[0]}/">#{m[2].downcase} šventes ir atmintinas dienas</a>.</p></aside>
      #{attribution}
    HTML
    write_page("vardadieniai/#{m[0]}","#{m[2]} vardadieniai – vardų sąrašas pagal dieną","Visi #{m[2].downcase} vardadieniai pagal dieną. Ieškokite vardo, rinkitės 2027–2029 m. kalendorių ir atsisiųskite ICS. Prie sąrašų – šaltiniai ir redakcijos.",wrapper(body,month),month)
  end
  def run
    write_data
    hub
    (1..12).each { |month| month_page(month) }
  end
end
