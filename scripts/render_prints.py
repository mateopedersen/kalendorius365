#!/usr/bin/env python3
"""Vector-first compositions. WebP is rasterized from that exact PDF, never redrawn.
Run prepare.rb first. --limit 10 for the first design review; omit to generate all.
Content-addressed cache skips unchanged outputs. No network during rendering.
"""
from pathlib import Path
import argparse, calendar, datetime as dt, hashlib, json, math, os, shutil, subprocess, tempfile
from concurrent.futures import ThreadPoolExecutor
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'data/calendar.json').read_text())
YEARS=json.loads((ROOT/'site/assets/data/years.json').read_text())
OUT=ROOT/'site/downloads'; PREVIEW=ROOT/'site/assets/previews'; CACHE=ROOT/'.build-cache'; CACHE.mkdir(exist_ok=True)
for p in [OUT,PREVIEW]:p.mkdir(parents=True,exist_ok=True)
for name in ['Regular','Bold']:pdfmetrics.registerFont(TTFont('Inter'+name,str(ROOT/f'site/assets/fonts/Inter-{name}.ttf')))
INK=HexColor('#182b24'); GREEN=HexColor('#006A44'); RED=HexColor('#C1272D'); YELLOW=HexColor('#FDB913'); LINE=HexColor('#ccd6cf'); MUTED=HexColor('#50635a'); PALE=HexColor('#eef3ee')
FONT='InterRegular'; BOLD='InterBold'
ISSUES=[]

class PrintCanvas(canvas.Canvas):
 def __init__(self,*args,mono=False,regular=False,**kwargs):
  self.mono=mono;self.datefont=FONT if regular else BOLD;self.headingfont=FONT if regular else BOLD;self.date_positions=[]
  super().__init__(*args,initialFontName=FONT,initialFontSize=10,**kwargs)
 def gray(self,color):
  # Purpose-built ink hierarchy: opaque black text, neutral gray rules and paper fills.
  rgb=(round(color.red,4),round(color.green,4),round(color.blue,4))
  if rgb==(1,1,1):return 1
  if color in [INK,GREEN,RED,YELLOW]:return 0
  if color==MUTED:return .30
  if color==LINE:return .75
  return .95
 def setFillColor(self,color,alpha=None):
  if self.mono:self.setFillGray(self.gray(color),alpha=alpha)
  else:super().setFillColor(color,alpha)
 def setStrokeColor(self,color,alpha=None):
  if self.mono:self.setStrokeGray(self.gray(color),alpha=alpha)
  else:super().setStrokeColor(color,alpha)

def text(c,x,y,s,size=10,color=INK,font=FONT):
 c.setFillColor(color);c.setFont(font,size);c.drawString(x,y,str(s))
def right(c,x,y,s,size=10,color=INK,font=FONT):
 c.setFillColor(color);c.setFont(font,size);c.drawRightString(x,y,str(s))
def center(c,x,y,s,size=10,color=INK,font=FONT):
 c.setFillColor(color);c.setFont(font,size);c.drawCentredString(x,y,str(s))
def rect(c,x,y,w,h,fill=None,stroke=LINE):
 c.setLineWidth(.5);c.setStrokeColor(stroke or white);c.setFillColor(fill or white);c.rect(x,y,w,h,fill=bool(fill),stroke=bool(stroke))
def line(c,x1,y1,x2,y2,color=LINE,width=.5):
 c.setStrokeColor(color);c.setLineWidth(width);c.line(x1,y1,x2,y2)
def wrap(c,s,x,y,width,size=7,maxlines=4,color=RED,font=FONT):
 words=s.split();rows=[];row=''
 for word in words:
  candidate=(row+' '+word).strip()
  if pdfmetrics.stringWidth(candidate,font,size)>width and row:rows.append(row);row=word
  else:row=candidate
 if row:rows.append(row)
 if len(rows)>maxlines:
  if size>5.5:return wrap(c,s,x,y,width,size-.5,maxlines,color,font)
  raise ValueError(f'Text does not fit: {s} / {width}')
 for i,r in enumerate(rows):
  if pdfmetrics.stringWidth(r,font,size)>width+.1:raise ValueError(f'Word overflow: {r}')
  text(c,x,y-i*size*1.25,r,size,color,font)
 return len(rows)*size*1.25

def header(c,w,h,title,subtitle='',kind=1):
 x=32
 if kind==3:
  for i,color in enumerate([YELLOW,GREEN,RED]):rect(c,32,h-38-i*4,w-64,4,color,None)
  y=h-85
 elif kind==10:
  rect(c,24,h-103,w-48,79,INK,None);text(c,40,h-60,title,25,white,BOLD);text(c,40,h-83,subtitle,9,HexColor('#c6d8cd'));return h-125
 elif kind==6:
  text(c,x,h-66,title,30,INK,BOLD);line(c,x,h-81,w-32,h-81,INK,2);y=h-106
 else:
  y=h-58;text(c,x,y,title,25,INK,getattr(c,'headingfont',BOLD));y-=24
 if kind not in [6]:
  if kind==3:text(c,x,y,title,25,INK,getattr(c,'headingfont',BOLD));y-=24
  text(c,x,y,subtitle,9,MUTED)
 else:text(c,x,y,subtitle,9,MUTED)
 return y-25

def footer(c,w,label=''):
 line(c,32,30,w-32,30);text(c,32,17,'Kalendorius365.lt',8,MUTED,BOLD);right(c,w-32,17,label,6.5,MUTED)

def holiday_key(month):return {d['date']:d['holidays'] for d in month['days'] if d['holidays']}
def holiday_lines(c,month,x,y,w,size=7):
 hs=[h for d in month['days'] for h in d['holidays']]
 for holiday in hs:
  s=f"{int(holiday['date'][-2:])} d. — {holiday['name']}"
  y-=wrap(c,s,x,y,w,size,3)+4
 return y

def grid(c,month,x,top,w,h,variant=1,blank=False,rows_override=6,sunday=False):
 rows=rows_override if blank else month['weeks']; cols=7; weekw=19 if variant not in [4,9] else 0; cw=(w-weekw)/cols; ch=(h-24)/rows
 days=DATA['weekdays'][:]
 if sunday:days=[days[-1]]+days[:-1]
 for j,name in enumerate(days):
  col=RED if name=='Sk' else MUTED
  center(c,x+weekw+(j+.5)*cw,top-15,name,8,col,BOLD)
 for r in range(rows):
  rowtop=top-24-r*ch
  if weekw and not blank:
   monday=dt.date(month['year'],month['month'],1)-dt.timedelta(days=month['offset'])+dt.timedelta(days=7*r)
   center(c,x+8,rowtop-17,monday.isocalendar().week,6.5,MUTED)
  for j in range(7):
   cx=x+weekw+j*cw;cy=rowtop-ch
   date_n=r*7+j-month.get('offset',0)+1
   day=month['days'][date_n-1] if not blank and 1<=date_n<=month['length'] else None
   holidays=day['holidays'] if day else []
   if variant in [2,5,8,10] or blank:
    fill=HexColor('#fff4f2') if holidays else None
    rect(c,cx,cy,cw,ch,fill,LINE)
   else:
    line(c,cx,rowtop,cx+cw,rowtop,LINE,.5)
    if holidays:rect(c,cx+2,cy+2,cw-4,ch-4,HexColor('#fff1ee'),None)
   if blank:continue
   if not day:continue
   size={4:30,6:21,7:20,9:19,10:19}.get(variant,16)
   if variant==4:
    c.date_positions.append({'date':day['date'],'row':r,'column':j,'x':cx+cw/2-pdfmetrics.stringWidth(str(date_n),getattr(c,'datefont',BOLD),size)/2,'y':rowtop-40,'label':str(date_n),'weekday':day['weekday']})
    center(c,cx+cw/2,rowtop-40,date_n,size,RED if holidays else INK,getattr(c,'datefont',BOLD))
   else:
    c.date_positions.append({'date':day['date'],'row':r,'column':j,'x':cx+7,'y':rowtop-size-5,'label':str(date_n),'weekday':day['weekday']})
    text(c,cx+7,rowtop-size-5,date_n,size,RED if holidays else INK,getattr(c,'datefont',BOLD))
   if holidays and variant!=4:
    label=' / '.join(hh['name'] for hh in holidays)
    wrap(c,label,cx+6,rowtop-size-20,cw-12,6.5,5,RED)
   if variant==2:
    for k in range(1,4):line(c,cx+6,cy+8+k*10,cx+cw-6,cy+8+k*10,LINE,.25)
   if variant==8:
    line(c,cx+6,cy+15,cx+cw-6,cy+15,LINE,.3)
 line(c,x+weekw,top-24-rows*ch,x+w,top-24-rows*ch)

def leaf(c,x,y,scale=1,angle=0):
 c.saveState();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);c.setFillColor(HexColor('#789b6e'));c.setStrokeColor(GREEN);c.setLineWidth(.5)
 p=c.beginPath();p.moveTo(0,0);p.curveTo(-14,10,-13,24,0,32);p.curveTo(14,24,14,10,0,0);c.drawPath(p,fill=1,stroke=0);line(c,0,0,0,28,GREEN,.5);c.restoreState()

def monthly(c,month,design,w,h):
 k=design.get('render',int(design['id']));year=month['year'];m=month['month'];title=f"{year} · {DATA['months'][m-1][1]}"
 top=header(c,w,h,title,f"{design['name']} · Pirmadienis–sekmadienis · Lietuvos šventinės dienos",k)
 if k==1:
  grid(c,month,32,top-6,w-64,h-225,k);holiday_lines(c,month,32,130,w-64,8)
 elif k==2:
  grid(c,month,32,top,w-220,h-150,k);text(c,w-166,top-15,'MĖNESIO PRIORITETAI',8,GREEN,BOLD)
  for i in range(13):line(c,w-166,top-42-i*25,w-32,top-42-i*25)
  holiday_lines(c,month,w-166,140,134,7)
 elif k==3:
  c.setFillColor(HexColor('#fff4d8'));p=c.beginPath();p.moveTo(w-135,h-33);p.lineTo(w-32,h-33);p.lineTo(w-32,h-135);p.close();c.drawPath(p,fill=1,stroke=0)
  grid(c,month,32,top,w-64,h-280,k);text(c,32,170,'SVARBIOS DIENOS',9,GREEN,BOLD);holiday_lines(c,month,32,150,w-64,8)
  for i,color in enumerate([YELLOW,GREEN,RED]):rect(c,w-45-i*6,48,4,90,color,None)
 elif k==4:
  grid(c,month,32,top,w-64,h-205,k);holiday_lines(c,month,32,97,w-64,8)
 elif k==5:
  # A dated family ledger replaces the conventional month grid.
  x=32;tw=w-64;cols=[tw*.29]+[tw*.1775]*4;names=['Diena / šventė','Šeimos narys 1','Šeimos narys 2','Šeimos narys 3','Šeimos narys 4'];y=top
  for j,name in enumerate(names):text(c,x+sum(cols[:j])+5,y-12,name,8,GREEN,BOLD)
  ch=(h-160)/31
  for i,day in enumerate(month['days']):
   ry=y-22-i*ch;cx=x
   for cw in cols:rect(c,cx,ry-ch,cw,ch,PALE if day['weekday']>=6 else None);cx+=cw
   label=f"{day['day']:02} {DATA['weekdays'][day['weekday']-1]}"
   c.date_positions.append({'date':day['date'],'row':i,'column':0,'x':x+5,'y':ry-ch+4,'label':label,'weekday':day['weekday']})
   text(c,x+5,ry-ch+4,label,7,RED if day['holidays'] else INK,BOLD)
   if day['holidays']:wrap(c,' / '.join(hh['name'] for hh in day['holidays']),x+44,ry-ch+4,cols[0]-49,5.5,1)
 elif k==6:
  text(c,32,top-65,f'{m:02}',75,GREEN,BOLD);text(c,170,top-22,'PLANUOTI',14,INK,BOLD);text(c,170,top-43,'mažiau triukšmo, daugiau aiškumo',8,MUTED)
  grid(c,month,32,top-100,w-64,h-340,k);holiday_lines(c,month,32,145,w-64,7.5)
 elif k==7:
  # Asymmetric composition with an architectural notes rail.
  rect(c,w-157,55,125,h-175,PALE,None);text(c,w-143,h-143,'UŽRAŠAI',9,GREEN,BOLD)
  for i in range(11):line(c,w-143,h-167-i*27,w-47,h-167-i*27)
  c.setFillColor(YELLOW);p=c.beginPath();p.moveTo(w-105,h-52);p.lineTo(w-32,h-52);p.lineTo(w-32,h-102);p.close();c.drawPath(p,fill=1,stroke=0)
  grid(c,month,32,top,w-205,h-205,k);holiday_lines(c,month,32,92,w-205,7)
 elif k==8:
  for xx,col in [(w-115,YELLOW),(w-95,GREEN),(w-75,RED)]:
   rect(c,xx,h-85,7,32,col,None);c.setFillColor(INK);p=c.beginPath();p.moveTo(xx,h-85);p.lineTo(xx+3.5,h-94);p.lineTo(xx+7,h-85);p.close();c.drawPath(p,fill=1,stroke=0)
  grid(c,month,32,top,w-64,h-340,k);text(c,32,225,'MOKSLO TIKSLAI',9,GREEN,BOLD);text(c,w/2+10,225,'ATSISKAITYMAI IR DARBAI',9,GREEN,BOLD)
  for i in range(4):line(c,32,205-i*20,w/2-15,205-i*20);line(c,w/2+10,205-i*20,w-32,205-i*20)
  holiday_lines(c,month,32,100,w-64,7)
 elif k==9:
  for i in range(5):leaf(c,w-92+i*9,h-138+i*8,1.3+i*.08,-65+i*22)
  grid(c,month,32,top-30,w-64,h-285,k);holiday_lines(c,month,32,145,w-64,8)
  text(c,32,68,'LAIKAS AUGTI',9,GREEN,BOLD);line(c,32,58,w-32,58,GREEN,.8)
 elif k==10:
  grid(c,month,32,top,w-64,h-225,k);text(c,32,100,'SVARBIAUSIA ŠĮ MĖNESĮ',8,GREEN,BOLD);line(c,32,77,w*.55,77,INK,1);holiday_lines(c,month,w*.6,100,w*.4-32,7)
 footer(c,w,f"A4 · {design['id']} · Šventės: DK 123 str.")

def small_month(c,month,x,top,w,h,style=1):
 title=DATA['months'][month['month']-1][1]
 if style in [3,7,10]:rect(c,x,top-19,w,20,GREEN if style!=10 else INK,None);text(c,x+6,top-13,title,9,white,BOLD)
 else:text(c,x+4,top-13,title,10,GREEN if style in [6,9] else INK,BOLD)
 start=top-30;show_weeks=style!=4;cw=w/(8 if show_weeks else 7);rh=(h-33)/7;shift=1 if show_weeks else 0
 for j,name in enumerate(DATA['weekdays']):center(c,x+(j+shift+.5)*cw,start,name,6.5,MUTED)
 for r in range(6):
  first=dt.date(month['year'],month['month'],1)-dt.timedelta(days=month['offset'])+dt.timedelta(days=7*r)
  if show_weeks:center(c,x+cw*.5,start-(r+1)*rh,first.isocalendar().week,5.5,MUTED)
 for day in month['days']:
  p=month['offset']+day['day']-1;j=p%7;r=p//7
  font=BOLD if day['holidays'] else getattr(c,'datefont',FONT)
  xx=x+(j+shift+.5)*cw;yy=start-(r+1)*rh;date_size=10.5 if style==4 else 8
  c.date_positions.append({'date':day['date'],'row':r,'column':j,'x':xx-pdfmetrics.stringWidth(str(day['day']),font,date_size)/2,'y':yy,'label':str(day['day']),'weekday':day['weekday']})
  center(c,xx,yy,day['day'],date_size,RED if day['holidays'] else INK,font)

def annual(c,year,design,w,h):
 k=design.get('render',int(design['id']));top=header(c,w,h,f"{year['year']} metų kalendorius",design['name']+' · ISO savaitės · Šventės pažymėtos raudonai',k)
 # Distinct readable structures: quarters, split semester sheets, side rail, full-width rows.
 cols=6 if k==9 else 4 if k in [2,4,5,7,8,10] else 3;rows=12//cols;x=32;available_w=w-64;bottom=45
 if k==5:available_w-=105;text(c,w-125,top-14,'ŠEIMOS PLANAI',8,GREEN,BOLD);[line(c,w-125,top-38-i*24,w-32,top-38-i*24) for i in range(15)]
 if k==6: x=97;available_w-=65;text(c,32,top-53,str(year['year'])[:2],38,GREEN,BOLD);text(c,32,top-95,str(year['year'])[2:],38,GREEN,BOLD)
 gapx=13;gapy=12;mw=(available_w-gapx*(cols-1))/cols;mh=(top-bottom-gapy*(rows-1))/rows
 if k==8:
  # School terms: Sep–Dec top row, Jan–Apr middle, May–Aug bottom; labeled explicitly.
  order=list(range(12));cols=4;rows=3;mw=(available_w-39)/4;mh=(top-bottom-24)/3
 else:order=list(range(12))
 for i,index in enumerate(order):
  r=i//cols;j=i%cols;xx=x+j*(mw+gapx);yy=top-r*(mh+gapy)
  if k==7:rect(c,xx-4,yy-mh,mw+8,mh,PALE,None)
  if k==2:
   rect(c,xx-3,yy-mh,mw+6,mh,None,LINE)
   line(c,xx,yy-24,xx+mw,yy-24,LINE,.5)
   for rr in range(1,7):line(c,xx,yy-32-rr*(mh-33)/7,xx+mw,yy-32-rr*(mh-33)/7,LINE,.2)
  if k==9:leaf(c,xx+mw-16,yy-21,.38,-35)
  small_month(c,year['months'][index],xx,yy,mw,mh,k)
 footer(c,w,design['id']+' · A4 gulsčias · Pirmadienis–sekmadienis')

BLANKS=[('01','Tuščias mėnesio kalendorius','month',False),('02','Sekmadienio pradžios kalendorius','month',True),('03','Savaitės planuoklis','week',False),('04','Nedatuotas planavimo tinklelis','month',False),('05','Didelės rašymo erdvės kalendorius','month',False),('06','Šeimos savaitės planuoklis','family',False),('07','Biuro savaitės planas','office',False),('08','Mokyklos savaitės planas','school',False),('09','Minimalus didelio šrifto kalendorius','month',False),('10','Kontrastingas mėnesio planas','month',False)]
def blank(c,entry,w,h):
 k=int(entry['design']);title=entry['name'];top=header(c,w,h,title,'Nedatuotas · Užpildykite patys',10 if k==10 else 1)
 if entry['layout']=='month':
  text(c,32,top-4,'MĖNUO __________________    METAI __________',10,MUTED)
  grid(c,{},32,top-28,w-64,h-220,k,True,entry['rows'],entry['sunday'])
  text(c,32,100,'PRIORITETAI',9,GREEN,BOLD);line(c,32,77,w-32,77)
 else:
  layout=entry['layout'];cols=7 if layout=='week' else 5;cw=(w-64)/cols
  for j in range(cols):
   x=32+j*cw;rect(c,x,75,cw,top-75,None);text(c,x+7,top-20,DATA['weekdays'][j],10,GREEN,BOLD)
   if layout=='family':
    for i in range(1,5):line(c,x,75+i*(top-105)/4,x+cw,75+i*(top-105)/4)
   elif layout in ['office','school']:
    for i in range(1,10):line(c,x,75+i*(top-105)/10,x+cw,75+i*(top-105)/10)
   else:
    for i in range(1,7):line(c,x+7,75+i*(top-110)/7,x+cw-7,75+i*(top-110)/7)
  text(c,32,50,{'week':'Savaitė: __________________','family':'Šeimos nariai: __________________________________','office':'Savaitės tikslas: __________________________________','school':'Klasė / savaitė: __________________________________'}[layout],9,MUTED)
 footer(c,w,f"A4 · {entry['design']} · "+('Sekmadienis pirmas' if entry['sunday'] else 'Pirmadienis pirmas'))

def entries():
 items=[]
 for year in YEARS:
  for month in year['months']:
   for design in DATA['designs']:
    items.append({'kind':'monthly','year':year['year'],'month':month['month'],'design':design['id'],'name':design['name'],'style':design['style'],'typography':design['typography'],'layout':design['layout'],'stem':f"{year['year']}-{DATA['months'][month['month']-1][0]}-{design['id']}",'landscape':design['render'] in [1,2,4,5,7,10]})
  for design in DATA['designs']:items.append({'kind':'annual','year':year['year'],'month':None,'design':design['id'],'name':design['name'],'style':design['style'],'typography':design['typography'],'layout':'annual-'+design['layout'],'stem':f"{year['year']}-metinis-{design['id']}",'landscape':True})
 for id,name,layout,sunday in BLANKS:
  for rows in ([5,6] if layout=='month' else [None]):items.append({'kind':'blank','year':None,'month':None,'design':id,'name':name,'style':'bw' if int(id)<=5 else 'color','layout':layout,'rows':rows,'sunday':sunday,'stem':f"tuscias-{id}"+(f'-{rows}-eilutes' if rows else ''),'landscape':layout!='month' or id=='05'})
 return items

FINGERPRINT=hashlib.sha256(Path(__file__).read_bytes()+(ROOT/'data/calendar.json').read_bytes()+(ROOT/'site/assets/data/years.json').read_bytes()+(ROOT/'site/assets/fonts/Inter-Regular.ttf').read_bytes()+(ROOT/'site/assets/fonts/Inter-Bold.ttf').read_bytes()).hexdigest()
def build_pdf(e):
 pdf=OUT/(e['stem']+'.pdf');w,h=landscape(A4) if e['landscape'] else A4
 c=PrintCanvas(str(pdf),pagesize=(w,h),pageCompression=1,invariant=1,mono=e['style']=='bw',regular=e.get('typography')=='regular');c.setCropBox((0,0,w,h),name='trim');c.setTitle(e['name']+(f" · {e['year']}" if e['year'] else ''));c.setAuthor('Kalendorius365');c.setSubject('Lietuviškas kalendorius · '+e['stem'])
 if e['kind']=='monthly':monthly(c,next(y for y in YEARS if y['year']==e['year'])['months'][e['month']-1],DATA['designs'][int(e['design'])-1],w,h)
 elif e['kind']=='annual':annual(c,next(y for y in YEARS if y['year']==e['year']),DATA['designs'][int(e['design'])-1],w,h)
 else:blank(c,e,w,h)
 e['dateLayout']=c.date_positions
 c.showPage();c.save()

def generate(e):
 pdf=OUT/(e['stem']+'.pdf');webp=OUT/(e['stem']+'.webp');preview=PREVIEW/(e['stem']+'.webp');stamp=CACHE/(e['stem']+'.sha256')
 if not (stamp.exists() and stamp.read_text()==FINGERPRINT and all(p.exists() for p in [pdf,webp,preview])):
  build_pdf(e)
  width,height=(7016,4961) if e['landscape'] else (4961,7016)
  with tempfile.TemporaryDirectory() as tmp:
   target=Path(tmp)/'page'
   subprocess.run(['pdftoppm','-f','1','-singlefile','-scale-to-x',str(width),'-scale-to-y',str(height),'-png',str(pdf),str(target)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
   image=Image.open(str(target)+'.png').convert('RGB');
   if SAMPLE_MODE:image.save(OUT/(e['stem']+'-600ppi-proof.png'))
   image.save(webp,'WEBP',quality=100 if e['style']=='bw' else 96,lossless=e['style']=='bw',method=4);image.thumbnail((680,680),Image.Resampling.LANCZOS);image.save(preview,'WEBP',quality=84,method=5)
  stamp.write_text(FINGERPRINT)
  (CACHE/(e['stem']+'.layout.json')).write_text(json.dumps(e.get('dateLayout',[])))
 if 'dateLayout' not in e:e['dateLayout']=json.loads((CACHE/(e['stem']+'.layout.json')).read_text())
 e['pdf']='/downloads/'+pdf.name;e['webp']='/downloads/'+webp.name;e['preview']='/assets/previews/'+preview.name
 e['paper']='A4';e['dimensions']={'width':7016 if e['landscape'] else 4961,'height':4961 if e['landscape'] else 7016}
 e['files']={k:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for k,p in [('pdf',pdf),('webp',webp),('preview',preview)]}
 e['colorMode']='DeviceGray monochrome' if e['style']=='bw' else 'RGB vector artwork';e['renderPPI']=600;e['verification']={'status':'pending'}
 return e
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--limit',type=int);parser.add_argument('--samples',action='store_true');parser.add_argument('--workers',type=int,default=2);args=parser.parse_args();SAMPLE_MODE=args.samples;items=entries();
 if SAMPLE_MODE:
  OUT=ROOT.parents[1]/'outputs/print-samples';PREVIEW=OUT/'previews';OUT.mkdir(parents=True,exist_ok=True);PREVIEW.mkdir(exist_ok=True);CACHE=CACHE/'samples';CACHE.mkdir(exist_ok=True)
  items=[e for e in items if (e['kind'],e['year'],e['month'],e['design']) in [('monthly',2027,1,'06'),('monthly',2028,2,'02')]]
 else:
  gate=json.loads((CACHE/'sample-gate.json').read_text()) if (CACHE/'sample-gate.json').exists() else {}
  if gate.get('generator')!=FINGERPRINT or gate.get('status')!='passed':raise SystemExit('Sample preflight and visual approval gate has not passed for this renderer. Run --samples and preflight first.')
 items=items[:args.limit] if args.limit else items
 with ThreadPoolExecutor(max_workers=args.workers) as pool:
  result=[]
  for i,e in enumerate(pool.map(generate,items),1):
   result.append(e)
   if i%10==0:print(f'Rendered {i}/{len(items)}',flush=True)
 manifest={'schema':1,'generator':FINGERPRINT,'sourceReviewed':DATA['reviewed'],'assets':result}
 (OUT/'manifest.json' if SAMPLE_MODE else ROOT/'site/assets/data/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 print(f"Completed {len(result)} PDF + {len(result)} WebP + {len(result)} thumbnails",flush=True)
