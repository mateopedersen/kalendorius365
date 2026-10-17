#!/usr/bin/env python3
"""Check every distinct external citation without assuming a block is a broken URL."""
from pathlib import Path
from urllib import request, error
from urllib.parse import urldefrag
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json, argparse, time

def check(url):
    row={'url':url,'checked_at':datetime.now(timezone.utc).isoformat()}
    for method in ['HEAD','GET']:
        try:
            with request.urlopen(request.Request(url,method=method,headers={'User-Agent':'Mozilla/5.0 (compatible; Kalendorius365-source-audit/1.0)'}),timeout=14) as r:
                row.update(status=r.status,final_url=r.url,method=method,content_type=r.headers.get('Content-Type',''))
                return row
        except error.HTTPError as exc:
            row.update(status=exc.code,method=method,error=str(exc))
            # Several documentation/catalogue servers return false HEAD 404s.
            # A rate limit is retained as evidence; do not amplify it with retries.
            if exc.code not in {403,404,405,500,502,503}:return row
        except Exception as exc:row.update(status=None,method=method,error=str(exc))
        time.sleep(.2)
    return row

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('crawl',type=Path);ap.add_argument('output',type=Path);args=ap.parse_args()
    pages=json.loads(args.crawl.read_text())['pages'];urls=sorted({urldefrag(u)[0] for p in pages for u in p['external_links']})
    rows=[]
    with ThreadPoolExecutor(max_workers=6) as pool:
        for i,row in enumerate(pool.map(check,urls),1):
            rows.append(row)
            if i%50==0:print(f'Checked external sources {i}/{len(urls)}',flush=True)
    args.output.write_text(json.dumps({'checked_at':datetime.now(timezone.utc).isoformat(),'total':len(rows),'results':rows,'limits':'HTTP accessibility is not factual or legal certification. Origin blocks and timeouts require separate interpretation; they are not automatically classified as broken sources.'},ensure_ascii=False,indent=2))
    from collections import Counter
    print(dict(Counter(r['status'] for r in rows)),flush=True)
