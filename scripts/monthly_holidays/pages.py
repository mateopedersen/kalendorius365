"""Dependency-free build-time rendering of the twelve 2027 holiday guides."""
from pathlib import Path
from html import escape as esc
from datetime import date,timedelta
from collections import Counter,defaultdict
import json,calendar,re,csv
from editorial import MONTH_NOTES
ROOT=Path(__file__).resolve().parents[2]
DATA=json.loads((ROOT/'data/monthly-holidays-2027.json').read_text())
MEDIA=json.loads((ROOT/'data/monthly-holiday-media.json').read_text())
MONTHS=json.loads((ROOT/'data/calendar.json').read_text())['months']
WD=['pirmadienis','antradienis','trečiadienis','ketvirtadienis','penktadienis','šeštadienis','sekmadienis']
CATS={
 'statutory_holiday':('Šventinės dienos','Šventinė diena · DK 123 str.','flag'),
 'legally_commemorative':('Atmintinos dienos','Atmintina diena · įstatymas','memory'),
 'traditional_cultural':('Tradicijos','Kultūrinė ar religinė tradicija','wreath'),
 'international_observance':('Tarptautinės dienos','Tarptautinė diena','globe')}
SHORT={'statutory_holiday':'Šventinė','legally_commemorative':'Atmintina','traditional_cultural':'Tradicija','international_observance':'Tarptautinė'}
def E(x):return esc(str(x),quote=True)
def url(m):return '/sventes/2027/'+MONTHS[m-1][0]+'/'
def icon(name):return f'<svg class="mh-icon" aria-hidden="true" focusable="false"><use href="/assets/visuals/2027-monthly-holidays/guide-icons.svg#{name}"></use></svg>'
def link(href,text,cls=''):return f'<a class="{cls}" href="{E(href)}"'+(' download' if href.endswith('.ics') else '')+f'>{text}</a>'
def badge(cat):return f'<span class="mh-badge mh-badge--{cat}">{icon(CATS[cat][2])}{CATS[cat][1]}</span>'
def readable(ds):
    d=date.fromisoformat(ds);return f'{MONTHS[d.month-1][2]} {d.day} d.'
def source_link(sid):
    s=DATA['sources'][sid];return f'<a href="{E(s["url"])}">{E(s["title"])}</a>'
def month_selector(active=0):
    cards=''.join(f'<a href="{url(i)}"'+(' aria-current="page"' if i==active else '')+f'><img src="{MEDIA[i-1]["small_preview"]}" srcset="{MEDIA[i-1]["small_preview"]} 240w, {MEDIA[i-1]["preview"]} 640w" sizes="72px" width="72" height="48" loading="lazy" decoding="async" alt="" aria-hidden="true"><span><span class="mh-month-number">{i:02d}</span>{E(m[1])}</span>{icon("arrow")}</a>' for i,m in enumerate(MONTHS,1))
    return '<section class="mh-months" aria-labelledby="mh-months-title"><div class="mh-section-head"><div><p class="eyebrow">2027 m. kalendoriaus gidas</p><h2 id="mh-months-title">Šventės pagal mėnesį</h2></div><p>Datos, jų statusai ir vietos tradicijos.</p></div><nav class="mh-month-grid" aria-label="2027 m. švenčių mėnesiai">'+cards+'</nav></section>'
def day_calendar(m,events,engine):
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
            dest='#data-'+ds if es else '#mh-day-info'
            label=f'{readable(ds)}, {WD[date.fromisoformat(ds).weekday()]}. '+('; '.join(e['title'] for e in es) if es else 'Patikrintame sąraše minėtinų dienų nėra.')
            cells.append(f'<td class="{("mh-weekend " if date.fromisoformat(ds).weekday()>4 else "")+("mh-statutory" if is_stat else "")}"><a href="{dest}" class="mh-day" data-day="{ds}" data-full-label="{E(label)}" aria-label="{E(label)}"><span class="mh-day-number">{d["day"]}</span>{count}<span class="mh-marks" aria-hidden="true">{marks}</span></a></td>')
        rows.append('<tr>'+''.join(cells)+'</tr>')
    head=''.join(f'<th scope="col"><abbr title="{WD[i].capitalize()}">{x}</abbr></th>' for i,x in enumerate(['Pr','An','Tr','Kt','Pn','Št','Sk']))
    return f'<table class="mh-calendar" id="mh-calendar"><caption>{E(MONTHS[m-1][1])} 2027</caption><thead><tr>{head}</tr></thead><tbody>{"".join(rows)}</tbody></table>'
def event_card(e):
    extra=link(e['detail_url'],'Apie šią dieną '+icon('arrow'),'mh-detail-link') if e.get('detail_url') else ''
    cite=' · '.join(source_link(s) for s in e['sources'])
    law_note=f" Įstatymo 1 str. 2 d. {e['law_point']} p." if e.get("law_point") else ""
    rule_text=e.get("rule_lt",readable(e["date"]))
    if not rule_text.endswith("."):rule_text+="."
    return f'<article class="mh-event" id="ivykis-{E(e["id"])}" data-event="{E(e["id"])}" data-date="{e["date"]}" data-category="{e["category"]}" data-statutory="{str(e["statutory_nonworking"]).lower()}"><div>{badge(e["category"])}<h4>{E(e["title"])}</h4><p>{E(e["summary"])}</p><details class="mh-event-source"><summary>Šaltinis ir datos pagrindas</summary><p>{cite}</p><p>{E(rule_text)}{law_note} Patikrinta 2026-10-17.</p></details>{extra}</div></article>'
def ics_escape(s):return s.replace('\\','\\\\').replace('\n','\\n').replace(';','\\;').replace(',','\\,')
def fold_ics(line):
    out=[];cur='';limit=75
    for c in line:
        if len((cur+c).encode())>limit:out.append(cur);cur=' '+c
        else:cur+=c
    return '\r\n'.join(out+[cur])
def write_ics(m,events):
    lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Kalendorius365//2027 Lietuvos datos//LT','CALSCALE:GREGORIAN','METHOD:PUBLISH',f'X-WR-CALNAME:2027 m. {MONTHS[m-1][2]} datos']
    for e in events:
        d=date.fromisoformat(e['date']);lines+=['BEGIN:VEVENT',f'UID:2027-{e["id"]}@kalendorius365.lt','DTSTAMP:20261017T100000Z','DTSTART;VALUE=DATE:'+d.strftime('%Y%m%d'),'DTEND;VALUE=DATE:'+(d+timedelta(days=1)).strftime('%Y%m%d'),'SUMMARY:'+ics_escape(e['title']),'DESCRIPTION:'+ics_escape(CATS[e['category']][1]+'. '+e['summary']),'URL:https://kalendorius365.lt'+url(m)+'#ivykis-'+e['id'],'TRANSP:TRANSPARENT','END:VEVENT']
    lines.append('END:VCALENDAR');p=ROOT/f'site/assets/holiday-guides-ics/2027-{MONTHS[m-1][0]}.ics';p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(('\r\n'.join(fold_ics(s) for s in lines)+'\r\n').encode())
def run():
    engine=next(x for x in json.loads((ROOT/'site/assets/data/years.json').read_text()) if x['year']==2027)
    for m,(theme,intro,spots,q,a) in enumerate(MONTH_NOTES,1):
        slug,name,gen=MONTHS[m-1];media=MEDIA[m-1];events=[dict(e) for e in DATA['events'] if e['date'].startswith(f'2027-{m:02d}')]
        for e in events:
            rule=e['recurrence']
            if rule['type']=='nth-weekday':e['rule_lt']=f'{gen} '+{1:'pirmasis',2:'antrasis',3:'trečiasis',-1:'paskutinis'}[rule['ordinal']]+' '+WD[rule['weekday']-1]
            if e['id']=='stat-statehood':e['title']='Valstybės (Lietuvos karaliaus Mindaugo karūnavimo) ir Tautiškos giesmės diena'
            if e['id']=='stat-assumption':e['title']='Žolinė (Švč. Mergelės Marijos ėmimo į dangų diena)'
        by=defaultdict(list)
        for e in events:by[e['date']].append(e)
        cats=[c for c in CATS if any(e['category']==c for e in events)]
        stat=len({e['date'] for e in events if e['statutory_nonworking']});comm=sum(e['category']=='legally_commemorative' for e in events)
        other=sum(e['category'] in ('traditional_cultural','international_observance') for e in events)
        metrics=f'<dl class="mh-metrics"><div><dt>Šventinės dienos</dt><dd>{stat:02d}<span>pagal DK 123 str.</span></dd></div><div><dt>Atmintinų dienų įrašai</dt><dd>{comm:02d}<span>pagal įstatymą</span></dd></div><div><dt>Kitos patikrintos datos</dt><dd>{other:02d}<span>tradicijos ir tarptautinės dienos</span></dd></div></dl>'
        filters='<div class="mh-filters" role="group" aria-label="Datos pagal kategoriją"><button type="button" data-category-filter="all" disabled aria-pressed="true">Visos datos</button>'+''.join(f'<button type="button" data-category-filter="{c}" disabled aria-pressed="false">{icon(CATS[c][2])}{CATS[c][0]}</button>' for c in cats)+'</div>'
        controls=f'<div class="mh-controls" data-enhance>{filters}<div class="mh-search-row"><label for="mh-search">Ieškoti šiame mėnesyje<input id="mh-search" disabled type="search" placeholder="Diena, pavadinimas ar tema…" autocomplete="off"></label><button type="button" data-reset disabled>{icon("reset")}Atkurti viską</button></div><p class="mh-results" role="status" aria-live="polite" aria-atomic="true">Rodoma įrašų: {len(events)}.</p></div>'
        groups=''.join(f'<section class="mh-date-group" id="data-{ds}" data-date-group="{ds}" tabindex="-1"><h3><time datetime="{ds}"><span>{date.fromisoformat(ds).day:02d}</span><span>{E(gen)}<small>{WD[date.fromisoformat(ds).weekday()]}</small></span></time></h3><div class="mh-date-events">'+''.join(event_card(e) for e in es)+'</div></section>' for ds,es in by.items())
        focus=''
        eventmap={e['id']:e for e in events}
        for id,title,text in spots:
            e=eventmap[id];href=e.get('detail_url','#ivykis-'+id)
            focus+=f'<article class="mh-spotlight"><p class="mh-spot-date"><time datetime="{e["date"]}">{readable(e["date"])}</time></p><h3>{E(title)}</h3><p>{E(text)}</p>{link(href,"Dienos paaiškinimas "+icon("arrow"),"mh-spot-link")}</article>'
        sids=list(dict.fromkeys(['dk','law']+[s for e in events for s in e['sources']]))
        if m==12:sids.append('straw')
        if m==3:sids.append('eggs')
        if m in (1,7):sids.append('tower')
        sources=''.join(f'<li>{source_link(s)} <span>{E(DATA["sources"][s]["publisher"])}</span></li>' for s in dict.fromkeys(sids))
        first=next(iter(by));title=f'2027 m. {gen} šventės ir atmintinos dienos'
        prev=link(url(m-1),icon('back')+E(MONTHS[m-2][1]),'mh-adjacent-link') if m>1 else link('/sventes/2027/','2027 m. apžvalga','mh-adjacent-link')
        nxt=link(url(m+1),E(MONTHS[m][1])+icon('arrow'),'mh-adjacent-link') if m<12 else link('/sventes/2028/','2028 m. šventinės dienos'+icon('arrow'),'mh-adjacent-link')
        nav=f'<nav class="mh-adjacent" aria-label="Kitas ir ankstesnis švenčių mėnuo">{prev}{link("/sventes/2027/","2027 m. šventės")}{nxt}</nav>'
        html=f'''<article class="mh mh--{slug}" data-month-guide data-month="{m}">
<header class="mh-hero"><div class="mh-hero__copy"><p class="eyebrow">2027 · {E(theme)}</p><h1>{E(title)}</h1><p class="mh-intro">{E(intro)}</p><div class="mh-hero-actions">{link(f'/2027/{slug}/',icon('download')+'Spausdinamas mėnesio kalendorius','button')}{link('#mh-calendar','Rasti datą '+icon('arrow'),'mh-text-link')}</div></div><figure class="mh-art"><img src="{media['src']}" width="1200" height="800" loading="eager" decoding="async" fetchpriority="high" alt="{E(media['alt'])}"><figcaption>{E(media['title'])}. Originali stilizuota iliustracija.</figcaption></figure></header>
{metrics}
<section class="mh-workspace" aria-labelledby="mh-dates"><div class="mh-list-head"><p class="eyebrow">Pasirinkite dieną arba temą</p><h2 id="mh-dates">{name}: datos ir jų reikšmė</h2><p>Kalendoriaus skaičius rodo įrašų kiekį. Spustelėkite datą ir pereikite prie jos paaiškinimų.</p></div>
{controls}
<div class="mh-calendar-column"><div class="mh-calendar-shell">{nav}{day_calendar(m,events,engine)}<div class="mh-legend">{''.join(f'<span><i class="mh-mark mh-mark--{c}" aria-hidden="true"></i>{SHORT[c]}</span>' for c in cats)}</div><p id="mh-day-info" class="mh-day-info" tabindex="-1" aria-live="polite">Pasirinkite kalendoriaus datą. Nežymėtoms dienoms šiame patikrintame sąraše įrašų nėra.</p><a class="mh-next" href="#data-{first}" data-next-date>{icon('arrow')}<span>Pirmoji mėnesio data: {readable(first)}</span></a></div><aside class="mh-work-note"><strong>Ar tai laisva diena?</strong><p>DK 123 str. šventinėmis dienomis paprastai nedirbama. Atmintinos dienos ir tradicijos papildomos nedarbo dienos savaime nesuteikia.</p>{link('/darbo-dienos/2027/','Darbo dienų ir valandų kalendorius '+icon('arrow'))}</aside></div>
<div class="mh-events-list" role="region" aria-label="Patikrintos mėnesio datos">{groups}<p class="mh-empty" hidden>Pagal šiuos filtrus datų nerasta. Pakeiskite paiešką arba atkurkite viską.</p></div></section>
<section class="mh-focus" aria-labelledby="mh-focus-title"><div class="mh-section-head"><div><p class="eyebrow">Mėnesio akcentai</p><h2 id="mh-focus-title">Ką verta žinoti {gen} mėnesį</h2></div></div><div class="mh-focus-grid">{focus}</div></section>
<section class="mh-planning"><div><p class="eyebrow">Iš kalendoriaus – į jūsų planus</p><h2>Atsisiųskite arba atsispausdinkite</h2><p>Šiame gide – švenčių ir minėjimų paaiškinimai. Atitinkamo mėnesio PDF ir WebP dizainai pateikiami atskirame spausdinamų kalendorių puslapyje.</p></div><div class="mh-actions">{link(f'/2027/{slug}/',icon('download')+'Atverti PDF ir WebP kalendorius','button primary')}{link(f'/assets/holiday-guides-ics/2027-{slug}.ics',icon('calendar')+'Viso mėnesio datos · ICS','button')}<button type="button" data-print>{icon('print')}Spausdinti šį gidą</button></div></section>
<section class="mh-faq" aria-labelledby="mh-question-title"><h2 id="mh-question-title">Dažnas klausimas</h2><details><summary>{E(q)}</summary><p>{E(a)}</p></details></section>
<section class="mh-sources" aria-labelledby="mh-sources-title"><h2 id="mh-sources-title">Šaltiniai ir metodika</h2><p>Duomenys patikrinti <time datetime="2026-10-17">2026 m. spalio 17 d.</time> Pagal paskelbtą DK redakciją nuo 2027-01-01 ir Atmintinų dienų įstatymo redakciją nuo 2026-07-04. Vėlesni teisės pakeitimai gali turėti įtakos.</p><details><summary>Kaip atrinktos ir patikrintos datos?</summary><p>Pateikiami visi atmintinų dienų įstatymo įrašai, DK 123 str. šventinės dienos ir atrinktos šaltiniais pagrįstos tradicijos bei tarptautinės dienos. Keli minėjimai viename įstatymo punkte išlaikomi kartu. Kilnojamosios datos apskaičiuotos 2027 metams; Velykoms taikomas vakarietiškasis Grigaliaus kalendorius. Renginių programos neprilyginamos kalendorinėms datoms. Tekstas parengtas ir peržiūrėtas naudojant dirbtinį intelektą; nepriklausomo gimtakalbio ar teisininko patvirtinimas neteikiamas.</p><p>Pastebėjote netikslumą? {link('/privatumas/#controller','Susisiekimo duomenys ir pastabų pateikimas')}.</p></details><ul>{sources}</ul></section>
{month_selector(m)}<nav class="mh-related" aria-label="Susiję kalendoriai">{link('/sventes/','Visos Lietuvos šventės')}{link('/sventes/2027/','2027 m. šventinės dienos')}{link('/2027/','2027 m. spausdinami kalendoriai')}{link('/astronominis-kalendorius/','Lygiadienių ir saulėgrįžų momentai') if m in (3,6,9,12) else ''}</nav>
</article>'''
        graph={'@context':'https://schema.org','@type':'CollectionPage','@id':'https://kalendorius365.lt'+url(m)+'#gidas','name':title,'description':intro,'url':'https://kalendorius365.lt'+url(m),'inLanguage':'lt-LT','dateModified':'2026-10-17','image':'https://kalendorius365.lt'+media['src'],'mainEntity':{'@type':'ItemList','numberOfItems':len(events),'itemListElement':[{'@type':'ListItem','position':i,'name':e['title'],'url':'https://kalendorius365.lt'+url(m)+'#ivykis-'+e['id']} for i,e in enumerate(events,1)]}}
        html+='<script type="application/ld+json">'+json.dumps(graph,ensure_ascii=False).replace('</','<\\/')+'</script>'
        meta={'title':title,'description':intro,'monthly_holidays':True,'breadcrumb_month':name,'og_image':media['src'].replace('-hero.svg','-og.png'),'og_image_alt':f'2027 m. {gen} švenčių gidas. '+media['alt']}
        p=ROOT/f'site/sventes/2027/{slug}/index.html';p.parent.mkdir(parents=True,exist_ok=True);p.write_text('---\n'+'\n'.join(k+': '+json.dumps(v,ensure_ascii=False) for k,v in meta.items())+'\n---\n'+html+'\n')
        write_ics(m,events)
    # Enhance the existing generated hubs, leaving their original content intact.
    for relative in ['sventes/index.html','sventes/2027/index.html']:
        p=ROOT/'site'/relative;s=p.read_text();marker='<!-- MONTHLY-HOLIDAYS-2027 -->';block=marker+'<div class="mh mh-hub">'+month_selector()+'</div><!-- /MONTHLY-HOLIDAYS-2027 -->'
        s=re.sub(r'<!-- MONTHLY-HOLIDAYS-2027 -->.*?<!-- /MONTHLY-HOLIDAYS-2027 -->','',s,flags=re.S)
        at=s.find('<section');at=at if at>=0 else len(s);s=s[:at]+block+s[at:]
        s=s.replace('monthly_holiday_hub: true\n','');s=s.replace('---\n','---\nmonthly_holiday_hub: true\n',1);p.write_text(s)
    print('Rendered 12 holiday guides, enhanced 2 existing hubs, wrote 12 ICS calendars.')
if __name__=='__main__':run()
