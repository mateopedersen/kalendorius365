"""Original vector landscapes and explanatory Earth illustrations. No stock/raster imagery."""
from pathlib import Path
import math,random
from html import escape
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'site/assets/visuals/seasons'
PALETTES={
 'spring':dict(name='Pavasaris',sky=('#7cabb8','#d8e5d6','#f6debc'),sun=(810,290),water=('#9bbab2','#4a7f85'),hill=('#90b3a4','#739b87','#416c58'),leaves=('#9bb679','#c4cf91','#6d9a6a','#e2dba2')),
 'summer':dict(name='Vasara',sky=('#6eabb6','#c4d8c5','#f6d69b'),sun=(850,200),water=('#d1c7a0','#648b89'),hill=('#9daf87','#6f9068','#4f7655'),leaves=('#527e4a','#749752','#8fae60','#c4bd72')),
 'autumn':dict(name='Ruduo',sky=('#829aab','#cfccc1','#e9bf99'),sun=(735,375),water=('#b9bab0','#6b878a'),hill=('#b3ab8f','#929a7b','#596e57'),leaves=('#b5793f','#d6a754','#a95436','#e2c178')),
 'winter':dict(name='Žiema',sky=('#738ba8','#b7c6d4','#e9ccd1'),sun=(790,399),water=('#b9ccd7','#688599'),hill=('#c7d5d9','#a9bdc8','#7992a1'),leaves=())
}
def f(n):return f'{n:.1f}'
def svg_document(title,desc,body,defs='',view='0 0 1200 800',width=1200,height=800):
 return f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="{view}" role="img" aria-labelledby="title description"><title id="title">{escape(title)}</title><desc id="description">{escape(desc)}</desc><defs>{defs}</defs>{body}</svg>\n'
def birch(x,y,h,season,seed):
 rng=random.Random(seed);parts=[];lean=rng.uniform(-22,20);top=y-h
 parts.append(f'<path d="M{x-7} {y}Q{x+lean*.4-2} {y-h*.5} {x+lean-2} {top}L{x+lean+3} {top}Q{x+lean*.4+8} {y-h*.5} {x+9} {y}Z" fill="url(#bark)"/>')
 for i in range(14):
  yy=y-h*(.03+i*.063);xx=x+lean*(y-yy)/h
  parts.append(f'<path d="M{f(xx-4)} {f(yy)}q{rng.randrange(5,13)} -2 {rng.randrange(7,14)} 0" stroke="#536160" stroke-width="{rng.uniform(.8,2):.1f}" opacity=".64" fill="none"/>')
 for k in range(10):
  frac=.3+k*.061;yy=y-h*frac;xx=x+lean*frac;side=-1 if k%2 else 1;span=h*(1-frac)*rng.uniform(.36,.55);endx=xx+side*span;endy=yy-h*rng.uniform(.09,.2)
  parts.append(f'<path d="M{f(xx)} {f(yy)}Q{f(xx+side*span*.6)} {f(yy-12)} {f(endx)} {f(endy)}m{f(-side*span*.22)} 7l{f(side*span*.12)} -24" stroke="#586253" stroke-width="{max(.7,(1-frac)*4):.1f}" fill="none" stroke-linecap="round"/>')
 if season!='winter':
  for k in range(19):
   yy=top+h*rng.uniform(.02,.54);xx=x+lean+(yy-top)/h*rng.uniform(-1,1)*h*.42+rng.uniform(-h*.12,h*.12);r=h*rng.uniform(.055,.12)
   pts=[]
   for a in range(13):
    ang=a*2*math.pi/13;rr=r*rng.uniform(.72,1.2);pts.append((xx+math.cos(ang)*rr,yy+math.sin(ang)*rr*.7))
   d='M'+'L'.join(f'{f(a)} {f(b)}'for a,b in pts)+'Z'
   parts.append(f'<path d="{d}" fill="{rng.choice(PALETTES[season]["leaves"])}" opacity="{rng.uniform(.73,.96):.2f}"/>')
  for i in range(70):
   xx=x+lean+rng.uniform(-h*.25,h*.25);yy=top+rng.uniform(0,h*.52)
   parts.append(f'<path d="M{f(xx)} {f(yy)}q3 -5 7 -1q-2 5 -7 1" fill="{rng.choice(PALETTES[season]["leaves"])}" opacity=".75"/>')
 return ''.join(parts)
def pine(x,y,h,snow=False,seed=1):
 rng=random.Random(seed);p=[f'<path d="M{x-3} {y}L{x-1} {y-h}L{x+2} {y}Z" fill="#566664"/>']
 for i in range(13):
  frac=i/13;yy=y-h+frac*h*.92;w=(frac*.42+.025)*h
  p.append(f'<path d="M{f(x)} {f(yy-h*.13)}Q{f(x-w*.2)} {f(yy)} {f(x-w)} {f(yy+h*.06)}L{f(x-w*.42)} {f(yy+h*.055)}L{f(x-w*.72)} {f(yy+h*.09)}Q{x} {f(yy+h*.12)} {f(x+w)} {f(yy+h*.06)}Q{f(x+w*.3)} {f(yy)} {x} {f(yy-h*.13)}Z" fill="{["#42655e","#496f63","#547a68"][i%3]}"/>')
  if snow:
   p.append(f'<path d="M{f(x-w*.82)} {f(yy+h*.055)}Q{x} {f(yy+h*.005)} {f(x+w*.77)} {f(yy+h*.055)}Q{x} {f(yy+h*.04)} {f(x-w*.82)} {f(yy+h*.055)}Z" fill="#e1e7e7" opacity=".9"/>')
 return ''.join(p)
def landscape(season):
 p=PALETTES[season];rng=random.Random(411+list(PALETTES).index(season));sx,sy=p['sun'];winter=season=='winter'
 defs=f'''<linearGradient id="sky" x2=".1" y2="1"><stop stop-color="{p['sky'][0]}"/><stop offset=".65" stop-color="{p['sky'][1]}"/><stop offset="1" stop-color="{p['sky'][2]}"/></linearGradient><radialGradient id="air"><stop stop-color="#fff2ce" stop-opacity=".8"/><stop offset=".26" stop-color="#fbe4bd" stop-opacity=".32"/><stop offset="1" stop-color="#f4dcc4" stop-opacity="0"/></radialGradient><radialGradient id="sun"><stop stop-color="#fff9dd"/><stop offset=".76" stop-color="#ffeab9"/><stop offset="1" stop-color="#f0ce95"/></radialGradient><linearGradient id="water" x2=".2" y2="1"><stop stop-color="{p['water'][0]}"/><stop offset="1" stop-color="{p['water'][1]}"/></linearGradient><linearGradient id="bark"><stop stop-color="#e4e7d7"/><stop offset=".55" stop-color="#f2eddd"/><stop offset="1" stop-color="#a9b5a2"/></linearGradient><linearGradient id="ground" x2="0" y2="1"><stop stop-color="{'#e5e9e6'if winter else '#728664'}"/><stop offset="1" stop-color="{'#b8ccd4'if winter else '#344f44'}"/></linearGradient><clipPath id="frame"><rect width="1200" height="800" rx="28"/></clipPath>'''
 b=[f'<g clip-path="url(#frame)"><rect width="1200" height="800" fill="url(#sky)"/><ellipse cx="{sx}" cy="{sy}" rx="460" ry="330" fill="url(#air)"/><circle cx="{sx}" cy="{sy}" r="{32 if winter else 43}" fill="url(#sun)"/>']
 # Thin, layered cloud edges create depth without filters or embedded images.
 for i in range(12):
  yy=95+i*26+rng.uniform(-10,10);xx=rng.uniform(-180,1000);w=rng.uniform(140,430)
  b.append(f'<path d="M{f(xx)} {f(yy)}q{f(w*.35)} -10 {f(w)} 0q{f(-w*.48)} 9 {-w} 0" fill="#f4f2e4" opacity="{rng.uniform(.06,.19):.2f}"/>')
 for i,c in enumerate(p['hill']):
  y=380+i*39;b.append(f'<path d="M-20 {y+35}Q160 {y-45} 320 {y+5}T650 {y-3}T940 {y+8}T1220 {y-12}V800H-20Z" fill="{c}" opacity="{.6+i*.18}"/>')
 b.append('<path d="M0 474Q250 438 430 473T820 471T1200 458V800H0Z" fill="url(#water)"/>')
 for i in range(84):
  yy=484+i*3.7;distance=abs(yy-640);xx=sx+rng.uniform(-1,1)*(35+(yy-480)*.6);length=rng.uniform(12,70)*(1+(yy-480)/240)
  b.append(f'<path d="M{f(xx-length/2)} {f(yy)}h{f(length)}" stroke="{rng.choice(["#e8e3ce","#bfcbbd","#f0d6ac"])}" stroke-width="{rng.uniform(.5,1.7):.1f}" opacity="{rng.uniform(.12,.4):.2f}"/>')
 # Shoreline perspective differs in each landscape.
 if season=='spring':shore='M-20 565Q150 561 285 634T675 800H-20Z'
 elif season=='summer':shore='M-20 625Q205 657 459 705T1020 800H-20Z'
 elif season=='autumn':shore='M-20 532Q175 550 325 671T820 800H-20Z'
 else:shore='M-20 588Q240 536 402 682T910 800H-20Z'
 b.append(f'<path d="{shore}" fill="url(#ground)"/>')
 b.append(f'<path d="M1200 604Q1104 543 1002 581T800 650Q1060 687 1200 710Z" fill="{p["hill"][2]}" opacity=".92"/>')
 if winter:
  b.extend([pine(155,643,387,True,11),pine(72,654,291,True,3),pine(1110,599,212,True,4)])
  b.append('<path d="M-10 599Q180 544 315 629T572 761Q218 721 -10 708Z" fill="#e7ece9"/><path d="M620 633l55 -18 86 11 43 -19 121 8m-165 11l55 24 77 -9" stroke="#7799aa" stroke-width="1.2" opacity=".4" fill="none"/>')
  for i in range(10):
   x=246+i*21;y=713+i*6;b.append(f'<ellipse cx="{x}" cy="{y}" rx="{3+i*.2}" ry="2" fill="#9bafb8" opacity=".35"/>')
 elif season=='summer':
  b.extend([pine(1090,600,225,False,2),birch(110,678,356,season,12)])
  for i in range(82):
   x=rng.uniform(5,640);y=rng.uniform(712,827);h=rng.uniform(25,120)
   b.append(f'<path d="M{f(x)} {f(y)}q8 {f(-h*.5)} {f(h*.2)} {-h:.1f}" stroke="#b9ac69" stroke-width="1.5" fill="none"/><path d="M{f(x+h*.2)} {f(y-h+14)}l-5 -6m7 1l7 -7m-9 1l-5 -6m7 1l7 -7" stroke="#d4c17d" stroke-width="2" stroke-linecap="round"/>')
 elif season=='autumn':
  b.extend([birch(130,665,429,season,9),birch(238,711,352,season,39),birch(1085,596,242,season,5)])
  for i in range(74):
   x=rng.uniform(0,720);y=rng.uniform(678,820);angle=rng.uniform(-80,80)
   b.append(f'<path d="M-4 0q4 -8 10 -3q-1 7 -10 3" fill="{rng.choice(p["leaves"])}" transform="translate({f(x)} {f(y)})rotate({f(angle)})" opacity=".78"/>')
 else:
  b.extend([birch(153,653,400,season,51),birch(1060,586,233,season,19)])
  for i in range(53):
   x=rng.uniform(0,500);y=rng.uniform(645,815);h=rng.uniform(16,66)
   b.append(f'<path d="M{f(x)} {f(y)}q-3 {f(-h*.4)} 3 {-h:.1f}" stroke="#8fa985" stroke-width="1.2" fill="none"/><circle cx="{f(x+3)}" cy="{f(y-h)}" r="{rng.uniform(1.7,3):.1f}" fill="{rng.choice(["#e8e2bf","#e6d3aa","#d2d9af"])}"/>')
 for i in range(3):
  y=469+i*11;b.append(f'<path d="M330 {y}Q620 {y-15} 1120 {y+3}Q730 {y+10} 330 {y}" fill="#f1eee1" opacity="{.10-i*.02}"/>')
 b.append('</g>')
 description={'spring':'Skaidrus pavasario ežeras, švelni saulės šviesa, sprogstantys beržai ir pirmieji pievos žiedai.','summer':'Šviesus vasaros ežeras, aukšta saulė, subrendusi pieva ir sodrūs medžiai.','autumn':'Rudeninis ežeras, vario ir aukso spalvų beržai, žema saulė ir plonas rūkas virš vandens.','winter':'Žiemos ežeras, apsnigtos pušys, blyški žema saulė ir melsvi sniego šešėliai.'}[season]
 return svg_document(p['name']+' Lietuvoje – metų laiko iliustracija',description,''.join(b),defs)

def earth(season):
 # View rotates around the orbit so sunlight always comes from the left.
 # Equinox tilt projects out of the image plane; the actual axial obliquity is unchanged.
 tilt={'spring':0,'summer':-23.44,'autumn':0,'winter':23.44}[season]
 cap={'spring':1,'summer':0,'autumn':-1,'winter':0}[season]
 defs='''<radialGradient id="ocean" cx=".28" cy=".3" r=".8"><stop stop-color="#64b5c2"/><stop offset=".5" stop-color="#266c88"/><stop offset="1" stop-color="#113950"/></radialGradient><linearGradient id="land" x2=".8" y2="1"><stop stop-color="#adc5a1"/><stop offset=".5" stop-color="#6d9b86"/><stop offset="1" stop-color="#3f776c"/></linearGradient><radialGradient id="atmosphere"><stop offset=".8" stop-color="#93cdd3" stop-opacity="0"/><stop offset=".91" stop-color="#93cdd3" stop-opacity=".22"/><stop offset="1" stop-color="#93cdd3" stop-opacity="0"/></radialGradient><linearGradient id="night"><stop offset=".46" stop-color="#061827" stop-opacity="0"/><stop offset=".52" stop-color="#061827" stop-opacity=".56"/><stop offset="1" stop-color="#061827" stop-opacity=".86"/></linearGradient><linearGradient id="beam"><stop stop-color="#dbb85e" stop-opacity=".14"/><stop offset="1" stop-color="#e9ca75" stop-opacity=".7"/></linearGradient><clipPath id="globe"><circle cx="250" cy="230" r="147"/></clipPath>'''
 b=['<rect width="500" height="460" fill="#f8faf8"/>','<circle cx="250" cy="230" r="172" fill="url(#atmosphere)"/>']
 for y in [145,188,230,272,315]:b.append(f'<path d="M12 {y}H96m-9 -5l9 5 -9 5" stroke="url(#beam)" stroke-width="2" fill="none"/>')
 b.append('<circle cx="250" cy="230" r="147" fill="url(#ocean)"/>')
 b.append(f'<g clip-path="url(#globe)"><g transform="rotate({tilt} 250 230)">')
 b.append('<path d="M124 155l29 -24 25 7 13 -16 25 11 8 26 24 -5 11 17 -15 20 19 12 28 -13 17 14 -8 23 -30 1 -16 16 -3 31 -19 25 -20 -3 -17 -37 -18 -15 -7 -30 -21 -2 -12 -20 -19 1 -6 -25Zm144 -30l23 -9 31 13 17 -4 30 31 9 24 -18 18 -23 -1 -8 18 -20 -7 -11 -26 -22 -7 2 -22 -15 -13Zm64 152l15 -8 24 11 -1 20 -25 7 -20 -14Z" fill="url(#land)" opacity=".95"/>')
 b.append('<path d="M174 160l19 8m68 47l17 18m40 -79l22 18" stroke="#d2d2b1" stroke-width="5" opacity=".45" fill="none"/>')
 for y in [-90,-55,0,55,90]:
  width=math.sqrt(147*147-y*y);rise=cap*math.sqrt(max(0,147*147-y*y))*.27
  b.append(f'<path d="M{f(250-width)} {230+y}Q250 {f(230+y+rise)} {f(250+width)} {230+y}" fill="none" stroke="#d2e8e4" stroke-width="{1.5 if y==0 else .75}" opacity="{.7 if y==0 else .35}"/>')
 for rx in [42,91,128]:b.append(f'<ellipse cx="250" cy="230" rx="{rx}" ry="147" fill="none" stroke="#c8e0df" stroke-width=".7" opacity=".24"/>')
 b.append('<path d="M123 184q52 -25 103 -5m21 128q52 14 93 -13M168 120q44 -12 80 2" stroke="#e2efeb" stroke-width="9" opacity=".22" fill="none" stroke-linecap="round"/>')
 b.append('</g><rect x="103" y="83" width="294" height="294" fill="url(#night)"/></g>')
 x=math.sin(math.radians(tilt))*190;yy=math.cos(math.radians(tilt))*190
 b.append(f'<path d="M{f(250-x)} {f(230+yy)}L{f(250+x)} {f(230-yy)}" stroke="#63837e" stroke-width="2" stroke-dasharray="5 5"/><circle cx="{f(250+x)}" cy="{f(230-yy)}" r="5" fill="#c19b50"/><circle cx="250" cy="230" r="147" fill="none" stroke="#8bc3c9" stroke-width="1" opacity=".65"/>')
 title={'spring':'Žemės apšvietimas per pavasario lygiadienį','summer':'Šiaurės pusrutulis atsuktas į Saulę per vasaros saulėgrįžą','autumn':'Žemės apšvietimas per rudens lygiadienį','winter':'Šiaurės pusrutulis nusigręžęs nuo Saulės per žiemos saulėgrįžą'}[season]
 return svg_document(title,'Saulės šviesa krinta iš kairės. Žemės ašies pasvirimas nekinta; vaizdas pasuktas pagal pasirinktą metų ciklo momentą. Mastelis ir žemynų kontūrai apibendrinti.',''.join(b),defs,'0 0 500 460',500,460)

def orbit(active=0):
 # Orthographic view of a circular schematic orbit. All four axes are parallel.
 positions=[(360,95),(95,245),(360,395),(625,245)];names=['Pavasaris','Vasara','Ruduo','Žiema']
 defs='''<radialGradient id="sp3-sun"><stop stop-color="#fff5ca"/><stop offset=".67" stop-color="#f4d485"/><stop offset="1" stop-color="#d59d40"/></radialGradient><radialGradient id="sp3-corona"><stop stop-color="#f6d69b" stop-opacity=".35"/><stop offset="1" stop-color="#f6d69b" stop-opacity="0"/></radialGradient><radialGradient id="sp3-blue"><stop stop-color="#82c0c8"/><stop offset="1" stop-color="#28617b"/></radialGradient>'''
 b=['<ellipse cx="360" cy="245" rx="265" ry="150" fill="none" stroke="#b9c9c6" stroke-width="1.5" stroke-dasharray="3 6"/><path d="M183 134l-2 14 14 -5M538 356l2 -14 -14 5" fill="none" stroke="#899f99" stroke-width="1.5"/><circle cx="360" cy="245" r="109" fill="url(#sp3-corona)"/><circle cx="360" cy="245" r="51" fill="url(#sp3-sun)"/><circle cx="360" cy="245" r="58" fill="none" stroke="#dab46c" opacity=".35"/>']
 for i,((x,y),name)in enumerate(zip(positions,names)):
  b.append(f'<g class="sp3-orbit-stop {"is-active" if i==active else ""}" data-orbit-index="{i}"><circle class="sp3-orbit-ring" cx="{x}" cy="{y}" r="44" fill="none" stroke="currentColor" stroke-width="2"/><path d="M{x+18} {y-39}l-36 78" stroke="#587770" stroke-width="2"/><circle cx="{x}" cy="{y}" r="28" fill="url(#sp3-blue)"/><path d="M{x-19} {y-10}l13 -10 11 6 2 10 10 8 -5 13 -9 4 -8 -17 -13 -3Z" fill="#a4bba0"/><path d="M{x-12} {y+22}q20 -8 34 -23" stroke="#cee4df" opacity=".45" stroke-width="1" fill="none"/><circle cx="{x}" cy="{y}" r="28" fill="none" stroke="#4f7e8c"/></g>')
 return f'<svg class="sp3-orbit" viewBox="0 0 720 490" role="img" aria-labelledby="sp3-orbit-title sp3-orbit-desc"><title id="sp3-orbit-title">Keturi astronominių metų laikų lūžiai</title><desc id="sp3-orbit-desc">Saulė centre, keturios Žemės padėtys aplink ją. Visose padėtyse ašies kryptis lygiagreti. Orbita parodyta perspektyvoje, dydžiai ir atstumai nėra to paties mastelio.</desc><defs>{defs}</defs>{"".join(b)}</svg>'

def controls():
 symbols={
  'calendar':'<rect x="4" y="5" width="16" height="16" rx="3" fill="#e7f1eb"/><path d="M4 10h16M8 3v5m8-5v5"/><path d="M8 14h2m4 0h2m-8 4h2m4 0h2"/>',
  'clock':'<circle cx="12" cy="13" r="8" fill="#f3ecdc"/><path d="M12 8v5l3 2M9 2h6m-3 0v3"/>',
  'sunrise':'<path d="M3 19h18M5 15a7 7 0 0 1 14 0"/><path d="M12 13V3m-3 3 3-3 3 3M3 10l2 1m14 0 2-1"/><path d="M6 17h12" stroke="#d0a653"/>',
  'sunset':'<path d="M3 19h18M5 15a7 7 0 0 1 14 0"/><path d="M12 3v10m-3-3 3 3 3-3M3 10l2 1m14 0 2-1"/><path d="M6 17h12" stroke="#d0a653"/>',
  'daylight':'<circle cx="12" cy="12" r="5" fill="#f3d891"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  'download':'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
  'arrow':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  'orbit':'<ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-28 12 12)"/><circle cx="12" cy="12" r="3" fill="#f1d08c"/><circle cx="20" cy="7" r="2" fill="#83b3bb"/>',
  'tradition':'<path d="M5 21h14M8 21V10l4-5 4 5v11M5 14h14M12 10v5m-2-3h4"/><path d="M12 2v3" stroke="#c6a25b"/>',
  'play':'<path d="M8 4l13 8L8 20Z" fill="currentColor" stroke="none"/>',
  'pause':'<path d="M8 5v14M16 5v14" stroke-width="4"/>',
  'previous':'<path d="M20 12H4m6-6-6 6 6 6"/>',
  'year':'<rect x="4" y="5" width="16" height="16" rx="3" fill="#edf2ed"/><path d="M4 10h16M8 3v5m8-5v5m-8 7h3m3 0h3m-9 3h3"/>'
 }
 return '<svg xmlns="http://www.w3.org/2000/svg">'+''.join(f'<symbol id="{k}" viewBox="0 0 24 24"><g stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{v}</g></symbol>'for k,v in symbols.items())+'</svg>\n'
def run():
 OUT.mkdir(parents=True,exist_ok=True)
 for season in PALETTES:
  (OUT/f'{season}-landscape.svg').write_text(landscape(season));(OUT/f'{season}-earth.svg').write_text(earth(season))
 (OUT/'controls.svg').write_text(controls())
if __name__=='__main__':run()
