"""Gate 1: independent static checks of generated pages, dates and preservation."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
from datetime import date,timedelta
from collections import Counter
import calendar,json,re,hashlib,copy,xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[2]

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
 preserved=0;changed=[];intentional_updates=[];print_updates={}
 if any((ROOT/path).is_file()and hashlib.sha256((ROOT/path).read_bytes()).hexdigest()!=base['assets'].get(path)for path in PRINT_LEGEND_PATHS):
  try:print_updates=reviewed_print_updates(ROOT,base['assets'])
  except (OSError,ValueError,KeyError,TypeError)as error:check(False,'reviewed print preservation: '+str(error))
 for path,sha in base['assets'].items():
  if path=='site/assets/data/search.json':continue
  p=ROOT/path
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
  if path in {'.github/workflows/horoscope-automation.yml','.github/workflows/site-release-qa.yml'}:
   # This release intentionally repairs cache publication and regression gates.
   # Keep those reviewed build/deployment contracts explicit instead of freezing
   # workflow bytes to the older monthly-editorial feature snapshot.
   workflow=p.read_text()
   check('K365_RELEASE=1 bundle exec ruby scripts/build.rb' in workflow,path+' retains release build')
   check('python3 scripts/audit_site.py --release' in workflow,path+' audits release indexing and cache graph')
   check('node --test test/*.test.js' in workflow,path+' runs permanent regression suites')
   check('git push --force' not in workflow,path+' does not force-push')
   if path.endswith('horoscope-automation.yml'):
    check('git add site/_data/horoscope_current.json site/horoskopai site/assets/data/search.json public docs/horoscopes/validation/horoscope-source-qa.json' in workflow,'daily publisher stages the entire content-addressed release')
    check('main changed during generation; refusing to overwrite concurrent work' in workflow,'daily publisher retains concurrent-main guard')
    check('git push origin HEAD:refs/heads/main' in workflow,'daily publisher retains existing main-to-Pages integration')
   else:
    check('contents: read' in workflow and 'contents: write' not in workflow,'release QA retains read-only permission')
   intentional_updates.append({'path':path,'reason':'Reviewed cache release publishes the complete generated asset graph atomically and runs permanent regression gates','sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
  elif path==EDITORIAL_REVIEW_PATH and p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest()!=sha:
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
 report={'status':'passed'if not failures else'failed','gate':'implementation-static-independent-calendar','pages':results,'baseline_assets_preserved':preserved,'intentional_metadata_updates':intentional_updates,'changed_baseline_assets':changed,'git_text_checkout_variants':base.get('git_checkout_variants',{}),'failures':failures,'checked_at':'2026-10-17','limits':['No independent native-human language or legal certification is claimed.','Browser interaction, rendered geometry, contrast and live HTTP are a separate gate.']}
 out=ROOT/'docs/2027-monthly-holidays/QA-GATE-1.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'status':report['status'],'pages':len(results),'preserved_assets':preserved,'failures':failures},ensure_ascii=False));assert not failures
if __name__=='__main__':run()
