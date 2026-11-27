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
 for y in range(2027, 2031):
  first=datetime.date.fromisocalendar(y,1,1)
  lastn=datetime.date(y,12,28).isocalendar().week
  last=datetime.date.fromisocalendar(y,lastn,7)
  jan=datetime.date(y,1,1).isocalendar()
  dec=datetime.date(y,12,31).isocalendar()
  body=f'''<h2>{y} metų savaitės per abi metų sandūras</h2>
<p>Pagal ISO {y} metai turi {lastn} savaites. Pirmos savaitės pirmadienis yra <time datetime="{first}">{first}</time>, paskutinės savaitės sekmadienis yra <time datetime="{last}">{last}</time>. Savaitė prasideda pirmadienį, o pirmoji ISO metų savaitė apima sausio 4-ąją.</p>
<ul><li><strong>{y} m. sausio 1 d.</strong> priklauso {jan.year} m. {jan.week} savaitei.</li><li><strong>{y} m. gruodžio 31 d.</strong> priklauso {dec.year} m. {dec.week} savaitei.</li></ul>
<p>Norėdami patikrinti, kaip savaitės numeruojamos kitoje programoje, palyginkite šias dvi datas. Jei užduotis turi konkretų terminą, prie savaitės numerio įrašykite galutinę datą. Darbo laikui naudokite <a href="/darbo-dienos/{y}/">{y} m. darbo dienų kalendorių</a>. Daugiau pavyzdžių rasite <a href="/blogas/iso-savaiciu-numeriai/">gide apie ISO savaites</a>.</p>'''
  append(f'savaites/{y}',body);changed.append(f'savaites/{y}')
 home='''<h2>Kaip suplanuoti keturias laisvas dienas per Vasario 16-ąją?</h2>
<p><a href="/sventes/vasario-16-oji/">2027 m. Vasario 16-oji</a> yra antradienis. Jei dirbate pirmadieniais–penktadieniais ir galite pasiimti atostogų vasario 15 d., kartu su savaitgaliu susidaro keturios laisvos dienos nuo vasario 13 iki 16 d. Jei dirbate pamainomis, pirmiausia tikrinkite savo darbo grafiką.</p>
<p><a href="/2027/vasaris/">Vasario kalendoriuje</a> pasižymėkite datas arba atsisiųskite PDF, jei planu norite dalytis ant popieriaus. Rinkdamiesi miestą palyginkite <a href="/orai/miestai/">jo orų prognozę</a> vienodoms atvykimo ir grįžimo valandoms. Mėnesio klimato normos padeda rinktis sezoną, o kelionei artėjant labiau praverčia konkrečios dienos prognozė.</p>
<p>Savo įvykius į kitą kalendorių perkelkite naudodami ICS failą. Jei norite atkurti ir užrašus bei užduotis, atsisiųskite JSON atsarginę kopiją iš skilties „Jūsų kalendorius“.</p>'''
 append('',home);changed.append('/')
 (ROOT/'docs/adsense/enriched-routes.json').write_text(json.dumps(changed,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'enriched_routes':len(changed)}))
if __name__=='__main__':prepare()
