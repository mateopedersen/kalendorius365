"""Authoring step only: normalize verified source records; never fetch during builds."""
from pathlib import Path
from datetime import date,timedelta
import calendar,json,re,csv
ROOT=Path(__file__).resolve().parents[2]
MONTHS=json.loads((ROOT/'data/calendar.json').read_text())['months']
WD=['pirmadienis','antradienis','trečiadienis','ketvirtadienis','penktadienis','šeštadienis','sekmadienis']
LAW='https://www.e-tar.lt/portal/lt/legalAct/TAR.D570962773F8/asr'
DK='https://www.e-tar.lt/portal/lt/legalAct/f6d686707e7011e6b969d7ae07280e89/mWmwpkqsvb'
SOURCES={
 'law':{'title':'Atmintinų dienų įstatymas: redakcija nuo 2026-07-04','url':LAW,'publisher':'Teisės aktų registras','version':'2026-07-04','access':'Official current consolidated text read in the browser, full source evidence saved.'},
 'dk':{'title':'Darbo kodekso 123 straipsnis: redakcija nuo 2027-01-01','url':DK,'publisher':'Teisės aktų registras','version':'2027-01-01 (paskelbta būsima redakcija)','access':'Official future consolidated text read in the browser. Article 123 compared with current 2026-06-07–2026-10-31 edition; identical.'},
 'three-kings':{'title':'Trys Karaliai – sausio 6-oji','url':'https://www.ekgt.lt/globali-lietuva-ir-tautine-tapatybe/kalendoriniai-paprociai/trys-karaliai--sausio-6-oji.html','publisher':'Etninės kultūros globos taryba'},
 'spring':{'title':'Pavasario švenčių datos ir jų ryšys su Velykomis','url':'https://www.ekgt.lt/media/Globali-Lietuva/Paskaitos%20apie%20pavasario%20papro%C4%8Dius%20tekstas.pdf','publisher':'Etninės kultūros globos taryba'},
 'easter':{'title':'Velykų papročiai','url':'https://www.ekgt.lt/globali-lietuva-ir-tautine-tapatybe/kalendoriniai-paprociai/velykos.html','publisher':'Etninės kultūros globos taryba'},
 'atvelykis':{'title':'Atvelykis – pirmasis sekmadienis po Velykų','url':'https://ktkc.lt/atvelykis/','publisher':'Kauno tautinės kultūros centras'},
 'jonines':{'title':'Kupolių laikas ir Joninės (Rasų šventė)','url':'https://www.ekgt.lt/globali-lietuva-ir-tautine-tapatybe/kalendoriniai-paprociai/kupoliu-laikas-ir-jonines-rasu-svente.html','publisher':'Etninės kultūros globos taryba'},
 'zoline':{'title':'Žolinė – rugpjūčio 15-oji','url':'https://www.ekgt.lt/globali-lietuva-ir-tautine-tapatybe/kalendoriniai-paprociai/zoline--rugpjucio-15-oji.html','publisher':'Etninės kultūros globos taryba'},
 'velines':{'title':'Vėlinių papročiai','url':'https://www.ekgt.lt/globali-lietuva-ir-tautine-tapatybe/kalendoriniai-paprociai/velines.html','publisher':'Etninės kultūros globos taryba'},
 'kucios':{'title':'Kūčios: šeimos vakaro papročiai','url':'https://www.ekgt.lt/globali-lietuva-ir-tautine-tapatybe/kalendoriniai-paprociai/kucios.html','publisher':'Etninės kultūros globos taryba'},
 'book-carriers':{'title':'Knygnešio diena – kovo 16-oji','url':'https://www.lrs.lt/sip/portal.show?p_k=1&p_r=40564&p_t=280289','publisher':'Lietuvos Respublikos Seimas'},
 'mother-language':{'title':'UNESCO: vasario 21-oji – gimtosios kalbos diena','url':'https://www.unesco.org/en/days/mother-language','publisher':'UNESCO'},
 'world-book':{'title':'UNESCO: balandžio 23-oji – knygos ir autorių teisių diena','url':'https://www.unesco.org/en/days/world-book-and-copyright','publisher':'UNESCO'},
 'earth':{'title':'Jungtinės Tautos: balandžio 22-oji – Motinos Žemės diena','url':'https://www.un.org/en/observances/earth-day/background','publisher':'Jungtinės Tautos'},
 'environment':{'title':'UNESCO: birželio 5-oji – aplinkos apsaugos diena','url':'https://www.unesco.org/en/days/environment','publisher':'UNESCO'},
 'child':{'title':'Vaiko diena – trečiasis gegužės penktadienis','url':'https://vaikoteises.lrv.lt/lt/naujienos/nuo-siu-metu-vaiko-diena-svesime-treciaji-geguzes-penktadieni/','publisher':'Valstybės vaiko teisių apsaugos ir įvaikinimo tarnyba'},
 'straw':{'title':'Šiaudinių sodų tradicija Lietuvoje','url':'https://www.lnkc.lt/go.php/lit/Siaudiniu-sodu-tradicija-itraukta-i-unesco-nematerialaus-kulturos-paveldo-sarasa/140385','publisher':'Lietuvos nacionalinis kultūros centras'},
 'eggs':{'title':'Lietuvos muziejaus margučių raštai','url':'https://lnm.lt/eksponatai/margutis/','publisher':'Lietuvos nacionalinis muziejus'},
 'tower':{'title':'Gedimino pilies bokštas','url':'https://lnm.lt/muziejai/gedimino-pilies-bokstas/','publisher':'Lietuvos nacionalinis muziejus'}
}
# Original short explanations. Names and legal date rules come from the official act.
SUMMARIES='''Valstybės vėliavai skirta atmintina diena sutampa su Naujųjų metų švente.
Išryškina rašto prieinamumo ir žmonių, naudojančių Brailio raštą, poreikius.
Skirta Lietuvos laisvės gynėjams atminti; papildoma nedarbo diena nesuteikiama.
Klaipėdos kraštui skirtas istorinio atminimo įrašas Lietuvos kalendoriuje.
Primena 1863–1864 m. sukilimo pradžią ir pasipriešinimo istoriją.
Tą pačią datą įstatymas skiria Vilniaus pagarsinimui ir samariečių bendrijai.
Baltijos šalių energetinei nepriklausomybei skirtas įstatymo įrašas.
Įstatyme ši diena skirta ligoniams ir bausmių vykdymo sistemos pareigūnams.
Emancipacijai ir lygiateisiškumui skirtas Lietuvos kalendoriaus įrašas.
Nevyriausybinių organizacijų vaidmeniui visuomenėje skirta diena.
Atkreipia dėmesį į žmonių, naudojančių vežimėlį, teises ir prieinamumą.
Šv. Kazimierui skirta data; konkrečios Kaziuko mugės programos čia nenustatome.
Moterų solidarumui skirta įstatyme nustatyta atmintina diena.
Lietuvos vardo paminėjimui skirta data, atskira nuo Kovo 11-osios šventės.
Skirta smurto prieš gydytojus ir kitus sveikatos priežiūros specialistus prevencijai.
Įstatymas šią datą skiria žydų gelbėtojams ir vartotojų teisėms.
Lietuvos atmintinų dienų sąrašo Žemės diena; balandžio 22-oji yra kita tarptautinė data.
Socialiniam draudimui skirta atmintina diena, įtraukta į 2026 m. redakciją.
Teatrui ir jo kūrėjams skirta atmintina diena.
Lietuvos narystei NATO skirta data; ji gali sutapti su Velykų pirmadieniu.
Prokuratūrai skirta profesinė atmintina diena.
Atkreipia dėmesį į autizmo supratimą ir įtraukią visuomenę.
Saugiam eismui skirta Lietuvos atmintina diena.
Sveikatai skirta atmintina diena, nesuteikianti papildomos poilsio dienos.
Pasaulinė meno diena pagal galiojantį įstatymo pavadinimą.
Lietuvos energetikų profesinei veiklai skirta diena.
Intelektinei nuosavybei ir kūrėjų teisėms skirta atmintina diena.
Medicinos darbuotojams skirtas profesinis kalendoriaus įrašas.
Darbuotojų saugai ir sveikatai skirta atmintina diena.
Kilnojamoji data: paskutinis balandžio šeštadienis.
Dviem temoms skirta kilnojamoji data – paskutinis balandžio sekmadienis.
Narystei Europos Sąjungoje skirta data sutampa su Tarptautine darbo diena.
Kilnojamoji data, nustatoma pirmąjį gegužės trečiadienį.
Įstatyme įvardyta 1791 m. Konstitucijai skirta istorinė atmintina diena.
Ugniagesiams ir jų globėjui šv. Florijonui skirta diena.
Žmonių su negalia savarankiškam gyvenimui skirta atmintina diena.
Lietuviškai spaudai, kalbai ir knygai skirta diena.
Antrojo pasaulinio karo aukoms skirtas atminimo įrašas.
Europos diena yra atmintina, o ne papildoma DK 123 straipsnio šventinė diena.
Skirta mokesčių mokėtojų vaidmeniui pažymėti.
Įstatyme kartu įvardyti pilietinis pasipriešinimas ir jaunimo darbuotojai.
Vieną datą dalijasi Steigiamojo Seimo, Respublikos ir šeimos dienų temos.
Informacinei visuomenei skirta atmintina diena.
Lietuvos tautinių bendrijų įvairovei ir gyvenimui skirta diena.
Trečiasis gegužės penktadienis; 2027 m. ši data sutampa su Tautinių bendrijų diena.
Partizanų pagerbimui ir kariuomenės bei visuomenės vienybei skirtas trečiasis gegužės sekmadienis.
Dingusiems vaikams ir jų paieškai skirta atmintina diena.
Lietuvos Sąjūdžiui skirtas istorinio atminimo įrašas.
Lietuvos oreiviams skirta atmintina diena.
Vieną datą dalijasi istorinio atminimo, religinio minėjimo ir kraujo donorystės temos.
Okupacijos ir genocido aukų atminimui skirta diena.
Tą pačią datą minimas Birželio sukilimas ir valstybės tarnautojų veikla.
Giminystės ryšiams skirta kilnojamoji data – pirmasis liepos šeštadienis.
Globėjams skirta kilnojamoji data – pirmasis liepos sekmadienis.
Durbės mūšiui skirtas istorinio atminimo įrašas.
Žalgirio mūšiui skirta Lietuvos atmintina diena.
Agronomų profesinei veiklai skirta diena.
Pasaulio lietuvių ryšiams ir vienybei skirta data.
Jūros ir žvejų temos įstatyme siejamos su paskutiniu liepos sekmadieniu.
Medininkų žudynių aukų atminimui skirta diena.
Romų genocido aukoms skirtas atminimo įrašas.
Bitininkams skirta kilnojamoji data – pirmasis rugpjūčio šeštadienis.
Lituanistinei mokyklai skirta Lietuvos atmintina diena.
Jaunimui skirta įstatyme įvardyta atmintina diena.
Totalitarinių režimų aukų atminimą ši data sieja su Baltijos kelio diena.
Laisvei skirta atmintina diena, atskira nuo šventinių nedarbo dienų sąrašo.
Mokslo ir žinių diena savaime nėra visiems darbuotojams laisva diena.
Seneliams skirta kilnojamoji data – pirmasis rugsėjo sekmadienis.
Tą pačią dieną įstatyme minimi religiniai ir valstybingumo atminimo įvykiai.
Vilko vaikams skirta istorinės atminties diena.
Statybininkams skirtas antrasis rugsėjo šeštadienis.
Miškininkams skirtas trečiasis rugsėjo šeštadienis.
Galiojančioje redakcijoje tą pačią dieną minima baltų vienybė ir kultūra.
Šiai dienai įstatymas priskiria genocido aukų atminimą, gestų kalbas ir ekologiją.
Lietuvos socialiniams darbuotojams skirta diena.
Tuskulėnų aukoms skirtas atminties įrašas.
Įstatymas išskiria vyresnius žmones ir besimokančius senjorus.
Gyvūnijai ir jos globėjo šv. Pranciškaus Asyžiečio minėjimui skirta data.
Kūno kultūrai ir sportui skirtas pirmasis spalio šeštadienis.
Mokytojų darbui skirta atmintina diena.
Įstatyme ši data skirta vietos savivaldai ir psichikos sveikatai.
Derliui skirta kilnojamoji data – antrasis spalio šeštadienis.
Atkreipia dėmesį į baltosios lazdelės naudojimą ir regos negalią turinčių žmonių poreikius.
Mažosios Lietuvos gyventojų genocido atminimui skirta diena.
1791 m. Abiejų Tautų tarpusavio įžadui skirta istorinė data.
Lietuvos Konstitucijai skirta diena; ji nėra papildoma nedarbo diena.
Teismo ekspertų profesinei veiklai skirta diena.
Reformacijai skirta atmintina diena.
Šv. Hubertui ir medžiotojams skirtas įstatymo įrašas.
Karjeros specialistų veiklai skirta diena.
Diabetui ir visuomenės informavimui apie jį skirta diena.
Mecenatystei ir kultūros rėmimui skirta atmintina diena.
Šiai dienai įstatymas priskiria tolerancijos ir lietuvių sutartinių minėjimus.
Vaiko teisėms skirta atmintina diena, atskira nuo gegužės Vaiko dienos.
Lietuvos kariuomenei skirta atmintina diena.
Mažosios Lietuvos ir Didžiosios Lietuvos jungimosi aktui skirtas atminimo įrašas.
Įstatyme ši data skirta Lietuvos advokatūrai ir žmonėms su negalia.
Padėkai savanoriams ir jų indėliui skirta diena.
Vyno kultūrai skirtas įstatymo įrašas; nedarbo dienos statuso nesuteikia.
Žmogaus teisėms skirta atmintina diena.
Lietuvos teismams skirta profesinė atmintina diena.'''.splitlines()
assert len(SUMMARIES)==101,len(SUMMARIES)

def nth(month,wd,n):
    days=[x for x in range(1,calendar.monthrange(2027,month)[1]+1) if date(2027,month,x).weekday()==wd]
    return date(2027,month,days[n-1] if n>0 else days[n])
def event(id,dt,title,cat,summary,sources,rule=None,**kw):
    return dict(id=id,date=dt.isoformat(),weekday=dt.isoweekday(),weekday_lt=WD[dt.weekday()],title=title,category=cat,statutory_nonworking=cat=='statutory_holiday',summary=summary,sources=sources,recurrence=rule or {'type':'fixed','month':dt.month,'day':dt.day},verified_at='2026-10-17',**kw)
def create():
    s=(ROOT/'docs/2027-monthly-holidays/source-evidence/atmintinos-2026-07-04.txt').read_text().split('Skelbiu šį')[0]
    events=[]
    for m in re.finditer(r'(?m)^\s*(\d+)\)\s*([^\n]+)',s):
        n=int(m[1]);raw=m[2].strip().rstrip(';.');rulepart,title=re.split(r' [–‒] ',raw,maxsplit=1)
        rulepart=' '.join(rulepart.split());title=' '.join(title.split())
        month=next(i for i,x in enumerate(MONTHS,1) if rulepart.startswith(x[2]+' '))
        if mo:=re.search(r' (\d+)-',rulepart):
            dt=date(2027,month,int(mo[1]));rule={'type':'fixed','month':month,'day':dt.day}
        else:
            wd=next(v for k,v in [('penktadienis',4),('šeštadienis',5),('sekmadienis',6),('trečiadienis',2)] if k in rulepart)
            ord_=next(v for k,v in [('pirmasis',1),('antrasis',2),('trečiasis',3),('paskutinis',-1)] if k in rulepart)
            dt=nth(month,wd,ord_);rule={'type':'nth-weekday','month':month,'weekday':wd+1,'ordinal':ord_}
        ev=event(f'comm-{n:03}',dt,title,'legally_commemorative',SUMMARIES[n-1],['law'],rule,law_point=n,law_version='2026-07-04',provenance_note='Current official consolidated law; several named observances in one legal point remain together, not counted as separate holidays.')
        if n==45:ev['sources'].append('child')
        if n==1:ev['detail_url']='/sventes/lietuvos-veliavos-diena/'
        if n==3:ev['detail_url']='/sventes/sausio-13-oji/'
        events.append(ev)
    assert len(events)==101
    # Existing verified engine supplies statutory dates; do not fork those rules.
    year=json.loads((ROOT/'site/assets/data/years.json').read_text())
    if isinstance(year,dict):
        yy=year.get('2027') or next((x for x in year.get('years',[]) if x.get('year')==2027),None)
    else:yy=next(x for x in year if x['year']==2027)
    if yy is None:raise ValueError('2027 engine data missing')
    editorial=json.loads((ROOT/'data/holiday-editorial.json').read_text())
    articles=editorial['articles']+editorial['commemorations']
    holiday_rules={h['id']:h for h in json.loads((ROOT/'data/calendar.json').read_text())['holidays']}
    for h in yy['holidays']:
        article=next((a for a in articles if h['id'] in a.get('holiday_ids',[])),None)
        dt=date.fromisoformat(h['date']);source_ids=['dk']
        extra={'jonines':'jonines','assumption':'zoline','all-souls':'velines','christmas-eve':'kucios','easter':'easter','easter-monday':'easter'}.get(h['id'])
        if extra:source_ids.append(extra)
        rule=holiday_rules[h['id']]
        recurrence=({'type':'easter-offset','offset':rule.get('offset',0)} if rule.get('rule')=='easter' else {'type':'nth-weekday','month':rule['month'],'weekday':7,'ordinal':1} if rule.get('rule')=='first-sunday' else {'type':'fixed','month':dt.month,'day':dt.day})
        e=event('stat-'+h['id'],dt,h['name'],'statutory_holiday',article['summary'] if article else 'Darbo kodekso 123 straipsnyje nustatyta šventinė diena.',source_ids,recurrence,engine_holiday_id=h['id'],law_version='2027-01-01',tags=['nonworking'])
        if h['id']=='statehood':e['title']='Valstybės (Lietuvos karaliaus Mindaugo karūnavimo) ir Tautiškos giesmės diena'
        if h['id']=='assumption':e['title']='Žolinė (Švč. Mergelės Marijos ėmimo į dangų diena)'
        if article:e['detail_url']='/sventes/'+article['slug']+'/'
        events.append(e)
    extra=[
      ('three-kings','2027-01-06','Trys Karaliai','traditional_cultural','Tradicinis kalėdinio tarpušvenčio užbaigimas; tai nėra papildoma nedarbo diena.',['three-kings'],None),
      ('uzgavenes','2027-02-09','Užgavėnės','traditional_cultural','Žiemos palydų tradicija; data skaičiuojama likus 47 dienoms iki vakarietiškųjų Velykų.',['spring'],{'type':'easter-offset','offset':-47}),
      ('mother-language','2027-02-21','Tarptautinė gimtosios kalbos diena','international_observance','UNESCO kalendorinė data skirta kalbų įvairovei ir daugiakalbystei.',['mother-language'],None),
      ('book-carriers','2027-03-16','Knygnešio diena','traditional_cultural','Lietuvoje minima knygnešystės atminimo diena; jos nelaikome įstatymo nustatyta nedarbo diena.',['book-carriers'],None),
      ('palms','2027-03-21','Verbų sekmadienis','traditional_cultural','Sekmadienis likus savaitei iki vakarietiškųjų Velykų; verbų papročiai įvairuoja pagal regioną.',['spring','easter'],{'type':'easter-offset','offset':-7}),
      ('atvelykis','2027-04-04','Atvelykis (Vaikų Velykėlės)','traditional_cultural','Pirmasis sekmadienis po Velykų; vaikų žaidimai su margučiais pratęsia Velykų papročius.',['atvelykis','spring'],{'type':'easter-offset','offset':7}),
      ('earth','2027-04-22','Tarptautinė Motinos Žemės diena','international_observance','Jungtinių Tautų nustatyta balandžio data; jos nepainiojame su kovo 20-osios Žemės diena.',['earth'],None),
      ('world-book','2027-04-23','Pasaulinė knygos ir autorių teisių diena','international_observance','UNESCO diena, skirta skaitymui, knygoms ir autorių teisėms.',['world-book'],None),
      ('environment','2027-06-05','Pasaulinė aplinkos apsaugos diena','international_observance','Jungtinių Tautų kalendoriaus aplinkosaugos data; Lietuvoje papildomos nedarbo dienos nesuteikia.',['environment'],None),
    ]
    for id,ds,title,cat,summary,src,rule in extra:events.append(event(id,date.fromisoformat(ds),title,cat,summary,src,rule))
    for e in events:
        for s in e['sources']:assert s in SOURCES
        assert (not e['statutory_nonworking']) or e['engine_holiday_id']
    events.sort(key=lambda x:(x['date'],not x['statutory_nonworking'],x['id']))
    registry={'year':2027,'reviewed':'2026-10-17','timezone':'Europe/Vilnius','scope':'Visos 101 Atmintinų dienų įstatymo datos, visos 2027 m. DK 123 straipsnio šventinės dienos ir aiškiai pažymėtos atrinktos tradicijos bei tarptautinės dienos.','sources':SOURCES,'events':events,'omissions':['Neįtrauktos nepatvirtintos 2027 m. festivalių programos, Kliento ar Boso dienos be pirminio šaltinio, vardadieniai ir mokyklų atostogų spėjimai.','Astronominių momentų nedubliuojame; aktualiose mėnesių nuorodose pateikiamas esamas astronominis kalendorius.','Neatliekamas visų konfesijų liturginių kalendorių suvienodinimas.']}
    (ROOT/'data/monthly-holidays-2027.json').write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n')
    print('Registry:',len(events),'records;',len(yy['holidays']),'statutory dates;101 official commemorative entries;9 additional verified observances.')
if __name__=='__main__':create()
