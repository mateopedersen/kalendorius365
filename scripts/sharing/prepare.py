"""Public-only share catalogue, immutable horoscope history and static OG cards.
No user input, browser storage or private calendar files are read by this build.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, re, hashlib, html, subprocess
from urllib.parse import quote, urlencode
ROOT=Path(__file__).resolve().parents[2]; SITE=ROOT/'site'; ASSETS=SITE/'assets/sharing'; ORIGIN='https://kalendorius365.lt'
MONTHS=['sausis','vasaris','kovas','balandis','geguze','birzelis','liepa','rugpjutis','rugsejis','spalis','lapkritis','gruodis']
NAMES=['Sausis','Vasaris','Kovas','Balandis','Gegužė','Birželis','Liepa','Rugpjūtis','Rugsėjis','Spalis','Lapkritis','Gruodis']
GEN=['sausio','vasario','kovo','balandžio','gegužės','birželio','liepos','rugpjūčio','rugsėjo','spalio','lapkričio','gruodžio']
DEFAULT='/assets/visuals/kalendorius365-lietuviskas-kalendorius-1200x630.png'
def dump(p,data):
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(data,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n')
def digest(data):return hashlib.sha256(json.dumps(data,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def metadata(path,key,default=''):
 match=re.search(r'^'+re.escape(key)+r':\s*(.+)$',path.read_text(),re.M)
 if not match:return default
 value=match.group(1)
 try:return json.loads(value)
 except ValueError:return value.strip('"\'')
def e(s):return html.escape(str(s),quote=True)
def local_date(date):
 y,m,d=map(int,date.split('-'));return f'{y} m. {GEN[m-1]} {d} d.'
def record(kind,ident,route,title,excerpt,**fields):
 return dict(kind=kind,contentId=ident,canonicalUrl=ORIGIN+route,shareUrl=ORIGIN+route,title=title,excerpt=excerpt,locale='lt-LT',timezone='Europe/Vilnius',imageUrl=ORIGIN+DEFAULT,imageAlt=title,artwork=DEFAULT,**fields)
def font(size,bold=False):return ImageFont.truetype(str(SITE/'assets/fonts'/('Lato-Bold.ttf' if bold else 'Lato-Regular.ttf')),size)
def wrap(draw,text,f,maxwidth,maxlines):
 words=text.split();lines=[];line=''
 for word in words:
  candidate=(line+' '+word).strip()
  if draw.textlength(candidate,font=f)>maxwidth and line:lines.append(line);line=word
  else:line=candidate
 if line:lines.append(line)
 if len(lines)>maxlines:
  lines=lines[:maxlines];last=lines[-1]
  while last and draw.textlength(last+'…',font=f)>maxwidth:last=last[:-1]
  lines[-1]=last.rstrip()+'…'
 return lines

def og_card(p):
 identity={k:p.get(k) for k in ['kind','contentId','title','excerpt','contentDate','contentVersion','templateId','artwork']};identity['renderer']='share-og-v1';identity['locale']='lt-LT';identity['format']='1200x630'
 source=SITE/p['artwork'].lstrip('/');identity['art_sha256']=hashlib.sha256(source.read_bytes()).hexdigest() if source.is_file() else None
 token=digest(identity)[:24];out=ASSETS/'og'/f'{token}.png'
 if not out.exists():
  out.parent.mkdir(parents=True,exist_ok=True);im=Image.new('RGB',(1200,630),'#f3f7f5');d=ImageDraw.Draw(im)
  d.rounded_rectangle((28,28,1172,602),radius=34,fill='white');d.rectangle((28,175,36,455),fill='#006a44')
  if source.is_file():
   art=Image.open(source).convert('RGBA');art.thumbnail((410,424),Image.Resampling.LANCZOS);im.paste(art,(55+(410-art.width)//2,99+(424-art.height)//2),art)
  x=510;d.text((x,65),'KALENDORIUS365',fill='#006a44',font=font(21,True))
  y=114
  for line in wrap(d,p['title'],font(43,True),603,3):d.text((x,y),line,font=font(43,True),fill='#111b2e');y+=52
  date=p.get('displayDate') or (str(p['year'])+' metai' if p.get('year') else '')
  if date:d.text((x,y+8),date,font=font(24),fill='#5c6980');y+=50
  for line in wrap(d,p['excerpt'],font(27),595,4):d.text((x,y+8),line,font=font(27),fill='#334155');y+=36
  if p['kind']=='horoscope':d.text((x,510),'Pramogai ir apmąstymui',font=font(20),fill='#5c6980')
  d.line((65,550,1135,550),fill='#dfe8e1',width=2);d.text((65,564),'kalendorius365.lt',font=font(20,True),fill='#006a44');d.text((840,564),'Atraskite savo dieną',font=font(19),fill='#5c6980')
  im.save(out,optimize=True)
 p['imageUrl']=ORIGIN+'/assets/sharing/og/'+out.name

def page(route,title,description,body,**extra):
 out=SITE/route.strip('/')/'index.html';out.parent.mkdir(parents=True,exist_ok=True)
 meta={'title':title,'description':description,'robots':'noindex, follow','share_archive':True,**extra}
 out.write_text('---\n'+'\n'.join(f'{k}: {json.dumps(v,ensure_ascii=False)}' for k,v in meta.items())+'\n---\n'+body+'\n')

def prepare():
 ASSETS.mkdir(parents=True,exist_ok=True);pages={};keys={}
 for path in sorted(SITE.rglob('index.html')):
  route='/'+str(path.parent.relative_to(SITE)).strip('./')+'/'
  if path.parent==SITE:route='/'
  if route.startswith(('/dalintis/','/horoskopai/')) and ('/v-' in route or '/dalintis/kalendorius/' in route or re.search(r'/\d{4}-\d\d-\d\d/',route)):continue
  title=metadata(path,'title','Kalendorius365');desc=metadata(path,'description',title)
  ident='site' if route=='/' else 'page-'+hashlib.sha256(route.encode()).hexdigest()[:16]
  p=record('site' if route=='/' else 'page',ident,route,title,desc)
  img=metadata(path,'og_image',DEFAULT);p['imageUrl']=ORIGIN+img if img.startswith('/') else img;p['artwork']=img if img.startswith('/') else DEFAULT;p['imageAlt']=metadata(path,'og_image_alt',title)
  pages[route]=p
 manifest=json.loads((SITE/'assets/data/manifest.json').read_text())['assets']
 years=json.loads((SITE/'assets/data/years.json').read_text())
 calendar={(y['year'],m['month']):m for y in years for m in y['months']}
 # The existing manifest and calendar model supply every year/month/design.
 for a in manifest:
  if a['kind']=='blank':
   stem=a['stem'];route=f'/dalintis/kalendorius/{stem}/';title=a['name']+' · nedatuotas spausdinamas kalendorius'
   p=record('design','design-'+stem,route,title,a.get('description') or 'Nedatuotas kalendoriaus maketas spausdinimui.',templateId=stem,designType='blank',pdf=ORIGIN+a['pdf'],webp=ORIGIN+a['webp']);p['artwork']=a['preview']
   p['imageAlt']=a.get('alt',title);og_card(p);pages[route]=p;keys[p['contentId']]=p
   body=f'<section class="share-landing"><p class="eyebrow">Nedatuotas kalendoriaus maketas · {e(a["name"])}</p><h1>{e(title)}</h1><p>{e(p["excerpt"])}</p><img class="share-design-preview" src="{e(a["preview"])}" width="{680 if a["landscape"] else 481}" height="{481 if a["landscape"] else 680}" alt="{e(a.get("alt",title))}" decoding="async"><div class="toolbar-group"><a class="button primary" href="{e(a["pdf"])}" download>Atsisiųsti PDF</a><a class="button" href="{e(a["webp"])}" download>Atsisiųsti WebP</a><a class="button" href="{e(a["pdf"])}" target="_blank" rel="noopener noreferrer">Spausdinti PDF ↗</a></div><p><a href="/tuscias-kalendorius/#perziura">Visi šio tipo planuokliai</a></p><p>Dalijamasi tik viešu kalendoriumi. Asmeniniai įrašai neįtraukiami.</p></section>'
   page(route,title+' · '+stem,p['excerpt']+' · '+stem,body);continue
  if a['kind'] not in ('annual','monthly'):continue
  y=a['year'];m=a.get('month');stem=a['stem'];parent=f'/{y}/{MONTHS[m-1]}/' if m else f'/{y}/'
  route=f'/dalintis/kalendorius/{stem}/';title=f'{y} m. {GEN[m-1]} kalendorius · {a["name"]}' if m else f'{y} metų kalendorius · {a["name"]}'
  p=record('design','design-'+stem,route,title,a.get('description') or 'Pasirinktas lietuviško kalendoriaus maketas spausdinimui.',year=y,templateId=stem,designType='dated',pdf=ORIGIN+a['pdf'],webp=ORIGIN+a['webp'])
  if m:p['month']=m
  p['artwork']=a['preview'];og_card(p);pages[route]=p;keys[p['contentId']]=p
  body=f'<section class="share-landing"><p class="eyebrow">Pasirinktas kalendoriaus dizainas · {e(a["design"])}</p><h1>{e(title)}</h1><p>{e(p["excerpt"])}</p><img class="share-design-preview" src="{e(a["preview"])}" width="{680 if a["landscape"] else 481}" height="{481 if a["landscape"] else 680}" alt="{e(a.get("alt",title))}" decoding="async"><div class="toolbar-group"><a class="button primary" href="{e(a["pdf"])}" download>Atsisiųsti PDF</a><a class="button" href="{e(a["webp"])}" download>Atsisiųsti WebP</a><a class="button" href="{e(a["pdf"])}" target="_blank" rel="noopener noreferrer">Spausdinti PDF ↗</a></div><p><a href="{parent}#dizainas-{e(stem)}">Visi šio laikotarpio dizainai</a></p><p>Dalijamasi tik viešu kalendoriumi. Asmeniniai įrašai neįtraukiami.</p></section>'
  page(route,title+' · dizainas '+str(a['design']),p['excerpt']+' · Dizainas '+str(a['design'])+' · '+stem,body)
  # Replace the generic year/month link preview with a representative real design.
  if a['design']=='01' and parent in pages:
   base=pages[parent];base.update(kind='calendar',year=y,artwork=a['preview'])
   if m:base.update(month=m,calendar=calendar[(y,m)])
   og_card(base)
 current=json.loads((SITE/'_data/horoscope_current.json').read_text());signs={s['key']:s for s in json.loads((SITE/'_data/horoscope_signs.json').read_text())}
 date=current['local_date'];version=current['content_checksum'][:16]
 history=ROOT/'data/horoscope-snapshots';history.mkdir(parents=True,exist_ok=True);saved=history/date/(version+'.json')
 if not saved.exists():dump(saved,{'contentDate':date,'contentVersion':version,'forecasts':current['forecasts'],'provider_footer':current.get('provider_footer',''),'attribution':current['attribution_text'],'source_url':current.get('source_url')})
 snapshot=json.loads(saved.read_text())
 if 'artwork' not in snapshot:
  snapshot['artwork']={}
  for slug in signs:
   original=SITE/f'assets/visuals/zodiac/{slug}.svg';raster=ASSETS/'artwork'/f'{slug}-{hashlib.sha256(original.read_bytes()).hexdigest()[:12]}.png'
   if not raster.exists():
    raster.parent.mkdir(parents=True,exist_ok=True);subprocess.run(['node',str(ROOT/'scripts/sharing/rasterize.mjs'),str(original),str(raster)],check=True)
   snapshot['artwork'][slug]='/'+str(raster.relative_to(SITE))
  dump(saved,snapshot)
 indexpath=history/'index.json';index=json.loads(indexpath.read_text()) if indexpath.exists() else {};index.setdefault(date,version);dump(indexpath,index)
 for saved in sorted(history.glob('*/*.json')):
  snapshot=json.loads(saved.read_text());date=snapshot['contentDate'];version=snapshot['contentVersion']
  if saved.stem!=version or saved.parent.name!=date:raise ValueError('snapshot identity mismatch')
  fields=['sign_key','editorial_heading','lead','overview','relationships','work','reflection','tip']
  canonical='\1'.join('\0'.join(f[k] for k in fields)for f in sorted(snapshot['forecasts'],key=lambda f:f['sign_key']))
  if hashlib.sha256(canonical.encode()).hexdigest()[:16]!=version:raise ValueError('snapshot text was modified without a new version')
  for forecast in snapshot['forecasts']:
   slug=forecast['sign_key'];sign=signs[slug];title=f'{sign["name"]} · {local_date(date)}';route=f'/horoskopai/{slug}/{date}/v-{version}/'
   raster=SITE/snapshot['artwork'][slug].lstrip('/')
   if not raster.is_file():raise ValueError('immutable snapshot artwork missing')
   p=record('horoscope',f'horoscope-{slug}-{date}-{version}',route,title,forecast['lead'],contentDate=date,contentVersion=version,signSlug=slug,signName=sign['name'],displayDate=local_date(date),sections={k:forecast[k] for k in ('lead','relationships','work')})
   p['artwork']='/'+str(raster.relative_to(SITE));og_card(p);pages[route]=p;keys[p['contentId']]=p
   paragraphs=''.join(f'<section><h2>{label}</h2><p>{e(forecast[k])}</p></section>' for k,label in [('overview','Bendra dienos nuotaika'),('relationships','Santykiai'),('work','Veikla ir darbai'),('reflection','Apmąstymui'),('tip','Mažas dienos žingsnis')])
   body=f'<article class="share-snapshot"><p class="eyebrow">Išsaugota turinio versija · {version}</p><h1>{e(title)}</h1><time datetime="{date}">{e(local_date(date))}</time><img src="{e(snapshot["artwork"][slug])}" width="240" height="240" alt="Originali {e(sign["genitive"])} iliustracija" decoding="async"><h2>{e(forecast["editorial_heading"])}</h2><p class="page-intro">{e(forecast["lead"])}</p>{paragraphs}<p class="source-note">{e(snapshot["attribution"])} {e(snapshot["provider_footer"])}</p><p>Pramogai ir apmąstymui. Tai nėra mokslinė prognozė ar profesionali konsultacija.</p><nav class="adjacent"><a href="/horoskopai/{slug}/">Šios dienos horoskopas</a><a href="/horoskopai/">Rasti savo ženklą</a></nav></article>'
   page(route,title+' · versija '+version[:8],'Išsaugotas horoskopas: '+forecast['lead']+' · '+date+' · '+version[:8],body)
   if date==current['local_date'] and version==current['content_checksum'][:16]:
    pages[f'/horoskopai/{slug}/']={**p,'canonicalUrl':ORIGIN+f'/horoskopai/{slug}/'};keys['horoscope-'+slug]=p
 # Card actions are separate from previews and downloads; authored pages remain authored.
 for path in SITE.rglob('index.html'):
  text=path.read_text()
  if 'design-card' in text:
   def design_button(match):
    block=match.group(0);ident=re.search(r'id="dizainas-([^"]+)"',block)
    if ident and 'data-share-key=' not in block and 'design-'+ident[1] in keys:
     key='design-'+ident[1];p=keys[key];button=f'<a class="button share-design-action" href="{p["shareUrl"]}" data-share-key="{key}">Pasidalyti dizainu</a>'
     block=block.replace('</div></div></article>','</div>'+button+'</div></article>')
    return block
   text=re.sub(r'<article class="design-card\b.*?</article>',design_button,text,flags=re.S)
  if 'horoscope-card__link' in text:
   def sign_button(match):
    block=match.group(0);slug=re.search(r'href="/horoskopai/([a-z]+)/"',block)
    if slug:
     p=keys.get('horoscope-'+slug[1])
     if p:
      action=f'<a class="share-sign-action" href="{p["shareUrl"]}" data-share-key="{p["contentId"]}">Pasidalyti mano horoskopu</a>'
      if 'share-sign-action' in block:block=re.sub(r'<a class="share-sign-action"[^>]*>.*?</a>',action,block,flags=re.S)
      else:block=block.replace('</article>',action+'</article>')
    return block
   text=re.sub(r'<article class="horoscope-card".*?</article>',sign_button,text,flags=re.S)
  match=re.fullmatch(r'horoskopai/([a-z]+)/index.html',str(path.relative_to(SITE)))
  if match and 'horoscope-'+match[1] in keys:
   p=keys['horoscope-'+match[1]]
   action=f'<a class="button share-horoscope-primary" href="{p["shareUrl"]}" data-share-key="{p["contentId"]}">Pasidalyti mano horoskopu</a>'
   if 'share-horoscope-primary' in text:text=re.sub(r'<a class="button share-horoscope-primary"[^>]*>.*?</a>',action,text,flags=re.S)
   else:text=re.sub(r'(<h2 id="horoscope-lead-title">.*?</h2>)',lambda m:m[1]+action,text,count=1,flags=re.S)
  if '/horoskopai/' in '/'+str(path.relative_to(SITE)) and 'data-share-history' not in text and not re.search(r'/v-',str(path)):
   text+='<p data-share-history><a href="/horoskopai/istorija/">Išsaugotos horoskopų versijos</a></p>'
  if text!=path.read_text():path.write_text(text)
 history_route='/horoskopai/istorija/'
 history_items=''.join(f'<li><a href="{r}">{e(p["title"])} · versija {p["contentVersion"]}</a></li>' for r,p in pages.items() if p['kind']=='horoscope' and '/v-' in r)
 page(history_route,'Išsaugotos horoskopų versijos','Anksčiau paskelbtų horoskopų datos ir nekintančios turinio versijos.','<h1>Išsaugotos horoskopų versijos</h1><p>Tik išsaugoti, anksčiau paskelbti tekstai. Praeities horoskopų nekuriame atgaline data.</p><ul>'+history_items+'</ul><p><a href="/horoskopai/">Šios dienos horoskopai</a></p>')
 pages[history_route]=record('page','horoscope-history',history_route,'Išsaugotos horoskopų versijos','Paskelbtų datų ir turinio versijų archyvas.')
 for p in pages.values():
  if p['kind']=='calendar':keys[f'calendar-{p["year"]}-{p.get("month",0)}']=p
 for route,p in pages.items():
  if p['kind']=='site':p.update(title='Kalendorius365',excerpt='Lietuviški kalendoriai, šventės, horoskopai ir kasdienio planavimo įrankiai.')
  p['imageUrl']=ORIGIN+quote(p['imageUrl'][len(ORIGIN):],safe='/:?=&') if p['imageUrl'].startswith(ORIGIN) else p['imageUrl']
  p['intents']={'facebook':'https://www.facebook.com/sharer/sharer.php?'+urlencode({'u':p['shareUrl']}),'x':'https://x.com/intent/tweet?'+urlencode({'url':p['shareUrl'],'text':p['title']}),'mastodon':'https://share.joinmastodon.org/?'+urlencode({'text':p['title']+'\n'+p['shareUrl']})}
  keys.setdefault(p['contentId'],p)
 exported={key for key in keys if key=='site' or key.startswith(('design-','calendar-','horoscope-'))}
 for old in (ASSETS/'records').glob('*.json'):
  if old.stem not in exported:old.unlink()
 for key,p in keys.items():
  if key in exported:dump(ASSETS/'records'/(key+'.json'),p)
 dump(SITE/'_data/sharing.json',{'pages':pages})
 print(f'Sharing: {len(pages)} public page records; {len(list(history.glob("*/*.json")))} immutable horoscope publications; {len(keys)} share identities.')
if __name__=='__main__':prepare()
