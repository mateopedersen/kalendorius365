"""Independent output/data/preservation checks. Run after a production build."""
from pathlib import Path
from datetime import datetime,timezone
from zoneinfo import ZoneInfo
from html.parser import HTMLParser
import json,hashlib,subprocess,re,xml.etree.ElementTree as ET
R=Path(__file__).resolve().parents[2];O=R/'public';b=json.loads((R/'docs/seasons/baseline.json').read_text());d=json.loads((O/'assets/data/seasons.json').read_text());fail=[];checks=[]
def check(label,condition):
 checks.append(label)
 if not condition:fail.append(label)
class DOM(HTMLParser):
 def __init__(self,s):super().__init__(convert_charrefs=True);self.items=[];self.feed(s)
 def handle_starttag(self,t,a):self.items.append(('start',t,[(k,re.sub(r'([?&]v=)[a-f0-9]{12}(?=[&#]|$)',r'\1CACHE',v)if v else v)for k,v in a]))
 def handle_endtag(self,t):self.items.append(('end',t))
 def handle_data(self,d):
  if d.strip():self.items.append(('text',d))
ids=['spring','summer','autumn','winter'];slugs=['pavasario-lygiadienis','vasaros-saulegriza','rudens-lygiadienis','ziemos-saulegriza'];routes=['/metu-laikai/']+['/'+s+'/'for s in slugs]
for e in d['events']:
 raw=json.loads((R/f'docs/seasons/source-evidence/usno-{e["year"]}.json').read_text());row=[r for r in raw['data']if r['phenom']in ['Equinox','Solstice']][ids.index(e['id'])]
 utc=f'{row["year"]:04d}-{row["month"]:02d}-{row["day"]:02d}T{row["time"]}:00Z';check('Primary UTC '+e['id']+str(e['year']),utc==e['utc'])
 dt=datetime.fromisoformat(e['utc'].replace('Z','+00:00')).astimezone(ZoneInfo('Europe/Vilnius'))
 check('Independent zoneinfo '+e['id']+str(e['year']),dt.strftime('%Y-%m-%d')==e['date']and dt.strftime('%H:%M')==e['clock']and dt.utcoffset().total_seconds()/60==e['offsetMinutes'])
ind=json.loads((R/'docs/seasons/source-evidence/astropixels-crosscheck.json').read_text())
for y in ind['years']:
 for i,utc in enumerate(y['independent_utc']):
  e=next(e for e in d['events']if e['year']==y['year']and e['id']==ids[i]);delta=(datetime.fromisoformat(e['utc'].replace('Z','+00:00'))-datetime.fromisoformat(utc.replace('Z','+00:00'))).total_seconds();check('Espenak crosscheck '+utc,abs(delta)<=60)
source_changes=[]
for p,h in b['source_assets'].items():
 if hashlib.sha256((R/p).read_bytes()).hexdigest()!=h:source_changes.append(p)
check('Existing source assets preserved except regenerated search',source_changes==['site/assets/data/search.json'])
for p,h in b['downloads'].items():
 f=O/p;actual=hashlib.sha256(f.read_bytes()).hexdigest()
 # One existing manifest is explicitly normalized by Git's eol=lf checkout rule.
 before=subprocess.check_output(['git','show',b['baseline_commit']+':public/'+p],cwd=R)if actual!=h else None
 check('Preserved '+p,actual==h or (p=='downloads/lunar/asset-manifest.csv'and f.read_bytes().replace(b'\r\n',b'\n')==before.replace(b'\r\n',b'\n')))
existing=[]
for u in b['canonical_urls']:
 route=u.removeprefix('https://kalendorius365.lt');p='public/'+route.lstrip('/')+'index.html';check('Existing URL '+route,(R/p).is_file());
 if route not in ['/saule/','/irankiai/','/astronominis-kalendorius/']:
  before=subprocess.check_output(['git','show',b['baseline_commit']+':'+p],cwd=R).decode();check('Existing DOM '+route,DOM(before).items==DOM((R/p).read_text()).items);existing.append(route)
allfiles=list(O.rglob('index.html'));check('171 canonical pages',len(allfiles)==171)
for route in routes:
 s=(O/route.lstrip('/')/'index.html').read_text();tree=DOM(s)
 check('One H1 '+route,len(re.findall('<h1(?: |>)',s))==1)
 check('Indexable '+route,'content="index, follow"'in s)
 check('Canonical '+route,f'rel="canonical" href="https://kalendorius365.lt{route}"'in s)
 check('SSR verified date table '+route,all(str(y)+' m.'in s for y in d['years']))
 check('No placeholders '+route,not re.search(r'TODO|lorem ipsum|placeholder graphic|Full Moon|Monday|undefined|�',s))
 check('No artificial rich-result markup '+route,'"@type": "WebPage"'in s and '"@type": "Event"'not in s and '"@type": "FAQPage"'not in s)
 check('Accessible SSR data '+route,'data-annual-rows'in s and 'data-area'in s)
 check('New CSS scoped '+route,'seasons-app'in s and 'seasons.css?v='in s)
for p in (O/'assets/visuals/seasons').glob('*.svg'):
 root=ET.parse(p).getroot();check('Vector budget '+p.name,p.stat().st_size<65000);check('No raster '+p.name,not any(n.tag.endswith('image')or n.tag.endswith('foreignObject')for n in root.iter()))
 if p.name!='controls.svg':check('Lithuanian SVG accessible '+p.name,bool(root.find('{http://www.w3.org/2000/svg}title').text))
icscount=0;uids=set()
for p in (O/'assets/seasons-ics').glob('*.ics'):
 data=p.read_bytes();check('CRLF '+p.name,data.endswith(b'\r\n')and b'\n'not in data.replace(b'\r\n',b''));check('RFC5545 folding '+p.name,all(len(l)<=75 for l in data.split(b'\r\n')))
 unfolded=re.sub(r'\r\n[ \t]','',data.decode());vevents=unfolded.split('BEGIN:VEVENT\r\n')[1:];check('ICS event count '+p.name,len(vevents)==(4 if 'metu-laikai'in p.name else 1));icscount+=len(vevents)
 for v in vevents:
  props=dict(line.split(':',1)for line in v.split('\r\n')if ':'in line);stamp=props['DTSTART'];uid=props['UID'];uids.add(uid);check('UTC instant '+uid,stamp.endswith('Z')and 'DTEND'not in props and 'DURATION'not in props)
  dt=datetime.strptime(stamp,'%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc);check('Official ICS instant '+uid,any(datetime.fromisoformat(e['utc'].replace('Z','+00:00'))==dt for e in d['events']))
check('23 calendar exports',len(list((O/'assets/seasons-ics').glob('*.ics')))==23);check('32 VEVENTs; 20 unique instants',icscount==32 and len(uids)==20)
search=json.loads((O/'assets/data/search.json').read_text())
for r in routes:check('Search inclusion '+r,any(e['url']==r and e['category']=='astronomy'for e in search))
report={'status':'passed'if not fail else 'failed','checks':len(checks),'failures':fail,'existing_dom_unchanged':len(existing),'existing_source_assets':len(b['source_assets']),'downloads_preserved':len(b['downloads']),'pages':routes,'calendar_files':23,'event_instances':icscount,'unique_instants':len(uids),'notes':['Year/city selectors support 2027–2029; countdown supports boundary years 2026 and 2030.','Minute predictions differ by at most one minute between primary USNO and independent Espenak tables.','Solar context remains approximate and uses the unmodified existing engine.']}
(R/'docs/seasons/qa-static.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2));raise SystemExit(bool(fail))
