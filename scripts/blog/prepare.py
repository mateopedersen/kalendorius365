#!/usr/bin/env python3
"""Prepare original, source-linked editorial pages. Never accesses visitor data."""
from pathlib import Path
import json,re,html,hashlib,subprocess
ROOT=Path(__file__).resolve().parents[2];SITE=ROOT/'site'
def e(s):return html.escape(str(s),quote=True)
def write(route,meta,body):
 p=SITE/route.strip('/')/'index.html';p.parent.mkdir(parents=True,exist_ok=True)
 p.write_text('---\n'+'\n'.join(f'{k}: {json.dumps(v,ensure_ascii=False)}' for k,v in meta.items())+'\n---\n'+body+'\n')
def prepare():
 posts=[]
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
  words=len(re.findall(r'\b[^\W\d_][\w-]*\b',' '.join(s['text'] for s in post['sections'])))
  if not 600<=words<=850:raise ValueError(f'{post["slug"]}: {words} words; expected 600–850')
  post['words']=words;posts.append(post)
 (SITE/'_data/blog.json').write_text(json.dumps([{'slug':p['slug'],'title':p['title']} for p in posts],ensure_ascii=False)+'\n')
 if len(posts)!=20:raise ValueError(f'Expected 20 reviewed guides, found {len(posts)}')
 cards=[]
 for post in posts:
  slug=post['slug'];route=f'/blogas/{slug}/';art=f'/assets/blog/{slug}.svg';png=f'/assets/blog/{slug}.png'
  # Native SVG artwork is authored separately and rasterized without changing it.
  svg=SITE/art.lstrip('/');out=SITE/png.lstrip('/')
  if not svg.exists():raise ValueError(f'Missing original artwork: {svg}')
  checksum=hashlib.sha256(svg.read_bytes()).hexdigest();stamp=out.with_suffix('.sha256')
  if not out.exists() or not stamp.exists() or stamp.read_text()!=checksum:
   subprocess.run(['node',str(ROOT/'scripts/blog/rasterize.mjs'),str(svg),str(out)],check=True);stamp.write_text(checksum)
  meta={'title':post['title'],'description':post['description'],'blog':True,'preserve_source':True,'og_image':png,'og_image_alt':post['image_alt'],'published':'2026-11-03','blog_slug':slug,'blog_category':post['category']}
  body=f'<article class="editorial-article"><nav aria-label="Kelias"><a href="/blogas/">Kalendoriaus užrašai</a> / {e(post["category"])}</nav><header><p class="eyebrow">{e(post["category"])}</p><h1>{e(post["title"])}</h1><p class="page-intro">{e(post["description"])}</p><p class="editorial-byline">Leidėjas <a href="/autoriai/julius-vainauskas/" rel="author">Julius Vainauskas</a> · <time datetime="2026-11-03">2026 m. lapkričio 3 d.</time> · {max(3,round(post["words"]/180))} min.</p><img class="editorial-cover" src="{art}" width="1200" height="630" alt="{e(post["image_alt"])}" decoding="async"></header>'
  body+='<nav class="editorial-toc" aria-label="Straipsnio turinys"><strong>Šiame straipsnyje</strong><ol>'+''.join(f'<li><a href="#dalis-{i}">{e(s["heading"])}</a></li>' for i,s in enumerate(post['sections'],1))+'</ol></nav>'
  for i,s in enumerate(post['sections'],1):
   body+=f'<section id="dalis-{i}"><h2>{e(s["heading"])}</h2>'+''.join(f'<p>{e(t)}</p>' for t in s['text'].split('\n\n'))+'</section>'
  body+='<aside class="editorial-sources"><h2>Šaltiniai ir naudingi įrankiai</h2><ul>'+''.join(f'<li><a href="{e(s["url"])}">{e(s["title"])}</a></li>' for s in post['sources'])+'</ul><p>Tekstas parengtas naudojant dirbtinio intelekto pagalbą ir nurodytus šaltinius. Turinio rengimo principus rasite <a href="/redakcine-politika/">atskirame puslapyje</a>. Pastebėjote klaidą? <a href="/kontaktai/">Praneškite leidėjui</a>, nurodydami šio straipsnio adresą.</p></aside>'
  related=[p for p in posts if p['slug']!=slug and p['category']==post['category']][:3]
  body+='<nav class="editorial-related" aria-label="Susiję straipsniai">'+''.join(f'<a href="/blogas/{p["slug"]}/">{e(p["title"])}</a>' for p in related)+'</nav></article>'
  write(route,meta,body)
  cards.append(f'<article class="editorial-card"><a href="{route}"><img src="{art}" width="1200" height="630" alt="{e(post["image_alt"])}" loading="lazy" decoding="async"><span>{e(post["category"])}</span><h2>{e(post["title"])}</h2><p>{e(post["description"])}</p><strong>Skaityti straipsnį →</strong></a></article>')
 write('/blogas/',{'title':'Kalendoriaus užrašai: datos, mėnesiai ir kasdieniai planai','description':'20 praktinių gidų: kalendoriaus spausdinimas, datos, savaitės, Lietuvos šventės ir asmeninio plano saugojimas.','blog':True,'preserve_source':True},'<header class="editorial-intro"><p class="eyebrow">Kalendoriaus užrašai</p><h1>Susidėliokite laiką taip, kad jis tarnautų jums.</h1><p>Kaip atsispausdinti tvarkingą mėnesį, nepasiklysti tarp savaičių numerių ar išsaugoti savo įrašus? Čia rasite konkrečius paaiškinimus, mažus pavyzdžius ir nuorodas į veikiančius įrankius.</p><a href="/autoriai/julius-vainauskas/">Apie leidėją ir turinio rengimą</a></header><div class="editorial-grid">'+''.join(cards)+'</div>')
 (ROOT/'docs/adsense').mkdir(parents=True,exist_ok=True)
 (ROOT/'docs/adsense/blog-manifest.json').write_text(json.dumps([{'url':'https://kalendorius365.lt/blogas/'+p['slug']+'/','title':p['title'],'words':p['words']} for p in posts],ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'blog_articles':len(posts),'word_range':[min(p['words'] for p in posts),max(p['words'] for p in posts)]}))
if __name__=='__main__':prepare()
