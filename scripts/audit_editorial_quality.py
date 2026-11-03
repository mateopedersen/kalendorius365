#!/usr/bin/env python3
"""URL-by-URL public HTML review. Word counts are diagnostics, not Google rules."""
import argparse
import collections
import hashlib
import html.parser
import json
import re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SKIP={'script','style','svg','nav','footer','form','table','figure','button','label','noscript','select','dialog'}
VOID={'meta','link','img','input','br','hr','source','wbr','area','base','embed','param','track','col'}
def words(text):return len(re.findall(r'\b[^\W\d_][\w-]*\b',text))
def normalized(text):return re.sub(r'\d+(?:[.,:]\d+)*','#',text.lower())
class Node:
 def __init__(self,tag='',attrs=None,parent=None):self.tag=tag;self.attrs=attrs or {};self.parent=parent;self.children=[]
 def text(self,skip=()):return '' if self.tag in skip else ' '.join(c if isinstance(c,str)else c.text(skip)for c in self.children)
 def find(self,tag=None):
  for c in self.children:
   if isinstance(c,Node):
    if tag is None or c.tag==tag:yield c
    yield from c.find(tag)
 def excluded(self):
  node=self
  while node:
   if node.tag in SKIP:return True
   if any(token in node.attrs.get('class','').split()for token in ['editorial-byline','editorial-sources','source-note','holiday-source-note','holiday-art__credit']):return True
   node=node.parent
  return False
class Document(html.parser.HTMLParser):
 def __init__(self,text):
  super().__init__(convert_charrefs=True);self.root=Node();self.stack=[self.root];self.feed(text)
 def handle_starttag(self,tag,attrs):
  node=Node(tag,dict(attrs),self.stack[-1]);self.stack[-1].children.append(node)
  if tag not in VOID:self.stack.append(node)
 def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs);self.handle_endtag(tag)
 def handle_endtag(self,tag):
  if tag in VOID:return
  for i in range(len(self.stack)-1,0,-1):
   if self.stack[i].tag==tag:self.stack=self.stack[:i];break
 def handle_data(self,data):self.stack[-1].children.append(data)
def inspect(route,text):
 doc=Document(text);nodes=list(doc.root.find());main=next((n for n in nodes if n.tag=='main'),None)
 if not main:raise ValueError('Missing main: '+route)
 meta={n.attrs.get('name',n.attrs.get('property','')):n.attrs.get('content','')for n in nodes if n.tag=='meta'}
 canonical=next((n.attrs.get('href','')for n in nodes if n.tag=='link' and n.attrs.get('rel')=='canonical'),'')
 paragraphs=[]
 for node in main.find():
  if node.tag not in {'p','li'} or node.excluded():continue
  # Parent paragraph/list items are counted once, never again through nested items.
  ancestor=node.parent
  if ancestor and ancestor.tag in {'p','li'}:continue
  value=' '.join(node.text(SKIP).split())
  if len(value.split())<7:continue
  paragraphs.append(value)
 title=next((n.text()for n in nodes if n.tag=='title'),'')
 return dict(route=route,title=title,canonical=canonical,robots=meta.get('robots',''),h1_count=sum(n.tag=='h1'for n in main.find()),
             viewport=meta.get('viewport',''),og_image=meta.get('og:image',''),main_words=words(main.text({'script','style','svg'})),
             primary_prose_words=words(' '.join(paragraphs)),data_rows=sum(n.tag=='tr'for n in main.find()),
             image_count=sum(n.tag=='img'for n in main.find()),_paragraphs=paragraphs,html_sha256=hashlib.sha256(text.encode()).hexdigest())
def category(route):
 if route.startswith('/dalintis/'):return 'individual_print_download'
 if '/v-'in route:return 'dated_horoscope_snapshot'
 if route=='/horoskopai/istorija/':return 'publication_history'
 if route.startswith('/blogas/'):return 'editorial_guide_or_hub'
 if route.startswith('/sventes/'):return 'holiday_or_commemoration'
 if route.startswith('/menulio'):return 'lunar_data_or_guide'
 if route.startswith('/vardadieniai/'):return 'nameday_data'
 if re.match(r'/202[789]/',route):return 'calendar_download_catalogue'
 if route in ['/privatumas/','/kontaktai/','/apie-mus/','/autoriai/julius-vainauskas/','/redakcine-politika/']:return 'publisher_or_policy'
 return 'tool_or_explainer'
def audit(baseline=None):
 pages=[];before=[];issues=[]
 for path in sorted((ROOT/'public').rglob('index.html')):
  route='/'+path.parent.relative_to(ROOT/'public').as_posix().strip('./')+'/'
  if route=='//':route='/'
  row=inspect(route,path.read_text());row['family']=category(route)
  if row['h1_count']!=1:issues.append([route,'h1_count',row['h1_count']])
  if row['canonical']!='https://kalendorius365.lt'+route:issues.append([route,'canonical',row['canonical']])
  if not row['og_image']:issues.append([route,'missing_og_image'])
  if 'width=device-width'not in row['viewport']:issues.append([route,'viewport'])
  if baseline:
   old=Path(baseline)/path.relative_to(ROOT/'public')
   if old.exists():before.append(inspect(route,old.read_text()))
  pages.append(row)
 for rows in [pages,before]:
  frequency=collections.Counter()
  for row in rows:frequency.update(set(normalized(t)for t in row['_paragraphs']))
  for row in rows:
   row['prose_words_excluding_shared_paragraphs']=sum(words(t)for t in row.pop('_paragraphs')if frequency[normalized(t)]<8)
 old={r['route']:r for r in before}
 catalogue={r['route']:r for r in json.loads((ROOT/'docs/adsense-v2/catalogue-enrichment.json').read_text())}
 for row in pages:
  previous=old.get(row['route']);row['before']= {k:previous[k]for k in ['main_words','primary_prose_words','prose_words_excluding_shared_paragraphs']} if previous else None
  row['html_changed_from_baseline']=previous['html_sha256']!=row['html_sha256'] if previous else None
  row['editorial_action']='source_bound_example_or_file_context_added' if row['route']in catalogue else 'blog_photography_and_worked_example' if row['route'].startswith('/blogas/')else 'purpose_reviewed_truthful_information_retained'
  if row['route']=='/redakcine-politika/':row['editorial_action']='photography_and_screenshot_provenance_policy_updated'
  row['review_method']='Automated complete HTML inspection plus AI-assisted source/example review; not a claim of independent human proofreading.'
 def summary(rows):
  selected=[r for r in rows if r['robots'].startswith('index')]
  return {'urls':len(rows),'indexable':len(selected),'noindex':len(rows)-len(selected),'indexable_main_word_average':round(sum(r['main_words']for r in selected)/len(selected),1),'indexable_primary_prose_average':round(sum(r['primary_prose_words']for r in selected)/len(selected),1),'indexable_primary_prose_average_excluding_shared_paragraphs':round(sum(r['prose_words_excluding_shared_paragraphs']for r in selected)/len(selected),1)} if rows else None
 report={'scope':'All generated public HTML URLs. Menus, forms, table data, source credits and captions excluded from primary prose; paragraphs shared by8+routes excluded in a separate metric. No minimum word count or Google approval is inferred.', 'before':summary(before),'after':summary(pages),'families':dict(collections.Counter(r['family']for r in pages)),'issues':issues,'pages':pages}
 out=ROOT/'docs/adsense-v2/url-review.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:v for k,v in report.items()if k!='pages'},ensure_ascii=False))
 if issues:raise SystemExit(1)
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--baseline');args=parser.parse_args();audit(args.baseline)
