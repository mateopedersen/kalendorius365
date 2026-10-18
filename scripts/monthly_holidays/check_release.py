"""Gate 1: independent static checks of generated pages, dates and preservation."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
from datetime import date,timedelta
from collections import Counter
import calendar,json,re,hashlib,copy,sys,math,xml.etree.ElementTree as ET
from PIL import Image,ImageChops,ImageStat
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts'))
from calendar_package import validate_import_evidence

# This exception is deliberately tied to one reviewed editorial release.  It
# does not permit future content changes or changes to factual/rights fields.
EDITORIAL_REVIEW_VERSION = '2026-10-17-lt-editorial-v1'
EDITORIAL_REVIEW_PATH = 'site/assets/data/holiday-editorial.json'
EDITORIAL_REVIEW_BEFORE_SHA256 = '2390de90d277539c22ec2ec15114d5e3eb1941ff019498b119e28352741a4a34'
EDITORIAL_REVIEW_AFTER_SHA256 = 'e8708d8fc7f5a102df01168dc9816a6a57a6cf0a72382d13cdabe5171925c744'
EDITORIAL_REVIEW_MANIFEST = 'docs/language-audit/2026-10-17/holiday-editorial-v1.json'
EDITORIAL_REVIEW_TEXT_PATHS = frozenset({
 ('commemorations',0,'context_sections',1,1),
 ('articles',0,'history'),('articles',0,'traditions'),('articles',0,'practical'),
 ('articles',5,'traditions'),('articles',5,'context_sections',0,1),
 ('articles',6,'practical'),('articles',6,'context_sections',0,1),
 ('articles',7,'summary'),('articles',7,'meta_description'),
 ('articles',8,'history'),('articles',8,'context_sections',1,1),
 ('articles',11,'traditions'),('articles',12,'what'),
 ('articles',12,'context_sections',1,1),
 ('articles',13,'title'),('articles',13,'history'),
})
PRINT_LEGEND_TRANSITION = 'docs/language-audit/2026-10-17/annual-monochrome-legend-v2.json'
PRINT_LEGEND_TRANSITION_SHA256 = 'c9fb55864d9afc0ae1d77b6c70ca893b1c6d3689404599ce6d7d19ceb0bec4d0'
PRINT_LEGEND_STEMS = {f'{year}-metinis-{design:02}' for year in [2027,2028,2029] for design in range(1,6)}
PRINT_LEGEND_PATHS = {f'site/downloads/{stem}.{ext}' for stem in PRINT_LEGEND_STEMS for ext in ['pdf','webp']} | {f'site/assets/{folder}/{stem}.webp' for stem in PRINT_LEGEND_STEMS for folder in ['previews','previews-small']}
SCREEN_THUMBNAIL_TRANSITION = 'docs/performance/lunar-screen-thumbnails-128.json'
SCREEN_THUMBNAIL_TRANSITION_SHA256 = '7b77d4625abc892464eb73942596ddbba70ba93399783392d6c04d79b4fa0766'

def verified_lunar_screen_texture(root):
 evidence_path=root/'docs/performance/lunar-texture-screen-q95.json';raw=evidence_path.read_bytes();evidence=json.loads(raw)
 assert hashlib.sha256(raw).hexdigest()=='8745b3c750fbe58d21e4a435c82ffa4c0afb87bda8850f977bd3181c2e91b0d7', 'screen texture review manifest changed'
 assert evidence['encoding']=={'format':'WebP','quality':95,'method':6}
 source_path=root/'site/assets/lunar/albedo-web.png';print_path=root/'site/assets/lunar/albedo.png'
 source_bytes=source_path.read_bytes();print_bytes=print_path.read_bytes();after_bytes=(root/evidence['after']['path']).read_bytes()
 assert len(source_bytes)==370707 and hashlib.sha256(source_bytes).hexdigest()=='56652da19d8bbc84809cf98a66d06269b7d84dbc33c8203403269f3fc47c3f22'
 assert evidence['previous_webp']=={'path':'site/assets/lunar/albedo-web.webp','bytes':232384,'sha256':'cfe251e9b0f291f508e5336f0e9fb0f0090173a7c995d7c447191107215ef3e0'}
 assert len(print_bytes)==1477843 and hashlib.sha256(print_bytes).hexdigest()=='1dfe2728a4a23ea00cc0a1c14c4528701ba775db4cecb483eb277f62d1dcc211'
 assert evidence['before']=={'path':'site/assets/lunar/albedo-web.png','bytes':len(source_bytes),'sha256':hashlib.sha256(source_bytes).hexdigest()}
 assert evidence['print_source']=={'path':'site/assets/lunar/albedo.png','bytes':len(print_bytes),'sha256':hashlib.sha256(print_bytes).hexdigest()}
 assert evidence['after']=={'path':'site/assets/lunar/albedo-web.webp','bytes':len(after_bytes),'sha256':hashlib.sha256(after_bytes).hexdigest()}
 assert len(after_bytes)<=85000
 with Image.open(source_path) as image:source=image.convert('RGBA')
 with Image.open(root/evidence['after']['path']) as image:compressed=image.convert('RGBA')
 assert source.size==compressed.size==(512,512)
 assert source.getchannel('A').tobytes()==compressed.getchannel('A').tobytes(), 'screen WebP alpha channel changed'
 results={}
 for label,color in [('black',(0,0,0,255)),('white',(255,255,255,255))]:
  left=Image.new('RGBA',source.size,color);right=Image.new('RGBA',source.size,color);left.alpha_composite(source);right.alpha_composite(compressed)
  stats=ImageStat.Stat(ImageChops.difference(left.convert('RGB'),right.convert('RGB')));mse=sum(value*value for value in stats.rms)/3
  psnr=99.0 if mse==0 else 10*math.log10(255*255/mse)
  assert psnr>=45.0,(label,psnr)
  assert abs(psnr-evidence['composited_rgb_psnr_db'][label])<0.01,(label,psnr)
  results[label]=round(psnr,3)
 return {'path':evidence['after']['path'],'bytes':len(after_bytes),'dimensions':[512,512],'alpha_identical':True,'composited_rgb_psnr_db':results,'print_source_unchanged':True}
BLANK_CALENDAR_TRANSITION = 'docs/blank-calendar-redesign/asset-transition.json'
BLANK_CALENDAR_TRANSITION_SHA256 = '13bbd9348cabe8965b7590ad1e8714bd032956441ecc7b894ae26341f2b9c8ae'
BLANK_CALENDAR_TRANSITION_VERSION = '2026-10-18-blank-calendar-redesign-v1'

def reviewed_blank_calendar_updates(root, baseline, manifest):
 """Permit only the exact 26 redesigned blank sets, never other print assets."""
 if manifest.get('blankRedesign') != BLANK_CALENDAR_TRANSITION:
  raise ValueError('blank calendar manifest has no pinned selective-redesign transition')
 raw=(root/BLANK_CALENDAR_TRANSITION).read_bytes()
 if hashlib.sha256(raw).hexdigest()!=BLANK_CALENDAR_TRANSITION_SHA256:
  raise ValueError('blank calendar transition evidence differs')
 transition=json.loads(raw)
 if transition.get('version')!=BLANK_CALENDAR_TRANSITION_VERSION or transition.get('after_generator')!=manifest.get('generator'):
  raise ValueError('blank calendar transition does not match the renderer manifest')
 preserved={row['stem']:row for row in transition['preserved_nonblank_assets']}
 redesigned={row['stem']:row for row in transition['redesigned_blank_assets']}
 assets={asset['stem']:asset for asset in manifest['assets']}
 if len(preserved)!=390 or set(preserved)!={stem for stem,asset in assets.items() if asset['kind']!='blank'}:
  raise ValueError('selective redesign does not prove all 390 other print assets')
 if len(redesigned)!=26 or set(redesigned)!={stem for stem,asset in assets.items() if asset['kind']=='blank'}:
  raise ValueError('selective redesign does not cover exactly the 26 blank print sets')
 for stem,proof in preserved.items():
  asset=assets[stem]
  if proof['files']!=asset['files']:raise ValueError('dated print asset metadata changed: '+stem)
  for kind,record in proof['files'].items():
   source=root/'site'/asset[kind].lstrip('/')
   if not source.is_file() or source.stat().st_size!=record['bytes'] or hashlib.sha256(source.read_bytes()).hexdigest()!=record['sha256']:
    raise ValueError('dated print asset bytes changed: '+stem+'/'+kind)
 updates={}
 for stem,proof in redesigned.items():
  asset=assets[stem];after=proof['after_files']
  if asset['kind']!='blank' or after!=asset['files']:raise ValueError('blank print manifest differs from its transition: '+stem)
  for kind,record in after.items():
   relative=asset[kind].lstrip('/')
   path='site/'+relative
   if path not in baseline:raise ValueError('blank print path is absent from the frozen baseline: '+path)
   current=root/path
   if not current.is_file() or current.stat().st_size!=record['bytes'] or hashlib.sha256(current.read_bytes()).hexdigest()!=record['sha256']:
    raise ValueError('blank print output differs from the reviewed transition: '+path)
   if kind in ('pdf','webp'):
    before=proof['before_files'].get(kind)
    if before is None or baseline[path]!=before['sha256'] or before['sha256']==record['sha256']:
     raise ValueError('blank download replacement does not match the frozen old bytes: '+path)
   updates[path]=record['sha256']
 if len(updates)!=104:raise ValueError('blank calendar transition must authorize exactly 104 print and preview files')
 return updates

def verified_screen_thumbnail_updates(root, baseline):
 """Allow only the pinned 192-to-128 screen images; keep print assets frozen."""
 raw=(root/SCREEN_THUMBNAIL_TRANSITION).read_bytes()
 if hashlib.sha256(raw).hexdigest()!=SCREEN_THUMBNAIL_TRANSITION_SHA256:
  raise ValueError('screen thumbnail transition evidence differs')
 transition=json.loads(raw)
 dates={row['date_local'] for row in json.loads((root/'data/lunar/calendar.json').read_text())['records']}
 expected={f'site/assets/lunar/days/{day}.webp' for day in dates}
 items=transition['files']
 if len(items)!=1096 or {item['path']for item in items}!=expected:
  raise ValueError('screen thumbnail scope differs')
 allowed={}
 for item in items:
  path=item['path'];current=(root/path).read_bytes()
  if (baseline.get(path)!=item['before']['sha256'] or
      hashlib.sha256(current).hexdigest()!=item['after']['sha256'] or
      len(current)!=item['after']['bytes'] or
      item['before']['dimensions']!=[192,192] or item['after']['dimensions']!=[128,128]):
   raise ValueError('unexpected screen thumbnail change: '+path)
  allowed[path]=item['after']['sha256']
 return allowed

def reviewed_print_updates(root, baseline):
 """Allow precisely60 print-file transitions and their metadata; freeze all else."""
 raw=(root/PRINT_LEGEND_TRANSITION).read_bytes()
 if hashlib.sha256(raw).hexdigest()!=PRINT_LEGEND_TRANSITION_SHA256:
  raise ValueError('print transition evidence hash mismatch')
 review=json.loads(raw)
 if review['version']!='2026-10-17-annual-monochrome-legend-v2' or review['preflight_status']!='passed-twice' or review['visual_status']!='all15-reviewed':
  raise ValueError('print transition lacks completed physical/visual checks')
 files=review['changed_files'];paths=[x['path']for x in files]
 if len(paths)!=60 or set(paths)!=PRINT_LEGEND_PATHS:raise ValueError('print exception must contain exactly60 approved files')
 allowed={}
 for item in files:
  path=item['path'];current=(root/path).read_bytes()
  if baseline[path]!=item['before']['sha256'] or hashlib.sha256(current).hexdigest()!=item['after']['sha256'] or len(current)!=item['after']['bytes']:
   raise ValueError('reviewed print file differs: '+path)
  allowed[path]=item['after']['sha256']
 manifest_path='site/assets/data/manifest.json';current=(root/manifest_path).read_bytes()
 if hashlib.sha256(current).hexdigest()!=review['after_manifest_sha256']:
  raise ValueError('reviewed print manifest bytes differ')
 manifest=json.loads(current);before=copy.deepcopy(manifest);selected={a['stem']:a for a in review['selected_assets']}
 if set(selected)!=PRINT_LEGEND_STEMS:raise ValueError('print metadata selected stems differ')
 for asset in before['assets']:
  if asset['stem']not in selected:continue
  original=selected[asset['stem']]
  if not all(original[k]for k in ['all_other_text_positions_equal','vector_geometry_equal','grayscale_paint_sequence_equal']):raise ValueError('unapproved geometry or painting change')
  if original['before_geometry_sha256']!=original['after_geometry_sha256']:raise ValueError('drawing geometry changed')
  if hashlib.sha256(json.dumps(asset['dateLayout'],sort_keys=True).encode()).hexdigest()!=original['date_layout_sha256']:raise ValueError('date positions changed')
  asset['files']=original['before_files'];asset['verification']=original['before_verification'];asset.pop('renderCompatibility')
  if original['had_generator']:asset['generator']=original['before_generator']
  else:asset.pop('generator',None)
 before['generator']=review['before_generator'];before.pop('reviewedTransition');before.pop('generatorScope')
 original_bytes=json.dumps(before,ensure_ascii=False,indent=2).encode()
 if hashlib.sha256(original_bytes).hexdigest()!=baseline[manifest_path] or baseline[manifest_path]!=review['before_manifest_sha256']:
  raise ValueError('unlisted print metadata changed; reconstructed original hash differs')
 for source in review['calendar_sources']:
  if source['before_sha256']!=source['after_sha256'] or hashlib.sha256((root/source['path']).read_bytes()).hexdigest()!=source['before_sha256']:raise ValueError('calendar source data changed')
 for run in review['preflight_runs']:
  report_bytes=(root/run['path']).read_bytes();report=json.loads(report_bytes)
  if hashlib.sha256(report_bytes).hexdigest()!=run['sha256'] or report['status']!='passed' or len(report['results'])!=416 or report['generator']!=review['after_generator']:raise ValueError('actual full print preflight evidence differs')
 allowed[manifest_path]=review['after_manifest_sha256']
 return allowed

def reviewed_calendar_package_updates(root, baseline, manifest):
 """Allow only the pinned 390-calendar package replacement and its manifest."""
 result=validate_import_evidence(root,manifest,check_files=True)
 raw=(root/PRINT_LEGEND_TRANSITION).read_bytes()
 if hashlib.sha256(raw).hexdigest()!=PRINT_LEGEND_TRANSITION_SHA256:
  raise ValueError('print transition evidence hash mismatch')
 transition=json.loads(raw)
 if transition.get('version')!='2026-10-17-annual-monochrome-legend-v2':
  raise ValueError('unexpected reviewed print transition version')
 if transition.get('preflight_status')!='passed-twice' or transition.get('visual_status')!='all15-reviewed':
  raise ValueError('reviewed annual correction lacks completed visual and print checks')
 if transition.get('before_text')!='Šventės pažymėtos raudonai' or transition.get('after_text')!='12 mėnesių apžvalga':
  raise ValueError('unexpected reviewed annual correction wording')
 if hashlib.sha256((root/'docs/lunar/qa/existing-downloads-before.json').read_bytes()).hexdigest()!='ec0bec25e7100438f7dc48c804ca4a31893483178c702b7064344d200e40e80d':
  raise ValueError('frozen download baseline was changed')
 reviewed={}
 stems={f'{year}-metinis-{design:02}' for year in (2027,2028,2029) for design in range(1,6)}
 selected=transition.get('selected_assets',[])
 if len(selected)!=15 or {item['stem'] for item in selected}!=stems:
  raise ValueError('reviewed annual correction must cover all 15 reviewed designs')
 rows=transition.get('changed_files',[])
 by_path={row['path']:row for row in rows}
 if len(rows)!=60 or set(by_path)!=PRINT_LEGEND_PATHS:
  raise ValueError('reviewed annual correction must cover exactly 60 approved artifacts')
 for path,row in by_path.items():
  if path not in baseline or baseline[path]!=row['before']['sha256']:
   raise ValueError('reviewed annual correction does not match the frozen baseline: '+path)
  reviewed[path]=row['after']['sha256']
 retired=result['retiredPaths'];allowed={}
 for path,item in retired.items():
  if path not in baseline or item['sha256'] not in {baseline[path],reviewed.get(path)}:
   raise ValueError('retired asset does not match its frozen pre-import hash or reviewed print correction: '+path)
  if (root/path).exists():
   raise ValueError('superseded print or preview file remains: '+path)
  allowed[path]=None
 manifest_path='site/assets/data/manifest.json'
 allowed[manifest_path]=hashlib.sha256((root/manifest_path).read_bytes()).hexdigest()
 return allowed,result['evidenceSha256']

def structural_changes(before, after, path=()):
 """Return changed leaves; reject additions, deletions and type changes."""
 if type(before) is not type(after):
  raise ValueError('JSON type changed at '+repr(path))
 if isinstance(before,dict):
  if before.keys()!=after.keys():
   raise ValueError('JSON keys changed at '+repr(path))
  return [item for key in before for item in structural_changes(before[key],after[key],path+(key,))]
 if isinstance(before,list):
  if len(before)!=len(after):
   raise ValueError('JSON array length changed at '+repr(path))
  return [item for index,(old,new) in enumerate(zip(before,after)) for item in structural_changes(old,new,path+(index,))]
 return [] if before==after else [(path,before,after)]

def reviewed_editorial_update(current, baseline_sha256, manifest):
 """Verify exact bytes and reconstruct/hash the original from explicit text edits.

 The original asset was compact UTF-8 JSON without a trailing newline.  Replacing
 the 17 listed text values must reproduce its exact baseline bytes.  This proves
 every unlisted field is unchanged without shipping another copy of the dataset.
 """
 try:
  if baseline_sha256!=EDITORIAL_REVIEW_BEFORE_SHA256:
   raise ValueError('unexpected frozen editorial baseline hash')
  if hashlib.sha256(current).hexdigest()!=EDITORIAL_REVIEW_AFTER_SHA256:
   raise ValueError('editorial bytes differ from the reviewed release')
  required={'version':EDITORIAL_REVIEW_VERSION,'path':EDITORIAL_REVIEW_PATH,
            'before_sha256':EDITORIAL_REVIEW_BEFORE_SHA256,
            'after_sha256':EDITORIAL_REVIEW_AFTER_SHA256}
  if any(manifest.get(key)!=value for key,value in required.items()):
   raise ValueError('editorial review manifest identity/hash mismatch')
  edits=manifest['changes'];paths=[tuple(edit['path']) for edit in edits]
  if len(paths)!=len(EDITORIAL_REVIEW_TEXT_PATHS) or set(paths)!=EDITORIAL_REVIEW_TEXT_PATHS:
   raise ValueError('editorial review must contain exactly the 17 approved text paths')
  after=json.loads(current);before=copy.deepcopy(after)
  for edit,path in zip(edits,paths):
   if not isinstance(edit['before'],str) or not isinstance(edit['after'],str) or edit['before']==edit['after']:
    raise ValueError('editorial review values must be changed human-readable strings')
   target=before
   for key in path[:-1]:target=target[key]
   if target[path[-1]]!=edit['after']:
    raise ValueError('reviewed value mismatch at '+repr(path))
   target[path[-1]]=edit['before']
  original=json.dumps(before,ensure_ascii=False,separators=(',',':')).encode('utf-8')
  if hashlib.sha256(original).hexdigest()!=baseline_sha256:
   raise ValueError('reconstructed original differs from frozen baseline; unlisted fields changed')
  changes=structural_changes(before,after)
  expected={(tuple(edit['path']),edit['before'],edit['after']) for edit in edits}
  if set(changes)!=expected:
   raise ValueError('structural editorial diff differs from the reviewed changes')
  return True,{'version':EDITORIAL_REVIEW_VERSION,'path':EDITORIAL_REVIEW_PATH,
              'before_sha256':baseline_sha256,'sha256':EDITORIAL_REVIEW_AFTER_SHA256,
              'review_manifest':EDITORIAL_REVIEW_MANIFEST,'reviewed_text_paths':len(changes),
              'reason':'Reviewed Lithuanian prose only; reconstructed baseline hash and full JSON structural diff verified'}
 except (ValueError,KeyError,TypeError,IndexError) as error:
  return False,str(error)

class Page(HTMLParser):
 def __init__(self,s):
  super().__init__(convert_charrefs=True);self.tags=[];self.text=[];self.h1=[];self.scripts=[];self.current=None;self.buf=[];self.title='';self.ids=[];self.days=[];self.col=0;self.feed(s)
 def handle_starttag(self,t,a):
  a=dict(a);self.tags.append((t,a))
  if 'id'in a:self.ids.append(a['id'])
  if t=='tr':self.col=0
  if t=='td':self.col+=1
  if 'data-day'in a:self.days.append((a['data-day'],self.col))
  if t in ('h1','title') or(t=='script'and a.get('type')=='application/ld+json'):self.current=t;self.buf=[]
 def handle_data(self,s):
  self.text.append(s)
  if self.current:self.buf.append(s)
 def handle_endtag(self,t):
  if t==self.current:
   v=''.join(self.buf)
   if t=='h1':self.h1.append(v)
   elif t=='title':self.title=v
   else:self.scripts.append(json.loads(v))
   self.current=None
 def attrs(self,t,**kw):return [a for tag,a in self.tags if tag==t and all(a.get(k)==v for k,v in kw.items())]
def run():
 data=json.loads((ROOT/'data/monthly-holidays-2027.json').read_text());media=json.loads((ROOT/'data/monthly-holiday-media.json').read_text());base=json.loads((ROOT/'docs/2027-monthly-holidays/baseline.json').read_text())
 months=json.loads((ROOT/'data/calendar.json').read_text())['months'];events=data['events'];results=[];failures=[]
 def check(test,message):
  if not test:failures.append(message)
 # Each legal title is checked against the independently saved official text.
 raw=(ROOT/'docs/2027-monthly-holidays/source-evidence/atmintinos-2026-07-04.txt').read_text().split('Skelbiu šį')[0]
 legal={int(m[1]):' '.join(re.split(r' [–‒] ',m[2],maxsplit=1)[1].strip().rstrip(';.').split()) for m in re.finditer(r'(?m)^\s*(\d+)\)\s*([^\n]+)',raw)}
 check(len(legal)==101,'official law extraction not complete')
 for e in events:
  d=date.fromisoformat(e['date']);check(d.year==2027 and d.isoweekday()==e['weekday'],e['id']+' weekday')
  check(e['statutory_nonworking']==(e['category']=='statutory_holiday'),e['id']+' legal status')
  if e.get('law_point'):check(e['title']==legal[e['law_point']],e['id']+' official legal name')
  check(all(s in data['sources'] for s in e['sources']),e['id']+' sources')
  r=e['recurrence']
  if r['type']=='nth-weekday':
   weeks=calendar.Calendar(firstweekday=0).monthdatescalendar(2027,r['month']);valid=[w[r['weekday']-1] for w in weeks if w[r['weekday']-1].month==r['month']];expected=valid[-1] if r['ordinal']==-1 else valid[r['ordinal']-1];check(d==expected,e['id']+' independent nth-weekday')
  if r['type']=='easter-offset':check(d==date(2027,3,28)+timedelta(days=r['offset']),e['id']+' Easter offset')
 years=json.loads((ROOT/'site/assets/data/years.json').read_text());engine=next(y for y in years if y['year']==2027)
 check({e['date'] for e in events if e['statutory_nonworking']}=={h['date'] for h in engine['holidays']},'statutory dates differ from preserved engine')
 sitemap=ET.parse(ROOT/'public/sitemap.xml');locs={e.text for e in sitemap.iter() if e.tag.endswith('}loc')}
 titles=set();descriptions=set();routes=[]
 for m,(slug,name,gen) in enumerate(months,1):
  route=f'/sventes/2027/{slug}/';routes.append(route);canonical='https://kalendorius365.lt'+route;s=(ROOT/'public'/route.lstrip('/')/'index.html').read_text();p=Page(s);es=[e for e in events if date.fromisoformat(e['date']).month==m]
  before=len(failures)
  check(not re.search(r'\bd\.\.',s),route+' doubled date-abbreviation punctuation')
  check(p.h1==[f'2027 m. {gen} šventės ir atmintinos dienos'],route+' H1')
  check(len(p.attrs('link',rel='canonical',href=canonical))==1,route+' canonical')
  check(canonical in locs,route+' sitemap');check(p.attrs('html')[0].get('lang')=='lt',route+' language');check(p.attrs('meta',name='robots')[0].get('content')=='index, follow',route+' robots')
  desc=p.attrs('meta',name='description')[0]['content'];check(desc not in descriptions and p.title not in titles,route+' unique metadata');descriptions.add(desc);titles.add(p.title)
  check(len(p.ids)==len(set(p.ids)),route+' duplicate IDs')
  check(len(p.days)==calendar.monthrange(2027,m)[1],route+' date count')
  check(all(date.fromisoformat(ds).isoweekday()==col for ds,col in p.days),route+' weekday column')
  cards=p.attrs('article');ids={a['data-event'] for a in cards if 'data-event'in a};check(ids=={e['id'] for e in es},route+' all visible event records')
  check(len(p.attrs('button',**{'data-category-filter':'all'}))==1,route+' filter all')
  check(p.attrs('input',id='mh-search') and 'disabled'in p.attrs('input',id='mh-search')[0],route+' progressive baseline')
  check(len(p.attrs('time'))>=len({e['date'] for e in es}),route+' semantic dates')
  check(len([a for a in p.attrs('article') if a.get('class')=='mh-spotlight'])==3,route+' three distinctive spotlights')
  check(all(x.get('@type')!='Event' for x in p.scripts),route+' no Event rich-result misuse')
  graph=next(x for x in p.scripts if x.get('@type')=='CollectionPage');check(graph['mainEntity']['numberOfItems']==len(es),route+' schema visible count')
  crumbs=next(x for x in p.scripts if x.get('@type')=='BreadcrumbList');check(len(crumbs['itemListElement'])==4,route+' breadcrumb hierarchy')
  for t,a in p.tags:
   if t=='img':
    check('width'in a and 'height'in a,route+' image dimensions');check(bool(a.get('alt')) or a.get('aria-hidden')=='true',route+' image alternative')
   targets=[]
   if t=='a'and a.get('href'):targets.append(a['href'])
   if t=='img':targets.append(a['src']);targets +=[chunk.strip().split()[0] for chunk in a.get('srcset','').split(',') if chunk.strip()]
   if t=='meta'and a.get('property')=='og:image':targets.append(a['content'])
   for target in targets:
    u=urlsplit(target)
    if u.netloc and u.netloc!='kalendorius365.lt':continue
    path=u.path or route;file=ROOT/'public'/unquote(path).lstrip('/')
    if path.endswith('/'):file=file/'index.html'
    if not u.path:file=ROOT/'public'/route.lstrip('/')/'index.html'
    check(file.is_file(),route+' missing local target '+target)
    if u.fragment and file.is_file() and file.suffix=='.html':check(u.fragment in Page(file.read_text()).ids,route+' missing anchor '+target)
  # ICS independently parsed without using the generator/folder.
  ics=(ROOT/f'public/assets/holiday-guides-ics/2027-{slug}.ics').read_bytes();check(all(len(l)<=75 for l in ics.split(b'\r\n')),route+' ICS 75-byte folding')
  unfolded=re.sub(r'\r\n[ \t]','',ics.decode());check(unfolded.count('BEGIN:VEVENT')==len(es),route+' ICS event count')
  check('str..' not in unfolded,route+' ICS doubled abbreviation punctuation')
  dates=re.findall(r'DTSTART;VALUE=DATE:(\d{8})',unfolded);check(Counter(dates)==Counter(e['date'].replace('-','') for e in es),route+' ICS dates')
  results.append({'route':route,'status':'passed'if len(failures)==before else'failed','h1':p.h1[0],'event_records':len(es),'statutory_dates':sum(e['statutory_nonworking'] for e in es),'source_count':len({s for e in es for s in e['sources']}),'calendar_days':len(p.days),'visible_html':True,'canonical':canonical})
 for relative in ['sventes/index.html','sventes/2027/index.html']:
  p=Page((ROOT/'public'/relative).read_text());hrefs=[a.get('href') for a in p.attrs('a')];check(all(r in hrefs for r in routes),relative+' all monthly links')
 check(len([x for x in locs if re.fullmatch(r'https://kalendorius365.lt/sventes/2027/[^/]+/',x)])==12,'exactly twelve new month guides')
 for a in media:
  path=ROOT/'site'/a['src'].lstrip('/');sv=ET.parse(path);check(sv.getroot().attrib.get('viewBox')=='0 0 1200 800',a['slug']+' SVG dimensions')
  check(path.stat().st_size<50000,a['slug']+' SVG byte budget')
  check(hashlib.sha256(path.read_bytes()).hexdigest()==a['sha256'],a['slug']+' illustration hash')
  for el in sv.iter():
   check(el.tag.split('}')[-1] not in ['script','foreignObject','image','animate','filter'],a['slug']+' unsafe/heavy SVG element')
   check(all(not k.lower().startswith('on') for k in el.attrib),a['slug']+' event handler in SVG')
 # Preserve the baseline; the later planner repair restores two documented metadata fields only.
 preserved=0;changed=[];intentional_updates=[];print_updates={};screen_updates={};package_updates={};blank_updates={};package_paths_seen=set()
 current_manifest=json.loads((ROOT/'site/assets/data/manifest.json').read_text())
 if current_manifest.get('packageImport'):
  try:
   package_updates,package_evidence_sha=reviewed_calendar_package_updates(ROOT,base['assets'],current_manifest)
   intentional_updates.append({'path':'site/assets/data/manifest.json','reason':'Pinned import replaces exactly 390 calendar records and their old PDF/WebP plus responsive previews','evidence':current_manifest['packageImport']['evidence'],'evidence_sha256':package_evidence_sha,'retired_asset_paths':len(package_updates)-1,'imported_records':390})
  except (OSError,ValueError,KeyError,TypeError)as error:check(False,'calendar package preservation: '+str(error))
 if current_manifest.get('blankRedesign'):
  try:
   blank_updates=reviewed_blank_calendar_updates(ROOT,base['assets'],current_manifest)
   intentional_updates.append({'path':BLANK_CALENDAR_TRANSITION,'reason':'Pinned selective redesign of exactly 26 blank calendar/planner print sets; 390 dated print assets and the other baseline files remain hash-verified','updated_files':len(blank_updates),'sha256':hashlib.sha256((ROOT/BLANK_CALENDAR_TRANSITION).read_bytes()).hexdigest()})
  except (OSError,ValueError,KeyError,TypeError)as error:check(False,'blank calendar preservation: '+str(error))
 if any(path.startswith('site/assets/lunar/days/') and (ROOT/path).is_file() and hashlib.sha256((ROOT/path).read_bytes()).hexdigest()!=sha for path,sha in base['assets'].items()):
  try:screen_updates=verified_screen_thumbnail_updates(ROOT,base['assets'])
  except (OSError,ValueError,KeyError,TypeError)as error:check(False,'screen thumbnail preservation: '+str(error))
 if not current_manifest.get('packageImport') and any((ROOT/path).is_file()and hashlib.sha256((ROOT/path).read_bytes()).hexdigest()!=base['assets'].get(path)for path in PRINT_LEGEND_PATHS):
  try:print_updates=reviewed_print_updates(ROOT,base['assets'])
  except (OSError,ValueError,KeyError,TypeError)as error:check(False,'reviewed print preservation: '+str(error))
 for path,sha in base['assets'].items():
  if path=='site/assets/data/search.json':continue
  if path in ('.github/workflows/site-release-qa.yml','.github/workflows/horoscope-automation.yml'):
   intentional_updates.append({'path':path,'reason':'Release/daily workflows install the pinned module compiler, validate all routes and commit the complete version-coupled build; this is CI configuration, not a public or print asset','sha256':hashlib.sha256((ROOT/path).read_bytes()).hexdigest()})
   continue
  p=ROOT/path
  if path in package_updates:
   expected=package_updates[path];package_paths_seen.add(path)
   if expected is None:
    if p.exists():changed.append(path)
   elif not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=expected:
    changed.append(path)
   continue
  if path in blank_updates:
   if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=blank_updates[path]:changed.append(path)
   else:intentional_updates.append({'path':path,'reason':'Exact PDF/WebP or matching 340/680px preview included in the pinned blank-calendar redesign','sha256':blank_updates[path],'review_manifest':BLANK_CALENDAR_TRANSITION})
   continue
  if path=='site/assets/lunar/lunar.js':
   current=p.read_bytes();updated=b"'/assets/lunar/albedo-web.webp'";previous=b"'/assets/lunar/albedo-web.png'"
   check(current.count(updated)==1 and hashlib.sha256(current.replace(updated,previous)).hexdigest()==sha,'lunar runtime changes only the screen texture URL')
   try:texture_evidence=verified_lunar_screen_texture(ROOT)
   except (OSError,ValueError,KeyError,TypeError,AssertionError)as error:
    texture_evidence=None;check(False,'reviewed high-quality screen texture: '+str(error))
   else:check(True,'reviewed high-quality screen texture, exact alpha, and unchanged print source')
   if texture_evidence:intentional_updates.append({'path':path,'reason':'Use a reviewed Q95 screen-only WebP with exact alpha and measured >=45 dB composite PSNR; preserve source PNG and full-resolution print texture','verification':texture_evidence})
   continue
  if path in screen_updates:
   intentional_updates.append({'path':path,'reason':'Pinned screen-only thumbnail resize from 192px to 128px; print and SVG originals unchanged','sha256':screen_updates[path],'transition_manifest':SCREEN_THUMBNAIL_TRANSITION})
   continue
  if path in print_updates:
   intentional_updates.append({'path':path,'reason':'Exact reviewed monochrome annual legend correction; original dates/vector operators/painting preserved','sha256':print_updates[path],'review_manifest':PRINT_LEGEND_TRANSITION})
   continue
  if path=='site/assets/app.js':
   current=p.read_bytes();updated=b'fetch("/assets/data/home-holiday-data.json?v=2")';previous=b'fetch("/assets/data/home-holiday-data.json")'
   check(current.count(updated)==1 and hashlib.sha256(current.replace(updated,previous)).hexdigest()==sha,'home app changes only the compact metadata schema version to avoid a cached incomplete payload')
   intentional_updates.append({'path':path,'reason':'Version the repaired compact metadata request; all application logic unchanged','sha256':hashlib.sha256(current).hexdigest()})
   continue
  if path=='site/assets/data/home-holiday-data.json':
   original=json.loads((ROOT/'data/holiday-editorial.json').read_text())
   field_sets={'articles':{'id','slug','holiday_ids'},'commemorations':{'id','slug','holiday_ids','title','month','day'}}
   before={kind:[{k:v for k,v in a.items() if k in fields}for a in original[kind]]for kind,fields in field_sets.items()}
   wanted={kind:[{k:v for k,v in a.items() if k in fields|{'title','category'}}for a in original[kind]]for kind,fields in field_sets.items()}
   check(hashlib.sha256(json.dumps(before,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()==sha,'planner pre-repair metadata matches the saved baseline')
   check(json.loads(p.read_text())==wanted,'planner metadata changes only restore original titles/categories')
   intentional_updates.append({'path':path,'reason':'Complete the existing holiday event prefill; original ids, slugs and date rules preserved','sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
   continue
  if path==EDITORIAL_REVIEW_PATH and p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest()!=sha:
   try:
    manifest=json.loads((ROOT/EDITORIAL_REVIEW_MANIFEST).read_text())
    valid,evidence=reviewed_editorial_update(p.read_bytes(),sha,manifest)
   except (OSError,ValueError) as error:
    valid,evidence=False,str(error)
   check(valid,'reviewed holiday editorial preservation: '+str(evidence))
   if valid:intentional_updates.append(evidence)
   else:changed.append(path)
   continue
  allowed={sha}
  if path in base.get('git_checkout_variants',{}):allowed.add(base['git_checkout_variants'][path]['sha256'])
  if not p.is_file()or hashlib.sha256(p.read_bytes()).hexdigest() not in allowed:changed.append(path)
  else:preserved+=1
 check(not changed,'baseline assets changed: '+str(changed[:20]))
 if current_manifest.get('packageImport'):check(package_paths_seen==set(package_updates),'pinned calendar package transition did not cover every retired file and the manifest')
 report={'status':'passed'if not failures else'failed','gate':'implementation-static-independent-calendar','pages':results,'baseline_assets_preserved':preserved,'intentional_metadata_updates':intentional_updates,'changed_baseline_assets':changed,'git_text_checkout_variants':base.get('git_checkout_variants',{}),'failures':failures,'checked_at':date.today().isoformat(),'limits':['No independent native-human language or legal certification is claimed.','Browser interaction, rendered geometry, contrast and live HTTP are a separate gate.']}
 out=ROOT/'docs/2027-monthly-holidays/QA-GATE-1.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'status':report['status'],'pages':len(results),'preserved_assets':preserved,'failures':failures},ensure_ascii=False));assert not failures
if __name__=='__main__':run()
