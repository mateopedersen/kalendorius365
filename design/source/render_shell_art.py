"""Draw the calendar interface illustrations as standalone, transparent SVGs."""

from pathlib import Path
from math import cos, pi, sin

OUTPUT = Path(__file__).resolve().parents[2] / "site/assets/visuals/shell"

PALETTE = {
    "ivory": ((0, "#fffefa"), (.27, "#fcfaf1"), (.58, "#e9e4d6"), (1, "#c1b9a5")),
    "edge": ((0, "#dddbcd"), (.22, "#f9f5e7"), (.53, "#a69b82"), (.78, "#d2c5ab"), (1, "#7c715b")),
    "green": ((0, "#95c2a2"), (.12, "#3b8463"), (.41, "#126145"), (.73, "#0a4330"), (1, "#08271e")),
    "green-side": ((0, "#2b7256"), (.56, "#123c30"), (1, "#061f1a")),
    "red": ((0, "#f4a18f"), (.15, "#d35750"), (.45, "#a62d37"), (.83, "#6d1926"), (1, "#491420")),
    "red-side": ((0, "#a03839"), (.58, "#67222a"), (1, "#3b151d")),
    "gold": ((0, "#fff8d5"), (.18, "#f3d391"), (.35, "#a57637"), (.47, "#f1d08a"), (.69, "#d1a359"), (1, "#795127")),
    "brass": ((0, "#a67945"), (.35, "#e5c386"), (.58, "#8a5c33"), (.78, "#c89650"), (1, "#684529")),
    "steel": ((0, "#fffef4"), (.19, "#ebece4"), (.33, "#84968e"), (.47, "#edf2e9"), (.61, "#b9c4ba"), (.81, "#6d8076"), (1, "#3f534b")),
    "leather": ((0, "#cfad7e"), (.18, "#ae8250"), (.55, "#795435"), (.81, "#573827"), (1, "#36241c")),
    "leather-side": ((0, "#836344"), (.57, "#39291f"), (1, "#281915")),
    "sage": ((0, "#def3e2"), (.35, "#a8c4a9"), (.62, "#679784"), (1, "#32584c")),
}
RADIAL = {
    "moonlit": ((0, "#fffdf0"), (.38, "#e1dfd1"), (.68, "#b8b9ad"), (.86, "#7f8981"), (1, "#3e5049")),
    "sunlit": ((0, "#fffde5"), (.3, "#fff2b7"), (.67, "#eec063"), (.89, "#bd7130"), (1, "#86401e")),
    "glass": ((0, "#f1fff9"), (.35, "#e6f4e8"), (.69, "#a6c8b6"), (.87, "#447362"), (1, "#193f36")),
    "skin": ((0, "#fff4d8"), (.32, "#f6d8b2"), (.7, "#d49b6d"), (.91, "#a76749"), (1, "#71452e")),
    "biscuit": ((0, "#fae5b4"), (.35, "#e0af6b"), (.66, "#c8914d"), (.88, "#a06431"), (1, "#79401e")),
    "shadow": ((0, "#222c24", .38), (.44, "#1f2921", .23), (1, "#243527", 0)),
}


def fill(color):
    return f"url(#{color})" if color in PALETTE or color in RADIAL else color


def path(data, color="none", stroke="none", width=1, extra=""):
    return f'<path d="{data}" fill="{fill(color)}" stroke="{fill(stroke)}" stroke-width="{width}"{extra}/>'


def rect(x, y, w, h, r, color, stroke="none"):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill(color)}" stroke="{fill(stroke)}"/>'


def oval(x, y, w, h, color, extra=""):
    return f'<ellipse cx="{x}" cy="{y}" rx="{w}" ry="{h}" fill="{fill(color)}"{extra}/>'


def group(content, transform):
    return f'<g transform="{transform}">{content}</g>'


def stroke(data, color, width):
    return path(data, "none", color, width, ' stroke-linecap="round" stroke-linejoin="round"')


def block(x, y, w, h, r, depth, surface, side="edge"):
    return (
        rect(x+depth*.64, y+depth, w, h, r, side)
        + path(f"M{x+w-r} {y+1}l{depth*.64} {depth}v{h-2*r}l{-depth*.64} {-depth}Z", side)
        + rect(x, y, w, h, r, surface)
        + f'<rect x="{x+1.1}" y="{y+1.1}" width="{w-2.2}" height="{h-2.2}" rx="{max(0,r-1)}" fill="none" stroke="#fffdf0" stroke-opacity=".47" stroke-width="2.2"/>'
        + stroke(f"M{x+r} {y+h-2}h{w-2*r}", "#302e25", 1.1)
    )


def paper(x, y, w, h, count=5, number=False):
    sheet = block(x,y,w,h,9,8,"ivory")
    if number:
        return sheet
    length = w*.63
    return sheet + "".join(
        rect(x+15,y+34+i*13,round(length*(.75 if i == count-1 else 1)),3,1.5,"#a5ac9d")
        for i in range(count)
    )


def coil(x,y):
    loop = f"M{x} {y+21}c-9-2-12-6-12-14 0-9 5-15 12-15 7 0 11 5 11 12v9"
    return oval(x,y+18,8,4,"#182c24")+stroke(loop,"#192f29",10)+stroke(loop,"steel",7)+stroke(f"M{x-7} {y+7}c0-6 2-9 6-11","#fffaf2",1.6)


def calendar(x=56,y=47,w=188,h=151,kind="month"):
    cover = block(x,y,w,h,13,13,"ivory")
    band = path(f"M{x} {y+14}Q{x} {y} {x+14} {y}h{w-28}q14 0 14 14v{25}H{x}Z", "red" if kind=="add" else "green")
    band += stroke(f"M{x+12} {y+38}h{w-24}","#133c2b",2)
    rings = coil(x+w*.23,y+3)+coil(x+w*.76,y+3)
    if kind=="empty":
        return cover+band+rings
    rows = 1 if kind=="week" else 3
    pitch = (w-28)/7
    row = (h-55)/rows
    details = []
    for i in range(rows):
        for j in range(7):
            a=x+14+j*pitch
            b=y+49+i*row
            color="red" if j==5 and i==1 else "gold" if j==1 and i==0 else "#c8cdbb" if j<5 else "#d9d2bf"
            details.append(rect(round(a,1),round(b,1),round(pitch-3,1),round(row-5,1),3,color))
    return cover+band+rings+"".join(details)


def desk_calendar(kind="month"):
    # The cover and grid share a parallel projection. The paper edges and stand
    # have distinct light-facing and shadow-facing surfaces.
    x, y, w, h = (52, 74, 221, 108) if kind == "week" else (53, 51, 210, 149)
    side = "red-side" if kind == "add" else "green-side"
    band = "red" if kind == "add" else "green"
    stand = (
        path(f"M{x+16} {y+h-1}l23 37h{w-32}l16-40Z", side)
        + path(f"M{x+w-4} {y+4}l21 27-6 {h-15}-20 24 4-39Z", "green-side")
        + path(f"M{x+39} {y+h+36}l{w-32} 0 15-21-27 6H{x+28}Z", "brass")
    )
    sheet = block(x, y, w, h, 11, 12, "ivory", "edge")
    sheet += "".join(stroke(f"M{x+9} {y+h+i}h{w-18}", "#706654", .6) for i in (1, 3, 5, 7))
    sheet += path(f"M{x} {y+10}q0-10 12-10h{w-24}q12 0 12 10v27H{x}Z", band)
    sheet += stroke(f"M{x+10} {y+35}h{w-20}", "#f7ead2", 1.3)
    sheet += coil(x+w*.25, y+2) + coil(x+w*.75, y+2)
    cols = (w-24)/7
    rows = 1 if kind == "week" else 3
    cell = (h-58)/rows
    for j in range(7):
        column = x + 12 + j*cols
        sheet += rect(column + 4, y+43, cols-8, 4, 2, "red-side" if j >= 5 else "green")
        for row in range(rows):
            top = y + 54 + row*cell
            face = "red" if (j, row) == (5, min(1, rows-1)) else "gold" if (j, row) == (1, 0) else "#eaece0"
            sheet += rect(column, top, cols-3.4, cell-3.2, 3, face, "#b4b5a3")
            sheet += rect(column+4, top+4, min(8, cols-10), 3, 1, "#694a32" if face=="gold" else "#eee9db" if face=="red" else "#51685a")
    sheet += path(f"M{x+w-24} {y+h}q9-12 23-22v11q0 11-7 11Z", "edge")
    return group(stand+sheet, "translate(0 18) matrix(.94 -.105 .10 .95 -4 0)")


def folded_sheet(x, y, w, h):
    corner = 25
    face = f"M{x} {y+8}q0-8 9-8h{w-corner-9}l{corner} {corner}v{h-corner-8}q0 8-8 8h{-w+16}q-8 0-8-8Z"
    sheet = group(path(face, "edge", "#867c69", 1.6), "translate(4 7)")
    sheet += path(face,"ivory","edge",1.35)
    sheet += path(f"M{x+w-corner} {y}l{corner} {corner}h{-corner+6}q-6 0-6-6Z", "edge", "#a79c87", .85)
    sheet += stroke(f"M{x+11} {y+14}v{h-28}", "#fdfcf4", 1.75)
    sheet += rect(x+18, y+30, w*.49, 9, 2, "green")
    for index in range(5):
        sheet += rect(x+18, y+50+index*12, round(w*(.64 if index < 4 else .47)), 3, 1.5, "#a9ac9c")
    return sheet

def coin(x,y,r,face="green",rim="brass",symbol="check"):
    medal = oval(x+4,y+6,r,r,rim)+oval(x,y,r,r,"gold")+oval(x,y,r-4,r-4,face)
    medal += path(f"M{x-r+8} {y-6}a{r-8} {r-8} 0 0 1 {r} {-r+10}", "none", "#fffce5", 1.6, ' opacity=".66"')
    mark = {
        "check":f"M{x-r*.45} {y+1}l{r*.3} {r*.28} {r*.57} {-r*.62}",
        "plus":f"M{x-r*.45} {y}h{r*.90}M{x} {y-r*.45}v{r*.90}",
        "alert":f"M{x} {y-r*.48}v{r*.59}m0 {r*.27}v.4",
        "down":f"M{x} {y-r*.48}v{r*.85}m{-r*.34} {-r*.34}l{r*.34} {r*.35} {r*.34} {-r*.35}",
        "arrow":f"M{x-r*.4} {y+r*.4}l{r*.8} {-r*.8}m{-r*.55} 0h{r*.55}v{r*.55}",
    }[symbol]
    return medal+stroke(mark,"#fff9e4",max(3,r*.14))


def shield(x,y,scale=1):
    s = path("M0 15 52 0l52 15v39c0 32-24 51-52 65C24 105 0 86 0 54Z","green", "brass", 4)
    s += path("M4 19 52 5l47 14v34c0 25-21 46-47 60C26 99 4 79 4 54Z","none","gold",2)
    s += path("M9 26 51 13v91C26 91 11 75 9 50Z","#d6ead7",extra=' opacity=".11"')
    s += stroke("M29 55l16 15 30-34","#fcf5df",9)
    return group(s,f"translate({x} {y}) scale({scale})")


def clipboard(variant):
    s=block(67,39,154,167,17,13,"green","green-side")+paper(80,54,126,141,0)
    s+=block(113,33,60,40,11,5,"steel","brass")
    s+=oval(143,45,8.5,4.5,"#40584b")+oval(142,44,6.5,2.7,"#c1d0c2")
    for j in range(3):
        y=106+j*23
        s+=rect(97,y,14,14,3,"#bdccba")+rect(121,y+4,63-j*7,5,2,"#9aaa9e")
        if variant=="tasks":
            s+=stroke(f"M99 {y+6}l4 4 7-8","#32664b",3)
    if variant=="personal": s+=coin(204,161,33)
    return group(s,"rotate(-9 153 132)")


def parcel():
    s=path("M52 92 151 54 262 90 160 139Z","red")
    s+=path("M52 92l108 47v87L58 192Z","red","red-side",1.7)
    s+=path("M160 139l102-49-8 102-94 34Z","red-side")
    s+=path("M58 110l102 42 100-45v10l-100 46-100-40Z","#451920",extra=' opacity=".38"')
    s+=path("M95 110l23 9 97-41-20-8ZM115 119l19 8 93-44 17 6-88 47v89l-23-12v-85Z","gold")
    s+=path("M147 95C111 66 93 82 87 55c-9-43 38-31 63 11 8-32 39-50 52-39 28 23-14 53-45 65l8 13Z","gold","brass",2)
    s+=path("M145 83C122 51 102 40 102 54c1 11 27 23 43 29Zm12-4c13-23 34-36 39-28 2 9-25 21-39 28Z","leather-side")
    return s+stroke("M58 96l102 46 97-47","#ffcfb1",2)


def case(color="leather", side="leather-side", wheels=False):
    s=block(53,74,198,128,19,17,color,side)
    s+=stroke("M123 79V59q1-18 28-18h7q27 0 27 18v20",side,18)
    s+=stroke("M123 72V57q3-15 28-15h7q24 0 27 15v15","brass",7)
    s+=rect(52,74,199,55,17,color)
    s+=stroke("M61 123q95 22 181 0", "#3e2d27",2.6)
    s+=stroke("M63 89Q150 77 241 88","#fff6d7",1.8)
    for px in (101,186):
        s+=block(px,118,27,31,5,5,"gold","brass")+rect(px+7,126,13,8,2,side)
    if wheels:
        s+=oval(98,214,12,10,"#27352e")+oval(215,212,11,9,"#27352e")
        s+=rect(220,94,44,31,6,"red")+stroke("M229 107h27","#ffefd1",2)
    return group(s,"rotate(-7 152 135) skewX(4)")


def instrument(clock=False, repeat=False):
    cx,cy,r=148,126,80
    s=oval(cx+14,cy+13,r,r,"green-side")+oval(cx+9,cy+6,r,r,"brass")
    s+=oval(cx,cy,r,r,"gold")+oval(cx,cy,r-6,r-6,"brass")+oval(cx,cy,r-11,r-11,"ivory")
    for i in range(12):
        angle=i*pi/6
        a,b=58,65
        s+=stroke(f"M{cx+a*sin(angle):.1f} {cy-a*cos(angle):.1f}L{cx+b*sin(angle):.1f} {cy-b*cos(angle):.1f}","#365448",2.5 if i%3 else 4.1)
    s+=stroke(f"M{cx} {cy-42}v42l32 20","green-side",6)+oval(cx,cy,7,7,"brass")+oval(cx-1,cy-1,3.3,3.3,"gold")
    s+=path("M94 91c31-36 75-38 111-10-33-10-68-4-111 10Z","#fff9e3",extra=' opacity=".54"')
    if clock:
        s+=block(128,31,41,15,7,5,"brass")+rect(137,31,20,5,2,"gold")
    if repeat:
        s+=coin(214,179,33,"red","brass","arrow")
    return s


def notebook(educational=False):
    s=path("M41 65c40-20 82-18 119 0 38-16 77-9 122 11l-21 129c-42-19-79-20-109-1-37-20-75-21-123-5Z","green-side","brass",2)
    s+=path("M41 62c45-15 84-15 119 6l-8 129c-36-19-73-22-118-4Z","ivory","edge",1.5)
    s+=path("M160 68c42-21 78-14 118 3l-20 122c-39-15-73-11-106 4Z","ivory","edge",1.5)
    s+=stroke("M160 69q-4 58-8 128","#8f8b71",2.7)
    for dy in (88,105,122,139,156,170):
        s+=stroke(f"M53 {dy}q49-12 87 3M179 {dy+4}q35-11 76 2","#a3aa98",2.8)
    s+=path("M219 67l13-2-12 87-6-10-10 8Z","red")
    if educational:
        s+=path("M94 56l65-25 58 25-58 29Z","green","brass",1.5)+path("M127 68v20q33 17 65-1V69l-33 14Z","green-side")
        s+=stroke("M169 55l43 8v22","gold",3)+oval(211,89,3,7,"gold")
    return s


def pencil(x,y,angle,color="red"):
    s=block(0,0,114,13,3,4,color,"red-side" if color=="red" else "green-side")
    s+=path("M110 0 141 6.5 111 13Z","edge")+path("M129 4 143 6.5 130 9Z","#24332a")
    s+=rect(0,0,19,13,3,"gold")+stroke("M23 3h78","#fef7d8",1.5)
    return group(s, f"translate({x} {y}) rotate({angle})")


def document(mode):
    s=group(folded_sheet(100,42,133,165),"rotate(16 168 132)")
    s+=group(folded_sheet(62,29,141,172),"rotate(-10 142 113)")
    if mode in ("pdf","ics"):
        # Oversized lettering remains legible when the image is used at 29 px.
        label = (
            "M0 22V1h9c9 0 9 11 0 11H0m25 10V1h6c14 0 14 21 0 21zm25 0V1h15M50 11h12" if mode=="pdf"
            else "M0 1h15M7 1v21M0 22h15m24-18c-4-6-18-4-18 7s14 14 18 8m23-15c-6-7-17-4-17 1 0 7 18 4 18 12 0 6-13 9-19 2"
        )
        band=block(77,143,116,46,8,7,"red" if mode=="pdf" else "green","red-side" if mode=="pdf" else "green-side")
        band+=group(stroke(label,"#fff9e6",4.4),"translate(102 154)")
        return s+group(band,"rotate(-10 142 113)")
    if mode=="privacy":
        return s+shield(149,97,1.0)
    return s+coin(207,168,36,"green","brass","down")


def moon(x=153,y=123,r=81):
    s=oval(x,y,r,r,"moonlit")
    for base_x,base_y,base_r in [(-.43,-.27,.18),(-.10,-.49,.08),(.30,-.20,.15),(.38,.2,.06),(-.33,.28,.11),(.17,.41,.14),(-.02,.13,.059),(.02,.69,.07),(.61,.01,.08)]:
        m=x+base_x*r
        n=y+base_y*r
        w=base_r*r
        s+=oval(round(m+.7,2),round(n+1.1,2),round(w,2),round(w*.79,2),"#f4efe0",' opacity=".27"')
        s+=oval(round(m,2),round(n,2),round(w,2),round(w*.72,2),"#41473d",' opacity=".20"')
        s+=path(f"M{m-w*.65:.2f} {n:.2f}q{w*.65:.2f} {-w*.72:.2f} {w*1.3:.2f} 0","none","#676e5f",1.1,' opacity=".48"')
    s+=path(f"M{x-r*.82:.2f} {y-r*.38:.2f}a{r*.91:.2f} {r*.95:.2f} 0 0 1 {r*1.18:.2f} {-r*.51:.2f}", "none", "#fffcec", 1.4, ' opacity=".6"')
    return s


def solar(rising=False):
    s=oval(159,107,69,69,"sunlit")
    if not rising:
        for i in range(12):
            a=i*pi/6
            def xy(radius, delta=0): return f"{159+radius*sin(a+delta):.2f} {107+radius*cos(a+delta):.2f}"
            s=path(f"M{xy(76,-.091)}Q{xy(97,-.065)} {xy(109)}Q{xy(97,.065)} {xy(76,.091)}Z","gold")+s
        return s
    s+=path("M43 146q38-5 74 0t77 0 82-1l-8 16q-39 1-76 3-80 8-145-1Z","green")
    s+=path("M61 170c45-5 74 8 112 3 43-7 67-9 90-3l-17 17c-54 1-72 11-110 4-30-6-58-8-75-7Z","sage")
    s+=path("M80 197q91 11 163-3l-11 6q-61 14-141 7Z","brass")
    return s


def flowers():
    s=path("M128 160q-24-49-59-52 6 35 59 52Zm11 13q30-51 73-54-7 42-73 54Z","sage","green",2)
    for x,y,end in [(98,96,140),(149,57,155),(198,92,160)]:
        s+=stroke(f"M{x} {y}Q{x-5} 128 {end} 194","green",5)
    for x,y,petal in [(96,79,"ivory"),(150,55,"red"),(200,86,"gold")]:
        for i in range(5):
            theta=i*2*pi/5
            s+=group(oval(x,y-17,10,20,petal),f"rotate({theta*180/pi:.2f} {x} {y})")
        s+=oval(x,y,10,10,"brass")+oval(x-1,y-2,5,4,"gold")
    s+=path("M80 118q58 36 135 4l-40 83-40 12Z","ivory","edge",1.5)
    s+=path("M80 118q30 33 89 67l-30 32Z","gold")
    s+=path("M110 175q40 4 88-16l-6 14q-44 18-76 17Z","red")
    return s


def tag_pin():
    s=path("M72 93a70 70 0 0 1 140 0c0 42-47 82-70 113-29-31-70-73-70-113Z","red", "red-side", 3)
    s=group(s,"translate(12 9)")+s
    s+=oval(143,91,46,46,"red-side")+oval(143,90,42,42,"brass")+oval(143,90,34,35,"ivory")
    s+=path("M86 79Q95 49 132 37","none","#f9b79c",4,' opacity=".64"')
    return group(s,"rotate(8 146 133)")


def calculator():
    s=block(81,32,143,184,17,16,"green","green-side")
    s+=rect(96,50,112,44,6,"#122f26")+rect(99,53,105,37,4,"glass")
    s+=stroke("M174 64h13l-2 8h-9l-2 9h13m-17-17h-13l-2 8h13l-2 9h-13","#235745",2.5)
    for y in range(3):
        for x in range(4):
            s+=block(96+x*29,105+y*31,23,23,4,3,"red" if x==3 else "ivory","brass")
            s+=rect(102+x*29,114+y*31,10,2.6,1,"#fff3dc" if x==3 else "#667567")
    return group(s,"rotate(-13 146 129)")


def portrait(x,y,scale,shirt,hair):
    s=path("M1 111c1-25 12-37 39-43h14c25 8 38 20 38 43l-4 11H5Z",shirt)
    s+=oval(46,39,34,38,hair)+oval(46,45,28,32,"skin")
    s+=path("M17 38q-9-25 16-34c26-14 55 5 51 34Q57 34 39 19 30 32 17 38Z",hair)
    s+=path("M35 72l11 11 12-11q-1-12 1-14H35Z","skin")
    s+=oval(36,45,2.15,2.3,"#634432")+oval(55,45,2.15,2.3,"#634432")+stroke("M41 60q5 3 10 0","#975c4c",1.5)
    return group(s, f"translate({x} {y}) scale({scale})")


def world():
    s=oval(156,119,71,71,"glass")
    s+=path("M88 98l23-32 32-8 23 14-8 11-25 5-10 22-24 5-10-5Zm67 24 19-18 26 6 12 17-13 10-5 29-18 11-13-24-2-19Z","green")
    s+=path("M193 79l23 2 8 20-20 6-17-14Z","sage")
    s+=path("M85 131c-37 19-48 28-44 40 7 20 79 7 139-15 62-23 103-47 99-60-4-10-31-5-53 1","none","gold",7)
    s+=stroke("M145 189v25m-38 4h96","brass",11)
    s+=oval(251,66,8,8,"sunlit")
    return s


def storage():
    s=group(calendar(49,58,169,140,"week"),"rotate(-11 137 134)")
    return s+shield(149,106,.93)


def not_found():
    s=calendar(52,51,193,150,"empty")
    digits="M0 4 0 23h24M18 2v37m43-19c0 11-4 18-12 18s-12-7-12-18S41 2 49 2s12 7 12 18Zm15-16v19h24M94 2v37"
    s+=group(stroke(digits,"#194e36",6),"translate(90 111) scale(1.12)")
    return group(s,"rotate(-10 145 140)")+coin(235,178,42,"red","brass","alert")


def cloud():
    s=oval(157,158,99,43,"moonlit")
    s+=oval(99,141,48,50,"moonlit")+oval(147,115,59,62,"moonlit")+oval(204,128,50,49,"ivory")
    s+=oval(218,158,42,38,"moonlit")+oval(159,163,87,33,"ivory")
    s+=path("M65 151q12-38 42-35m4-18q10-33 43-40","none","#fffaf2",2.5,' opacity=".69"')
    return s


def cookie():
    s=oval(147,138,99,76,"leather-side")+oval(143,129,99,76,"biscuit")
    s+=path("M59 116q13-48 82-56 51 0 81 35","none","#fff2c6",3,' opacity=".78"')
    for x,y,r in [(95,110,7),(147,87,10),(191,102,9),(129,134,10),(177,143,8),(90,152,7),(139,172,8),(204,155,7),(166,192,6)]:
        s+=path(f"M{x-r} {y}l{r/2} {-r*.8} {r} {-r*.18} {r*.52} {r*.9} {-r*.45} {r*.65} {-r*1.17} {r*.30}Z","leather-side")
        s+=stroke(f"M{x-r*.52} {y-1}l{r*.35} {-r*.52} {r*.5} {-r*.1}","#a27352",1.4)
    return group(s,"rotate(-14 150 132)")


def pen_cup():
    s=pencil(113,151,-80,"green")+pencil(166,152,-92)+pencil(180,153,-52,"green")
    s+=path("M87 107h130l-15 99q-5 21-50 21t-48-21Z","green","green-side",2)
    s+=oval(152,107,65,17,"brass")+oval(152,106,58,12,"#152f25")
    s+=stroke("M111 126l11 70q7 13 30 13","#bbcfb0",3)
    s+=path("M156 99 149 46l5-8 5 7 7 55Zm26-1 17-65 6-3 1 8-17 62Z","gold")
    return s+coin(205,192,31,"red","brass","check")


def mailbox():
    s=group(paper(85,35,145,141,5),"rotate(11 150 125)")
    s+=group(block(45,100,206,102,10,12,"ivory"),"rotate(-7 150 141)")
    s+=path("M47 118 132 163q11 7 22-3l93-62-87 40q-8 5-18 1Z","green-side")
    s+=path("M44 109 139 152q11 5 21-2l81-58-9-5-181 10Z","edge")
    s+=path("M52 172l65-27m58-3 65 25","none","#8f907b",2)
    return s+coin(239,162,29,"red","brass","check")


def seasons():
    s=group(calendar(63,54,171,141),"rotate(-9 149 120)")
    s+=path("M214 187q26-82 67-68-3 49-67 68Z","sage","green",2)
    s+=path("M213 183q-13-75-54-60-1 41 54 60Z","red","red-side",2)
    s+=stroke("M209 199q17-42 57-68m-53 53q-20-29-45-47","brass",3.2)
    return s


def logotype():
    s=group(calendar(60,45,198,153),"rotate(-7 160 128)")
    s+=block(201,171,70,46,8,7,"ivory","edge")+rect(205,174,62,12,3,"gold")
    s+=rect(205,186,62,11,0,"green")+rect(205,197,62,14,3,"red")
    return s


def rendered(content):
    shadow = oval(159,225,128,16,"shadow")+oval(162,222,86,11,"shadow")
    all_art=shadow+f'<g filter="url(#occlusion)">{content}</g>'
    definitions = ['<filter id="occlusion" x="-15%" y="-18%" width="135%" height="145%"><feDropShadow dx="2.5" dy="4" stdDeviation="3.1" flood-color="#172f21" flood-opacity=".22"/><feDropShadow dx=".7" dy="1.2" stdDeviation=".6" flood-color="#2a271e" flood-opacity=".23"/></filter>']
    for key, stops in {**PALETTE, **RADIAL}.items():
        if f"url(#{key})" not in all_art:
            continue
        tag = "radialGradient" if key in RADIAL else "linearGradient"
        direction = 'cx=".33" cy=".24" r=".79"' if key in RADIAL else 'x1=".14" y1="0" x2=".9" y2="1"'
        if key=="shadow": direction='cx=".5" cy=".5" r=".5"'
        markup = "".join(f'<stop offset="{stop[0]}" stop-color="{stop[1]}"'+(f' stop-opacity="{stop[2]}"' if len(stop)>2 else "")+"/>" for stop in stops)
        definitions.append(f'<{tag} id="{key}" {direction}>{markup}</{tag}>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 260"><defs>{"".join(definitions)}</defs>{all_art}</svg>\n'


def main():
    images = {
        "astronomy": world(),
        "briefcase": case(),
        "calculator": calculator(),
        "calendar": desk_calendar(),
        "calendar-add": desk_calendar("add")+coin(228,178,37,"green","brass","plus"),
        "celebrations": parcel(),
        "clock": instrument(clock=True),
        "create": group(calendar(47,42,181,153),"rotate(-10 142 128)")+pencil(217,180,-62),
        "download": document("download"),
        "family": portrait(82,44,1.19,"green","leather-side")+portrait(153,50,1.13,"red","leather")+portrait(127,108,.92,"gold","leather-side"),
        "ics": document("ics"),
        "location": tag_pin(),
        "month": desk_calendar(),
        "moon": moon(),
        "names": flowers(),
        "not-found": not_found(),
        "pdf": document("pdf"),
        "personal": clipboard("personal"),
        "phases": moon(96,126,50)+moon(162,124,55)+moon(228,126,50)+path("M226 76a50 50 0 0 1 0 100c20-13 24-80 0-100Z","green-side",extra=' opacity=".8"'),
        "privacy": document("privacy"),
        "school": notebook(True),
        "seasons": seasons(),
        "shift": instrument(repeat=True),
        "storage-notice": storage(),
        "sun": solar(),
        "sunrise": solar(True),
        "tasks": clipboard("tasks"),
        "tools": pen_cup(),
        "vacation": case("green","green-side",True),
        "week": desk_calendar("week"),
        "brand": logotype(),
        "cloud": cloud(),
        "cookie": cookie(),
        "contact": mailbox(),
        "note": group(notebook(),"rotate(-9 160 128)")+pencil(220,189,-71,"green"),
        "shield": shield(92,38,1.34),
        "stack": group(block(67,74,159,108,14,16,"red","red-side")+block(72,56,159,108,14,16,"gold","brass")+block(77,38,159,108,14,16,"green","green-side"),"rotate(-11 153 132)"),
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, content in images.items():
        (OUTPUT / f"{name}.svg").write_text(rendered(content), encoding="utf-8")


if __name__ == "__main__":
    main()
