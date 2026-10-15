#!/usr/bin/env python3
"""Inspect actual PDF operators, placed image CTMs, fonts, date glyph positions and 600-PPI proofs."""
import argparse,datetime as dt,hashlib,json,math
from pathlib import Path
from pypdf import PdfReader
from pypdf.generic import ContentStream
from PIL import Image,ImageChops,ImageStat
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ROOT=Path(__file__).resolve().parents[1]
for name in ['Regular','Bold']:pdfmetrics.registerFont(TTFont('Inter'+name,str(ROOT/f'site/assets/fonts/Inter-{name}.ttf')))

def multiply(a,b):
 return (a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5])
def inspect_stream(stream,reader,resources,ctm=(1,0,0,1,0,0)):
 stats={'raster':[],'rgbPaint':0,'cmykPaint':0,'grayPaint':0,'textOperators':0,'pathOperators':0};stack=[]
 for operands,op in ContentStream(stream,reader).operations:
  if op==b'q':stack.append(ctm)
  elif op==b'Q':ctm=stack.pop()
  elif op==b'cm':ctm=multiply(ctm,tuple(float(v) for v in operands))
  elif op in [b'rg',b'RG']:stats['rgbPaint']+=1
  elif op in [b'k',b'K']:stats['cmykPaint']+=1
  elif op in [b'g',b'G']:stats['grayPaint']+=1
  elif op in [b'Tj',b'TJ',b"'",b'"']:stats['textOperators']+=1
  elif op in [b'm',b'l',b'c',b're',b'h']:stats['pathOperators']+=1
  elif op==b'INLINE IMAGE':raise AssertionError('Inline raster images require explicit preflight implementation')
  elif op==b'Do':
   obj=resources['/XObject'][operands[0]].get_object()
   if obj['/Subtype']=='/Image':
    sx=math.hypot(ctm[0],ctm[1]);sy=math.hypot(ctm[2],ctm[3]);assert sx>0 and sy>0
    ppi=[float(obj['/Width'])/(sx/72),float(obj['/Height'])/(sy/72)]
    assert min(ppi)>=600,f'Raster placement below 600 PPI: {ppi}'
    stats['raster'].append({'width':int(obj['/Width']),'height':int(obj['/Height']),'effectivePPI':ppi})
   elif obj['/Subtype']=='/Form':
    child=inspect_stream(obj,reader,obj.get('/Resources',resources),multiply(ctm,tuple(float(v) for v in obj.get('/Matrix',[1,0,0,1,0,0]))))
    for k,v in child.items():
     if k=='raster':stats[k]+=v
     else:stats[k]+=v
 return stats

def preflight(asset,base,sample=False):
 pdf=base/Path(asset['pdf']).name;webp=base/Path(asset['webp']).name;reader=PdfReader(pdf);assert len(reader.pages)==1
 page=reader.pages[0];w,h=float(page.mediabox.width),float(page.mediabox.height);assert abs(min(w,h)-595.27559)<.01 and abs(max(w,h)-841.88976)<.01
 assert '/TrimBox' in page and list(page.trimbox)==list(page.mediabox)
 assert (w>h)==asset['landscape']
 resources=page['/Resources'];fonts=[]
 for f in resources['/Font'].values():
  f=f.get_object();descriptor=f.get('/FontDescriptor');assert descriptor,'Unembedded/default font found'
  descriptor=descriptor.get_object();assert '/FontFile2' in descriptor or '/FontFile3' in descriptor;assert '/ToUnicode' in f
  fonts.append(str(f['/BaseFont']))
 assert any('Inter-Bold' in f for f in fonts), 'Bold face must have a distinct embedded PostScript identity'
 stats=inspect_stream(page.get_contents(),reader,resources);assert stats['textOperators']>=(8 if asset['kind']=='blank' else 20) and stats['pathOperators']>=(1 if asset['kind']=='annual' else 20), (asset['stem'], stats)
 if asset['style']=='bw':assert stats['rgbPaint']==0 and stats['cmykPaint']==0 and stats['grayPaint']>0
 texts=[]
 def visit(txt,cm,tm,font,size):
  if txt.strip():texts.append({'text':txt.strip(),'x':float(tm[4]),'y':float(tm[5]),'size':size,'font':str(font.get('/BaseFont','')) if font else ''})
 extracted=page.extract_text(visitor_text=visit);assert '\ufffd' not in extracted and '\x00' not in extracted
 brand=[t for t in texts if t['text']=='Kalendorius365.lt'];assert len(brand)==1 and 12<=brand[0]['y']<=25
 for t in texts:
  assert 12<=t['x']<=w-12 and 12<=t['y']<=h-12,(asset['stem'],t)
  font='InterBold' if 'Bold' in t['font'] else 'InterRegular';width=pdfmetrics.stringWidth(t['text'],font,t['size']);assert t['x']+width<=w-12+.5,(asset['stem'],'text overflow',t,width)
 if asset['kind'] in ['monthly','annual']:
  assert len(asset['dateLayout'])==(__import__('calendar').monthrange(asset['year'],asset['month'])[1] if asset['kind']=='monthly' else 366 if __import__('calendar').isleap(asset['year']) else 365)
  for d in asset['dateLayout']:
   date=dt.date.fromisoformat(d['date']);assert date.isoweekday()==d['weekday']
   if asset['kind']=='annual' or asset['design']!='05':assert d['column']==date.weekday();assert d['row']==(dt.date(date.year,date.month,1).weekday()+date.day-1)//7
   else:assert d['row']==date.day-1
   matches=[t for t in texts if t['text']==d['label'] and abs(t['x']-d['x'])<.05 and abs(t['y']-d['y'])<.05]
   assert len(matches)==1,(asset['stem'],'date placement',d,matches)
   if date.day==29 and date.month==2:assert date.year%4==0
 image=Image.open(webp);assert image.format=='WEBP';assert image.size==((7016,4961) if asset['landscape'] else (4961,7016))
 ppi=[image.width/(w/72),image.height/(h/72)];assert min(ppi)>=600
 if asset['style']=='bw':
  r,g,b=image.convert('RGB').split();assert ImageChops.difference(r,g).getextrema()==(0,0) and ImageChops.difference(g,b).getextrema()==(0,0)
 proof_details=None
 if sample:
  proof=base/(asset['stem']+'-600ppi-proof.png');im=Image.open(proof).convert('RGB');assert im.size==image.size
  mean=ImageStat.Stat(ImageChops.difference(im,image.convert('RGB'))).mean;assert max(mean)<1.0
  proof_details={'path':proof.name,'pixels':im.size,'actualPPI':ppi,'webpMeanAbsoluteError':mean,'sha256':hashlib.sha256(proof.read_bytes()).hexdigest()}
 return {'stem':asset['stem'],'status':'passed','pageCount':1,'mediaBoxPoints':[w,h],'trimBoxPoints':list(map(float,page.trimbox)),'fonts':fonts,'brandBaselinePt':brand[0]['y'],'datePlacementsChecked':len(asset.get('dateLayout',[])),'vectorTextOperators':stats['textOperators'],'vectorPathOperators':stats['pathOperators'],'rasterPlacements':stats['raster'],'worstEffectiveRasterPPI':min((min(x['effectivePPI']) for x in stats['raster']),default=None),'rasterExplanation':'No placed raster images; all artwork, grids and text are vector.' if not stats['raster'] else 'All placed raster instances verified at >=600 PPI in both axes.','colorMode':asset['colorMode'],'rgbPaintOperators':stats['rgbPaint'],'grayPaintOperators':stats['grayPaint'],'webpPixels':image.size,'webpEffectivePPI':ppi,'proof':proof_details}

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--samples',action='store_true');p.add_argument('--accept-visual',action='store_true');args=p.parse_args()
 base=ROOT.parents[1]/'outputs/print-samples' if args.samples else ROOT/'site/downloads';manifestpath=base/'manifest.json' if args.samples else ROOT/'site/assets/data/manifest.json';manifest=json.loads(manifestpath.read_text());assets=manifest['assets']
 reports=[preflight(a,base,args.samples) for a in assets]
 report={'schema':1,'generator':manifest['generator'],'status':'passed','samples':args.samples,'visualReviewed':args.accept_visual,'results':reports}
 dest=base/'preflight.json' if args.samples else ROOT/'docs/print-preflight.json';dest.write_text(json.dumps(report,ensure_ascii=False,indent=2))
 if args.samples and args.accept_visual:
  assert len(assets)==12, f'Expected 12 sample designs; got {len(assets)}'
  assert {(a['kind'],a.get('year'),a.get('month'),a['design']) for a in assets if a['kind']=='monthly'}=={('monthly',2027,1,'06'),('monthly',2028,2,'02')}
  planner=[a for a in assets if a['kind']=='blank']
  assert len(planner)==10 and {a['category'] for a in planner}=={'week','day','family','school','shift'}
  assert all({a['style'] for a in planner if a['category']==category}=={'bw','color'} for category in {'week','day','family','school','shift'})
  (ROOT/'.build-cache/sample-gate.json').write_text(json.dumps({'generator':manifest['generator'],'status':'passed','visualReviewed':True,'sampleCount':len(assets),'plannerCategories':['week','day','family','school','shift'],'evidence':str(dest)}))
 for a in assets:a['verification']={'status':'passed','preflight':'PDF operators, embedded fonts, real date glyph positions, page/trim size, 600-PPI WebP and branding checked'}
 manifestpath.write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 print(f"PASS: {len(reports)} PDFs preflighted; all placed raster images >=600 PPI (none in these vector compositions); actual 600-PPI WebP and proof dimensions checked. Visual gate: {args.accept_visual}.")
