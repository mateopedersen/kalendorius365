# frozen_string_literal: true
# Focused discovery tools reuse the reviewed calendar and astronomy data.
module DiscoveryPages
 extend self
 def publish(slug,title,description,body,icon)
  Pages.page(slug,title,description,"<header class=\"discovery-heading\"><img src=\"/assets/visuals/discovery-#{icon}.svg\" width=\"72\" height=\"72\" alt=\"\" aria-hidden=\"true\"><div>#{Pages.intro(title,description)}</div></header>"+body)
  path="#{Pages::ROOT}/site/#{slug}/index.html"
  File.write(path,File.read(path).sub("---\n","---\ndiscovery: true\n"))
 end
 def run
  # These three curated pages are authored as complete Jekyll source files.
  # Keep the older generated fallback only for checkouts where those page
  # templates are absent or have not yet been upgraded.
  authored_pages={
   'atmintinos-dienos'=>'commemoration-year',
   'dienos-ilgumas'=>'daylight-chart',
   'ilgieji-savaitgaliai'=>'weekend-planner'
  }
  if authored_pages.all? do |slug,marker|
    path="#{Pages::ROOT}/site/#{slug}/index.html"
    File.file?(path) && File.read(path).include?(marker)
   end
   return
  end

  phase2=JSON.parse(File.read("#{Pages::ROOT}/data/holiday-phase2.json"))
  entries=(Pages::EDITORIAL['commemorations']+phase2['articles'].select { |a| a['category'].start_with?('Atmintina diena') }).sort_by { |a|[a['month'],a['day']] }
  months=entries.group_by { |a|a['month'] }
  body='<p class="source-note">Tai mūsų parengtų atmintinų dienų gidų rinkinys, ne visas įstatymo sąrašas. Atmintina diena savaime nėra nedarbo diena. Švenčių statusą tikrinkite <a href="/sventes/">švenčių kalendoriuje</a>.</p><label>Rasti dieną<input type="search" id="commemoration-search" placeholder="Pavadinimas arba tema" aria-controls="commemoration-list"></label><p id="commemoration-status" role="status"></p><div id="commemoration-list">'
  months.each do |month,items|
   body+="<section data-commemoration-month><h2>#{Pages.esc(Pages::DATA['months'][month-1][1])}</h2><div class=\"resource-grid\">"
   items.each do |a|
    body+="<article class=\"panel\" data-commemoration><p class=\"muted\">#{a.dig('recurrence','type')=='nth-weekday' ? 'Gegužės trečiasis penktadienis' : format('%02d-%02d',month,a['day'])} · Atmintina diena</p><h3><a href=\"/sventes/#{a['slug']}/\">#{Pages.esc(a['title'])}</a></h3><p>#{Pages.esc(a['summary'])}</p></article>"
   end
   body+='</div></section>'
  end
  body+='</div><p>Datos ir paaiškinimai pateikiami pagal kiekviename gide nurodytus šaltinius.</p>'
  publish('atmintinos-dienos','Lietuvos atmintinų dienų gidas','Raskite Lietuvos istorijos ir kultūros dienas pagal pavadinimą. Skaitykite apie jų prasmę, tradicijas ir šaltinius.',body,'holidays')
  body='<form id="daylight-form" class="panel"><label>Palyginimo data<input id="daylight-date" type="date" min="2027-01-01" max="2029-12-31" value="2027-06-21" required></label><button type="submit">Palyginti miestus</button></form><p id="daylight-status" role="status">Įjunkite JavaScript, kad palygintumėte miestus.</p><div class="table-scroll"><table class="data-table"><caption>Penkių Lietuvos miestų dienos šviesa</caption><thead><tr><th>Miestas</th><th>Saulėtekis</th><th>Saulėlydis</th><th>Dienos ilgumas</th><th>Šviesa per 24 val.</th></tr></thead><tbody id="daylight-rows"></tbody></table></div><h2>Ką parodo palyginimas?</h2><p>Tą pačią dieną šiauriau esantys miestai vasarą paprastai gauna daugiau dienos šviesos, žiemą – mažiau. Juostų skalė visiems miestams vienoda: 24 valandos.</p><p class="source-note">Laikai pateikiami Europe/Vilnius laiko juosta, įvertinus vasaros laiką. Skaičiavimas apytikslis miesto centrui, pagal −0,833° Saulės horizonto kampą; pastatai, reljefas ir faktinė atmosfera neįvertinami. Koordinatės: <a href="https://www.geonames.org/export/">GeoNames, CC BY</a>. Skaičiavimo metodas ir vieno miesto Saulės kelias – <a href="/saule/">Saulės įrankyje</a>.</p>'
  publish('dienos-ilgumas','Dienos ilgumo palyginimas Lietuvos miestuose','Pasirinkite 2027–2029 metų datą ir vienoje lentelėje palyginkite Vilniaus, Kauno, Klaipėdos, Šiaulių bei Panevėžio dienos šviesą.',body,'sun')
  body='<p class="source-note">Pateikiami bent trijų iš eilės poilsio dienų laikotarpiai, kai dirbama pirmadieniais–penktadieniais, o įstatyme nustatytos šventės yra laisvos. Papildomų atostogų dienų nepridedame. Pamaininiam grafikui šis sąrašas netinka.</p><nav class="year-nav" aria-label="Pasirinkti metus">'+[2027,2028,2029].map { |y|"<a class=\"button\" href=\"#savaitgaliai-#{y}\">#{y}</a>" }.join+'</nav>'
  [2027,2028,2029].each do |y|
   holidays=(Kalendorius.holidays(y-1)+Kalendorius.holidays(y)+Kalendorius.holidays(y+1)).map { |h|h['date'] }
   free=->(d) { d.cwday>5 || holidays.include?(d.iso8601) }
   periods=[];date=Date.new(y,1,1)
   while date<=Date.new(y,12,31)
    if free.call(date) && !free.call(date-1)
     finish=date;finish+=1 while free.call(finish+1)
     periods<<[date,finish] if (finish-date).to_i+1>=3
     date=finish+1
    else
     date+=1
    end
   end
   # Include a break beginning in the previous year if it overlaps January.
   start=Date.new(y,1,1)
   if free.call(start) && free.call(start-1)
    start-=1 while free.call(start-1)
    finish=Date.new(y,1,1);finish+=1 while free.call(finish+1)
    periods.unshift([start,finish]) if (finish-start).to_i+1>=3
   end
   body+="<section id=\"savaitgaliai-#{y}\"><h2>#{y} m. ilgieji savaitgaliai</h2><div class=\"resource-grid\">"
   periods.each do |first,last|
    names=Kalendorius.holidays(y).select { |h| (first..last).cover?(Date.iso8601(h['date'])) }.map { |h|h['name'] }.uniq.join(' · ')
    body+="<article class=\"panel\"><p class=\"muted\">#{(last-first).to_i+1} poilsio dienos · 0 atostogų dienų</p><h3><time datetime=\"#{first}\">#{first}</time> – <time datetime=\"#{last}\">#{last}</time></h3><p>#{Pages.esc(names)}</p><a href=\"/#{y}/#{Pages::DATA['months'][(first.year<y ? 1 : first.month)-1][0]}/\">Atverti mėnesio kalendorių →</a></article>"
   end
   body+='</div></section>'
  end
  body+='<h2>Norite ilgesnės pertraukos?</h2><p><a class="button" href="/atostogu-planavimas/">Palyginti atostogų planus</a></p>'+Pages.source
  publish('ilgieji-savaitgaliai','Ilgieji savaitgaliai 2027–2029 be atostogų','Peržiūrėkite bent trijų poilsio dienų laikotarpius Lietuvoje, kuriems nereikia papildomų atostogų dirbant penkias dienas per savaitę.',body,'planning')
 end
end
