"""Gate 1: independent static checks of generated pages, dates and preservation."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
from datetime import date,timedelta
from collections import Counter
import calendar,json,re,hashlib,xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[2]
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
 preserved=0;changed=[];intentional_updates=[]
 for path,sha in base['assets'].items():
  if path=='site/assets/data/search.json':continue
  p=ROOT/path
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
  allowed={sha}
  if path in base.get('git_checkout_variants',{}):allowed.add(base['git_checkout_variants'][path]['sha256'])
  if not p.is_file()or hashlib.sha256(p.read_bytes()).hexdigest() not in allowed:changed.append(path)
  else:preserved+=1
 check(not changed,'baseline assets changed: '+str(changed[:20]))
 report={'status':'passed'if not failures else'failed','gate':'implementation-static-independent-calendar','pages':results,'baseline_assets_preserved':preserved,'intentional_metadata_updates':intentional_updates,'changed_baseline_assets':changed,'git_text_checkout_variants':base.get('git_checkout_variants',{}),'failures':failures,'checked_at':'2026-10-17','limits':['No independent native-human language or legal certification is claimed.','Browser interaction, rendered geometry, contrast and live HTTP are a separate gate.']}
 out=ROOT/'docs/2027-monthly-holidays/QA-GATE-1.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'status':report['status'],'pages':len(results),'preserved_assets':preserved,'failures':failures},ensure_ascii=False));assert not failures
if __name__=='__main__':run()
