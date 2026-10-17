"""Original Lithuanian seasonal illustration system. No stock paths or embedded images."""
from pathlib import Path
from html import escape
import math, json, re, hashlib
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'site/assets/visuals/2027-monthly-holidays'
OUT.mkdir(parents=True,exist_ok=True)

def path(d,fill='none',stroke=None,sw=2,**kw):
    a={'d':d,'fill':fill}
    if stroke:a.update(stroke=stroke,**{'stroke-width':sw,'stroke-linecap':'round','stroke-linejoin':'round'})
    a.update(kw)
    return '<path '+ ' '.join(f'{k.replace("_","-")}="{v}"' for k,v in a.items())+'/>'
def ellipse(x,y,rx,ry,fill,op=1):return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" opacity="{op}"/>'
def circle(x,y,r,fill,op=1):return ellipse(x,y,r,r,fill,op)
def rect(x,y,w,h,fill,rx=0,**kw):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" '+ ' '.join(f'{k.replace("_","-")}="{v}"' for k,v in kw.items())+'/>'
def group(s,t='',**kw):return f'<g transform="{t}" '+ ' '.join(f'{k.replace("_","-")}="{v}"' for k,v in kw.items())+'>'+s+'</g>'
def line(x1,y1,x2,y2,col,sw=2,**kw):return path(f'M{x1} {y1}L{x2} {y2}','none',col,sw,**kw)
def gradient(name,stops,rad=False):
    tag='radialGradient' if rad else 'linearGradient'
    attrs='cx="32%" cy="20%" r="85%"' if rad else 'x1="0" y1="0" x2="1" y2="1"'
    return f'<{tag} id="{name}" {attrs}>'+''.join(f'<stop offset="{i/(len(stops)-1):.3f}" stop-color="{c}"/>' for i,c in enumerate(stops))+f'</{tag}>'
DEFS=''.join(gradient(n,c,r) for n,c,r in [
 ('gold',['#fff0bc','#e5b655','#aa7028'],False),('amber',['#ffe2a2','#d29946','#885323'],True),
 ('wood',['#dfba85','#b58050','#724d35'],False),('brick',['#bd785a','#935540','#613e36'],False),
 ('leaf',['#a8be87','#4e815e','#1d5144'],False),('paper',['#fffef5','#f4ead8','#dfcbb0'],False),
 ('ivory',['#fffff9','#f4e5c7','#c4ac87'],True),('glass',['#d8e5dc','#f4f8ef','#7d9b91'],False),
 ('red',['#ecb49b','#b54e42','#713131'],True),('green',['#8bae88','#285e51','#123e38'],True),
 ('pink',['#fff0e8','#d9929a','#9c5969'],True),('flame',['#fff8bf','#f5c858','#c96830'],False),
 ('night',['#163b49','#274b57','#7c8b87'],False),('snow',['#fcfdfb','#c7d9db','#95b3bb'],False),
 ('spring',['#f1f2dc','#deebda','#b1cebb'],False),('linen',['#faf3e3','#e8dbc5','#ccba9b'],False)
])+'<pattern id="weave" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 1H10M1 0V10" stroke="#a68c68" stroke-width=".7" opacity=".18"/></pattern>'

def leaf(x,y,s=1,rot=0,col='url(#leaf)'):
    s1=path('M0 0C-24-31-25-66 0-98C24-67 24-30 0 0',col)+path('M0-6V-85M0-34L-12-51M0-51L12-69','none','#dbe5be',1.5,opacity='.6')
    return group(s1,f'translate({x} {y}) rotate({rot}) scale({s})')
def oak(x,y,s=1,rot=0,col='url(#leaf)'):
    d='M0 0C-9-15-34-11-29-29C-52-35-36-52-24-51C-44-75-22-78-13-70C-20-93-2-106 8-89C24-93 30-71 16-63C46-72 47-48 27-42C48-27 25-12 11-17Z'
    return group(path(d,col)+path('M3 0L3-81M3-36L-20-49M3-54L18-66','none','#dfdbab',1.5,opacity='.6'),f'translate({x} {y}) rotate({rot}) scale({s})')
def flower(x,y,s=1,col='#c5d2ed'):
    petals=''.join(ellipse(0,-14,10,18,col) if i==0 else group(ellipse(0,-14,10,18,col),f'rotate({i*72})') for i in range(5))
    return group(petals+circle(0,0,6,'#e5b557')+circle(-1,-1,2,'#fff1c2'),f'translate({x} {y}) scale({s})')
def wheat(x,y,s=1,rot=0):
    a=path('M0 0Q4-72 0-200','none','#977135',3)
    for i in range(7):
        yy=-75-i*16
        a+=group(path('M0 0Q-35-8-22-29Q2-20 0 0','url(#gold)')+line(-4,-8,-17,-22,'#f5d691',1),f'translate(0 {yy})')
        a+=group(path('M0 0Q35-8 22-29Q-2-20 0 0','url(#gold)'),f'translate(0 {yy-7})')
    return group(a,f'translate({x} {y}) rotate({rot}) scale({s})')
def fir(x,y,s=1):
    a=path('M0 0Q75-114 170-200','none','#436251',4)
    for i in range(12):
        t=i/12; xx=170*t; yy=-200*t
        a+=path(f'M{xx-32} {yy-7}L{xx+10} {yy-8}L{xx+27} {yy+26}','none','#4a745d',2)
    return group(a,f'translate({x} {y}) scale({s})')
def candle(x,y,s=1):
    a=ellipse(0,163,83,15,'#162f35',.16)
    a+=path('M-50-15Q-55 50-52 140Q0 163 52 140L50-15Z','url(#glass)','#81988f',2)
    a+=path('M-40 29L-38 128Q0 144 39 128L39 28Z','url(#ivory)')
    a+=ellipse(0,28,39,9,'#f7ecd2')+line(0,26,0,17,'#59504b',3)
    a+=path('M0 22C-14 9-2-4 2-11C0 0 14 10 0 22','url(#flame)')
    a+=path('M-50-16Q0-36 50-16L55-4Q0 10-55-4Z','url(#gold)','#ad8b4b',2)
    a+=path('M-53-16Q0-41 53-16','none','#fff0be',3)
    a+=path('M-32 2Q-40 61-31 127','none','#fff',5,opacity='.65')+path('M43 4V126','none','#e9f5ea',2)
    return group(a,f'translate({x} {y}) scale({s})')
def tower(x,y,s=1,snow=False):
    a=path('M-88 0L-88-184L-55-211L51-211L84-186V0Z','url(#brick)','#754d41',2)
    a+=path('M51-211L84-186V0H51Z','#704d40')
    a+=path('M-88-184H51L84-186M51-184V0','none','#d39c78',3)
    for yy in [-165,-111,-56]:
        a+=path(f'M-18 {yy+30}V{yy}Q-8 {yy-20} 3 {yy}V{yy+30}Z','#3d3935')
        a+=path(f'M58 {yy+26}V{yy}Q65 {yy-14} 72 {yy}V{yy+26}Z','#40382f')
    a+=path('M-95-210H-66V-188H-35V-210H-3V-188H27V-210H55V-190H85V-215H93V-171H-95Z','url(#brick)','#754d41',2)
    for yy in range(-151,-8,22):a+=line(-80,yy,45,yy,'#a97a60',1.3,opacity='.55')
    if snow:a+=path('M-95-211H-66M-35-211H-3M27-211H55M85-214H93','none','#f7fcfa',7)
    a+=line(-4,-217,-4,-318,'#5b5b4c',3)+path('M-2-316Q35-327 58-311L58-299Q31-315-2-304Z','#e9b444')+path('M-2-304Q31-315 58-299V-287Q31-302-2-292Z','#006a44')+path('M-2-292Q31-302 58-287V-275Q30-289-2-280Z','#bd4340')
    return group(a,f'translate({x} {y}) scale({s})')
def egg(x,y,s=1,rot=0,col='url(#green)',style=0):
    shape='M0-150C-68-150-112-24-102 40C-90 143 87 143 102 40C113-23 65-150 0-150Z'
    a=ellipse(8,132,100,15,'#203e35',.13)+path(shape,col,'#786248',1.3)
    a+=path('M-49-115C-84-64-96-7-86 49','none','#fff9dd',5,opacity='.22')
    for yy in [-70,10,80]:
        a+=path(f'M-84 {yy}Q0 {yy+28} 84 {yy}','none','#f4deb1',3,opacity='.9')
    if style==0:
        for ang in range(0,360,45):
            a+=group(path('M0-12C-21-27-11-57 0-65C11-45 20-24 0-12','#f4dfb7'),f'rotate({ang}) translate(0 -5)')
        a+=circle(0,0,10,'#f4dfb7')
    else:
        for xx in [-53,-18,18,53]:
            a+=path(f'M{xx} 50V-40M{xx-14} 28L{xx} 13L{xx+14} 28M{xx-14} 5L{xx}-10L{xx+14} 5','none','#f9e8c5',3)
    return group(a,f'translate({x} {y}) rotate({rot}) scale({s})')
def book(x,y,s=1,rot=0):
    a=ellipse(10,88,250,28,'#263d33',.13)
    a+=path('M-245-65Q-115-110 0-46Q113-112 244-65L244 72Q112 32 0 96Q-119 32-245 72Z','#31584f','#29453e',3)
    a+=path('M-232-82Q-106-122 0-58L0 78Q-111 18-232 57Z','url(#paper)','#c8bda4',1)
    a+=path('M0-58Q112-122 232-82L232 57Q113 18 0 78Z','url(#ivory)','#c8bda4',1)
    a+=path('M-229 64Q-106 26 0 87Q111 27 229 64M-224 70Q-106 34 0 92','none','#e9d7b8',3)
    for yy in [-55,-37,-19,-1,17]:
        a+=path(f'M-205 {yy}Q-108 {yy-22}-31 {yy+12}M31 {yy+12}Q111 {yy-22}205 {yy}','none','#bfbaa3',2,opacity='.7')
    a+=path('M3-57V78','none','#b5a38b',3)
    a+=path('M149-94V30L164 17L181 31V-98Z','#b54e42')
    return group(a,f'translate({x} {y}) rotate({rot}) scale({s})')
def tulip(x,y,s=1,rot=0,col='url(#pink)'):
    a=path('M0 100C10 20-13-37 0-100','none','#648665',6)
    a+=path('M-1 64C-60 40-83-12-71-45C-39-10-22 11-1 64','url(#leaf)')
    a+=path('M1 40C62 7 68-32 50-63C42-22 17 0 1 40','url(#leaf)')
    a+=path('M0-69C-64-74-85-122-64-174L-28-152L0-199L29-153L61-173C86-119 51-74 0-69',col,'#ad6874',1.5)
    a+=path('M0-72Q-36-119-29-155M0-74Q38-120 29-154','none','#fff0d8',2,opacity='.45')
    return group(a,f'translate({x} {y}) rotate({rot}) scale({s})')
def straw(x,y,s=1):
    a=line(0,-205,0,-135,'#d1b880',2)
    coords=[(0,-135),(-105,0),(0,136),(105,0)]
    for pts in [[0,1,2,3,0],[0,2],[1,3]]:
        for q,w in zip(pts,pts[1:]):
            p1,p2=coords[q],coords[w]
            a+=line(*p1,*p2,'#aa7b37',8)+line(p1[0]-1,p1[1]-1,p2[0]-1,p2[1]-1,'#f7d994',3)
    for dx in [-105,105]:
        a+=path(f'M{dx} 0V50L{dx-35} 96L{dx} 140L{dx+35} 96V96L{dx} 50M{dx-35} 96H{dx+35}M{dx} 50V140','none','#d6b16c',4)
    a+=path('M0 136V186L-38 226L0 267L38 226Z','none','#d6b16c',4)
    for xx,yy in coords:a+=circle(xx,yy,5,'#fff1bf')
    return group(a,f'translate({x} {y}) scale({s})')
def base(col,light):return rect(0,0,1200,800,col)+ellipse(600,340,485,355,light,.7)

def january():
    a=rect(0,0,1200,800,'url(#night)')+circle(920,180,86,'#e8e9d6',.7)
    a+=path('M0 552Q210 434 410 522Q646 379 873 474Q1030 495 1200 400V800H0Z','#6c8890')
    a+=path('M0 655Q245 490 493 559Q715 481 943 538L1200 502V800H0Z','url(#snow)')
    a+=tower(834,540,1.25,True)
    # Minimal distant Vilnius rooftops; no fictional landmark reconstruction.
    for xx,yy,w in [(90,529,90),(200,545,85),(312,566,70),(1000,556,110)]:
        a+=rect(xx,yy,w,90,'#dce7e6')+path(f'M{xx-9} {yy}L{xx+w/2} {yy-47}L{xx+w+9} {yy}Z','#657f83')+line(xx-6,yy,xx+w+6,yy,'#f6faf6',5)
    a+=path('M0 718Q278 675 532 715T1200 713V800H0Z','#f2f5ef')
    a+=candle(310,580,.86)+flower(457,665,1.7,'#90b5d2')+leaf(476,705,.6,-50)
    a+=''.join(circle(x,y,r,'#fff',.5) for x,y,r in [(86,130,3),(195,245,2),(425,121,3),(580,285,2),(1090,310,3),(500,420,2),(1031,110,2),(708,96,2)])
    return a

def february():
    a=base('#eee8dd','#faf4e5')+ellipse(610,684,455,36,'#9a7954',.13)
    # A document still life, a carved winter mask, and a silk tricolour.
    a+=group(path('M-250-230H235L260 230H-260Z','url(#paper)','#bca987',2)+path('M-235-214H216V206H-235Z','none','#d6c8ad',2)+line(-185,-150,165,-150,'#bea77d',3)+''.join(line(-183,y,155-(y%29),y,'#baa98c',2) for y in range(-101,134,29))+circle(150,145,35,'#b45441')+circle(150,145,27,'none')+path('M141 128L161 158M160 130L140 158','none','#e7b18c',2), 'translate(465 413) rotate(-9)')
    a+=path('M767 217Q931 216 965 348Q955 511 803 603Q656 535 670 370Q678 255 767 217Z','url(#wood)','#7b563c',3)
    a+=path('M765 244Q727 371 733 518M803 243Q854 378 818 551','none','#edcca0',3,opacity='.55')
    a+=path('M695 354Q731 326 754 355Q738 376 700 370ZM814 351Q857 322 891 349Q863 371 820 368Z','#3e392e')
    a+=path('M780 328L743 427L799 435L806 410','url(#amber)','#815334',3)+path('M736 471Q785 450 830 477L817 500Q769 482 742 503Z','#493b2e')
    for xx,yy in [(703,309),(874,298),(843,520),(722,419)]:a+=path(f'M{xx} {yy}l19 7m-17 5l18 5','none','#8c633f',2)
    a+=path('M146 633Q430 494 664 588T1072 604L1088 642Q845 733 635 649T169 676Z','#dfb34e')
    a+=path('M169 676Q432 540 635 649T1088 642L1100 680Q843 771 617 685T188 716Z','#316b53')
    a+=path('M188 716Q427 582 617 685T1100 680L1105 718Q842 800 603 724T207 755Z','#b65445')
    a+=ellipse(231,551,23,16,'url(#amber)')+ellipse(292,569,16,12,'url(#gold)')
    return a

def march():
    a=base('#e9eddd','#f7f5e6')+path('M0 707Q308 648 600 692T1200 690V800H0Z','#d1d8c0')
    # Verba: original arrangements of dried-flower rings and seed heads.
    v=line(0,0,0,-380,'#789163',5)
    for y,c in [(-345,'#a85545'),(-307,'#d8b25d'),(-269,'#64755b'),(-231,'#b9a07b'),(-193,'#b56459')]:
        v+=ellipse(0,y,32,13,c)+ellipse(-1,y-4,28,9,'#fff1c8',.23)
    v+=wheat(0,-359,.28)+path('M-24-145L20-145L10-105L-14-105Z','#b5b18d')
    a+=group(v,'translate(858 600) rotate(17) scale(1.15)')
    a+=group(v,'translate(775 606) rotate(-13) scale(.92)')
    a+=egg(327,478,1.34,-17,'url(#red)',0)+egg(581,563,1.2,14,'url(#green)',1)+egg(842,638,.72,33,'url(#ivory)',0)
    a+=path('M132 724Q367 604 692 727','none','#b5a274',5)
    for xx,yy,r in [(194,703,-55),(228,688,-44),(662,722,55)]:a+=leaf(xx,yy,.6,r)
    a+=path('M96 248Q130 205 184 212M102 263Q160 226 207 238','none','#bb9f68',2)
    return a

def april():
    a=rect(0,0,1200,800,'url(#spring)')+circle(904,160,87,'#fbf2ca',.9)
    a+=path('M0 440Q229 290 467 421T1200 396V800H0Z','#abc2a0')+path('M0 553Q271 415 548 520Q915 349 1200 484V800H0Z','#7fa88c')
    a+=path('M0 700Q350 585 754 672T1200 628V800H0Z','#517f67')
    # A small rural timber homestead, not a claimed exact heritage building.
    a+=path('M723 425V343L853 288L975 342V425Z','#d9c49c')+path('M694 347L852 251L1005 347L978 360L852 287L716 361Z','#6d7561')
    a+=rect(824,354,38,71,'#7c775a')+rect(749,360,42,34,'#dce3c8')+rect(899,360,42,34,'#dce3c8')
    a+=path('M680 800Q649 662 831 430L865 430Q737 655 810 800Z','#c8c7a5')
    a+=book(363,608,.85,-8)+path('M362 549Q349 407 399 290','none','#59775a',8)
    a+=oak(377,457,1.1,-45)+oak(384,375,.9,47)+oak(394,314,.63,-22)
    for xx,yy in [(147,621),(547,598),(600,720)]:a+=flower(xx,yy,.65,'#eef1de')
    a+=path('M106 220Q161 161 217 219M217 219Q271 162 326 220','none','#6e8773',3)
    return a

def may():
    a=base('#f4e8e5','#fff7ec')+path('M0 680Q397 623 1200 697V800H0Z','url(#linen)')
    a+=path('M174 689L474 615L901 734L638 800H192Z','#faf3df')+path('M174 689L474 615L901 734L638 800H192Z','url(#weave)')
    a+=book(826,620,.7,12)+ellipse(441,698,125,26,'#a4887c',.16)
    a+=tulip(417,484,1.18,-23)+tulip(441,473,1.23,11)+tulip(488,478,1.03,34,'url(#red)')
    a+=path('M368 461Q435 445 499 461L522 648Q516 705 436 712Q351 700 348 649Z','url(#glass)','#a7b7aa',2)
    a+=ellipse(434,463,66,13,'#d3ded2')+path('M364 553Q435 575 509 551V643Q506 692 437 696Q366 686 360 643Z','#bbd2bf',opacity='.4')
    a+=path('M377 481L367 633Q369 669 392 681','none','#fff',7,opacity='.65')
    a+=path('M419 496L429 680M466 483L440 681M487 500L445 679','none','#7c9c78',4,opacity='.65')
    a+=path('M922 480Q970 424 1016 473Q1057 425 1105 481','none','#bea2a0',2)
    return a

def june():
    a=rect(0,0,1200,800,'#183f43')+ellipse(608,270,520,320,'#346663',.6)+circle(905,176,65,'#e9d8ad',.92)
    a+=path('M0 439Q230 309 473 422Q743 330 1200 410V800H0Z','#244b45')+path('M0 517Q315 473 639 508T1200 499V800H0Z','#3b6a61')
    a+=path('M0 630Q433 565 1200 627V800H0Z','#214d42')
    a+=path('M700 528Q820 551 1029 526M753 565Q869 578 997 562M826 606H951','none','#d4c397',2,opacity='.35')
    a+=line(855,597,924,623,'#4e3c2d',14)+line(855,624,927,594,'#6c5135',14)
    a+=path('M884 610C811 568 866 530 875 486C922 532 910 535 931 558C954 597 910 620 884 610','url(#flame)')+path('M887 604C858 578 892 565 892 548C929 586 904 608 887 604','#fff0b3')
    # Braided oak wreath, varied leaves rather than a ring of identical icons.
    a+=ellipse(398,564,211,148,'none')+path('M191 530C218 331 577 317 616 528C652 738 226 751 191 530Z','none','#76885c',24)
    for i in range(18):
        th=math.radians(i*20); x=398+204*math.cos(th);y=533+155*math.sin(th)
        a+=oak(round(x,1),round(y,1),.7+(i%3)*.1,i*20+65)
    for xx,yy,sc in [(226,422,.7),(560,434,.65),(513,673,.8),(196,599,.6)]:a+=flower(xx,yy,sc,'#f1e9d0')
    a+=path('M142 800Q116 625 82 526M143 744L73 677M138 708L185 644M128 660L67 609','none','#5c8c71',6)
    return a

def july():
    a=rect(0,0,1200,800,'#e7eee2')+circle(941,191,111,'#f5df9a',.7)
    a+=path('M0 510Q222 408 520 469Q830 353 1200 437V800H0Z','#aac1a0')
    a+=path('M400 626Q672 267 920 508Q1018 603 1200 603V800H0Z','#5c8c6a')
    a+=tower(725,421,.98)
    a+=path('M0 704Q206 643 418 687Q766 575 1200 690V800H0Z','#366c55')
    a+=path('M0 741Q362 720 558 800H0Z','#b2d4c8')+path('M13 760Q214 755 336 788','none','#eaf1dc',3)
    # Symbolic crown, deliberately not a reconstruction of Mindaugas's lost crown.
    a+=ellipse(294,647,177,23,'#173c34',.14)
    a+=path('M139 464L177 603Q292 649 410 602L450 461L368 521L300 407L228 522Z','url(#gold)','#a17c3e',3)
    a+=path('M177 603L184 633Q293 677 403 632L410 602Q292 644 177 603Z','url(#amber)','#a17c3e',3)
    a+=path('M155 474L183 581Q292 622 402 581L431 480','none','#fff0b9',4)
    for xx,yy in [(139,460),(300,403),(450,458)]:a+=circle(xx,yy,12,'url(#gold)')
    a+=ellipse(291,592,16,20,'#577b6c')+ellipse(218,587,9,11,'#a9483d')+ellipse(369,585,9,11,'#a9483d')
    a+=oak(1004,718,1.2,49)+oak(1083,725,.9,-13)
    return a

def august():
    a=base('#f2e6ca','#fff3d9')+path('M0 620Q354 512 664 608T1200 592V800H0Z','#c8bc8c')
    a+=path('M0 705Q370 613 1200 719V800H0Z','url(#linen)')+ellipse(615,710,230,29,'#876d3c',.14)
    for x,y,sc,rot in [(517,681,1.7,-31),(578,692,1.9,-10),(620,697,1.75,14),(674,692,1.7,31),(711,687,1.4,46)]:a+=wheat(x,y,sc,rot)
    for x,y,rot,sc in [(547,628,-48,1.45),(642,619,36,1.8),(704,635,62,1.35),(598,614,-8,1.7)]:
        a+=leaf(x,y,sc,rot)+line(x,y,x+math.sin(math.radians(rot))*110,y-145,'#71835a',3)
    for x,y,sc,c in [(451,404,1.3,'#b492a2'),(558,315,1.2,'#d5b55b'),(678,348,1.5,'#e9dfb2'),(763,453,.95,'#b88b99'),(604,420,.7,'#e0bd61')]:a+=flower(x,y,sc,c)
    a+=path('M522 618Q603 644 698 615L690 653Q600 676 526 651Z','#597361')+path('M576 654L539 749L596 722L618 761L642 657Z','#a95d46')
    a+=path('M537 635Q609 657 690 633','none','#e0d2a8',3)
    return a

def september():
    a=base('#eee7d7','#faf2df')+path('M0 658L1200 596V800H0Z','#cfb58c')
    a+=path('M0 703L1200 644M0 754L1200 698','none','#ad9068',2,opacity='.45')
    a+=book(598,539,1.45,-5)
    # Fountain pen in perspective, ruled exercise book, and a chestnut branch.
    a+=group(path('M0-188H23L28 119L13 162L-3 119Z','url(#green)','#244f42',2)+path('M0-187Q12-211 23-187V-118H0Z','url(#gold)')+path('M-3 119L13 162L28 119L13 134Z','url(#gold)')+line(13,137,13,155,'#343e35',2)+line(20,-175,20,-130,'#f9e5ac',3), 'translate(923 499) rotate(36)')
    a+=path('M95 640Q177 508 251 361','none','#916e42',5)
    for xx,yy,ang,sc in [(146,568,-58,1.15),(184,497,46,1.3),(224,421,-30,.85)]:a+=oak(xx,yy,sc,ang,'url(#amber)')
    a+=ellipse(305,669,37,29,'url(#wood)')+path('M280 652Q303 628 329 652Q315 658 280 652','#dfbc8a')
    a+=rect(431,693,280,31,'#a95548',5)+rect(439,688,265,12,'#f0e5ca',2)+path('M478 720V750L494 741L510 752V720Z','#49715b')
    return a

def october():
    a=base('#eee0ce','#f9eddb')+ellipse(602,695,353,34,'#866948',.14)
    # A bound civic document and brass fountain nib; no fake official seal/text.
    a+=group(rect(-211,-250,416,471,'url(#green)',16)+rect(-196,-237,389,444,'none',10,stroke='#c4ad70',stroke_width=2)+rect(-185,-224,365,414,'none',6,stroke='#779080',stroke_width=1)+line(-156,-211,-156,193,'#d4c28d',3)+path('M-65-134H67M-88-100H90M-73-68H77','none','#d8cba2',5)+path('M-40 138Q2 79 46 138M-27 140H34','none','#ccba85',2)+path('M118 202V266L141 245L164 266V201Z','#af5e49'),'translate(598 442) rotate(-13)')
    a+=group(path('M0-172L-44-63L0 30L44-63Z','url(#gold)','#9f743d',2)+path('M0 27V-102','none','#896338',3)+circle(0,-106,8,'#f9edcc')+path('M-30-62L0-112L30-62','none','#ffe9aa',2)+rect(-20,22,40,159,'url(#wood)',7),'translate(893 555) rotate(31)')
    for xx,yy,sc,ang in [(264,423,1.7,-45),(300,687,1.35,-80),(961,307,1.15,35),(1008,701,.9,95)]:a+=oak(xx,yy,sc,ang,'url(#amber)')
    a+=path('M168 565Q220 551 267 482M894 252Q916 300 960 329','none','#ac7a4a',3)
    return a

def november():
    a=rect(0,0,1200,800,'#254148')+ellipse(624,402,510,355,'#526862',.45)
    for xx,hh in [(126,470),(1037,540),(1110,380)]:
        a+=path(f'M{xx} 650V{650-hh}M{xx} 426L{xx-69} 323M{xx} 358L{xx+50} 277M{xx} 270L{xx-38} 231','none','#19363e',16)
    a+=path('M0 643Q314 588 642 648T1200 624V800H0Z','#547069')+path('M0 742Q367 656 1200 740V800H0Z','#334e49')
    a+=ellipse(613,596,251,125,'#b29155',.08)+ellipse(616,552,146,197,'#edc46f',.055)
    a+=candle(603,487,1.67)+candle(863,594,.69)
    a+=oak(320,717,1.1,-75,'url(#amber)')+oak(429,721,.9,63,'url(#wood)')+leaf(928,731,.6,58,'url(#gold)')
    a+=path('M392 742Q475 708 541 716','none','#d4b177',2,opacity='.5')
    return a

def december():
    a=rect(0,0,1200,800,'#2f514c')+ellipse(620,353,475,340,'#5e7460',.34)
    a+=path('M0 648Q583 617 1200 665V800H0Z','url(#linen)')+path('M0 648Q583 617 1200 665V800H0Z','url(#weave)')
    a+=straw(570,271,1.07)+straw(865,170,.56)
    a+=fir(149,700,1.17)+group(fir(0,0,.86),'translate(1020 697) rotate(-96)')
    a+=candle(310,599,.72)
    a+=ellipse(711,717,150,26,'#9b8567',.2)+path('M568 673Q711 732 855 673Q838 750 712 751Q587 750 568 673','url(#glass)','#9baca0',2)+ellipse(711,673,143,39,'#f5e6c5')
    for i in range(23):
        xx=618+(i*47%185); yy=654+(i*19%36)
        a+=rect(xx,yy,21+(i%3)*3,14,'url(#amber)',6,transform=f'rotate({i*23} {xx+12} {yy+7})')+circle(xx+7,yy+5,1.1,'#795d3b')+circle(xx+13,yy+8,.9,'#795d3b')
    a+=path('M102 666L124 654L145 668L125 680Z','#b44d3f')
    return a

ART=[
 ('sausis','sausio','Vilniaus žiemos šviesa',january,'Snieguotas Vilnius, stilizuotas Gedimino pilies bokštas su trispalve, atminimo žvakė ir neužmirštuolė.'),
 ('vasaris','vasario','Laisvė ir žiemos palydos',february,'Istorinį dokumentą primenantis popierius, medinė Užgavėnių kaukė ir Lietuvos trispalvės juosta.'),
 ('kovas','kovo','Pavasario raštai',march,'Vaško raštais puošti margučiai ir džiovintų augalų verbos šviesiame pavasario fone.'),
 ('balandis','balandžio','Atbundantis kraštovaizdis',april,'Žaliuojantys Lietuvos kaimo laukai, medinė sodyba ir virš atverstos knygos kylanti ąžuolo šakelė.'),
 ('geguze','gegužės','Žiedai ir lietuviškas žodis',may,'Tulpės skaidrioje vazoje, atversta knyga ir šviesus lino audinys.'),
 ('birzelis','birželio','Rasų vakaras',june,'Ąžuolo lapų ir žiedų vainikas prie ramaus ežero, o tolumoje – Joninių laužas.'),
 ('liepa','liepos','Valstybingumo vasara',july,'Simbolinė auksinė karūna, žalias Vilniaus piliakalnis ir stilizuotas Gedimino pilies bokštas.'),
 ('rugpjutis','rugpjūčio','Žolynų ir javų laikas',august,'Žolinę primenanti javų varpų, lapų ir pievų žiedų puokštė, surišta audinio juosta.'),
 ('rugsejis','rugsėjo','Žinių pradžia',september,'Atversta knyga, rašiklis, sąsiuvinis ir rusvi lapai ant medinio mokymosi stalo.'),
 ('spalis','spalio','Pilietiškumo puslapiai',october,'Tamsiai žalias dokumentų tomas, žalvario spalvos rašiklio plunksna ir gintariniai rudens lapai.'),
 ('lapkritis','lapkričio','Ramus atminimo vakaras',november,'Šiltai šviečiančios atminimo žvakės stiklo indeliuose, nukritę lapai ir tylios medžių šakos.'),
 ('gruodis','gruodžio','Kūčių vakaro ramybė',december,'Šiaudinių sodų formų papuošalai, žvakė, eglės šakelės ir dubuo kūčiukų ant lino staltiesės.')
]
def render_all():
    manifest=[]
    for i,(slug,gen,title,fn,alt) in enumerate(ART,1):
        art=fn()
        name=f'2027-{gen.replace("ž","z").replace("ū","u").replace("ė","e").replace("č","c")}-sventes-hero.svg'
        svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-labelledby="title desc"><title id="title">{escape(title)}</title><desc id="desc">{escape(alt)} Originali Kalendorius365 iliustracija.</desc><defs>{DEFS}</defs>{art}</svg>'
        # Remove unused gradients and patterns; no filters, fonts, scripts or embedded raster.
        used=set(re.findall(r'url\(#([^)]+)\)',art))
        svg=re.sub(r'<(linearGradient|radialGradient|pattern)\b[^>]*id="([^"]+)"[^>]*>.*?</\1>',lambda m:m.group(0) if m.group(2) in used else '',svg)
        (OUT/name).write_text(svg+'\n')
        manifest.append({'month':i,'slug':slug,'title':title,'alt':alt,'src':'/assets/visuals/2027-monthly-holidays/'+name,'width':1200,'height':800,'bytes':len(svg.encode()),'sha256':hashlib.sha256((svg+'\n').encode()).hexdigest(),'creator':'Sukurta Kalendorius365 projektui naudojant dirbtinį intelektą; originali SVG geometrija','rights':'Originalūs projekto failai; trečiųjų šalių vaizdų ar šriftų nėra','documentary':False})
    (ROOT/'data/monthly-holiday-media.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print('Created',len(manifest),'original SVGs;',sum(x['bytes'] for x in manifest),'bytes total; max',max(x['bytes'] for x in manifest))
if __name__=='__main__':render_all()
