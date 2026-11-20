# frozen_string_literal: true
# Focused discovery tools reuse the reviewed calendar and astronomy data.
module DiscoveryPages
 extend self
 def publish(slug,title,description,body,icon)
  Pages.page(slug,title,description,"<header class=\"discovery-heading\"><img src=\"/assets/visuals/discovery-#{icon}.svg\" width=\"72\" height=\"72\" alt=\"\" aria-hidden=\"true\"><div>#{Pages.intro(title,description)}</div></header>"+body)
  path="#{Pages::ROOT}/site/#{slug}/index.html"
  File.write(path,File.read(path).sub("---\n","---\ndiscovery: true\n"))
 end
 def weekend_periods(year)
  month_names = Pages::DATA.fetch('months')
  weekdays = %w[Pr An Tr Kt Pn Št Sk]
  weekday_accusative = %w[pirmadienį antradienį trečiadienį ketvirtadienį penktadienį šeštadienį sekmadienį]
  holidays = (year-1..year+1).flat_map { |candidate| Kalendorius.holidays(candidate) }.group_by { |holiday| holiday.fetch('date') }
  first_day = Date.new(year, 1, 1)
  last_day = Date.new(year, 12, 31)
  free = ->(day) { day.cwday >= 6 || holidays.key?(day.iso8601) }
  periods = []
  day = first_day
  day -= 1 while free.call(day) && free.call(day - 1)
  while day <= last_day
   unless free.call(day)
    day += 1
    next
   end
   finish = day
   finish += 1 while free.call(finish + 1)
   if (finish - day).to_i >= 2
    dates = (day..finish).to_a
    occasions = dates.flat_map { |date| holidays.fetch(date.iso8601, []) }
    names = occasions.map { |holiday| holiday.fetch('name') }
    title = if occasions.any? { |holiday| holiday['rule'] == 'easter' }
     'Velykos'
    elsif occasions.any? { |holiday| holiday['month'] == 12 && holiday['day'] == 24 }
     'Kūčios ir Kalėdos'
    elsif occasions.any? { |holiday| holiday['month'] == 11 && holiday['day'] == 2 }
     'Visų Šventųjų diena ir Vėlinės'
    elsif names.length > 1
     names.join(' ir ')
    else
     names.first
    end
    number = ->(date) { "#{month_names[date.month-1][2]} #{date.day} d." }
    month = month_names[[day, first_day].max.month-1]
    reason = names.join(' · ')
    if occasions.length == 1
     weekday = Date.iso8601(occasions.first.fetch('date')).cwday
     reason = "Šventė minima #{weekday_accusative[weekday-1]}."
    end
    periods << {
     'start'=>day.iso8601, 'end'=>finish.iso8601, 'days'=>dates.length,
     'start_label'=>day.year == finish.year ? number.call(day) : "#{day.year} m. #{number.call(day)}",
     'end_label'=>day.year == finish.year ? (day.month == finish.month ? "#{finish.day} d." : number.call(finish)) : "#{finish.year} m. #{number.call(finish)}",
     'name'=>title, 'reason'=>reason,
     'month_path'=>"/#{year}/#{month.first}/", 'month_label'=>"#{month[2].capitalize} kalendorius",
     'strip'=>dates.map { |date| {'day'=>date.day, 'weekday'=>weekdays[date.cwday-1]} },
    }
   end
   day = finish + 1
  end
  periods
 end
 def run
  File.write("#{Pages::ROOT}/site/_data/long_weekends.json", JSON.generate(
   Pages::HOLIDAY_YEARS.map { |year| {'year'=>year, 'periods'=>weekend_periods(year)} }
  ))
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
  body='<form id="daylight-form" class="panel"><label>Palyginimo data<input id="daylight-date" type="date" min="2027-01-01" max="2030-12-31" value="2027-06-21" required></label><button type="submit">Palyginti miestus</button></form><p id="daylight-status" role="status">Įjunkite JavaScript, kad palygintumėte miestus.</p><div class="table-scroll"><table class="data-table"><caption>Penkių Lietuvos miestų dienos šviesa</caption><thead><tr><th>Miestas</th><th>Saulėtekis</th><th>Saulėlydis</th><th>Dienos ilgumas</th><th>Šviesa per 24 val.</th></tr></thead><tbody id="daylight-rows"></tbody></table></div><h2>Ką parodo palyginimas?</h2><p>Tą pačią dieną šiauriau esantys miestai vasarą paprastai gauna daugiau dienos šviesos, žiemą – mažiau. Juostų skalė visiems miestams vienoda: 24 valandos.</p><p class="source-note">Laikai pateikiami Europe/Vilnius laiko juosta, įvertinus vasaros laiką. Skaičiavimas apytikslis miesto centrui, pagal −0,833° Saulės horizonto kampą; pastatai, reljefas ir faktinė atmosfera neįvertinami. Koordinatės: <a href="https://www.geonames.org/export/">GeoNames, CC BY</a>. Skaičiavimo metodas ir vieno miesto Saulės kelias – <a href="/saule/">Saulės įrankyje</a>.</p>'
  publish('dienos-ilgumas','Dienos ilgumo palyginimas Lietuvos miestuose','Pasirinkite 2027–2030 metų datą ir vienoje lentelėje palyginkite Vilniaus, Kauno, Klaipėdos, Šiaulių bei Panevėžio dienos šviesą.',body,'sun')
  body='<p class="source-note">Pateikiami bent trijų iš eilės poilsio dienų laikotarpiai pagal penkių dienų darbo savaitę.</p>'
  Pages::HOLIDAY_YEARS.each do |year|
   cards=weekend_periods(year).map do |period|
    %(<article class="panel"><h3>#{Pages.esc(period.fetch('name'))}</h3><p><time datetime="#{period.fetch('start')}">#{period.fetch('start_label')}</time> &ndash; <time datetime="#{period.fetch('end')}">#{period.fetch('end_label')}</time></p><a href="#{period.fetch('month_path')}">#{period.fetch('month_label')} →</a></article>)
   end.join
   body+=%(<section id="savaitgaliai-#{year}"><h2>#{year} m. ilgieji savaitgaliai</h2><div class="resource-grid">#{cards}</div></section>)
  end
  body+='<h2>Norite ilgesnės pertraukos?</h2><p><a class="button" href="/atostogu-planavimas/">Palyginti atostogų planus</a></p>'+Pages.source
  publish('ilgieji-savaitgaliai','Ilgieji savaitgaliai 2027–2030 be atostogų','Peržiūrėkite bent trijų poilsio dienų laikotarpius Lietuvoje, kuriems nereikia papildomų atostogų dirbant penkias dienas per savaitę.',body,'planning')
 end
end
