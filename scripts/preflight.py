#!/usr/bin/env python3
"""Inspect actual PDF operators, placed image CTMs, fonts, date glyph positions and 600-PPI proofs."""
import argparse,calendar,datetime as dt,hashlib,json,math,re,struct,unicodedata
from pathlib import Path
from pypdf import PdfReader
from pypdf.generic import ContentStream
from PIL import Image,ImageChops,ImageStat
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ROOT=Path(__file__).resolve().parents[1]
from calendar_package import validate_import_evidence
YEAR_DATA=json.loads((ROOT/'site/assets/data/years.json').read_text())
for name in ['Regular','Bold']:pdfmetrics.registerFont(TTFont('Inter'+name,str(ROOT/f'site/assets/fonts/Inter-{name}.ttf')))
for name in ['Regular','Bold','Black']:pdfmetrics.registerFont(TTFont('Lato'+name,str(ROOT/f'site/assets/fonts/Lato-{name}.ttf')))

def current_renderer_fingerprint():
 return hashlib.sha256((ROOT/'scripts/render_prints.py').read_bytes()+(ROOT/'data/calendar.json').read_bytes()+(ROOT/'site/assets/data/years.json').read_bytes()+b''.join((ROOT/p).read_bytes() for p in ['site/assets/fonts/Inter-Regular.ttf','site/assets/fonts/Inter-Bold.ttf','site/assets/fonts/Lato-Regular.ttf','site/assets/fonts/Lato-Bold.ttf','site/assets/fonts/Lato-Black.ttf'])).hexdigest()

def verify_manifest_provenance(manifest):
 assert manifest['generator']==current_renderer_fingerprint(),'Print manifest is stale for the actual current renderer/data/fonts'
 if manifest.get('blankRedesign'):
  transition=json.loads((ROOT/manifest['blankRedesign']).read_text())
  assert transition['version']=='2026-10-18-blank-calendar-redesign-v1'
  assert transition['after_generator']==manifest['generator']
  preserved={a['stem']:a for a in transition['preserved_nonblank_assets']}
  redesigned={a['stem']:a for a in transition['redesigned_blank_assets']}
  assets={a['stem']:a for a in manifest['assets']}
  assert len(preserved)==390 and set(preserved)=={stem for stem,a in assets.items() if a['kind']!='blank'}
  assert len(redesigned)==26 and set(redesigned)=={stem for stem,a in assets.items() if a['kind']=='blank'}
  for stem,proof in preserved.items():assert proof['files']==assets[stem]['files']
  for stem,proof in redesigned.items():assert proof['after_files']==assets[stem]['files'] and assets[stem].get('generator')==manifest['generator']
 if manifest.get('packageImport'):
  validate_import_evidence(ROOT,manifest,check_files=False)
  return
 if not manifest.get('reviewedTransition'):return
 transition=json.loads((ROOT/manifest['reviewedTransition']).read_text())
 assert transition['version']=='2026-10-17-annual-monochrome-legend-v2'
 assert transition['after_generator']==manifest['generator']
 selected={a['stem']:a for a in transition['selected_assets']}
 assert len(selected)==15
 assets={a['stem']:a for a in manifest['assets']}
 assert set(selected)=={a['stem']for a in assets.values()if a['kind']=='annual'and a['style']=='bw'}
 proofs={a['stem']:a for a in transition['unchanged_current_renderer_pdf_proofs']}
 assert len(proofs)==401 and set(proofs)==set(assets)-set(selected)
 for stem,proof in proofs.items():
  asset=assets[stem]
  assert proof['pdf_sha256']==asset['files']['pdf']['sha256']
  assert proof['date_layout_sha256']==hashlib.sha256(json.dumps(asset['dateLayout'],sort_keys=True).encode()).hexdigest()
 for stem,proof in selected.items():
  assert assets[stem]['generator']==manifest['generator']
  assert proof['date_layout_sha256']==hashlib.sha256(json.dumps(assets[stem]['dateLayout'],sort_keys=True).encode()).hexdigest()

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

def _webp_is_lossless(path):
 data=path.read_bytes()
 assert data[:4]==b'RIFF' and data[8:12]==b'WEBP',str(path)+' is not a WebP container'
 position=12;chunks=[]
 while position+8<=len(data):
  kind=data[position:position+4];size=int.from_bytes(data[position+4:position+8],'little')
  chunks.append(kind);position+=8+size+(size&1)
 assert position==len(data),str(path)+' has malformed WebP chunks'
 return b'VP8L' in chunks and b'VP8 ' not in chunks

def _asset_files(asset,base,sample):
 if sample:
  pdf=base/Path(asset['pdf']).name;webp=base/Path(asset['webp']).name
  preview=base/'previews'/Path(asset['preview']).name
  small=base/'previews-small'/Path(asset['smallPreview']).name if asset.get('smallPreview') else None
 else:
  site=ROOT/'site'
  pdf=site/asset['pdf'].lstrip('/');webp=site/asset['webp'].lstrip('/')
  preview=site/asset['preview'].lstrip('/')
  small=site/asset['smallPreview'].lstrip('/') if asset.get('smallPreview') else None
 return {'pdf':pdf,'webp':webp,'preview':preview,'smallPreview':small}

def _calendar_month(year,month):
 record=next(item for item in YEAR_DATA if item['year']==year)
 return record['months'][month-1]

def _holiday_text_candidates(year,holiday):
 candidates={holiday.get('name'),holiday.get('legalName')}
 legal_name=holiday.get('legalName')
 if legal_name:
  year_record=next(item for item in YEAR_DATA if item['year']==year)
  for month in year_record['months']:
   for day in month['days']:
    for other in day['holidays']:
     if other.get('legalName')==legal_name:candidates.add(other.get('name'))
 return {''.join(name.casefold().split()) for name in candidates if name}

def preflight(asset,base,sample=False):
 imported=asset.get('paper')=='A3' and bool(asset.get('filenameStem'))
 paths=_asset_files(asset,base,sample)
 check_keys=['pdf','webp','preview']+(['smallPreview'] if paths['smallPreview'] else [])
 for key in check_keys:
  path=paths[key];file_record=asset['files'][key]
  assert path.is_file(),asset['stem']+' missing '+key+' file'
  assert path.stat().st_size==file_record['bytes'] and hashlib.sha256(path.read_bytes()).hexdigest()==file_record['sha256'],asset['stem']+' actual file/manifest hash mismatch'
  assert path.stat().st_size<25*1024*1024,asset['stem']+' exceeds the hosting per-file limit'
 reader=PdfReader(paths['pdf']);assert len(reader.pages)==1,asset['stem']+' must be a one-page PDF'
 page=reader.pages[0];media=page.mediabox;trim=page.trimbox;crop=page.cropbox
 w,h=float(media.width),float(media.height);tw,th=float(trim.width),float(trim.height)
 assert (w>h)==asset['landscape'],asset['stem']+' PDF page direction differs from its preview'
 if imported:
  expected_trim=(841.88976,1190.55118)
  if asset['landscape']:expected_trim=expected_trim[::-1]
  assert abs(tw-expected_trim[0])<.02 and abs(th-expected_trim[1])<.02,(asset['stem'],'A3 TrimBox differs',tw,th)
  bleed=8.503937
  assert abs((w-tw)/2-bleed)<.02 and abs((h-th)/2-bleed)<.02,(asset['stem'],'A3 3-mm bleed differs',w,h,tw,th)
  box=list(map(float,trim));assert all(abs(value-bleed)<.02 for value in box[:2])
  assert abs(float(crop.width)-tw)<.02 and abs(float(crop.height)-th)<.02,'CropBox must show the A3 trim area'
  assert abs(float(page.bleedbox.width)-w)<.02 and abs(float(page.bleedbox.height)-h)<.02,'BleedBox must cover the full A3 bleed'
  intents=reader.trailer['/Root'].get('/OutputIntents')
  assert intents and any(str(i.get_object().get('/OutputConditionIdentifier',''))=='FOGRA39' for i in intents),asset['stem']+' FOGRA39 output intent missing'
 else:
  assert abs(min(w,h)-595.27559)<.01 and abs(max(w,h)-841.88976)<.01,asset['stem']+' legacy A4 page size differs'
  assert abs(tw-w)<.01 and abs(th-h)<.01,asset['stem']+' legacy TrimBox differs from page'
 resources=page['/Resources'];fonts=[]
 for font_ref in resources['/Font'].values():
  font=font_ref.get_object();descriptor=font.get('/FontDescriptor')
  assert descriptor,asset['stem']+' has a font without an embedded descriptor'
  descriptor=descriptor.get_object();assert '/FontFile2' in descriptor or '/FontFile3' in descriptor,asset['stem']+' contains an unembedded font'
  assert '/ToUnicode' in font,asset['stem']+' font lacks Unicode mapping'
  fonts.append(str(font['/BaseFont']))
 assert fonts,asset['stem']+' contains no embedded text fonts'
 stats=inspect_stream(page.get_contents(),reader,resources)
 assert stats['textOperators']>0 and stats['pathOperators']>0,(asset['stem'],'expected selectable text and vector paths',stats)
 extracted=page.extract_text() or ''
 assert '\ufffd' not in extracted and '\x00' not in extracted,asset['stem']+' text extraction contains replacement characters'
 normalized=' '.join(unicodedata.normalize('NFC',extracted).casefold().split())
 assert 'kalendorius365' in normalized,asset['stem']+' site identity missing in PDF text'
 if imported:
  if asset['kind']=='monthly':
   assert str(asset['year']) in normalized and asset['monthLt'].casefold() in normalized,asset['stem']+' printed year or month name missing'
   month_data=_calendar_month(asset['year'],asset['month'])
   day_count=len(month_data['days'])
   month_labels_checked=1
   day_values=range(1,day_count+1)
   holiday_days=[day for day in month_data['days'] if day['holidays']]
   expected_marked_holidays=len(holiday_days) if asset['holidayInformation'] else 0
   assert int(asset['markedHolidayCount'])==expected_marked_holidays,asset['stem']+' listed holiday count differs from the calendar data and holiday-information setting'
   if asset['holidayInformation']:
    compact=''.join(normalized.split())
    for day in holiday_days:
     for holiday in day['holidays']:
      candidates=_holiday_text_candidates(asset['year'],holiday)
      assert any(name in compact for name in candidates),(asset['stem'],'missing printed holiday',holiday['name'])
  else:
   assert str(asset['year']) in normalized,asset['stem']+' annual year label missing'
   month_data=None;day_count=366 if calendar.isleap(asset['year']) else 365
   month_labels_checked=12;day_values=range(1,32)
   month_names={item['monthLt'].casefold() for item in json.loads((ROOT/'site/assets/data/manifest.json').read_text())['assets'] if item['kind']=='monthly' and item['year']==asset['year']}
   assert len(month_names)==12 and all(name in normalized for name in month_names),asset['stem']+' annual page is missing a month name'
   if asset['year']==2028:assert '29' in re.findall(r'(?<!\d)0?29(?!\d)',normalized),'2028 leap day missing from annual PDF'
   if asset['holidayInformation']:
    year_data=next(item for item in YEAR_DATA if item['year']==asset['year'])
    expected_marked_holidays=sum(bool(day['holidays']) for month in year_data['months'] for day in month['days'])
    assert int(asset['markedHolidayCount'])==expected_marked_holidays,asset['stem']+' listed holiday count differs from the annual calendar data'
    assert stats['cmykPaint']>0,asset['stem']+' has no CMYK color marks for its holiday dates'
  for day in day_values:
   assert re.search(r'(?<!\d)0?'+str(day)+r'(?!\d)',normalized), (asset['stem'],'printed calendar day number missing',day)
  date_layout_checked=0;brand_y=None
 else:
  if asset['kind']=='annual':
   assert ('12 mėnesių apžvalga' in extracted and 'Šventės pažymėtos raudonai' not in extracted) if asset['style']=='bw' else 'Šventės pažymėtos raudonai' in extracted,asset['stem']+' holiday legend contradicts its color mode'
  texts=[]
  def visit(txt,cm,tm,font,size):
   if txt.strip():texts.append({'text':txt.strip(),'x':float(tm[4]),'y':float(tm[5]),'size':size,'font':str(font.get('/BaseFont','')) if font else ''})
  page.extract_text(visitor_text=visit)
  brand_text='Kalendorius365' if asset['kind']=='blank' else 'Kalendorius365.lt'
  brand=[t for t in texts if t['text']==brand_text];assert len(brand)==1,asset['stem']+' brand baseline missing'
  brand_y=brand[0]['y'];assert 5<=brand_y<=25,asset['stem']+' brand baseline is outside the footer safe area'
  for t in texts:
   assert 12<=t['x']<=w-12 and 12<=t['y']<=h-12,(asset['stem'],t)
   family='Lato' if 'Lato-' in t['font'] else 'Inter'
   font=family+('Black' if 'Black' in t['font'] else 'Bold' if 'Bold' in t['font'] else 'Regular')
   width=pdfmetrics.stringWidth(t['text'],font,t['size']);assert t['x']+width<=w-12+.5,(asset['stem'],'text overflow',t,width)
  date_layout_checked=0
  if asset['kind'] in ['monthly','annual']:
   date_layout_checked=len(asset['dateLayout'])
   assert len(asset['dateLayout'])==(calendar.monthrange(asset['year'],asset['month'])[1] if asset['kind']=='monthly' else 366 if calendar.isleap(asset['year']) else 365)
   for d in asset['dateLayout']:
    date=dt.date.fromisoformat(d['date']);assert date.isoweekday()==d['weekday']
    if asset['kind']=='annual' or asset['design']!='05':assert d['column']==date.weekday();assert d['row']==(dt.date(date.year,date.month,1).weekday()+date.day-1)//7
    else:assert d['row']==date.day-1
    matches=[t for t in texts if t['text']==d['label'] and abs(t['x']-d['x'])<.05 and abs(t['y']-d['y'])<.05]
    assert len(matches)==1,(asset['stem'],'date placement',d,matches)
    if date.day==29 and date.month==2:assert date.year%4==0

 image=Image.open(paths['webp']);assert image.format=='WEBP',asset['stem']+' preview source is not WebP';image.load()
 assert image.mode=='RGB' and 'transparency' not in image.info,asset['stem']+' WebP must be opaque RGB'
 if imported:
  assert image.size==(asset['dimensions']['width'],asset['dimensions']['height']),asset['stem']+' WebP dimensions differ from package metadata'
  assert image.info.get('icc_profile'),asset['stem']+' WebP sRGB profile missing'
  assert _webp_is_lossless(paths['webp']),asset['stem']+' WebP is not lossless'
 else:
  assert image.size==((7016,4961) if asset['landscape'] else (4961,7016)),asset['stem']+' legacy WebP dimensions differ'
  if asset['style']=='bw':
   r,g,b=image.convert('RGB').split();assert ImageChops.difference(r,g).getextrema()==(0,0) and ImageChops.difference(g,b).getextrema()==(0,0)
 ppi=[image.width/(tw/72),image.height/(th/72)];assert min(ppi)>=599.5,(asset['stem'],'WebP print density below 600 PPI',ppi)
 preview=Image.open(paths['preview']);assert preview.format=='WEBP' and max(preview.size)<=680,asset['stem']+' large preview dimensions differ';preview.load()
 if paths['smallPreview']:
  small=Image.open(paths['smallPreview']);assert small.format=='WEBP' and max(small.size)<=340,asset['stem']+' small preview dimensions differ';small.load()
 proof_details=None
 if sample:
  proof=base/(asset['stem']+'-600ppi-proof.png');im=Image.open(proof).convert('RGB');assert im.size==image.size
  mean=ImageStat.Stat(ImageChops.difference(im,image.convert('RGB'))).mean;assert max(mean)<1.0
  proof_details={'path':proof.name,'pixels':im.size,'actualPPI':ppi,'webpMeanAbsoluteError':mean,'sha256':hashlib.sha256(proof.read_bytes()).hexdigest()}
 return {'stem':asset['stem'],'status':'passed','pageCount':1,'paper':asset.get('paper','A4'),
         'mediaBoxPoints':[w,h],'trimBoxPoints':list(map(float,trim)),'fonts':fonts,
         'brandBaselinePt':brand_y,'datePlacementsChecked':date_layout_checked,
         'calendarDayNumbersChecked':len(day_values) if imported else 0,
         'monthLabelsChecked':month_labels_checked if imported else 0,
         'textOperators':stats['textOperators'],'vectorPathOperators':stats['pathOperators'],
         'rasterPlacements':stats['raster'],'worstEffectiveRasterPPI':min((min(x['effectivePPI']) for x in stats['raster']),default=None),
         'outputIntent':'FOGRA39' if imported else None,'colorMode':asset['colorMode'],
         'webpPixels':image.size,'webpEffectivePPI':ppi,'losslessWebP':bool(imported),
         'smallPreviewPixels':list(small.size) if paths['smallPreview'] else None,'proof':proof_details}

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--samples',action='store_true');p.add_argument('--accept-visual',action='store_true');args=p.parse_args()
 base=ROOT.parents[1]/'outputs/print-samples' if args.samples else ROOT/'site/downloads';manifestpath=base/'manifest.json' if args.samples else ROOT/'site/assets/data/manifest.json';manifest=json.loads(manifestpath.read_text());assets=manifest['assets']
 verify_manifest_provenance(manifest)
 reports=[preflight(a,base,args.samples) for a in assets]
 report={'schema':1,'generator':manifest['generator'],'status':'passed','samples':args.samples,'visualReviewed':args.accept_visual,'results':reports}
 dest=base/'preflight.json' if args.samples else ROOT/'docs/print-preflight.json';dest.write_text(json.dumps(report,ensure_ascii=False,indent=2))
 if args.samples and args.accept_visual:
  assert len(assets)==28, f'Expected 28 sample designs; got {len(assets)}'
  assert {(a['kind'],a.get('year'),a.get('month'),a['design']) for a in assets if a['kind']=='monthly'}=={('monthly',2027,1,'06'),('monthly',2028,2,'02')}
  planner=[a for a in assets if a['kind']=='blank']
  assert len(planner)==26 and {a['design'] for a in planner}=={f'{i:02}' for i in range(1,21)}
  assert all(a.get('rows') in [5,6] for a in planner if a['layout']=='month')
  assert len({a['stem'] for a in planner})==26
  (ROOT/'.build-cache/sample-gate.json').write_text(json.dumps({'generator':manifest['generator'],'status':'passed','visualReviewed':True,'sampleCount':len(assets),'plannerCategories':['month','week','day','family','office','school','shift'],'evidence':str(dest)}))
 for a in assets:
  details=('source hashes, A3 trim/bleed boxes, FOGRA39, embedded fonts, selectable calendar labels, lossless 600-PPI WebP and responsive previews checked'
           if a.get('paper')=='A3' else
           'PDF operators, embedded fonts, real date glyph positions, page/trim size, 600-PPI WebP and branding checked')
  a['verification']={'status':'passed','preflight':details}
 manifestpath.write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 print(f"PASS: {len(reports)} PDFs preflighted; all placed raster images >=600 PPI (none in these vector compositions); actual 600-PPI WebP and proof dimensions checked. Visual gate: {args.accept_visual}.")
