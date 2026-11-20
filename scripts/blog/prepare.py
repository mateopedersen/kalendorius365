#!/usr/bin/env python3
"""Prepare original, source-linked editorial pages. Never accesses visitor data."""
from pathlib import Path
import json,re,html
from datetime import date
from urllib.parse import urlsplit
ROOT=Path(__file__).resolve().parents[2];SITE=ROOT/'site'
def e(s):return html.escape(str(s),quote=True)

LINK = re.compile(r'\[([^\[\]\n]+)\]\(([^)\s]+)\)')
MONTHS = ('sausio', 'vasario', 'kovo', 'balandžio', 'gegužės', 'birželio',
          'liepos', 'rugpjūčio', 'rugsėjo', 'spalio', 'lapkričio', 'gruodžio')

def inline_links(text):
 parts=[]
 end=0
 for match in LINK.finditer(text):
  label,href=match.groups()
  url=urlsplit(href)
  local=href.startswith('/') and not href.startswith('//') and not url.netloc
  remote=url.scheme=='https' and url.hostname and not url.username and not url.password
  if '\\' in href or not (local or remote):
   raise ValueError(f'Invalid editorial link: {href}')
  parts.extend((e(text[end:match.start()]), f'<a href="{e(href)}">{e(label)}</a>'))
  end=match.end()
 return ''.join(parts)+e(text[end:])

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
  plain=' '.join(LINK.sub(r'\1', section['text']) for section in post['sections'])
  words=len(re.findall(r'\b[^\W\d_][\w-]*\b',plain))
  post['date']=date.fromisoformat(post.get('published','2026-11-03'))
  # Editorial scope, not an AdSense eligibility threshold. No repeated word filler.
  if not 800<=words<=1250:raise ValueError(f'{post["slug"]}: {words} words; expected reviewed guide scope 800–1250')
  post['words']=words;posts.append(post)
 slugs={post['slug'] for post in posts}
 if len(slugs)!=len(posts) or slugs!=photographs.keys() or slugs!=examples.keys() or not tool_examples.keys()<=slugs:
  raise ValueError('Article, photograph and worked example assignments must match')
 posts.sort(key=lambda post:post['date'],reverse=True)
 by_slug={post['slug']:post for post in posts}
 cards=[]
 summaries=[]
 for post in posts:
  slug=post['slug'];route=f'/blogas/{slug}/';photo=photographs[slug]
  art=photo['variants'][-1]['src'];srcset=', '.join(f'{v["src"]} {v["width"]}w' for v in photo['variants']);alt=photo['alt']
  minutes=max(3,round(post['words']/180))
  published=post['date'].isoformat()
  display_date=f'{post["date"].year} m. {MONTHS[post["date"].month-1]} {post["date"].day} d.'
  license_url=f'/nuotrauku-licencijos/#gidas-{slug}'
  summaries.append({
   'slug':slug, 'url':route, 'title':post['title'], 'description':post['description'],
   'category':post['category'], 'minutes':minutes, 'alt':alt,
   'photo':{
    'small':photo['variants'][0]['src'], 'srcset':srcset, 'caption':photo['caption'],
    'credit':f'{photo["author"]} / {photo["source_name"]} / {photo["license"]}',
    'changes':photo['changes'], 'source':photo['source'], 'license':photo['license_url'],
   },
  })
  meta={'title':post['title'],'description':post['description'],'blog':True,'preserve_source':True,'og_image':art,'og_image_alt':alt,'published':published,'blog_slug':slug,'blog_category':post['category']}
  photograph=f'<figure class="editorial-photograph"><img class="editorial-cover" src="{art}" srcset="{srcset}" sizes="(max-width: 760px) 94vw, (max-width: 1140px) 47vw, 555px" width="1200" height="630" alt="{e(alt)}" decoding="async" fetchpriority="high"><figcaption>{e(photo["caption"])} <span>Nuotrauka: {e(photo["author"])} / <a href="{e(photo["source"])}">{e(photo["source_name"])}</a>. <a href="{e(photo["license_url"])}">{e(photo["license"])}</a>. Apkirpta ir pritaikyta žiniatinkliui.</span></figcaption></figure>'
  body=f'''<article class="editorial-article editorial-article--guide">
<header class="editorial-masthead">
  <div class="editorial-masthead__copy">
    <p class="eyebrow">{e(post["category"])}</p>
    <h1>{e(post["title"])}</h1>
    <p class="page-intro">{e(post["description"])}</p>
    <p class="editorial-byline">Leidėjas <a href="/autoriai/julius-vainauskas/" rel="author">Julius Vainauskas</a> · <time datetime="{published}">{display_date}</time> · {minutes} min.</p>
  </div>
  {photograph}
</header>'''
  body+='<nav class="editorial-toc" aria-label="Straipsnio turinys"><strong>Šiame straipsnyje</strong><ol>'+''.join(f'<li><a href="#dalis-{i}">{e(s["heading"])}</a></li>' for i,s in enumerate(post['sections'],1))+'</ol></nav>'
  for i,s in enumerate(post['sections'],1):
   body+=f'<section id="dalis-{i}"><h2>{e(s["heading"])}</h2>'+''.join(f'<p>{inline_links(t)}</p>' for t in s['text'].split('\n\n'))+'</section>'
   if i==len(post['sections']) and slug in tool_examples:
    shot=tool_examples[slug];v=shot['variants'][-1];ss=', '.join(f'{item["src"]} {item["width"]}w'for item in shot['variants'])
    body+=f'<figure class="editorial-example"><a href="{e(shot["route"])}"><img src="{v["src"]}" srcset="{ss}" sizes="(max-width: 820px) 94vw, 780px" width="{v["width"]}" height="{v["height"]}" alt="{e(shot["alt"])}" loading="lazy" decoding="async"></a><figcaption>{e(shot["public_caption"])} <a href="{e(shot["route"])}">Atverti šį įrankį ir išbandyti →</a></figcaption></figure>'
  body+='<aside class="editorial-sources"><h2>Šaltiniai ir naudingi įrankiai</h2><ul>'+''.join(f'<li><a href="{e(s["url"])}">{e(s["title"])}</a></li>' for s in post['sources'])+f'</ul><p>Nuotraukos autorių, originalą ir pakeitimus rasite <a href="{license_url}">nuotraukų licencijų sąraše</a>.</p><p>Tekstas parengtas naudojant dirbtinio intelekto pagalbą ir nurodytus šaltinius. Turinio rengimo principus rasite <a href="/redakcine-politika/">atskirame puslapyje</a>. Pastebėjote klaidą? <a href="/kontaktai/">Praneškite leidėjui</a>, nurodydami šio straipsnio adresą.</p></aside>'
  related_slugs=post['related'].split(', ') if post.get('related') else []
  if slug in related_slugs or len(set(related_slugs))!=len(related_slugs):
   raise ValueError(f'Invalid related articles for {slug}')
  if related_slugs:
   related=[by_slug[key] for key in related_slugs]
   links=''.join(f'<a href="/blogas/{item["slug"]}/">{e(item["title"])}</a>' for item in related)
   body+='<nav class="editorial-related" aria-label="Susiję straipsniai">'+links+'</nav>'
  body+='</article>'
  write(route,meta,body)
  cards.append(f'<article class="editorial-card"><a href="{route}"><img src="{art}" srcset="{srcset}" sizes="(max-width: 640px) 94vw, (max-width: 1000px) 46vw, 380px" width="1200" height="630" alt="{e(alt)}" loading="lazy" decoding="async"><span>{e(post["category"])}</span><h2>{e(post["title"])}</h2><p>{e(post["description"])}</p><strong>Skaityti straipsnį →</strong></a></article>')
 (SITE/'_data/blog.json').write_text(json.dumps(summaries,ensure_ascii=False,indent=2)+'\n')
 write('/blogas/',{'title':'Kalendoriaus užrašai: datos, mėnesiai ir kasdieniai planai','description':'Lietuvos švenčių ir renginių istorijos, kalendoriaus gidai ir praktiški datos, savaičių bei kasdienių planų pavyzdžiai.','blog':True,'preserve_source':True},'<header class="editorial-intro editorial-masthead"><div class="editorial-masthead__copy"><h1>Susidėliokite laiką taip, kad jis tarnautų jums.</h1><p>Atraskite Lietuvos švenčių ir renginių istorijas, susiplanuokite išvyką arba išmokite patogiau naudotis kalendoriumi. Giduose rasite konkrečių pavyzdžių ir nuorodų į šaltinius bei įrankius.</p><a href="/autoriai/julius-vainauskas/">Apie leidėją ir turinio rengimą</a></div><img class="shell-art" src="/assets/visuals/shell/journal.svg" width="152" height="152" alt="" aria-hidden="true" decoding="async"></header><div class="editorial-grid">'+''.join(cards)+'</div>')
 (ROOT/'docs/adsense').mkdir(parents=True,exist_ok=True)
 (ROOT/'docs/adsense/blog-manifest.json').write_text(json.dumps([{'url':'https://kalendorius365.lt/blogas/'+p['slug']+'/','title':p['title'],'words':p['words']} for p in posts],ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'blog_articles':len(posts),'word_range':[min(p['words'] for p in posts),max(p['words'] for p in posts)]}))
if __name__=='__main__':prepare()
