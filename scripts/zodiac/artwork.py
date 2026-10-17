"""Original zodiac reliefs, drawn as paths for Kalendorius365. No stock artwork.

The figures are symbolic illustrations, never maps of real constellations.
Rebuild: PYTHONPATH=/private/tmp/k365-lunar-deps python scripts/zodiac/artwork.py
"""
from pathlib import Path
from html import escape
import json, math
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'site/assets/visuals/zodiac'
PROFILES = json.loads((ROOT / 'site/_data/zodiac_profiles.json').read_text())
NAMES = {s['key']:s['name'] for s in json.loads((ROOT/'site/_data/horoscope_signs.json').read_text())}
GOLD = 'url(#zg-gold)'; IVORY = 'url(#zg-ivory)'; TEAL = 'url(#zg-teal)'; SILVER = 'url(#zg-silver)'

def path(d, fill='none', stroke=None, width=1, extra=''):
    return f'<path d="{d}" fill="{fill}"'+(f' stroke="{stroke}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"' if stroke else '')+f' {extra}/>'
def ellipse(x,y,rx,ry,fill,extra=''):
    return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" {extra}/>'
def group(body,transform=''):
    return f'<g transform="{transform}">{body}</g>'

DEFS='''<linearGradient id="zg-gold" x1=".15" y1="0" x2=".85" y2="1"><stop stop-color="#fff5cc"/><stop offset=".22" stop-color="#daba75"/><stop offset=".45" stop-color="#f3dc9f"/><stop offset=".66" stop-color="#ad7c36"/><stop offset=".85" stop-color="#d3ac66"/><stop offset="1" stop-color="#775626"/></linearGradient>
<linearGradient id="zg-ivory" x1=".15" y1=".1" x2=".85" y2="1"><stop stop-color="#fff9e9"/><stop offset=".38" stop-color="#eee2c2"/><stop offset=".7" stop-color="#c9b894"/><stop offset="1" stop-color="#938365"/></linearGradient>
<linearGradient id="zg-silver" x1=".12" y1=".1" x2=".9" y2=".8"><stop stop-color="#f3f6ef"/><stop offset=".35" stop-color="#bdcfcc"/><stop offset=".58" stop-color="#dce6dc"/><stop offset="1" stop-color="#577986"/></linearGradient>
<linearGradient id="zg-teal" x1=".12" y1="0" x2="1" y2="1"><stop stop-color="#9ccbc1"/><stop offset=".3" stop-color="#518f84"/><stop offset=".65" stop-color="#275d60"/><stop offset="1" stop-color="#143c45"/></linearGradient>
<radialGradient id="zg-fire" cx=".31" cy=".22" r=".85"><stop stop-color="#a77354"/><stop offset=".5" stop-color="#6c423d"/><stop offset="1" stop-color="#292b38"/></radialGradient>
<radialGradient id="zg-earth" cx=".31" cy=".22" r=".85"><stop stop-color="#7e9373"/><stop offset=".5" stop-color="#3e6555"/><stop offset="1" stop-color="#163e3e"/></radialGradient>
<radialGradient id="zg-air" cx=".3" cy=".2" r=".85"><stop stop-color="#7895ae"/><stop offset=".5" stop-color="#3f5c77"/><stop offset="1" stop-color="#192f48"/></radialGradient>
<radialGradient id="zg-water" cx=".3" cy=".2" r=".85"><stop stop-color="#6da09e"/><stop offset=".5" stop-color="#2c6971"/><stop offset="1" stop-color="#163a4a"/></radialGradient>
<linearGradient id="zg-rim" x2=".7" y2="1"><stop stop-color="#f3e1af"/><stop offset=".3" stop-color="#ab8a50"/><stop offset=".53" stop-color="#e3c789"/><stop offset="1" stop-color="#716240"/></linearGradient>'''

def bezel(element):
    b=ellipse(160,169,144,143,'#061b2566')+ellipse(160,160,148,148,'url(#zg-rim)')
    b+=ellipse(160,160,144,144,f'url(#zg-{element})')+ellipse(160,160,138,138,'none','stroke="#e6d4a4" stroke-opacity=".55"')
    b+=ellipse(160,160,130,130,'none','stroke="#e6d4a4" stroke-opacity=".16"')
    for i in range(60):
        a=i*math.pi/30; r=139 if i%5 else 135
        b+=path(f'M{160+math.sin(a)*r:.2f} {160-math.cos(a)*r:.2f}L{160+math.sin(a)*141:.2f} {160-math.cos(a)*141:.2f}',stroke='#e4ce98',width=.7 if i%5 else 1.2,extra='opacity=".54"')
    # Engraved, non-astronomical framing arcs.
    b+=path('M57 91A125 125 0 0 1 233 55M265 222A125 125 0 0 1 100 271',stroke='#f5e6bb',width=.8,extra='opacity=".27"')
    return b

def ram():
    b=''
    for mirror in [False, True]:
        horn=path('M132 100C108 52 57 64 59 111C60 148 105 161 121 132C132 112 116 91 99 98C85 103 88 120 101 121C93 130 77 123 76 109C74 85 101 80 115 100L128 128Z',GOLD,'#674b30',1.4)
        for i in range(9):
            a=math.radians(200+i*19);x=94+32*math.cos(a);y=109+34*math.sin(a)
            horn+=path(f'M{x:.1f} {y:.1f}l{8*math.cos(a):.1f} {8*math.sin(a):.1f}',stroke='#fff0bd',width=1.2,extra='opacity=".55"')
        b+=group(horn,'translate(320 0)scale(-1 1)' if mirror else '')
    b+=path('M129 105Q160 84 191 105L197 161Q187 175 182 210L171 236Q160 246 149 236L138 210Q133 175 123 161Z',IVORY,'#6d674f',1.4)
    b+=path('M128 124L94 119Q95 145 129 153M192 124L226 119Q224 145 191 153',IVORY,'#726d50',1.1)
    b+=path('M143 101l8 39 -8 31 12 41m20-111-6 39 8 31-12 41',stroke='#fff6dd',width=2,extra='opacity=".62"')
    b+=path('M133 160q10 -7 19 1m16 0q10 -8 19-1',stroke='#4c4c40',width=3)
    b+=ellipse(144,162,3,4,'#253b36')+ellipse(177,162,3,4,'#253b36')
    b+=path('M149 216q11 -8 22 0l-11 10Zm11 10v10m-9 0q9 6 18 0','#675b49',width=1)
    b+=path('M140 112q20-9 40 0m-43 8q23-7 46 0',stroke='#877d61',width=1,extra='opacity=".4"')
    return b

def bull():
    b=path('M125 117C88 124 61 100 49 67C45 104 65 146 119 151ZM195 117C232 124 259 100 271 67C275 104 255 146 201 151Z',IVORY,'#928060',1.2)
    b+=path('M115 124L80 119Q77 148 111 157M205 124L240 119Q243 148 209 157',TEAL,'#203e3b',1.5)
    b+=path('M115 119Q160 93 205 119L203 160L185 194L185 224Q160 251 135 224L135 194L117 160Z',TEAL,'#203f3b',1.6)
    b+=path('M139 120q21-9 42 0m-48 10q27-9 54 0m-48 11q21-7 42 0m-22 10v32',stroke='#b5cbb2',width=1.3,extra='opacity=".7"')
    b+=path('M122 159l19 5m37 0 19-5',stroke='#d8d9b3',width=4)
    b+=ellipse(136,165,4,3,'#122e32')+ellipse(184,165,4,3,'#122e32')
    b+=path('M137 200Q160 188 183 200L189 218Q160 241 131 218Z',IVORY,'#426359',1.4)
    b+=ellipse(144,211,4,3,'#546556')+ellipse(176,211,4,3,'#546556')+path('M145 224q15 6 30 0',stroke='#627160',width=1.4)
    b+=path('M121 177l11 18m67-18-11 18M144 149l7 41m25-41-7 41',stroke='#d1d4ae',width=1,extra='opacity=".42"')
    return b

def face_profile(fill=IVORY):
    b=path('M119 239L120 206Q139 197 143 178L137 165L132 166L131 157L121 154L131 139Q126 104 151 90Q176 78 192 98Q204 117 193 143L182 167L181 197L214 222L223 247Q174 267 119 239Z',fill,'#4b5861',1.2)
    b+=path('M134 139l15-3m-19 22 11 0m-7 7 10 0M150 176q13 8 23-3',stroke='#58646b',width=1.2)
    b+=path('M131 122Q133 91 162 87Q193 84 199 110L185 128Q184 108 171 101Q147 98 131 122Z',GOLD,'#877148',1)
    for i in range(7):b+=path(f'M{140+i*7} 99q-8 4 -9 {11+i*3}',stroke='#f5dfaa',width=.9,extra='opacity=".65"')
    b+=path('M123 216q34 4 62-13m-63 23q32 4 78-10m-67 21q27 6 66-8',stroke='#fff4dc',width=1.4,extra='opacity=".6"')
    return b
def twins():
    return group(face_profile(SILVER),'translate(229 16)scale(-.65 .91)')+group(face_profile(IVORY),'translate(91 17)scale(.65 .91)')+path('M160 85v145',stroke='#d7be80',width=.7,extra='opacity=".3"')

def crab():
    b=''
    for side in [1,-1]:
        half=''
        for i,(yy,dx) in enumerate([(151,-39),(169,-53),(185,-56),(199,-46)]):
            half+=path(f'M127 {yy}L{92-i*4} {yy+13}L{74+i*3} {yy+36}L{75+i*5} {yy+49}',stroke='#183f49',width=9)
            half+=path(f'M127 {yy}L{92-i*4} {yy+13}L{74+i*3} {yy+36}L{75+i*5} {yy+49}',stroke=GOLD,width=4.3)
        half+=path('M127 151L97 124L86 103',stroke='#244f55',width=15)+path('M127 151L97 124L86 103',stroke=TEAL,width=10)
        half+=path('M86 115C56 101 62 71 82 67L83 91L98 82L97 59C120 74 116 101 95 118Z',GOLD,'#41615d',1.5)
        half+=path('M75 81q-4 14 12 23',stroke='#fff0bf',width=2)
        b+=group(half,'translate(320 0)scale(-1 1)' if side==-1 else '')
    b+=path('M111 153Q124 125 160 123Q196 125 209 153L202 196Q187 222 160 225Q133 222 118 196Z',TEAL,'#173d49',2)
    b+=path('M121 151Q160 131 199 151M124 165Q160 149 196 165M128 180Q160 164 192 180',stroke='#a3c9bb',width=1.5,extra='opacity=".65"')
    b+=path('M143 203Q160 214 177 203M160 141v52',stroke='#c9d2b3',width=1.2,extra='opacity=".55"')
    b+=path('M143 130l-5-13m39 13 5-13',stroke=GOLD,width=3)+ellipse(138,116,4,4,'#142f3d')+ellipse(182,116,4,4,'#142f3d')
    return b

def lion():
    b=''
    for layer in [0,1]:
        for i in range(19):
            a=(i*19-100)*math.pi/180;r=89-layer*15
            x=149+math.cos(a)*r;y=160+math.sin(a)*r
            b+=group(path('M0-26Q24-10 15 23Q7 40-8 48Q-3 22-15 8Q-20-12 0-26Z',GOLD if layer else '#b58646','#785532',.8),f'translate({x:.2f} {y:.2f})rotate({i*19-12})scale(.8)')
    b+=path('M129 101Q160 89 179 108L193 135L218 155L217 169L202 175L198 192L177 202L165 226L133 219L123 182Q109 159 113 137Z',IVORY,'#765f43',1.5)
    b+=path('M129 110Q109 90 120 78Q141 76 145 103',GOLD,'#71543b',1.5)
    b+=path('M174 137l18 6-13 4m22 10 16-2-2 13-12-1m-12 10 11 0m-28-33 4 17',stroke='#68543d',width=2)
    b+=path('M160 112q12 14 10 29m-31 26q12 12 22 11m-11 18 20 5',stroke='#fff3d1',width=2)
    for i in range(4):b+=path(f'M193 {170+i*4}l{21+i*2} {i*3-5}',stroke='#d6bf8c',width=.8)
    return b

def wheat(x,y,angle):
    b=path('M0 28V-45',stroke=GOLD,width=2)
    for i in range(5):
        yy=8-i*9
        b+=path(f'M0 {yy}q-16-6-11-15q12 2 11 15m0 0q16-6 11-15q-12 2-11 15',GOLD,'#8c703c',.5)
    b+=path('M0-35q-7-10 0-19q7 9 0 19',GOLD)
    return group(b,f'translate({x} {y})rotate({angle})')
def maiden():
    b=group(face_profile(),'translate(6 5)')
    b+=path('M185 120Q201 137 193 160L185 201L213 235L186 250L166 200L174 151Z',TEAL,'#324f49',1)
    for i in range(8):b+=ellipse(186-i*.9,131+i*9,7,5,GOLD,'transform="rotate(-20 186 160)" stroke="#77603d" stroke-width=".6"')
    b+=path('M120 222Q145 218 160 227L189 213L195 220L164 243L136 245',IVORY,'#667163',1)
    b+=wheat(220,194,14)+wheat(234,216,30)+wheat(206,215,-6)
    b+=path('M125 230l18 22m-4-29 20 26m-6-31 22 23',stroke='#f1e9cb',width=1.6)
    return b

def scales():
    b=ellipse(160,249,75,12,'#0c26394d')
    b+=path('M119 245Q160 226 201 245L201 252H119Z',GOLD,'#8a703d',1)
    b+=path('M150 231L155 89H165L170 231Z',GOLD,'#96763b',1)
    b+=ellipse(160,90,10,10,GOLD)+path('M74 123Q116 108 160 117Q204 108 246 123L244 130Q204 119 160 128Q116 119 76 130Z',GOLD,'#8d723f',1.2)
    for x in [88,232]:
        b+=path(f'M{x} 126L{x-31} 198M{x} 126L{x+31} 198',stroke='#ddc587',width=2.4,extra='stroke-dasharray="3.2 2"')
        b+=ellipse(x,198,34,7,IVORY,'stroke="#c6a461"')+path(f'M{x-34} 199Q{x} 238 {x+34} 199Q{x} 211 {x-34} 199Z',GOLD,'#836539',1)
        b+=path(f'M{x-23} 208q23 17 46 0',stroke='#fff2c5',width=1.2)
    b+=path('M159 105v118M125 244q35-8 70 0',stroke='#fff3cf',width=1.4,extra='opacity=".7"')
    return b

def scorpion():
    b=''
    for side in [-1,1]:
        half=''
        for i in range(4):
            yy=157+i*14
            half+=path(f'M137 {yy}L{111-i*3} {yy-9}L{87-i*2} {yy+9}L{79+i*3} {yy+29}',stroke='#173846',width=8)
            half+=path(f'M137 {yy}L{111-i*3} {yy-9}L{87-i*2} {yy+9}L{79+i*3} {yy+29}',stroke=GOLD,width=3.4)
        half+=path('M137 153L112 130L104 106',stroke=TEAL,width=11)
        half+=path('M103 118Q77 101 81 78Q87 65 95 66L95 90L107 85L109 64Q130 86 115 110Z',GOLD,'#41615a',1)
        b+=group(half,'translate(320 0)scale(-1 1)'if side==1 else '')
    # Six linked tail plates, curling toward the top right.
    for x,y,a,rx,ry in [(162,221,0,19,14),(181,233,-30,17,13),(207,226,-50,16,12),(227,207,-68,15,11),(235,181,-90,14,10),(231,156,-113,13,9)]:
        b+=ellipse(x,y,rx,ry,GOLD,f'transform="rotate({a} {x} {y})" stroke="#68583d" stroke-width="1.2"')
    b+=path('M226 146Q205 139 211 119Q231 125 238 144L229 155Z',IVORY,'#6f694c',1)
    for i in range(6):
        b+=ellipse(160,147+i*12,26-i*1.6,12,TEAL,'stroke="#bfd0b0" stroke-opacity=".6" stroke-width="1"')
    b+=ellipse(160,139,21,19,TEAL,'stroke="#173e47" stroke-width="1.4"')+ellipse(152,133,2,2,'#f9e1a5')+ellipse(168,133,2,2,'#f9e1a5')
    return b

def archer():
    b=path('M111 169Q121 144 143 143L161 160L149 192L167 243L125 253L117 214L95 239L73 231L109 188Z',TEAL,'#2c4844',1.4)
    b+=path('M141 143L168 137L210 115L215 124L173 154L151 159Z',IVORY,'#706f56',1)
    b+=path('M123 155L146 173L188 159L192 168L145 187L115 170Z',IVORY,'#706f56',1)
    b+=path('M126 136L126 124L117 116L124 112Q119 92 137 87Q158 84 164 101L159 118L148 126L150 144Z',IVORY,'#74674e',1)
    b+=path('M122 107Q112 89 130 78Q151 72 165 91L160 104L148 93L137 97Z',GOLD,'#805e37',1)
    b+=path('M214 78Q263 155 210 227',stroke=GOLD,width=6)+path('M214 78L185 163L210 227',stroke='#f2deb0',width=1.4)
    b+=path('M143 187L242 83',stroke='#eee0b9',width=3)+path('M239 85L238 71L253 74Z',GOLD,'#a08345',1)
    b+=path('M112 193l19 45m3-49 19 48m-39-27-13 19',stroke='#a8bdb0',width=1.5,extra='opacity=".7"')
    b+=path('M184 159l9-4 5 3-7 7M209 115l9-3 5 6-9 6',IVORY,'#68674b',.9)
    return b

def seagoat():
    b=path('M172 171Q204 163 222 189Q247 224 211 248Q189 266 157 250Q140 239 158 225Q168 216 181 224L193 236Q213 235 210 217Q204 207 192 216L169 210Z',TEAL,'#1d4548',1.6)
    for row in range(4):
        for col in range(6):
            x=171+col*7+(row%2)*3;y=189+row*10
            b+=path(f'M{x} {y}q4 7 8 0',stroke='#bfceae',width=.9,extra='opacity=".5"')
    b+=path('M159 233Q137 219 123 235L137 243L124 262Q149 267 165 245Z',GOLD,'#7a744d',1)
    b+=path('M143 238l-12-5m15 11-13 11',stroke='#eddfad',width=1.1)
    b+=path('M118 117Q112 88 100 63Q129 67 142 107M145 108Q155 74 183 59Q178 94 162 119',GOLD,'#725c3b',1.3)
    for i in range(6):b+=path(f'M{110+i*4} {77+i*5}l10-3M{174-i*3} {76+i*5}l-10-4',stroke='#f2d99d',width=1.1)
    b+=path('M115 117Q139 99 163 118L178 141L202 154L199 169L179 178L171 196L150 213L126 207L136 184L119 166L103 144Z',IVORY,'#6d6b51',1.4)
    b+=path('M112 128L82 119Q87 143 113 149',IVORY,'#686d51',1)
    b+=path('M162 144l16 3m12 13 10-3M147 168q10 6 22 3m-27 13 15 10m-12-4-7 21',stroke='#6c6b50',width=1.6)
    b+=ellipse(174,148,3,3,'#273b34')+path('M125 122l17 10m-22 7 16 8',stroke='#fff9df',width=1.4)
    return b

def amphora():
    b=''
    for i in range(6):
        b+=path(f'M{156+i*4} {173+i*2}C{128-i*3} 205 {231+i*3} 212 {200+i*6} 260C{185+i*5} 278 {109-i*2} 253 {88-i*4} 272',stroke=SILVER if i%2 else '#7caeb3',width=5-i*.45,extra='opacity=".83"')
    jar=path('M124 81Q103 81 104 103Q107 120 126 122M190 81Q212 82 210 104Q207 122 188 123',stroke=GOLD,width=7)
    jar+=path('M136 63H178L173 88Q207 116 191 151Q178 177 157 182Q130 176 119 151Q106 121 141 88Z',GOLD,'#7b6945',1.3)
    jar+=ellipse(157,63,22,6,IVORY,'stroke="#8e7145"')+ellipse(157,64,15,3,'#5b5b4e')
    jar+=path('M131 111Q157 121 185 111M124 122Q157 133 191 122M129 146Q157 155 184 146',stroke='#745f3d',width=1.3,extra='opacity=".7"')
    jar+=path('M142 98Q121 123 138 151',stroke='#fff2c6',width=3,extra='opacity=".7"')
    b+=group(jar,'rotate(-27 157 129)')
    b+=path('M63 132L97 121L117 127L124 142L117 151L101 139L78 148Z',IVORY,'#657365',1.1)
    b+=path('M248 157L210 151L193 142L183 151L193 166L212 170L239 180Z',IVORY,'#657365',1.1)
    b+=path('M106 130l10 9m-5-12 9 9m76 20 8 7m-4-11 10 7',stroke='#8e8c6c',width=1)
    return b

def fish():
    b=path('M73 121Q111 78 184 119L203 101L229 94L215 119L230 137L204 134L186 128Q115 168 73 121Z',SILVER,'#365c65',1.2)
    b+=path('M111 105Q120 76 142 83L150 109M113 141Q128 159 148 151L157 136',TEAL,'#7ca69f',1)
    b+=path('M101 105Q119 122 101 139',stroke='#446c73',width=1.5)+ellipse(89,120,4,4,'#213f4b')+ellipse(88,119,1,1,'#f7ebc4')
    for row in range(4):
        for col in range(7):
            x=111+col*9;y=108+row*8
            if abs(y-122)<(181-x)*.18+7:b+=path(f'M{x} {y}q6 5 0 10',stroke='#436c76',width=.65,extra='opacity=".65"')
    for i in range(4):b+=path(f'M{210+i*3} {103+i*2}l-13 18M{122+i*5} 88l{5+i} 17',stroke='#c5d9cf',width=.7)
    return b
def fishes():
    return fish()+group(fish(),'translate(320 320)rotate(180 0 0)')+path('M78 122C39 160 54 212 99 208M242 198C282 161 268 109 223 112',stroke='#c3cba4',width=1,extra='opacity=".5"')

DRAWINGS={'avinas':ram,'jautis':bull,'dvyniai':twins,'vezys':crab,'liutas':lion,'mergele':maiden,'svarstykles':scales,'skorpionas':scorpion,'saulys':archer,'oziaragis':seagoat,'vandenis':amphora,'zuvys':fishes}
def figure(key):return bezel(PROFILES[key]['element_key'])+DRAWINGS[key]()
def document(title,desc,body,w=320,h=320,defs=DEFS):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title desc"><title id="title">{escape(title)}</title><desc id="desc">{escape(desc)}</desc><defs>{defs}</defs>{body}</svg>\n'

# Text outlines preserve real Lato glyphs in exported SVG/PNG on every renderer.
FONT=TTFont(ROOT/'site/assets/fonts/Lato-Bold.ttf'); GLYPHS=FONT.getGlyphSet(); CMAP=FONT.getBestCmap(); UPM=FONT['head'].unitsPerEm
def text(value,x,y,size,fill='#183f3b'):
    offset=0;chunks=[]
    for char in value:
        glyph=CMAP.get(ord(char))
        if glyph is None:raise ValueError(f'Missing Lithuanian glyph: {char}')
        pen=SVGPathPen(GLYPHS);GLYPHS[glyph].draw(pen)
        if pen.getCommands():chunks.append(f'<path d="{pen.getCommands()}" transform="translate({offset} 0)"/>')
        offset+=FONT['hmtx'].metrics[glyph][0]
    return f'<g aria-label="{escape(value)}" fill="{fill}" transform="translate({x} {y})scale({size/UPM} {-size/UPM})">'+''.join(chunks)+'</g>'

def wheel(size=640):
    b=ellipse(320,320,305,305,'#faf6e9','stroke="#ae9058" stroke-width="3"')+ellipse(320,320,282,282,'#123f40','stroke="#cdb477" stroke-width="1.5"')
    for i,key in enumerate(DRAWINGS):
        a=i*math.pi/6;x=320+215*math.sin(a);y=320-215*math.cos(a)
        b+=group(figure(key),f'translate({x-38:.3f} {y-38:.3f})scale(.2375)')
        a-=math.pi/12
        b+=path(f'M{320+150*math.sin(a):.2f} {320-150*math.cos(a):.2f}L{320+276*math.sin(a):.2f} {320-276*math.cos(a):.2f}',stroke='#bfa66c',width=1,extra='opacity=".6"')
    b+=ellipse(320,320,141,141,'#f6efd9','stroke="#cdb477" stroke-width="2"')+ellipse(320,320,129,129,'#184b47','stroke="#9e945b"')
    # An engraved sun and crescent are symbolic framing, not a phase/time claim.
    b+=ellipse(320,320,52,52,GOLD)+path('M335 270Q295 305 334 363Q266 349 270 309Q278 269 335 270Z',IVORY)
    for i in range(24):
        a=i*math.pi/12;b+=path(f'M{320+74*math.sin(a):.2f} {320-74*math.cos(a):.2f}L{320+(90 if i%2 else 102)*math.sin(a):.2f} {320-(90 if i%2 else 102)*math.cos(a):.2f}',stroke=GOLD,width=1.5)
    return group(b,f'scale({size/640})')

def diagram():
    b='<rect width="680" height="520" rx="24" fill="#f5f7f2"/>'
    b+=text('Ženklai ir žvaigždynai',28,43,25)+text('Dvi skirtingos sistemos',28,69,14,'#576e6b')
    cx=219;cy=264
    b+=ellipse(cx,cy,151,151,'#e9eee4','stroke="#c0cdbf"')
    for i in range(12):
        a=(i*30-90)*math.pi/180;z=(i*30-60)*math.pi/180
        d=f'M{cx} {cy}L{cx+103*math.cos(a):.2f} {cy+103*math.sin(a):.2f}A103 103 0 0 1 {cx+103*math.cos(z):.2f} {cy+103*math.sin(z):.2f}Z'
        b+=path(d,'#1a6055'if i%2 else '#387c68','#f3f2db',1)
    weights=[28,34,24,29,39,42,23,21,20,32,35,18,15];angle=-90
    for i,weight in enumerate(weights):
        a=math.radians(angle);z=math.radians(angle+weight);angle+=weight
        d=f'M{cx+119*math.cos(a):.2f} {cy+119*math.sin(a):.2f}L{cx+149*math.cos(a):.2f} {cy+149*math.sin(a):.2f}A149 149 0 0 1 {cx+149*math.cos(z):.2f} {cy+149*math.sin(z):.2f}L{cx+119*math.cos(z):.2f} {cy+119*math.sin(z):.2f}A119 119 0 0 0 {cx+119*math.cos(a):.2f} {cy+119*math.sin(a):.2f}Z'
        b+=path(d,'#a06f38'if i==8 else ('#d5bd80'if i%2 else '#c3a765'),'#f5f7f2',1.5)
    b+=ellipse(cx,cy,51,51,'#f4f2e5')+text('12 × 30°',176,272,22)
    b+=text('12 vienodų ženklų',45,449,18)+text('13 nevienodų žvaigždynų sričių',45,477,15,'#76572c')
    b+=text('Ašies precesija',409,136,20)
    b+=ellipse(523,260,62,62,'url(#zg-air)','stroke="#719ba9"')
    b+=path('M479 230l17-15 20 8 4 17-14 8-2 25-17-10-7-16M535 280l20-7 15 12-8 20-16 4Z','#abc1a3')
    b+=ellipse(523,260,62,20,'none','stroke="#e3eee0" stroke-opacity=".5" transform="rotate(-23 523 260)"')
    b+=path('M480 351L565 162',stroke='#436a68',width=2,extra='stroke-dasharray="5 4"')
    b+=ellipse(523,164,49,15,'none','stroke="#b38942" stroke-width="2"')+path('M560 154l8 6-11 3',stroke='#b38942',width=2)
    b+=path('M523 260L476 164M523 260L571 164',stroke='#bda977',width=1,extra='opacity=".6"')
    b+=text('Apie 26 000 metų',423,378,16)+text('Schema, ne mastelis',425,403,13,'#576e6b')
    return document('Astrologiniai ženklai ir astronominiai žvaigždynai','Vidinis ratas: 12 vienodų dalių po 30 laipsnių. Išorinis: 13 schemiškai nevienodų sričių; jų plotis neatitinka tikro dangaus. Dešinėje Žemės ašies precesijos kūgis, apie 26 tūkstančių metų ciklas.',''.join(b),680,520)

def elements():
    shapes={
      'fire':path('M153 61C168 103 118 119 141 160C149 139 177 132 175 106C218 151 224 190 201 224C168 268 103 240 110 198C113 169 139 154 128 130C109 97 143 84 153 61Z',GOLD,'#855e36',1)+path('M160 168Q129 199 153 230Q183 232 187 208Q191 191 174 177Q179 202 160 205Q150 193 160 168Z',IVORY),
      'earth':path('M70 218L137 104L176 165L194 132L253 218Z',GOLD,'#685f3b',1.2)+path('M111 147l26-43 25 39-22-7-11 13Z',IVORY)+path('M75 234q81-29 170 0m-151 13q70-20 130 0',stroke='#b5c8ac',width=2),
      'air':path('M73 126H193Q230 126 230 99Q229 77 210 78Q187 79 194 96M70 158H224Q252 158 252 180Q249 207 227 201M87 188H162Q188 188 184 213Q180 231 164 224',stroke=SILVER,width=7)+path('M77 143h105m-82 27h91',stroke=GOLD,width=1.4),
      'water':path('M67 128Q110 100 155 128T249 128M67 165Q110 137 155 165T249 165M67 202Q110 174 155 202T249 202',stroke=SILVER,width=7)+path('M78 142Q119 119 159 142T241 142M78 179Q119 156 159 179T241 179',stroke=GOLD,width=1.2)
    }
    for key,shape in shapes.items():
        (OUT/f'stichija-{key}.svg').write_text(document({'fire':'Ugnis','earth':'Žemė','air':'Oras','water':'Vanduo'}[key]+' – simbolinė stichija','Originali dekoratyvi astrologinės tradicijos stichijos iliustracija.',bezel(key)+shape))

def run():
    OUT.mkdir(parents=True,exist_ok=True)
    for key in DRAWINGS:(OUT/f'{key}.svg').write_text(document(NAMES[key]+' – originali Zodiako iliustracija',PROFILES[key]['art_alt'],figure(key)))
    symbols=''.join(f'<symbol id="zodiac-{key}" viewBox="0 0 96 96">'+group(figure(key),'scale(.3)')+'</symbol>' for key in DRAWINGS)
    (OUT.parent/'zodiac-signs.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs>'+DEFS+'</defs>'+symbols+'</svg>\n')
    (OUT.parent/'zodiac-wheel.svg').write_text(document('Dvylikos Zodiako ženklų ratas','Dvylika originalių reljefiškų simbolių vienodose simbolinio rato dalyse. Tai nėra žvaigždėlapis.',wheel(320)))
    (OUT/'zodiakas-ir-zvaigzdynai.svg').write_text(diagram())
    elements()
    b='<rect width="1200" height="630" fill="#f4f5ed"/><path d="M620 0H1200V630H730Q580 360 620 0Z" fill="#e8ecdf"/>'
    b+=group(wheel(570),'translate(7 27)')
    b+=text('Kalendorius365',618,79,25,'#006747')+text('Zodiako ženklai',616,157,49)+text('Atraskite savo ženklą',618,206,27,'#4a6860')+text('Datos · simboliai · keturios stichijos',618,246,21,'#4a6860')
    for key,x in [('liutas',604),('svarstykles',789),('zuvys',974)]:b+=group(figure(key),f'translate({x} 296)scale(.55)')
    b+=text('12 ženklų. Aiškus datų ribų paaiškinimas.',618,539,21,'#43645b')
    (ROOT/'scripts/zodiac/zodiakas-1200x630.svg').write_text(document('Zodiako ženklai – Kalendorius365','Originalus simbolių ratas, Liūto, Svarstyklių ir Žuvų reljefai. Datos, simboliai, keturios stichijos.',b,1200,630))
    inventory={ 'creator':'Kalendorius365; original code-authored SVG paths, no external artwork', 'stock_assets':[], 'files':[str(p.relative_to(ROOT)) for p in sorted(OUT.glob('*.svg'))], 'symbol_sprite':'site/assets/visuals/zodiac-signs.svg', 'decorative_wheel':'site/assets/visuals/zodiac-wheel.svg', 'font':'Lato Bold, SIL Open Font License 1.1, existing repository font', 'diagram':'Schematic, unequal sectors are illustrative; not measured IAU boundaries' }
    (OUT/'artwork-inventory.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n')
    print(f'Created {len(DRAWINGS)} individual figures, four elements, wheel, sprite, diagram and original OG artwork.')
if __name__=='__main__':run()
