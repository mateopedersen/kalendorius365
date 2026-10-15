from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json
ROOT=Path(__file__).resolve().parents[1];PUBLIC=ROOT/'public'
class Page(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.h1=0;self.meta={};self.canonical=None;self.title='';self.in_title=False;self.ids=set();self.jsonld=[];self.inscript=False
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.add(a['id'])
  if tag=='h1':self.h1+=1
  if tag=='title':self.in_title=True
  if tag=='meta' and 'name' in a:self.meta[a['name']]=a.get('content','')
  if tag=='link' and a.get('rel')=='canonical':self.canonical=a.get('href')
  if tag in ['a','img','script','link']:
   url=a.get('href') if tag in ['a','link'] else a.get('src')
   if url:self.links.append(url)
  if tag=='img':assert (a.get('alt') or (a.get('alt') == '' and a.get('aria-hidden') == 'true')) and a.get('width') and a.get('height'),a
  if tag=='script' and a.get('type')=='application/ld+json':self.inscript=True
 def handle_endtag(self,tag):
  if tag=='title':self.in_title=False
  if tag=='script':self.inscript=False
 def handle_data(self,s):
  if self.in_title:self.title+=s
  if self.inscript:self.jsonld.append(s)
files=list(PUBLIC.rglob('*.html'));pages={};titles=set();descs=set();links=0;fail=[]
for path in files:
 p=Page();p.feed(path.read_text());pages[path]=p
 assert p.h1==1,(path,p.h1)
 assert p.title not in titles,path;titles.add(p.title)
 assert p.meta.get('description') and p.meta['description'] not in descs,path;descs.add(p.meta['description'])
 assert p.canonical.startswith('https://kalendorius365.lt/'),path
 assert '<html lang="lt">' in path.read_text(),path
 for text in p.jsonld:json.loads(text)
for path,p in pages.items():
 for url in p.links:
  parsed=urlsplit(url)
  if parsed.scheme or parsed.netloc or url.startswith('mailto:'):continue
  target=(PUBLIC/unquote(parsed.path).lstrip('/')) if parsed.path.startswith('/') else path.parent/unquote(parsed.path)
  if not parsed.path:target=path
  if target.is_dir():target=target/'index.html'
  links+=1
  if not target.exists():fail.append((str(path.relative_to(PUBLIC)),url))
  if parsed.fragment and target in pages and parsed.fragment not in pages[target].ids:fail.append((str(path.relative_to(PUBLIC)),url+' (anchor missing)'))
assert not fail,json.dumps(fail[:30])
manifest=json.loads((PUBLIC/'assets/data/manifest.json').read_text())['assets']
for y in [2027,2028]:
 for m in range(1,13):
  slug=json.loads((ROOT/'data/calendar.json').read_text())['months'][m-1][0];path=PUBLIC/str(y)/slug/'index.html';html=path.read_text();assert html.count('<article class="design-card')==10
  for e in manifest:
   if e['kind']=='monthly' and e['year']==y and e['month']==m:assert e['pdf'] in html and e['webp'] in html and e['preview'] in html
print(f'PASS: {len(files)} HTML files (including 404), {len(files)-1} canonical landing pages; {links} local targets; 0 broken links; unique metadata, one H1, language, canonical, image attributes, JSON-LD and 240 monthly mappings.')
if '--release' in __import__('sys').argv:
 import xml.etree.ElementTree as ET
 for path,p in pages.items():
  assert p.meta.get('robots')==('noindex, follow' if path.name=='404.html' else 'index, follow'),path
 headers=(PUBLIC/'_headers').read_text();assert 'X-Robots-Tag: noindex' not in headers
 xml=ET.parse(PUBLIC/'sitemap.xml');ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9','i':'http://www.google.com/schemas/sitemap-image/1.1'}
 sitemap={e.text for e in xml.findall('.//s:loc',ns)};canonical={p.canonical for path,p in pages.items() if path.name!='404.html'}
 assert sitemap==canonical and len(sitemap)==41
 assert len(xml.findall('.//i:loc',ns))==240
 print('PASS: release indexing, 404 noindex, 41 sitemap canonicals, 240 image entries, and no global noindex header.')
