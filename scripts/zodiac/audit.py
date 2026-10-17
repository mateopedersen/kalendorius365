"""Independent static/semantic, Lithuanian typography and preservation QA."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import json, hashlib, unicodedata, re, sys
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[2]
class Page(HTMLParser):
 def __init__(self):super().__init__();self.tags=[];self.text=[];self.headings=[];self.level=None
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);self.tags.append((tag,a))
  if re.fullmatch('h[1-6]',tag):self.headings.append(int(tag[1]))
 def handle_data(self,data):self.text.append(data)
def audit():
 signs=json.loads((ROOT/'site/_data/horoscope_signs.json').read_text());profiles=json.loads((ROOT/'site/_data/zodiac_profiles.json').read_text())
 routes=['/zodiakas/','/horoskopai/']+[f'/horoskopai/{s["key"]}/'for s in signs]
 results=[];titles=[];descriptions=[]
 for route in routes:
  source=(ROOT/'public'/route.lstrip('/')/'index.html').read_text();p=Page();p.feed(source)
  assert p.headings.count(1)==1,(route,'H1')
  assert all(b<=a+1 for a,b in zip(p.headings,p.headings[1:])),(route,'heading jump',p.headings)
  assert next(a for t,a in p.tags if t=='html')['lang']=='lt'
  meta={a.get('name',a.get('property')):a.get('content')for t,a in p.tags if t=='meta'}
  assert meta['robots']=='index, follow';descriptions.append(meta['description'])
  assert next(a['href']for t,a in p.tags if t=='link'and a.get('rel')=='canonical')=='https://kalendorius365.lt'+route
  title=re.search(r'<title>(.*?)</title>',source,re.S).group(1);titles.append(title)
  expected_css = 'zodiac-guide.css?v=' if route == '/zodiakas/' else ('horoscope-hub.css?v=' if route == '/horoskopai/' else 'horoscope-detail.css?v=')
  assert expected_css in source,(route,'route CSS bundle')
  visible=' '.join(p.text);assert unicodedata.normalize('NFC',visible)==visible
  assert not re.search(r'\b(?:Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces|Lorem ipsum)\b',visible),(route,'English or placeholder')
  for tag,a in p.tags:
   if tag=='img':
    assert 'alt'in a and 'width'in a and 'height'in a,(route,'image attributes')
    if not a['alt']:assert a.get('aria-hidden')=='true',(route,'unexplained blank alt')
   if tag in ['a','img','use','script','link']:
    url=a.get('href',a.get('src',''));u=urlsplit(url)
    if not u.scheme and u.path.startswith('/'):
     target=ROOT/'public'/u.path.lstrip('/');assert target.exists(),(route,url)
  assert 'FAQPage'not in source and 'AggregateRating'not in source
  if route not in routes[:2]:
   assert source.count('class="z-sign-profile"')==1 and source.count('id="ascendant-form"')==1
   assert 'aria-label="Ankstesnis ir kitas zodiako ženklas"'in source
  results.append({'route':route,'status':'passed','h1':1,'headings':p.headings,'canonical':True,'indexable':True,'lithuanian_nfc':True})
 assert len(set(titles))==14 and len(set(descriptions))==14
 ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9'}
 sitemap={x.text for x in ET.parse(ROOT/'public/sitemap.xml').findall('s:url/s:loc',ns)}
 assert all('https://kalendorius365.lt'+r in sitemap for r in routes)
 for file in (ROOT/'site/assets/visuals/zodiac').glob('*.svg'):
  data=file.read_text();tree=ET.fromstring(data)
  assert not re.search(r'<(?:script|foreignObject|image)\b|https?://(?!www.w3.org)',data),file
  assert tree.find('{http://www.w3.org/2000/svg}title')is not None
  ids=[el.get('id')for el in tree.iter()if el.get('id')];assert len(ids)==len(set(ids)),file
  assert all(ref in ids for ref in re.findall(r'url\(#([^)]*)\)',data)),file
  assert file.stat().st_size<180000,(file,'oversized SVG')
 sprite=ET.parse(ROOT/'site/assets/visuals/zodiac-signs.svg').getroot()
 assert {el.get('id')for el in sprite.findall('{http://www.w3.org/2000/svg}symbol')}=={f'zodiac-{key}'for key in profiles}
 assert 'localStorage'not in (ROOT/'site/assets/zodiac.js').read_text()
 return {'status':'passed','canonical_pages_total':len(sitemap),'phase4_pages':results,'unique_titles':14,'unique_descriptions':14,'svg_security':'passed','calendar_downloads':len(list((ROOT/'public/downloads').rglob('*.*')))}
if __name__=='__main__':print(json.dumps(audit(),ensure_ascii=False,indent=2))
