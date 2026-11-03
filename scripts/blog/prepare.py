#!/usr/bin/env python3
"""Prepare original, source-linked editorial pages. Never accesses visitor data."""
from pathlib import Path
import json,re,html
ROOT=Path(__file__).resolve().parents[2];SITE=ROOT/'site'
def e(s):return html.escape(str(s),quote=True)
def write(route,meta,body):
 p=SITE/route.strip('/')/'index.html';p.parent.mkdir(parents=True,exist_ok=True)
 p.write_text('---\n'+'\n'.join(f'{k}: {json.dumps(v,ensure_ascii=False)}' for k,v in meta.items())+'\n---\n'+body+'\n')
def prepare():
 posts=[]
 photographs=json.loads((ROOT/'data/blog/photographs.json').read_text())
 tool_examples=json.loads((ROOT/'data/blog/tool-examples.json').read_text())
 examples={}
 for block in (ROOT/'data/blog/worked-examples.txt').read_text().split('@@ ')[1:]:
  slug,section=block.split('\n## ',1);heading,text=section.split('\n',1)
  examples[slug.strip()]={'heading':heading,'text':text.strip()}
 manuscript=(ROOT/'data/blog/articles.txt').read_text()
 for block in manuscript.split('\n@@ ')[1:]:
  meta,*sections=block.split('\n## ');lines=meta.splitlines();post={'slug':lines[0].strip(),'sources':[],'sections':[]}
  for line in lines[1:]:
   if not line.strip():continue
   k,v=line.split(': ',1)
   if k=='source':
    url,title=v.split(' | ',1);post['sources'].append({'url':url,'title':title})
   else:post[k]=v
  for s in sections:
   heading,text=s.split('\n',1);post['sections'].append({'heading':heading,'text':text.strip()})
  post['sections'].append(examples[post['slug']])
  words=len(re.findall(r'\b[^\W\d_][\w-]*\b',' '.join(s['text'] for s in post['sections'])))
  # Editorial scope, not an AdSense eligibility threshold. No repeated word filler.
  if not 800<=words<=1250:raise ValueError(f'{post["slug"]}: {words} words; expected reviewed guide scope 800–1250')
  post['words']=words;posts.append(post)
 (SITE/'_data/blog.json').write_text(json.dumps([{'slug':p['slug'],'title':p['title']} for p in posts],ensure_ascii=False)+'\n')
 if len(posts)!=20:raise ValueError(f'Expected 20 reviewed guides, found {len(posts)}')
 cards=[]
 for post in posts:
  slug=post['slug'];route=f'/blogas/{slug}/';photo=photographs[slug]
  art=photo['variants'][-1]['src'];srcset=', '.join(f'{v["src"]} {v["width"]}w' for v in photo['variants']);alt=photo['alt']
  meta={'title':post['title'],'description':post['description'],'blog':True,'preserve_source':True,'og_image':art,'og_image_alt':alt,'published':'2026-11-03','blog_slug':slug,'blog_category':post['category']}
  photograph=f'<figure class="editorial-photograph"><img class="editorial-cover" src="{art}" srcset="{srcset}" sizes="(max-width: 820px) 94vw, 780px" width="1200" height="630" alt="{e(alt)}" decoding="async" fetchpriority="high"><figcaption>{e(photo["caption"])} <span>Nuotrauka: {e(photo["author"])} / <a href="{e(photo["source"])}">{e(photo["source_name"])}</a>. <a href="{e(photo["license_url"])}">{e(photo["license"])}</a>. Apkirpta ir pritaikyta žiniatinkliui.</span></figcaption></figure>'
  body=f'<article class="editorial-article"><nav aria-label="Kelias"><a href="/blogas/">Kalendoriaus užrašai</a> / {e(post["category"])}</nav><header><h1>{e(post["title"])}</h1><p class="editorial-byline">Leidėjas <a href="/autoriai/julius-vainauskas/" rel="author">Julius Vainauskas</a> · <time datetime="2026-11-03">2026 m. lapkričio 3 d.</time> · {max(3,round(post["words"]/180))} min.</p>{photograph}<p class="page-intro">{e(post["description"])}</p></header>'
  body+='<nav class="editorial-toc" aria-label="Straipsnio turinys"><strong>Šiame straipsnyje</strong><ol>'+''.join(f'<li><a href="#dalis-{i}">{e(s["heading"])}</a></li>' for i,s in enumerate(post['sections'],1))+'</ol></nav>'
  for i,s in enumerate(post['sections'],1):
   body+=f'<section id="dalis-{i}"><h2>{e(s["heading"])}</h2>'+''.join(f'<p>{e(t)}</p>' for t in s['text'].split('\n\n'))+'</section>'
   if i==len(post['sections']):
    shot=tool_examples[slug];v=shot['variants'][-1];ss=', '.join(f'{item["src"]} {item["width"]}w'for item in shot['variants'])
    body+=f'<figure class="editorial-example"><a href="{e(shot["route"])}"><img src="{v["src"]}" srcset="{ss}" sizes="(max-width: 820px) 94vw, 780px" width="{v["width"]}" height="{v["height"]}" alt="{e(shot["alt"])}" loading="lazy" decoding="async"></a><figcaption>{e(shot["public_caption"])} <a href="{e(shot["route"])}">Atverti šį įrankį ir išbandyti →</a></figcaption></figure>'
  body+='<aside class="editorial-sources"><h2>Šaltiniai ir naudingi įrankiai</h2><ul>'+''.join(f'<li><a href="{e(s["url"])}">{e(s["title"])}</a></li>' for s in post['sources'])+'</ul><p>Tekstas parengtas naudojant dirbtinio intelekto pagalbą ir nurodytus šaltinius. Turinio rengimo principus rasite <a href="/redakcine-politika/">atskirame puslapyje</a>. Pastebėjote klaidą? <a href="/kontaktai/">Praneškite leidėjui</a>, nurodydami šio straipsnio adresą.</p></aside>'
  related=[p for p in posts if p['slug']!=slug and p['category']==post['category']][:3]
  body+='<nav class="editorial-related" aria-label="Susiję straipsniai">'+''.join(f'<a href="/blogas/{p["slug"]}/">{e(p["title"])}</a>' for p in related)+'</nav></article>'
  write(route,meta,body)
  cards.append(f'<article class="editorial-card"><a href="{route}"><img src="{art}" srcset="{srcset}" sizes="(max-width: 640px) 94vw, (max-width: 1000px) 46vw, 380px" width="1200" height="630" alt="{e(alt)}" loading="lazy" decoding="async"><span>{e(post["category"])}</span><h2>{e(post["title"])}</h2><p>{e(post["description"])}</p><strong>Skaityti straipsnį →</strong></a></article>')
 write('/blogas/',{'title':'Kalendoriaus užrašai: datos, mėnesiai ir kasdieniai planai','description':'20 praktinių gidų: kalendoriaus spausdinimas, datos, savaitės, Lietuvos šventės ir asmeninio plano saugojimas.','blog':True,'preserve_source':True},'<header class="editorial-intro"><p class="eyebrow">Kalendoriaus užrašai</p><h1>Susidėliokite laiką taip, kad jis tarnautų jums.</h1><p>Kaip atsispausdinti tvarkingą mėnesį, nepasiklysti tarp savaičių numerių ar išsaugoti savo įrašus? Čia rasite konkrečius paaiškinimus, mažus pavyzdžius ir nuorodas į veikiančius įrankius.</p><a href="/autoriai/julius-vainauskas/">Apie leidėją ir turinio rengimą</a></header><div class="editorial-grid">'+''.join(cards)+'</div>')
 (ROOT/'docs/adsense').mkdir(parents=True,exist_ok=True)
 (ROOT/'docs/adsense/blog-manifest.json').write_text(json.dumps([{'url':'https://kalendorius365.lt/blogas/'+p['slug']+'/','title':p['title'],'words':p['words']} for p in posts],ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'blog_articles':len(posts),'word_range':[min(p['words'] for p in posts),max(p['words'] for p in posts)]}))
if __name__=='__main__':prepare()
