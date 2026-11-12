#!/usr/bin/env python3
"""Attach reviewed, route-specific help after the existing page generators."""
from pathlib import Path
import re,datetime,json,html,calendar
ROOT=Path(__file__).resolve().parents[2];SITE=ROOT/'site'
def append(route,body):
 p=SITE/route/'index.html' if route else SITE/'index.html';s=p.read_text()
 # Both editorial passes run on persistent sources. Keep this section before
 # the later catalogue note so their replacement cannot accumulate whitespace.
 prefix,marker,tail=s.partition('<!-- K365_EDITORIAL_V2_START -->')
 prefix=re.sub(r'\s*<section data-editorial-extension="20261103".*?</section>\s*', '\n',prefix,flags=re.S)
 s=prefix.rstrip()+'\n\n<section data-editorial-extension="20261103" class="panel content-guide">'+body+'</section>\n'
 if marker:s+='\n'+marker+tail
 p.write_text(s)
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
 home='''<h2>Kaip naudotis kalendoriumi?</h2>
<p>Pasirinkite dieną mėnesio tinklelyje. Šalia kalendoriaus matysite tos dienos įvykius ir užrašus. Rinkitės savaitės vaizdą, jei lyginate kelių dienų planus, o darbotvarkę, jei norite įvykius skaityti iš eilės.</p>
<h3>Šventės ir laisvadieniai</h3>
<p><a href="/sventes/">Švenčių kalendoriuje</a> šventinės ir atmintinos dienos pažymėtos atskirai. Planuodami poilsį <a href="/atostogu-planavimas/">atostogų planuoklyje</a> pasirinkite savo darbo savaitę ir įrašykite, kiek atostogų dienų turite.</p>
<h3>Spausdinimas ir atsarginė kopija</h3>
<p>Spausdinti galite <a href="/menesiai/">vieno mėnesio</a> arba <a href="/metai/">visų metų kalendorių</a>. Pasirinkę patinkantį maketą atsisiųskite PDF. Savo įvykius į kitą kalendorių perkelsite naudodami ICS failą. Jei norite perkelti ir užrašus bei užduotis, išsaugokite JSON kopiją ir atkurkite ją kito įrenginio naršyklėje.</p>'''
 append('',home);changed.append('/')
 (ROOT/'docs/adsense/enriched-routes.json').write_text(json.dumps(changed,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'enriched_routes':len(changed)}))
if __name__=='__main__':prepare()
