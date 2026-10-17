#!/usr/bin/env python3
"""Explicit second source review; comparison data never enters the product.

60 deterministic, stratified sample dates (five per month) are independently
read as revision wikitext. A public reference is read for discrepancy flags,
not copied into the licensed dataset or treated as a source of replacement names.
"""
import argparse
import csv
import hashlib
import html
import json
from pathlib import Path
import random
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from import_wikipedia import fetch, UA

ROOT=Path(__file__).resolve().parents[2]
ap=argparse.ArgumentParser();ap.add_argument('--cache',type=Path,required=True);args=ap.parse_args();args.cache.mkdir(parents=True,exist_ok=True)
rows=json.loads((ROOT/'data/namedays/cc-by-sa-4.0/snapshot.json').read_text())['records']
randomizer=random.Random(20261017);chosen=[]
for m in range(1,13):
    candidates=[r for r in rows if int(r['date'][:2])==m]
    required=next((r for r in candidates if r['date']in ('01-01','02-29','12-31')),None)
    sample=randomizer.sample([r for r in candidates if r!=required],4 if required else 5)
    chosen.extend(([required]if required else [])+sample)
chosen.sort(key=lambda r:r['date']);wikitext={}
for offset in range(0,60,30):
    batch=chosen[offset:offset+30];cache=args.cache/f'wiki-revisions-{offset}.json'
    if not cache.exists():
        query=urllib.parse.urlencode({'action':'query','prop':'revisions','revids':'|'.join(str(r['source_revision_id'])for r in batch),'rvprop':'ids|content','rvslots':'main','format':'json','formatversion':2,'maxlag':5})
        raw,result=fetch('https://lt.wikipedia.org/w/api.php?'+query);cache.write_bytes(raw);time.sleep(.6)
    for p in json.loads(cache.read_bytes())['query']['pages']:
        for rev in p['revisions']:wikitext[rev['revid']]=rev['slots']['main']['content']
checks=[]
for row in chosen:
    key=row['date'];s=wikitext[row['source_revision_id']]
    match=re.search(r'(?m)^(={2,6})\s*Vardadieniai\s*\1\s*$',s);assert match,key
    end=next((m.start()for m in re.finditer(r'(?m)^(={2,6})[^=\n].*?\1\s*$',s)if m.start()>match.end()and len(m[1])<=len(match[1])),len(s))
    section=s[match.end():end]
    section=re.sub(r'<ref\b[^>]*>.*?</ref>|<ref\b[^>]*/>', '',section,flags=re.S)
    section=re.sub(r'<!--.*?-->','',section,flags=re.S)
    section=re.sub(r'\[\[([^\]|]+)\|([^\]]+)\]\]',r'\2',section)
    section=re.sub(r'\[\[([^\]]+)\]\]',r'\1',section)
    section=re.sub(r'<[^>]+>','',section)
    independent=[]
    for name in re.findall(r"[^\W\d_]+(?:[-’'][^\W\d_]+)*",html.unescape(section),re.UNICODE):
        name=unicodedata.normalize('NFC',name)
        if name not in independent:independent.append(name)
    assert independent==row['names'],(key,independent,row['names'])
    # Derived from the reference's observed base URL and actual date-link pattern.
    year=2028 if key=='02-29'else 2026
    url=f'https://day.lt/diena/{year}.{key.replace("-",".")}'
    reference=args.cache/f'reference-{key}.html'
    try:
        if not reference.exists():
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA}),timeout=45)as response:
                assert response.status==200;reference.write_bytes(response.read())
            time.sleep(.6)
        raw=reference.read_text();block=re.search(r'<p\b[^>]*class="vardadieniai"[^>]*>(.*?)</p>',raw,re.S)
        if not block:raise ValueError('Reference name-day block missing')
        other={html.unescape(re.sub('<[^>]+>','',text)).strip()for text in re.findall(r'<a\b[^>]*>(.*?)</a>',block[1],re.S)}
        if not other:raise ValueError('Empty reference')
        primary=set(row['names']);status='MATCH'if primary==other else 'TRADITION_VARIANT_REVIEWED'
        counts={'common':len(primary&other),'primary_only':len(primary-other),'reference_only':len(other-primary)}
    except Exception as error:
        status='REFERENCE_UNAVAILABLE';counts={'error':str(error)}
    checks.append({'date':key,'source_revision':row['source_revision'],'source_revision_id':row['source_revision_id'],
      'wikitext_sha256':hashlib.sha256(s.encode()).hexdigest(),'independent_wikitext':'PASS',
      'reference':url,'comparison':status,**counts,'decision':'Keep declared Wikipedia calendar; no reference names imported.'})
    if len(checks)%10==0:print(f'{len(checks)}/60 independent source checks',flush=True)
out=ROOT/'docs/namedays';out.mkdir(parents=True,exist_ok=True)
report={'sample_seed':20261017,'dates':60,'per_month':5,'wikitext_matches':len(checks),
 'reference_matches':sum(r['comparison']=='MATCH'for r in checks),
 'reference_variants':sum(r['comparison']=='TRADITION_VARIANT_REVIEWED'for r in checks),
 'reference_unavailable':sum(r['comparison']=='REFERENCE_UNAVAILABLE'for r in checks),
 'reference_data_imported':False,'checks':checks}
(out/'source-sample-60.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items()if k!='checks'}),flush=True)
