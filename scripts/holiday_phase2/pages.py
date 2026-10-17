"""Holiday detail enhancement. Dates come from the preserved site's calendar grids."""
from pathlib import Path
from html import escape
from datetime import date,timedelta
import json,re,csv
ROOT=Path(__file__).resolve().parents[2]
OLD=json.loads((ROOT/'data/holiday-editorial.json').read_text());NEW=json.loads((ROOT/'data/holiday-phase2.json').read_text())
ARTICLES=[dict(a,**NEW['overrides'].get(a['id'],{})) for a in OLD['articles']+OLD['commemorations']]+NEW['articles']
SOURCES=NEW['sources'];MONTHS=json.loads((ROOT/'data/calendar.json').read_text())['months'];YEARS={y['year']:y for y in json.loads((ROOT/'site/assets/data/years.json').read_text())};WD=['pirmadienis','antradienis','trečiadienis','ketvirtadienis','penktadienis','šeštadienis','sekmadienis']
E=lambda s:escape(str(s),quote=True)
def route(a):return '/sventes/'+a['slug']+'/'
def icon(n):return f'<svg class="hd-icon" aria-hidden="true" focusable="false"><use href="/assets/visuals/holiday-phase2/controls.svg#{n}"></use></svg>'
def occurrences(a,y):
 ids=a.get('holiday_ids',[])
 if ids:return [date.fromisoformat(h['date']) for h in YEARS[y]['holidays'] if h['id'] in ids]
 rule=a.get('recurrence',{'type':'fixed','month':a['month'],'day':a['day']})
 if rule['type']=='easter-offset':return [date.fromisoformat(next(h['date'] for h in YEARS[y]['holidays'] if h['id']=='easter'))+timedelta(days=rule['offset'])]
 if rule['type']=='nth-weekday':return [date.fromisoformat([d['date'] for d in YEARS[y]['months'][rule['month']-1]['days'] if d['weekday']==rule['weekday']][rule['ordinal']-1])]
 return [date(y,rule['month'],rule['day'])]
def readable(d):return f'{d.year} m. {MONTHS[d.month-1][2]} {d.day} d.'
def ruletext(a,ds):
 if a.get('recurrence',{}).get('type')=='easter-offset':return '47 dienos iki vakarietiškųjų Velykų · antradienis'
 if a.get('recurrence',{}).get('type')=='nth-weekday':return 'Trečiasis gegužės penktadienis'
 if 'easter' in a.get('holiday_ids',[]):return 'Velykų sekmadienis ir pirmadienis · kilnojama data'
 if a['id']=='mothers':return 'Pirmasis gegužės sekmadienis'
 if a['id']=='fathers':return 'Pirmasis birželio sekmadienis'
 return 'Kasmet '+MONTHS[ds[0].month-1][2]+(' '+str(ds[0].day)+'–'+str(ds[-1].day) if len(ds)>1 else ' '+str(ds[0].day))+' d.'
def cite(ids):
 return '<p class="hd-cite">Šaltiniai: '+' · '.join(f'<a href="{E(SOURCES[s]["url"])}">{E(SOURCES[s]["title"])}</a>' for s in dict.fromkeys(ids))+'</p>' if ids else ''
def folded(s):
 lines=[];cur=''
 for c in s:
  if len((cur+c).encode())>75:lines.append(cur);cur=' '+c
  else:cur+=c
 return '\r\n'.join(lines+[cur])
def ics(a,y,ds):
 esc=lambda s:s.replace('\\','\\\\').replace('\n','\\n').replace(';','\\;').replace(',','\\,')
 lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Kalendorius365//Lietuvos dienos//LT','CALSCALE:GREGORIAN','METHOD:PUBLISH']
 for d in ds:
  summary=next((h.get('legalName',h['name']) for h in YEARS[y]['holidays'] if h['date']==d.isoformat() and h['id'] in a.get('holiday_ids',[])),a['title'])
  lines+=['BEGIN:VEVENT',f'UID:{a["slug"]}-{d.isoformat()}@kalendorius365.lt','DTSTAMP:20261017T120000Z','DTSTART;VALUE=DATE:'+d.strftime('%Y%m%d'),'DTEND;VALUE=DATE:'+(d+timedelta(days=1)).strftime('%Y%m%d'),'SUMMARY:'+esc(summary),'DESCRIPTION:'+esc(a['category']+'. '+a['summary']),'URL:https://kalendorius365.lt'+route(a),'TRANSP:TRANSPARENT','END:VEVENT']
 lines+=['END:VCALENDAR'];p=ROOT/f'site/assets/holiday-phase2-ics/{a["slug"]}-{y}.ics';p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(('\r\n'.join(map(folded,lines))+'\r\n').encode());return '/'+str(p.relative_to(ROOT/'site'))
def calendar(a,y,ds):
 mo=YEARS[y]['months'][ds[0].month-1];rows=[];selected={d.isoformat() for d in ds}
 for week in range(mo['weeks']):
  cells=[]
  for d in mo['grid'][week*7:week*7+7]:
   if not d['inMonth']:cells.append('<td aria-hidden="true"></td>');continue
   picked=d['date'] in selected;dest=f'#datos-{y}' if picked else f'/{y}/{MONTHS[ds[0].month-1][0]}/'
   cells.append(f'<td'+(' class="hd-picked"' if picked else '')+f'><a href="{dest}" aria-label="{d["date"]}'+(': '+E(a['title']) if picked else ': mėnesio kalendorius')+f'">{d["day"]}</a></td>')
  rows.append('<tr>'+''.join(cells)+'</tr>')
 return f'<table class="hd-calendar"><caption>{E(MONTHS[ds[0].month-1][1])} {y}</caption><thead><tr>'+''.join(f'<th scope="col"><abbr title="{WD[i]}">{s}</abbr></th>' for i,s in enumerate(['Pr','An','Tr','Kt','Pn','Št','Sk']))+'</tr></thead><tbody>'+''.join(rows)+'</tbody></table>'
def media(a):
 m=NEW['media'].get(a['id'])
 if not m:raise ValueError('Verified media missing: '+a['id'])
 image=f'<img src="{E(m["src"])}" srcset="{E(m["srcset"])}" sizes="(max-width: 760px) 92vw, (max-width: 1200px) 42vw, 480px" width="{m["width"]}" height="{m["height"]}" alt="{E(m["caption"])}" fetchpriority="high" decoding="async">'
 return f'<figure class="hd-photo"><a class="hd-original" href="{E(m["commons_url"])}" aria-label="Originalus vaizdas ir licencija: {E(m["caption"])}">{image}<span>{icon("external")} Originalas</span></a><figcaption><p>{E(m["caption"])}</p><p class="hd-credit"><a href="{E(m["commons_url"])}">{E(m["author"])}</a> · <a href="{E(m["license_url"])}">{E(m["license"])}</a>. <span class="hd-media-changes">{E(m["changes"])}</span>'+(f' <a href="{E(m["institution_url"])}">Pirminis šaltinis</a>.' if m.get('institution_url') else '')+'</p></figcaption></figure>'
def brief(s):
 # A period in "2016 m.", "šv. Jono" or "J. Basanavičius" is not a
 # sentence boundary. Keep the complete sentence instead of clipping a teaser.
 abbreviations={'m','d','šv','str','p','a','pr','kr','t','y','pvz','kt','pan',
                'nr','g','r','sav','raj','apskr','val','min','sek','prof','dr',
                'doc','habil','kun','vysk','arkivysk'}
 boundaries=[]
 for match in re.finditer(r'(?<=[.!?])\s+(?=[„“"«(]?[A-ZĄČĘĖĮŠŲŪŽ0-9])',s):
  word=re.search(r'([A-Za-zĄČĘĖĮŠŲŪŽąčęėįšųūž]+)\.$',s[:match.start()])
  if word and (word[1].lower() in abbreviations or (len(word[1])==1 and word[1].isupper())):
   continue
  boundaries.append(match.start())
  if len(boundaries)==2:return s[:match.start()].strip()
 return s.strip()
def render(a):
 legal=bool(a.get('holiday_ids'));status=('Taip, paprastai nedirbama' if legal else 'Papildomos nedarbo dienos nėra')
 # Flag day shares January 1 with a statutory holiday, but is not itself a DK entry.
 if a['id']=='lithuanian-flag-day':status='Sutampa su Naujųjų metų švente'
 legalids=[s for s in a['sources'] if s in ['law','memoriam-law','labour-code-2027']]
 otherids=[s for s in a['sources'] if s not in ['law','memoriam-law','labour-code','labour-code-future','labour-code-2027','e-tar-versions','flag-law']]
 ds=occurrences(a,2027);panels=[]
 for y in [2027,2028,2029]:
  dates=occurrences(a,y);icsurl=ics(a,y,dates);d=dates[0];label=' ir '.join(readable(x) for x in dates)
  personal=a['id'] in {item['id'] for item in OLD['articles']+OLD['commemorations']}
  timings=''.join(f'<p class="hd-date-line"><time datetime="{x.isoformat()}">{E(readable(x))}</time><span>{WD[x.weekday()]}</span>'+ (f'<a class="hd-my-calendar" href="/?prideti={a["slug"]}&amp;data={x.isoformat()}">Į mano kalendorių</a>' if personal else '')+'</p>' for x in dates)
  panels.append(f'<section class="hd-year-panel" id="metai-{y}" data-hd-year="{y}" data-hd-label="{E(label)}"><div class="hd-month">{calendar(a,y,dates)}<p class="hd-key"><span aria-hidden="true"></span> Paryškintos šio gido datos</p></div><div class="hd-year-info" id="datos-{y}"><p class="eyebrow">{y} m. data</p>{timings}<p class="hd-rule">{icon("repeat")}{E(ruletext(a,dates))}</p><div class="hd-actions"><a class="hd-primary" href="{icsurl}" download>{icon("download")} Pridėti į kalendorių</a><a class="hd-secondary" href="/{y}/{MONTHS[d.month-1][0]}/">{icon("calendar")} Mėnesio kalendorius</a></div><p class="hd-help">Atsisiųskite ICS failą ir atverkite jį savo kalendoriaus programoje. Tai visos dienos įrašas, todėl jo data nepriklauso nuo laiko juostos.</p><nav class="hd-year-links" aria-label="{y} m. susiję kalendoriai"><a href="/sventes/{y}/">{y} m. šventės</a><a href="/{y}/">{y} m. spausdinamas kalendorius</a>'+ (f'<a href="/sventes/2027/{MONTHS[d.month-1][0]}/">Šio mėnesio švenčių gidas</a>' if y==2027 else '')+'</nav></div></section>')
 related=[]
 for key in a.get('related',[]):
  r=next((x for x in ARTICLES if x['id']==key or x['slug']==key),None)
  if r:related.append(f'<a href="{route(r)}"><span>{E(r["title"])}</span>{icon("arrow")}</a>')
 preserved=''
 if a['id'] in {x['id'] for x in OLD['articles']+OLD['commemorations']}:
  preserved='<details class="hd-archive"><summary>Daugiau apie istoriją ir papročius</summary><h3>Istorinis kontekstas</h3><p>'+E(a['history'])+'</p>'+cite(otherids)+'<h3>'+('Kalėdų papročiai ir tradicijos' if a['id']=='christmas' else 'Papročiai ir simboliai')+'</h3><p>'+E(a['traditions'])+'</p>'+cite(otherids)
  for context in a.get('context_sections',[]):
   h,b=context[:2];ss=context[2] if len(context)>2 else otherids;preserved+='<h3>'+E(h)+'</h3><p>'+E(b)+'</p>'+cite(ss)
  preserved+='</details>'
 faq=''.join(f'<details class="hd-faq"><summary>{E(q)}</summary><p>{E(ans)}</p></details>' for q,ans in a['faq'])
 result=f'''<article class="hd2" data-hd-detail="{a['slug']}" style="--hd-accent:{E(a.get('accent','#09674d'))};--hd-tint:{E(a.get('tint','#eff6f2'))}">
<header class="hd-hero"><div class="hd-hero-copy"><p class="eyebrow">Lietuvos šventės ir minėjimai</p><span class="hd-category">{E(a['category'])}</span><h1>{E(a['title'])}</h1><p class="hd-intro">{E(a['summary'])}</p><p class="hd-hero-date">{icon('calendar')}<span data-hd-selected-date>{E(' ir '.join(readable(d) for d in ds))}</span></p><p class="hd-status"><strong>Ar nedarbo diena?</strong> {E(status)}.</p><a class="hd-jump" href="#datos">Datos ir kalendorius {icon('arrow')}</a></div>{media(a)}</header>
<section class="hd-facts" aria-label="Svarbiausia apie dieną"><div><span class="hd-fact-label">Kada minima?</span><strong>{E(ruletext(a,ds))}</strong></div><div><span class="hd-fact-label">Ar nedarbo diena?</span><strong>{E(status)}</strong></div><div><span class="hd-fact-label">Patikrinta</span><strong><time datetime="2026-10-17">2026-10-17</time></strong><a href="#saltiniai">Šaltiniai ir rengimo principai</a></div></section>
<section class="hd-tool" id="datos" aria-labelledby="hd-tool-title"><div class="hd-section-heading"><div><p class="eyebrow">Planuokite tiksliai</p><h2 id="hd-tool-title">Pasirinkite metus</h2></div><nav class="hd-years" aria-label="Datos pagal metus">{''.join(f'<a href="#metai-{y}" data-hd-select="{y}">{y}</a>' for y in [2027,2028,2029])}</nav></div>{''.join(panels)}<p class="hd-live visually-hidden" role="status" aria-live="polite"></p><button class="hd-secondary hd-print" type="button" data-print>Spausdinti puslapį</button></section>
<div class="hd-reading"><section class="hd-meaning"><div class="hd-section-heading"><h2>Reikšmė ir kilmė</h2><img src="/assets/visuals/holiday-phase2/{a['slug']}.svg" width="120" height="96" alt="" aria-hidden="true" loading="lazy"></div><p>{E(a['what'])}</p>{cite(legalids)}<p>{E(brief(a['history']))}</p>{cite(otherids)}{preserved}</section><section class="hd-plan"><p class="eyebrow">Prieš planuojant</p><h2>Ką verta žinoti</h2><p>{E(a['practical'])}</p>{cite(legalids) if any(w in a['practical'].lower() for w in ['nedarbo','dk ','įstatym','grafik','neperkeliama']) else ''}<a href="/sventes/2027/{MONTHS[ds[0].month-1][0]}/">2027 m. {E(MONTHS[ds[0].month-1][2])} švenčių gidas {icon('arrow')}</a></section></div>
{('<section class="hd-faqs"><h2>Trumpi atsakymai</h2>'+faq+'</section>') if faq else ''}
<section class="hd-sources" id="saltiniai"><h2>Šaltiniai ir rengimo principai</h2><p>Šį gidą parengė Kalendorius365. Datos apskaičiuotos pagal svetainės kalendorių, dienos statusas sutikrintas su nurodytais teisės aktais, o istorinis kontekstas – su muziejų ir kitų institucijų šaltiniais. Konkrečių renginių programas ir vėlesnius teisės aktų pakeitimus tikrinkite pirminiuose šaltiniuose.</p><ul>{''.join(f'<li><a href="{E(SOURCES[s]["url"])}">{E(SOURCES[s]["title"])}</a> <span>{E(SOURCES[s].get("publisher",""))}</span></li>' for s in dict.fromkeys(a['sources']))}</ul><p class="hd-help">Turinys ir kalba peržiūrėti pasitelkiant dirbtinį intelektą. Šaltinių ir vaizdo licencijos patikra: <time datetime="2026-10-17">2026-10-17</time>. Nuotraukos kilmė bei naudojimo sąlygos nurodytos prie vaizdo.</p></section>
<nav class="hd-related" aria-label="Susijusios dienos"><h2>Pažinkite susijusias datas</h2><div>{''.join(related)}</div></nav></article>'''
 m=NEW['media'][a['id']]
 schema={'@context':'https://schema.org','@type':'Article','headline':a['title'],'description':a['meta_description'],'inLanguage':'lt-LT','mainEntityOfPage':'https://kalendorius365.lt'+route(a),'dateModified':'2026-10-17','author':{'@type':'Organization','name':'Kalendorius365','url':'https://kalendorius365.lt/'},'publisher':{'@type':'Organization','name':'Kalendorius365','url':'https://kalendorius365.lt/'},'image':{'@type':'ImageObject','url':'https://kalendorius365.lt'+m['src'],'caption':m['caption'],'creditText':m['author'],'license':m['license_url'],'acquireLicensePage':m['commons_url'],'isBasedOn':m['commons_url']}}
 result+='<script type="application/ld+json">'+json.dumps(schema,ensure_ascii=False).replace('</','<\\/')+'</script>'
 short_titles={'feb16':'Vasario 16-oji – data, reikšmė ir kalendorius','mar11':'Kovo 11-oji – data, reikšmė ir kalendorius','statehood':'Liepos 6-oji – Valstybės ir Tautiškos giesmės diena','assumption':'Žolinė – rugpjūčio 15-oji ir šventės reikšmė','all-souls':'Vėlinės – lapkričio 2-oji, datos ir tradicijos','freedom-defenders':'Laisvės gynėjų diena – Sausio 13-oji'}
 front={'title':short_titles.get(a['id'],a['title']+' – datos ir kalendorius'),'description':a['meta_description'],'holiday_phase2':True,'breadcrumb_label':a['title'],'og_image':m.get('og_image',m['src']),'og_image_alt':m['caption'],'og_image_type':m.get('og_type','image/webp'),'og_image_width':m.get('og_width',m['width']),'og_image_height':m.get('og_height',m['height'])}
 p=ROOT/'site'/route(a).lstrip('/')/'index.html';p.parent.mkdir(parents=True,exist_ok=True);p.write_text('---\n'+'\n'.join(k+': '+json.dumps(v,ensure_ascii=False) for k,v in front.items())+'\n---\n'+result)
def hubs():
 cards=''.join(f'<article class="hd-hub-card"><p class="eyebrow">{E(a["category"])}</p><h3><a href="{route(a)}">{E(a["title"])}</a></h3><p>{E(a["summary"])}</p><a href="{route(a)}">Datos ir reikšmė →</a></article>' for a in NEW['articles'])
 section='<section class="hd-hub-additions" aria-labelledby="hd-more-title"><h2 id="hd-more-title">Daugiau atmintinų dienų ir tradicijų</h2><p>Šios datos nėra papildomos šventinės nedarbo dienos. Kiekviename gide atskirai nurodytas įstatymo, religinis ar neoficialus statusas.</p><div class="hd-hub-grid">'+cards+'</div></section>'
 for rel in ['sventes/index.html']+[f'sventes/{y}/index.html' for y in [2027,2028,2029]]:
  p=ROOT/'site'/rel;s=p.read_text();s=s.replace('---\n','---\nholiday_phase2_hub: true\n',1);p.write_text(s+section)
 # Add links to published monthly event cards without changing their verified registry facts.
 matching={a.get('law_point'):route(a) for a in NEW['articles'] if a.get('law_point')}
 ids={'uzgavenes':'uzgavenes','book-carriers':'knygnesio-diena'}
 registry=json.loads((ROOT/'data/monthly-holidays-2027.json').read_text())
 for m in MONTHS:
  p=ROOT/f'site/sventes/2027/{m[0]}/index.html';s=p.read_text()
  for e in registry['events']:
   dest=matching.get(e.get('law_point')) or ('/sventes/'+ids[e['id']]+'/' if e['id'] in ids else None)
   if not dest:continue
   pattern=r'(<article class="mh-event" id="ivykis-'+re.escape(e['id'])+r'".*?)(</div></article>)'
   s=re.sub(pattern,lambda x:x[1]+f'<a class="mh-detail-link" href="{dest}">Apie šią dieną <svg class="mh-icon" aria-hidden="true"><use href="/assets/visuals/2027-monthly-holidays/guide-icons.svg#arrow"></use></svg></a>'+x[2],s,flags=re.S)
  extra=[a for a in NEW['articles'] if a['id'] in ['boso-diena','kliento-diena','sv-kazimiero-diena'] and MONTHS[a['month']-1][0]==m[0]]
  if extra:s+='<section class="panel"><h2>Daugiau šio mėnesio progų</h2><p>Religinės ir neoficialios datos; jos nėra papildomos šventinės nedarbo dienos.</p><ul>'+''.join('<li><a href="'+route(a)+'">'+E(a['title'])+'</a> – '+str(a['day'])+' d.</li>' for a in extra)+'</ul></section>'
  p.write_text(s)
def run():
 assert len(ARTICLES)==31 and len({a['slug'] for a in ARTICLES})==31
 for a in ARTICLES:render(a)
 hubs();print('Phase 2: 31 detail guides, 93 ICS calendars; links added to 4 hubs and monthly guides')
if __name__=='__main__':run()
