#!/usr/bin/env python3
"""Evidence-first whole-site crawler. HTML, response headers and comparisons stay reproducible."""
from pathlib import Path
from urllib.parse import urlsplit, urljoin
from urllib import request, error, robotparser
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict, Counter
from datetime import datetime, timezone
import argparse, json, hashlib, re, unicodedata, difflib, time
import xml.etree.ElementTree as ET
from lxml import html

ROOT = Path(__file__).resolve().parents[2]
HOST = 'https://kalendorius365.lt'
UA = 'Mozilla/5.0 (compatible; Kalendorius365-release-verification/1.0)'

def tidy(value):
    return re.sub(r'\s+', ' ', value).strip()

def parse(body, url):
    doc = html.fromstring(body)
    def text(nodes): return [tidy(' '.join(n.itertext())) for n in nodes]
    main = doc.xpath('//main')
    main = main[0] if main else doc
    for node in main.xpath('.//script|.//style|.//noscript'):
        node.drop_tree()
    titles = text(doc.xpath('//head/title'))
    meta = defaultdict(list)
    for n in doc.xpath('//meta[@name or @property]'):
        meta[(n.get('name') or n.get('property')).lower()].append(n.get('content', ''))
    canonical = doc.xpath('//link[contains(concat(" ",normalize-space(@rel)," ")," canonical ")]/@href')
    headings = [(int(n.tag[1]), tidy(' '.join(n.itertext()))) for n in main.xpath('.//h1|.//h2|.//h3|.//h4|.//h5|.//h6')]
    structured, schema_errors = [], []
    # JSON-LD is read from original HTML; main-tree script removal must not erase it.
    original = html.fromstring(body)
    for s in original.xpath('//script[@type="application/ld+json"]'):
        try: structured.append(json.loads(s.text or ''))
        except Exception as exc: schema_errors.append(str(exc))
    links = sorted(set(urljoin(url, x) for x in doc.xpath('//a[@href]/@href')))
    external = [x for x in links if urlsplit(x).scheme in {'http', 'https'} and urlsplit(x).hostname not in {'kalendorius365.lt','www.kalendorius365.lt'}]
    source_links = sorted(set(x for x in external if any(t in x for t in ['vlkk','vle.lt','e-tar.lt','e-seimas','usno.navy.mil','nasa.gov','commons.wikimedia.org','wikipedia.org','meteo.lt','cosinekitty','timeanddate','si.edu','nsa.smm','emokykla','lrv.lt','archyvai.lt','lnm.lt','lki.lt'])))
    images = [{'src':n.get('src'), 'alt':n.get('alt'), 'decorative':n.get('aria-hidden')=='true'} for n in doc.xpath('//img')]
    content = tidy(' '.join(main.itertext()))
    paragraphs = [{'tag':n.tag, 'id':n.get('id'), 'text':tidy(' '.join(n.itertext()))} for n in main.xpath('.//p|.//h1|.//h2|.//h3|.//h4|.//figcaption|.//label|.//button')]
    return {'title':titles, 'meta':dict(meta), 'canonical':canonical,
      'h1':[t for level,t in headings if level==1], 'headings':headings,
      'heading_skips':[(headings[i-1], headings[i]) for i in range(1,len(headings)) if headings[i][0]>headings[i-1][0]+1],
      'lang':doc.get('lang'), 'structured_data':structured, 'schema_errors':schema_errors,
      'links':links, 'external_links':external, 'source_links':source_links,
      'images':images, 'missing_alt':[i['src'] for i in images if i['alt'] is None],
      'main_text':content, 'main_sha256':hashlib.sha256(content.encode()).hexdigest(),
      'paragraphs':paragraphs, 'nfc':unicodedata.is_normalized('NFC',content),
      'forms':doc.xpath('//form/@id'), 'controls':doc.xpath('//main//*[@id and (self::input or self::select or self::button)]/@id')}

def sitemap(body):
    return sorted(set(n.text for n in ET.fromstring(body).findall('{http://www.sitemaps.org/schemas/sitemap/0.9}url/{http://www.sitemaps.org/schemas/sitemap/0.9}loc')))

class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl): return None

def fetch(url, output=None, follow=True):
    r={'url':url, 'checked_at':datetime.now(timezone.utc).isoformat()}
    opener=request.build_opener() if follow else request.build_opener(NoRedirect)
    for attempt in range(2):
        try:
            req=request.Request(url,headers={'User-Agent':UA,'Accept-Encoding':'identity','Cache-Control':'no-cache'})
            with opener.open(req,timeout=18) as response:
                body=response.read(); r.update(status=response.status, final_url=response.url,headers=dict(response.headers.items()),sha256=hashlib.sha256(body).hexdigest(),bytes=len(body))
            if output:
                output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(body);r['saved_html']=str(output)
            if 'text/html' in next((v for k,v in r['headers'].items()if k.lower()=='content-type'),''):
                r.update(parse(body,url))
            return r, body
        except error.HTTPError as exc:
            r.update(status=exc.code,headers=dict(exc.headers.items()),error=str(exc))
            if exc.code in {301,302,303,307,308}:return r,b''
        except Exception as exc:r.update(status=None,error=str(exc))
        if attempt==0:time.sleep(.5)
    return r,b''

def discovered_repo():
    result=defaultdict(set)
    for url in sitemap((ROOT/'public/sitemap.xml').read_bytes()):result[url].add('repository sitemap')
    for p in (ROOT/'public').rglob('*.html'):
        if p.name=='404.html':continue
        route='/'+str(p.relative_to(ROOT/'public'))
        if route.endswith('/index.html'):route=route[:-10]
        result[HOST+route].add('generated HTML')
    for p in (ROOT/'site').rglob('index.html'):
        if p.parts[len(ROOT.parts)+1].startswith(('_','assets')):continue
        route='/'+str(p.relative_to(ROOT/'site')).removesuffix('index.html')
        result[HOST+route].add('Jekyll source')
    search=json.loads((ROOT/'public/assets/data/search.json').read_text())
    for item in search:
        u=urlsplit(urljoin(HOST,item['url']))
        if not u.fragment and not u.query:result[HOST+u.path].add('search index')
    return result

def internal_page_url(target):
    u=urlsplit(target)
    if u.hostname not in {'kalendorius365.lt','www.kalendorius365.lt'}:return None
    if u.path.startswith(('/assets/','/downloads/','/cdn-cgi/')):return None
    if u.path.endswith(('.xml','.txt','.pdf','.webp','.png','.svg','.jpg','.ics','.json','.js','.css')):return None
    if u.path=='/404.html':return None
    return HOST+(u.path or '/')

def diagnose(p, urls, rp):
    issues=[]
    if p.get('status')!=200:issues.append('HTTP_NOT_200')
    if p.get('final_url',p['url'])!=p['url']:issues.append('CANONICAL_ROUTE_REDIRECTS')
    headers={k.lower():v.lower() for k,v in p.get('headers',{}).items()}
    robots=','.join(v for k,values in p.get('meta',{}).items() if k in {'robots','googlebot','bingbot','googlebot-news'} for v in values).lower()
    directives=robots+','+headers.get('x-robots-tag','')
    if re.search(r'\b(?:noindex|none)\b',directives):issues.append('NOINDEX')
    if p.get('canonical')!=[p['url']]:issues.append('CANONICAL_MISMATCH')
    if len(p.get('h1',[]))!=1:issues.append('H1_COUNT')
    if len(p.get('title',[]))!=1 or not p['title'][0]:issues.append('TITLE_MISSING')
    if len(p.get('meta',{}).get('description',[]))!=1:issues.append('DESCRIPTION_MISSING')
    if p.get('heading_skips'):issues.append('HEADING_LEVEL_SKIP')
    if p.get('missing_alt'):issues.append('IMAGE_ALT_MISSING')
    if p.get('schema_errors'):issues.append('INVALID_JSON_LD')
    if not p.get('structured_data'):issues.append('STRUCTURED_DATA_MISSING')
    if not p.get('nfc',False):issues.append('NON_NFC_COPY')
    if p.get('lang') not in {'lt','lt-LT'}:issues.append('WRONG_HTML_LANGUAGE')
    if p['url'] not in urls:issues.append('MISSING_LIVE_SITEMAP')
    p['robots_allowed']={bot:rp.can_fetch(bot,p['url'])for bot in ['Googlebot','Googlebot-Mobile','Bingbot','DuckDuckBot','*']}
    if not all(p['robots_allowed'].values()):issues.append('ROBOTS_DISALLOW')
    for key in ['og:title','og:description','og:url','og:image','og:image:alt','twitter:title','twitter:description','twitter:card','twitter:image','twitter:image:alt']:
        if not p.get('meta',{}).get(key):issues.append('MISSING_'+key.upper())
    if p.get('meta',{}).get('og:url')!=[p['url']]:issues.append('OG_URL_MISMATCH')
    p['issues']=issues

def run(output, variations=False, local=False):
    output.mkdir(parents=True,exist_ok=True)
    sources=discovered_repo(); records={}
    if local:
        live_urls=sitemap((ROOT/'public/sitemap.xml').read_bytes());robots_body=(ROOT/'public/robots.txt').read_bytes()
    else:
        sr,sbody=fetch(HOST+'/sitemap.xml');rr,robots_body=fetch(HOST+'/robots.txt')
        (output/'sitemap-response.json').write_text(json.dumps(sr,indent=2));(output/'sitemap.xml').write_bytes(sbody)
        (output/'robots-response.json').write_text(json.dumps(rr,indent=2));(output/'robots.txt').write_bytes(robots_body)
        live_urls=sitemap(sbody)
        for url in live_urls:sources[url].add('live sitemap')
    rp=robotparser.RobotFileParser();rp.parse(robots_body.decode().splitlines())
    while set(sources)-set(records):
        batch=sorted(set(sources)-set(records))
        def get(url):
            name=hashlib.sha256(url.encode()).hexdigest()[:16]+'.html'
            if local:
                path=ROOT/'public'/urlsplit(url).path.lstrip('/')/'index.html'
                if path.exists():return dict(url=url,status=200,status_source='local file existence; not an HTTP observation',final_url=url,headers={},saved_html=str(path),**parse(path.read_bytes(),url))
                return {'url':url,'status':404}
            return fetch(url,output/'html'/name)[0]
        with ThreadPoolExecutor(max_workers=8)as pool:
            for p in pool.map(get,batch):
                records[p['url']]=p
                for target in p.get('links',[]):
                    candidate=internal_page_url(target)
                    if candidate and candidate not in sources:sources[candidate].add('discovered internal link')
        print(f'Inspected {len(records)} individual HTML routes',flush=True)
        if len(sources)>500:raise RuntimeError('Unbounded page discovery')
    inbound=defaultdict(set)
    for p in records.values():
        for link in p.get('links',[]):
            target=internal_page_url(link)
            if target and target!=p['url']:inbound[target].add(p['url'])
    for p in records.values():
        diagnose(p,live_urls,rp);p['discovery']=sorted(sources[p['url']]);p['inbound_pages']=sorted(inbound[p['url']])
        if not p['inbound_pages'] and p['url']!=HOST+'/':p['issues'].append('ORPHAN')
    for kind,getter in [('TITLE',lambda p:tuple(p.get('title',[]))),('DESCRIPTION',lambda p:tuple(p.get('meta',{}).get('description',[]))),('CANONICAL',lambda p:tuple(p.get('canonical',[])))]:
        grouped=defaultdict(list)
        for p in records.values():grouped[getter(p)].append(p['url'])
        for value,members in grouped.items():
            if value and len(members)>1:
                for u in members:records[u]['issues'].append('DUPLICATE_'+kind)
    result={'checked_at':datetime.now(timezone.utc).isoformat(),'count':len(records),'sitemap_count':len(live_urls),'pages':list(records.values())}
    (output/'crawl.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    (output/'discovery.json').write_text(json.dumps({u:sorted(s)for u,s in sources.items()},ensure_ascii=False,indent=2))
    print(json.dumps({'pages':len(records),'http':dict(Counter(p['status']for p in records.values())),'issues':dict(Counter(i for p in records.values()for i in p['issues']))}),flush=True)
    if variations and not local:
        jobs=[]
        for url in sorted(records):
            path=urlsplit(url).path
            jobs.extend([(url,'HTTP',url.replace('https:','http:',1)),(url,'WWW HTTPS',url.replace('https://','https://www.',1)),(url,'WWW HTTP',url.replace('https://','http://www.',1)),(url,'index.html',url+'index.html'),(url,'tracking query',url+'?utm_source=sitewide-audit')])
            if path!='/':jobs.append((url,'slashless',url[:-1]))
        def variant(job):
            canonical,kind,url=job;r,_=fetch(url,follow=False);r.update(canonical_target=canonical,variant_type=kind)
            if r.get('status') in {301,302,303,307,308}:
                location=next((v for k,v in r.get('headers',{}).items()if k.lower()=='location'),'');r['redirect_target']=urljoin(url,location)
            return r
        variants=[]
        with ThreadPoolExecutor(max_workers=8)as pool:
            for i,r in enumerate(pool.map(variant,jobs),1):
                variants.append(r)
                if i%100==0:print(f'Checked {i}/{len(jobs)} URL variants',flush=True)
        (output/'variants.json').write_text(json.dumps(variants,ensure_ascii=False,indent=2))
        print('Variants '+str(dict(Counter((r['variant_type'],r.get('status'))for r in variants))),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);parser.add_argument('--variations',action='store_true');parser.add_argument('--local',action='store_true');args=parser.parse_args();run(args.output,args.variations,args.local)
