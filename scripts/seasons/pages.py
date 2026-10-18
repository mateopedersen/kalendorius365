"""Build five progressively enhanced Lithuanian seasonal guides; no network at build."""
from pathlib import Path
from html import escape as esc
from datetime import datetime
import json,hashlib
import artwork
ROOT=Path(__file__).resolve().parents[2]
D=json.loads((ROOT/'site/assets/data/seasons.json').read_text())
IDS=['spring','summer','autumn','winter']
SLUGS=['pavasario-lygiadienis','vasaros-saulegriza','rudens-lygiadienis','ziemos-saulegriza']
NAMES=['Pavasario lygiadienis','Vasaros saulėgrįža','Rudens lygiadienis','Žiemos saulėgrįža']
SEASONS=['Pavasaris','Vasara','Ruduo','Žiema']
SHORT=['Daugiau šviesos','Ilgiausios dienos','Trumpėjančios dienos','Šviesos sugrįžimas']
INTRO=[
 'Saulė kerta dangaus pusiaują į šiaurę. Šiaurės pusrutulyje prasideda astronominis pavasaris, o dienos sparčiai ilgėja.',
 'Saulė pasiekia šiauriausią padėtį dangaus pusiaujo atžvilgiu. Šiaurės pusrutulyje prasideda astronominė vasara ir stoja ilgiausių dienų metas.',
 'Saulė kerta dangaus pusiaują į pietus. Šiaurės pusrutulyje prasideda astronominis ruduo, o šviesus paros metas trumpėja.',
 'Saulė pasiekia piečiausią padėtį dangaus pusiaujo atžvilgiu. Šiaurės pusrutulyje prasideda astronominė žiema ir trumpiausių dienų metas.'
]
MEANING=[
 ('Ar diena tikrai lygi nakčiai?', 'Lygiadienį Saulės centras kerta dangaus pusiaują. Diena tarp saulėtekio ir saulėlydžio paprastai trunka kiek ilgiau nei 12 valandų: atmosferos refrakcija ir Saulės disko dydis pailgina matomą dieną. Tikslios dienos ir nakties lygybės data priklauso nuo vietos.'),
 ('Kodėl po saulėgrįžos dar šyla?', 'Ilgiausia metų diena nebūtinai būna karščiausia. Žemės paviršius ir vanduo šilumą kaupia palaipsniui, todėl temperatūros eiga vėluoja. Ties saulėgrįža dienos ilgumas keičiasi lėtai; vėliau dienos trumpėja.'),
 ('Ką reiškia rudens lygiadienis?', 'Lygiadienis apibrėžiamas Saulės padėtimi, o ne temperatūra ar lapų spalva. Diena dėl atmosferos refrakcijos ir matomo Saulės disko dar nėra tiksliai lygi nakčiai. Orų permainos kasmet vyksta savu ritmu.'),
 ('Kada pradeda ilgėti dienos?', 'Ties žiemos saulėgrįža dienos ilgumas kinta labai lėtai, paskui ima didėti. Ankstyviausias saulėlydis ir vėlyviausias saulėtekis nebūtinai sutampa su saulėgrįža: tam įtakos turi netolygi Saulės laiko eiga.')
]
CULTURE=[
 ('Pavasario kalendorius', 'Velykos yra kilnojamoji šventė, todėl jų data nėra lygiadienio data. Šventės papročius ir konkrečių metų datą rasite atskirame Velykų gide.', '/sventes/velykos/','Velykų data ir papročiai','https://www.ekgt.lt/globali-lietuva-ir-tautine-tapatybe/kalendoriniai-paprociai/velykos.html'),
 ('Rasos ir Joninės', 'Lietuvoje Joninės švenčiamos birželio 24-ąją. Rasų ir Joninių papročiai siejami su vasarvidžiu, tačiau šventės kalendorinė data ir astronominės saulėgrįžos momentas nesutampa.', '/sventes/jonines/','Joninių data ir Rasų tradicijos','https://ekgt.lt/veiklos-sritys/gidai/vasara/rasos--jonines.html'),
 ('Rudens atminties dienos', 'Lapkričio 2-ąją minimos Vėlinės priklauso vėlyvo rudens tradicijų kalendoriui. Tai atskira atminimo diena, o ne astronominio rudens pradžia.', '/sventes/velines/','Vėlinių data ir tradicijos','https://www.ekgt.lt/globali-lietuva-ir-tautine-tapatybe/kalendoriniai-paprociai/velines.html'),
 ('Kūčios ir Kalėdos', 'Kūčios minimos gruodžio 24-ąją, Kalėdos – gruodžio 25–26 dienomis. Žiemos švenčių papročius verta pažinti atskirai nuo astronominio saulėgrįžos momento.', '/sventes/kucios/','Kūčių data ir papročiai','https://ekgt.lt/globali-lietuva-ir-tautine-tapatybe/kalendoriniai-paprociai/kucios.html')]
MONTH_SLUGS=['sausis','vasaris','kovas','balandis','geguze','birzelis','liepa','rugpjutis','rugsejis','spalis','lapkritis','gruodis']
def event(id,year=2027):return next(e for e in D['events']if e['id']==id and e['year']==year)
def icon(name):return f'<svg class="sp3-icon" aria-hidden="true" focusable="false"><use href="/assets/visuals/seasons/controls.svg#{name}"></use></svg>'
def duration(n):return f'{n//60} val. {n%60:02d} min.'
def path(values):return ' '.join(f'{"M"if i==0 else "L"}{i/(len(values)-1)*1000:.2f},{250-v/1440*250:.2f}'for i,v in enumerate(values))
def chart(values,kind,label,mark=None):
 p=path(values);marker=''if mark is None else f'<line data-mark x1="{mark:.2f}" x2="{mark:.2f}" y1="0" y2="250" class="sp3-mark"/>'
 return f'<div class="sp3-chart" data-chart="{kind}"><div class="sp3-axis"><span>24 val.</span><span>12 val.</span><span>0 val.</span></div><svg viewBox="0 0 1000 250" preserveAspectRatio="none" role="img" aria-label="{label}"><path d="M0 0H1000M0 125H1000M0 250H1000" class="sp3-grid"/><path data-area d="{p}L1000,250L0,250Z" class="sp3-area"/><path data-line d="{p}" class="sp3-line"/>{marker}</svg></div>'
def controls():return '<form class="sp3-selects" aria-label="Metų ir miesto pasirinkimas"><label for="sp3-year">Metai<select id="sp3-year" name="metai" disabled>'+''.join(f'<option value="{y}">{y}</option>'for y in D['years'])+'</select></label><label for="sp3-city">Miestas<select id="sp3-city" name="miestas" disabled>'+''.join(f'<option value="{c["id"]}">{c["name"]}</option>'for c in D['cities'])+'</select></label></form><p id="sp3-status" class="sp3-note" role="status">Pasirinkta: Vilnius · 2027 m. Laikas – Europe/Vilnius.</p>'
def icslink(id=None,year=2027,cls='sp3-button'):
 slug=SLUGS[IDS.index(id)]if id else 'metu-laikai'
 return f'<a class="{cls}" data-ics="{id or "all"}" href="/assets/seasons-ics/{year}-{slug}.ics" download>{icon("download")}<span>{"Šis momentas"if id else "Visi keturi momentai"} · <span data-year>{year}</span> · ICS</span></a>'
def comparison(id=None):
 header='<th scope="col">Metai</th>'+(''.join(f'<th scope="col"><a href="/{slug}/">{name}</a></th>'for slug,name in zip(SLUGS,NAMES))if id is None else '<th scope="col">Data Lietuvoje</th><th scope="col">Vietos laikas</th><th scope="col">UTC poslinkis</th>')
 rows=[]
 for y in D['years']:
  es=[event(s,y)for s in IDS]if id is None else [event(id,y)]
  cells=''.join(f'<td><time datetime="{e["utc"]}">{e["label"]}<br><strong>{e["clock"]}</strong> <small>{e["offset"]}</small></time></td>'for e in es)if id is None else f'<td>{es[0]["label"]}</td><td><time datetime="{es[0]["utc"]}">{es[0]["clock"]}</time></td><td>{es[0]["offset"]}</td>'
  rows.append(f'<tr><th scope="row">{y}</th>{cells}</tr>')
 return '<section class="sp3-section" id="datos"><div class="sp3-heading"><div><span class="sp3-eyebrow">Vienas momentas visai Žemei</span><h2>2027–2029 m. datų palyginimas</h2></div></div><p class="sp3-note sp3-table-hint">Siaurame ekrane lentelę galite slinkti į šoną.</p><div class="sp3-table-wrap" tabindex="0" role="region" aria-label="Astronominių datų palyginimas"><table><caption>Lygiadieniai ir saulėgrįžos Lietuvos vietos laiku; USNO, minučių tikslumu.</caption><thead><tr>'+header+'</tr></thead><tbody>'+''.join(rows)+'</tbody></table></div><p class="sp3-note">'+('2028 m. vasaros saulėgrįža Lietuvoje įvyks birželio 20 d. '+''if id is None or id=='summer'else '')+'Datos perskaičiuotos į Europe/Vilnius laiko juostą, įvertinus vasaros laiką. <a href="#saltiniai">Šaltiniai ir metodika</a>.</p></section>'
def diagram(id='spring'):
 i=IDS.index(id);e=event(id)
 buttons=''.join(f'<button type="button" data-step="{j}" aria-pressed="{"true"if i==j else "false"}" disabled><span class="sp3-step-number">0{j+1}</span><span>{SEASONS[j]}</span></button>'for j in range(4))
 return f'''<section class="sp3-section" id="zemes-asies-pasvirimas"><div class="sp3-heading"><div><span class="sp3-eyebrow">Šviesos geometrija</span><h2>Kaip Žemės ašies pasvirimas keičia metų laikus?</h2><p>Metų laikus lemia apie 23,4° pasvirusi Žemės ašis, ne atstumas iki Saulės.</p></div></div><div class="sp3-science"><figure class="sp3-orbit-figure">{artwork.orbit(i)}<figcaption>Žemės ašys išlieka lygiagrečios. Orbita parodyta perspektyvoje; dydžiai ir atstumai nėra vienodo mastelio.</figcaption></figure><div class="sp3-earth-panel"><figure><img id="sp3-earth" src="/assets/visuals/seasons/{id}-earth.svg" width="500" height="460" alt="{esc(NAMES[i])}: Žemės apšvietimo schema" loading="lazy"><figcaption>Saulės šviesa – iš kairės. Vaizdo kryptis kinta pagal metų laiką; tikrasis ašies pasvirimas nekinta. Žemynai apibendrinti.</figcaption></figure><p class="sp3-eyebrow" id="sp3-diagram-name">{NAMES[i]}</p><p id="sp3-diagram-time">{e['label']} · {e['clock']} · {e['offset']}</p></div></div><div class="sp3-steps" role="group" aria-label="Pasirinkti astronominį metų laiką">{buttons}</div><div class="sp3-play-row"><button type="button" id="sp3-play" aria-pressed="false" disabled>{icon('play')}<span>Paleisti metų ciklą</span></button><p class="sp3-note">Schema keičia tik paaiškinimo vaizdą. Pasirinkto gido datos ir miesto duomenys lieka savo vietose.</p></div><p id="sp3-diagram-status" class="visually-hidden" role="status"></p></section>'''
def annual(id=None):
 v=D['annual']['2027']['vilnius'];marker=None if id is None else (datetime.fromisoformat(event(id)['date']).timetuple().tm_yday-1)/(len(v['curve'])-1)*1000
 monthrows=''.join(f'<tr><th scope="row">{n+1:02d}-15</th><td>{duration(v["curve"][(datetime(2027,n+1,15)-datetime(2027,1,1)).days])}</td></tr>'for n in range(12))
 return f'''<section class="sp3-section" id="dienos-sviesa"><div class="sp3-heading"><div><span class="sp3-eyebrow">Nuo žiemos iki vasaros ir atgal</span><h2>Kaip per metus kinta dienos ilgumas?</h2><p data-annual-caption>2027 m. · Vilnius · laikas nuo saulėtekio iki saulėlydžio</p></div><div class="sp3-range"><span>Trumpiausia trukmė <strong data-min>{duration(v['min'])}</strong></span><span>Ilgiausia trukmė <strong data-max>{duration(v['max'])}</strong></span></div></div>{chart(v['curve'],'annual','Dienos šviesos trukmė per visus metus. Vertikali skalė nuo 0 iki 24 valandų.',marker)}<div class="sp3-xlabels"><span>Sausis</span><span>Balandis</span><span>Liepa</span><span>Spalis</span><span>Gruodis</span></div><p class="sp3-note">Vienoda 0–24 val. skalė leidžia palyginti miestus ir metus.{" Punktyrinė žyma – pasirinkto įvykio diena."if id else ""} Apytikslis skaičiavimas miesto centrui; atmosfera ir reljefas gali pakeisti stebimą laiką.</p><details><summary>Dienos šviesos lentelė: kiekvieno mėnesio 15 diena</summary><table><caption data-annual-table-caption>2027 m., Vilnius – mėnesių palyginimas</caption><thead><tr><th scope="col">Data (mėnuo–diena)</th><th scope="col">Dienos šviesa</th></tr></thead><tbody data-annual-rows>{monthrows}</tbody></table></details></section>'''
def city_context(id):
 c=D['contexts'][id+'-2027']['vilnius'];today=c['days'][7]
 metrics=''.join(f'<div class="sp3-metric">{icon(ic)}<span>{label}</span><strong data-metric="{key}">{value}</strong></div>'for ic,label,key,value in [('sunrise','Saulėtekis','rise',today[1]),('daylight','Dienos šviesa','length',duration(today[3])),('sunset','Saulėlydis','set',today[2])])
 rows=''.join(f'<tr><th scope="row">{row[0]}</th><td>{row[1]}</td><td>{row[2]}</td><td>{duration(row[3])}</td></tr>'for row in c['days'])
 delta=(f'Laikotarpio pabaigoje – {abs(c["delta"])} min. '+('daugiau'if c['delta']>0 else 'mažiau')+' dienos šviesos nei pradžioje.')if c['delta'] else 'Laikotarpio pradžioje ir pabaigoje dienos šviesos trukmė sutampa, suapvalinus iki minutės.'
 return f'''<section class="sp3-section" id="miesto-laikai"><div class="sp3-heading"><div><span class="sp3-eyebrow">Vietos šviesa</span><h2>Kiek trunka diena jūsų mieste?</h2><p data-context-caption>2027 m. · Vilnius · {event(id)['label']}</p></div><a href="/saule/" class="sp3-text-link">Kitų datų Saulės skaičiuoklė {icon('arrow')}</a></div><div class="sp3-metrics">{metrics}</div><div class="sp3-chart-heading"><h3>Dienos ilgumas prieš reiškinį ir po jo</h3><p data-delta>{delta}</p></div>{chart([row[3]for row in c['days']],'around','Dienos šviesos trukmė septynias dienas prieš įvykį ir septynias po jo.',500)}<div class="sp3-xlabels"><span data-around-start>{c['days'][0][0]}</span><span>Įvykio diena</span><span data-around-end>{c['days'][-1][0]}</span></div><p class="sp3-note">Saulėtekio ir saulėlydžio laikai nėra lygiadienio ar saulėgrįžos momentas. Jie priklauso nuo miesto. Ties saulėgrįža minučių apvalinimas gali paslėpti labai mažą dienos ilgumo pokytį.</p><details><summary>Atverti visų 15 dienų Saulės laikus</summary><div class="sp3-table-wrap" tabindex="0" role="region" aria-label="Penkiolikos dienų Saulės laikų lentelė"><table><caption data-around-table-caption>2027 m., Vilnius – septynios dienos prieš įvykį ir po jo</caption><thead><tr><th scope="col">Data</th><th scope="col">Saulėtekis</th><th scope="col">Saulėlydis</th><th scope="col">Dienos šviesa</th></tr></thead><tbody data-around-rows>{rows}</tbody></table></div></details></section>'''
def sources(id=None):
 culture=''if id is None else f'<li><a href="{CULTURE[IDS.index(id)][4]}">Etninės kultūros globos taryba: {CULTURE[IDS.index(id)][0].lower()}</a> – kultūrinis kontekstas.</li>'
 return f'''<section class="sp3-section sp3-sources" id="saltiniai"><span class="sp3-eyebrow">Patikrinama kilmė</span><h2>Šaltiniai ir skaičiavimo ribos</h2><p>Parengė Kalendorius365. Astronominės datos patikrintos 2026-10-17; laikas pateiktas minučių tikslumu. Pirminiai USNO duomenys palyginti su nepriklausoma Fredo Espenako lentele: skirtumai neviršija vienos minutės.</p><ul><li><a href="https://aa.usno.navy.mil/data/Earth_Seasons">JAV karinio jūrų laivyno observatorija (USNO)</a> – astronominių metų laikų momentai UTC; perskaičiuota į Europe/Vilnius.</li><li><a href="https://www.astropixels.com/ephemeris/soleq2001.html">Fredas Espenakas, AstroPixels: lygiadienių ir saulėgrįžų lentelė</a> – nepriklausoma patikra. Lygiadienių ir saulėgrįžų lentelė: Fredas Espenakas, www.Astropixels.com.</li><li><a href="https://spaceplace.nasa.gov/seasons/en/">NASA: kodėl keičiasi metų laikai</a> – ašies pasvirimo paaiškinimas.</li><li><a href="https://www.ncei.noaa.gov/news/meteorological-versus-astronomical-seasons">NOAA: astronominiai ir meteorologiniai metų laikai</a>; <a href="https://www.meteo.lt/app/uploads/2024/10/Klimato-Atlasas.pdf">LHMT: Lietuvos klimato atlasas</a> – kalendorinių ir terminių ribų skirtumas.</li>{culture}</ul><p class="sp3-note">Saulės laikams naudojama ta pati skaičiavimo sistema kaip <a href="/saule/">Saulės įrankyje</a>: standartinis −0,833° horizonto kampas ir miesto centro koordinatės. Reljefas, pastatai ir faktiniai orai neįvertinami. Koordinatės – <a href="https://www.geonames.org/">GeoNames</a>, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>; penkių miestų centrai. Iliustracijos – originalūs Kalendorius365 vektoriniai kūriniai, ne vietovės nuotraukos.</p></section>'''
def related(id=None):
 links=[('/saule/','Saulėtekis ir saulėlydis','Data, miestas ir Saulės kelias.'),('/menulio-kalendorius/','Mėnulio kalendorius','Kasdieniai vaizdai ir spaudiniai.'),('/menulio-fazes/','Mėnulio fazės','Jaunatis, ketvirčiai ir pilnatis.'),('/astronominis-kalendorius/','Astronominis kalendorius','Saulės ir Mėnulio datos kartu.')]
 return '<section class="sp3-section"><h2>Toliau tyrinėkite kalendorių</h2><div class="sp3-related">'+''.join(f'<a href="{u}"><strong>{t}</strong><span>{s}</span>{icon("arrow")}</a>'for u,t,s in links)+'</div></section>'
def front(slug,title,description,body,id=None):
 out=ROOT/'site'/slug/'index.html';out.parent.mkdir(parents=True,exist_ok=True)
 url='https://kalendorius365.lt/'+slug+'/'
 ld={'@context':'https://schema.org','@type':'WebPage','@id':url+'#webpage','url':url,'name':title,'description':description,'inLanguage':'lt-LT','dateModified':'2026-10-17','publisher':{'@type':'Organization','name':'Kalendorius365','url':'https://kalendorius365.lt/'},'citation':['https://aa.usno.navy.mil/data/Earth_Seasons','https://spaceplace.nasa.gov/seasons/en/']}
 fm={'layout':'default','title':title,'description':description,'seasons':True,'season_event':id or False,'breadcrumb_label':NAMES[IDS.index(id)]if id else 'Metų laikai','og_image':f'/assets/visuals/seasons/{id or "hub"}-1200x630.png','og_image_alt':title+' – originali metų laikų iliustracija'}
 header='---\n'+''.join(k+': '+json.dumps(v,ensure_ascii=False)+'\n'for k,v in fm.items())+'---\n'
 stamp=hashlib.sha256((ROOT/'site/assets/data/seasons.json').read_bytes()).hexdigest()[:12]
 out.write_text(header+f'<div class="sp3 sp3--{id or "hub"}" data-season="{id or "hub"}" data-source="/assets/data/seasons.json?v={stamp}">'+body+'</div>\n<script type="application/ld+json">'+json.dumps(ld,ensure_ascii=False)+'</script>\n')
def build_event(id):
 i=IDS.index(id);e=event(id);prev=(i-1)%4;nxt=(i+1)%4;cult=CULTURE[i]
 hero=f'''<header class="sp3-hero"><div class="sp3-hero-copy"><span class="sp3-eyebrow">Astronominiai metų laikai · Lietuva</span><h1>{NAMES[i]}</h1><p class="sp3-lead">{INTRO[i]}</p><div class="sp3-answer"><span>Astronominis momentas Lietuvoje</span><strong data-event-date>{e['label']}</strong><div><time data-event-clock datetime="{e['utc']}">{e['clock']}</time><span data-event-offset>{e['offset']} · Europe/Vilnius</span></div></div>{icslink(id)}<a class="sp3-text-link" href="#datos">Palyginti 2027–2029 metus {icon('arrow')}</a></div><figure class="sp3-hero-art"><img src="/assets/visuals/seasons/{id}-landscape.svg" width="1200" height="800" alt="{artwork.PALETTES[id]['name']} Lietuvoje: stilizuotas ežeras ir sezoninė šviesa" fetchpriority="high"><figcaption><span>0{i+1} / 04</span>{SEASONS[i]} · {SHORT[i]}</figcaption></figure></header>'''
 nextblock=f'''<section class="sp3-next" aria-labelledby="sp3-next-title">{icon('clock')}<div><h2 id="sp3-next-title">Kitas šio reiškinio momentas</h2><p id="sp3-next-date">Įjunkite JavaScript, kad matytumėte artimiausią datą pagal savo įrenginio laiką.</p></div><p id="sp3-countdown" class="sp3-countdown" aria-live="off">Patikrintos datos: 2026–2030 m.</p><a id="sp3-next-ics" hidden download>Į kalendorių · ICS</a></section>'''
 meaning=f'<section class="sp3-explainer"><span>{icon("daylight")}</span><div><h2>{MEANING[i][0]}</h2><p>{MEANING[i][1]}</p></div></section>'
 culture=f'''<section class="sp3-culture sp3-section"><div><span class="sp3-eyebrow">Lietuvos tradicijų kalendorius</span><h2>{cult[0]}</h2><p>{cult[1]}</p><a class="sp3-text-link" href="{cult[2]}">{cult[3]} {icon('arrow')}</a></div><div class="sp3-culture-aside">{icon('tradition')}<strong>Astronomija ir tradicija</strong><p>Astronominis momentas skaičiuojamas. Šventės data ir papročiai priklauso kultūros kalendoriui.</p><a data-month-link href="/sventes/2027/{MONTH_SLUGS[int(e['date'][5:7])-1]}/">2027 m. šio mėnesio šventės</a></div></section>'''
 nav=f'<nav class="sp3-prevnext" aria-label="Kiti metų ciklo reiškiniai"><a href="/{SLUGS[prev]}/">{icon("previous")}<span><small>Ankstesnis ciklo reiškinys</small><strong>{NAMES[prev]}</strong></span></a><a href="/{SLUGS[nxt]}/"><span><small>Kitas ciklo reiškinys</small><strong>{NAMES[nxt]}</strong></span>{icon("arrow")}</a></nav>'
 body=hero+nextblock+meaning+controls()+city_context(id)+comparison(id)+diagram(id)+annual(id)+culture+nav+related(id)+sources(id)
 front(SLUGS[i],NAMES[i]+' 2027–2029 m. – datos ir laikas Lietuvoje',f'{NAMES[i]}: patikrintos 2027–2029 m. datos Lietuvos laiku, dienos šviesos palyginimas penkiuose miestuose, Žemės schema ir ICS kalendoriui.',body,id)
def build_hub():
 hero='''<header class="sp3-hero sp3-hero--hub"><div class="sp3-hero-copy"><span class="sp3-eyebrow">Lietuvos metų ritmas</span><h1>Metų laikai Lietuvoje: <br>datos ir dienos ilgumas.</h1><p class="sp3-lead">Sužinokite, kada prasideda astronominiai metų laikai, kaip kinta dienos ilgumas ir kuo šis skirstymas skiriasi nuo meteorologinių metų laikų.</p><div class="sp3-hub-facts"><span><strong>4</strong> metų laikų pradžios</span><span><strong>3</strong> palyginami metai</span><span><strong>5</strong> Lietuvos miestai</span></div><a class="sp3-button" href="#metu-juosta">Metų datos ir šviesa '''+icon('arrow')+'''</a></div><figure class="sp3-hero-art sp3-mosaic">'''+''.join(f'<img src="/assets/visuals/seasons/{s}-landscape.svg" width="1200" height="800" alt="{SEASONS[i]}: originali Lietuvos gamtos iliustracija">'for i,s in enumerate(IDS))+'''<figcaption>Pavasaris · vasara · ruduo · žiema</figcaption></figure></header>'''
 cards='<section class="sp3-section"><div class="sp3-heading"><div><span class="sp3-eyebrow">Pasirinkite metų laiką</span><h2>Kada prasideda astronominiai metų laikai?</h2></div><a href="#datos">Visos datos vienoje lentelėje</a></div><div class="sp3-season-cards">'+''.join(f'<a class="sp3-season-card sp3--{s}" href="/{SLUGS[i]}/"><img src="/assets/visuals/seasons/{s}-landscape.svg" width="1200" height="800" alt="{SEASONS[i]}: ežero ir gamtos vaizdas" loading="lazy"><div><span class="sp3-eyebrow">0{i+1} · {SHORT[i]}</span><h3>{NAMES[i]}</h3><p data-card-time="{s}">{event(s)["label"]} · {event(s)["clock"]}</p><span class="sp3-text-link">{SEASONS[i]} iš arčiau {icon("arrow")}</span></div></a>'for i,s in enumerate(IDS))+'</div></section>'
 timeline='<section class="sp3-section" id="metu-juosta"><div class="sp3-heading"><div><span class="sp3-eyebrow">Astronominiai metų laikai</span><h2><span data-year>2027</span> m. šviesos kalendorius</h2></div>'+icslink()+'</div>'+controls()+'<ol class="sp3-timeline">'+''.join(f'<li class="sp3--{s}"><span class="sp3-timeline-dot" aria-hidden="true"></span><h3><a href="/{SLUGS[i]}/">{SEASONS[i]}</a></h3><p data-timeline="{s}">{event(s)["label"]}<br><strong>{event(s)["clock"]}</strong> · {event(s)["offset"]}</p></li>'for i,s in enumerate(IDS))+'</ol></section>'
 system='''<section class="sp3-section" id="dvi-sistemos"><span class="sp3-eyebrow">Skirtingos ribos, skirtinga paskirtis</span><h2>Kada iš tiesų prasideda metų laikas?</h2><div class="sp3-systems"><article><span>01 · Dangaus momentas</span><h3>Astronominiai metų laikai</h3><p>Prasideda lygiadieniais ir saulėgrįžomis. Datos bei valandos kasmet truputį kinta. Čia pateikiami Šiaurės pusrutulio metų laikai; Pietų pusrutulyje jie priešingi.</p></article><article><span>02 · Kalendorinė tvarka</span><h3>Meteorologinis trijų mėnesių skirstymas</h3><dl><dt>Pavasaris</dt><dd>Kovas–gegužė</dd><dt>Vasara</dt><dd>Birželis–rugpjūtis</dd><dt>Ruduo</dt><dd>Rugsėjis–lapkritis</dd><dt>Žiema</dt><dd>Gruodis–vasaris</dd></dl></article></div><p class="sp3-note">Trijų mėnesių skirstymas patogus klimato duomenims lyginti. Lietuvos klimato aprašymuose taip pat vartojami <strong>terminiai metų laikai</strong>, kurių ribos nustatomos pagal temperatūrą, todėl jos kasmet kinta. Kalendorinė birželio 1-oji nebūtinai reiškia terminės vasaros pradžią. <a href="#saltiniai">NOAA ir LHMT šaltiniai</a>.</p></section>'''
 culture='<section class="sp3-section"><h2>Metų laikai Lietuvos švenčių kalendoriuje</h2><div class="sp3-related">'+''.join(f'<a href="{c[2]}"><strong>{c[0]}</strong><span>Tradicijos ir kalendorinė data</span>{icon("arrow")}</a>'for c in CULTURE)+'</div></section>'
 front('metu-laikai','Metų laikai Lietuvoje: datos 2027–2029 m.','Astronominiai ir meteorologiniai metų laikai Lietuvoje. 2027–2029 m. lygiadienių ir saulėgrįžų datos, dienos šviesos grafikai, miestai ir ICS.',hero+cards+timeline+comparison()+system+diagram()+annual()+culture+related()+sources())
def ics():
 def val(v):return v.replace('\\','\\\\').replace('\n','\\n').replace(';','\\;').replace(',','\\,')
 def fold(line):
  result=[];part='';size=0
  for c in line:
   n=len(c.encode())
   if size+n>75:result.append(part);part=' ';size=1
   part+=c;size+=n
  return '\r\n'.join(result+[part])
 out=ROOT/'site/assets/seasons-ics';out.mkdir(parents=True,exist_ok=True)
 def make(es):
  lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Kalendorius365//Astronominiai metu laikai//LT','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Lygiadieniai ir saulėgrįžos']
  for e in es:
   slug=SLUGS[IDS.index(e['id'])];stamp=e['utc'].replace('-','').replace(':','')
   lines+=['BEGIN:VEVENT',f'UID:{e["year"]}-{slug}@kalendorius365.lt','DTSTAMP:20261017T000000Z','DTSTART:'+stamp,'SUMMARY:'+e['name'],'DESCRIPTION:'+val(f'Astronominis momentas. Lietuvoje: {e["label"]} {e["clock"]} ({e["offset"]}; Europe/Vilnius). Šaltinis: USNO. Minučių tikslumu.'),'URL:https://kalendorius365.lt/'+slug+'/','TRANSP:TRANSPARENT','END:VEVENT']
  return '\r\n'.join(fold(l)for l in lines+['END:VCALENDAR'])+'\r\n'
 for e in D['events']:(out/f'{e["year"]}-{SLUGS[IDS.index(e["id"])]}.ics').write_bytes(make([e]).encode())
 for y in D['years']:(out/f'{y}-metu-laikai.ics').write_bytes(make([event(s,y)for s in IDS]).encode())
def integrations(root=ROOT):
 # These pages are freshly regenerated upstream on every build; insertion is idempotent.
 for route in ['saule','irankiai','astronominis-kalendorius']:
  p=root/'site'/route/'index.html';text=p.read_text();start='<!-- phase3-related -->';end='<!-- /phase3-related -->'
  if start in text:
   before,remainder=text.split(start,1);after=remainder.split(end,1)[1]
   text=before.rstrip('\n')+'\n'+after.lstrip('\n')
  if route=='astronominis-kalendorius':
   rows=''.join('<tr><th scope="row">'+str(y)+'</th>'+''.join(f'<td>{event(s,y)["label"]} {event(s,y)["clock"]}</td>'for s in IDS)+'</tr>'for y in D['years'])
   text=text.replace('<tbody id="season-rows"></tbody>','<tbody id="season-rows">'+rows+'</tbody>')
  block=f'{start}<section class="panel"><h2>Metų laikai ir dienos ilgumas</h2><p><a href="/metu-laikai/">Lygiadieniai, saulėgrįžos ir metų laikai Lietuvoje</a>: patikrintos 2027–2029 m. datos, interaktyvios Žemės schemos, penkių miestų dienos šviesa ir kalendoriaus failai.</p></section>{end}'
  p.write_text(text.rstrip('\n')+'\n'+block+'\n')
if __name__=='__main__':
 artwork.run();ics();build_hub()
 for s in IDS:build_event(s)
 integrations()
 print('Seasons: five Lithuanian pages, nine original vector files, 23 UTC calendar exports; three existing entry points integrated.')
