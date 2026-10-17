"""Generate crawlable Lithuanian lunar pages from the checked ephemeris/manifest."""
from __future__ import annotations
import calendar,csv,html,json
from datetime import datetime
from core import ROOT,MONTHS,GENITIVE,SLUGS,WEEKDAYS,PRIMARY,STAGES,load_data

D=load_data()
A=json.loads((ROOT/'data/lunar/assets.json').read_text())['assets']
E=html.escape

def pct(value):
    return f'{value*100:.1f}'.replace('.',',')

def page(route,title,description,body):
    p=ROOT/'site'/route/'index.html';p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text('---\n'+f'title: {json.dumps(title,ensure_ascii=False)}\ndescription: {json.dumps(description,ensure_ascii=False)}\nlunar: true\nog_image: /assets/lunar/menulio-kalendorius-1200x630.png\nog_image_alt: "Mėnulio paviršiaus vizualizacija ir lietuviškas 2027–2029 metų Mėnulio kalendoriaus pavadinimas."\n'+'---\n'+f'<div class="lunar-app">{body}</div>\n')

def years(selected=None):
    return '<nav class="lunar-years" aria-label="Mėnulio kalendoriaus metai">'+''.join(f'<a href="/menulio-kalendorius/{y}/"'+(' aria-current="true"' if y==selected else '')+f'>{y}<span> metų kalendorius</span></a>' for y in (2027,2028,2029))+'</nav>'

def methodology():
    return '''<section class="lunar-method" aria-labelledby="lunar-method-title"><p class="lunar-eyebrow">Skaičiavimai ir šaltiniai</p><h2 id="lunar-method-title">Tikros datos. Aiškiai paaiškintas vaizdas.</h2><div class="lunar-method-grid"><div><h3>Ką rodo dienos diskas?</h3><p>Spausdinamas ir kalendoriaus langelyje pateiktas Mėnulio vaizdas apskaičiuotas 12:00 Lietuvos laiku. Pagrindinė fazė yra konkreti akimirka, todėl jos momentas ir vidurdienio disko vaizdas gali nesutapti. Interaktyvus šiandienos vaizdas skaičiuojamas dabartiniam momentui.</p><p>Vizualizacijoje šiaurė yra viršuje: augančio Mėnulio apšviesta dešinė, dylančio – kairė. Vietinis disko posūkis, libracija ir reljefo metami šešėliai nemodeliuojami. Tamsiajai pusei suteiktas vos pastebimas meninis pašviesinimas. Tai iliustracija, o ne konkretaus stebėtojo teleskopinis vaizdas.</p></div><div><h3>Iš kur gaunami duomenys?</h3><p>Pagrindinių fazių momentai pateikti pagal <a href="https://aa.usno.navy.mil/data/MoonPhases" rel="noopener">JAV karinio jūrų laivyno observatorijos (USNO) lenteles</a>, minutės tikslumu. UTC konvertuojamas į Lietuvos laiką pagal Europe/Vilnius laiko juostą, įskaitant vasaros laiką.</p><p>Dienos geometrija skaičiuojama <a href="https://github.com/cosinekitty/astronomy" rel="noopener">atvirojo kodo astronominių skaičiavimų biblioteka</a> ir nepriklausomai palyginta su JPL DE440s efemeride. Paviršiaus žemėlapis: <a href="https://svs.gsfc.nasa.gov/4720/" rel="noopener">NASA mokslinės vizualizacijos studija, Ernie Wright; LRO / LROC</a>. Apšvietimą ir maketus sukūrė Kalendorius365. NASA šios svetainės neremia.</p></div></div><p>Fazių lentelėse „priešpilnis“ ir „delčia“ žymi tikslias ketvirčių akimirkas. Dienos būsenų iliustracijos skirstomos į aštuonias 45° elongacijos sritis, todėl prie jų nurodomas atitinkamos fazės laikotarpis, o ne tikslus jos momentas. Tarpiniai vaizdai vadinami augančiu arba dylančiu pjautuvu ir išgaubtu Mėnuliu. Terminijos atrama – <a href="https://www.vle.lt/straipsnis/menulio-faze/" rel="noopener">Visuotinė lietuvių enciklopedija</a>. Kalendorius neteikia astrologinių, sveikatos ar žemdirbystės rekomendacijų.</p><p><a href="/downloads/lunar/asset-manifest.csv" download>Visų spaudinių failų sąrašas ir patikrų duomenys (CSV)</a></p></section>'''

def related(year=None,month=None):
    links=[('/menulio-kalendorius/','Visas Mėnulio kalendorius'),('/menulio-fazes/','Mėnulio fazių paaiškinimas'),('/astronominis-kalendorius/','Astronominis kalendorius'),('/saule/','Saulėtekis ir saulėlydis')]
    if year and month:links.insert(0,(f'/{year}/{SLUGS[month-1]}/','Įprastas mėnesio kalendorius'))
    return '<nav class="lunar-related" aria-label="Susiję kalendoriai">'+''.join(f'<a href="{u}">{t}<span aria-hidden="true">↗</span></a>' for u,t in links)+'</nav>'

def event_data(events):
    return '<script type="application/json" id="lunar-events">'+json.dumps(events,ensure_ascii=False).replace('<','\\u003c')+'</script>'

def event_table(events,title='Pagrindinės mėnesio fazės'):
    rows=''.join(f'<li><span class="lunar-event-mark lunar-event-mark--{e["phase"]}" aria-hidden="true"></span><div><h3>{e["label_lt"]}</h3><time datetime="{e["utc"]}">{e["local_label_lt"]}</time></div><button type="button" class="lunar-icon-button" data-event-ics="{e["utc"]}" aria-label="Pridėti: {E(e["label_lt"])} {e["local_date"]}"><span aria-hidden="true">＋</span></button></li>' for e in events)
    return f'<section class="lunar-panel lunar-events"><div class="lunar-section-heading"><div><p class="lunar-eyebrow">Tikslios akimirkos Lietuvos laiku</p><h2>{title}</h2></div><button class="lunar-button lunar-button--quiet" type="button" data-all-ics>Pridėti visas fazes</button></div><ul>{rows}</ul></section>'

def live():
    return '''<section id="moon-tool" class="lunar-live lunar-panel" aria-labelledby="lunar-live-title"><div class="lunar-live-art"><canvas data-live-moon width="512" height="512" role="img" aria-label="Dabartinės Mėnulio fazės vizualizacija"></canvas><span class="lunar-orbit" aria-hidden="true"></span><p>Skaičiuojama dabartiniam momentui</p></div><div class="lunar-live-copy"><p class="lunar-eyebrow">Mėnulis šią akimirką</p><h2 id="lunar-live-title">Kaip Mėnulis atrodo šiandien?</h2><p data-live-date>Interaktyviam vaizdui parodyti naršyklėje turi būti įjungti scenarijai.</p><div class="lunar-live-facts"><div><span>Fazė</span><strong data-live-phase>Skaičiuojama…</strong></div><div><span>Apšviesta disko dalis</span><strong data-live-light>–</strong></div><div><span>Laikas nuo jaunaties</span><strong data-live-age>–</strong></div></div><div class="lunar-countdowns"><article><span>Artimiausia jaunatis</span><strong data-next-new>Skaičiuojama…</strong><time data-next-new-date></time></article><article><span>Artimiausia pilnatis</span><strong data-next-full>Skaičiuojama…</strong><time data-next-full-date></time></article></div><p class="lunar-fine">Geometrinė vizualizacija, šiaurė viršuje. Vietinis pasvirimas ir libracija nemodeliuojami.</p></div></section>'''+ '<script type="application/json" id="lunar-official-events">'+json.dumps(D['events'],ensure_ascii=False).replace('<','\\u003c')+'</script>'

def asset_card(a,annual=False,priority=False):
    name='2027 metų Mėnulio plakatas' if annual else ('Naktinis dangus' if a['design']=='night' else 'Šviesus stebėjimų lapas')
    note='A3 · gulsčias · visos 365 dienos' if annual else ('A4 · stačias · sodrus tamsus fonas' if a['design']=='night' else 'A4 · gulsčias · mažiau rašalo')
    alt=f'{name}: '+('dvylikos mėnesių kasdieniai Mėnulio vaizdai ir dienų numeriai.' if annual else f"{a['year']} m. {GENITIVE[a['month']-1]} kasdienės Mėnulio fazės, datos ir lietuviški paaiškinimai.")
    variants=a.get('previews',[])
    preview=min(variants,key=lambda r:r['width']) if variants else {'url':a['preview_small'],'width':680,'height':round(680*a['height_pt']/a['width_pt'])}
    srcset=', '.join(f"{v['url']} {v['width']}w" for v in variants)
    sizes='(max-width:760px) calc(100vw - 72px), (max-width:1100px) calc(100vw - 110px), 760px' if annual else '(max-width:760px) calc(100vw - 72px), calc((100vw - 130px)/2)'
    return f'''<article class="lunar-print-card"><figure><button class="lunar-preview-button" data-zoom="{a['preview']}" data-caption="{E(alt)}" aria-label="Padidinti: {name}"><img src="{preview['url']}" srcset="{srcset}" sizes="{sizes}" width="{preview['width']}" height="{preview['height']}" alt="{E(alt)}" loading="{'eager' if priority else 'lazy'}" fetchpriority="{'high' if priority else 'auto'}" decoding="async"><span>Padidinti ↗</span></button><figcaption>{note}</figcaption></figure><div class="lunar-print-copy"><h3>{name}</h3><p>{'Metinis dvylikos eilučių plakatas, kuriame matyti visų metų Mėnulio ritmas.' if annual else ('Dideli Mėnulio diskai ir aiškus savaitės tinklelis. Tamsiam fonui sunaudojama daugiau rašalo.' if a['design']=='night' else 'Atskira fazių laiko juosta ir vieta stebėjimų užrašams. Šviesus fonas taupiai spaudai.')}</p><div class="lunar-downloads"><a class="lunar-button" href="{a['pdf']}" download>Atsisiųsti PDF</a><a class="lunar-button lunar-button--quiet" href="{a['webp']}" download>Atsisiųsti WebP</a><button class="lunar-text-button" data-print-image="{a['webp']}" data-paper="{'A3 landscape' if annual else ('A4 portrait' if a['design']=='night' else 'A4 landscape')}">Spausdinti</button></div><p class="lunar-fine">WebP: {a['pixel_width']} × {a['pixel_height']} vaizdo taškų, ne mažiau kaip 600 PPI nurodytu popieriaus dydžiu. PDF tekstas ir linijos – vektoriniai.</p></div></article>'''

def month_cards(year):
    cards=[]
    for month in range(1,13):
        rows=[r for r in D['records'] if r['date_local'].startswith(f'{year}-{month:02}')]
        ev=[e for e in D['events'] if e['local_date'].startswith(f'{year}-{month:02}')]
        phase_images=''.join(f'<img src="/assets/lunar/days/{rows[i]["date_local"]}.webp" alt="" aria-hidden="true" width="48" height="48" loading="lazy" decoding="async">' for i in (0,7,14,21))
        cards.append(f'<a class="lunar-month-card" href="/menulio-kalendorius/{year}/{SLUGS[month-1]}/"><div class="lunar-month-card__heading"><span>{month:02}</span><h3>{MONTHS[month-1]}</h3><span aria-hidden="true">↗</span></div><div class="lunar-month-card__phases">{phase_images}</div><p>Dienų: {len(rows)} · fazių momentų: {len(ev)}</p><span>2 spausdinami maketai</span></a>')
    return '<div class="lunar-month-cards">'+''.join(cards)+'</div>'

def month_page(year,month):
    rows=[r for r in D['records'] if r['date_local'].startswith(f'{year}-{month:02}')]
    events=[e for e in D['events'] if e['local_date'].startswith(f'{year}-{month:02}')]
    title=f'{year} m. {GENITIVE[month-1]} Mėnulio kalendorius'
    prev=(year-1,12) if month==1 else (year,month-1);nxt=(year+1,1) if month==12 else (year,month+1)
    adjacent=''
    for (y,m),arrow in ((prev,'←'),(nxt,'→')):
        if y not in (2027,2028,2029):continue
        neighbor=[r for r in D['records'] if r['date_local'].startswith(f'{y}-{m:02}')]
        preview=''.join(f'<img src="/assets/lunar/days/{neighbor[i]["date_local"]}.webp" width="32" height="32" alt="" aria-hidden="true" loading="lazy">' for i in (0,10,20))
        adjacent+=f'<a href="/menulio-kalendorius/{y}/{SLUGS[m-1]}/"><span>{arrow} {y} m. {GENITIVE[m-1]} kalendorius</span><span class="lunar-adjacent-phases">{preview}</span></a>'
    lookup={int(r['date_local'][-2:]):r for r in rows};bydate={e['local_date']:e for e in events}
    trs=[]
    for week in calendar.Calendar().monthdayscalendar(year,month):
        cells=[]
        for day in week:
            if not day:cells.append('<td class="lunar-empty"></td>');continue
            r=lookup[day];event=bydate.get(r['date_local']);light=f"{r['illumination_fraction']*100:.0f}"
            label=f"{year} m. {GENITIVE[month-1]} {day} d., {WEEKDAYS[r['weekday']].lower()}. {r['phase_label_lt']}. Apšviesta {light} %."
            if event:label+=f" Pagrindinė fazė: {event['label_lt']}, {event['local_time']} Lietuvos laiku."
            marker='<span class="lunar-day-dot" aria-hidden="true"></span>' if event else ''
            cells.append(f'<td><button class="lunar-day{" lunar-day--event" if event else ""}" data-lunar-date="{r["date_local"]}" aria-label="{E(label)}" aria-pressed="{"true" if day==1 else "false"}" tabindex="{0 if day==1 else -1}"><span class="lunar-day-number">{day}</span><img src="/assets/lunar/days/{r["date_local"]}.webp" width="96" height="96" alt="" aria-hidden="true" decoding="async"><span class="lunar-day-light">{light} %</span>{marker}</button></td>')
        trs.append('<tr>'+''.join(cells)+'</tr>')
    table='<table class="lunar-month-table"><caption class="visually-hidden">'+title+'; dienos vaizdas 12:00 Lietuvos laiku</caption><thead><tr>'+''.join(f'<th scope="col"><abbr title="{d}">{s}</abbr></th>' for d,s in zip(WEEKDAYS,['Pr','An','Tr','Kt','Pn','Št','Sk']))+'</tr></thead><tbody>'+''.join(trs)+'</tbody></table>'
    brightest=max(rows,key=lambda r:r['illumination_fraction']);new_count=sum(e['phase']=='new' for e in events);full_count=sum(e['phase']=='full' for e in events)
    hero=f'<header class="lunar-heading"><p class="lunar-eyebrow">{year} metai · Dienų skaičius: {len(rows)}</p><h1>{title}</h1><p>Kasdienis Mėnulio vaizdas, tikslūs pagrindinių fazių momentai Lietuvos laiku ir du originalūs spausdinami maketai.</p>{years(year)}</header>'
    grid=f'<section class="lunar-month-section"><div class="lunar-panel lunar-calendar-panel"><div class="lunar-section-heading"><h2>{MONTHS[month-1]} {year}</h2><span>Vaizdas 12:00</span></div>{table}<p class="lunar-fine">Pasirinkite dieną. Klaviatūra judėkite rodyklėmis. Auksinis taškas žymi pagrindinės fazės dieną.</p></div><aside class="lunar-panel lunar-selected" aria-labelledby="lunar-selected-title"><p class="lunar-eyebrow">Pasirinktos dienos vaizdas</p><h2 id="lunar-selected-title">{year} m. {GENITIVE[month-1]} 1 d.</h2><canvas data-selected-moon width="512" height="512" role="img" aria-label="Pasirinktos dienos Mėnulio vizualizacija"></canvas><div data-selected-details aria-live="polite"><strong>{rows[0]["phase_label_lt"]}</strong><p>Apšviesta {pct(rows[0]["illumination_fraction"])} % disko.</p></div><label>Kita šio mėnesio diena<input type="date" data-selected-date value="{year}-{month:02}-01" min="{year}-{month:02}-01" max="{rows[-1]["date_local"]}"></label><p class="lunar-fine">Lietuvos vietos laikas: 12:00. Tai geometrinė, šiaurę viršuje rodanti vizualizacija.</p></aside></section>'
    insight=f'<section class="lunar-insight"><h2>Šio mėnesio Mėnulio ritmas</h2><p>{year} m. {GENITIVE[month-1]} mėnesį jaunaties momentų: {new_count}; pilnaties momentų: {full_count}. Didžiausia apšviesta disko dalis tarp šio mėnesio vidurdienio mėginių užfiksuota {GENITIVE[month-1]} {int(brightest["date_local"][-2:])} d. ({pct(brightest["illumination_fraction"])} %). Tai vidurdienio mėginio rezultatas, ne pilnaties momento apibrėžimas.</p></section>'
    prints='<section class="lunar-print-section"><p class="lunar-eyebrow">Kalendorius jūsų erdvei</p><h2>Du skirtingi mėnesio maketai</h2><div class="lunar-print-gallery">'+''.join(asset_card(a) for a in A if a['year']==year and a['month']==month)+'</div></section>'
    page(f'menulio-kalendorius/{year}/{SLUGS[month-1]}',title,f'{title}: kasdienės fazės ir apšviestumas, Lietuvos laikas, 2 A4 PDF bei 600 PPI WebP maketai ir įvykių pridėjimas į kalendorių.',hero+grid+insight+event_table(events)+prints+f'<nav class="lunar-adjacent" aria-label="Gretimi mėnesiai">{adjacent}</nav>'+methodology()+related(year,month)+event_data(events))

def main():
    manifest=list(csv.DictReader((ROOT/'data/lunar/requested-months.csv').open()))
    assert len(manifest)==36
    for row in manifest:month_page(int(row['year']),int(row['month_number']))
    poster=next(a for a in A if a['month'] is None)
    for year in (2027,2028,2029):
        events=[e for e in D['events'] if e['local_date'].startswith(str(year))]
        days=366 if calendar.isleap(year) else 365
        intro={2027:'Metai vienu žvilgsniu: 365 dienos, dvylika mėnesių ir atskiras visų metų plakatas.',2028:'Keliamųjų metų ritmas: vasario 29-oji įtraukta ir į dienų vaizdus, ir į abu spausdinamus maketus.',2029:'Nuo sausio iki gruodžio: 365 dienų Mėnulio šviesos kaita ir kiekvieno mėnesio fazių momentai.'}[year]
        body=f'<header class="lunar-heading"><p class="lunar-eyebrow">Metų apžvalga · Lietuvos laiku</p><h1>{year} metų Mėnulio kalendorius</h1><p>{intro}</p>{years(year)}</header><div class="lunar-year-stats"><div><strong>{days}</strong><span>Dienų duomenys</span></div><div><strong>{sum(e["phase"]=="new" for e in events)}</strong><span>Jaunaties momentai</span></div><div><strong>{sum(e["phase"]=="full" for e in events)}</strong><span>Pilnaties momentai</span></div><div><strong>24</strong><span>Spausdinami maketai</span></div></div>'
        if year==2027:body+='<section class="lunar-annual"><p class="lunar-eyebrow">Visa metų šviesos istorija</p><h2>2027 metų Mėnulio plakatas</h2>'+asset_card(poster,True,True)+'</section>'
        body+=f'<section><div class="lunar-section-heading"><h2>Pasirinkite mėnesį</h2><a href="/menulio-kalendorius/">Visi metai ↗</a></div>{month_cards(year)}</section>'+event_table(events,'Visų metų pagrindinės fazės')+methodology()+related()+event_data(events)
        page(f'menulio-kalendorius/{year}',f'{year} metų Mėnulio kalendorius Lietuvoje',f'{year} metų Mėnulio kalendorius: visų {days} dienų fazės, jaunaties ir pilnaties momentai Lietuvos laiku, 12 mėnesių ir 24 spausdinami maketai.',body)
    cycle='<section class="lunar-cycle"><h2>Kaip skaityti Mėnulio kaitą?</h2><div>'+''.join(f'<article><canvas data-benchmark="{i*45}" width="160" height="160" role="img" aria-label="{s}"></canvas><h3>{s}</h3></article>' for i,s in enumerate(STAGES))+'</div><p>Pagrindinių fazių momentai pateikiami atskirai nuo kasdienių vaizdų. Dienos iliustracija rodo vidurdienio būseną, o ne visos paros nekintantį vaizdą.</p></section>'
    body='<header class="lunar-heading"><p class="lunar-eyebrow">Dangaus ritmas jūsų kalendoriuje</p><h1>Mėnulio kalendorius</h1><p>Kasdieniai Mėnulio fazių vaizdai, Lietuvos laiku pateikti momentai ir originalūs kalendoriai jūsų sienai.</p>'+years()+'</header>'+live()+'<section class="lunar-annual"><p class="lunar-eyebrow">2027 metai viename lape</p><h2>365 dienų Mėnulio kelionė</h2>'+asset_card(poster,True)+'</section>'
    for y in (2027,2028,2029):body+=f'<section class="lunar-year-section"><div class="lunar-section-heading"><h2>{y} metų mėnesiai</h2><a href="/menulio-kalendorius/{y}/">Metų apžvalga ↗</a></div>{month_cards(y)}</section>'
    page('menulio-kalendorius','Mėnulio kalendorius 2027–2029 – fazės ir spaudiniai','Mėnulio vaizdas šiandien, artimiausia jaunatis ir pilnatis, 2027–2029 metų kasdienės fazės, mėnesių PDF ir 600 PPI WebP bei 2027 metų plakatas.',body+cycle+methodology()+related())
    page('menulio-fazes','Mėnulio fazės – jaunatis, priešpilnis, pilnatis ir delčia','Sužinokite, kaip keičiasi Mėnulio fazės, kokia fazė šiandien ir kada bus artimiausia jaunatis bei pilnatis. Tikri momentai Lietuvos laiku.','<header class="lunar-heading"><p class="lunar-eyebrow">Mėnulio fazių žinynas</p><h1>Mėnulio fazės</h1><p>Jaunatis, priešpilnis, pilnatis ir delčia yra tikslios akimirkos. Tarp jų Mėnulio apšviesta dalis keičiasi nuolat.</p>'+years()+'</header>'+live()+cycle+methodology()+related())
    print('Generated 36 month pages, 3 existing year hubs, lunar root and phase reference (41 pages).')

if __name__=='__main__':main()
