#!/usr/bin/env python3
"""Source-bound worked examples for public calendar/data pages, not visitor data."""
import calendar
import datetime as dt
import hashlib
import html
import json
import re
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / 'site'
MONTHS = ['sausis','vasaris','kovas','balandis','geguze','birzelis','liepa','rugpjutis','rugsejis','spalis','lapkritis','gruodis']
GEN = ['sausio','vasario','kovo','balandžio','gegužės','birželio','liepos','rugpjūčio','rugsėjo','spalio','lapkričio','gruodžio']
DAYS = ['pirmadienis','antradienis','trečiadienis','ketvirtadienis','penktadienis','šeštadienis','sekmadienis']
BEGIN = '<!-- K365_EDITORIAL_V2_START -->'
END = '<!-- K365_EDITORIAL_V2_END -->'
def e(text):return html.escape(str(text), quote=True)
def load(path):return json.loads((ROOT/path).read_text())
def link(route, label):return f'<a href="{e(route)}">{e(label)}</a>'
def p(text):return '<p>'+text+'</p>'
def decimal(value):return f'{value:.1f}'.replace('.',',')
def table(caption, heads, rows):
    return '<div class="table-scroll"><table class="data-table"><caption>'+e(caption)+'</caption><thead><tr>'+''.join('<th scope="col">'+e(t)+'</th>' for t in heads)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+e(t)+'</td>'for t in row)+'</tr>' for row in rows)+'</tbody></table></div>'
def attach(route, body):
    path = SITE/route.strip('/')/'index.html'
    text = path.read_text()
    text = re.sub(r'\s*'+re.escape(BEGIN)+r'.*?'+re.escape(END)+r'\s*', '\n', text, flags=re.S)
    path.write_text(text.rstrip()+'\n\n'+BEGIN+'\n<section class="content-guide" data-editorial-review="20261103-v2">'+body+'</section>\n'+END+'\n')

def prepare():
    additions = {}
    years = load('site/assets/data/years.json')
    moon = load('data/lunar/calendar.json')
    def add(route, body):additions[route] = additions.get(route,'') + body
    for year in years:
        y = year['year']
        for month in year['months']:
            m = month['month']; route=f'/{y}/{MONTHS[m-1]}/'; days=month['days']
            work=year['work5'][m-1];compare=[]
            for other in years:
                om=other['months'][m-1];ow=other['work5'][m-1]
                compare.append((other['year'],om['length'],DAYS[dt.date(other['year'],m,1).weekday()],ow['days'],ow['hours']))
            first=dt.date(y,m,1);last=dt.date(y,m,month['length']);mid=dt.date(y,m,15)
            # A full week around the15th shows actual dates, including adjacent months.
            start=mid-dt.timedelta(days=mid.weekday());end=start+dt.timedelta(days=6)
            holidays={h['date'] for h in year['holidays']}
            working=[start+dt.timedelta(days=i)for i in range(7)if (start+dt.timedelta(days=i)).weekday()<5 and (start+dt.timedelta(days=i)).isoformat() not in holidays]
            holiday_names=[h['name']for h in year['holidays'] if start.isoformat()<=h['date']<=end.isoformat()]
            body=f'<h2>{y} m. {GEN[m-1]} planavimo pavyzdys</h2>'
            body+=p(f'Pažiūrėkite į savaitę nuo <strong>{start.isoformat()} iki {end.isoformat()}</strong>. Joje pagal pirmadienio–penktadienio darbo savaitę ir Lietuvos šventes darbo dienų yra <strong>{len(working)}</strong>. '+('Šiame intervale: '+e('; '.join(holiday_names))+'.' if holiday_names else 'Šiame intervale Lietuvos šventinių dienų nėra.')+' Jei planuojate penkias atskiras užduotis, pirmiausia palyginkite šį darbo dienų skaičių su jų trukme. Pamainų režimui šis bendras modelis netaikomas automatiškai.')
            body+=p(f'Mėnesio pradžia yra <strong>{DAYS[first.weekday()]}</strong>, o paskutinė data – <strong>{last.isoformat()}</strong>. Pirmą ir paskutinę tinklelio eilutes skaitykite kaip pilnas savaites: šviesesni gretimo mėnesio langeliai nepailgina {GEN[m-1]} mėnesio. Perrašydami terminą išsaugokite metus ir visą datą. Vien savaitės numerio arba mėnesio dienos nepakanka, jei tą patį lapą naudosite ir kitais metais.')
            body+=table(f'{GEN[m-1].capitalize()} mėnesio palyginimas: kiti metai turi kitas savaitės dienas',['Metai','Kalendorinės dienos','Mėnesio pradžia','Darbo dienos (5 d.)','Valandos (standartinis modelis)'],compare)
            body+=p(f'Pasirinktam {y} m. mėnesiui darbo valandų įvertis yra <strong>{work["hours"]}</strong>. Jis remiasi svetainės penkių dienų savaitės modeliu ir prieššventinės dienos trumpinimu. '+('Šį mėnesį modelyje trumpinamos datos: '+', '.join(work['shortened'])+'.' if work['shortened'] else 'Šį mėnesį modelyje nėra trumpinamų darbo datų.')+' Tai nėra individualaus darbuotojo darbo užmokesčio ar visų jo sutarties sąlygų skaičiavimas.')
            body+=p('Metų palyginimas naudingas ir spausdinant: nekeiskite vien seno lapo antraštės. Turi sutapti visi dienų stulpeliai, papildoma keliamųjų metų data ir kilnojamos šventės. Prie pasirinkto dizaino atverkite tikrą PDF, patikrinkite laikotarpį ir tik tuomet spausdinkite. Dydžio bei paraščių bandymą rasite '+link('/blogas/kaip-spausdinti-kalendoriu/','spausdinimo gide')+', o šio mėnesio astronominius duomenis – '+link(f'/menulio-kalendorius/{y}/{MONTHS[m-1]}/','atskirame Mėnulio kalendoriuje')+'.')
            add(route,body)
        quarter=[]
        for q in range(4):
            months=year['months'][q*3:q*3+3];work=year['work5'][q*3:q*3+3]
            quarter.append((f'{q+1} ketvirtis',sum(m['length']for m in months),sum(w['days']for w in work),sum(w['hours']for w in work)))
        body=f'<h2>{y} metų planas ketvirčiais</h2>'+p('Metų maketas padeda pasirinkti ilgesnį laikotarpį. Ketvirčių suvestinė leidžia palyginti kalendorinę trukmę ir standartinio darbo modelio dienas, nes vienodi trys mėnesiai neturi vienodo dienų skaičiaus. Prieš paskirdami didelį darbą ketvirčiui įvertinkite ir atostogas, savo užimtumą bei sutartus terminus; ši lentelė jų nežino.')
        body+=table(f'{y} metų ketvirčiai',['Laikotarpis','Kalendorinės dienos','Darbo dienos (5 d.)','Valandos'],quarter)
        body+=p(f'{y} metų kalendoriuje yra {sum(m["length"]for m in year["months"])} kalendorinės dienos. Skaičiai pateikti pagal tuos pačius duomenis kaip mėnesių ir darbo dienų puslapiuose. Ketvirčio valandos nėra vien dienų daugyba iš aštuonių: modelis įvertina prieššventinių dienų trumpinimą. Jeigu sudarote individualų grafiką, rinkitės '+link('/pamainu-grafikas/','pamainų planuoklį')+' ir patvirtintas savo darbo sąlygas.')
        add(f'/{y}/',body);add(f'/darbo-dienos/{y}/',body)
    # Lunar examples use exactly the same validated dataset as the rendered calendar.
    for y in (2027,2028,2029):
        events=[v for v in moon['events'] if v['local_date'].startswith(str(y))]
        for m in range(1,13):
            prefix=f'{y}-{m:02d}';ev=[v for v in events if v['local_date'].startswith(prefix)]
            samples=[v for v in moon['records'] if v['date_local'].startswith(prefix)]
            first=ev[0];utc=dt.datetime.fromisoformat(first['utc'].replace('Z','+00:00'));local=utc.astimezone(ZoneInfo('Europe/Vilnius'))
            nearest=min(samples,key=lambda v:abs((dt.date.fromisoformat(v['date_local'])-dt.date.fromisoformat(first['local_date'])).days))
            body=f'<h2>Vienas konkretus {GEN[m-1]} fazės skaitymo pavyzdys</h2>'
            body+=p(f'Pirmas šį mėnesį lentelėje nurodytas pagrindinės fazės momentas: <strong>{e(first["label_lt"])} – {first["local_date"]} {first["local_time"]}</strong> Lietuvos laiku. Tas pats momentas UTC užrašomas <strong>{utc:%Y-%m-%d %H:%M}</strong>. Šiai datai taikomas UTC poslinkis {local:%z}. Lygindami kitą kalendorių pirmiausia sulyginkite laiko juostas, o ne spręskite vien pagal laikrodžio valandą.')
            body+=p(f'Tos dienos langelyje apšviesta disko dalis skaičiuojama 12:00 Lietuvos laiku: <strong>{decimal(nearest["illumination_fraction"]*100)} %</strong>. Pagrindinės fazės akimirka ir vidurdienio vaizdas yra du atskiri duomenų taškai. Disko apšvietimo procentas neparodo, ar Mėnulis tuo metu bus virš jūsų vietos horizonto. Debesuotumo ir konkretaus kiemo matomumo šis kalendorius taip pat neprognozuoja.')
            select=[samples[0],samples[len(samples)//2],samples[-1]]
            body+=table('Kaip pasikeičia šio mėnesio vidurdienio vaizdas',['Lietuvos data','Geometrinio disko apšvietimas','Modelio laikotarpio pavadinimas'],[(v['date_local'],decimal(v['illumination_fraction']*100)+' %',v['phase_label_lt'])for v in select])
            body+=p('Stebėjimo užraše palikite datą, vietą, tikrą laikrodžio valandą ir pastebėtas sąlygas. Tada savo fotografiją galėsite palyginti su atitinkamu momentu, o ne su visai kitai valandai parengta miniatiūra. Fazės pavadinimas neaprašo sveikatos, sėjos sėkmės ar asmeninių sprendimų. Plačiau apie momentų ir iliustracijų skirtumą skaitykite '+link('/blogas/menulio-faziu-kalendoriaus-skaitymas/','Mėnulio kalendoriaus gide')+'.')
            add(f'/menulio-kalendorius/{y}/{MONTHS[m-1]}/',body)
        full=[v for v in events if v['phase']=='full'];new=[v for v in events if v['phase']=='new']
        add(f'/menulio-kalendorius/{y}/',f'<h2>Ką rodo {y} metų fazių seka?</h2>'+p(f'Pagal šiame kalendoriuje naudojamus USNO momentus {y} metų Lietuvos kalendorinėse datose yra <strong>{len(full)} pilnaties ir {len(new)} jaunaties momentai</strong>. Tai momentų skaičius tarp sausio pirmosios ir gruodžio paskutinės dienos, o ne fiksuota taisyklė visiems metams. Fazės ciklas neprasideda iš naujo pirmą mėnesio dieną.')+table('Metų ribos: pirmas ir paskutinis fazės momentas',['Riba','Fazė','Lietuvos data','Lietuvos laikas'],[(label,v['label_lt'],v['local_date'],v['local_time'])for label,v in [('Pirmas',events[0]),('Paskutinis',events[-1])]])+p('Mėnesio puslapyje atverkite tikslią datą ir palyginkite jos vidurdienio diską su fazės lentele. Spausdinami lapai bei interaktyvūs vaizdai remiasi tais pačiais duomenimis, tačiau yra skirtingos paskirties: lapas padeda planuoti ir žymėtis stebėjimus, o lentelė nurodo tikslią fazės akimirką. Visi laikai perskaičiuoti į Europe/Vilnius; prie kiekvieno mėnesio pateiktas konkretus UTC palyginimo pavyzdys.'))
    namedays=load('data/namedays/cc-by-sa-4.0/snapshot.json')['records']
    for m in range(1,13):
        records=[r for r in namedays if r['date'].startswith(f'{m:02d}-')]
        count=sum(len(r['names'])for r in records);distinct={n for r in records for n in r['names']};example=max(records,key=lambda r:len(r['names']))
        repeated=sorted(n for n in distinct if sum(n in r['names']for r in records)>1)
        body=f'<h2>{GEN[m-1].capitalize()} sąrašo aprėptis ir paieškos pavyzdys</h2>'
        body+=p(f'Šio mėnesio išsaugotoje šaltinių redakcijoje <strong>kalendorinių datų – {len(records)}, vardų įrašų – {count}, skirtingų tiksliai užrašytų vardų formų – {len(distinct)}</strong>. Vienas vardas gali pasitaikyti daugiau nei vieną dieną, todėl įrašų suma nėra skirtingų žmonių ar unikalių vardų skaičius. Duomenys neaprašo, kiek žmonių Lietuvoje turi šiuos vardus.')
        body+=p(f'Pavyzdžiui, datos <strong>{example["date"]}</strong> šaltinio sąraše yra {len(example["names"])} vardų formos. Pirmos trys: <strong>{e(", ".join(example["names"][:3]))}</strong>. Jei ieškote vieno žmogaus vardo, iš pradžių patikrinkite tikslią jo rašybą, tada galimus paieškos be diakritinių ženklų rezultatus. Paieškos supaprastinimas nėra leidimas pakeisti patį žmogaus vardą sveikinime.')
        body+=p(('Šiame mėnesyje keliomis datomis įrašyta, pavyzdžiui: '+e(', '.join(repeated[:5]))+'. ' if repeated else 'Šioje mėnesio redakcijoje ta pati tiksliai užrašyta vardų forma nesikartoja skirtingomis dienomis. ')+'Pasirinktą datą palyginkite su '+link(example['source_revision'],'konkrečia išsaugota pirminio straipsnio redakcija')+'. Tai paaiškina, iš kur įrašas paimtas; bendruomeninis sąrašas nėra oficialus vardadienių registras. Jei taisote šaltinio neatitikimą, nurodykite ir vardą, ir konkrečią datą.')
        if m==2:body+=p('Vasario 29-osios eilutė įtraukta į 366 datų šaltinių rinkinį, tačiau ji neatsiranda kiekvienais metais. 2028 metai yra keliamieji; 2027 ir 2029 metų vasaris turi po 28 dienas. Pasikartojantį kalendoriaus įrašą tikrinkite gavėjo programoje: jos elgesio nekeliamaisiais metais vien šis vardadienių sąrašas nenustato.')
        add(f'/vardadieniai/{MONTHS[m-1]}/',body)
    for year in years:
        y=year['year'];hs=year['holidays'];weekday=[h for h in hs if dt.date.fromisoformat(h['date']).weekday()<5]
        add(f'/sventes/{y}/',f'<h2>{y} metų datų statuso patikrinimas</h2>'+p(f'Šiame sąraše yra <strong>{len(hs)} atskiros šventinės datos</strong>, iš jų {len(weekday)} tenka pirmadieniui–penktadieniui. Tai nėra automatiškai suteikiamų papildomų atostogų skaičius: kai kurios šventės sutampa su savaitgaliu, o jūsų darbo režimas gali skirtis nuo penkių dienų savaitės.')+table('Pirmos ir paskutinės metų šventinės datos',['Riba','Data','Savaitės diena','Pavadinimas'],[(label,h['date'],DAYS[dt.date.fromisoformat(h['date']).weekday()],h['name'])for label,h in [('Pirma',hs[0]),('Paskutinė',hs[-1])]])+p('Planuodami atskirkite tris įrašus: pačią šventinę datą, patvirtintą renginį su valanda ir savo darbo grafiko išimtį. Vien pirmas įrašas kitų dviejų nepatvirtina. Kultūrinės ar profesinės progos, kurios nėra šiame šventinių dienų rinkinyje, savaime nesuteikia nedarbo dienos. '+link('/blogas/sventines-ir-atmintinos-dienos/','Gide apie datų statusą')+' pateikiamas Vasario 16-osios ir Sausio 13-osios palyginimas.'))
    monthly=load('data/monthly-holidays-2027.json')['events']
    for m in range(1,13):
        events=[v for v in monthly if v['date'].startswith(f'2027-{m:02d}')]
        dates={v['date']for v in events};nonworking=[v for v in events if v['statutory_nonworking']]
        selected=events[0]
        body=f'<h2>{GEN[m-1].capitalize()} sąrašo naudojimo pavyzdys</h2>'
        body+=p(f'Šio mėnesio sąraše <strong>progų įrašų – {len(events)}, skirtingų datų – {len(dates)}</strong>. Viena diena gali turėti kelis pavadinimus, todėl progų skaičius nėra mėnesio trukmė. Pagal šaltinio klasifikaciją šventinių datų įrašų šiame mėnesyje yra {len(nonworking)}. Atmintinos ir atrinktos neoficialios progos rodomos atskirai nuo jų.')
        body+=p(f'Pirmas chronologinis šio sąrašo įrašas: <strong>{e(selected["title"])} – {selected["date"]}, {e(selected["weekday_lt"])}</strong>. Prieš darydami išvadą apie laisvą dieną perskaitykite būtent jo statusą. Vardas ar graži iliustracija to statuso nepakeičia. Jeigu toje pačioje datoje matote du minėjimus, asmeniniame darbo dienų skaičiavime pačią datą įtraukite tik vieną kartą.')
        body+=p('Į susitikimo planą įrašykite tikrą organizatoriaus paskelbtą pradžią. Ši mėnesio apžvalga padeda atrasti progą ir jos šaltinį, tačiau pati neskelbia visų šalies renginių programos. Mokyklos, muziejaus ar savivaldybės veiklos laikas gali nesutapti su kalendorinės dienos riba. Savo mėnesio užimtumui pasirinkite '+link(f'/2027/{MONTHS[m-1]}/',f'2027 m. {GEN[m-1]} kalendorių')+'.')
        add(f'/sventes/2027/{MONTHS[m-1]}/',body)
    for y in (2027,2028,2029):
        dates=[dt.date(y,1,1),dt.date(y,12,31)]
        add(f'/savaites/{y}/',f'<h2>{y} metų ribinių datų patikra</h2>'+table('Kalendorinių ir ISO savaitės metų skirtumas',['Kalendorinė data','Savaitės diena','ISO savaitės metai','ISO savaitė'],[(d.isoformat(),DAYS[d.weekday()],d.isocalendar().year,d.isocalendar().week)for d in dates])+p('Perduodami ataskaitą nurodykite ir savaitės metus, jei naudojate ISO numerį. Vien pirmadienio nustatymas pirmuoju stulpeliu dar nepasako, kaip programa apibrėžia pirmą metų savaitę. Jei kitas įrankis rodo kitą numerį, palyginkite būtent metų ribos datą ir jo nustatymus. '+link('/blogas/iso-savaiciu-numeriai/','Išsamus 2027 metų sausio pavyzdys')+' paaiškina, kodėl kalendorinė sausio pirmoji gali priklausyti ankstesnių metų savaitei.'))
    total=sum(len(r['names'])for r in namedays);unique={n for r in namedays for n in r['names']}
    add('/vardadieniai/','<h2>Ką skaičiuoja šis vardų rinkinys?</h2>'+p(f'Visoje išsaugotoje redakcijoje yra <strong>{len(namedays)} kalendorinės datos, vardų įrašų – {total}, skirtingų tiksliai užrašytų vardų formų – {len(unique)}</strong>. Skaičiai apibūdina šaltinio sąrašus, o ne Lietuvos gyventojų statistiką. Vienas vardas gali būti susietas su keliomis datomis; rašybos variantai savaime nesujungiami į vieną tariamai tą patį žmogų.')+p('Mėnesio puslapyje rasite atskirą aprėpties suvestinę, konkretų datos pavyzdį ir nuorodą į išsaugotą šaltinio redakciją. Tai leidžia atsekti, iš kur paimtas įrašas. Jei jūsų šeimoje vardadienis minimas kitą dieną, tai savaime nepaverčia bendruomenės redaguojamo sąrašo oficialiu registru. Pasirinkite jums sutartą datą ir kalendoriuje palikite aiškų priminimą.'))
    # Purpose-specific noindex share pages get exact artifact/version context,
    # never a duplicated800-word essay or relabelled historical forecast.
    sharing=load('site/_data/sharing.json')['pages']
    archived=[r for route,r in sharing.items() if '/v-' in route and r['kind']=='horoscope']
    saved_dates=sorted({r['contentDate']for r in archived})
    add('/horoskopai/istorija/','<h2>Šio archyvo aprėptis</h2>'+p(f'Šiame leidime išsaugotų ženklo publikacijų – {len(archived)}, skirtingų turinio datų – {len(saved_dates)}. Pirma išsaugota data yra {saved_dates[0]}, paskutinė – {saved_dates[-1]}. Tai tik faktiškai paskelbtų kopijų sąrašas, o ne teiginys, kad turime visų ankstesnių metų horoskopus.')+p('Tas pats ženklas čia kartojasi skirtingomis datomis, o viena data gali turėti atskiras turinio versijas. Nuorodoje nurodytas identifikatorius padeda jas atskirti. Praeities kopija neperrašoma kaip naujos dienos prognozė. Aktualų dvylikos ženklų rinkinį atverkite '+link('/horoskopai/','dienos horoskopų puslapyje')+'.'))
    assets={a['stem']:a for a in load('site/assets/data/manifest.json')['assets']}
    for route,record in sharing.items():
        if route.startswith('/dalintis/kalendorius/'):
            asset=assets[record['templateId']];dimensions=asset.get('dimensions',{})
            rows=[('PDF',str(asset['files']['pdf']['bytes'])+' baitų'),('WebP',str(asset['files']['webp']['bytes'])+' baitų'),('Popierius',asset.get('paper','A4')),('Kryptis','Gulsčias'if asset['landscape']else'Stačias')]
            if dimensions:rows.append(('WebP matmenys',f'{dimensions["width"]} × {dimensions["height"]} px'))
            body='<h2>Šio pasirinkto failo duomenys</h2>'+table('Atsisiuntimo duomenys pagal patikrintą failų manifestą',['Savybė','Reikšmė'],rows)
            body+=p('Viršuje matote lengvą peržiūros kopiją. Spausdinimui naudokite PDF atsisiuntimą, o įterpimui kaip vaizdą – visą WebP failą. Vien failo dydis nenusako, kiek vietos liks jūsų ranka rašomam tekstui. Pirmiausia atverkite pasirinktą dokumentą ir patikrinkite jo popierių bei orientaciją. Šioje bendrinamoje nuorodoje nėra jūsų naršyklėje saugomų asmeninių įvykių.')
            add(route,body)
        elif re.search(r'/horoskopai/[^/]+/\d{4}-\d\d-\d\d/v-',route):
            body='<h2>Kaip atskirti šią kopiją nuo naujausio teksto?</h2>'+table('Išsaugotos publikacijos tapatybė',['Savybė','Reikšmė'],[('Turinio data',record['contentDate']),('Versija',record['contentVersion']),('Ženklas',record['signName'])])+p('Šis adresas išsaugo nurodytos datos publikaciją. Vėlesnis svetainės atnaujinimas nepaverčia jos naujos dienos horoskopu. Dabartinį tekstą rasite atskiroje ženklo nuorodoje viršuje. Senas tekstas čia paliekamas bendrinamos nuorodos vientisumui; jis skirtas pramogai ir apmąstymui, o ne moksliniam ateities ar asmenybės vertinimui.')
            add(route,body)
    # Hand-authored route notes contain specific reader tasks, not spun template prose.
    notes=ROOT/'data/editorial/route-notes.txt'
    if notes.exists():
        for block in notes.read_text().split('@@ ')[1:]:
            route,body=block.split('\n',1);add('/'+route.strip().strip('/')+'/' if route.strip().strip('/') else '/',body.strip())
    decisions=[]
    for route,body in additions.items():
        attach(route,body)
        decisions.append({'route':route,'added_words':len(re.findall(r'\b[^\W\d_][\w-]*\b',re.sub('<[^>]+>',' ',body))), 'sha256':hashlib.sha256(body.encode()).hexdigest(),'review':'AI-assisted source-bound calculation/example review; no independent human editor claimed'})
    output=ROOT/'docs/adsense-v2/catalogue-enrichment.json';output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(decisions,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'enriched_catalogue_routes':len(decisions)}))
if __name__=='__main__':prepare()
