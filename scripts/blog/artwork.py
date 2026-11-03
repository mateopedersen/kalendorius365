#!/usr/bin/env python3
"""Twenty original vector compositions, with no remote image dependencies."""
from pathlib import Path
import html,json
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'site/assets/blog';OUT.mkdir(parents=True,exist_ok=True)
GREEN='#006a44';RED='#c1272d';GOLD='#edb72d';INK='#20322a'
def rect(x,y,w,h,fill,rx=12,**a):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" rx="{rx}" '+ ' '.join(f'{k.replace("_","-")}="{v}"'for k,v in a.items())+'/>'
def calendar(x,y,w=420,h=390,highlight=(),color=GREEN,blank=False):
 s=rect(x+12,y+18,w,h,'#183c2a',fill_opacity='.1')+rect(x,y,w,h,'#fff',22)+rect(x,y,w,65,color,22)+rect(x,y+36,w,29,color,0)
 for bx in [x+70,x+w-70]:s+=rect(bx-7,y-15,14,44,INK,7)
 for r in range(5):
  for c in range(7):
   xx=x+25+c*(w-50)/7;yy=y+100+r*(h-115)/5;k=r*7+c+1
   if k in highlight:s+=rect(xx-6,yy-18,(w-50)/7-5,44,GOLD,7)
   if blank:s+=rect(xx,yy-8,24,4,'#d2ded7',2)
   elif k<=31:s+=f'<text x="{xx+12}" y="{yy+10}" text-anchor="middle" fill="{RED if c==6 else INK}" font-family="Arial,sans-serif" font-size="22">{k}</text>'
 return s
def card(x,y,w=260,h=160,color=GOLD,lines=3):
 s=rect(x+8,y+12,w,h,INK,fill_opacity='.08')+rect(x,y,w,h,'white')+rect(x,y,10,h,color,4)
 for i in range(lines):s+=rect(x+30,y+30+i*30,w-70-(i%2)*30,8,'#c7d5ce',4)
 return s
def clock(x,y,r=75):return f'<circle cx="{x}" cy="{y}" r="{r}" fill="white" stroke="{GREEN}" stroke-width="12"/><path d="M{x} {y-r+22}V{y}l{r//2} 24" stroke="{INK}" stroke-width="10" stroke-linecap="round" fill="none"/>'
def moon(x,y,r=44,kind=0):
 s=f'<circle cx="{x}" cy="{y}" r="{r}" fill="#314e44"/>'
 if kind==2:s+=f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff6d5"/>'
 if kind in (1,3):s+=f'<path d="M{x} {y-r}a{r} {r} 0 0 {1 if kind==1 else 0} 0 {2*r}Z" fill="#fff6d5"/>'
 return s
blocks=(ROOT/'data/blog/articles.txt').read_text().split('\n@@ ')[1:]
for i,b in enumerate(blocks):
 meta=b.split('\n## ',1)[0].splitlines();slug=meta[0];alt=next(s[11:]for s in meta if s.startswith('image_alt: '));s=''
 if i==0:s=calendar(150,130,highlight=(4,14,26))+card(660,220,330,210)+f'<path d="M720 465l90-75" stroke="{RED}" stroke-width="24" stroke-linecap="round"/>'
 elif i==1:s=rect(180,200,430,240,GREEN,26)+rect(220,155,350,165,'#dce8df')+rect(225,340,340,205,'white')+card(700,190,290,240)+rect(490,250,45,12,GOLD,6)
 elif i==2:s=calendar(110,145,420,350,(28,29,30,31))+calendar(650,145,420,350,(1,2,3))+f'<path d="M170 500H1010" stroke="{RED}" stroke-width="12" stroke-linecap="round"/>'
 elif i==3:s=calendar(170,130,highlight=(29,))+rect(720,220,180,210,GOLD,24)+f'<text x="810" y="362" text-anchor="middle" font-family="Arial,sans-serif" font-size="114" fill="{INK}" font-weight="bold">29</text>'
 elif i==4:
  for row in range(2):
   for c in range(7):s+=rect(160+c*125,200+row*135,100,100,GREEN if (row==0 or c<5) else '#dce8df',14)
  s+=f'<path d="M185 485H1015" stroke="{RED}" stroke-width="10" stroke-linecap="round"/>'
 elif i==5:s=calendar(130,140,highlight=(1,11,16))+card(670,140,300,120,RED,2)+card(670,290,300,120,GOLD,2)+card(670,440,300,100,GREEN,1)
 elif i==6:s=calendar(130,140,430,360,blank=True)+card(660,130,350,170,GREEN)+card(660,330,350,170,RED)+f'<path d="M700 180l15 15 35-40" fill="none" stroke="{GREEN}" stroke-width="10" stroke-linecap="round"/>'
 elif i==7:
  for c in range(4):
   s+=rect(150+c*225,150,200,365,'white',18)+rect(150+c*225,150,200,40,[GREEN,RED,GOLD,'#6c879b'][c],18)
   for r in range(3):s+=rect(170+c*225,225+r*80,160,45,'#e8f3ed' if r!=c%3 else '#f9e5bf',8)
 elif i==8:s=calendar(110,130,360,340)+rect(600,220,380,270,GREEN,24)+rect(640,170,190,80,GREEN)+rect(655,280,265,130,'#e8f3ed')+f'<path d="M520 255h70m-25-25 25 25-25 25" fill="none" stroke="{RED}" stroke-width="14" stroke-linecap="round"/>'
 elif i==9:s=calendar(375,135,400,360)+clock(180,350)+clock(1000,350)+f'<path d="M280 350h70m500 0h70" stroke="{RED}" stroke-width="12"/>'
 elif i==10:
  for c in range(3):s+=calendar(70+c*355,150,315,330,blank=True,color=[GREEN,RED,'#96712d'][c])
 elif i==11:s=calendar(140,135,highlight=(1,2,5,6,9,10))+clock(850,240)+moon(850,450,60,3)
 elif i==12:s=calendar(110,135,highlight=(12,13,14,15,16))+rect(700,200,270,290,GREEN,40)+rect(725,240,220,130,'#d9e8e0',20)+f'<path d="M740 520v-90m190 90v-90" stroke="{INK}" stroke-width="18"/>'
 elif i==13:
  for c in range(4):s+=rect(160+c*225,220,190,220,GOLD if c==1 else GREEN,18)
  s+=f'<path d="M220 500H980" stroke="{RED}" stroke-width="12" stroke-linecap="round"/>'
 elif i==14:
  s+=f'<path d="M230 300H970" stroke="{GREEN}" stroke-width="12"/><path d="M230 440H970M230 415v50m740-50v50" stroke="{RED}" stroke-width="10" fill="none"/>'
  for k in range(3):
   x=230+k*370;s+=f'<circle cx="{x}" cy="300" r="75" fill="{GOLD if k in (0,2) else GREEN}"/><text x="{x}" y="320" text-anchor="middle" font-family="Arial,sans-serif" font-size="64" fill="white">{k+1}</text>'
 elif i==15:s=calendar(70,150,500,350,blank=True)+calendar(660,130,420,390,highlight=(7,14,21))
 elif i==16:
  s=calendar(370,240,450,280,blank=True)
  for k in range(4):s+=moon(270+k*220,155,57,k)
 elif i==17:
  for k,col in enumerate([GREEN,GOLD,RED,'#5d86a1']):s+=f'<circle cx="{255+(k%2)*690}" cy="{200+(k//2)*250}" r="90" fill="{col}" fill-opacity=".2"/>'
  s+=f'<path d="M600 500V195m0 120-140-100m140 150 140-120" fill="none" stroke="{INK}" stroke-width="22" stroke-linecap="round"/>'
  for x,y,col in [(470,200,GREEN),(740,230,GOLD),(550,160,RED),(650,130,'#5d86a1')]:s+=f'<circle cx="{x}" cy="{y}" r="65" fill="{col}"/>'
 elif i==18:
  s+=f'<path d="M130 420H1070M230 420a370 280 0 0 1 740 0" stroke="{GREEN}" stroke-width="10" fill="none" stroke-dasharray="12 12"/><circle cx="600" cy="180" r="74" fill="{GOLD}"/>'
  for k,h in enumerate([90,150,110,170,90]):s+=rect(360+k*95,420-h,70,h,'#c7d9cf',0)
  s+=card(395,465,410,80,RED,1)
 elif i==19:
  s=card(230,125,740,140,GREEN,2)+card(230,300,330,150,RED,2)+card(640,300,330,150,GOLD,2)
  s+=f'<path d="M280 175l15 15 35-40" fill="none" stroke="{GREEN}" stroke-width="10" stroke-linecap="round"/>'
 background=rect(0,0,1200,630,'#f1f6f2',0)+f'<circle cx="1110" cy="50" r="280" fill="#f6e3a1" fill-opacity=".35"/><circle cx="40" cy="650" r="260" fill="#006a44" fill-opacity=".07"/>'
 (OUT/f'{slug}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" role="img"><title>{html.escape(alt)}</title>{background}{s}</svg>\n')
print(json.dumps({'original_svg_illustrations':len(blocks)}))
