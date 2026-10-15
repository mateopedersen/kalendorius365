# frozen_string_literal: true
require_relative '../lib/calendar'
require 'fileutils'
require 'cgi'
module Pages
 extend self
 ROOT=File.expand_path('..',__dir__)
 DATA=Kalendorius::DATA
 MANIFEST=JSON.parse(File.read("#{ROOT}/site/assets/data/manifest.json"))['assets']
 def esc(s);CGI.escapeHTML(s.to_s);end
 def page(path,title,desc,html,tool=false)
  target="#{ROOT}/site/#{path.empty? ? 'index' : path}/index.html"
  FileUtils.mkdir_p(File.dirname(target))
  html=visual_html(path,html)
  File.write(target,"---\n#{ { 'title'=>title,'description'=>desc,'tool'=>tool }.map { |k,v| "#{k}: #{v.to_json}" }.join("\n")}\n---\n#{html}")
 end
 def title(y,m);"#{y} m. #{DATA['months'][m-1][2]} kalendorius";end
 def month_url(y,m);"/#{y}/#{DATA['months'][m-1][0]}/";end
 def source
  '<div class="source-note">Šventinės dienos pagal Darbo kodekso 123 straipsnį. Peržiūrėta '+DATA['reviewed']+'. '+DATA['sources'].map { |s|"<a href=\"#{s['url']}\" rel=\"noopener\">#{s['title']}</a>" }.join(' · ')+'. Savaitgalio šventė automatiškai neperkeliama į pirmadienį.</div>'
 end
 def static_month(y,m)
  month=Kalendorius.month(y,m);html='<table class="static-month"><caption class="visually-hidden">'+title(y,m)+'</caption><thead><tr><th scope="col">Sav.</th>'+DATA['weekdays'].map { |d|"<th scope=\"col\">#{d}</th>" }.join+'</tr></thead><tbody>'
  month['grid'].each_slice(7).take(month['weeks']).each do |week|
   html+="<tr><th scope=\"row\">#{week.first['isoWeek']}</th>"
   week.each do |d|
    hs=d['inMonth'] ? month['days'][d['day']-1]['holidays'] : []
    html+=d['inMonth'] ? "<td class=\"#{hs.any? ? 'holiday' : ''}\"><time datetime=\"#{d['date']}\" title=\"#{esc(hs.map { |h|h['name'] }.join(' / '))}\">#{hs.any? ? '◆ ' : ''}#{d['day']}</time></td>" : '<td></td>'
   end
   html+='</tr>'
  end
  html+'</tbody></table>'
 end
 def holiday_table(y,month=nil)
  hs=Kalendorius.holidays(y);hs=hs.select { |h|Date.iso8601(h['date']).month==month } if month
  return '<p>Šį mėnesį įstatyme nustatytų šventinių dienų nėra.</p>' if hs.empty?
  '<div class="table-scroll"><table class="data-table"><thead><tr><th scope="col">Data</th><th scope="col">Diena</th><th scope="col">Šventė</th><th scope="col">Statusas</th></tr></thead><tbody>'+hs.map { |h|d=Date.iso8601(h['date']);"<tr><td><a href=\"#{month_url(y,d.month)}\"><time datetime=\"#{h['date']}\">#{h['date']}</time></a></td><td>#{DATA['weekdays'][d.cwday-1]}</td><td>#{esc(h['legalName']||h['name'])}</td><td>Šventinė diena · DK 123 str.</td></tr>" }.join+'</tbody></table></div>'
 end
 def intro(title,desc,links='')
  "<div class=\"page-heading\"><div><h1>#{title}</h1><p class=\"page-intro\">#{desc}</p></div><div class=\"toolbar-group\">#{links}</div></div>"
 end
 def yearlinks(path='')
  [2027,2028].map { |y|"<a class=\"button\" href=\"/#{path}#{y}/\">#{y}</a>" }.join
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
   alt=e['kind']=='monthly' ? "#{title(e['year'],e['month'])}: #{e['name']} su Lietuvos šventinėmis dienomis" : "#{e['year']} #{e['name']} – spausdinamas kalendorius"
   filter=e['style'];id=e['design'];dims=e['dimensions'];smallw=e['landscape'] ? 680 : 481;smallh=e['landscape'] ? 481 : 680
   "<article class=\"design-card\" id=\"dizainas-#{e['stem']}\" data-style=\"#{filter}\" data-layout=\"#{e['layout']}\" data-design=\"#{id}\"><a class=\"preview-link\" href=\"#{e['webp']}\" target=\"_blank\" rel=\"noopener\" aria-label=\"Peržiūrėti: #{esc(e['name'])}\"><img src=\"#{e['preview']}\" srcset=\"/assets/previews-small/#{File.basename(e['preview'])} 340w, #{e['preview']} 680w\" sizes=\"(max-width: 600px) 45vw, (max-width: 1100px) 25vw, 18vw\" width=\"#{smallw}\" height=\"#{smallh}\" loading=\"lazy\" decoding=\"async\" alt=\"#{esc(alt)}\"></a><div class=\"design-info\"><h2><span class=\"design-number\">#{id}</span>#{esc(e['name'])}</h2><p>#{esc(e['kind']=='monthly' ? DESCRIPTIONS[id] : e['kind']=='annual' ? 'Visi 12 mėnesių viename A4 lape. ISO savaičių numeriai ir šventinių dienų žymėjimas.' : "Nedatuotas planuoklis#{e['rows'] ? ", #{e['rows']} eilutės" : ''}. #{e['sunday'] ? 'Pradžia sekmadienį.' : 'Pradžia pirmadienį.'}")}</p><div class=\"design-actions\"><a class=\"button select-design\" href=\"#{e['webp']}\" data-stem=\"#{e['stem']}\">Peržiūrėti</a><a class=\"button\" href=\"#{e['pdf']}\" download>Atsisiųsti PDF</a><a class=\"button\" href=\"#{e['webp']}\" download>Atsisiųsti WebP</a><a class=\"button\" href=\"#{e['pdf']}\" target=\"_blank\" rel=\"noopener\">Spausdinti PDF ↗</a></div></div></article>"
  end.join+'</div>'
 end
 def run
  generate_months
  [2027,2028].each { |y|generate_year(y);generate_holidays(y);generate_work(y);generate_weeks(y) }
  blank=MANIFEST.select { |e|e['kind']=='blank' }
  page('tuscias-kalendorius','Tuščias kalendorius – PDF šablonai','Nedatuoti mėnesio, savaitės, šeimos ir mokyklos kalendoriai. PDF ir WebP, pirmadienio arba sekmadienio pradžia, penkios ar šešios eilutės.',intro('Tuščias kalendorius','Nedatuoti lapai jūsų ritmui: rašykite datas ir planus patys. Mėnesio tinkleliams rinkitės 5 arba 6 eilutes; savaitės planuokliams eilučių keisti nereikia.')+'<p class="source-note">PDF atidarykite spausdinimui ir pasirinkite tikrąjį dydį (100 %). Lape jau paliktos saugios paraštės. WebP skirtas aukštos raiškos vaizdui.</p>'+gallery(blank))
  links=[['2027/','2027 metų kalendorius','Visi mėnesiai, šventės ir metiniai failai.'],['2028/','2028 metų kalendorius','Keliamieji metai ir 29 dienų vasaris.']]
  cards=->(arr){'<div class="resource-grid">'+arr.map { |url,name,desc|"<a class=\"resource-card\" href=\"/#{url}\"><h2>#{name}</h2><small>#{desc}</small></a>" }.join+'</div>'}
  page('metai','Metų kalendoriai','2027 ir 2028 metų lietuviški kalendoriai: visų mėnesių apžvalga, Lietuvos šventės ir metiniai PDF bei WebP failai.',intro('Metų kalendoriai','Matykite visus metus ir rinkitės lapą spausdinimui.')+cards.call(links))
  monthcards=[2027,2028].map { |y|"<h2>#{y} metai</h2>"+cards.call(DATA['months'].each_with_index.map { |m,i|["#{y}/#{m[0]}/",m[1],"#{Kalendorius.month(y,i+1)['length']} dienos · 10 dizainų"] }) }.join
  page('menesiai','Mėnesių kalendoriai – 2027 ir 2028','Pasirinkite 2027 ar 2028 metų mėnesį. Kiekvienam mėnesiui – dešimt skirtingų A4 kalendorių su Lietuvos šventėmis, PDF ir WebP.',intro('Mėnesių kalendoriai','24 mėnesiai. Kiekvienam – dešimt savitų planavimo būdų.')+monthcards)
  tools=[['datos-skaiciuokle/','Datos skaičiuoklė','Dienų skirtumas, darbo dienos, datos pridėjimas ir atgalinis skaičiavimas.'],['kurti-kalendoriu/','Kalendoriaus kūrėjas','Pasirinkite datą, popierių, šventes ir savo įvykius.'],['savaites/2027/','ISO savaitės','Savaičių numeriai ir tikslūs intervalai.'],['mokiniu-atostogos/','Mokinių atostogos','Patikrintos 2026–2027 mokslo metų atostogų datos.'],['darbo-dienos/2027/','Darbo dienų kalendorius','Mėnesių darbo dienos, valandos ir trumpinimai.'],['tuscias-kalendorius/','Tušti planuokliai','Nedatuoti failai rašymui ranka.']]
  page('irankiai','Kalendoriaus įrankiai','Datos ir darbo dienų skaičiuoklės, ISO savaitės, mokinių atostogos ir asmeninio spausdinamo kalendoriaus kūrėjas.',intro('Įrankiai aiškiems planams','Praktiški skaičiavimai ir patikimi kalendoriaus duomenys.')+cards.call(tools))
  school=DATA['school'];rows=school['periods'].map { |p|"<tr><td>#{p['name']}</td><td>#{p['start']} – #{p['end']}</td><td>#{p['stage']}</td></tr>" }.join
  page('mokiniu-atostogos','Mokinių atostogos 2026–2027','Oficialios 2026–2027 mokslo metų mokinių atostogos Lietuvoje: rudens, Kalėdų, žiemos ir Velykų laikotarpiai pagal ugdymo pakopą.',intro('Mokinių atostogos','2026–2027 mokslo metai. Datos nurodytos imtinai.')+'<div class="table-scroll"><table class="data-table"><thead><tr><th>Atostogos</th><th>Laikotarpis</th><th>Ugdymo pakopa</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+"<div class=\"source-note\">Šaltinis: <a href=\"#{school['source']}\">Švietimo, mokslo ir sporto ministerija</a>. Peržiūrėta #{school['reviewed']}. Velykų atostogos skiriasi pagal ugdymo pakopą. Vasaros pradžia priklauso nuo klasės ir ugdymo plano; vienos datos visiems neteikiame.</div><h2>2027–2028 mokslo metai</h2><p>Šių mokslo metų tvarkaraštis mūsų šaltiniuose dar nepatvirtintas. Spėjamų datų neskelbiame.</p><a href=\"/2027/\">2027 metų kalendorius</a>")
  generate_tools
  page('privatumas','Privatumas ir duomenų saugojimas','Kaip Kalendorius365 saugo asmeninius įvykius, užduotis ir užrašus naršyklėje; JSON atsarginės kopijos, ICS ir orų duomenų šaltinis.',intro('Privatumas ir jūsų duomenys','Asmeninis planavimas be paskyros.')+'<section class="panel"><h2>Šiame įrenginyje</h2><p>Įvykiai, užrašai, užduotys ir nuostatos saugomi naršyklės vietinėje saugykloje. Jie nesiunčiami į mūsų serverį, neįtraukiami į nuorodas ir nesinchronizuojami. Kitoje naršyklėje jų nematysite. Išvalius svetainės duomenis, įrašai dingsta. Privačiu režimu jie gali išnykti uždarius langą.</p><h2>Atsarginė kopija</h2><p>Pradiniame puslapyje pasirinkite „JSON kopija“. Failą saugokite patikimoje vietoje: jis nėra užšifruotas. Atkūrimas pakeičia dabartinius įrašus. ICS eksportas skirtas tik įvykiams; jis neapima užrašų ir užduočių.</p><h2>ICS apribojimai</h2><p>Importuojamos datos, visos dienos įvykiai, Europe/Vilnius arba UTC laikas ir paprasti kasdieniai, savaitiniai, mėnesiniai bei metiniai kartojimai. Sudėtingos taisyklės, išimtys, dalyviai ir priminimai atmetami su pranešimu. Importas kuria naujus įrašus; tą patį failą importavus pakartotinai atsiras kopijos. Vasaros laiko pradžioje neegzistuojantys pasikartojimo laikai praleidžiami.</p><h2>Orų ryšys</h2><p>Pasirinktas miestas perduodamas mūsų orų paslaugai, kuri gauna LHMT duomenis. Tiksli vieta nenustatoma. Duomenys talpinami į 20 minučių podėlį. LHMT duomenys: CC BY-SA 4.0; šaltinis ir atnaujinimo laikas nurodomi prie orų.</p><h2>Svetainės prieiga</h2><p>Nenaudojame reklamos ar analitikos sekimo scenarijų. Svetainę pateikia Cloudflare; tinklo paslaugų teikėjas apdoroja įprastus ryšio duomenis, reikalingus puslapiams pateikti ir apsaugoti.</p><h2>Spausdinami dizainai</h2><p>Kalendorius365 vektorinės kompozicijos sukurtos šiai svetainei. Failus galima nemokamai atsisiųsti ir spausdinti savo planavimui. Spausdinamuose failuose naudojamas Inter, svetainės sąsajoje – Lato. Abu šriftai naudojami pagal SIL Open Font License.</p></section>')
  File.write("#{ROOT}/site/404.html", "---\nlayout: default\ntitle: Puslapis nerastas\ndescription: Ieškomo puslapio nėra. Raskite Kalendorius365 metų ir mėnesių kalendorius.\n---\n<h1>Puslapis nerastas</h1><p>Patikrinkite adresą arba grįžkite į <a href=\"/\">kalendorių</a>.</p>")
 end
 def generate_months
  [2027,2028].each do |y|
   (1..12).each do |m|
    items=MANIFEST.select { |e|e['kind']=='monthly' && e['year']==y && e['month']==m };next if items.empty?
    mo=Kalendorius.month(y,m);work=Kalendorius.work_month(y,m);first=items.find { |e|e['design']==(y==2027 && m==1 ? '06' : y==2028 && m==2 ? '02' : '01') }||items.first
    prev=Date.new(y,m,1)<<1;nxt=Date.new(y,m,1)>>1
    link=->(d,label){[2027,2028].include?(d.year) ? "<a class=\"button\" href=\"#{month_url(d.year,d.month)}\">#{label}</a>" : '' }
    monthnav='<aside class="month-sidebar panel"><h2>'+DATA['months'][m-1][1]+" #{y}</h2>"+static_month(y,m)+'<nav aria-label="Metų mėnesiai">'+DATA['months'].each_with_index.map { |mm,i|"<a #{i+1==m ? 'aria-current="page"' : ''} href=\"#{month_url(y,i+1)}\">▦ #{mm[1]}</a>" }.join+"</nav><hr><a href=\"/#{y}/\">#{y} metų kalendorius</a><a href=\"/sventes/#{y}/\">Šventės #{y}</a><a href=\"/darbo-dienos/#{y}/\">Darbo laikas</a><a href=\"/kurti-kalendoriu/\">Kurti savo</a></aside>"
    stats='<div class="month-stats">'+[[mo['length'],'Kalendorinės dienos'],[work['days'],'Darbo dienos'],[work['weekends'],'Savaitgalio dienos'],[mo['days'].count { |d|d['holidays'].any? },'Šventinės dienos'],[mo['weeks'],'ISO savaičių eilutės']].map { |n,l|"<span class=\"badge\">#{l}: <strong>#{n}</strong></span>" }.join+'</div>'
    preview="<section class=\"large-preview panel\" id=\"perziura\"><div class=\"panel-title\"><h2 id=\"preview-title\">#{first['name']}</h2><span id=\"preview-format\">A4 · #{first['landscape'] ? 'Gulsčias' : 'Portretas'}</span></div><a id=\"preview-full\" href=\"#{first['webp']}\" target=\"_blank\" rel=\"noopener\"><img id=\"selected-preview\" src=\"#{first['preview']}\" width=\"481\" height=\"680\" alt=\"#{title(y,m)} – #{first['name']}\" fetchpriority=\"high\"></a></section>"
    actions="<aside class=\"download-panel panel\"><h2>Atsisiuntimo parinktys</h2><label>Dizainas<select id=\"design-picker\">#{items.map { |e|"<option value=\"#{e['stem']}\" #{e['stem']==first['stem'] ? 'selected' : ''}>#{e['design']}. #{e['name']}</option>" }.join}</select></label><p>Pradžia pirmadienį · Lietuvos šventės · A4 · PDF ir WebP.</p><a class=\"button primary full-width\" id=\"selected-pdf\" href=\"#{first['pdf']}\" download>Atsisiųsti PDF</a><a class=\"button full-width\" id=\"selected-webp\" href=\"#{first['webp']}\" download>Atsisiųsti WebP</a><a class=\"button full-width\" id=\"selected-print\" href=\"#{first['pdf']}\" target=\"_blank\" rel=\"noopener\">Atidaryti PDF spausdinimui ↗</a><small>PDF peržiūros lange pasirinkite spausdinimą ir 100 % dydį. Individualias parinktis keiskite <a href=\"/kurti-kalendoriu/\">kūrėjo įrankyje</a>.</small><h2>#{DATA['months'][m-1][1]}: datos</h2><p>#{mo['length']} dienos. Pirmoji diena: #{DATA['weekdays'][mo['days'].first['weekday']-1]}. ISO savaitės #{mo['days'].map { |d|d['isoWeek'] }.uniq.join(', ')}.</p></aside>"
    filters='<div class="design-filters segmented" role="group" aria-label="Dizainų grupės">'+[['all','Visi dizainai'],['bw','Juodai balti'],['color','Spalvoti'],['03','Biurui'],['05','Šeimai'],['08','Mokyklai'],['04','Dideli skaičiai']].map { |v,l|"<button data-design-filter=\"#{v}\" aria-pressed=\"#{v=='all'}\">#{l}</button>" }.join+'</div>'
    guidance="#{y} m. #{DATA['months'][m-1][1].downcase}: mėnesio trukmė – #{mo['length']} d., kalendoriaus eilučių skaičius – #{mo['weeks']}. Pirmoji diena – #{DATA['weekdays'][mo['days'].first['weekday']-1]}, paskutinė – #{DATA['weekdays'][mo['days'].last['weekday']-1]}. Standartiniam penkių dienų grafikui: darbo dienų skaičius – #{work['days']}, darbo valandų įvertis – #{work['hours']}#{work['shortened'].any? ? '; trumpinamos dienos: '+work['shortened'].join(', ') : '; prieššventinių trumpinimų nėra'}."
    content='<div class="print-layout">'+monthnav+'<div class="month-heading">'+intro(title(y,m),'Atsisiųskite ir spausdinkite. 5 juodai balti ir 5 spalvoti dizainai. Tikros datos, Lietuvos šventės, vektorinis PDF ir 600 PPI WebP.',link.call(prev,'‹ Ankstesnis')+link.call(nxt,'Kitas ›'))+stats+'</div>'+preview+actions+'<section class="monthly-collection"><h2>10 kalendoriaus dizainų</h2>'+filters+gallery(items,true)+"<h2>Mėnesio planavimas</h2><p>#{guidance}</p><p>Biurui rinkitės trečiojo dizaino tinklelio linijas, šeimos planams – keturias asmenines skiltis, o didesniems skaičiams – ketvirtąjį dizainą. Visi failai paruošti A4 lapui; orientacija priklauso nuo kompozicijos.</p><div class=\"month-overview\">#{static_month(y,m)}</div><h2>Šventinės dienos</h2>"+holiday_table(y,m)+source+"<nav class=\"adjacent\" aria-label=\"Susiję kalendoriai\">#{link.call(prev,'‹ Ankstesnis mėnuo')}<a href=\"/#{y}/\">#{y} metų kalendorius</a><a href=\"#{month_url(y==2027 ? 2028 : 2027,m)}\">Tas pats mėnuo #{y==2027 ? 2028 : 2027} metais</a>#{link.call(nxt,'Kitas mėnuo ›')}<a href=\"/tuscias-kalendorius/\">Tušti kalendoriai</a><a href=\"/darbo-dienos/#{y}/\">Darbo dienos</a></nav></section></div>"
    page("#{y}/#{DATA['months'][m-1][0]}",title(y,m)+' – PDF ir WebP',"#{title(y,m)}: penki juodai balti ir penki spalvoti A4 dizainai, Lietuvos šventės ir tikros datos. Vektoriniai PDF bei 600 PPI WebP spausdinimui.",content,true)
   end
  end
 end
 def generate_year(y)
  months='<div class="year-grid">'+(1..12).map { |m|"<section class=\"year-month\"><h2><a href=\"#{month_url(y,m)}\">#{DATA['months'][m-1][1]} ↗</a></h2>#{static_month(y,m)}</section>" }.join+'</div>'
  items=MANIFEST.select { |e|e['kind']=='annual' && e['year']==y }
  html=intro("#{y} metų kalendorius","#{Date.gregorian_leap?(y) ? 'Keliamieji metai: 366 dienos ir vasario 29-oji.' : '365 dienos, 12 mėnesių ir vieta naujiems planams.'} Mėnuo atveria savo dešimties dizainų kolekciją.",yearlinks)+"<button data-print>Spausdinti metų apžvalgą</button>"+months+'<h2>Metiniai kalendoriai spausdinimui</h2><p>A4 gulsčias lapas. Mažesni mėnesių tinkleliai skirti metų apžvalgai, o kasdieniams įrašams rinkitės mėnesio lapus. A3 failų neteikiame.</p>'+gallery(items)+'<h2>Lietuvos šventinės dienos</h2>'+holiday_table(y)+source+"<p><a href=\"/savaites/#{y}/\">ISO savaitės</a> · <a href=\"/darbo-dienos/#{y}/\">Darbo dienos ir valandos</a></p>"
  page(y.to_s,"#{y} metų kalendorius – atsisiųsti ir spausdinti","#{y} metų kalendorius su visais 12 mėnesių, Lietuvos šventėmis ir ISO savaitėmis. Mėnesių kolekcijos ir metiniai A4 PDF bei WebP failai.",html)
 end
 def generate_holidays(y)
  annual=MANIFEST.find { |e|e['kind']=='annual' && e['year']==y }
  html=intro("#{y} metų šventinės dienos Lietuvoje",'Įstatyme nustatytos šventinės dienos. Pažymėtos tikros datos; bendras nedarbo principas taikomas su Darbo kodekse numatytomis išimtimis.',yearlinks('sventes/'))+'<p id="next-holiday" class="source-note"></p>'+holiday_table(y)+source+'<h2>Kitos datos</h2><p>Atmintinos ir kultūrinės dienos nėra automatiškai šventinės nedarbo dienos. Šiame sąraše pateikiamos tik DK 123 straipsnyje nustatytos datos; atmintinų dienų rinkinio kol kas neskelbiame.</p>'
  html+="<h2>Šventės spausdinamame kalendoriuje</h2><p>Metiniame lape šventinės dienos išskirtos raudonai, o pilnas jų sąrašas pateiktas aukščiau.</p><a class=\"button\" href=\"#{annual['pdf']}\" download>Metų PDF su šventėmis</a> <a class=\"button\" href=\"#{annual['webp']}\" download>Metų WebP</a>" if annual
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
  html=intro("#{y} metų darbo dienų kalendorius",'Darbo dienos, poilsio dienos ir darbo valandų įvertis pagal pasirinktą standartinį grafiką.',yearlinks('darbo-dienos/'))+'<div class="toolbar-group"><label>Darbo savaitė<select id="work-schedule"><option value="5">5 dienos · 40 valandų</option><option value="6">6 dienos · 40 valandų</option></select></label><button id="work-csv">Atsisiųsti CSV suvestinę</button><button data-print>Spausdinti lentelę</button></div>'+tables+'<h2>Skaičiavimo metodika</h2><p>Penkių dienų savaitė: pirmadienis–penktadienis, 8 valandos per dieną. Šešių dienų pavyzdys: pirmadienis–penktadienis po 7 valandas, šeštadienis 5 valandas (40 valandų per savaitę). Šventinės dienos iš darbo dienų atimamos. Savaitgalio šventės neperkeliamos.</p><p>Pagal DK 112 straipsnio 6 dalį prieš pat šventinę dieną einanti numatyta darbo diena trumpinama viena valanda. Trumpinimas netaikomas darbuotojams, kuriems nustatyta sutrumpinta darbo laiko norma. Atostogos, individualūs grafikai, suminė apskaita, pamainos ir kitos išimtys nevertinamos. Tai bendro pobūdžio planavimo įvertis, o ne individualus darbo grafikas.</p>'+source+"<p><a href=\"/datos-skaiciuokle/\">Apskaičiuoti pasirinktą laikotarpį</a> · <a href=\"/#{y}/\">#{y} metų kalendorius</a></p>"
  page("darbo-dienos/#{y}","#{y} metų darbo dienų kalendorius","#{y} metų darbo dienos ir darbo valandos pagal mėnesius. Penkių arba šešių dienų savaitė, šventės, prieššventiniai trumpinimai ir metodika.",html,true)
 end
 def generate_weeks(y)
  total=Date.new(y,12,28).cweek
  rows=(1..total).map { |w|a=Date.commercial(y,w,1);b=a+6;"<tr><td>#{w}</td><td><time datetime=\"#{a}\">#{a}</time></td><td><time datetime=\"#{b}\">#{b}</time></td></tr>" }.join
  page("savaites/#{y}","#{y} metų savaičių numeriai","Visos #{y} metų ISO savaitės: tikslūs pirmadienio–sekmadienio intervalai ir dabartinės savaitės numerio įrankis. Metų sandūros paaiškinimas.",intro("#{y} metų savaičių numeriai",'ISO 8601 savaitė prasideda pirmadienį. Pirmoji metų savaitė turi sausio 4 dieną; ISO metai gali skirtis nuo kalendorinių metų.',yearlinks('savaites/'))+'<div class="panel calculator"><label>Pasirinkite datą<input type="date" id="iso-date"></label><p id="iso-result" class="result" aria-live="polite"></p></div>'+"<div class=\"table-scroll\"><table class=\"data-table\"><thead><tr><th>ISO savaitė</th><th>Pirmadienis</th><th>Sekmadienis</th></tr></thead><tbody>#{rows}</tbody></table></div><a href=\"/#{y}/\">#{y} metų kalendorius</a>",true)
 end
 def generate_tools
  page('datos-skaiciuokle','Datos skaičiuoklė – dienos ir darbo laikas','Skaičiuokite dienas ir savaites tarp datų, darbo dienas su Lietuvos šventėmis, pridėkite ar atimkite dienas ir sužinokite savaitės dieną.',intro('Datos skaičiuoklė','Dienos, savaitės ir darbo laikas – pagal tikras kalendoriaus datas.')+<<~HTML,true)
   <section class="panel calculator"><form id="calculator"><div class="form-row"><label>Pradžios data<input name="start" type="date" required></label><label>Pabaigos data<input name="end" type="date" required></label></div><label class="check"><input name="inclusive" type="checkbox">Įtraukti abi ribines datas (darbo dienos visada imtinai)</label><label>Pridėti arba atimti dienas<input name="offset" type="number" min="-36600" max="36600" value="0"></label><button class="primary" type="submit">Skaičiuoti</button></form><div id="calc-result" class="result" aria-live="polite">Pasirinkite datas.</div></section><h2>Kaip skaičiuojama</h2><p>Dienų skirtumas skaičiuojamas tarp kalendorinių datų, todėl vasaros laiko pokyčiai rezultato nekeičia. Įtraukus abi ribines datas pridedama viena diena. Darbo dienos skaičiuojamos pirmadieniais–penktadieniais, atmetant Lietuvos šventes. Valandos ir prieššventiniai trumpinimai pateikiami pagal standartinės savaitės prielaidas. Taikomas peržiūrėtas dabartinis švenčių rinkinys; istorinės teisės aktų redakcijos neatkuriamos.</p><section class="panel calculator"><h2>Kiek liko laiko?</h2><label>Pasirinkta data<input type="date" id="countdown-date"></label><p id="countdown-result" class="result" aria-live="polite"></p><p id="countdown-standard"></p></section>
  HTML
  page('kurti-kalendoriu','Kalendoriaus kūrėjas – susikurkite ir spausdinkite','Susikurkite mėnesio ar metų kalendorių: šventės, savaitės pradžia, ISO numeriai, šriftas, užrašai ir popierius. Spausdinimas ir WebP eksportas.',intro('Kalendoriaus kūrėjas','Tikros datos. Jūsų pasirinkimai. Asmeniniai įvykiai apdorojami tik šioje naršyklėje.')+<<~HTML,true)
   <div class="tool-layout"><form id="generator" class="tool-controls panel"><label>Metai<input name="year" type="number" min="1900" max="2100" required value="2027"></label><label>Laikotarpis<select name="month"><option value="0">Visi metai</option>#{DATA['months'].each_with_index.map { |m,i|"<option value=\"#{i+1}\">#{m[1]}</option>" }.join}</select></label><label>Savaitės pradžia<select name="weekstart"><option value="0">Pirmadienis</option><option value="6">Sekmadienis</option></select></label><label class="check"><input name="holidays" type="checkbox" checked>Rodyti šventes</label><label class="check"><input name="weeks" type="checkbox" checked>ISO savaitės</label><label>Tema<select name="theme"><option value="classic">Klasikinė</option><option value="national">Lietuviška</option><option value="contrast">Kontrastinga</option></select></label><label>Šriftas<select name="fontsize"><option value="11">Įprastas</option><option value="14">Didesnis</option><option value="17">Labai didelis</option></select></label><label>Vieta užrašams<select name="space"><option value="normal">Įprasta</option><option value="large">Didesnė (atskira apačioje)</option></select></label><label>Popierius<select name="paper"><option value="a4">A4</option><option value="letter">Letter</option></select></label><label>Orientacija<select name="orientation"><option value="landscape">Gulsčias</option><option value="portrait">Portretas</option></select></label><label>Pavadinimas (nebūtinas)<input name="title" maxlength="70"></label><label class="check"><input name="events" type="checkbox">Įtraukti šios naršyklės įvykius</label><p id="generator-limits" class="muted">Metiniame lape šrifto dydis optimizuojamas įskaitomumui, asmeniniai įvykiai ir papildomi užrašai nerodomi.</p><div class="form-actions"><button type="submit">Atnaujinti</button><button type="button" id="generator-print" class="primary">Spausdinti / Išsaugoti PDF</button><button type="button" id="generator-webp">Atsisiųsti WebP</button></div></form><section class="tool-preview" aria-label="Sukurto kalendoriaus peržiūra"><div id="generator-preview"></div></section></div><p class="source-note">PDF išsaugomas naršyklės spausdinimo lange. Pasirinkite nurodytą lapą bei orientaciją ir išjunkite naršyklės antraštes bei poraštes. Standartinius vektorinius PDF taip pat rasite <a href="/menesiai/">mėnesių kolekcijose</a>. Asmeniniai įvykiai niekur nesiunčiami.</p>
  HTML
 end
end
require_relative '../lib/page_designs'
require_relative '../lib/visual_design'
Pages.run
Pages.generate_blank
search=Dir.glob("#{Pages::ROOT}/site/**/index.html").filter_map do |path|
 raw=File.read(path); fm=raw.split("---",3)[1]; next unless fm
 require 'yaml'; front=YAML.safe_load(fm); next unless front['title']
 {'title'=>front['title'],'url'=>'/'+path.delete_prefix("#{Pages::ROOT}/site/").delete_suffix('index.html')}
end
search.unshift({'title'=>'Kalendorius – šiandien, įvykiai ir planai','url'=>'/'})
File.write("#{Pages::ROOT}/site/assets/data/search.json",JSON.generate(search))
