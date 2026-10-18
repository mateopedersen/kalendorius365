from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote,urljoin
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
 def __init__(self):super().__init__();self.links=[];self.anchor_links=[];self.h1=0;self.meta={};self.named_meta={};self.properties={};self.canonical=None;self.title='';self.in_title=False;self.ids=set();self.jsonld=[];self.inscript=False
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.add(a['id'])
  if tag=='h1':self.h1+=1
  if tag=='title':self.in_title=True
  if tag=='meta' and 'name' in a:self.meta[a['name']]=a.get('content','');self.named_meta.setdefault(a['name'],[]).append(a.get('content',''))
  if tag=='meta' and 'property' in a:self.properties.setdefault(a['property'],[]).append(a.get('content',''))
  if tag=='link' and a.get('rel')=='canonical':self.canonical=a.get('href')
  if tag=='a' and a.get('href'):self.anchor_links.append(a['href'])
  if tag in ['a','img','script','link']:
   url=a.get('href') if tag in ['a','link'] else a.get('src')
   if url:self.links.append(url)
  # Some galleries expose alternate print files through data attributes and
  # update the visible download buttons when a variant is selected. Treat
  # those destinations as local links too, so the audit checks every option.
  for key in ('data-pdf','data-webp','data-preview','data-small-preview'):
   if a.get(key):self.links.append(a[key])
  # Responsive image candidates are real requests too; checking only img[src]
  # misses missing files selected by the browser at smaller widths or higher DPR.
  # A standalone data URI contains a comma inside its URL, not another file.
  candidates=[] if a.get('srcset','').strip().startswith('data:') else a.get('srcset','').split(',')
  for candidate in candidates:
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
public_pages={p.canonical:path for path,p in pages.items() if path.name!='404.html'}
route_pages={urlsplit(canonical).path:canonical for canonical in public_pages}
graph={canonical:set() for canonical in public_pages}
for path,p in pages.items():
 if path.name=='404.html':continue
 for href in p.anchor_links:
  target=urlsplit(urljoin(p.canonical,href))
  if target.scheme!='https' or target.netloc!='kalendorius365.lt':continue
  route=target.path
  if not route.endswith('/') and not Path(route).suffix:route+='/'
  if route in route_pages:graph[p.canonical].add(route_pages[route])
start=next((canonical for canonical,path in public_pages.items() if path==PUBLIC/'index.html'),None)
assert start,'Homepage canonical missing from public page graph'
reachable={start};pending=[start]
while pending:
 for target in graph[pending.pop()]:
  if target not in reachable:reachable.add(target);pending.append(target)
orphans=sorted(set(public_pages)-reachable)
assert not orphans,'Public pages are unreachable through crawlable internal links: '+json.dumps([str(public_pages[u].relative_to(PUBLIC)) for u in orphans[:30]])
print(f'PASS: {len(reachable)} public pages are reachable from the homepage through crawlable internal links; 0 orphans.')
manifest=json.loads((ROOT/'site/assets/data/manifest.json').read_text())['assets']
for unused in ('manifest.json','years.json','catalog.json'):
 assert not (PUBLIC/'assets/data'/unused).exists(),f'Build-only or obsolete browser payload was published: {unused}'
compact=(PUBLIC/'assets/data/home-holiday-data.json').read_bytes()
full=(PUBLIC/'assets/data/holiday-editorial.json').read_bytes()
assert len(compact)<len(full)*0.5,(len(compact),len(full))
headers=(PUBLIC/'_headers').read_text()
header_paths=[line for line in headers.splitlines() if line.startswith('/')]
assert len(header_paths)==len(set(header_paths)),'Duplicate _headers path rules could combine Cache-Control headers'
assert all(path.count('*')<=1 for path in header_paths),'Cloudflare Pages _headers supports at most one splat per path rule'
assert not any(p.startswith('/assets/calendar-editor/') and p!='/assets/calendar-editor/*' for p in header_paths),'Overlapping editor cache rules'
assert len(header_paths)<=100,'Cloudflare Pages supports at most 100 header rules'
assert '/assets/*' not in header_paths,'Broad assets rule overlaps specific cache rules'
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
  relative_asset=path.relative_to(PUBLIC/'assets')
  editor_versioned=relative_asset.parts[0].startswith('calendar-editor-release-')
  if path.is_relative_to(PUBLIC/'assets/calendar-editor'):
   cache_path='/assets/calendar-editor/*'
   cache_value='Cache-Control: public, no-cache, max-age=0, must-revalidate'
  elif editor_versioned:
   cache_path=f'/assets/{relative_asset.parts[0]}/*'
   cache_value='Cache-Control: public, max-age=31536000, immutable'
  else:
   cache_path=f'/{path.relative_to(PUBLIC)}'
   cache_value='Cache-Control: public, no-cache, max-age=0, must-revalidate'
  assert f'{cache_path}\n  {cache_value}' in headers,path

 content=path.read_text()
 for match in re.finditer(r'\b(?:from\s*|import\s*(?:\(\s*)?)(["\'])([^"\']+\.js(?:\?[^"\']*)?)\1',content):
  specifier=match.group(2)
  if specifier.startswith(('./','../','/')):
   # Relative imports are safe within a revision directory. Compatibility
   # modules must import the immutable directory explicitly.
   assert (fingerprinted and specifier.startswith(('./','../'))) or specifier.startswith('/assets/releases/') or '?v=' in specifier,(path,specifier)
   parsed=urlsplit(specifier)
   target=PUBLIC/parsed.path.lstrip('/') if specifier.startswith('/') else path.parent/parsed.path
   assert target.is_file(),(path,specifier)
font_files=list((PUBLIC/'assets/fonts').glob('*.woff*'))+list((PUBLIC/'assets/fonts').glob('*.ttf'))
font_wildcard='/assets/fonts/*\n  Cache-Control: public, max-age=31536000, immutable'
if font_wildcard in headers:
 assert '/assets/fonts/*' in header_paths
 for path in font_files:
  assert f'/{path.relative_to(PUBLIC)}\n' not in headers,path
else:
 for path in font_files:
  assert f'/{path.relative_to(PUBLIC)}\n  Cache-Control: public, max-age=31536000, immutable' in headers,path
for path in font_files+[PUBLIC/'assets/lunar/albedo-web.webp']:
 assert path.is_file(),path
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
   if e['kind']=='monthly' and e['year']==y and e['month']==m:
    assert f"{e['pdf']}?v={e['files']['pdf']['sha256'][:16]}" in html
    assert f"{e['webp']}?v={e['files']['webp']['sha256'][:16]}" in html
    assert e['preview'] in html
all_local_links={url for page in pages.values() for url in page.links}
for asset in manifest:
 for kind in ('pdf','webp'):
  expected=f"{asset[kind]}?v={asset['files'][kind]['sha256'][:16]}"
  assert expected in all_local_links,('unversioned or missing print download link',asset['stem'],kind,expected)
print(f'PASS: {len(files)} HTML files (including 404), {len(files)-1} canonical landing pages; {links} local targets; 0 broken links; unique metadata, one H1, language, canonical, image attributes, Open Graph/Twitter image metadata, 1200x630 default PNG and exact original-ratio detail WebP, JSON-LD and 360 monthly mappings.')
if '--release' in __import__('sys').argv:
 import xml.etree.ElementTree as ET
 for path,p in pages.items():
  assert p.meta.get('robots')==('noindex, follow' if path.name=='404.html' else 'index, follow'),path
 headers=(PUBLIC/'_headers').read_text();assert 'X-Robots-Tag: noindex' not in headers
 ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9','i':'http://www.google.com/schemas/sitemap-image/1.1'}
 sitemap_path=PUBLIC/'sitemap.xml';root=ET.parse(sitemap_path).getroot()
 assert sitemap_path.stat().st_size<=50*1024*1024
 sitemap_files=[sitemap_path]
 if root.tag=='{'+ns['s']+'}sitemapindex':
  children=root.findall('s:sitemap/s:loc',ns);assert children
  for element in children:
   child_url=urlsplit(element.text or '')
   assert child_url.scheme=='https' and child_url.netloc=='kalendorius365.lt' and not child_url.query and not child_url.fragment
   assert re.fullmatch(r'/sitemap-[0-9]+\.xml',child_url.path),element.text
   child_path=PUBLIC/child_url.path.lstrip('/');assert child_path.is_file() and child_path.stat().st_size<=50*1024*1024
   sitemap_files.append(child_path)
  assert len(children)<=50_000
  docs=[ET.parse(path).getroot() for path in sitemap_files[1:]]
 else:
  assert root.tag=='{'+ns['s']+'}urlset'
  docs=[root]
 sitemap=[];image_urls=[]
 for doc in docs:
  assert doc.tag=='{'+ns['s']+'}urlset'
  entries=doc.findall('s:url',ns);assert len(entries)<=50_000
  for entry in entries:
   element=entry.find('s:loc',ns);assert element is not None and element.text
   page_url=urlsplit(element.text);assert page_url.scheme=='https' and page_url.netloc=='kalendorius365.lt' and not page_url.query and not page_url.fragment
   sitemap.append(element.text)
   images=entry.findall('i:image/i:loc',ns);assert len(images)<=1_000
   for image in images:
    assert image.text
    image_url=urlsplit(image.text);assert image_url.scheme=='https' and image_url.netloc=='kalendorius365.lt' and not image_url.query and not image_url.fragment
    image_file=PUBLIC/unquote(image_url.path).lstrip('/');assert image_file.is_file(),image.text
    image_urls.append(image.text)
 canonical={p.canonical for path,p in pages.items() if path.name!='404.html'}
 assert len(sitemap)==len(set(sitemap)) and set(sitemap)==canonical and len(sitemap)==len(pages)-1
 expected_images={f"https://kalendorius365.lt{asset['webp']}" for asset in manifest if asset['kind'] in ('monthly','annual')}
 assert len(image_urls)==len(set(image_urls)) and set(image_urls)==expected_images
 assert {PUBLIC/'sitemap.xml',*PUBLIC.glob('sitemap-[0-9]*.xml')}==set(sitemap_files)
 assert 'Sitemap: https://kalendorius365.lt/sitemap.xml' in (PUBLIC/'robots.txt').read_text()
 for path in sitemap_files:
  assert f'/{path.name}\n  Cache-Control: public, max-age=3600' in headers
 assert '/robots.txt\n  Cache-Control: public, max-age=3600' in headers
 print(f'PASS: release indexing, 404 noindex, {len(sitemap)} sitemap canonicals across {len(sitemap_files)} XML file(s), {len(image_urls)} clean calendar image URLs, and no global noindex header.')

# Check the generated release, not only the authored editor source.
editor_html=(PUBLIC/'kurti-kalendoriu/index.html').read_text()
assert 'id="calendar-editor"' in editor_html,'Release preparation replaced the personal editor'
editor_release_path=re.escape(release_prefix)+r'calendar-editor-release-[a-f0-9]{12}/'
assert re.search(editor_release_path+r'editor\.js',editor_html),'Path-versioned editor module missing from built route'
assert re.search(editor_release_path+r'editor\.css',editor_html),'Path-versioned editor stylesheet missing from built route'
assert 'id="generator"' not in editor_html,'Legacy calendar generator overwrote the editor'
print('PASS: personal calendar editor survives full release generation with scoped CSS and module')

for family in ('Lato','Inter'):
 for weight in ('Regular','Bold'):
  font=PUBLIC/'assets/fonts'/f'{family}-{weight}.ttf'
  assert font.exists() and font.stat().st_size>100000,f'PDF/preview font excluded from release: {font}'
print('PASS: all four embedded PDF/preview fonts are published')
