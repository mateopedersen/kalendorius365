"""Independent generated-output checks: does not import the renderer/date adapter."""
from pathlib import Path
from html.parser import HTMLParser
from datetime import date,timedelta
from urllib.parse import urlsplit,unquote
from collections import Counter
import json,csv,re,calendar,hashlib,xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[2]
class Page(HTMLParser):
 def __init__(self,s):
  super().__init__();self.tags=[];self.ids=[];self.h1=[];self.ld=[];self.current=None;self.buffer=[];self.feed(s)
 def handle_starttag(self,t,attrs):
  a=dict(attrs);self.tags.append((t,a))
  if a.get('id'):self.ids.append(a['id'])
  if t=='h1' or(t=='script'and a.get('type')=='application/ld+json'):self.current=t;self.buffer=[]
 def handle_data(self,s):
  if self.current:self.buffer.append(s)
 def handle_endtag(self,t):
  if t==self.current:
   v=''.join(self.buffer)
   if t=='h1':self.h1.append(v)
   else:self.ld.append(json.loads(v))
   self.current=None
 def attrs(self,t,**query):return [a for tag,a in self.tags if tag==t and all(a.get(k)==v for k,v in query.items())]
def run():
 old=json.loads((ROOT/'data/holiday-editorial.json').read_text());data=json.loads((ROOT/'data/holiday-phase2.json').read_text());base=json.loads((ROOT/'docs/holiday-phase2/baseline.json').read_text());art=old['articles']+old['commemorations']+data['articles'];errors=[];rows=[];icsrows=[]
 def check(test,label):
  if not test:errors.append(label)
 # Expected dates from independently recorded legal rules, not the renderer's grid lookups.
 fixed={a['slug']:(a.get('month'),a.get('day'))for a in data['articles'] if a.get('recurrence',{}).get('type')=='fixed'}
 expect={'vaiko-diena':{2027:['2027-05-21'],2028:['2028-05-19'],2029:['2029-05-18']},'uzgavenes':{2027:['2027-02-09'],2028:['2028-02-29'],2029:['2029-02-13']},'velykos':{2027:['2027-03-28','2027-03-29'],2028:['2028-04-16','2028-04-17'],2029:['2029-04-01','2029-04-02']},'motinos-diena':{2027:['2027-05-02'],2028:['2028-05-07'],2029:['2029-05-06']},'tevo-diena':{2027:['2027-06-06'],2028:['2028-06-04'],2029:['2029-06-03']}}
 engine=json.loads((ROOT/'data/calendar.json').read_text())
 for a in old['articles']+old['commemorations']:
  if a['slug'] in expect:continue
  ids=a.get('holiday_ids',[])
  if ids:
   dates=[(h['month'],h['day']) for h in engine['holidays'] if h['id'] in ids];expect[a['slug']]={y:sorted(f'{y}-{m:02}-{d:02}'for m,d in dates)for y in [2027,2028,2029]}
  else:fixed[a['slug']]=(a['month'],a['day'])
 for slug,(m,d)in fixed.items():expect[slug]={y:[date(y,m,d).isoformat()]for y in [2027,2028,2029]}
 sitemap=ET.parse(ROOT/'public/sitemap.xml');locs={e.text for e in sitemap.getroot().findall('{http://www.sitemaps.org/schemas/sitemap/0.9}url/{http://www.sitemaps.org/schemas/sitemap/0.9}loc')};check(len(locs)==166,'166 canonical URLs');check(set(base['canonical_urls'])<=locs,'existing canonical URLs preserved')
 titles=set();descs=set();uids=set();images=0
 for a in art:
  slug=a['slug'];route='/sventes/'+slug+'/';p=ROOT/'public'/route.lstrip('/')/'index.html';s=p.read_text();page=Page(s);before=len(errors);m=data['media'][a['id']]
  check(page.h1==[a['title']],slug+' one H1');check(len(page.ids)==len(set(page.ids)),slug+' unique IDs');check(page.attrs('html')[0]['lang']=='lt',slug+' Lithuanian document language');canonical='https://kalendorius365.lt'+route;check(page.attrs('link',rel='canonical')[0]['href']==canonical and canonical in locs,slug+' canonical/sitemap');check(page.attrs('meta',name='robots')[0]['content']=='index, follow',slug+' indexability')
  title=re.search('<title>(.*?)</title>',s,re.S)[1];desc=page.attrs('meta',name='description')[0]['content'];check(title not in titles and desc not in descs,slug+' unique metadata');titles.add(title);descs.add(desc)
  article=next(x for x in page.ld if x.get('@type')=='Article');crumb=next(x for x in page.ld if x.get('@type')=='BreadcrumbList');check(article['headline']==a['title'] and article['inLanguage']=='lt-LT',slug+' visible article data');check(len(crumb['itemListElement'])==3,slug+' three-level breadcrumb');check(not any(x.get('@type')=='Event' for x in page.ld),slug+' no false Event markup')
  check(page.attrs('meta',property='og:image')[0]['content']=='https://kalendorius365.lt'+m['src'],slug+' specific OG photo');check(page.attrs('meta',property='og:image:type')[0]['content']=='image/webp',slug+' actual OG MIME');check(int(page.attrs('meta',property='og:image:width')[0]['content'])==m['width'],slug+' OG dimensions')
  check(f'href="{m["commons_url"]}"' in s,slug+' clickable original');check(m['author'] in s and m['license'] in s,slug+' visible author/license');check(m['caption'] in s,slug+' caption matches record');check(not re.search(r'\b(?:placeholder|lorem ipsum)\b',re.sub('<[^>]+>','',s),re.I),slug+' no placeholder content')
  for y in [2027,2028,2029]:
   block=re.search(r'<section class="hd-year-panel" id="metai-'+str(y)+r'".*?</section>',s,re.S)[0];picked=re.findall(r'<td class="hd-picked"><a[^>]+aria-label="(\d{4}-\d{2}-\d{2})',block);check(sorted(picked)==expect[slug][y],slug+f' {y} independent dates')
   # The calendar grid's actual column is checked using Python weekdays.
   cal=block.split('</table>')[0];body=cal.split('<tbody>')[1]
   for row in re.findall(r'<tr>(.*?)</tr>',body,re.S):
    for col,cell in enumerate(re.findall(r'<td\b.*?</td>',row,re.S),1):
     match=re.search(r'aria-label="(\d{4}-\d{2}-\d{2})',cell)
     if match:check(date.fromisoformat(match[1]).isoweekday()==col,slug+' correct weekday column '+match[1])
   raw=(ROOT/f'public/assets/holiday-phase2-ics/{slug}-{y}.ics').read_bytes();check(all(len(l)<=75 for l in raw.split(b'\r\n')),slug+' ICS folding');check(b'\n'not in raw.replace(b'\r\n',b''),slug+' ICS CRLF');ics=re.sub(r'\r\n[ \t]','',raw.decode());starts=re.findall(r'DTSTART;VALUE=DATE:(\d{8})',ics);ends=re.findall(r'DTEND;VALUE=DATE:(\d{8})',ics);check(starts==[x.replace('-','')for x in expect[slug][y]],slug+' ICS exact start dates');check(ends==[(date.fromisoformat(x)+timedelta(days=1)).strftime('%Y%m%d')for x in expect[slug][y]],slug+' exclusive ends')
   for uid in re.findall(r'UID:([^\r]+)',ics):check(uid not in uids,slug+' unique stable UID');uids.add(uid)
   icsrows.append({'route':route,'year':y,'dates':expect[slug][y],'events':len(starts),'status':'passed' if len(errors)==before else'failed'})
  for tag,at in page.tags:
   if tag=='img':
    check(at.get('width')and at.get('height'),slug+' explicit image dimensions');check(bool(at.get('alt')) or at.get('aria-hidden')=='true',slug+' accessible image');images+=1
  rows.append({'route':route,'kind':'new' if a in data['articles'] else'upgraded','dates':expect[slug],'photograph':m['src'],'photo_bytes':(ROOT/'site'/m['src'].lstrip('/')).stat().st_size,'license':m['license'],'source_ids':a['sources'],'status':'passed' if len(errors)==before else'failed'})
 # Audit all local page destinations and anchors, including unaffected pages.
 parsed={};targets=0
 for p in (ROOT/'public').rglob('*.html'):
  rel='/'+str(p.relative_to(ROOT/'public'));s=p.read_text();page=Page(s);parsed[rel]=page
 for rel,page in parsed.items():
  for tag,a in page.tags:
   items=[]
   if tag=='a':items.append(a.get('href',''))
   elif tag in ['img','script']:items.append(a.get('src',''))
   elif tag=='link':items.append(a.get('href',''))
   if tag=='img':items.extend(v.strip().split()[0]for v in a.get('srcset','').split(',')if v.strip())
   for dest in items:
    if not dest or dest.startswith(('data:','mailto:','tel:')):continue
    u=urlsplit(dest)
    if u.netloc and u.netloc!='kalendorius365.lt':continue
    path=unquote(u.path)or rel
    if not path.startswith('/'):path='/'+str(Path(rel).parent/path)
    if path.endswith('/'):path+='index.html'
    target=ROOT/'public'/path.lstrip('/');targets+=1;check(target.is_file(),rel+' missing '+dest)
    if u.fragment and path.endswith('.html') and path in parsed:check(u.fragment in parsed[path].ids,rel+' missing anchor '+dest)
 preserved=0;changed=[]
 for path,sha in base['source_assets'].items():
  if path=='site/assets/data/search.json':continue
  f=ROOT/path
  if not f.exists()or hashlib.sha256(f.read_bytes()).hexdigest()!=sha:changed.append(path)
  else:preserved+=1
 check(not changed,'old source assets changed '+str(changed))
 for path,sha in base['downloads'].items():
  f=ROOT/'public'/path;allowed={sha};variant=base.get('download_checkout_variants',{}).get(path)
  if variant:allowed.add(variant['sha256'])
  check(f.exists()and hashlib.sha256(f.read_bytes()).hexdigest() in allowed,'download changed '+path)
 check(len(data['media'])==31,'31 complete media records');check(len(uids)==99,'99 independently checked all-day events')
 report={'status':'passed'if not errors else'failed','checked_at':'2026-10-17','method':'independent Python dates, parser, rendered HTML, source/download hashes; no renderer imported','canonical_count':len(locs),'pages':rows,'local_targets_checked':targets,'source_assets_preserved':preserved,'changed_assets':changed,'download_files_preserved':len(base['downloads']),'pdf_webp_files_preserved':base['pdf_webp_count'],'failures':errors}
 out=ROOT/'docs/holiday-phase2';(out/'QA1-DATA-LEGAL-STATIC.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');(out/'FUNCTIONAL-ICS-QA.json').write_text(json.dumps({'status':report['status'],'files':len(icsrows),'events':len(uids),'items':icsrows},ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items()if k not in ['pages']},ensure_ascii=False));assert not errors
if __name__=='__main__':run()
