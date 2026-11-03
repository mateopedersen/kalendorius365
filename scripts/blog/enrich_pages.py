#!/usr/bin/env python3
"""Attach reviewed, route-specific help after the existing page generators."""
from pathlib import Path
import re,datetime,json,html,calendar
ROOT=Path(__file__).resolve().parents[2];SITE=ROOT/'site'
def append(route,body):
 p=SITE/route/'index.html' if route else SITE/'index.html';s=p.read_text()
 s=re.sub(r'\n<section data-editorial-extension="20261103".*?</section>\n?', '\n',s,flags=re.S)
 s+='\n<section data-editorial-extension="20261103" class="panel content-guide">'+body+'</section>\n';p.write_text(s)
def prepare():
 changed=[]
 for b in (ROOT/'data/blog/page-guides.txt').read_text().split('@@ ')[1:]:
  route,rest=b.split('\n',1);heading,text=rest.strip().removeprefix('## ').split('\n',1)
  body='<h2>'+heading+'</h2>'+''.join('<p>'+p+'</p>'for p in text.strip().split('\n\n'))
  append(route.strip(),body);changed.append(route.strip())
 for y in (2027,2028,2029):
  first=datetime.date.fromisocalendar(y,1,1);lastn=datetime.date(y,12,28).isocalendar().week;last=datetime.date.fromisocalendar(y,lastn,7);jan=datetime.date(y,1,1).isocalendar()
  body=f'''<h2>Kaip skaityti {y} metų savaičių lentelę?</h2>
<p>Šioje lentelėje pateiktos {y} metų ISO savaitės. Savaitė prasideda pirmadienį ir baigiasi sekmadienį. Pirmoji savaitė yra ta, kurioje yra pirmasis metų ketvirtadienis, arba, lygiaverčiai, sausio ketvirtoji. Todėl savaitės metai ne visada sutampa su konkrečios dienos kalendoriniais metais. Šį skirtumą svarbu suprasti metų sandūroje, kai šalia sausio dienos matote dar praėjusių metų savaitės numerį arba gruodžio pabaigos data jau priskiriama kitų metų pirmajai savaitei.</p>
<p>{y} savaitės metai turi {lastn} savaites. Pirmos savaitės pirmadienis yra {first.isoformat()}, o paskutinės savaitės sekmadienis – {last.isoformat()}. Kalendorinė sausio pirmoji šiuo atveju priklauso {jan.year} savaitės metų {jan.week} savaitei. Šios ribos apskaičiuotos pagal ISO savaitės taisyklę. Jos neperrašomos vien tam, kad visi laikotarpiai tilptų tarp sausio pirmosios ir gruodžio paskutinės dienos: visa septynių dienų savaitė turi išlaikyti bendrą numerį ir savo savaitės metus.</p>
<h3>Ataskaitai pridėkite ir konkrečias datas</h3>
<p>Jei planą perduodate kitam žmogui, užrašykite ne tik savaitės numerį, bet ir pirmadienio bei sekmadienio intervalą. Pavyzdžiui, pirmoji čia rodoma savaitė tęsiasi nuo {first.isoformat()} iki {(first+datetime.timedelta(days=6)).isoformat()}. Toks užrašas suprantamas ir gavėjui, kurio programa numerių nerodo arba taiko kitą pirmos savaitės sistemą. Jei užduotis turi tikslų pateikimo terminą, palikite ir atskirą galutinę datą, nes bendras savaitės intervalas pats nepasako, kurią dieną darbas turi būti užbaigtas.</p>
<p>ISO savaitės numeris nėra darbo dienų skaičius. Savaitėje visada septynios dienos, tačiau jūsų darbo grafikas, šventės ir asmeninis užimtumas gali skirtis. Darbo laikui naudokite jam skirtą metų skaičiuoklę su aiškiomis prielaidomis. Pamainų ciklas gali tęstis per savaitgalį, todėl vien penkių pirmų lentelės datų nepakanka kiekvieno darbuotojo grafikui nustatyti. Savaitės lentelė padeda sutarti laikotarpį, o individualios darbo sąlygos tikrinamos atskirai pagal realų patvirtintą planą ir taikomą darbo režimą.</p>
<h3>Kaip patikrinti kitos programos rezultatą?</h3>
<p>Palyginimui pasirinkite sausio pirmąją arba gruodžio paskutinę dieną. Metų viduryje skirtingos numeravimo sistemos gali atrodyti panašiai, todėl ribinis pavyzdys aiškiau parodo jų taisykles. Patikrinkite ne vien savaitės pradžios dieną, bet ir tai, kaip nustatoma pati pirma metų savaitė. Pirmadienis pirmame stulpelyje savaime dar nepatvirtina ISO numeracijos. Jei skaičiai nesutampa, pirmiausia išsiaiškinkite abiejų įrankių nustatymus, o ne rankomis pernumeruokite visą jau parengtą mėnesio arba metų planą.</p>
<p>Išsamesnį metų sandūros pavyzdį pateikiame <a href="/blogas/iso-savaiciu-numeriai/">gide apie ISO savaites</a>. Spausdindami lentelę peržiūrėkite pradžios ir pabaigos stulpelius: jie turi likti aiškiai susieti su tuo pačiu numeriu. Prie išsaugoto lapo nurodykite metus, kad vėliau jo nesupainiotumėte su kito laikotarpio kopija. Taip savaitės numeriai išlieka patogiu bendro planavimo orientyru, o ne papildomu neaiškių datų šaltiniu jūsų susitarimuose.</p>'''
  append(f'savaites/{y}',body);changed.append(f'savaites/{y}')
 home='''<h2>Nuo datos iki savo plano: kaip naudotis Kalendorius365?</h2>
<p>Jei atėjote sužinoti, kokia šiandien diena arba kada bus artimiausia Lietuvos šventė, pradėkite nuo kalendoriaus ir pasirinktos datos. Vieši švenčių duomenys padeda orientuotis, o asmeninį įvykį, užduotį ar užrašą galite pridėti patys. Kalendoriaus vaizdas parodo bendrą dienos ritmą; tiksliam susitarimui įrašykite pradžią, pabaigą ir vietą, jei ji reikalinga. Vien datos langelis nepasako, kiek laiko užims pasiruošimas arba kelionė.</p>
<h3>Pasirinkite tokį vaizdą, kuris atsako į jūsų klausimą</h3>
<p>Mėnesio vaizdas patogus ieškant laisvo savaitgalio ar palyginant kelias svarbias datas. Savaitės ir dienos vaizdai padeda sudėti konkrečius laikus. Metų apžvalga naudinga ilgesniems laikotarpiams, o darbotvarkėje galite peržvelgti įvykių seką. Jei norite popierinio lapo, rinkitės <a href="/menesiai/">paruoštą mėnesio kalendorių</a> arba <a href="/metai/">metų maketą</a>. Galerijos peržiūra skirta pasirinkti dizainą; kokybiškam spausdinimui atsisiųskite tikrą PDF.</p>
<p>Šventinės ir atmintinos dienos rodomos kaip skirtingos informacijos grupės. Kultūrinė proga nebūtinai yra nedarbo diena, o viešas švenčių kalendorius nepakeičia jūsų patvirtinto pamainų ar atostogų grafiko. Planuodami poilsį patikrinkite ir konkrečius susitarimus. <a href="/atostogu-planavimas/">Atostogų planuoklyje</a> nurodykite tikrą darbo savaitę bei turimą likutį, o pasiūlytą intervalą patvirtinkite prieš rezervuodami kelionę arba pažadėdami laiką kitiems žmonėms.</p>
<h3>Datos įrankį naudokite su aiškiomis prielaidomis</h3>
<p>Norėdami suskaičiuoti laikotarpį, pirmiausia nuspręskite, ar įtraukiate abi ribines datas ir ar reikia kalendorinių, ar darbo dienų. Nuo pirmadienio iki trečiadienio praeina dvi paros, tačiau pažymėjus visas tris kalendorines datas gaunamas kitas skaičius. Metų sandūroje atskirai tikrinkite ISO savaičių metus. Astronomijos puslapiuose pasirinkite miestą, metus ir laiko juostą: toks pats momentas skirtinguose šaltiniuose gali būti užrašytas kita vietine valanda.</p>
<h3>Savo įrašų kopija pasirūpinkite patys</h3>
<p>Asmeninis kalendorius lieka jūsų naudojamoje naršyklėje. Jis automatiškai neatsiranda kitame telefone arba kompiuteryje. Prieš valydami naršyklės duomenis ar keisdami įrenginį atsisiųskite JSON atsarginę kopiją ir patikrinkite, kad failas išsaugotas. ICS eksportas skirtas įvykiams perduoti, tačiau nėra tas pats, kas visų užduočių, užrašų ir nuostatų kopija. Eksportuotus failus laikykite privačiai, nes juose gali būti jūsų pačių įrašytų asmeninių detalių.</p>
<p>Jei kalendorių rodote bendrame ekrane arba siunčiate jo nuotrauką, palikite tik gavėjui reikalingą informaciją. Svetainės leidėjas nemato naršyklėje saugomų planų ir negali jų nuotoliniu būdu atkurti. Pranešdami apie klaidą atsiųskite viešo puslapio adresą bei problemos aprašymą, o ne savo atsarginę kopiją. <a href="/privatumas/">Privatumo politikoje</a> išsamiai paaiškiname vietinį saugojimą, orų duomenų užklausas ir įprastus tinklo metaduomenis.</p>
<p>Ieškote išsamesnio pavyzdžio? <a href="/blogas/">Kalendoriaus užrašuose</a> rasite praktinius gidus apie spausdinimą, savaičių numerius, Mėnulio fazes ir kasdienį planavimą. Už svetainę atsakingas leidėjas <a href="/autoriai/julius-vainauskas/">Julius Vainauskas</a>; turinio rengimo principai ir kontaktai pateikti atskiruose puslapiuose.</p>'''
 append('',home);changed.append('/')
 (ROOT/'docs/adsense/enriched-routes.json').write_text(json.dumps(changed,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'enriched_routes':len(changed)}))
if __name__=='__main__':prepare()
