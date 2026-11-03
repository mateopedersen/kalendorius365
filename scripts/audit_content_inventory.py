#!/usr/bin/env python3
"""Read public pages only; no browser profiles or personal calendar storage."""
import argparse, concurrent.futures, datetime, hashlib, html.parser, json, re, urllib.request
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[1]
class Page(html.parser.HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True);self.main=False;self.skip=0;self.text=[];self.meta={};self.links=[];self.canonical='';self.h1=0
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='main':self.main=True
  if tag in ('script','style','svg'):self.skip+=1
  if tag=='h1' and self.main:self.h1+=1
  if tag=='meta':self.meta[a.get('name',a.get('property',''))]=a.get('content','')
  if tag=='link' and a.get('rel')=='canonical':self.canonical=a.get('href','')
  if tag=='a':self.links.append(a.get('href',''))
 def handle_endtag(self,tag):
  if tag in ('script','style','svg'):self.skip=max(0,self.skip-1)
  if tag=='main':self.main=False
 def handle_data(self,data):
  if self.main and not self.skip:self.text.append(data)
def inspect(url):
 try:
  q=urllib.request.Request(url,headers={'User-Agent':'Kalendorius365-owner-content-audit/1.0','Cache-Control':'no-cache'})
  with urllib.request.urlopen(q,timeout=35) as f:body=f.read().decode('utf-8');status=f.status;final=f.url
  p=Page();p.feed(body);text=' '.join(' '.join(p.text).split())
  return {'url':url,'status':status,'final_url':final,'canonical':p.canonical,'robots':p.meta.get('robots'),'words':len(re.findall(r'\b[^\W\d_][\w-]*\b',text)), 'main_text':text,'h1_count':p.h1,'viewport':p.meta.get('viewport'),'og_image':p.meta.get('og:image'),'about_link':'/apie-mus/' in p.links,'privacy_link':'/privatumas/' in p.links,'sha256':hashlib.sha256(body.encode()).hexdigest()}
 except Exception as e:return {'url':url,'status':'error','error':str(e)}
def main():
 args=argparse.ArgumentParser();args.add_argument('--base',default='https://kalendorius365.lt');args.add_argument('--output',required=True);a=args.parse_args()
 routes=['/' if p.parent==ROOT/'site' else '/'+p.parent.relative_to(ROOT/'site').as_posix()+'/' for p in (ROOT/'site').rglob('index.html')]
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:pages=list(pool.map(inspect,[a.base.rstrip('/')+r for r in sorted(routes)]))
 summary={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'total':len(pages),'status':dict(Counter(str(p['status']) for p in pages)),'indexable':sum(p.get('robots','').startswith('index') for p in pages),'missing_og':sum(p.get('status')==200 and not p.get('og_image') for p in pages)}
 out=ROOT/a.output;out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps({'summary':summary,'pages':pages},ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary))
if __name__=='__main__':main()
