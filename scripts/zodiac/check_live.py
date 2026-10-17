"""Read-only production/preview proof for the fourteen zodiac routes and assets."""
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from concurrent.futures import ThreadPoolExecutor
import hashlib,json,re,sys,datetime
from audit import Page
ROOT=Path(__file__).resolve().parents[2]
BASE=sys.argv[1].rstrip('/')
MODE=sys.argv[2]
OUT=Path(sys.argv[3])
host=urlsplit(BASE).hostname
assert BASE.startswith('https://') and (host=='kalendorius365.lt' or host.endswith('.kalendorius365.pages.dev'))
assert MODE in ['production','preview']
signs=json.loads((ROOT/'site/_data/horoscope_signs.json').read_text())
routes=['/zodiakas/','/horoskopai/']+[f'/horoskopai/{s["key"]}/'for s in signs]
targets={r:ROOT/'public'/r.lstrip('/')/'index.html'for r in routes}
for route in routes:
 p=Page();p.feed(targets[route].read_text())
 for tag,attrs in p.tags:
  value=attrs.get('src',attrs.get('href',''));u=urlsplit(value)
  if u.path.startswith('/assets/') and not u.netloc:
   path=(ROOT/'public'/u.path.lstrip('/')).resolve()
   assert path.is_relative_to((ROOT/'public').resolve()) and path.is_file()
   targets[u.path+('?' +u.query if u.query else '')]=path
daily_date=json.loads((ROOT/'site/_data/horoscope_current.json').read_text())['local_date']
def check(item):
 route,path=item
 try:
  with urlopen(Request(BASE+route,headers={'User-Agent':'Kalendorius365-publication-verification'}),timeout=35)as response:
   body=response.read();status=response.status;mime=response.headers.get('Content-Type','').split(';')[0];header_robots=response.headers.get('X-Robots-Tag','')
  result={'route':route,'status':status,'bytes':len(body),'mime':mime,'sha256':hashlib.sha256(body).hexdigest()}
  if route in routes:
   source=body.decode();p=Page();p.feed(source)
   canonical=next(a.get('href')for t,a in p.tags if t=='link'and a.get('rel')=='canonical')
   robots=next(a.get('content')for t,a in p.tags if t=='meta'and a.get('name')=='robots')
   result.update(canonical=canonical,robots=robots,header_robots=header_robots,h1_count=p.headings.count(1),lithuanian=next(a.get('lang')for t,a in p.tags if t=='html')=='lt')
   assert status==200 and canonical=='https://kalendorius365.lt'+route and robots=='index, follow' and result['h1_count']==1 and result['lithuanian']
   if MODE=='production':assert 'noindex'not in header_robots.lower()
   expected_css = '/assets/zodiac-guide.css?v=' if route == '/zodiakas/' else ('/assets/horoscope-hub.css?v=' if route == '/horoskopai/' else '/assets/horoscope-detail.css?v=')
   assert expected_css in source
   if route=='/zodiakas/':
    assert source.count('data-sign-card=')==12 and source.count('data-wheel-sign=')==12 and 'id="z-finder"'in source and 'id="z-compare-first"'in source
   elif route!='/horoskopai/':
    assert source.count('class="z-sign-profile"')==1 and source.count('id="ascendant-form"')==1
   if route!='/zodiakas/':assert f'datetime="{daily_date}" data-horoscope-updated'in source
  else:
   expected=hashlib.sha256(path.read_bytes()).hexdigest();result['expected_sha256']=expected
   assert result['sha256']==expected,'asset differs from release bytes'
   if path.suffix=='.svg':assert mime=='image/svg+xml'
   if path.suffix=='.png':assert mime=='image/png'
  result['passed']=True
  return result
 except Exception as error:return {'route':route,'passed':False,'error':str(error)}
with ThreadPoolExecutor(max_workers=8)as pool:results=list(pool.map(check,targets.items()))
report={'checked_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'base':BASE,'mode':MODE,'routes':14,'targets':len(results),'passed':sum(r['passed']for r in results),'failures':[r for r in results if not r['passed']],'results':results,'scope':'HTTP/metadata/source-asset proof; browser functionality is recorded separately.'}
OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:report[k]for k in ['base','routes','targets','passed','failures']},ensure_ascii=False));sys.exit(bool(report['failures']))
