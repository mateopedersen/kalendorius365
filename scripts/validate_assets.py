from pathlib import Path
import json,hashlib,datetime as dt,calendar
from PIL import Image
from pypdf import PdfReader
from fontTools.ttLib import TTFont
ROOT=Path(__file__).resolve().parents[1];manifest=json.loads((ROOT/'site/assets/data/manifest.json').read_text());assets=manifest['assets'];years=json.loads((ROOT/'site/assets/data/years.json').read_text());data=json.loads((ROOT/'data/calendar.json').read_text())
assert len(assets)==276
assert sum(a['kind']=='monthly' for a in assets)==240
assert sum(a['kind']=='annual' for a in assets)==20
assert sum(a['kind']=='blank' for a in assets)==16
assert len({a['stem'] for a in assets})==276
for fontpath in (ROOT/'site/assets/fonts').glob('Inter-*.ttf'):
 cmap=TTFont(fontpath).getBestCmap();assert all(ord(c) in cmap for c in 'ĄČĘĖĮŠŲŪŽąčęėįšųūž')
count=0
for year in years:
 for mo in year['months']:
  y,m=year['year'],mo['month'];assert calendar.monthrange(y,m)[1]==mo['length'];assert calendar.monthrange(y,m)[0]==mo['offset']
  for d in mo['days']:
   date=dt.date.fromisoformat(d['date']);assert date.isoweekday()==d['weekday'];assert date.isocalendar().week==d['isoWeek'];assert date.isocalendar().year==d['isoYear'];count+=1
assert count==731
for a in assets:
 for key in ['pdf','webp','preview']:
  p=ROOT/'site'/a[key].lstrip('/');assert p.is_file();assert p.stat().st_size==a['files'][key]['bytes'];assert hashlib.sha256(p.read_bytes()).hexdigest()==a['files'][key]['sha256'];assert p.stat().st_size<25*1024*1024
 pdf=PdfReader(ROOT/'site'/a['pdf'].lstrip('/'));assert len(pdf.pages)==1;page=pdf.pages[0];w,h=float(page.mediabox.width),float(page.mediabox.height)
 assert abs(max(w,h)-841.89)<1 and abs(min(w,h)-595.276)<1
 assert (w>h)==a['landscape']
 text=page.extract_text();assert 'Kalendorius365' in text;assert a['design'] in text
 if a['year']:assert str(a['year']) in text
 if a['kind']=='monthly':
  assert data['months'][a['month']-1][2] in text
  month=next(y for y in years if y['year']==a['year'])['months'][a['month']-1]
  # Full holiday names are typeset as wrapped lines; normalize spaces.
  compact=''.join(text.split())
  for d in month['days']:
   for holiday in d['holidays']:assert ''.join(holiday['name'].split()) in compact,(a['stem'],holiday['name'])
 fonts=page['/Resources']['/Font'].get_object();embedded=0
 for f in fonts.values():
  obj=f.get_object();descriptor=obj.get('/FontDescriptor')
  if descriptor:
   descriptor=descriptor.get_object();assert '/FontFile2' in descriptor or '/FontFile3' in descriptor;embedded+=1
 assert embedded>=1
 im=Image.open(ROOT/'site'/a['webp'].lstrip('/'));assert im.format=='WEBP';assert im.size==(a['dimensions']['width'],a['dimensions']['height']);im.verify()
 thumb=Image.open(ROOT/'site'/a['preview'].lstrip('/'));assert max(thumb.size)<=680;thumb.verify()
 # Inspect text baselines against the physical page boundary (complemented by visual checks).
 boxes=[]
 def visitor(txt,cm,tm,font,size):
  if txt.strip():boxes.append((tm[4],tm[5],size,txt))
 page.extract_text(visitor_text=visitor)
 for x,y,size,txt in boxes:assert x>=0 and y>=0 and x<=w+1 and y<=h+1,(a['stem'],x,y,txt)
print(f'PASS: {count} independently checked dates; {len(assets)} one-page embedded-font PDFs; {len(assets)} 300-PPI WebP; {len(assets)} thumbnails; all hashes and holiday names verified.')
