from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import struct
import re
import json
ROOT=Path(__file__).resolve().parents[1];PUBLIC=ROOT/'public'
# Detail guides use verified, uncropped photographic Open Graph images.
# Every other page retains the existing 1200x630 PNG contract.
_detail=json.loads((ROOT/'data/holiday-phase2.json').read_text())
_old=json.loads((ROOT/'data/holiday-editorial.json').read_text())
DETAIL_MEDIA={'https://kalendorius365.lt/sventes/'+a['slug']+'/':_detail['media'][a['id']] for a in _old['articles']+_old['commemorations']+_detail['articles']}
assert len(DETAIL_MEDIA)==31

def webp_dimensions(data):
 assert data[:4]==b'RIFF' and data[8:12]==b'WEBP'
 chunk=data[12:16]
 if chunk==b'VP8X':return (1+int.from_bytes(data[24:27],'little'),1+int.from_bytes(data[27:30],'little'))
 if chunk==b'VP8 ':
  assert data[23:26]==b'\x9d\x01\x2a'
  return tuple(n&0x3fff for n in struct.unpack('<HH',data[26:30]))
 assert chunk==b'VP8L' and data[20]==0x2f
 bits=int.from_bytes(data[21:25],'little');return (1+(bits&0x3fff),1+((bits>>14)&0x3fff))

class Page(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.h1=0;self.meta={};self.named_meta={};self.properties={};self.canonical=None;self.title='';self.in_title=False;self.ids=set();self.jsonld=[];self.inscript=False
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.add(a['id'])
  if tag=='h1':self.h1+=1
  if tag=='title':self.in_title=True
  if tag=='meta' and 'name' in a:self.meta[a['name']]=a.get('content','');self.named_meta.setdefault(a['name'],[]).append(a.get('content',''))
  if tag=='meta' and 'property' in a:self.properties.setdefault(a['property'],[]).append(a.get('content',''))
  if tag=='link' and a.get('rel')=='canonical':self.canonical=a.get('href')
  if tag in ['a','img','script','link']:
   url=a.get('href') if tag in ['a','link'] else a.get('src')
   if url:self.links.append(url)
  # Responsive image candidates are real requests too; checking only img[src]
  # misses missing files selected by the browser at smaller widths or higher DPR.
  for candidate in a.get('srcset','').split(','):
   parts=candidate.strip().split()
   if parts:self.links.append(parts[0])
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
 for key in ('og:type','og:locale','og:site_name','og:title','og:description','og:url','og:image','og:image:type','og:image:width','og:image:height','og:image:alt'):
  assert len(p.properties.get(key,[]))==1 and p.properties[key][0],(path,key,p.properties.get(key))
 media=DETAIL_MEDIA.get(p.canonical)
 assert p.properties['og:type']==['article' if media else 'website'] and p.properties['og:locale']==['lt_LT'],path
 assert p.properties['og:url']==[p.canonical],(path,p.properties['og:url'],p.canonical)
 expected_dimensions=(media['width'],media['height']) if media else (1200,630)
 assert p.properties['og:image:type']==['image/webp' if media else 'image/png'],path
 assert (int(p.properties['og:image:width'][0]),int(p.properties['og:image:height'][0]))==expected_dimensions,path
 if media:assert p.properties['og:image']==['https://kalendorius365.lt'+media['src']] and p.properties['og:image:alt']==[media['caption']],path
 for key in ('twitter:card','twitter:title','twitter:description','twitter:image','twitter:image:alt'):
  assert len(p.named_meta.get(key,[]))==1 and p.named_meta[key][0],(path,key,p.named_meta.get(key))
 assert p.meta.get('twitter:card')=='summary_large_image',path
 assert p.meta.get('twitter:image')==p.properties['og:image'][0],path
 assert p.meta.get('twitter:image:alt')==p.properties['og:image:alt'][0],path
 image_url=urlsplit(p.properties['og:image'][0])
 assert image_url.scheme=='https' and image_url.netloc=='kalendorius365.lt' and image_url.path.startswith('/assets/'),(path,p.properties['og:image'][0])
 image_path=PUBLIC/unquote(image_url.path).lstrip('/')
 assert image_path.is_file(),(path,p.properties['og:image'][0])
 image_data=image_path.read_bytes()
 if media:assert webp_dimensions(image_data)==expected_dimensions,(path,image_path)
 else:assert image_data[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',image_data[16:24])==(1200,630),(path,image_path)
 assert image_path.stat().st_size<=300_000,(path,image_path,image_path.stat().st_size)
 assert p.meta.get('twitter:title')==p.properties['og:title'][0] and p.meta.get('twitter:description')==p.properties['og:description'][0],path
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
manifest=json.loads((ROOT/'site/assets/data/manifest.json').read_text())['assets']
for unused in ('manifest.json','years.json','catalog.json'):
 assert not (PUBLIC/'assets/data'/unused).exists(),f'Build-only or obsolete browser payload was published: {unused}'
compact=(PUBLIC/'assets/data/home-holiday-data.json').read_bytes()
full=(PUBLIC/'assets/data/holiday-editorial.json').read_bytes()
assert len(compact)<len(full)*0.5,(len(compact),len(full))
headers=(PUBLIC/'_headers').read_text()
header_paths=[line for line in headers.splitlines() if line.startswith('/')]
assert len(header_paths)==len(set(header_paths)),'Duplicate _headers path rules could combine Cache-Control headers'
assert '/assets/*' not in header_paths,'Broad assets rule overlaps specific cache rules'
assert len(header_paths)<=100,'Cloudflare Pages supports at most 100 header rules'
release_manifest=json.loads((PUBLIC/'assets/release-manifest.json').read_text())
release_prefix='/assets/releases/'+release_manifest['revision']+'/'
assert '/assets/releases/*\n  Cache-Control: public, max-age=31536000, immutable' in headers
import hashlib
for original,item in release_manifest['assets'].items():
 assert item['url'].startswith(release_prefix),(original,item)
 assert hashlib.sha256((PUBLIC/item['url'].lstrip('/')).read_bytes()).hexdigest()==item['sha256'],item
for path in list((PUBLIC/'assets').rglob('*.js'))+list((PUBLIC/'assets').rglob('*.css')):
 fingerprinted='/assets/releases/' in str(path)
 if not fingerprinted:
  assert f'/{path.relative_to(PUBLIC)}\n  Cache-Control: public, no-cache, max-age=0, must-revalidate' in headers,path
 content=path.read_text()
 for match in re.finditer(r'\b(?:from\s*|import\s*(?:\(\s*)?)(["\'])([^"\']+\.js(?:\?[^"\']*)?)\1',content):
  specifier=match.group(2)
  if specifier.startswith(('./','../','/')):
   # Relative imports are safe within a revision directory. Compatibility
   # modules must import the immutable directory explicitly.
   assert (fingerprinted and specifier.startswith(('./','../'))) or specifier.startswith('/assets/releases/'),(path,specifier)
   parsed=urlsplit(specifier)
   target=PUBLIC/parsed.path.lstrip('/') if specifier.startswith('/') else path.parent/parsed.path
   assert target.is_file(),(path,specifier)
for path,page in pages.items():
 for url in page.links:
  parsed=urlsplit(url)
  if parsed.scheme or parsed.netloc:continue
  if parsed.path.startswith('/assets/') and parsed.path.endswith(('.js','.css','.woff2')):
   assert parsed.path.startswith(release_prefix),(path,url)
for original in release_manifest['assets']:
 if original.startswith('/assets/data/'):
  assert f'{original}\n  Cache-Control: public, no-cache, max-age=0, must-revalidate' in headers,original
for y in [2027,2028,2029]:
 for m in range(1,13):
  slug=json.loads((ROOT/'data/calendar.json').read_text())['months'][m-1][0];path=PUBLIC/str(y)/slug/'index.html';html=path.read_text();assert html.count('<article class="design-card')==10
  for e in manifest:
   if e['kind']=='monthly' and e['year']==y and e['month']==m:assert e['pdf'] in html and e['webp'] in html and e['preview'] in html
print(f'PASS: {len(files)} HTML files (including 404), {len(files)-1} canonical landing pages; {links} local targets; 0 broken links; unique metadata, one H1, language, canonical, image attributes, Open Graph/Twitter image metadata, 1200x630 default PNG and exact original-ratio detail WebP, JSON-LD and 360 monthly mappings.')
if '--release' in __import__('sys').argv:
 import xml.etree.ElementTree as ET
 for path,p in pages.items():
  assert p.meta.get('robots')==('noindex, follow' if path.name=='404.html' else 'index, follow'),path
 headers=(PUBLIC/'_headers').read_text();assert 'X-Robots-Tag: noindex' not in headers
 xml=ET.parse(PUBLIC/'sitemap.xml');ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9','i':'http://www.google.com/schemas/sitemap-image/1.1'}
 sitemap={e.text for e in xml.findall('.//s:loc',ns)};canonical={p.canonical for path,p in pages.items() if path.name!='404.html'}
 assert sitemap==canonical and len(sitemap)==len(pages)-1
 assert len(xml.findall('.//i:loc',ns))==360
 print(f'PASS: release indexing, 404 noindex, {len(sitemap)} sitemap canonicals, 360 monthly image entries, and no global noindex header.')
