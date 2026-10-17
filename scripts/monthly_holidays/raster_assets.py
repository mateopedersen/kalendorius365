"""Package browser-rendered original SVGs as small hub previews and social PNGs.
Run the documented CUA capture page first; no third-party image material is used.
"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib
ROOT=Path(__file__).resolve().parents[2]
M=json.loads((ROOT/'data/monthly-holiday-media.json').read_text())
MONTHS=json.loads((ROOT/'data/calendar.json').read_text())['months']
FONT=ROOT/'site/assets/fonts'
def font(size,bold=False):return ImageFont.truetype(str(FONT/('Lato-Black.ttf' if bold else 'Lato-Regular.ttf')),size)
def wrap(draw,text,f,width):
    lines=[];current=''
    for w in text.split():
        test=(current+' '+w).strip()
        if draw.textlength(test,font=f)>width and current:lines.append(current);current=w
        else:current=test
    return lines+[current]
sheet=Image.new('RGB',(1800,1800),'#ffffff');sd=ImageDraw.Draw(sheet)
for a in M:
    shot=Image.open(f'/private/tmp/k365-holiday-renders/{a["month"]}.png').convert('RGB')
    art=shot.crop((0,0,1200,800));base=ROOT/'site'/a['src'].lstrip('/')
    preview=base.with_name(base.name.replace('-hero.svg','-640.webp'))
    art.resize((640,427),Image.Resampling.LANCZOS).save(preview,'WEBP',quality=84,method=6)
    small=base.with_name(base.name.replace('-hero.svg','-240.webp'))
    art.resize((240,160),Image.Resampling.LANCZOS).save(small,'WEBP',quality=84,method=6)
    a['small_preview']='/'+str(small.relative_to(ROOT/'site'));a['small_preview_bytes']=small.stat().st_size
    # Keep the complete illustration visible beside the social title.
    out=Image.new('RGB',(1200,630),'#f7f8f2');dr=ImageDraw.Draw(out)
    dr.rounded_rectangle((550,86,1160,493),radius=24,fill='#e9eddf')
    out.paste(art.resize((609,406),Image.Resampling.LANCZOS),(551,87))
    dr.text((54,55),'KALENDORIUS365',font=font(19,True),fill='#285d4c')
    dr.text((54,160),'2027',font=font(68,True),fill='#b4863c')
    dr.text((54,249),MONTHS[a['month']-1][1],font=font(51,True),fill='#172a28')
    yy=328
    for text in ['Šventės ir','atmintinos dienos']:
        dr.text((56,yy),text,font=font(31),fill='#465e51');yy+=43
    for i,c in enumerate(['#e1b34e','#42765b','#b95849']):dr.rectangle((54+i*30,530,84+i*30,535),fill=c)
    for line in wrap(dr,a['title'],font(18),580):dr.text((554,521),line,font=font(18),fill='#52665b')
    og=base.with_name(base.name.replace('-hero.svg','-og.png'));out.save(og,'PNG',optimize=True)
    a['preview']='/'+str(preview.relative_to(ROOT/'site'));a['og']='/'+str(og.relative_to(ROOT/'site'));a['og_bytes']=og.stat().st_size;a['preview_bytes']=preview.stat().st_size
    i=a['month']-1;x=i%3*600;y=i//3*450;sheet.paste(art.resize((600,400)),(x,y));sd.text((x+16,y+410),f'{i+1:02} · {a["title"]}',font=font(21,True),fill='#172a28')
sheet.save(ROOT/'docs/2027-monthly-holidays/original-illustrations-contact.jpg',quality=90)
(ROOT/'data/monthly-holiday-media.json').write_text(json.dumps(M,ensure_ascii=False,indent=2)+'\n')
print('12 small responsive previews and 12 social images;',sum(a['preview_bytes'] for a in M),'preview bytes;',max(a['og_bytes'] for a in M),'maximum OG bytes')
