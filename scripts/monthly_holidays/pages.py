"""Build-time rendering of Lithuanian monthly holiday guides."""
import hashlib
from pathlib import Path
from html import escape as esc
from datetime import date,timedelta
from collections import Counter,defaultdict
import json,calendar,re,csv
from editorial import MONTH_NOTES,META_DESCRIPTIONS
from holiday_catalog import REGISTRY, YEARS, calendar_years, events_in_year, guide_links, guides, path, rule_text
ROOT=Path(__file__).resolve().parents[2]
DATA=REGISTRY
EDITORIAL=json.loads((ROOT/'data/holiday-editorial.json').read_text())
MEDIA=json.loads((ROOT/'data/monthly-holiday-media.json').read_text())
MONTHS=json.loads((ROOT/'data/calendar.json').read_text())['months']
PRINT_MONTHS = {(item['year'], item['month'])
                for item in json.loads((ROOT / 'site/assets/data/manifest.json').read_text())['assets']
                if item['kind'] == 'monthly' and item.get('verification', {}).get('status') == 'passed'}
SEASONAL_GUIDES = {
    3: ('/pavasario-lygiadienis/', 'Pavasario lygiadienio datos'),
    6: ('/vasaros-saulegriza/', 'Vasaros saulėgrįžos datos'),
    9: ('/rudens-lygiadienis/', 'Rudens lygiadienio datos'),
    12: ('/ziemos-saulegriza/', 'Žiemos saulėgrįžos datos'),
}
WD=['pirmadienis','antradienis','trečiadienis','ketvirtadienis','penktadienis','šeštadienis','sekmadienis']
CATS={
 'statutory_holiday':('Šventinės dienos','Šventinė diena · DK 123 str.','flag'),
 'legally_commemorative':('Atmintinos dienos','Atmintina diena · įstatymas','memory'),
 'traditional_cultural':('Tradicijos','Kultūrinė ar religinė tradicija','wreath'),
 'international_observance':('Tarptautinės dienos','Tarptautinė diena','globe')}
SHORT={'statutory_holiday':'Šventinė','legally_commemorative':'Atmintina','traditional_cultural':'Tradicija','international_observance':'Tarptautinė'}
def E(x):return esc(str(x),quote=True)
def url(m, year):
    return path(m, year)
def year_nav(year, month=0):
    items = []
    for target in YEARS:
        current = ' aria-current="page"' if target == year else ''
        href = url(month, target) if month else f'/sventes/{target}/'
        items.append(f'<a href="{href}"{current}>{target}</a>')
    return f'<nav class="mh-year-nav" aria-label="Pasirinkite švenčių metus">{"".join(items)}</nav>'
def icon(name):return f'<svg class="mh-icon" aria-hidden="true" focusable="false"><use href="/assets/visuals/2027-monthly-holidays/guide-icons.svg#{name}"></use></svg>'
def link(href,text,cls=''):return f'<a class="{cls}" href="{E(href)}"'+(' download' if href.endswith('.ics') else '')+f'>{text}</a>'
def badge(cat):return f'<span class="mh-badge mh-badge--{cat}">{icon(CATS[cat][2])}{CATS[cat][1]}</span>'
def readable(ds):
    d=date.fromisoformat(ds);return f'{MONTHS[d.month-1][2]} {d.day} d.'
def source_link(sid):
    s=DATA['sources'][sid];return f'<a href="{E(s["url"])}">{E(s["title"])}</a>'
def month_selector(year, active=0):
    cards=''.join(f'<a href="{url(i, year)}"'+(' aria-current="page"' if i==active else '')+f'><img src="{MEDIA[i-1]["small_preview"]}" srcset="{MEDIA[i-1]["small_preview"]} 240w, {MEDIA[i-1]["preview"]} 640w" sizes="72px" width="72" height="48" loading="lazy" decoding="async" alt="" aria-hidden="true"><span><span class="mh-month-number">{i:02d}</span>{E(m[1])}</span>{icon("arrow")}</a>' for i,m in enumerate(MONTHS,1))
    return f'<section class="mh-months" aria-labelledby="mh-months-title"><div class="mh-section-head"><div><p class="eyebrow">{year} m. kalendoriaus gidas</p><h2 id="mh-months-title">Šventės pagal mėnesį</h2></div><p>Švenčių datos, teisinis statusas ir tradicijos.</p></div><nav class="mh-month-grid" aria-label="{year} m. švenčių mėnesiai">'+cards+'</nav></section>'
def day_calendar(m,events,engine,year,festivals):
    by=defaultdict(list)
    for e in events:by[e['date']].append(e)
    mo=engine['months'][m-1]
    rows=[]
    for w in range(mo['weeks']):
        cells=[]
        for d in mo['grid'][w*7:(w+1)*7]:
            if not d['inMonth']:cells.append('<td class="mh-blank" aria-hidden="true"></td>');continue
            ds=d['date'];es=by[ds];is_stat=any(e['statutory_nonworking'] for e in es)
            marks=''.join(f'<span class="mh-mark mh-mark--{c}" data-mark-category="{c}"></span>' for c in dict.fromkeys(e['category'] for e in es))
            count=f'<span class="mh-daycount" aria-hidden="true">{len(es)}</span>' if es else ''
            dates = [item for item in festivals if item['start'] <= ds <= item['end']]
            festival = dates[0]['slug'] if dates else ''
            festival_target = f' data-festival="renginys-{E(festival)}"' if festival else ''
            if festival:
                marks += '<span class="mh-mark mh-mark--festival"></span>'
            dest = '#data-'+ds if es else '#renginys-'+festival if festival else '#mh-day-info'
            label=f'{readable(ds)}, {WD[date.fromisoformat(ds).weekday()]}. '+('; '.join(e['title'] for e in es) if es else ('Paskelbtas renginys.' if festival else 'Patikrintame sąraše minėtinų dienų nėra.'))
            if festival:
                label += ' Renginiai: ' + '; '.join(item['title'] for item in dates)
            cells.append(f'<td class="{("mh-weekend " if date.fromisoformat(ds).weekday()>4 else "")+("mh-statutory" if is_stat else "")}"><a href="{dest}" class="mh-day" data-day="{ds}"{festival_target} data-full-label="{E(label)}" title="{E(label)}"><span class="mh-day-number">{d["day"]}</span>{count}<span class="mh-marks" aria-hidden="true">{marks}</span></a></td>')
        rows.append('<tr>'+''.join(cells)+'</tr>')
    head=''.join(f'<th scope="col"><abbr title="{WD[i].capitalize()}">{x}</abbr></th>' for i,x in enumerate(['Pr','An','Tr','Kt','Pn','Št','Sk']))
    return f'<table class="mh-calendar" id="mh-calendar"><caption>{E(MONTHS[m-1][1])} {year}</caption><thead><tr>{head}</tr></thead><tbody>{"".join(rows)}</tbody></table>'
def event_card(e, year):
    guide_links = e['links']
    primary = guide_href(guide_links[0][1], year)
    extra = ''
    if len(guide_links) > 1:
        extra = '<ul class="mh-event-links">' + ''.join(
            f'<li>{link(guide_href(href, year), E(title) + icon("arrow"))}</li>'
            for title, href in guide_links
        ) + '</ul>'
    cite = ' · '.join(source_link(s) for s in e['sources'])
    law_note = f" Įstatymo 1 str. 2 d. {e['law_point']} p." if e.get("law_point") else ""
    return f'''<article class="mh-event" id="ivykis-{E(e['id'])}" data-event="{E(e['id'])}" data-date="{e['date']}" data-category="{e['category']}" data-statutory="{str(e['statutory_nonworking']).lower()}">
<div>{badge(e['category'])}<h4>{link(primary, E(e['title']) + icon('arrow'), 'mh-event-title')}</h4>
<p>{E(e['summary'])}</p>{extra}<details class="mh-event-source"><summary>Šaltinis ir datos pagrindas</summary><p>{cite}</p><p>{E(rule_text(e))}{law_note}</p></details></div></article>'''

def guide_href(href, year):
    return f'{href}?metai={year}'

def ics_escape(s):return s.replace('\\','\\\\').replace('\n','\\n').replace(';','\\;').replace(',','\\,')
def fold_ics(line):
    out=[];cur='';limit=75
    for c in line:
        if len((cur+c).encode())>limit:out.append(cur);cur=' '+c
        else:cur+=c
    return '\r\n'.join(out+[cur])
def write_ics(m,events,year):
    lines=['BEGIN:VCALENDAR','VERSION:2.0',f'PRODID:-//Kalendorius365//{year} Lietuvos datos//LT','CALSCALE:GREGORIAN','METHOD:PUBLISH',f'X-WR-CALNAME:{year} m. {MONTHS[m-1][2]} datos']
    for e in events:
        d=date.fromisoformat(e['date']);lines+=['BEGIN:VEVENT',f'UID:{year}-{e["id"]}@kalendorius365.lt','DTSTAMP:20261017T100000Z','DTSTART;VALUE=DATE:'+d.strftime('%Y%m%d'),'DTEND;VALUE=DATE:'+(d+timedelta(days=1)).strftime('%Y%m%d'),'SUMMARY:'+ics_escape(e['title']),'DESCRIPTION:'+ics_escape(CATS[e['category']][1].rstrip('.')+'. '+e['summary']),'URL:https://kalendorius365.lt'+url(m, year)+'#ivykis-'+e['id'],'TRANSP:TRANSPARENT','END:VEVENT']
    lines.append('END:VCALENDAR');p=ROOT/f'site/assets/holiday-guides-ics/{year}-{MONTHS[m-1][0]}.ics';p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(('\r\n'.join(fold_ics(s) for s in lines)+'\r\n').encode())
def render_year(year, engine, links, festivals):
    entries = sorted(events_in_year(year, engine, links), key=lambda e: (e['date'], not e['statutory_nonworking'], e['id']))
    for m, (theme, intro, spots, q, a) in enumerate(MONTH_NOTES, 1):
        slug, name, gen = MONTHS[m-1]
        media = MEDIA[m-1]
        events = [event for event in entries if date.fromisoformat(event['date']).month == m]
        if year != 2027:
            chosen = [e for key, _, _ in spots for e in events if e['id'] == key]
            chosen += [e for e in events if e not in chosen]
            spots = [(e['id'], e['title'], e['summary']) for e in chosen[:3]]
            theme = 'Lietuvos švenčių kalendorius'
            examples = ', '.join(f"{e['title']} ({readable(e['date'])})" for e in chosen[:3])
            intro = f'{year} m. {gen} datos: {examples}. Pasirinkite dieną, kad atvertumėte jos gidą.'
            q = f'Kiek {gen} yra šventinių nedarbo dienų?'
            dates = [readable(e['date']) for e in events if e['statutory_nonworking']]
            a = ('Pagal Darbo kodekso 123 straipsnį: ' + ', '.join(dates)) if dates else 'Pagal Darbo kodekso 123 straipsnį šiame mėnesyje šventinių nedarbo dienų nėra.'
        for e in events:
            # Share the current source copy with the holiday detail pages while
            # preserving the verified registry's dates and legal categories.
            article=next((a for a in EDITORIAL['articles'] if e.get('engine_holiday_id') in a.get('holiday_ids',[])),None)
            if article:e['summary']=article['summary']
            rule=e['recurrence']
            if rule['type']=='nth-weekday':e['rule_lt']=f'{gen} '+{1:'pirmasis',2:'antrasis',3:'trečiasis',-1:'paskutinis'}[rule['ordinal']]+' '+WD[rule['weekday']-1]
            if e['id']=='stat-statehood':e['title']='Valstybės (Lietuvos karaliaus Mindaugo karūnavimo) ir Tautiškos giesmės diena'
            if e['id']=='stat-assumption':e['title']='Žolinė (Švč. Mergelės Marijos ėmimo į dangų diena)'
        by=defaultdict(list)
        for e in events:by[e['date']].append(e)
        cats=[c for c in CATS if any(e['category']==c for e in events)]
        stat=len({e['date'] for e in events if e['statutory_nonworking']});comm=sum(e['category']=='legally_commemorative' for e in events)
        other=sum(e['category'] in ('traditional_cultural','international_observance') for e in events)
        metrics=f'<dl class="mh-metrics"><div><dt>Šventinės dienos</dt><dd>{stat}<span>pagal DK 123 str.</span></dd></div><div><dt>Atmintinų dienų įrašai</dt><dd>{comm}<span>pagal įstatymą</span></dd></div><div><dt>Kitos patikrintos datos</dt><dd>{other}<span>tradicijos ir tarptautinės dienos</span></dd></div></dl>'
        filters='<div class="mh-filters" role="group" aria-label="Datos pagal kategoriją"><button type="button" data-category-filter="all" disabled aria-pressed="true">Visos datos</button>'+''.join(f'<button type="button" data-category-filter="{c}" disabled aria-pressed="false">{icon(CATS[c][2])}{CATS[c][0]}</button>' for c in cats)+'</div>'
        controls=f'<div class="mh-controls" data-enhance>{filters}<div class="mh-search-row"><label for="mh-search">Ieškoti šio mėnesio datų<input id="mh-search" disabled type="search" placeholder="Diena, pavadinimas ar tema…" autocomplete="off"></label><button type="button" data-reset disabled>{icon("reset")}Išvalyti filtrus</button></div><p class="mh-results" role="status" aria-live="polite" aria-atomic="true">Rodoma įrašų: {len(events)}.</p></div>'
        groups=''.join(f'<section class="mh-date-group" id="data-{ds}" data-date-group="{ds}" tabindex="-1"><h3><time datetime="{ds}"><span>{date.fromisoformat(ds).day:02d}</span><span>{E(gen)}<small>{WD[date.fromisoformat(ds).weekday()]}</small></span></time></h3><div class="mh-date-events">'+''.join(event_card(e, year) for e in es)+'</div></section>' for ds,es in by.items())
        focus=''
        eventmap={e['id']:e for e in events}
        for id,title,text in spots:
            e=eventmap[id];href=guide_href(e['links'][0][1],year)
            focus+=f'<article class="mh-spotlight"><p class="mh-spot-date"><time datetime="{e["date"]}">{readable(e["date"])}</time></p><h3>{E(title)}</h3><p>{E(text)}</p>{link(href,"Dienos paaiškinimas "+icon("arrow"),"mh-spot-link")}</article>'
        sids=list(dict.fromkeys(['dk','law']+[s for e in events for s in e['sources']]))
        if m==12:sids.append('straw')
        if m==3:sids.append('eggs')
        if m in (1,7):sids.append('tower')
        sources=''.join(f'<li>{source_link(s)} <span>{E(DATA["sources"][s]["publisher"])}</span></li>' for s in dict.fromkeys(sids))
        first=next(iter(by));title=f'{year} m. {gen} šventės ir atmintinos dienos'
        prev = link(url(m-1, year), icon('back')+E(MONTHS[m-2][1]), 'mh-adjacent-link') if m > 1 else link(f'/sventes/{year}/', 'Metų apžvalga', 'mh-adjacent-link')
        nxt = link(url(m+1, year), E(MONTHS[m][1])+icon('arrow'), 'mh-adjacent-link') if m < 12 else link(f'/sventes/{year}/', 'Metų apžvalga', 'mh-adjacent-link')
        nav = f'<nav class="mh-adjacent" aria-label="Kitas ir ankstesnis švenčių mėnuo">{prev}{link(f"/sventes/{year}/",f"{year} m. šventės")}{nxt}</nav>'
        first_day = date(year, m, 1).isoformat()
        last_day = date(year, m, calendar.monthrange(year, m)[1]).isoformat()
        happening = [item for item in festivals if item.get('start') and item.get('end') and item['start'] <= last_day and item['end'] >= first_day]
        festival_legend = '<span><i class="mh-mark mh-mark--festival" aria-hidden="true"></i>Renginys</span>' if happening else ''
        festival_section = ''
        if happening:
            cards = ''.join(f'<article class="mh-spotlight mh-festival-card" id="renginys-{E(item["slug"])}" tabindex="-1"><p class="mh-spot-date">{E(item["date"])}</p><h3>{link("/renginiai/"+item["slug"]+"/", E(item["title"])+icon("arrow"), "mh-event-title")}</h3><p>{E(item["city"])}. {E(item["summary"])}</p></article>' for item in happening)
            festival_section = f'<section class="mh-focus"><h2>Paskelbti {gen} renginiai</h2><div class="mh-focus-grid">{cards}</div><p>{link("/renginiai/", "Visas renginių kalendorius")}</p></section>'
        informal = ''
        if m in (3, 10):
            slug_open, label = ('kliento-diena', 'Kliento diena') if m == 3 else ('boso-diena', 'Boso diena')
            href = guide_href('/sventes/' + slug_open + '/', year)
            informal = f'<nav class="mh-related" aria-label="Neoficialios progos">{link(href, label + icon("arrow"))}</nav>'
        work_path = f'/darbo-dienos/{year}/'
        work_label = 'Darbo dienų ir valandų kalendorius'
        print_path = f'/{year}/{slug}/'
        if (year, m) in PRINT_MONTHS:
            print_label = 'Atverti PDF ir WebP kalendorius'
            print_note = 'Atitinkamo mėnesio PDF ir WebP dizainai pateikiami spausdinamų kalendorių puslapyje.'
        else:
            print_label = 'Atverti spausdinamą mėnesio kalendorių'
            print_note = 'Atitinkamo mėnesio kalendorių galite atsispausdinti iš naršyklės.'
        season_link = link(*SEASONAL_GUIDES[m]) if m in SEASONAL_GUIDES else ''
        html=f'''<article class="mh mh--{slug}" data-month-guide data-month="{m}" data-year="{year}">
<header class="mh-hero"><div class="mh-hero__copy"><p class="eyebrow">{year} · {E(theme)}</p><h1>{E(title)}</h1><p class="mh-intro">{E(intro)}</p><div class="mh-hero-actions">{link(f'/{year}/{slug}/',icon('download')+'Spausdinamas mėnesio kalendorius','button')}{link('#mh-calendar','Rasti datą '+icon('arrow'),'mh-text-link')}</div>{year_nav(year, m)}</div><figure class="mh-art"><img src="{media['src']}" width="1200" height="800" loading="eager" decoding="async" fetchpriority="high" alt="{E(media['alt'])}"><figcaption>{E(media['title'])}. Originali stilizuota iliustracija.</figcaption></figure></header>
{metrics}
<section class="mh-workspace" aria-labelledby="mh-dates"><div class="mh-list-head"><p class="eyebrow">Pasirinkite dieną arba temą</p><h2 id="mh-dates">{name}: datos ir jų reikšmė</h2><p>Skaičius šalia datos rodo tai dienai skirtų įrašų skaičių. Pasirinkite datą ir skaitykite jos paaiškinimus.</p></div>
{controls}
<div class="mh-calendar-column"><div class="mh-calendar-shell">{nav}{day_calendar(m,events,engine,year,happening)}<div class="mh-legend">{''.join(f'<span><i class="mh-mark mh-mark--{c}" aria-hidden="true"></i>{SHORT[c]}</span>' for c in cats)}{festival_legend}</div><p id="mh-day-info" class="mh-day-info" tabindex="-1" aria-live="polite">Pasirinkite datą. Nepažymėtoms dienoms šiame sąraše įrašų nėra.</p><a class="mh-next" href="#data-{first}" data-next-date>{icon('arrow')}<span>Pirmoji pažymėta data: {readable(first)}</span></a></div><aside class="mh-work-note"><strong>Ar tai laisva diena?</strong><p>DK 123 str. šventinėmis dienomis paprastai nedirbama. Atmintinos dienos ir tradicijos papildomos nedarbo dienos savaime nesuteikia.</p>{link(work_path,work_label+' '+icon('arrow'))}</aside></div>
<div class="mh-events-list" role="region" aria-label="Patikrintos mėnesio datos">{groups}<p class="mh-empty" hidden>Datų pagal pasirinktus filtrus nerasta. Pakeiskite paiešką arba išvalykite filtrus.</p></div></section>
<section class="mh-focus" aria-labelledby="mh-focus-title"><div class="mh-section-head"><div><p class="eyebrow">Mėnesio akcentai</p><h2 id="mh-focus-title">Svarbiausios {gen} datos</h2></div></div><div class="mh-focus-grid">{focus}</div></section>
{festival_section}{informal}\n<section class="mh-planning"><div><p class="eyebrow">Iš kalendoriaus – į jūsų planus</p><h2>Atsisiųskite arba atsispausdinkite</h2><p>{print_note} Sveikinimų datas rasite {link(f'/vardadieniai/{slug}/', f'{gen} vardadienių sąraše')}.</p></div><div class="mh-actions">{link(print_path,icon('download')+print_label,'button primary')}{link(f'/assets/holiday-guides-ics/{year}-{slug}.ics',icon('calendar')+'Viso mėnesio datos · ICS','button')}<button type="button" data-print>{icon('print')}Spausdinti šį gidą</button></div></section>
<section class="mh-faq" aria-labelledby="mh-question-title"><h2 id="mh-question-title">Dažnas klausimas</h2><details><summary>{E(q)}</summary><p>{E(a)}</p></details></section>
<section class="mh-sources" aria-labelledby="mh-sources-title"><h2 id="mh-sources-title">Šaltiniai ir metodika</h2><p>Duomenys patikrinti <time datetime="2026-11-20">2026 m. lapkričio 20 d.</time> Remtasi paskelbta Darbo kodekso redakcija, numatyta nuo 2027-01-01, ir Atmintinų dienų įstatymo redakcija nuo 2027-01-01. Vėliau priimti pakeitimai gali turėti įtakos.</p><details><summary>Kaip atrinktos ir patikrintos datos?</summary><p>Pateikiami šiame gide naudojamos redakcijos atmintinų dienų įstatymo įrašai, DK 123 str. šventinės dienos ir atrinktos šaltiniais pagrįstos tradicijos bei tarptautinės dienos. Keli minėjimai viename įstatymo punkte išlaikomi kartu. Kilnojamosios datos apskaičiuotos {year} metams; Velykoms taikomas vakarietiškasis Grigaliaus kalendorius. Renginių programos neprilyginamos kalendorinėms datoms. Tekstas parengtas ir peržiūrėtas pasitelkiant dirbtinį intelektą. Nepriklausoma gimtakalbio redaktoriaus ar teisininko peržiūra neatlikta.</p><p>Pastebėjote netikslumą? {link('/privatumas/#controller','Susisiekimo duomenys ir pastabų pateikimas')}.</p></details><ul>{sources}</ul></section>
{month_selector(year, m)}<nav class="mh-related" aria-label="Susiję kalendoriai">{link('/sventes/','Visos Lietuvos šventės')}{link('/renginiai/','Renginių ir festivalių kalendorius')}{link(f'/sventes/{year}/',f'{year} m. šventinės dienos')}{link(f'/{year}/',f'{year} m. spausdinami kalendoriai')}{season_link}</nav>
</article>'''
        graph={'@context':'https://schema.org','@type':'CollectionPage','@id':'https://kalendorius365.lt'+url(m, year)+'#gidas','name':title,'description':intro,'url':'https://kalendorius365.lt'+url(m, year),'inLanguage':'lt-LT','dateModified':DATA['reviewed'],'image':'https://kalendorius365.lt'+media['src'],'mainEntity':{'@type':'ItemList','numberOfItems':len(events),'itemListElement':[{'@type':'ListItem','position':i,'name':e['title'],'url':'https://kalendorius365.lt'+guide_href(e['links'][0][1],year)} for i,e in enumerate(events,1)]}}
        html+='<script type="application/ld+json">'+json.dumps(graph,ensure_ascii=False).replace('</','<\\/')+'</script>'
        meta={'title':title,'description':META_DESCRIPTIONS[m-1] if year == 2027 else intro,'monthly_holidays':True,'breadcrumb_month':name,'holiday_year':year,'og_image':media['src'].replace('-hero.svg','-og.png'),'og_image_alt':f'{year} m. {gen} švenčių gidas. '+media['alt']}
        p=ROOT/f'site/sventes/{year}/{slug}/index.html';p.parent.mkdir(parents=True,exist_ok=True);p.write_text('---\n'+'\n'.join(k+': '+json.dumps(v,ensure_ascii=False) for k,v in meta.items())+'\n---\n'+html+'\n')
        write_ics(m,events,year)
    hub = ROOT / f'site/sventes/{year}/index.html'
    original = hub.read_text()
    marker = '<!-- MONTHLY-HOLIDAYS -->'
    block = marker + f'<div class="mh mh-hub">{month_selector(year)}</div><!-- /MONTHLY-HOLIDAYS -->'
    original = re.sub(r'<!-- MONTHLY-HOLIDAYS(?:-2027)? -->.*?<!-- /MONTHLY-HOLIDAYS(?:-2027)? -->', '', original, flags=re.S)
    at = original.find('<section')
    at = at if at >= 0 else len(original)
    original = original[:at] + block + original[at:]
    original = original.replace('monthly_holiday_hub: true\n', '').replace('---\n', '---\nmonthly_holiday_hub: true\n', 1)
    hub.write_text(original)


def render_home_upcoming(engines, links, festivals):
    kinds = {
        'statutory_holiday': 'holiday',
        'legally_commemorative': 'commemoration',
        'traditional_cultural': 'tradition',
        'international_observance': 'observance',
    }
    rows = {}
    for year, engine in sorted(engines.items()):
        for event in events_in_year(year, engine, links):
            for title, href in event['links']:
                key = (event['date'], href)
                rows.setdefault(key, {
                    'date': event['date'], 'end': event['date'], 'title': title,
                    'href': guide_href(href, year), 'kind': kinds[event['category']],
                })
    for item in festivals:
        if not item.get('start'):
            continue
        href = '/renginiai/' + item['slug'] + '/'
        rows[item['start'], href] = {
            'date': item['start'], 'end': item['end'], 'title': item['title'],
            'href': href, 'kind': 'festival', 'place': item['city'],
        }

    priority = {'holiday': 0, 'festival': 1, 'tradition': 2, 'commemoration': 3, 'observance': 4}
    entries = sorted(rows.values(), key=lambda row: (row['date'], priority[row['kind']], row['title']))
    # The browser needs only the current and following calendar years. Keep
    # the complete chronological inventory available to the server template.
    (ROOT / 'site/_data/home_upcoming.json').write_text(json.dumps(entries, ensure_ascii=False))
    feeds = {}
    for year in engines:
        active_years = [entry for entry in entries if entry['end'][:4] >= str(year)
                        and entry['date'][:4] <= str(year + 1)]
        target = ROOT / f'site/assets/data/upcoming-{year}.json'
        payload = json.dumps(active_years, ensure_ascii=False, separators=(',', ':')).encode()
        target.write_bytes(payload)
        feeds[year] = {'url': '/assets/data/' + target.name,
                       'revision': hashlib.sha256(payload).hexdigest()[:12]}
    (ROOT / 'site/_data/home_upcoming_feeds.json').write_text(json.dumps(feeds))


def run():
    from detail_guides import render_details
    engines = calendar_years((2026, *YEARS))
    records = list(guides())
    links = guide_links(records)
    festivals = json.loads((ROOT / 'site/_data/lithuanian_dates.json').read_text())['festivals']
    for year in YEARS:
        render_year(year, engines[year], links, festivals)
    render_details(records, engines, links, fold_ics, ics_escape)
    render_home_upcoming(engines, links, festivals)
    print(f'Rendered {12 * len(YEARS)} monthly holiday guides with {len(links)} linked calendar entries and {len(records)} additional detail guides.')


if __name__ == '__main__':
    run()
