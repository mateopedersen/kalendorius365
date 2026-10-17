#!/usr/bin/env python3
"""Original small botanical still lifes, drawn as repo-native vectors."""
from pathlib import Path
import math

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'site/assets/visuals/namedays'
OUT.mkdir(parents=True, exist_ok=True)

DEFS = '''<defs>
<linearGradient id="paper" x2=".8" y2="1"><stop stop-color="#fffefa"/><stop offset="1" stop-color="#e9e4d6"/></linearGradient>
<linearGradient id="leaf" x2="1" y2="1"><stop stop-color="#88a58b"/><stop offset=".45" stop-color="#527f67"/><stop offset="1" stop-color="#244f40"/></linearGradient>
<linearGradient id="gold" x2="1" y2=".8"><stop stop-color="#f9e6a1"/><stop offset=".35" stop-color="#bf923f"/><stop offset=".65" stop-color="#e9cc7c"/><stop offset="1" stop-color="#9b6c2c"/></linearGradient>
<radialGradient id="petal" cx=".3" cy=".2"><stop stop-color="#fffef7"/><stop offset=".65" stop-color="#e5e7db"/><stop offset="1" stop-color="#aabfaf"/></radialGradient>
<radialGradient id="berry" cx=".3" cy=".25"><stop stop-color="#ef9d79"/><stop offset=".35" stop-color="#bb594d"/><stop offset="1" stop-color="#742e37"/></radialGradient>
<radialGradient id="rose" cx=".3" cy=".2"><stop stop-color="#fff1e4"/><stop offset=".5" stop-color="#d5a29b"/><stop offset="1" stop-color="#9c6464"/></radialGradient>
<filter id="shadow" x="-.3" y="-.3" width="1.6" height="1.7"><feDropShadow dx="0" dy="7" stdDeviation="6" flood-color="#233e31" flood-opacity=".13"/></filter>
</defs>'''


def leaf(x, y, angle=0, scale=1, color='url(#leaf)'):
    return f'<g transform="translate({x} {y}) rotate({angle}) scale({scale})"><path d="M0 0C-20-9-29-32-22-48C-5-45 13-24 0 0Z" fill="{color}" stroke="#3e6954" stroke-width=".7"/><path d="M0 0L-19-42M-10-23L-23-28M-13-31L-10-37" fill="none" stroke="#c6d2ab" stroke-width=".75" opacity=".7"/></g>'


def flower(x, y, size=1, petals=6, color='url(#petal)'):
    return f'<g transform="translate({x} {y}) scale({size})">' + ''.join(f'<ellipse cx="0" cy="-12" rx="7" ry="15" transform="rotate({a * 360 / petals})" fill="{color}" stroke="#9ba58c" stroke-width=".45"/>' for a in range(petals)) + '<circle r="5.5" fill="url(#gold)"/><circle r="2" fill="#916126"/></g>'


def sprig(x, y, rotation=0, kind='leaves'):
    body = '<path d="M0 0Q-8-53 5-106" fill="none" stroke="#507259" stroke-width="2"/>'
    if kind == 'pine':
        for i in range(9):
            yy = -12-i*10
            body += f'<path d="M0 {yy}L{-26+i} {yy-20}M0 {yy}L{27-i} {yy-15}" stroke="#496d5f" stroke-width="2" stroke-linecap="round"/>'
        body += '<path d="M0-10L-28-35M0-45L26-73M1-74L-20-103" stroke="#abc7bc" stroke-width="1"/>'
    else:
        for i in range(5):
            yy = -12-i*19
            body += leaf(0, yy, -60 if i % 2 else 65, .52)
    return f'<g transform="translate({x} {y}) rotate({rotation})">{body}</g>'


def motif(month):
    # Each composition uses a different plant silhouette and arrangement.
    if month == 1:
        return sprig(148,208,-35,'pine') + sprig(148,208,29,'pine') + ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fcffff" stroke="#cbdeda"/>' for x,y,r in [(92,94,4),(183,112,5),(114,151,3),(175,77,3)])
    if month == 2:
        return sprig(145,218,-20) + '<path d="M150 151C105 115 112 73 141 86C160 57 199 76 185 108C176 126 163 139 150 151Z" fill="url(#rose)" stroke="#a67870"/><path d="M151 139Q135 115 133 96" stroke="#f3d9c9" fill="none"/>' + flower(98,177,.42,5)
    if month == 3:
        return '<path d="M131 221Q115 133 147 84Q173 62 181 113M147 218Q182 167 180 146" stroke="#477359" stroke-width="3" fill="none"/>' + leaf(130,207,28,1.1) + '<g transform="translate(180 113)"><path d="M-13 0Q0-18 13 0L16 28Q0 20-16 28Z" fill="url(#petal)" stroke="#8fa58e"/><path d="M0-2V22M-7 0L-9 20M7 0L9 20" stroke="#a0b6a0" fill="none"/></g>' + flower(180,149,.5,5)
    if month == 4:
        return '<path d="M144 221Q133 156 142 98M149 216Q180 166 184 133" stroke="#517557" stroke-width="3" fill="none"/>' + leaf(146,204,-37,1.25) + leaf(143,191,75,.8) + '<path d="M140 135Q113 117 117 83L139 99L155 73Q174 118 140 135Z" fill="url(#rose)" stroke="#9e7771"/><path d="M140 128L139 100" stroke="#f6ded1" fill="none"/>' + flower(183,130,.65,5)
    if month == 5:
        return sprig(131,220,-18) + '<path d="M140 219Q157 160 170 80" stroke="#52785c" stroke-width="2" fill="none"/>' + ''.join(f'<path d="M{x} {y}q-13-14-20 2l-2 13q13-7 22 1Z" fill="url(#petal)" stroke="#b4bca2"/>' for x,y in [(166,94),(159,119),(153,144),(147,169)]) + leaf(137,218,55,1.3)
    if month == 6:
        return sprig(145,220,35) + sprig(143,221,-32) + ''.join(flower(x,y,s,8) for x,y,s in [(117,111,.8),(175,102,.67),(148,151,.56),(96,172,.47)])
    if month == 7:
        stalks = ''.join(f'<path d="M{x} 220Q{x-10} 142 {x+7} 69" fill="none" stroke="#aa8b49" stroke-width="1.7"/>' + ''.join(f'<ellipse cx="{x+(j%2)*14-3}" cy="{80+j*11}" rx="4" ry="11" transform="rotate({-28 if j%2 else 28} {x+(j%2)*14-3} {80+j*11})" fill="url(#gold)" stroke="#b29a5a" stroke-width=".4"/>' for j in range(7)) for x in [116,145,173])
        return stalks + '<path d="M99 196Q148 210 185 193L182 202Q144 217 98 205Z" fill="#728f8b"/>'
    if month == 8:
        return sprig(143,219,12) + '<path d="M141 201Q98 172 94 126M153 173Q190 163 191 115" stroke="#7b6851" fill="none" stroke-width="2"/>' + ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="url(#berry)" stroke="#a25b52" stroke-width=".7"/><path d="M{x-4} {y-r+4}q5-6 9-1" fill="none" stroke="#f3b6a1"/>' for x,y,r in [(102,126,22),(185,111,18)]) + leaf(104,114,45,.7)
    if month == 9:
        return '<path d="M150 221Q134 154 171 80" stroke="#7b684e" fill="none" stroke-width="2"/>' + ''.join(leaf(x,y,a,s,'url(#gold)') for x,y,a,s in [(146,192,-32,.94),(147,166,62,1),(156,132,-36,.85),(166,102,65,.72)]) + '<ellipse cx="108" cy="206" rx="12" ry="17" fill="#9d7150"/><path d="M94 199Q106 183 122 198L122 203H94Z" fill="#7b6950" stroke="#4e5744"/><path d="M107 191L110 181" stroke="#5e6045" stroke-width="2"/>'
    if month == 10:
        return '<path d="M131 219Q170 151 142 74M158 161Q186 133 202 113" stroke="#79684d" stroke-width="2" fill="none"/>' + ''.join(leaf(x,y,a,s,col) for x,y,a,s,col in [(147,115,-65,1.3,'#bb7751'),(152,164,49,1.2,'url(#gold)'),(136,203,-70,.85,'#9b5a43'),(193,127,42,.7,'#ca9c60')])
    if month == 11:
        return sprig(173,223,27) + '<ellipse cx="128" cy="221" rx="42" ry="11" fill="#b9baac"/><rect x="104" y="131" width="48" height="88" rx="6" fill="url(#paper)" stroke="#bdbaa9"/><ellipse cx="128" cy="132" rx="24" ry="7" fill="#f7f0da" stroke="#c4b69b"/><path d="M128 133v-14" stroke="#675f4e" stroke-width="2"/><path d="M128 119C107 107 124 91 129 79C146 103 140 113 128 119Z" fill="url(#gold)"/><path d="M128 117Q120 109 129 101Q136 112 128 117" fill="#fff5cf"/>'
    return sprig(137,222,-39,'pine') + sprig(139,218,24,'pine') + '<path d="M139 169L141 121" stroke="#ae8750" stroke-width="1.5"/><circle cx="141" cy="112" r="29" fill="url(#gold)" stroke="#ac8950"/><path d="M123 91Q108 114 128 134M141 83v58M154 91q17 22 0 43" fill="none" stroke="#fff2c2" opacity=".65"/>' + ''.join(f'<circle cx="{x}" cy="{y}" r="5" fill="url(#berry)"/>' for x,y in [(98,166),(112,180),(178,165),(187,179)])


for m in range(1,13):
    art = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 288 288">{DEFS}<ellipse cx="144" cy="228" rx="78" ry="9" fill="#1b4d3420"/><circle cx="144" cy="141" r="108" fill="#f2f3eb"/><circle cx="144" cy="141" r="98" fill="none" stroke="#d6dac8" stroke-width=".8"/><g filter="url(#shadow)">{motif(m)}</g><path d="M58 248H230" stroke="#c4aa70" stroke-width=".7"/><path d="M136 248l8-4 8 4-8 4Z" fill="url(#gold)"/></svg>'
    (OUT / f'month-{m:02}.svg').write_text(art)

hero = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 440">{DEFS}
<ellipse cx="284" cy="372" rx="201" ry="24" fill="#1a463512"/>
<g transform="translate(29 108) rotate(-20 140 180)">{sprig(140,221,-32,'pine')}{sprig(143,220,25)}{flower(113,117,.8,8)}{flower(176,119,.6,6)}</g>
<g transform="translate(128 65) rotate(9 150 150)" filter="url(#shadow)">
<rect x="13" y="22" width="283" height="286" rx="17" fill="#d8d3c4"/><rect width="298" height="296" rx="16" fill="url(#paper)" stroke="#c8c8b7"/>
<path d="M0 65H298V16Q298 0 282 0H16Q0 0 0 16Z" fill="#2a6654"/><path d="M0 62H298" stroke="#638d78"/>
<path d="M47 25V-9M249 25V-9" stroke="#9e915f" stroke-width="12" stroke-linecap="round"/><path d="M44 23V-9M246 23V-9" stroke="#e5d7ac" stroke-width="4" stroke-linecap="round"/>
<rect x="28" y="90" width="242" height="177" rx="7" fill="#fffefa" stroke="#dad5c7"/><path d="M51 120H111M51 230H247M51 243H207" stroke="#c2c7b4" stroke-width="2" stroke-linecap="round"/>
<path d="M87 146C102 122 130 135 130 151C130 167 109 199 109 210M163 133C143 141 128 170 133 191C138 216 172 214 188 191C213 157 193 126 175 137C160 145 156 171 165 181C174 192 189 174 195 164" fill="none" stroke="#386c59" stroke-width="5" stroke-linecap="round"/>
<path d="M72 214Q137 195 224 211" fill="none" stroke="url(#gold)" stroke-width="2"/>
</g>
<g transform="translate(389 242) rotate(17)"><rect width="98" height="103" rx="9" fill="#b79d6d" stroke="#9d865f"/><path d="M40 0H55V103H40Z" fill="#f1ddb4"/><path d="M0 30H98V44H0Z" fill="#e9d6aa"/><path d="M47 31C12 25 15-9 34 1C45 7 48 28 47 31C52-3 72-12 80 2C89 21 64 29 47 31Z" fill="#f1ddb4" stroke="#bba278" stroke-width="1.4"/><path d="M46 31L24 65L39 62L41 74L53 40L68 69" fill="none" stroke="#efd8ac" stroke-width="7"/></g>
<g transform="translate(108 308)"><circle r="32" fill="#9c6555" stroke="#855343"/><circle r="26" fill="none" stroke="#c08b76"/><path d="M-13-11L0 14L14-13M-13-12H-5M8-13H18" fill="none" stroke="#e8b89c" stroke-width="2"/></g>
<path d="M464 98l4 10 10 4-10 4-4 10-4-10-10-4 10-4Z" fill="url(#gold)"/><circle cx="86" cy="98" r="3" fill="#b9a26a"/>
</svg>'''
(OUT / 'hero.svg').write_text(hero)
print('13 original SVG still lifes written')
