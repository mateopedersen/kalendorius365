"""Generate crawlable Lithuanian lunar pages from the checked ephemeris/manifest."""
from __future__ import annotations
import calendar,csv,html,json
from datetime import date, datetime
from hashlib import sha256
from collections import defaultdict
from cover_art import annual_cover, collection_cover, monthly_cover
from observations import annual_observation, load_observations, monthly_observation
from core import ROOT,MONTHS,GENITIVE,SLUGS,WEEKDAYS,PRIMARY,STAGES,SOCIAL_IMAGE,load_data

D=load_data()
D['records'].extend(json.loads((ROOT/'data/lunar/calendar-2030.json').read_text()))
YEARS=tuple(sorted({int(row['date_local'][:4]) for row in D['records']}))
A=json.loads((ROOT/'data/lunar/assets.json').read_text())['assets']
A.extend(json.loads((ROOT/'data/lunar/print-2030.json').read_text())['assets'])
E=html.escape
DAY_IMAGES=sorted((ROOT/'site/assets/lunar/days').glob('*.webp'))
PHASE_ICONS='/assets/visuals/astronomy/moon-phases-pia14011'
def image_version(paths):
    return sha256(b''.join(path.name.encode()+b'\0'+path.read_bytes()+b'\0' for path in paths)).hexdigest()[:12]

DAY_VERSION=image_version(path for path in DAY_IMAGES if not path.name.startswith('2030-'))
SCREEN_VERSION=image_version(path for path in DAY_IMAGES if path.name.startswith('2030-'))

def day_image_url(date):
    version=SCREEN_VERSION if date.startswith('2030-') else DAY_VERSION
    return f'/assets/lunar/days/{date}.webp?v={version}'

def pct(value):
    return f'{value*100:.1f}'.replace('.',',')

def page(route,title,description,body):
    p=ROOT/'site'/route/'index.html';p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text('---\n'+f'title: {json.dumps(title,ensure_ascii=False)}\ndescription: {json.dumps(description,ensure_ascii=False)}\nlunar: true\nog_image: {SOCIAL_IMAGE}\nog_image_alt: "Mėnulio paviršiaus vizualizacija ir 2027–2030 m. Mėnulio kalendoriaus pavadinimas."\n'+'---\n'+f'<div class="lunar-app">{body}</div>\n')

def years(selected=None, month=None):
    links = []
    for year in YEARS:
        destination = f'/menulio-kalendorius/{year}/'
        if month:
            destination += f'{month}/'
        current = ' aria-current="true"' if year == selected else ''
        links.append(f'<a href="{destination}"{current}>{year}</a>')
    return '<nav class="lunar-years" aria-label="Mėnulio kalendoriaus metai">'+''.join(links)+'</nav>'


def heading(title, description, artwork, navigation=''):
    return f'''<header class="lunar-heading">
<div class="lunar-heading__copy"><h1>{E(title)}</h1><p>{E(description)}</p>{navigation}</div>
<img class="lunar-heading__art shell-art" src="{artwork}" width="160" height="148" alt="" aria-hidden="true" decoding="async">
</header>'''


def methodology(year=None):
    print_proof = '<p><a href="/downloads/lunar/2030/print-verification.csv" download>2030 m. spaudinių sąrašas ir patikrų duomenys (CSV)</a></p>' if year in (None, 2030) else ''
    registry_title = '2027–2029 m. spaudinių sąrašas ir patikrų duomenys (CSV)' if print_proof else 'Visų spaudinių failų sąrašas ir patikrų duomenys (CSV)'
    return '''<section class="lunar-method" aria-labelledby="lunar-method-title"><p class="lunar-eyebrow">Skaičiavimai ir šaltiniai</p><h2 id="lunar-method-title">Kaip apskaičiuojamos fazės ir Mėnulio vaizdas?</h2><div class="lunar-method-grid"><div><h3>Ką rodo dienos diskas?</h3><p>Spausdinamas ir kalendoriaus langelyje pateiktas Mėnulio vaizdas apskaičiuotas 12:00 Lietuvos laiku. Pagrindinės fazės momentas gali būti kitu paros laiku, todėl vidurdienio vaizdas ne visada tiksliai ją atitinka. Interaktyvus šiandienos vaizdas skaičiuojamas dabartiniam momentui.</p><p>Vizualizacijoje šiaurė yra viršuje: augančio Mėnulio apšviesta dešinė, dylančio – kairė. Vietinis disko posūkis, libracija ir reljefo metami šešėliai nemodeliuojami. Tamsiajai pusei suteiktas vos pastebimas meninis pašviesinimas. Tai iliustracija, o ne konkretaus stebėtojo teleskopinis vaizdas.</p></div><div><h3>Iš kur gaunami duomenys?</h3><p>Pagrindinių fazių momentai pateikti pagal <a href="https://aa.usno.navy.mil/data/MoonPhases" rel="noopener">JAV karinio jūrų laivyno observatorijos (USNO) lenteles</a>, minutės tikslumu. UTC konvertuojamas į Lietuvos laiką pagal Europe/Vilnius laiko juostą, įskaitant vasaros laiką.</p><p>Kiekvienos dienos Mėnulio padėtis apskaičiuojama <a href="https://github.com/cosinekitty/astronomy" rel="noopener">atvirojo kodo astronominių skaičiavimų biblioteka</a> ir nepriklausomai palyginta su JPL DE440s efemeride. Paviršiaus žemėlapis: <a href="https://svs.gsfc.nasa.gov/4720/" rel="noopener">NASA mokslinės vizualizacijos studija, Ernie Wright; LRO / LROC</a>. Fazių piktogramų fotografija: <a href="/nuotrauku-licencijos/#menulio-fotografija">NASA / GSFC / Arizona State University LROC mozaika</a>. Apšvietimą ir maketus sukūrė Kalendorius365. NASA šios svetainės neremia.</p></div></div><p>Fazių lentelėse „priešpilnis“ ir „delčia“ žymi tikslias ketvirčių akimirkas. Dienos būsenų iliustracijos skirstomos į aštuonias 45° elongacijos sritis, todėl prie jų nurodomas atitinkamos fazės laikotarpis, o ne tikslus jos momentas. Tarpiniai vaizdai vadinami augančiu arba dylančiu pjautuvu ir išgaubtu Mėnuliu. Terminijos atrama – <a href="https://www.vle.lt/straipsnis/menulio-faze/" rel="noopener">Visuotinė lietuvių enciklopedija</a>. Kalendorius neteikia astrologinių, sveikatos ar žemdirbystės rekomendacijų.</p><p><a href="/downloads/lunar/asset-manifest.csv" download>''' + registry_title + '''</a></p>''' + print_proof + '</section>'

def related(year=None,month=None):
    links=[('/menulio-kalendorius/','Visas Mėnulio kalendorius'),('/menulio-fazes/','Mėnulio fazių paaiškinimas'),('/astronominis-kalendorius/','Astronominis kalendorius'),('/saule/','Saulėtekis ir saulėlydis')]
    if year:
        period = f'{year}/{SLUGS[month-1]}' if month else str(year)
        label = f'{GENITIVE[month-1].capitalize()} kalendorius su Lietuvos šventėmis' if month else f'{year} m. kalendorius su Lietuvos šventėmis'
        links.insert(0, (f'/{period}/', label))
    return '<nav class="lunar-related" aria-label="Susiję kalendoriai">'+''.join(f'<a href="{u}">{t}<span aria-hidden="true">↗</span></a>' for u,t in links)+'</nav>'

def phase_dates(events, phase, *, first_only=False):
    matching = [e for e in events if e['phase'] == phase]
    if first_only:
        matching = matching[:1]
    return ', '.join(
        f"{GENITIVE[date.fromisoformat(e['local_date']).month - 1]} "
        f"{int(e['local_date'][-2:])} d. {e['local_time']}"
        for e in matching
    ) or 'šį mėnesį nėra'


def event_data(events):
    return '<script type="application/json" id="lunar-events">'+json.dumps(events,ensure_ascii=False).replace('<','\\u003c')+'</script>'

def event_rows(events,export_attribute='data-event-ics'):
    return ''.join(
        f'<li><img class="lunar-event-mark" src="{PHASE_ICONS}/{e["phase"]}.svg" width="44" height="44" alt="" aria-hidden="true" decoding="async">'
        f'<div><h3>{e["label_lt"]}</h3><time datetime="{e["utc"]}">{e["local_label_lt"]}</time></div>'
        f'<button type="button" class="lunar-icon-button" {export_attribute}="{e["utc"]}" aria-label="Atsisiųsti ICS: {E(e["label_lt"])} {e["local_date"]}"><span aria-hidden="true">＋</span></button></li>'
        for e in events
    )

def event_table(events,title='Pagrindinės mėnesio fazės'):
    return f'<section class="lunar-panel lunar-events"><div class="lunar-section-heading"><div><p class="lunar-eyebrow">Tikslios akimirkos Lietuvos laiku</p><h2>{title}</h2></div><button class="lunar-button lunar-button--quiet" type="button" data-all-ics>Atsisiųsti fazes (ICS)</button></div><ul>{event_rows(events)}</ul></section>'

def phase_picker():
    first_year=YEARS[0]
    first_month=f'{first_year}-01'
    first_events=[event for event in D['events'] if event['local_date'].startswith(first_month)]
    year_links=''.join(
        f'<a href="/menulio-kalendorius/{year}/" data-phase-year="{year}"'
        + (' aria-current="true"' if year==first_year else '') + f'>{year} m.</a>'
        for year in YEARS
    )
    month_options=''.join(
        f'<option value="{i:02}" data-slug="{slug}">{month}</option>'
        for i,(month,slug) in enumerate(zip(MONTHS,SLUGS),1)
    )
    return f'''<section id="lunar-phase-dates" class="lunar-panel lunar-events lunar-phase-picker" data-phase-picker aria-labelledby="lunar-phase-picker-title">
    <header class="lunar-phase-picker__header">
      <h2 id="lunar-phase-picker-title">Pagrindinių Mėnulio fazių datos</h2>
      <p>Jaunatis, priešpilnis, pilnatis ir delčia Lietuvos laiku.</p>
    </header>
    <div class="lunar-phase-picker__controls">
      <nav class="lunar-phase-years" aria-label="Mėnulio fazių metai">{year_links}</nav>
      <label for="lunar-phase-month">Mėnuo<select id="lunar-phase-month" data-phase-month disabled>{month_options}</select></label>
    </div>
    <div class="lunar-phase-picker__month">
      <h3 data-phase-heading aria-live="polite">{first_year} m. {MONTHS[0].lower()}</h3>
      <a class="lunar-button lunar-button--quiet" href="/menulio-kalendorius/{first_year}/{SLUGS[0]}/" data-phase-calendar>
        Mėnesio kalendorius <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" focusable="false"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>
      </a>
    </div>
    <ul data-phase-rows>{event_rows(first_events,'data-phase-event-ics')}</ul>
    <button class="lunar-button lunar-button--quiet" type="button" data-phase-export>Atsisiųsti mėnesio fazes (ICS)</button>
    </section>'''

def live():
    return '''<section id="moon-tool" class="lunar-live lunar-panel" aria-labelledby="lunar-live-title"><div class="lunar-live-art"><canvas data-live-moon width="512" height="512" role="img" aria-label="Mėnulio paviršiaus iliustracija"></canvas><span class="lunar-orbit" aria-hidden="true"></span><p>Mėnulio paviršius</p></div><div class="lunar-live-copy"><p class="lunar-eyebrow">Mėnulis šią akimirką</p><h2 id="lunar-live-title">Kaip Mėnulis atrodo šiandien?</h2><p data-live-date>Interaktyviam vaizdui parodyti naršyklėje turi būti įjungti scenarijai.</p><div class="lunar-live-facts"><div><span>Fazė</span><strong data-live-phase>Skaičiuojama…</strong></div><div><span>Apšviesta disko dalis</span><strong data-live-light>–</strong></div><div><span>Laikas nuo jaunaties</span><strong data-live-age>–</strong></div></div><div class="lunar-countdowns"><article><span>Artimiausia jaunatis</span><strong data-next-new>Skaičiuojama…</strong><time data-next-new-date></time></article><article><span>Artimiausia pilnatis</span><strong data-next-full>Skaičiuojama…</strong><time data-next-full-date></time></article></div><p class="lunar-fine">Geometrinė vizualizacija, šiaurė viršuje. Vietinis pasvirimas ir libracija nemodeliuojami.</p></div></section>'''+ '<script type="application/json" id="lunar-official-events">'+json.dumps(D['events'],ensure_ascii=False).replace('<','\\u003c')+'</script>'

def asset_card(a,annual=False,priority=False):
    name=f"{a['year']} metų Mėnulio plakatas" if annual else ('Naktinis dangus' if a['design']=='night' else 'Šviesus stebėjimų lapas')
    note='A3 · gulsčias · visos 365 dienos' if annual else ('A4 · stačias · sodrus tamsus fonas' if a['design']=='night' else 'A4 · gulsčias · mažiau rašalo')
    alt=f'{name}: '+('dvylikos mėnesių kasdieniai Mėnulio vaizdai ir dienų numeriai.' if annual else f"{a['year']} m. {GENITIVE[a['month']-1]} kasdienės Mėnulio fazės, datos ir lietuviški paaiškinimai.")
    variants=a.get('previews',[])
    preview=min(variants,key=lambda r:r['width']) if variants else {'url':a['preview_small'],'width':680,'height':round(680*a['height_pt']/a['width_pt'])}
    srcset=', '.join(f"{v['url']} {v['width']}w" for v in variants)
    sizes='(max-width:760px) calc(100vw - 72px), (max-width:1100px) calc(100vw - 110px), 760px' if annual else '(max-width:760px) calc(100vw - 72px), calc((100vw - 130px)/2)'
    return f'''<article class="lunar-print-card"><figure><button class="lunar-preview-button" data-zoom="{a['preview']}" data-caption="{E(alt)}" aria-label="Padidinti: {name}"><img src="{preview['url']}" srcset="{srcset}" sizes="{sizes}" width="{preview['width']}" height="{preview['height']}" alt="{E(alt)}" loading="{'eager' if priority else 'lazy'}" fetchpriority="{'high' if priority else 'auto'}" decoding="async"><span>Padidinti ↗</span></button><figcaption>{note}</figcaption></figure><div class="lunar-print-copy"><h3>{name}</h3><p>{'Dvylika mėnesių viename plakate: kasdieniai Mėnulio vaizdai ir fazių datos.' if annual else ('Dideli Mėnulio diskai ir aiškus savaitės tinklelis. Tamsiam fonui sunaudojama daugiau rašalo.' if a['design']=='night' else 'Atskira fazių laiko juosta ir vieta stebėjimų užrašams. Šviesus fonas padeda taupyti rašalą.')}</p><div class="lunar-downloads"><a class="lunar-button" href="{a['pdf']}" download>Atsisiųsti PDF</a><a class="lunar-button lunar-button--quiet" href="{a['webp']}" download>Atsisiųsti vaizdą</a><button class="lunar-text-button" data-print-image="{a['webp']}" data-paper="{'A3 landscape' if annual else ('A4 portrait' if a['design']=='night' else 'A4 landscape')}">Spausdinti</button></div><p class="lunar-fine">Vaizdas: {a['pixel_width']} × {a['pixel_height']} vaizdo taškų, ne mažiau kaip 600 PPI nurodytu popieriaus dydžiu. PDF tekstas ir linijos – vektoriniai.</p></div></article>'''

def month_cards(year):
    cards=[]
    for month in range(1,13):
        rows=[r for r in D['records'] if r['date_local'].startswith(f'{year}-{month:02}')]
        ev=[e for e in D['events'] if e['local_date'].startswith(f'{year}-{month:02}')]
        phase_images=''.join(f'<img src="{day_image_url(rows[i]["date_local"])}" alt="" aria-hidden="true" width="48" height="48" loading="lazy" decoding="async">' for i in (0,7,14,21))
        format_label = '2 spausdinami maketai'
        cards.append(f'<a class="lunar-month-card" href="/menulio-kalendorius/{year}/{SLUGS[month-1]}/"><div class="lunar-month-card__heading"><span>{month:02}</span><h3>{MONTHS[month-1]}</h3><span aria-hidden="true">↗</span></div><div class="lunar-month-card__phases">{phase_images}</div><p>Dienų: {len(rows)} · fazių momentų: {len(ev)}</p><span>{format_label}</span></a>')
    return '<div class="lunar-month-cards">'+''.join(cards)+'</div>'

def month_page(year,month,observations):
    rows=[r for r in D['records'] if r['date_local'].startswith(f'{year}-{month:02}')]
    events=[e for e in D['events'] if e['local_date'].startswith(f'{year}-{month:02}')]
    title=f'{year} m. {GENITIVE[month-1]} Mėnulio kalendorius'
    prev=(year-1,12) if month==1 else (year,month-1);nxt=(year+1,1) if month==12 else (year,month+1)
    adjacent=''
    for (y,m),arrow in ((prev,'←'),(nxt,'→')):
        if y not in YEARS:continue
        neighbor=[r for r in D['records'] if r['date_local'].startswith(f'{y}-{m:02}')]
        preview=''.join(f'<img src="{day_image_url(neighbor[i]["date_local"])}" width="32" height="32" alt="" aria-hidden="true" loading="lazy">' for i in (0,10,20))
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
            cells.append(f'<td><button class="lunar-day{" lunar-day--event" if event else ""}" data-lunar-date="{r["date_local"]}" aria-labelledby="lunar-number-{r["date_local"]} lunar-light-{r["date_local"]}" aria-describedby="lunar-info-{r["date_local"]}" aria-pressed="{"true" if day==1 else "false"}" tabindex="{"0" if day==1 else -1}"><span id="lunar-number-{r["date_local"]}" class="lunar-day-number">{day}</span> <img src="{day_image_url(r["date_local"])}" width="128" height="128" alt="" aria-hidden="true" loading="lazy" decoding="async"><span id="lunar-light-{r["date_local"]}" class="lunar-day-light">{light} %</span><span id="lunar-info-{r["date_local"]}" class="visually-hidden">{E(label)}</span>{marker}</button></td>')
        trs.append('<tr>'+''.join(cells)+'</tr>')
    table='<table class="lunar-month-table"><caption class="visually-hidden">'+title+'; dienos vaizdas 12:00 Lietuvos laiku</caption><thead><tr>'+''.join(f'<th scope="col"><abbr title="{d}">{s}</abbr></th>' for d,s in zip(WEEKDAYS,['Pr','An','Tr','Kt','Pn','Št','Sk']))+'</tr></thead><tbody>'+''.join(trs)+'</tbody></table>'
    brightest=max(rows,key=lambda r:r['illumination_fraction']);new_count=sum(e['phase']=='new' for e in events);full_count=sum(e['phase']=='full' for e in events)
    has_print_assets = any(a['year']==year and a['month']==month for a in A)
    print_note = ' ir du originalūs spausdinami maketai' if has_print_assets else ''
    print_root = '' if has_print_assets else ' data-print-root="calendar"'
    artwork=monthly_cover(year, month, MONTHS[month-1], rows)
    phases = f"Pilnatis – {phase_dates(events, 'full')}. Jaunatis – {phase_dates(events, 'new')}."
    hero=heading(title, f'{phases} Laikai pateikti Lietuvos laiku. Žemiau – kasdienis Mėnulio vaizdas{print_note}.', artwork, years(year, SLUGS[month-1]))
    grid=f'<section class="lunar-month-section"{print_root}><div class="lunar-panel lunar-calendar-panel"><div class="lunar-section-heading"><h2>{MONTHS[month-1]} {year}</h2><span>Vaizdas 12:00</span></div>{table}<p class="lunar-fine">Pasirinkite dieną. Klaviatūra judėkite rodyklėmis. Auksinis taškas žymi pagrindinės fazės dieną.</p></div><aside class="lunar-panel lunar-selected" aria-labelledby="lunar-selected-title"><p class="lunar-eyebrow">Pasirinktos dienos vaizdas</p><h2 id="lunar-selected-title">{year} m. {GENITIVE[month-1]} 1 d.</h2><canvas data-selected-moon width="512" height="512" role="img" aria-label="Pasirinktos dienos Mėnulio vizualizacija"></canvas><div data-selected-details aria-live="polite"><strong>{rows[0]["phase_label_lt"]}</strong><p>Apšviesta {pct(rows[0]["illumination_fraction"])} % disko.</p></div><label>Kita šio mėnesio diena<input type="date" data-selected-date value="{year}-{month:02}-01" min="{year}-{month:02}-01" max="{rows[-1]["date_local"]}"></label><p class="lunar-fine">Lietuvos vietos laikas: 12:00. Tai geometrinė, šiaurę viršuje rodanti vizualizacija.</p></aside></section>'
    reading_guide = ''
    if year == 2030:
        reading_guide = '<p>Kaip lyginti vietos laiką, UTC ir dienos langelį, paaiškinta <a href="/blogas/menulio-faziu-kalendoriaus-skaitymas/">Mėnulio fazių skaitymo gide</a>.</p>'
    insight=f'<section class="lunar-insight"><h2>Šio mėnesio fazių apžvalga</h2><p>Jaunaties momentų: {new_count}; pilnaties momentų: {full_count}. Didžiausia šio mėnesio apšviesta disko dalis apskaičiuota {GENITIVE[month-1]} {int(brightest["date_local"][-2:])} d. vidurdieniui ({pct(brightest["illumination_fraction"])} %). Tikslus pilnaties momentas nurodytas fazių lentelėje ir nebūtinai sutampa su šiuo vidurdienio vaizdu.</p>{reading_guide}</section>'
    if has_print_assets:
        prints='<section class="lunar-print-section"><p class="lunar-eyebrow">Kalendorius jūsų erdvei</p><h2>Du skirtingi mėnesio maketai</h2><div class="lunar-print-gallery">'+''.join(asset_card(a) for a in A if a['year']==year and a['month']==month)+'</div></section>'
        description='Kasdienis apšviestumas, du A4 kalendoriaus maketai PDF ir 600 PPI vaizdo formatu.'
    else:
        prints='<div class="lunar-section-heading"><button type="button" class="lunar-button" data-print>Spausdinti kalendorių</button></div>'
        description='Kasdieniai Mėnulio vaizdai, apšviestumas ir spausdinamas naršyklės kalendorius.'
    page(f'menulio-kalendorius/{year}/{SLUGS[month-1]}',title,f'{year} m. {GENITIVE[month-1]} Mėnulio fazės ir jų laikas Lietuvoje. {description}',hero+grid+insight+monthly_observation(year,month,observations)+event_table(events)+prints+f'<nav class="lunar-adjacent" aria-label="Gretimi mėnesiai">{adjacent}</nav>'+methodology(year)+related(year,month)+event_data(events))

def phase_explanation():
    return '''<section class="lunar-panel lunar-phase-explainer" aria-labelledby="lunar-phase-cause"><h2 id="lunar-phase-cause">Kodėl keičiasi Mėnulio fazės?</h2><p>Saulė apšviečia maždaug pusę Mėnulio. Jam skriejant aplink Žemę, matome vis kitokią apšviestosios pusės dalį. Taip keičiasi regimasis Mėnulio vaizdas.</p><h3>Kodėl per priešpilnį matyti pusė disko?</h3><p>Per priešpilnį ir delčią matome apšviestą pusę regimojo Mėnulio disko. Pavadinimai „pirmasis ketvirtis“ ir „paskutinis ketvirtis“ nurodo vietą fazių cikle, o ne apšviesto disko plotą.</p><h3>Kuo fazė skiriasi nuo užtemimo?</h3><p>Įprastą fazių kaitą lemia Mėnulio padėtis Žemės ir Saulės atžvilgiu. Žemės šešėlis Mėnulį uždengia tik per Mėnulio užtemimą.</p><p class="lunar-fine">Paaiškinimų šaltiniai: <a href="https://www.vle.lt/straipsnis/menulio-faze/" rel="noopener">Visuotinė lietuvių enciklopedija: Mėnulio fazė</a> ir <a href="https://spaceplace.nasa.gov/moon-phases/en/" rel="noopener">NASA fazių paaiškinimas</a>.</p></section>'''

def main():
    manifest=list(csv.DictReader((ROOT/'data/lunar/requested-months.csv').open()))
    assert len(manifest)==36
    groups=defaultdict(list)
    for day,row in load_observations(YEARS).items():
        groups[(int(day[:4]),int(day[5:7]))].append((day,row))
    months = [(int(row["year"]), int(row["month_number"])) for row in manifest]
    months.extend((2030, month) for month in range(1, 13))
    for year, month in months:
        month_page(year, month, groups[(year, month)])
    posters={a['year']: a for a in A if a['month'] is None}
    for year in YEARS:
        events=[e for e in D['events'] if e['local_date'].startswith(str(year))]
        days=366 if calendar.isleap(year) else 365
        intro={2027:'Metai vienu žvilgsniu: 365 dienos, dvylika mėnesių ir atskiras visų metų plakatas.',2028:'Keliamųjų metų ritmas: vasario 29-oji įtraukta ir į dienų vaizdus, ir į abu spausdinamus maketus.',2030:'Kasdieniai Mėnulio vaizdai, pagrindinių fazių laikas ir spausdinami visų metų bei mėnesių maketai.',2029:'Nuo sausio iki gruodžio: 365 dienų Mėnulio šviesos kaita ir kiekvieno mėnesio fazių momentai.'}[year]
        intro += f" Pirmoji metų pilnatis – {phase_dates(events, 'full', first_only=True)}, pirmoji jaunatis – {phase_dates(events, 'new', first_only=True)}. Laikai pateikti Lietuvos laiku."
        print_count=sum(asset['year']==year and asset['month'] is not None for asset in A)
        print_label='Spausdinami mėnesio maketai' if print_count else 'Spausdinami mėnesiai'
        year_rows=[row for row in D['records'] if row['date_local'].startswith(str(year))]
        body=heading(f'{year} metų Mėnulio kalendorius', intro, annual_cover(year, year_rows), years(year))+f'<div class="lunar-year-stats"><div><strong>{days}</strong><span>Kalendorinės dienos</span></div><div><strong>{sum(e["phase"]=="new" for e in events)}</strong><span>Jaunaties momentai</span></div><div><strong>{sum(e["phase"]=="full" for e in events)}</strong><span>Pilnaties momentai</span></div><div><strong>{print_count or 12}</strong><span>{print_label}</span></div></div>'
        if year in posters:
            body+=f'<section class="lunar-annual"><p class="lunar-eyebrow">Visi mėnesiai viename lape</p><h2>{year} metų Mėnulio plakatas</h2>'+asset_card(posters[year],True,True)+'</section>'
        body+=f'<section><div class="lunar-section-heading"><h2>Pasirinkite mėnesį</h2><a href="/menulio-kalendorius/">Visi metai ↗</a></div>{month_cards(year)}</section>'+annual_observation(year, [groups[(year, month)] for month in range(1, 13)])+event_table(events,'Visų metų pagrindinės fazės')+methodology(year)+related(year)+event_data(events)
        format_note = '24 mėnesio maketai ir metų plakatas' if year == 2030 else '12 mėnesių ir 24 spausdinami maketai'
        page(f'menulio-kalendorius/{year}',f'{year} metų Mėnulio kalendorius Lietuvoje',f'{year} metų Mėnulio kalendorius: visų {days} dienų fazės, jaunaties ir pilnaties momentai Lietuvos laiku, {format_note}.',body)
    cycle='<section class="lunar-cycle"><h2>Kaip skaityti Mėnulio kaitą?</h2><div>'+''.join(f'<article><canvas data-benchmark="{i*45}" width="160" height="160" role="img" aria-label="{s}"></canvas><h3>{s}</h3></article>' for i,s in enumerate(STAGES))+'</div><p>Pagrindinių fazių momentai pateikiami atskirai nuo kasdienių vaizdų. Dienos iliustracija rodo vidurdienio būseną, o ne visos paros nekintantį vaizdą.</p></section>'
    body=heading('Mėnulio kalendorius', 'Kasdieniai Mėnulio fazių vaizdai, Lietuvos laiku pateikti momentai ir originalūs kalendoriai jūsų sienai.', collection_cover(D['records']), years())+live()+'<section class="lunar-annual"><p class="lunar-eyebrow">2027 metai viename lape</p><h2>2027 metų Mėnulio plakatas</h2>'+asset_card(posters[2027],True)+'</section>'
    for y in YEARS:body+=f'<section class="lunar-year-section"><div class="lunar-section-heading"><h2>{y} metų mėnesiai</h2><a href="/menulio-kalendorius/{y}/">Metų apžvalga ↗</a></div>{month_cards(y)}</section>'
    body+='<section class="lunar-annual"><h2>2030 metų Mėnulio plakatas</h2>'+asset_card(posters[2030],True)+'</section>'
    observation_links=' · '.join(f'<a href="/menulio-kalendorius/{year}/#stebejimai">{year} m.</a>' for year in YEARS)
    observation_guide=f'<section class="lunar-insight"><h2>Nuo Mėnulio fazės iki stebėjimo vakaro</h2><p>Jaunaties data padeda suprasti fazių kaitą. Rinkdamiesi vakarą žvaigždėms pirmiausia pažiūrėkite, ar jums patogiu metu Saulė jau pakankamai žemai ir ar Mėnulis nenutvieks dangaus. Mėnesio lentelės palygina šias sąlygas Vilniuje ir Klaipėdoje 23 val. Lietuvos laiku. Greta nurodome datą augančio Mėnulio paviršiui stebėti, kai sąlygos atitinka pasirinktus kriterijus.</p><p>Metų palyginimai: {observation_links}</p></section>'
    page('menulio-kalendorius','Mėnulio kalendorius 2027–2030','2027–2030 m. Mėnulio kalendorius su kasdieniais vaizdais ir tikslių fazių laikais. Atsisiųskite mėnesių maketus ir visų metų plakatus.',body+observation_guide+cycle+methodology()+related())
    page(
        'menulio-fazes','Mėnulio fazės 2027–2030 m. Lietuvoje',
        'Peržiūrėkite 2027–2030 m. jaunaties, priešpilnio, pilnaties ir delčios laikus Lietuvoje, atsisiųskite pasirinkto mėnesio ICS failą ir sužinokite šiandienos fazę.',
        heading('Mėnulio fazės', 'Pasirinkite metus ir mėnesį, kad rastumėte pagrindinių fazių laikus. Žemiau matysite ir dabartinę Mėnulio fazę.', '/assets/visuals/shell/phases.svg')
        +phase_picker()+live()+phase_explanation()+cycle+methodology()+related()
    )
    print('Generated 48 monthly lunar pages, four annual hubs and the phase reference.')

if __name__=='__main__':main()
