from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
import xml.etree.ElementTree as ET,calendar
R=Path.cwd(); fonts={w:TTFont(R/f'design/source/lato/Lato-{w}.ttf') for w in ['Regular','Bold','Black']}
parts=['<svg xmlns="http://www.w3.org/2000/svg" width="3840" height="2160" viewBox="0 0 3840 2160"><title>Kalendorius365 — Lato design system, native vector master</title><rect width="3840" height="2160" fill="#f4f7fa"/>']
def rect(x,y,w,h,fill='#fff',stroke='#e1e7ee',rx=28):parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
def text(s,x,y,size=32,color='#111b2e',weight='Regular'):
 f=fonts[weight];gs=f.getGlyphSet();cmap=f.getBestCmap();scale=size/f['head'].unitsPerEm
 for c in s:
  name=cmap.get(ord(c));
  if not name:continue
  pen=SVGPathPen(gs);gs[name].draw(pen)
  parts.append(f'<path fill="{color}" transform="translate({x:.3f} {y}) scale({scale} {-scale})" d="{pen.getCommands()}"/>');x+=gs[name].width*scale
 return x

def svg(path,x,y,w,h):
 root=ET.fromstring(Path(path).read_text());vb=root.attrib['viewBox'];content=''.join(ET.tostring(e,encoding='unicode') for e in root)
 parts.append(f'<svg x="{x}" y="{y}" width="{w}" height="{h}" viewBox="{vb}">{content}</svg>')

def icon(n,x,y,size=48,color='#006a44'):
 root=ET.fromstring((R/f'design/source/icons/{n}.svg').read_text());inside=''.join(ET.tostring(e,encoding='unicode') for e in root);parts.append(f'<g transform="translate({x} {y}) scale({size/24})" fill="none" stroke="{color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{inside}</g>')
def button(label,x,y,w=340,fill='#006a44',color='#fff',symbol=None):
 rect(x,y,w,84,fill,fill if fill!='#fff' else '#d6dfe8',14)
 if symbol:icon(symbol,x+25,y+24,36,color)
 text(label,x+(79 if symbol else 30),y+54,30,color,'Bold')
svg(R/'site/assets/visuals/logo-light.svg',120,95,730,126)
text('LAIKAS JŪSŲ PLANAMS.',120,345,103,weight='Black')
text('Lietuviškas kalendorius. Aiškumas kasdienai.',125,416,41,'#5c6980')
text('LATO  /  REGULAR 400  ·  BOLD 700  ·  BLACK 900',125,495,27,'#006a44','Bold')
text('Ą Č Ę Ė Į Š Ų Ū Ž  ·  ą č ę ė į š ų ū ž  ·  2027 / 2028',125,558,39)
# Palette with actual implementation tokens.
text('01 / SPALVŲ SISTEMA',2080,150,30,'#5c6980','Bold')
colors=[('#006A44','Lietuvos žalia'),('#FDB913','Gintaro akcentas'),('#C1272D','Šventinės datos'),('#111B2E','Tekstas'),('#5C6980','Antrinis tekstas'),('#E1E7EE','Linijos')]
for i,(c,label) in enumerate(colors):
 x=2080+(i%3)*540;y=205+(i//3)*180;rect(x,y,480,94,c,c,18);text(label,x,y+135,28);text(c,x+297,y+135,23,'#5c6980')
# Real component family.
rect(120,660,1720,640);text('02 / VEIKSMAI IR BŪSENOS',175,737,30,'#5c6980','Bold')
button('Pridėti įvykį',175,786,385,symbol='plus');button('Atsisiųsti PDF',590,786,440,symbol='download');button('Spausdinti',1060,786,335,'#fff','#111b2e','print')
button('Atšaukti',175,910,300,'#fff','#111b2e');button('Ištrinti',505,910,270,'#fff4f4','#c1272d','close');button('Išsaugota',805,910,345,'#edf7f2','#006a44','check');button('Redaguoti',1180,910,355,'#fff','#006a44','edit')
for i,(name,on) in enumerate([('Visi įvykiai',True),('Šventės',False),('Darbas',False),('Asmeniniai',False)]):
 x=175+i*355;rect(x,1055,325,67,'#edf7f2' if on else '#fff','#8fbcaa' if on else '#e1e7ee',34);text(name,x+32,1098,28,'#006a44' if on else '#111b2e','Bold' if on else 'Regular')
for i,name in enumerate(['Mėnuo','Savaitė','Diena','Darbotvarkė']):
 x=175+i*355;rect(x,1162,355,77,'#006a44' if i==0 else '#fff','#e1e7ee',0);text(name,x+32,1213,28,'#fff' if i==0 else '#111b2e','Bold' if i==0 else 'Regular')
rect(1900,660,1820,640);text('03 / VIENA IKONŲ ŠEIMA',1960,737,30,'#5c6980','Bold')
icons=['calendar','year','gift','clock','briefcase','print','pdf','image','note','tasks','search','filter','settings','download','upload','share','pin','shield','book','palette','sun','cloud','wind','drop']
for i,name in enumerate(icons):
 x=1990+(i%8)*210;y=802+(i//8)*152;icon(name,x+20,y,56);text(name,x,y+96,21,'#5c6980')
text('24 × 24  ·  1.7 px  ·  suapvalinti galai  ·  SVG',1960,1253,24,'#006a44')
# Valid date grid, not a screenshot or data reference.
rect(120,1360,1030,660);text('2027 m. sausis',175,1445,48,weight='Black');text('ISO savaitės · pirmadienio pradžia',175,1490,25,'#5c6980')
weekdays=['Pr','An','Tr','Kt','Pn','Št','Sk']
for i,d in enumerate(weekdays):text(d,210+i*128,1550,27,'#c1272d' if i>4 else '#5c6980')
for row,week in enumerate(calendar.Calendar(0).monthdayscalendar(2027,1)):
 for col,day in enumerate(week):
  if not day:continue
  x=190+col*128;y=1580+row*71
  if day==1:rect(x-10,y-27,90,57,'#fff0f1','#fff0f1',8)
  text(str(day),x+20,y+13,32,'#c1272d' if col>4 or day==1 else '#111b2e','Bold')
text('Sausio 1 d.  ·  Naujųjų metų diena',175,1980,26,'#c1272d')
rect(1210,1360,1150,660);text('04 / RAMŪS TUŠTI VAIZDAI',1265,1445,30,'#5c6980','Bold');svg(R/'site/assets/visuals/empty-calendar.svg',1570,1480,380,253);text('Vieta svarbiausiems planams.',1310,1815,48,weight='Black');text('Aiški būsena, vienas prasmingas veiksmas.',1310,1875,29,'#5c6980');button('Pridėti įvykį',1530,1910,390,symbol='plus')
rect(2420,1360,1300,660);text('05 / ORAI IR LIETUVIŠKAS MOTYVAS',2475,1445,30,'#5c6980','Bold')
for i,weather in enumerate(['sun','cloud','rain','snow','fog']):svg(R/f'site/assets/visuals/weather-{weather}.svg',2480+i*235,1500,195,175)
svg(R/'site/assets/visuals/woven-ribbon.svg',2470,1730,1200,70)
text('Atmosfera, paremta tikrais orų duomenimis.',2475,1880,35,weight='Bold');text('Originalūs SVG ir optimizuoti WebP vaizdai.',2475,1940,29,'#5c6980')
text('Kalendorius365.lt   /   Design system v2   /   Native vector master · 3840 × 2160',120,2100,27,'#5c6980');text('2026 · 10',3500,2100,27,'#006a44','Bold')
parts.append('</svg>');(R/'design/masters/brand-ui-system-4k.svg').write_text(''.join(parts))
print('Native 3840 × 2160 SVG board; all typography converted to Lato outlines.')
