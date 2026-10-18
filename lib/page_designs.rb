# frozen_string_literal: true
# Page-specific composition follows the owner's ten desktop concepts. All figures,
# links and print previews come from the verified engine and manifest.
module Pages
 alias_method :write_page, :page
 def download_href(asset,kind)
  digest=asset.fetch('files').fetch(kind).fetch('sha256')
  "#{asset.fetch(kind)}?v=#{digest[0,16]}"
 end
 def collection_box(items,first=items.first)
  return '' unless first
  paper=first['paper']||'A4';pdf_name=File.basename(first['pdf']);webp_name=File.basename(first['webp'])
  preview_alt=first['alt']||"#{first['year']} #{first['name']} – spausdinamo kalendoriaus peržiūra"
  quality=paper=='A3' ? '<ul class="quality-list"><li>A3 PDF su 3 mm užlaidomis</li><li>Įterpti šriftai</li><li>600 PPI WebP</li><li>Lietuviškos datos ir šventės</li></ul><small>PDF spausdinkite pasirinkę A3 formatą ir 100 % dydį.</small>' : '<ul class="quality-list"><li>Tikras vektorinis tekstas ir tinkleliai</li><li>Įterpti lietuviški Inter šriftai</li><li>600 PPI WebP iš to paties PDF</li><li>Svetainės ženklas lapo apačioje</li></ul><small>Vektoriams DPI netaikomas. Šiose kompozicijose įdėtų rastrinių vaizdų nėra. CMYK spaustuvinės atitikties neteigiame.</small>'
  "<aside class=\"resource-aside\"><section class=\"panel download-panel\"><h2>Atsisiųsti kalendorių</h2><label>Dizainas<select id=\"design-picker\">#{items.map { |e|"<option value=\"#{e['stem']}\" #{e==first ? 'selected' : ''}>#{e['design']}. #{esc(e['name'])}#{e['rows'] ? " · #{e['rows']} eilutės" : ''}</option>" }.join}</select></label><p id=\"preview-title\">#{esc(first['name'])}</p><span id=\"preview-format\" class=\"badge\">#{paper} · #{first['landscape'] ? 'Gulsčias' : 'Stačias'}</span><a class=\"button primary full-width\" id=\"selected-pdf\" href=\"#{download_href(first,'pdf')}\" download=\"#{esc(pdf_name)}\">Atsisiųsti PDF</a><a class=\"button full-width\" id=\"selected-webp\" href=\"#{download_href(first,'webp')}\" download=\"#{esc(webp_name)}\">Atsisiųsti WebP</a><a class=\"button full-width\" id=\"selected-print\" href=\"#{download_href(first,'pdf')}\" target=\"_blank\" rel=\"noopener\">Atidaryti PDF spausdinimui ↗</a><small>PDF peržiūros lange pasirinkite spausdinimą, 100 % dydį ir #{paper} formatą.</small></section><section class=\"panel\"><h2>Spaudos kokybė</h2>#{quality}</section></aside>"
 end
 def selected_art(first,collapsed=false)
  return '' unless first
  paper=first['paper']||'A4';alt=first['alt']||"#{first['name']} – tikro spausdinamo kalendoriaus peržiūra"
  body="<section class=\"panel large-preview\" id=\"perziura\"><a id=\"preview-full\" href=\"#{download_href(first,'webp')}\" target=\"_blank\" rel=\"noopener\"><img id=\"selected-preview\" src=\"#{first['preview']}\" width=\"#{first['landscape'] ? 680 : 481}\" height=\"#{first['landscape'] ? 481 : 680}\" alt=\"#{esc(alt)}\" #{collapsed ? 'loading="lazy"' : 'fetchpriority="high"'}></a></section>"
  collapsed ? '<details id="print-art"><summary>Pasirinkto spausdinamo dizaino peržiūra</summary>'+body+'</details>' : body
 end
 def metric_cards(values)
  '<div class="resource-stats">'+values.each_with_index.map { |(n,label),i|"<div>#{ui_icon(%w[calendar clock briefcase][i%3])}<strong>#{n}</strong><span>#{label}</span></div>" }.join+'</div>'
 end
 def workyear_hero(y)
  %(<section class="workyear-hero" aria-labelledby="workyear-hero-title"><div class="workyear-hero__copy"><span class="workyear-eyebrow">Lietuvos darbo laiko apžvalga · #{y}</span><h2 id="workyear-hero-title">Metų ritmas, vienu žvilgsniu</h2><p>Peržiūrėkite mėnesių darbo krūvį, pasirinkite įprastą penkių ar šešių dienų savaitę ir pasitikrinkite konkrečios datos statusą.</p><div class="workyear-hero__notes"><span><i aria-hidden="true"></i>Pagal Lietuvos šventinių dienų kalendorių</span><a href="/sventes/#{y}/">Peržiūrėti visas šventes <span aria-hidden="true">→</span></a></div></div><figure class="workyear-hero__art"><img src="/assets/visuals/workday-year.svg" width="410" height="259" alt="Stilizuotas #{y} metų darbo kalendorius su mėnesių darbo krūvio diagrama" fetchpriority="high"></figure></section>)
 end
 def workyear_month_grid(y)
  five=(1..12).map { |m|Kalendorius.work_month(y,m) }
  six=(1..12).map { |m|Kalendorius.work_month(y,m,true) }
  max_hours=(five+six).map { |month|month['hours'] }.max
  cards=five.each_with_index.map do |stats,index|
   six_stats=six[index];month=DATA['months'][stats['month']-1][1];percent=(stats['hours'].to_f/max_hours*100).round
   %(<a class="workyear-month" href="#{month_url(y,stats['month'])}" data-work-month data-days-five="#{stats['days']}" data-days-six="#{six_stats['days']}" data-hours-five="#{stats['hours']}" data-hours-six="#{six_stats['hours']}"><span class="workyear-month__index">#{format('%02d',stats['month'])} · #{y}</span><strong class="workyear-month__name">#{month}</strong><span class="workyear-month__stats"><span><b data-work-days>#{stats['days']}</b> darbo d.</span><b data-work-hours>#{stats['hours']} val.</b></span><span class="workyear-month__track" role="img" aria-label="#{stats['hours']} darbo valandų"><span data-work-bar style="--month-fill:#{percent}%"></span></span><span class="workyear-month__link">Mėnesio kalendorius <span aria-hidden="true">↗</span></span></a>)
  end.join
  %(<section class="workyear-section" aria-labelledby="workyear-months-title"><div class="workyear-section__heading"><div><span class="workyear-eyebrow">12 mėnesių · greita navigacija</span><h2 id="workyear-months-title">Kada didžiausias darbo krūvis?</h2><p>Mėnesio kortelės prisitaiko prie pasirinktos darbo savaitės. Atverkite mėnesį, jei norite peržiūrėti konkrečias datas.</p></div><span class="workyear-legend"><i aria-hidden="true"></i>Darbo valandos</span></div><div class="workyear-month-grid">#{cards}</div></section>)
 end
 def workyear_eves(y)
  holidays=Kalendorius.holidays(y).to_h { |holiday|[holiday['date'],holiday['name']] }
  entries=[5,6].map do |schedule|
   stats=(1..12).flat_map { |m|Kalendorius.work_month(y,m,schedule==6)['shortened'] }.uniq.sort
   items=stats.map do |iso|
    date=Date.iso8601(iso);holiday=holidays[(date+1).iso8601]||'artėjanti šventė';month=DATA['months'][date.month-1][1]
    %(<li><time datetime="#{iso}">#{date.day} #{month}</time><span>#{WEEKDAY_NAMES[date.cwday-1]}</span><strong>#{holiday}</strong></li>)
   end.join
   %(<ul class="workyear-eves__list" data-work-eves="#{schedule}" #{schedule==6 ? 'hidden' : ''}>#{items}</ul>)
  end.join
  %(<section class="workyear-eves" aria-labelledby="workyear-eves-title"><div><span class="workyear-eyebrow">Planuokite iš anksto</span><h2 id="workyear-eves-title">Prieššventinės darbo dienos</h2><p>Šios dienos pagal įstatymo taisyklę trumpinamos viena valanda. Sąrašas keičiasi kartu su darbo savaitės pasirinkimu.</p></div><div class="workyear-eves__content">#{entries}</div></section>)
 end
 def workday_date_checker(y)
  %(<section class="workday-checker" aria-labelledby="workday-checker-title"><div class="workday-checker__intro"><span class="workyear-eyebrow">Greitas patikrinimas</span><h2 id="workday-checker-title">Ar šią dieną dirbama?</h2><p>Pasirinkite datą, kad patikrintumėte savaitės dieną, Lietuvos šventes ir pavyzdinį darbo valandų skaičių.</p></div><form id="workday-check-form" class="workday-checker__form"><label for="workday-check-date">Data #{y} m.<input id="workday-check-date" type="date" min="#{y}-01-01" max="#{y}-12-31" value="#{y}-01-04" required></label><button class="primary" type="submit">Patikrinti dieną</button></form><div id="workday-check-result" class="workday-checker__result" data-state="work" role="status" aria-live="polite"><span class="workday-checker__result-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4.5h14A1.5 1.5 0 0 1 20.5 6v13A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5Z"/><path d="M8 3v3m8-3v3M4 9h16M8 13h2m4 0h2m-8 4h2"/></svg></span><div><strong data-workday-state>Darbo diena</strong><p data-workday-detail>2027 m. sausio 4 d. · pirmadienis · 8 darbo val. pagal 5 dienų grafiką.</p></div></div><p class="workday-checker__note">Įvertis naudoja įprastą grafiką ir neapima individualių pamainų ar darbo sutarties išimčių.</p></section>)
 end
 def shell(main,aside)
  '<div class="resource-shell"><div class="resource-content">'+main+'</div>'+aside+'</div>'
 end
 def page(path,title,desc,html,tool=false,robots=nil,planner=false,phase_module=nil)
  case path
  when /\A202[789]\z/
   y=path.to_i;items=MANIFEST.select { |e|e['kind']=='annual' && e['year']==y };first=items.find { |e|e['design']==(y==2027 ? '06' : '01') }||items.first
   html=html.sub('<div class="year-grid">','<div class="year-grid annual-sheet">').sub('<h2>Metiniai kalendoriai spausdinimui</h2>',selected_art(first,true)+'<h2>Metinė šablonų kolekcija</h2>').gsub('class="gallery"','class="gallery compact-gallery"')
   html=shell(html,collection_box(items,first));tool=true
  when %r{\Asventes/202[789]\z}
   y=path.split('/').last.to_i;hs=Kalendorius.holidays(y);work=hs.count { |h|Date.iso8601(h['date']).cwday<=5 }
   html=html.sub('<p id="next-holiday"',metric_cards([[Date.gregorian_leap?(y) ? 366 : 365,'Kalendorinės dienos'],[hs.length,'Šventinės datos'],[work,'Šventės darbo dienomis']])+'<p id="next-holiday"')
   aside="<aside class=\"resource-aside\"><section class=\"panel\"><h2>Artimiausia šventė</h2><p id=\"next-holiday-aside\" class=\"result\"></p><a class=\"button primary full-width\" href=\"/#{y}/\">Metų kalendorius su šventėmis</a></section><section class=\"panel\"><h2>Duomenų patikimumas</h2><p>Teisinė klasifikacija atskirta nuo atmintinų ir kultūrinių datų. Šventė savaitgalį automatiškai neperkeliama.</p><a href=\"/darbo-dienos/#{y}/\">Darbo dienos ir valandos →</a></section></aside>"
   html=shell(html,aside)
  when %r{\Adarbo-dienos/202[789]\z}
   y=path.split('/').last.to_i;stats=(1..12).map { |m|Kalendorius.work_month(y,m) }
   controls=html[/<div class="toolbar-group"><label>Darbo savaitė.*?<\/div>/m]||'';html=html.sub(controls,'')
   controls=controls.sub('class="toolbar-group"','class="toolbar-group workyear-controls"')
   insights=workyear_hero(y)+metric_cards([[stats.sum { |s|s['days'] },'Darbo dienos · 5 d. savaitė'],[stats.sum { |s|s['hours'] },'Darbo valandos'],[stats.sum { |s|s['shortened'].length },'Prieššventiniai trumpinimai']])+workyear_month_grid(y)+workday_date_checker(y)+workyear_eves(y)
   html=html.sub('<section data-work-table=',insights+'<section data-work-table=')
   aside='<aside class="resource-aside"><section class="panel workyear-controls-panel"><span class="workyear-eyebrow">Pasirinkite grafiką</span><h2>Darbo laiko nustatymai</h2>'+controls+'</section><section class="panel"><h2>Skaičiavimo prielaidos</h2><p>40 valandų savaitės pavyzdys: 5 dienas po 8 valandas arba 6 dienas po 7 valandas darbo dienomis ir 5 valandas šeštadienį.</p><p>Šventinės dienos iš darbo dienų atimamos. Savaitgalio šventės į pirmadienį neperkeliamos.</p><a href="/datos-skaiciuokle/">Apskaičiuoti kitą laikotarpį →</a></section></aside>'
   html=shell(html,aside)
  when 'mokiniu-atostogos'
   items=MANIFEST.select { |e|e['kind']=='blank' && ['03','06','08'].include?(e['design']) }
   html=html.sub('<div class="table-scroll">','<section id="2026-2027"><div class="table-scroll">').sub('<h2>2027–2028 mokslo metai</h2>','</section><section id="2027-2028"><h2>2027–2028 mokslo metai</h2>')+'</section><h2>Spausdinami mokymosi planuokliai</h2>'+gallery(items,true)
   html=html.sub('<section id="2026-2027">',metric_cards([['2026–27','Patikrinti mokslo metai'],[DATA['school']['periods'].length,'Atostogų laikotarpiai pagal programas'],['2027–28','Laukiama patvirtintų duomenų']])+'<section id="2026-2027">')
   aside='<aside class="resource-aside"><section class="panel"><h2>Mokslo metų pasirinkimas</h2><a class="button full-width" href="#2026-2027">2026–2027 · patikrintos datos</a><a class="button full-width" href="#2027-2028">2027–2028 · nepatvirtinta</a></section><section class="panel"><h2>Mokyklos šablonai</h2><p>Tušti savaitės planai padeda žymėti pamokas ir atsiskaitymus neįrašant nepatvirtintų atostogų.</p><a href="/tuscias-kalendorius/">Rinktis planuoklį →</a></section></aside>'
   html=shell(html,aside)
  when 'kurti-kalendoriu'
   paper=html[/<label>Popierius<select name="paper">.*?<\/label>/m]||''
   orientation=html[/<label>Orientacija<select name="orientation">.*?<\/label>/m]||''
   actions=html[/<div class="form-actions">.*?<\/div>/m]||''
   html=html.sub(paper,'').sub(orientation,'').sub(actions,'<button type="submit">Atnaujinti peržiūrą</button>')
   aside='<aside class="builder-aside panel"><h2>Spausdinimo parinktys</h2>'+paper.sub('<select ','<select form="generator" ')+orientation.sub('<select ','<select form="generator" ')+actions.sub('<button type="submit">','<button type="submit" form="generator">')+'<h2>Jūsų duomenys</h2><p>Pasirinkti įvykiai apdorojami tik šioje naršyklėje. Jokios paskyros ar debesų sinchronizavimo.</p><p>PDF kuriamas naršyklės spausdinimo lange; WebP eksportas – 600 PPI pagal pasirinktą popierių.</p></aside>'
   html=html.sub('</section></div>','</section>'+aside+'</div>')
  when 'datos-skaiciuokle'
   countdown=html[/<section class="panel calculator"><h2>Kiek liko laiko\?.*?<\/section>/m]||'';html=html.sub(countdown,'')
   html+='<section class="panel"><h2>ISO savaitės numeris</h2><label>Pasirinkite datą<input type="date" id="iso-date"></label><p id="iso-result" class="result" aria-live="polite"></p><div id="iso-nearby"></div><a href="/savaites/2027/">Visos 2027 savaitės</a> · <a href="/savaites/2028/">Visos 2028 savaitės</a></section>'
   html=shell(html,'<aside class="resource-aside">'+countdown+'<section class="panel"><h2>Greiti skaičiavimai</h2><div class="quick-countdowns"><button data-countdown="new-year">Iki Naujųjų metų</button><button data-countdown="easter">Iki Velykų</button><button data-countdown="jonines">Iki Joninių</button><button data-countdown="christmas">Iki Kalėdų</button></div></section></aside>')
  end
  write_page(path,title,desc,html,tool,robots,planner,phase_module)
 end
 def generate_blank
  items=MANIFEST.select { |e|e['kind']=='blank' }
  html=intro('Tušti kalendoriai ir planuokliai spausdinimui','Rinkitės iš 20 nedatuotų maketų pagal paskirtį: mėnesiui, savaitei, dienai, šeimai, mokyklai ar pamainoms. Mėnesio tinklelyje galima pasirinkti 5 arba 6 eilutes; visi lapai paruošti A4 spaudai.')+blank_gallery(items)+'<nav class="adjacent" aria-label="Kiti kalendoriaus planavimo puslapiai"><a href="/seimos-kalendorius/">Šeimos savaitės planuoklis</a><a href="/kurti-kalendoriu/">Sukurti kalendorių su pasirinktomis datomis</a><a href="/metai/">Datuoti metų kalendoriai spausdinimui</a></nav>'
  write_page('tuscias-kalendorius','Tušti kalendoriai spausdinimui: nemokami PDF ir WebP','Atsisiųskite 20 nedatuotų mėnesio, savaitės, dienos, šeimos, mokyklos ir pamainų planuoklių. Pasirinkite 5 ar 6 eilučių kalendorių; gaukite vektorinį PDF arba 600 PPI WebP.',html,true)
 end
end
