#!/usr/bin/env python3
"""Vector-first compositions. WebP is rasterized from that exact PDF, never redrawn.
Run prepare.rb first. --limit 10 for the first design review; omit to generate all.
Content-addressed cache skips unchanged outputs. No network during rendering.
"""
from pathlib import Path
import argparse, calendar, datetime as dt, hashlib, json, math, os, shutil, subprocess, tempfile, copy
from concurrent.futures import ThreadPoolExecutor
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image
from pypdf import PdfReader
from pypdf.generic import ContentStream
ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'data/calendar.json').read_text())
YEARS=json.loads((ROOT/'site/assets/data/years.json').read_text())
OUT=ROOT/'site/downloads'; PREVIEW=ROOT/'site/assets/previews'; SMALL_PREVIEW=ROOT/'site/assets/previews-small'; CACHE=ROOT/'.build-cache'; CACHE.mkdir(exist_ok=True)
for p in [OUT,PREVIEW,SMALL_PREVIEW]:p.mkdir(parents=True,exist_ok=True)
for name in ['Regular','Bold']:pdfmetrics.registerFont(TTFont('Inter'+name,str(ROOT/f'site/assets/fonts/Inter-{name}.ttf')))
for name in ['Regular','Bold','Black']:pdfmetrics.registerFont(TTFont('Lato'+name,str(ROOT/f'site/assets/fonts/Lato-{name}.ttf')))
INK=HexColor('#182b24'); GREEN=HexColor('#006A44'); RED=HexColor('#C1272D'); YELLOW=HexColor('#FDB913'); LINE=HexColor('#ccd6cf'); MUTED=HexColor('#50635a'); PALE=HexColor('#eef3ee')
BLUE=HexColor('#3274a8'); TEAL=HexColor('#318b83'); GOLD=HexColor('#bd8423'); LILAC=HexColor('#7563a8'); CLOUD=HexColor('#f5f7f5')
FONT='InterRegular'; BOLD='InterBold'
ISSUES=[]

class PrintCanvas(canvas.Canvas):
 def __init__(self,*args,mono=False,regular=False,**kwargs):
  self.mono=mono;self.datefont=FONT if regular else BOLD;self.headingfont=FONT if regular else BOLD;self.date_positions=[]
  super().__init__(*args,initialFontName=FONT,initialFontSize=10,**kwargs)
 def gray(self,color):
  # Keep brand accents solid in monochrome, while preserving real luminance for
  # intermediate colors such as #333 (otherwise labels become nearly white).
  rgb=(round(color.red,4),round(color.green,4),round(color.blue,4))
  value=1 if rgb==(1,1,1) else 0 if color in [INK,GREEN,RED,YELLOW] else round(.2126*color.red+.7152*color.green+.0722*color.blue,4)
  return getattr(self,'preserved_gray_mapping',{}).get(f'{value:.4f}',value)
 def setFillColor(self,color,alpha=None):
  if self.mono:self.setFillGray(self.gray(color),alpha=alpha)
  else:super().setFillColor(color,alpha)
 def setStrokeColor(self,color,alpha=None):
  if self.mono:self.setStrokeGray(self.gray(color),alpha=alpha)
  else:super().setStrokeColor(color,alpha)

def text(c,x,y,s,size=10,color=INK,font=FONT):
 c.setFillColor(color);c.setFont(selected_font(c,font),size);c.drawString(x,y,str(s))
def right(c,x,y,s,size=10,color=INK,font=FONT):
 c.setFillColor(color);c.setFont(selected_font(c,font),size);c.drawRightString(x,y,str(s))
def center(c,x,y,s,size=10,color=INK,font=FONT):
 c.setFillColor(color);c.setFont(selected_font(c,font),size);c.drawCentredString(x,y,str(s))
def selected_font(c,font):
 if not getattr(c,'blank_font',False):return font
 if 'Black' in font:return 'LatoBlack'
 return 'LatoBold' if 'Bold' in font else 'LatoRegular'
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
 line(c,32,30,w-32,30)
 if getattr(c,'brand_signature',False):
  # Original, print-safe vector mark: calendar outline, binding rings and a
  # small Lithuanian tricolour accent. It stays sharp at any print resolution.
  c.setStrokeColor(GREEN);c.setLineWidth(1.1);c.roundRect(32,10,21,16,3,fill=0,stroke=1)
  line(c,32,20,53,20,GREEN,1.2);line(c,37,24,37,28,GREEN,1.2);line(c,48,24,48,28,GREEN,1.2)
  line(c,37,15,41,15,TEAL,1.2);line(c,44,15,48,15,TEAL,1.2)
  rect(c,48,8,5,1.5,YELLOW,None);rect(c,48,6.5,5,1.5,GREEN,None);rect(c,48,5,5,1.5,RED,None)
  text(c,60,15,'Kalendorius365',8.4,GREEN,'LatoBlack');text(c,126,15,'TM',3.8,MUTED,'LatoBold')
 else:text(c,32,17,'Kalendorius365.lt',8,MUTED,BOLD)
 right(c,w-32,17,label,6.5,MUTED)

def blank_header(c,w,h,title,subtitle,design,landscape_page=False):
 """A distinct, restrained editorial header shared by printable blank sheets."""
 accent={1:GREEN,2:BLUE,3:TEAL,4:INK,5:GOLD,6:GREEN,7:BLUE,8:LILAC,9:TEAL,10:GREEN}.get(int(design),GREEN)
 if int(design)==10:
  rect(c,24,h-103,w-48,77,INK,None)
  # Fine tricolour rule and deliberately generous title spacing.
  rect(c,24,h-29,(w-48)/3,3,YELLOW,None);rect(c,24+(w-48)/3,h-29,(w-48)/3,3,GREEN,None);rect(c,24+2*(w-48)/3,h-29,(w-48)/3,3,RED,None)
  text(c,40,h-60,title,22,white,'LatoBlack');text(c,40,h-82,subtitle,8,HexColor('#d7e1dc'),'LatoRegular')
  right(c,w-42,h-48,'MĖNESIO PLANAS',6,HexColor('#d7e1dc'),'LatoBold')
  return h-124
 # Calm wordmark and original small arc motif make blank pages identifiable
 # without taking writing room from the calendar.
 c.setFillColor(accent);c.circle(39,h-39,9,fill=1,stroke=0)
 c.setStrokeColor(white);c.setLineWidth(1.1);c.roundRect(34,h-44,10,10,1.8,fill=0,stroke=1)
 line(c,34,h-38,44,h-38,white,.8);line(c,37,h-35,37,h-33,white,.8);line(c,41,h-35,41,h-33,white,.8)
 text(c,55,h-37,'KALENDORIUS365  ·  NEDATUOTAS PLANAVIMO LAPAS',6.5,accent,'LatoBold')
 text(c,32,h-70,title,20 if landscape_page else 19,INK,'LatoBlack')
 text(c,32,h-91,subtitle,8,MUTED,'LatoRegular')
 line(c,32,h-103,w-32,h-103,accent,1.2)
 right(c,w-32,h-37,'A4  ·  SPAUSDINIMUI',6.2,MUTED,'LatoBold')
 # A quiet, original arc and dot motif in the far corner adds hierarchy while
 # keeping the printable area neutral and ink-efficient.
 c.setStrokeColor(accent);c.setLineWidth(.6);c.arc(w-75,h-88,w-36,h-49,25,105);c.circle(w-52,h-68,1.1,fill=1,stroke=0)
 return h-120

def blank_month_grid(c,x,top,w,height,rows,design,sunday=False):
 accent={1:GREEN,2:BLUE,4:INK,5:GOLD,9:TEAL,10:GREEN}.get(int(design),GREEN)
 weekday_names=DATA['weekdays'][:]
 if sunday:weekday_names=[weekday_names[-1]]+weekday_names[:-1]
 header_h=24;cell_h=(height-header_h)/rows;cell_w=w/7
 # Style 09 uses open writing bands and oversized weekday labels; all other
 # styles use a carefully balanced grid with a generous writable interior.
 for col,name in enumerate(weekday_names):
  xx=x+col*cell_w
  if int(design) in [2,10]:rect(c,xx,top-header_h,cell_w,header_h,accent,None)
  elif int(design)==9:line(c,xx,top-header_h,xx+cell_w,top-header_h,accent,1.1)
  else:rect(c,xx,top-header_h,cell_w,header_h,CLOUD if col%2==0 else white,None)
  color=white if int(design) in [2,10] else RED if name=='Sk' or (sunday and name=='Pr') else accent
  center(c,xx+cell_w/2,top-15,name,9 if int(design)==9 else 7.8,color,'LatoBold')
 for row in range(rows):
  row_top=top-header_h-row*cell_h;row_bottom=row_top-cell_h
  for col in range(7):
   xx=x+col*cell_w
   if int(design)==4:
    # Open page-like cells: vertical rails disappear, leaving a quiet writing rule.
    line(c,xx+4,row_bottom+2,xx+cell_w-4,row_bottom+2,HexColor('#bac7bf'),.45)
   elif int(design)==9:
    line(c,xx,row_top,xx+cell_w,row_top,HexColor('#9dbdb3'),.55)
    if col==0:line(c,xx,row_bottom,xx,row_top,HexColor('#9dbdb3'),.4)
   else:
    rect(c,xx,row_bottom,cell_w,cell_h,None,HexColor('#b7c2bb') if int(design)==10 else LINE)
    if int(design)==5:
     # A subtle corner index is a writing cue rather than decorative ink fill.
     c.setFillColor(accent);c.circle(xx+7,row_top-7,1.2,fill=1,stroke=0)
 if int(design)==9:
  # Short weekday divider on the large-type edition.
  line(c,x,top-header_h,x+w,top-header_h,accent,1.2)

def blank_month_page(c,entry,w,h):
 design=int(entry['design']);landscape_page=entry['landscape'];top=blank_header(c,w,h,entry['name'],'Pasirinkite datas ir pasižymėkite svarbiausius mėnesio darbus.',design,landscape_page)
 text(c,32,top-13,'MĖNUO',6.5,MUTED,'LatoBold');line(c,57,top-15,145,top-15,LINE,.6)
 text(c,154,top-13,'METAI',6.5,MUTED,'LatoBold');line(c,181,top-15,232,top-15,LINE,.6)
 if design==5:
  # Landscape edition pairs a legible calendar with an adjacent planning rail.
  x=32;grid_w=(w-64)*.70;grid_top=top-37;grid_h=h-260
  blank_month_grid(c,x,grid_top,grid_w,grid_h,entry['rows'],design,entry['sunday'])
  rail_x=x+grid_w+18;rail_w=w-rail_x-32;rail_top=grid_top
  for heading,lines_count in [('MĖNESIO KRYPTIS',3),('SVARBIAUSIOS DATOS',4),('UŽRAŠAI',5)]:
   text(c,rail_x,rail_top-12,heading,7,accent_for(design),'LatoBold')
   row_y=rail_top-20
   for _ in range(lines_count):line(c,rail_x,row_y,rail_x+rail_w,row_y,LINE,.55);row_y-=21
   rail_top=row_y-12
 else:
  grid_top=top-37;grid_h=h-273
  blank_month_grid(c,32,grid_top,w-64,grid_h,entry['rows'],design,entry['sunday'])
  notes_y=83;text(c,32,notes_y,'MĖNESIO PRIORITETAI',6.7,MUTED,'LatoBold')
  line(c,32,notes_y-9,w-32,notes_y-9,LINE,.6);line(c,32,notes_y-25,w-32,notes_y-25,LINE,.5);line(c,32,notes_y-41,w-32,notes_y-41,LINE,.5)
 c.brand_signature=True
 footer(c,w,f"A4 · {entry['rows']} eilutės · {'Sekmadienio' if entry['sunday'] else 'Pirmadienio'} pradžia")

def accent_for(design):return {1:GREEN,2:BLUE,4:INK,5:GOLD,9:TEAL,10:GREEN}.get(int(design),GREEN)

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
 k=design.get('render',int(design['id']))
 legend='12 mėnesių apžvalga' if design['style']=='bw' else 'Šventės pažymėtos raudonai'
 top=header(c,w,h,f"{year['year']} metų kalendorius",design['name']+' · ISO savaitės · '+legend,k)
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

BLANKS=[
 ('01','Tuščias mėnesio kalendorius','month',False,'bw','bold',None),('02','Sekmadienio pradžios kalendorius','month',True,'bw','bold',None),('03','Savaitės planuoklis','week',False,'bw','regular',None),('04','Nedatuotas planavimo tinklelis','month',False,'bw','regular',None),('05','Didelės rašymo erdvės kalendorius','month',False,'bw','bold',None),('06','Šeimos savaitės planuoklis','family',False,'color','bold',None),('07','Biuro savaitės planas','office',False,'color','regular',None),('08','Mokyklos savaitės planas','school',False,'color','bold',None),('09','Minimalus didelio šrifto kalendorius','month',False,'color','regular',None),('10','Kontrastingas mėnesio planas','month',False,'color','bold',None),
 ('11','Savaitės laiko blokų planas','weekly-time',False,'bw','regular','week'),('12','Savaitės prioritetų planas','weekly-priority',False,'color','bold','week'),
 ('13','Dienos laiko juostos planuoklis','daily-time',False,'bw','bold','day'),('14','Dienos prioritetų planuoklis','daily-priority',False,'color','regular','day'),
 ('15','Šeimos savaitės stulpeliai','family-columns',False,'bw','regular','family'),('16','Šeimos bendrų veiklų savaitė','family-shared',False,'color','bold','family'),
 ('17','Pamokų savaitės tinklelis','school-grid',False,'bw','bold','school'),('18','Pamokų ir užduočių planas','school-tasks',False,'color','regular','school'),
 ('19','Pamainų ciklo žiniaraštis','shift-rota',False,'bw','regular','shift'),('20','Pamainų mėnesio planas','shift-month',False,'color','bold','shift')
]
def planner_blank(c,e,w,h):
 mono=e['style']=='bw';bold=e.get('typography')=='bold';ink=INK;accent=GREEN if not mono else HexColor('#333333');soft=PALE if not mono else HexColor('#f0f0f0')
 title=e['name'];top=blank_header(c,w,h,title,'Aiški savaitės struktūra, palikta jūsų planams ir užrašams.',e['design'],e['landscape'])
 kind=e['layout'];days=['Pr','An','Tr','Kt','Pn','Št','Sk']
 if kind in ['week','family','office','school']:
  left=32;right=w-32;bottom=76;head=top-18
  if kind=='week':
   cols=7;gap=4;cw=(right-left-gap*(cols-1))/cols
   for col,d in enumerate(days):
    xx=left+col*(cw+gap);rect(c,xx,bottom,cw,head-bottom,white,LINE);rect(c,xx,head-24,cw,24,soft,None);text(c,xx+5,head-16,d,8,accent,BOLD if bold else FONT)
    for rr in range(1,7):line(c,xx+6,bottom+rr*(head-bottom-31)/7,xx+cw-6,bottom+rr*(head-bottom-31)/7,LINE,.45)
   text(c,left,54,'SAVAITĖ NUO __________________',7,MUTED,BOLD)
  elif kind=='family':
   cols=5;gap=7;cw=(right-left-gap*(cols-1))/cols;labels=['Bendri planai','Narys 1','Narys 2','Narys 3','Narys 4']
   for col,label in enumerate(labels):
    xx=left+col*(cw+gap);rect(c,xx,bottom,cw,head-bottom,white,LINE);rect(c,xx,head-28,cw,28,soft,None);text(c,xx+5,head-18,label,7,accent,BOLD if bold else FONT)
    for rr in range(1,7):line(c,xx+7,bottom+rr*(head-bottom-36)/7,xx+cw-7,bottom+rr*(head-bottom-36)/7,LINE,.45)
   text(c,left,54,'SAVAITĖS BENDRAS TIKSLAS: ___________________________________________',7,MUTED,BOLD)
  elif kind=='office':
   cols=5;gap=6;cw=(right-left-gap*(cols-1))/cols;labels=days[:5]
   for col,d in enumerate(labels):
    xx=left+col*(cw+gap);rect(c,xx,bottom,cw,head-bottom,white,LINE);rect(c,xx,head-25,cw,25,soft,None);text(c,xx+7,head-17,d,8,accent,BOLD if bold else FONT)
    for rr in range(1,9):
     yy=head-25-rr*(head-bottom-30)/9;line(c,xx+6,yy,xx+cw-6,yy,LINE,.45)
   text(c,left,55,'SAVAITĖS TIKSLAS ______________________________   SVARBIAUSIAS REZULTATAS ______________________________',7,MUTED,BOLD)
  else:
   cols=5;gap=4;labelw=54;cw=(right-left-labelw-gap*(cols-1))/cols
   for col,d in enumerate(days[:5]):
    xx=left+labelw+col*(cw+gap);rect(c,xx,bottom,cw,head-bottom,white,LINE);rect(c,xx,head-25,cw,25,soft,None);center(c,xx+cw/2,head-17,d,8,accent,BOLD)
   for rr in range(6):
    yy=head-25-(rr+1)*(head-bottom-30)/6;text(c,left+3,yy+5,f'{rr+1} pam.',6,MUTED,BOLD if bold else FONT)
    for col in range(cols):
     xx=left+labelw+col*(cw+gap);line(c,xx,yy,xx+cw,yy,LINE,.4)
   text(c,left,54,'KLASĖ __________________    SAVAITĖ NUO __________________',7,MUTED,BOLD)
 elif kind in ['weekly-time','weekly-priority']:
  x=32;usable=w-64;gap=5;cols=7;cw=(usable-gap*6)/7;head=top-24;bottom=75;rowh=(head-bottom)/5
  for col,d in enumerate(days):
   xx=x+col*(cw+gap);rect(c,xx,bottom,cw,head-bottom,white,LINE);rect(c,xx,head-24,cw,24,soft,None);text(c,xx+5,head-16,d,8,accent,BOLD if bold else FONT)
   if kind=='weekly-time':
    for rr in range(1,5):
     yy=head-24-rr*rowh;text(c,xx+4,yy+3,f'{rr*3:02}:00',5.6,MUTED);line(c,xx+31,yy,xx+cw,yy,LINE,.35)
   else:
    text(c,xx+5,head-39,'Svarbu',6.2,accent,BOLD)
    for rr in range(1,6):line(c,xx+5,head-48-rr*((head-bottom-55)/6),xx+cw-5,head-48-rr*((head-bottom-55)/6),LINE,.45)
  text(c,32,48,'Savaitės prioritetai: __________________________________________________________    Pastabos: __________________________________',7,MUTED)
 elif kind in ['daily-time','daily-priority']:
  left=32;gap=14;mainw=(w-64)*.63;rightx=left+mainw+gap;rightw=w-rightx-32;bottom=65;topcontent=top-15
  rect(c,left,bottom,mainw,topcontent-bottom,white,LINE);text(c,left+12,topcontent-20,'DATA __________________    SVARBIAUSIA ŠIANDIEN',10,accent,BOLD if bold else FONT)
  if kind=='daily-time':
   for hr in range(7,22):
    yy=topcontent-55-(hr-7)*((topcontent-bottom-72)/15);text(c,left+9,yy+2,f'{hr:02}:00',6.2,MUTED);line(c,left+52,yy,left+mainw-10,yy,LINE,.55)
  else:
   for rr in range(1,13):line(c,left+12,topcontent-47-rr*((topcontent-bottom-58)/13),left+mainw-12,topcontent-47-rr*((topcontent-bottom-58)/13),LINE,.55)
  for title2,yy,n in [('Trys svarbiausi darbai',topcontent-22,3),('Kitos užduotys',topcontent-255,5),('Pastabos / užrašai',topcontent-440,4)]:
   if yy<bottom+20:continue
   text(c,rightx,yy,title2,9,accent,BOLD)
   for rr in range(n):line(c,rightx,yy-22-(rr+1)*20,rightx+rightw,yy-22-(rr+1)*20,LINE,.5)
 elif kind in ['family-columns','family-shared']:
  left=32;gap=8;usable=w-64;cols=kind=='family-columns' and 5 or 4;cw=(usable-gap*(cols-1))/cols;bottom=70;head=top-20
  labels=['Bendri planai','Narys 1','Narys 2','Narys 3','Narys 4'] if cols==5 else ['Šeima','Narys 1','Narys 2','Narys 3']
  for col in range(cols):
   xx=left+col*(cw+gap);rect(c,xx,bottom,cw,head-bottom,white,LINE);rect(c,xx,head-25,cw,25,soft,None);text(c,xx+5,head-17,labels[col],7,accent,BOLD if bold else FONT)
   for rr in range(1,7):line(c,xx+6,bottom+rr*(head-bottom-32)/7,xx+cw-6,bottom+rr*(head-bottom-32)/7,LINE,.45)
   if kind=='family-shared':
    for rr in range(1,4):rect(c,xx+5,bottom+rr*(head-bottom-32)/4,cw-10,13,PALE,None)
  text(c,32,45,'Bendras savaitės tikslas: ______________________________________________________',7,MUTED)
 elif kind in ['school-grid','school-tasks']:
  left=32;bottom=80;head=top-25;gridw=(w-64)*(.68 if kind=='school-tasks' else 1);rowh=(head-bottom-25)/10;labelw=31;cw=(gridw-labelw)/6
  for j,d in enumerate(days[:6]):rect(c,left+labelw+j*cw,head-23,cw,23,soft,None);center(c,left+labelw+(j+.5)*cw,head-15,d,7,accent,BOLD if bold else FONT)
  for r in range(10):
   yy=head-23-(r+1)*rowh;text(c,left+3,yy+rowh/2-2,str(r+1),6,MUTED)
   for j in range(6):rect(c,left+labelw+j*cw,yy,cw,rowh,white,LINE)
   if kind=='school-grid' and r%2==0:
    line(c,left,yy+rowh/2,left+labelw-3,yy+rowh/2,LINE,.45)
  if kind=='school-tasks':
   rx=left+gridw+14;rw=w-rx-32;text(c,rx,head-14,'Užduotys / atsiskaitymai',8,accent,BOLD)
   for r in range(10):
    yy=head-37-r*rowh;rect(c,rx,yy-8,8,8,None,accent);line(c,rx+14,yy-6,rx+rw,yy-6,LINE,.5)
  text(c,32,55,'Savaitė nuo __________________    Klasė (nebūtina) __________________',7,MUTED)
 elif kind in ['shift-rota','shift-month']:
  left=32;bottom=78;head=top-24;labelw=73;cols=7;cw=(w-64-labelw)/cols;rows=6;rowh=(head-bottom-26)/rows
  for j,d in enumerate(days):rect(c,left+labelw+j*cw,head-24,cw,24,soft,None);center(c,left+labelw+(j+.5)*cw,head-16,d,7,accent,BOLD if bold else FONT)
  for r in range(rows):
   yy=head-24-(r+1)*rowh;text(c,left+3,yy+rowh/2-2,f'{r+1} sav.',6,MUTED)
   for j in range(cols):
    xx=left+labelw+j*cw;rect(c,xx,yy,cw,rowh,white,LINE)
    if kind=='shift-rota':line(c,xx+4,yy+rowh*.34,xx+cw-4,yy+rowh*.34,LINE,.35);line(c,xx+4,yy+rowh*.67,xx+cw-4,yy+rowh*.67,LINE,.35)
  text(c,32,52,'Pamainų žymos: D __________________  N __________________  P __________________',7,MUTED)
 c.brand_signature=True
 footer(c,w,f"A4 · {e['design']} · {'Nespalvotas' if mono else 'Spalvotas'} · {'Paryškintas' if bold else 'Įprastas'} šriftas")

def blank(c,entry,w,h):
 k=int(entry['design']);title=entry['name']
 if entry['layout']=='month':
  blank_month_page(c,entry,w,h);return
 if entry.get('category') or entry['layout'] in ['week','family','office','school']:
  planner_blank(c,entry,w,h);return
 top=blank_header(c,w,h,title,'Naudokite atspausdintą lapą savaitės planams ir užrašams.',k,entry['landscape'])
 layout=entry['layout'];cols=7 if layout=='week' else 5;cw=(w-64)/cols
 for j in range(cols):
  x=32+j*cw;rect(c,x,75,cw,top-75,None);text(c,x+7,top-20,DATA['weekdays'][j],10,GREEN,BOLD)
  for i in range(1,7):line(c,x+7,75+i*(top-105)/7,x+cw-7,75+i*(top-105)/7)
 c.brand_signature=True
 footer(c,w,f"A4 · {entry['design']} · "+('Sekmadienio pradžia' if entry['sunday'] else 'Pirmadienio pradžia'))

def entries():
 items=[]
 for year in YEARS:
  for month in year['months']:
   for design in DATA['designs']:
    items.append({'kind':'monthly','year':year['year'],'month':month['month'],'design':design['id'],'name':design['name'],'style':design['style'],'typography':design['typography'],'layout':design['layout'],'stem':f"{year['year']}-{DATA['months'][month['month']-1][0]}-{design['id']}",'landscape':design['render'] in [1,2,4,5,7,10]})
  for design in DATA['designs']:items.append({'kind':'annual','year':year['year'],'month':None,'design':design['id'],'name':design['name'],'style':design['style'],'typography':design['typography'],'layout':'annual-'+design['layout'],'stem':f"{year['year']}-metinis-{design['id']}",'landscape':True})
 for id,name,layout,sunday,style,typography,category in BLANKS:
  for rows in ([5,6] if layout=='month' else [None]):
   landscape_page=layout not in ['month','daily-time','daily-priority'] or id=='05'
   items.append({'kind':'blank','year':None,'month':None,'design':id,'name':name,'style':style,'typography':typography,'category':category,'layout':layout,'rows':rows,'sunday':sunday,'stem':f"tuscias-{id}"+(f'-{rows}-eilutes' if rows else ''),'landscape':landscape_page})
 return items

FINGERPRINT=hashlib.sha256(Path(__file__).read_bytes()+(ROOT/'data/calendar.json').read_bytes()+(ROOT/'site/assets/data/years.json').read_bytes()+b''.join((ROOT/p).read_bytes() for p in ['site/assets/fonts/Inter-Regular.ttf','site/assets/fonts/Inter-Bold.ttf','site/assets/fonts/Lato-Regular.ttf','site/assets/fonts/Lato-Bold.ttf','site/assets/fonts/Lato-Black.ttf'])).hexdigest()
def build_pdf(e):
 pdf=OUT/(e['stem']+'.pdf');w,h=landscape(A4) if e['landscape'] else A4
 c=PrintCanvas(str(pdf),pagesize=(w,h),pageCompression=1,invariant=1,mono=e['style']=='bw',regular=e.get('typography')=='regular');c.setCropBox((0,0,w,h),name='trim');c.setTitle(e['name']+(f" · {e['year']}" if e['year'] else ''));c.setAuthor('Kalendorius365');c.setSubject('Lietuviškas kalendorius · '+e['stem'])
 c.preserved_gray_mapping=e.get('renderCompatibility',{}).get('preserved_gray_mapping',{})
 c.brand_signature=e['kind']=='blank';c.blank_font=e['kind']=='blank'
 if e['kind']=='monthly':monthly(c,next(y for y in YEARS if y['year']==e['year'])['months'][e['month']-1],DATA['designs'][int(e['design'])-1],w,h)
 elif e['kind']=='annual':annual(c,next(y for y in YEARS if y['year']==e['year']),DATA['designs'][int(e['design'])-1],w,h)
 else:blank(c,e,w,h)
 e['dateLayout']=c.date_positions
 c.showPage();c.save()

def generate(e):
 pdf=OUT/(e['stem']+'.pdf');webp=OUT/(e['stem']+'.webp');preview=PREVIEW/(e['stem']+'.webp');stamp=CACHE/(e['stem']+'.sha256')
 if not (stamp.exists() and stamp.read_text()==FINGERPRINT and all(p.exists() for p in [pdf,webp,preview,SMALL_PREVIEW/(e['stem']+'.webp')])):
  build_pdf(e)
  width,height=(7016,4961) if e['landscape'] else (4961,7016)
  with tempfile.TemporaryDirectory() as tmp:
   target=Path(tmp)/'page'
   subprocess.run(['pdftoppm','-f','1','-singlefile','-scale-to-x',str(width),'-scale-to-y',str(height),'-png',str(pdf),str(target)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
   image=Image.open(str(target)+'.png').convert('RGB');
   if SAMPLE_MODE:image.save(OUT/(e['stem']+'-600ppi-proof.png'))
   image.save(webp,'WEBP',quality=100 if e['style']=='bw' else 96,lossless=e['style']=='bw',method=4);image.thumbnail((680,680),Image.Resampling.LANCZOS);image.save(preview,'WEBP',quality=84,method=5);image.thumbnail((340,340),Image.Resampling.LANCZOS);image.save(SMALL_PREVIEW/(e['stem']+'.webp'),'WEBP',quality=87,method=4)
  stamp.write_text(FINGERPRINT)
  (CACHE/(e['stem']+'.layout.json')).write_text(json.dumps(e.get('dateLayout',[])))
 if 'dateLayout' not in e:e['dateLayout']=json.loads((CACHE/(e['stem']+'.layout.json')).read_text())
 small=SMALL_PREVIEW/(e['stem']+'.webp')
 e['pdf']='/downloads/'+pdf.name;e['webp']='/downloads/'+webp.name;e['preview']='/assets/previews/'+preview.name;e['smallPreview']='/assets/previews-small/'+small.name
 e['paper']='A4';e['dimensions']={'width':7016 if e['landscape'] else 4961,'height':4961 if e['landscape'] else 7016}
 e['files']={k:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for k,p in [('pdf',pdf),('webp',webp),('preview',preview),('smallPreview',small)]}
 e['colorMode']='DeviceGray monochrome' if e['style']=='bw' else 'RGB vector artwork';e['renderPPI']=600;e['verification']={'status':'pending'}
 return e

LEGEND_TRANSITION_PATH='docs/language-audit/2026-10-17/annual-monochrome-legend-v2.json'
LEGEND_PREVIOUS_GENERATOR='adec2197bfc4ef8334a6cd8080bb7133387f3c976b3b85a9d1e6559b90a29ac1'

def print_geometry(path):
 reader=PdfReader(path);page=reader.pages[0];spans=[]
 def visit(value,cm,tm,font,size):
  if value.strip():spans.append((value.strip(),float(tm[4]),float(tm[5]),float(size),str(font.get('/BaseFont',''))))
 text_value=page.extract_text(visitor_text=visit)
 operations=ContentStream(page.get_contents(),reader).operations
 geometry=[(str(op),str(values))for values,op in operations if op in {b'cm',b'm',b'l',b'c',b're',b'h',b'w'}]
 gray=[(str(op),float(values[0]))for values,op in operations if op in {b'g',b'G'}]
 return {'text':text_value,'spans':spans,'geometry':geometry,'gray':gray}

def correct_annual_monochrome_legends(workers=2):
 """One reviewed15-file migration; prove all other PDFs remain reproducible.

 Changing the renderer fingerprint normally invalidates every cache entry. This
  explicit migration renders the401 unaffected PDFs in a temporary directory and
 proves text/date/geometry identity before changing only15 published print sets.
 No existing sample gate is fabricated or promoted to this renderer version.
 """
 global OUT
 manifest_path=ROOT/'site/assets/data/manifest.json'
 original_bytes=manifest_path.read_bytes();manifest=json.loads(original_bytes)
 if manifest['generator']!=LEGEND_PREVIOUS_GENERATOR:
  raise SystemExit('This migration requires the exact original recorded manifest fingerprint.')
 assets=manifest['assets'];selected=[a for a in assets if a['kind']=='annual' and a['style']=='bw']
 if len(assets)!=416 or len(selected)!=15:
  raise SystemExit('Expected416 legacy assets and exactly15 monochrome annuals.')
 before_files={}
 for asset in assets:
  for kind in ['pdf','webp','preview']:
   p=ROOT/'site'/asset[kind].lstrip('/');expected=asset['files'][kind]
   if p.stat().st_size!=expected['bytes'] or hashlib.sha256(p.read_bytes()).hexdigest()!=expected['sha256']:
    raise SystemExit('Original manifest/file mismatch: '+str(p))
 for asset in selected:
  for rel in [asset['pdf'],asset['webp'],asset['preview'],'/assets/previews-small/'+asset['stem']+'.webp']:
   p=ROOT/'site'/rel.lstrip('/');before_files['site'+rel]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size}
 preserved=[];gray_mappings={};selected_geometry={};real_out=OUT
 try:
  with tempfile.TemporaryDirectory(prefix='k365-print-compatibility-') as tmp:
   OUT=Path(tmp)
   for original in assets:
    candidate=copy.deepcopy(original);build_pdf(candidate);p=OUT/(candidate['stem']+'.pdf')
    digest=hashlib.sha256(p.read_bytes()).hexdigest()
    before=print_geometry(ROOT/'site'/original['pdf'].lstrip('/'));after=print_geometry(p)
    if candidate['dateLayout']!=original['dateLayout'] or before['geometry']!=after['geometry']:
     raise SystemExit('PDF/date geometry is not reproducible: '+candidate['stem'])
    if original in selected:
     wanted=[(text.replace('Šventės pažymėtos raudonai','12 mėnesių apžvalga'),*rest)for text,*rest in before['spans']]
     if wanted!=after['spans']:raise SystemExit('More than the approved legend text changed: '+candidate['stem'])
     if len(before['gray'])!=len(after['gray']):raise SystemExit('Unexpected paint count change: '+candidate['stem'])
     mapping={}
     for (old_op,old_value),(new_op,new_value)in zip(before['gray'],after['gray']):
      key=f'{new_value:.4f}'
      if old_op!=new_op or(key in mapping and mapping[key]!=old_value):raise SystemExit('Ambiguous original grayscale mapping: '+candidate['stem'])
      mapping[key]=old_value
     gray_mappings[candidate['stem']]=mapping
     selected_geometry[candidate['stem']]=before
    else:
     if before['spans']!=after['spans']:raise SystemExit('Unaffected text/positions changed: '+candidate['stem'])
     preserved.append({'stem':candidate['stem'],'pdf_sha256':original['files']['pdf']['sha256'],'current_renderer_pdf_sha256':digest,'current_renderer_byte_identical':digest==original['files']['pdf']['sha256'],'current_renderer_text_positions_equal':True,'current_renderer_vector_geometry_equal':True,'original_paint_preserved_without_regeneration':True,'date_layout_sha256':hashlib.sha256(json.dumps(candidate['dateLayout'],sort_keys=True).encode()).hexdigest()})
 finally:OUT=real_out
 print('Proved401 unaffected text/date/vector layouts; original published bytes remain untouched.',flush=True)
 selected_before={a['stem']:copy.deepcopy(a) for a in selected}
 rendering=copy.deepcopy(selected)
 for asset in rendering:asset['renderCompatibility']={'reviewedTransition':LEGEND_TRANSITION_PATH,'preserved_gray_mapping':gray_mappings[asset['stem']]}
 with ThreadPoolExecutor(max_workers=workers) as pool:corrected=list(pool.map(generate,rendering))
 for asset in corrected:
  original=selected_before[asset['stem']]
  if asset['dateLayout']!=original['dateLayout']:raise SystemExit('Date geometry changed: '+asset['stem'])
  before=selected_geometry[asset['stem']];after=print_geometry(OUT/(asset['stem']+'.pdf'))
  wanted=[(text.replace('Šventės pažymėtos raudonai','12 mėnesių apžvalga'),*rest)for text,*rest in before['spans']]
  if wanted!=after['spans'] or before['geometry']!=after['geometry'] or before['gray']!=after['gray']:
   raise SystemExit('The corrected PDF changed more than its approved legend: '+asset['stem'])
  asset['generator']=FINGERPRINT
  image=Image.open(PREVIEW/(asset['stem']+'.webp'));image.thumbnail((340,340),Image.Resampling.LANCZOS)
  image.save(ROOT/'site/assets/previews-small'/(asset['stem']+'.webp'),'WEBP',quality=87,method=4)
 by_stem={a['stem']:a for a in corrected};manifest['assets']=[by_stem.get(a['stem'],a)for a in assets]
 manifest['generator']=FINGERPRINT;manifest['reviewedTransition']=LEGEND_TRANSITION_PATH
 manifest['generatorScope']='Current renderer validation and15 corrected sets; preserved legacy generation provenance is documented in the reviewed transition.'
 manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 transitions=[]
 for rel,before in before_files.items():
  p=ROOT/rel;transitions.append({'path':rel,'before':before,'after':{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size}})
 selected_metadata=[]
 for asset in corrected:
  original=selected_before[asset['stem']]
  selected_metadata.append({'stem':asset['stem'],'before_files':original['files'],'before_verification':original['verification'],'had_generator':'generator'in original,'before_generator':original.get('generator'),'preserved_gray_mapping':gray_mappings[asset['stem']],'date_layout_sha256':hashlib.sha256(json.dumps(original['dateLayout'],sort_keys=True).encode()).hexdigest(),'all_other_text_positions_equal':True,'vector_geometry_equal':True,'grayscale_paint_sequence_equal':True,'before_geometry_sha256':hashlib.sha256(json.dumps(selected_geometry[asset['stem']]['geometry']).encode()).hexdigest(),'after_geometry_sha256':hashlib.sha256(json.dumps(print_geometry(OUT/(asset['stem']+'.pdf'))['geometry']).encode()).hexdigest()})
 transition={'version':'2026-10-17-annual-monochrome-legend-v2','before_generator':LEGEND_PREVIOUS_GENERATOR,'before_generator_semantics':'Original recorded manifest fingerprint; this is not a claim that every historical PDF was produced by that exact recipe. Current-renderer comparison records actual byte differences explicitly.','after_generator':FINGERPRINT,'before_manifest_sha256':hashlib.sha256(original_bytes).hexdigest(),'before_text':'Šventės pažymėtos raudonai','after_text':'12 mėnesių apžvalga','scope':'Only15 monochrome annual legends; all date positions, layout, original grayscale painting, routes and color outputs preserved.','changed_files':transitions,'selected_assets':selected_metadata,'unchanged_current_renderer_pdf_proofs':preserved,'preflight_status':'pending','visual_status':'pending'}
 target=ROOT/LEGEND_TRANSITION_PATH;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(transition,ensure_ascii=False,indent=2)+'\n')
 print('Corrected15 PDF/WebP/680px/340px sets. Real preflight and visual review remain required.',flush=True)

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--limit',type=int);parser.add_argument('--samples',action='store_true');parser.add_argument('--phase-8-assets',action='store_true',help='Generate only the additive 2029 collection and new planner sheets; preserve existing assets.');parser.add_argument('--redesign-blanks',action='store_true',help='Regenerate only the 26 blank planning sheets after the sample and print QA gates pass.');parser.add_argument('--correct-annual-monochrome-legends',action='store_true',help='Reviewed selective15-asset legend correction with401-PDF compatibility proof.');parser.add_argument('--workers',type=int,default=2);args=parser.parse_args();SAMPLE_MODE=args.samples;items=entries();
 if args.correct_annual_monochrome_legends:
  if args.samples or args.limit or args.phase_8_assets:raise SystemExit('The reviewed legend migration cannot be combined with other generation modes.')
  correct_annual_monochrome_legends(args.workers);raise SystemExit(0)
 if args.redesign_blanks:
  if args.samples or args.limit or args.phase_8_assets:raise SystemExit('--redesign-blanks cannot be combined with sample, limit or phase-8 generation.')
  gate=json.loads((CACHE/'sample-gate.json').read_text()) if (CACHE/'sample-gate.json').exists() else {}
  if gate.get('generator')!=FINGERPRINT or gate.get('status')!='passed' or gate.get('visualReviewed') is not True:
   raise SystemExit('Blank calendar assets require the current complete sample set to pass automated preflight and visual review first.')
  manifest_path=ROOT/'site/assets/data/manifest.json';original=json.loads(manifest_path.read_text());original_bytes=manifest_path.read_bytes()
  if len(original.get('assets',[]))!=416 or sum(a['kind']=='blank' for a in original['assets'])!=26:raise SystemExit('Expected the complete 416-asset manifest with 26 existing blank designs.')
  selected=[e for e in items if e['kind']=='blank']
  if len(selected)!=26:raise SystemExit(f'Expected26 blank designs; found {len(selected)}')
  preserved=[]
  for asset in original['assets']:
   if asset['kind']=='blank':continue
   for kind in ['pdf','webp','preview','smallPreview']:
    path=ROOT/'site'/asset[kind].lstrip('/');info=asset['files'][kind]
    if not path.is_file() or path.stat().st_size!=info['bytes'] or hashlib.sha256(path.read_bytes()).hexdigest()!=info['sha256']:
     raise SystemExit('Unchanged print asset does not match its checked manifest hash: '+str(path))
   preserved.append({'stem':asset['stem'],'files':asset['files']})
  with ThreadPoolExecutor(max_workers=args.workers) as pool:rendered=list(pool.map(generate,selected))
  for asset in rendered:asset['generator']=FINGERPRINT
  before={a['stem']:a for a in original['assets']};after={a['stem']:a for a in rendered}
  merged=[after[a['stem']] if a['kind']=='blank' else a for a in original['assets']]
  transition={'version':'2026-10-18-blank-calendar-redesign-v1','after_generator':FINGERPRINT,'before_manifest_sha256':hashlib.sha256(original_bytes).hexdigest(),'scope':'Only the 26 existing blank calendar/planner print sets were redesigned. All 390 dated monthly and annual PDF/WebP/preview file hashes were verified before regeneration and retained unchanged. Existing blank stems and public download paths were retained; five/six-row month designs remain separate files and are now grouped as one selectable layout on the page.','preserved_nonblank_assets':preserved,'redesigned_blank_assets':[{'stem':a['stem'],'before_files':before[a['stem']]['files'],'after_files':a['files']} for a in rendered]}
  transition_path=ROOT/'docs/blank-calendar-redesign/asset-transition.json';transition_path.parent.mkdir(parents=True,exist_ok=True);transition_path.write_text(json.dumps(transition,ensure_ascii=False,indent=2)+'\n')
  original['assets']=merged;original['generator']=FINGERPRINT;original['blankRedesign']='docs/blank-calendar-redesign/asset-transition.json';original['sourceReviewed']='2026-10-18'
  manifest_path.write_text(json.dumps(original,ensure_ascii=False,indent=2));print(f'Redesigned {len(rendered)} blank print sets; retained and verified 390 other assets.',flush=True);raise SystemExit(0)
 if (ROOT/'site/assets/data/manifest.json').is_file():
  prior={a['stem']:a for a in json.loads((ROOT/'site/assets/data/manifest.json').read_text())['assets']}
  for asset in items:
   if prior.get(asset['stem'],{}).get('renderCompatibility'):asset['renderCompatibility']=prior[asset['stem']]['renderCompatibility']
 if SAMPLE_MODE:
  OUT=ROOT.parents[1]/'outputs/print-samples';PREVIEW=OUT/'previews';SMALL_PREVIEW=OUT/'previews-small';OUT.mkdir(parents=True,exist_ok=True);PREVIEW.mkdir(exist_ok=True);SMALL_PREVIEW.mkdir(exist_ok=True);CACHE=CACHE/'samples';CACHE.mkdir(exist_ok=True)
  required={('monthly',2027,1,'06'),('monthly',2028,2,'02')}
  items=[e for e in items if e['kind']=='blank' or (e['kind'],e['year'],e['month'],e['design']) in required]
 elif args.phase_8_assets:
  if args.limit:raise SystemExit('--limit is not supported with --phase-8-assets')
  gate=json.loads((CACHE/'sample-gate.json').read_text()) if (CACHE/'sample-gate.json').exists() else {}
  if gate.get('generator')!=FINGERPRINT or gate.get('status')!='passed' or gate.get('visualReviewed') is not True:
   raise SystemExit('Phase 8 assets require the current 12-file sample set to pass automated preflight and visual review first.')
  existing=json.loads((ROOT/'site/assets/data/manifest.json').read_text())
  before=json.loads((ROOT/'docs/phase-5-6-8/ASSET-CHECKSUMS-BEFORE.json').read_text())
  for old in before['assets']:
   path=ROOT/'site'/old['path'].lstrip('/')
   if not path.is_file() or path.stat().st_size!=old['bytes'] or hashlib.sha256(path.read_bytes()).hexdigest()!=old['sha256']:
    raise SystemExit('Baseline print file changed before additive generation: '+old['path'])
  items=[e for e in items if (e['kind'] in ['monthly','annual'] and e['year']==2029) or e.get('category') in ['week','day','family','school','shift'] and int(e['design'])>=11]
  if len(items)!=140:raise SystemExit(f'Expected 140 additive assets, found {len(items)}')
 else:
  gate=json.loads((CACHE/'sample-gate.json').read_text()) if (CACHE/'sample-gate.json').exists() else {}
  if gate.get('generator')!=FINGERPRINT or gate.get('status')!='passed':raise SystemExit('Sample preflight and visual approval gate has not passed for this renderer. Run --samples and preflight first.')
 items=items[:args.limit] if args.limit else items
 with ThreadPoolExecutor(max_workers=args.workers) as pool:
  result=[]
  for i,e in enumerate(pool.map(generate,items),1):
   result.append(e)
   if i%10==0:print(f'Rendered {i}/{len(items)}',flush=True)
 if args.phase_8_assets:
  by_stem={e['stem']:e for e in existing['assets']}
  for e in result:
   if e['stem'] in by_stem:raise SystemExit('Additive print asset would overwrite an existing manifest entry: '+e['stem'])
   e['generator']=FINGERPRINT;by_stem[e['stem']]=e
  manifest={'schema':1,'generator':FINGERPRINT,'sourceReviewed':DATA['reviewed'],'assets':list(by_stem.values())}
 elif SAMPLE_MODE:manifest={'schema':1,'generator':FINGERPRINT,'sourceReviewed':DATA['reviewed'],'assets':result}
 else:manifest={'schema':1,'generator':FINGERPRINT,'sourceReviewed':DATA['reviewed'],'assets':result}
 (OUT/'manifest.json' if SAMPLE_MODE else ROOT/'site/assets/data/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 print(f"Completed {len(result)} PDF + {len(result)} WebP + {len(result)} thumbnails",flush=True)
