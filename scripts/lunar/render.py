"""Original Lato lunar layouts; vector text/rules and NASA-textured shaded discs."""
from __future__ import annotations
import argparse,calendar,csv,io,json,math
from functools import lru_cache
from pathlib import Path
import numpy as np
from PIL import Image
from fontTools.ttLib import TTFont as FontToolsFont
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4,A3,landscape
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader,PdfWriter
import pymupdf as fitz
from core import ROOT,MONTHS,GENITIVE,WEEKDAYS,PRIMARY,VERSION,load_data,digest,write_json

DATA=None
FONTS=ROOT/'site/assets/fonts'
CACHE=ROOT/'.build-cache/lunar'
LUNAR=ROOT/'site/assets/lunar'
OUT=ROOT/'site/downloads/lunar'
PREVIEW=ROOT/'site/assets/previews/lunar'
GLYPHS='ĄąČčĘęĖėĮįŠšŲųŪūŽž'

def prepare():
    CACHE.mkdir(parents=True,exist_ok=True); PREVIEW.mkdir(parents=True,exist_ok=True)
    for weight in ('Regular','Bold','Black'):
        dest=FONTS/f'Lato-{weight}.ttf'
        if not dest.exists():
            font=FontToolsFont(FONTS/f'Lato-{weight}.woff2');font.flavor=None; font.save(dest)
        font=FontToolsFont(dest)
        assert all(ord(c) in font.getBestCmap() for c in GLYPHS)
        pdfmetrics.registerFont(TTFont('Lato'+weight,str(dest)))

def project_texture(source):
    tex=np.asarray(Image.open(source).convert('RGB'),dtype=np.float32)
    n=1024; axis=(np.arange(n,dtype=np.float32)+.5)/n*2-1
    x,y=np.meshgrid(axis,-axis); z=np.sqrt(np.maximum(0,1-x*x-y*y))
    lon=np.arctan2(x,z);lat=np.arcsin(np.clip(y,-1,1))
    u=(lon/(2*np.pi)+.5)*(tex.shape[1]-1);v=(.5-lat/np.pi)*(tex.shape[0]-1)
    # Bilinear equirectangular-to-orthographic projection, north up, no libration.
    ix=u.astype(int);iy=v.astype(int);fx=(u-ix)[...,None];fy=(v-iy)[...,None]
    projected=(tex[iy,ix]*(1-fx)*(1-fy)+tex[iy,np.minimum(ix+1,tex.shape[1]-1)]*fx*(1-fy)+tex[np.minimum(iy+1,tex.shape[0]-1),ix]*(1-fx)*fy+tex[np.minimum(iy+1,tex.shape[0]-1),np.minimum(ix+1,tex.shape[1]-1)]*fx*fy)
    alpha=np.clip((1-np.sqrt(x*x+y*y))*n/2+.5,0,1)
    image=Image.fromarray(np.dstack([projected,alpha*255]).astype('uint8'),'RGBA')
    image.save(LUNAR/'albedo.png',optimize=True)
    web_texture=image.resize((512,512),Image.Resampling.LANCZOS)
    web_texture.save(LUNAR/'albedo-web.png',optimize=True)
    web_texture.save(LUNAR/'albedo-web.webp',format='WEBP',quality=95,method=6)
    write_json(ROOT/'data/lunar/texture-source.json',{'source_url':'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_8k.tif','source_sha256':digest(source),'credit_lt':'Paviršiaus žemėlapis: NASA mokslinės vizualizacijos studija (Ernie Wright), LRO / LROC.','usage':'NASA informational media use guidance; source item 4720 requests NASA SVS credit; no endorsement implied','guidance_url':'https://www.nasa.gov/nasa-brand-center/images-and-media/','derived_sha256':digest(LUNAR/'albedo.png'),'projection':'Orthographic, center 0° longitude/latitude, north up, no libration or topocentric rotation','source_dimensions':[tex.shape[1],tex.shape[0]],'derived_dimensions':[1024,1024]})

@lru_cache(maxsize=4)
def sphere(n):
    tex=np.asarray(Image.open(LUNAR/'albedo.png').resize((n,n),Image.Resampling.LANCZOS),dtype=np.float32)
    a=(np.arange(n,dtype=np.float32)+.5)/n*2-1;x,y=np.meshgrid(a,a)
    z=np.sqrt(np.maximum(0,1-x*x-y*y));return tex,x,z

def disc(row,size=512):
    tex,x,z=sphere(size)
    angle=math.radians(row['phase_angle_deg']); side=1 if row['waxing_or_waning']=='waxing' else -1
    incidence=x*(math.sin(angle)*side)+z*math.cos(angle)
    lit=np.maximum(0,incidence)
    # Lommel-Seeliger-inspired illustrative reflectance. Exact terminator geometry;
    # terrain shadows, libration, atmospheric colour and local tilt are not modeled.
    light=np.clip(1.85*lit/(lit+z+1e-6),0,1)*(.92+.08*z)
    light=.012+light*.988  # Very subtle artistic earthshine, disclosed in methodology.
    rgb=np.clip(tex[:,:,:3]*light[:,:,None],0,255)
    return Image.fromarray(np.dstack([rgb,tex[:,:,3]]).astype('uint8'),'RGBA')

def moon_path(row,size=512):
    dest=CACHE/f"{row['date_local']}-{size}-gray.png"
    if not dest.exists():disc(row,size).convert('LA').save(dest,optimize=True)
    return dest

def text(c,x,y,s,size=10,weight='Regular',color='#17252c',align='left',max_width=None):
    c.setFillColor(color);c.setFont('Lato'+weight,size)
    width=pdfmetrics.stringWidth(s,'Lato'+weight,size)
    if max_width is not None: assert width<=max_width+.1,(s,width,max_width)
    {'left':c.drawString,'center':c.drawCentredString,'right':c.drawRightString}[align](x,y,s)

def line(c,x,y,x2,y2,color='#dce3e1',width=.5):
    c.setStrokeColor(color);c.setLineWidth(width);c.line(x,y,x2,y2)

def moon(c,row,cx,cy,diameter,size=512):
    assert size/diameter*72>=600
    c.drawImage(str(moon_path(row,size)),cx-diameter/2,cy-diameter/2,diameter,diameter,mask='auto')

def events_for(year,month):
    return [e for e in DATA['events'] if e['local_date'].startswith(f'{year}-{month:02}')]

def footer(c,w,dark=False):
    ink='#b7c4d3' if dark else '#4c5e62'
    text(c,32,38,'Mėnulio vaizdas apskaičiuotas 12:00 Lietuvos laiku. Šiaurė viršuje.',7,color=ink,max_width=w-64)
    text(c,32,26,'Fazių momentai: USNO. Paviršius: NASA mokslinės vizualizacijos studija / LRO. Kalendorius365.lt',6.6,color=ink,max_width=w-64)

def night(c,year,month,rows):
    w,h=A4; c.setFillColor('#101725');c.rect(0,0,w,h,fill=1,stroke=0)
    c.setFillColor('#18283a');c.rect(w-162,h-150,162,150,fill=1,stroke=0)
    text(c,32,h-42,'MĖNULIO KALENDORIUS',10,'Bold','#aac4d5')
    text(c,32,h-87,MONTHS[month-1].upper(),32,'Black','#f5f8fc')
    text(c,w-32,h-83,str(year),35,'Regular','#91b8c9','right')
    text(c,32,h-113,'Dienos ritmas. Šviesos kaita. Vienas mėnuo.',10,color='#b6c4d5')
    top=h-151; left=32;cw=(w-64)/7
    for i,name in enumerate(WEEKDAYS): text(c,left+(i+.5)*cw,top,name,8,'Bold','#c9d9e6','center',cw-3)
    weeks=calendar.Calendar(0).monthdayscalendar(year,month);gridtop=top-14;bottom=177;rh=(gridtop-bottom)/len(weeks)
    event_days={int(e['local_date'][-2:]) for e in events_for(year,month)}
    lookup={int(r['date_local'][-2:]):r for r in rows}
    for ri,week in enumerate(weeks):
        y=gridtop-ri*rh;line(c,left,y,w-left,y,'#354253',.45)
        for col,day in enumerate(week):
            if not day:continue
            x=left+col*cw;row=lookup[day]
            text(c,x+6,y-15,f'{day:02}',12,'Bold','#f4f7fc')
            if day in event_days:
                c.setFillColor('#e1bf72');c.circle(x+cw-9,y-11,2.2,fill=1,stroke=0)
            moon(c,row,x+cw/2,y-rh*.55, min(48,rh*.50))
            text(c,x+cw/2,y-rh+7,f"{row['illumination_fraction']*100:.0f} %",7,color='#b5c7d7',align='center')
    line(c,32,164,w-32,164,'#69717c')
    ev=events_for(year,month); ew=(w-64)/len(ev)
    for i,e in enumerate(ev):
        x=32+i*ew;text(c,x+2,142,e['label_lt'],10,'Bold','#e3c68c',max_width=ew-4)
        text(c,x+2,125,f"{int(e['local_date'][-2:])} d. · {e['local_time']}",9,color='#e2e9f1',max_width=ew-4)
    text(c,32,96,'Auksinis taškas žymi pagrindinės fazės dieną. Savaitė prasideda pirmadienį.',7.6,color='#c1ccda',max_width=w-64)
    text(c,32,80,'Tamsiam fonui sunaudojama daugiau rašalo. Taupiai spaudai rinkitės šviesųjį maketą.',7.1,color='#aebdce',max_width=w-64)
    footer(c,w,True)

def editorial(c,year,month,rows):
    w,h=landscape(A4);c.setFillColor('#fffefa');c.rect(0,0,w,h,fill=1,stroke=0)
    text(c,32,h-38,'MĖNULIO STEBĖJIMŲ LAPAS',9,'Bold','#42635c')
    text(c,32,h-82,MONTHS[month-1],35,'Black','#183c35')
    text(c,32,h-106,f'{year} metai · kasdienė šviesos kaita',11,color='#566961')
    right=625; line(c,right-18,78,right-18,h-35,'#d8dfd8')
    text(c,right,h-47,'Mėnesio akimirkos',16,'Bold','#183c35',max_width=w-right-30)
    for i,e in enumerate(events_for(year,month)):
        y=h-84-i*51;text(c,right,y,e['label_lt'],12,'Bold','#304b42')
        text(c,right,y-17,f"{int(e['local_date'][-2:])} d. {e['local_time']} Lietuvos laiku",9,color='#58675f',max_width=w-right-30)
    text(c,right,191,'Stebėjimų užrašai',12,'Bold','#304b42')
    for y in (168,147,126,105):line(c,right,y,w-32,y,'#d1d6cb')
    left=32;cw=(right-55-left)/7;top=h-145
    for i,name in enumerate(WEEKDAYS):text(c,left+(i+.5)*cw,top,name,8,'Bold','#4e635b','center',cw-2)
    weeks=calendar.Calendar(0).monthdayscalendar(year,month);rh=(top-20-82)/len(weeks);gt=top-16
    lookup={int(r['date_local'][-2:]):r for r in rows};ed={int(e['local_date'][-2:]) for e in events_for(year,month)}
    for ri,week in enumerate(weeks):
        y=gt-ri*rh;line(c,left,y,right-55,y,'#d4dcd3')
        for col,day in enumerate(week):
            if not day:continue
            x=left+col*cw;text(c,x+4,y-13,str(day),10,'Bold','#263d34')
            if day in ed:
                c.setFillColor('#b38a39');c.rect(x+2,y-rh+3,2,max(4,rh-23),fill=1,stroke=0)
            moon(c,lookup[day],x+cw*.57,y-rh*.57,min(34,rh*.55))
    footer(c,w)

def annual(c,year):
    w,h=landscape(A3);c.setFillColor('#0b2430');c.rect(0,0,w,h,fill=1,stroke=0)
    text(c,36,h-42,'KASDIENĖ MĖNULIO ŠVIESOS KAITA',11,'Bold','#a9c4cb')
    text(c,36,h-92,'Mėnulio kalendorius',39,'Black','#f6faf9')
    text(c,w-36,h-91,str(year),54,'Bold','#b9d8db','right')
    text(c,36,h-118,'Dvylika mėnesių. 365 tikros datos. Vaizdas kiekvienos dienos vidurdienį.',12,color='#c7d9dd')
    left=131;cw=(w-left-36)/31;rh=45;top=h-165
    eventmap={e['local_date']:e['phase'] for e in DATA['events'] if e['local_date'].startswith(str(year))}
    colors={'new':'#a5b2ce','first':'#d9bf7c','full':'#f8ecd0','last':'#8fced2'}
    for month in range(1,13):
        y=top-(month-1)*rh;line(c,36,y+18,w-36,y+18,'#36505a',.35)
        text(c,36,y-3,MONTHS[month-1],11,'Bold','#e4eff0',max_width=90)
        rows=[r for r in DATA['records'] if r['date_local'].startswith(f'{year}-{month:02}')]
        for i,row in enumerate(rows):
            x=left+(i+.5)*cw;moon(c,row,x,y,22,192)
            text(c,x,y-22,str(i+1),6.7,color='#cbdade',align='center')
            if row['date_local'] in eventmap:
                c.setFillColor(colors[eventmap[row['date_local']]]);c.circle(x+12,y+9,1.7,fill=1,stroke=0)
    x=36
    for key,label in PRIMARY.items():
        c.setFillColor(colors[key]);c.circle(x,99,3,fill=1,stroke=0)
        text(c,x+10,95,label,10,'Bold','#dce8eb');x+=155
    text(c,36,73,'Taškas žymi pagrindinės fazės dieną; dienos disko vaizdas ir tikslus fazės momentas gali nesutapti.',9,color='#b6cbd0',max_width=w-72)
    footer(c,w,True)

def export(year,month,design):
    annual_page=month is None
    stem=f'lunar-{year}-year-overview' if annual_page else f'lunar-{year}-{month:02}-{design}'
    dest=OUT/str(year);dest.mkdir(parents=True,exist_ok=True)
    pdf=dest/f'{stem}.pdf'; page_size=landscape(A3) if annual_page else (A4 if design=='night' else landscape(A4))
    title=f'{year} metų Mėnulio kalendorius' if annual_page else f'{year} m. {GENITIVE[month-1]} Mėnulio kalendorius'
    c=canvas.Canvas(str(pdf),pagesize=page_size,pageCompression=1,invariant=1,
                    initialFontName='LatoRegular',initialFontSize=10,initialLeading=12,lang='lt-LT')
    c.setTitle(title);c.setAuthor('Kalendorius365.lt');c.setSubject('Mėnulio fazės Lietuvos laiku. Paviršius: NASA mokslinės vizualizacijos studija / LRO.')
    if annual_page:annual(c,year)
    else:
        rows=[r for r in DATA['records'] if r['date_local'].startswith(f'{year}-{month:02}')]
        (night if design=='night' else editorial)(c,year,month,rows)
    c.showPage();c.save()
    reader=PdfReader(pdf);writer=PdfWriter();writer.clone_document_from_reader(reader)
    writer.pages[0].trimbox=writer.pages[0].mediabox
    with pdf.open('wb') as stream:writer.write(stream)
    doc=fitz.open(pdf);page=doc[0]
    # Render the vector source at its real paper size, >=600 pixels per inch.
    pix=page.get_pixmap(matrix=fitz.Matrix(600/72,600/72),alpha=False)
    im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
    webp=pdf.with_suffix('.webp');im.save(webp,'WEBP',quality=92,method=4)
    preview=PREVIEW/f'{stem}.webp'
    im.thumbnail((3840,3840) if annual_page else (1800,1800),Image.Resampling.LANCZOS);im.save(preview,'WEBP',quality=87,method=4)
    small=PREVIEW/f'{stem}-small.webp';im.thumbnail((680,680),Image.Resampling.LANCZOS);im.save(small,'WEBP',quality=82,method=4)
    print(stem,pdf.stat().st_size,webp.stat().st_size,flush=True)
    return {'year':year,'month':month,'design':design,'page_url':f'https://kalendorius365.lt/menulio-kalendorius/{year}/'+('' if annual_page else __import__('core').SLUGS[month-1]+'/'),'pdf':'/'+str(pdf.relative_to(ROOT/'site')),'webp':'/'+str(webp.relative_to(ROOT/'site')),'preview':'/'+str(preview.relative_to(ROOT/'site')),'preview_small':'/'+str(small.relative_to(ROOT/'site')),'width_pt':page_size[0],'height_pt':page_size[1],'pixel_width':pix.width,'pixel_height':pix.height,'orientation':'gulsčias' if page_size[0]>page_size[1] else 'stačias','engine_version':VERSION,'ephemeris_sha256':digest(ROOT/'data/lunar/calendar.json'),'pdf_sha256':digest(pdf),'webp_sha256':digest(webp),'pdf_bytes':pdf.stat().st_size,'webp_bytes':webp.stat().st_size}

def main():
    global DATA
    p=argparse.ArgumentParser();p.add_argument('--texture',type=Path);p.add_argument('--sample',action='store_true');args=p.parse_args()
    prepare()
    if args.texture:project_texture(args.texture)
    DATA=load_data()
    records=[]
    months=[(2027,1),(2028,2),(2029,12)] if args.sample else [(y,m) for y in (2027,2028,2029) for m in range(1,13)]
    for y,m in months:
        for design in ('night','editorial'):records.append(export(y,m,design))
    records.append(export(2027,None,'annual'))
    if not args.sample:
        from optimize_previews import optimize
        records=optimize(records)
    write_json(ROOT/('docs/lunar/qa/sample-prints.json' if args.sample else 'data/lunar/assets.json'),{'version':VERSION,'assets':records})
    if not args.sample:
        write_json(ROOT/'site/assets/data/lunar/assets.json',{'version':VERSION,'assets':records})
        for row in DATA['records']:
            path=LUNAR/'days'/f"{row['date_local']}.webp";path.parent.mkdir(exist_ok=True)
            disc(row,128).save(path,'WEBP',quality=86,method=4)

if __name__=='__main__':main()
