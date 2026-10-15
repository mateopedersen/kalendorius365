# frozen_string_literal: true
# Page-specific composition follows the owner's ten desktop concepts. All figures,
# links and print previews come from the verified engine and manifest.
module Pages
 alias_method :write_page, :page
 def collection_box(items,first=items.first)
  return '' unless first
  "<aside class=\"resource-aside\"><section class=\"panel download-panel\"><h2>Atsisiųsti kalendorių</h2><label>Dizainas<select id=\"design-picker\">#{items.map { |e|"<option value=\"#{e['stem']}\" #{e==first ? 'selected' : ''}>#{e['design']}. #{esc(e['name'])}#{e['rows'] ? " · #{e['rows']} eilutės" : ''}</option>" }.join}</select></label><p id=\"preview-title\">#{esc(first['name'])}</p><span id=\"preview-format\" class=\"badge\">A4 · #{first['landscape'] ? 'Gulsčias' : 'Portretas'}</span><a class=\"button primary full-width\" id=\"selected-pdf\" href=\"#{first['pdf']}\" download>Atsisiųsti PDF</a><a class=\"button full-width\" id=\"selected-webp\" href=\"#{first['webp']}\" download>Atsisiųsti WebP</a><a class=\"button full-width\" id=\"selected-print\" href=\"#{first['pdf']}\" target=\"_blank\" rel=\"noopener\">Atidaryti PDF spausdinimui ↗</a><small>PDF peržiūros lange pasirinkite spausdinimą, 100 % dydį ir tinkamą lapo orientaciją.</small></section><section class=\"panel\"><h2>Spaudos kokybė</h2><ul class=\"quality-list\"><li>Tikras vektorinis tekstas ir tinkleliai</li><li>Įterpti lietuviški Inter šriftai</li><li>600 PPI WebP iš to paties PDF</li><li>Kalendorius365.lt ženklas apačioje</li></ul><small>Vektoriams DPI netaikomas. Šiose kompozicijose įdėtų rastrinių vaizdų nėra. CMYK spaustuvinės atitikties neteigiame.</small></section></aside>"
 end
 def selected_art(first,collapsed=false)
  return '' unless first
  body="<section class=\"panel large-preview\" id=\"perziura\"><a id=\"preview-full\" href=\"#{first['webp']}\" target=\"_blank\" rel=\"noopener\"><img id=\"selected-preview\" src=\"#{first['preview']}\" width=\"#{first['landscape'] ? 680 : 481}\" height=\"#{first['landscape'] ? 481 : 680}\" alt=\"#{esc(first['name'])} – tikro spausdinamo kalendoriaus peržiūra\" #{collapsed ? 'loading="lazy"' : 'fetchpriority="high"'}></a></section>"
  collapsed ? '<details id="print-art"><summary>Pasirinkto spausdinamo dizaino peržiūra</summary>'+body+'</details>' : body
 end
 def metric_cards(values)
  '<div class="resource-stats">'+values.each_with_index.map { |(n,label),i|"<div>#{ui_icon(%w[calendar clock briefcase][i%3])}<strong>#{n}</strong><span>#{label}</span></div>" }.join+'</div>'
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
   html=html.sub('<section data-work-table=',metric_cards([[stats.sum { |s|s['days'] },'Darbo dienos · 5 d. savaitė'],[stats.sum { |s|s['hours'] },'Darbo valandos'],[stats.sum { |s|s['shortened'].length },'Prieššventiniai trumpinimai']])+'<section data-work-table=')
   aside='<aside class="resource-aside"><section class="panel"><h2>Darbo laiko nustatymai</h2>'+controls+'</section><section class="panel"><h2>Svarbu žinoti</h2><p>40 valandų savaitės pavyzdys. Tikras darbo grafikas priklauso nuo sutarties, darbo laiko režimo ir įstatymo išimčių.</p><a href="/datos-skaiciuokle/">Pasirinkto laikotarpio skaičiavimas →</a></section></aside>'
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
  items=MANIFEST.select { |e|e['kind']=='blank' };first=items.first
  filters='<div class="design-filters segmented" role="group" aria-label="Tuščių planuoklių grupės">'+[['all','Visi šablonai'],['month','Mėnesio'],['week','Savaitės'],['family','Šeimai'],['office','Biurui'],['school','Mokyklai'],['bw','Juodai balti'],['color','Spalvoti']].map { |v,l|"<button data-design-filter=\"#{v}\" aria-pressed=\"#{v=='all'}\">#{l}</button>" }.join+'</div>'
  html=intro('Tuščias kalendorius','Nedatuoti mėnesio, savaitės ir mokymosi planai. Rinkitės 5 arba 6 eilučių mėnesio tinklelius, pirmadienio ar sekmadienio pradžią.')+filters+selected_art(first)+"<h2>10 originalių dizainų · #{items.length} variantų</h2>"+gallery(items,true)+'<p class="source-note">Tuščiuose lapuose datų nėra. Mėnesio eilučių skaičius nurodytas variante; sekmadienio pradžią turi antrasis dizainas. PDF spausdinkite 100 % dydžiu.</p>'
  write_page('tuscias-kalendorius','Tuščias kalendorius – nemokami PDF šablonai','Nedatuoti mėnesio ir savaitės planai: juodai balti ir spalvoti, 5 ar 6 eilutės, pirmadienio ar sekmadienio pradžia. Tikri PDF ir 600 PPI WebP.',shell(html,collection_box(items)),true)
 end
end
