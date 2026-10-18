#!/usr/bin/env python3
"""Verify all thirteen real public pages and every distributed name-day file."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import argparse
import datetime as dt
import hashlib
import json
import re
import urllib.error
import urllib.request

ROOT=Path(__file__).resolve().parents[2]
ap=argparse.ArgumentParser();ap.add_argument('base');ap.add_argument('--output',type=Path,required=True);args=ap.parse_args()
base=args.base.rstrip('/')
months=json.loads((ROOT/'site/assets/data/calendar.json').read_text())['months']
routes=['/vardadieniai/']+[f'/vardadieniai/{m[0]}/'for m in months]
assets=[]
for directory in ['assets/data/namedays','assets/namedays-ics','assets/visuals/namedays']:
    assets.extend('/'+str(p.relative_to(ROOT/'public'))for p in (ROOT/'public'/directory).rglob('*')if p.is_file())
assets.extend('/assets/'+f for f in ['namedays.js','namedays-engine.js','namedays.css'])
def check(path):
    item={'path':path}
    try:
        request=urllib.request.Request(base+path,headers={'User-Agent':'Kalendorius365-publication-verification','Accept-Encoding':'identity','Cache-Control':'no-cache'})
        with urllib.request.urlopen(request,timeout=35)as response:
            body=response.read();item.update(status=response.status,content_type=response.headers.get('Content-Type'),x_robots_tag=response.headers.get('X-Robots-Tag'))
        assert item['status']==200
        item['sha256']=hashlib.sha256(body).hexdigest()
        if path in routes:
            text=body.decode();assert len(re.findall(r'<h1\b',text))==1
            assert '<html lang="lt">'in text and '<meta name="robots" content="index, follow">'in text
            assert '<link rel="canonical" href="https://kalendorius365.lt'+path+'">'in text
            assert 'noindex'not in (item['x_robots_tag']or'')
            assert 'CC BY-SA 4.0'in text and 'cc-by-sa-4.0.json'in text
            assert re.search(r'/assets/releases/[0-9a-f]{20}/namedays\.js[\"\']',text)
            item['indexable']=True
        else:
            expected=(ROOT/'public'/path.lstrip('/')).read_bytes()
            assert body==expected,'Live asset differs from the accepted local release'
            if path.endswith('.ics'):assert 'text/calendar'in item['content_type']
            item['byte_exact']=True
        item['passed']=True
    except Exception as error:
        item.update(passed=False,error=str(error))
    return item
with ThreadPoolExecutor(max_workers=6)as pool:results=list(pool.map(check,routes+sorted(assets)))
report={'base':base,'verified_at':dt.datetime.now(dt.timezone.utc).isoformat(),'pages':len(routes),'assets':len(assets),
        'passed':sum(r['passed']for r in results),'failed':sum(not r['passed']for r in results),'results':results}
args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items()if k!='results'}));
for result in results:
    if not result['passed']:print(json.dumps(result))
raise SystemExit(bool(report['failed']))
