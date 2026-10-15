# frozen_string_literal: true
# Presentation only. Dates, print files and download links remain manifest driven.
module Pages
 def ui_icon(name)
  %(<svg class="icon" aria-hidden="true" focusable="false"><use href="/assets/visuals/icons.svg##{name}"></use></svg>)
 end
 def holiday_stories(y)
  easter=Kalendorius.holidays(y).find { |h|h['name']=='Velykos' }
  entries=[
   ['lithuania-freedom','Laisvė ir valstybė','Lietuvos šventės','Vasario 16-oji, Kovo 11-oji ir Liepos 6-oji – datos, jungiančios šalies istoriją ir šiandienos planus.',3,'Lietuvos trispalvė ir Gedimino bokšto motyvas saulėlydyje'],
   ['velykos-spring','Pavasario tradicijos','Velykos','Margučiai, pavasario šviesa ir laikas artimiesiems. Velykų data kasmet apskaičiuojama pagal Grigaliaus kalendorių.',easter ? Date.iso8601(easter['date']).month : 4,'Margučiai su augaliniais raštais ir gluosnio šakelės'],
   ['jonines-rasos','Birželio 24-oji','Joninės / Rasos','Trumpiausių naktų metas: vainikai, gamta ir vasaros susitikimai. Pažymėkite birželio 24-ąją savo planuose.',6,'Ąžuolo lapų vainikas prie ežero ir Joninių laužas'],
   ['kucios-winter','Gruodžio 24–26 d.','Kūčios ir Kalėdos','Ramus metų pabaigos laikas. Kūčios ir abi Kalėdų dienos pažymėtos Lietuvos šventinių dienų kalendoriuje.',12,'Kūčiukų dubuo, žvakė ir lino staltiesė žiemos vakare']
  ]
  '<h2>Metų šventės ir tradicijos</h2><div class="holiday-stories">'+entries.map { |image,eyebrow,title,body,month,alt|
   %(<article class="holiday-story"><img src="/assets/visuals/#{image}-640.webp" srcset="/assets/visuals/#{image}-640.webp 640w, /assets/visuals/#{image}-1280.webp 1280w" sizes="(max-width:760px) 92vw, 40vw" width="1280" height="720" loading="lazy" decoding="async" alt="#{esc(alt)}"><div><small>#{eyebrow}</small><h3>#{title}</h3><p>#{body}</p><a href="#{month_url(y,month)}">Atverti mėnesio kalendorių #{ui_icon('arrow')}</a></div></article>)
  }.join+'</div><p class="illustration-note">Originalios Kalendorius365 iliustracijos, sukurtos pasitelkiant generatyvinę vaizdų kūrybą. Tai interpretaciniai Lietuvos tradicijų motyvai.</p>'
 end
 def visual_html(path,html)
  # Consistent semantic icons on real actions; no extra inactive controls.
  {'Atsisiųsti PDF'=>'download','Atsisiųsti WebP'=>'image','Atidaryti PDF spausdinimui ↗'=>'print','Spausdinti metų apžvalgą'=>'print','Spausdinti lentelę'=>'print','Atsisiųsti CSV suvestinę'=>'download','Spausdinti / Išsaugoti PDF'=>'print','Skaičiuoti'=>'calendar'}.each do |label,icon|
   html=html.gsub('>'+label+'</','>'+ui_icon(icon)+label+'</')
  end
  html=html.gsub('>▦ ', '>'+ui_icon('calendar'))
  html=html.gsub(/<div class="resource-stats">(.*?)<\/div><\/div>/m) do |block|
   index=0;block.gsub('<div><strong>') { name=%w[calendar clock briefcase][index%3];index+=1;'<div>'+ui_icon(name)+'<strong>' }
  end
  html=html.gsub(/<span class="badge">([^<]+): <strong>(.*?)<\/strong><\/span>/) do
   label=$1;value=$2;symbol=label.include?('Darbo') ? 'briefcase' : label.include?('Švent') ? 'gift' : label.include?('Savaitgalio') ? 'clock' : 'calendar'
   '<span class="badge">'+ui_icon(symbol)+'<span>'+label+'<strong>'+value+'</strong></span></span>'
  end
  html=html.gsub(/(<article class="design-card"[^>]*data-style="(bw|color)".*?<div class="design-info"><h2>.*?<\/h2>)/m) { $1+'<span class="design-style">'+($2=='bw' ? 'Juodai baltas · A4' : 'Spalvotas · A4')+'</span>' }
  # Selected card is visible before JavaScript, without opening collapsed previews.
  selected=html[/<option value="([^"]+)" selected>/,1]
  html=html.sub('class="design-card" id="dizainas-'+selected+'"','class="design-card selected-design" id="dizainas-'+selected+'"') if selected
  html=html.gsub('>PDF</a>','>'+ui_icon('pdf')+'PDF</a>').gsub('>WebP</a>','>'+ui_icon('image')+'WebP</a>')
  if path.match?(%r{\Asventes/202[789]\z})
   html=html.sub('<h2>Kitos datos</h2>',holiday_stories(path.split('/').last.to_i)+'<h2>Kitos datos</h2>')
  elsif path.match?(/\A202[789]\z/)
   html=html.sub('<h2>Metinė šablonų kolekcija</h2>','<div class="annual-accent"><span><img src="/assets/visuals/brand-mark.svg" width="30" height="34" alt="" aria-hidden="true">Dvylika mėnesių. Vieta visiems jūsų planams.</span></div><h2>Metinė šablonų kolekcija</h2>')
   html=html.sub('<div class="year-grid annual-sheet">',metric_cards([[Date.gregorian_leap?(path.to_i) ? 366 : 365,'Dienos šiais metais'],[12,'Mėnesių kolekcijų'],[10,'Metinių dizainų']])+'<div class="year-grid annual-sheet">')
  elsif path=='tuscias-kalendorius'
   intro='<div class="library-intro">'+[['calendar','Laisva pradžia','Nedatuoti mėnesio lapai – pradėkite tada, kada patogu.'],['briefcase','Aiški savaitė','Darbai, susitikimai ir prioritetai viename lape.'],['book','Šeimai ir mokyklai','Bendri planai, pamokos ir vieta kiekvieno užrašams.']].map { |i,t,p|'<div>'+ui_icon(i)+'<h3>'+t+'</h3><p>'+p+'</p></div>' }.join+'</div>'
   html=html.sub('<div class="design-filters',intro+'<div class="design-filters')
  elsif path=='mokiniu-atostogos'
   html=html.sub('<div class="resource-stats">','<div class="school-note">'+ui_icon('book')+'<div><h2>Ramesnis mokslo metų planas</h2><p>Patvirtinti atostogų laikotarpiai ir nedatuoti mokymosi planuokliai.</p></div></div><div class="resource-stats">')
  elsif path=='kurti-kalendoriu'
   html=html.sub('<label>Metai<input','<fieldset class="control-section"><legend>'+ui_icon('calendar')+'Laikotarpis</legend><label>Metai<input')
   html=html.sub('<label>Tema<select','</fieldset><fieldset class="control-section"><legend>'+ui_icon('palette')+'Dizainas</legend><label>Tema<select')
   html=html.sub('<label>Pavadinimas (nebūtinas)','</fieldset><fieldset class="control-section"><legend>'+ui_icon('note')+'Jūsų turinys</legend><label>Pavadinimas (nebūtinas)')
   html=html.sub('<p id="generator-limits"','</fieldset><p id="generator-limits"')
  end
  # Wide data tables remain horizontally scrollable with a keyboard on mobile.
  html.gsub('<div class="table-scroll">','<div class="table-scroll" tabindex="0" role="region" aria-label="Slenkama duomenų lentelė">')
 end
end
