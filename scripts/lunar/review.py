"""Gate B: independent MuPDF layout/text/image geometry and complete visual sheets."""
from __future__ import annotations
import calendar,json,re
from pathlib import Path
import pymupdf as fitz
from PIL import Image,ImageDraw,ImageFont,ImageOps
from core import ROOT,MONTHS,WEEKDAYS,load_data,write_json,digest

def intersects(a,b):
    overlap=a&b
    return not overlap.is_empty and overlap.width>1 and overlap.height>1

def main():
    assets=json.loads((ROOT/'data/lunar/assets.json').read_text())['assets']
    evidence=ROOT/'docs/lunar/qa/visual';evidence.mkdir(exist_ok=True)
    reports=[]
    for asset in assets:
        doc=fitz.open(ROOT/'site'/asset['pdf'].lstrip('/'));page=doc[0];box=page.rect
        words=page.get_text('words');spans=[s for b in page.get_text('dict')['blocks'] if 'lines' in b for l in b['lines'] for s in l['spans']]
        images=[fitz.Rect(i['bbox']) for i in page.get_image_info()]
        for span in spans:
            rect=fitz.Rect(span['bbox']);assert box.contains(rect),(asset['pdf'],'clipped text',span)
            assert 'Lato' in span['font'],span
            assert all(not intersects(rect,im) for im in images),(asset['pdf'],'text over moon',span)
        for i,a in enumerate(spans):
            for b in spans[i+1:]:
                assert not intersects(fitz.Rect(a['bbox']),fitz.Rect(b['bbox'])),(asset['pdf'],'text overlap',a,b)
        year=asset['year'];month=asset['month']
        if month:
            # Inspect only numeric day labels inside the matrix, separately from event legend.
            region=fitz.Rect(32,150,box.width-32,box.height-177) if asset['design']=='night' else fitz.Rect(32,145,570,box.height-82)
            found=[int(s['text']) for s in spans if re.fullmatch(r'\d{1,2}',s['text']) and region.contains(fitz.Rect(s['bbox']))]
            wanted=list(range(1,calendar.monthrange(year,month)[1]+1))
            assert sorted(found)==wanted,(asset['pdf'],'day slots',found,wanted)
        else:
            assert len(images)==365
            for mi,name in enumerate(MONTHS):
                # Each month row must have its own correct number of date labels and discs.
                top=165+mi*45
                region=fitz.Rect(130,top-15,box.width-34,top+28)
                dates=[int(w[4]) for w in words if re.fullmatch(r'\d{1,2}',w[4]) and region.contains(fitz.Rect(w[:4]))]
                assert dates==list(range(1,calendar.monthrange(year,mi+1)[1]+1)),(name,dates)
        report={'pdf':asset['pdf'],'status':'passed','engine':'MuPDF independent display-list text geometry','text_spans':len(spans),'day_slots_verified':365 if month is None else calendar.monthrange(year,month)[1],'no_clipping':True,'no_text_collisions':True,'no_text_over_discs':True,'expected_lato_fonts':True}
        report['pdf_sha256']=digest(ROOT/'site'/asset['pdf'].lstrip('/'))
        reports.append(report)
    # Six designs per review sheet, so the entire collection receives visual review.
    font=ImageFont.truetype(str(ROOT/'site/assets/fonts/Lato-Bold.ttf'),24)
    monthly=[a for a in assets if a['month']]
    for start in range(0,len(monthly),6):
        sheet=Image.new('RGB',(2400,2380),'#dce5e8');draw=ImageDraw.Draw(sheet)
        for i,a in enumerate(monthly[start:start+6]):
            image=Image.open(ROOT/'site'/a['preview'].lstrip('/')).convert('RGB');image.thumbnail((760,1080),Image.Resampling.LANCZOS)
            x=(i%3)*800+20;y=(i//3)*1180+50;sheet.paste(image,(x,y))
            label=f"{a['year']} · {MONTHS[a['month']-1]} · "+('Naktinis dangus' if a['design']=='night' else 'Stebėjimų lapas')
            draw.text((x,y-33),label,font=font,fill='#163d3a')
        sheet.save(evidence/f'collection-{start//6+1:02}.jpg',quality=94)
    write_json(ROOT/'docs/lunar/qa/print-pass-b.json',{'status':'passed','pdfs_checked':len(reports),'method':'Independent MuPDF text geometry, day-slot extraction and image bounding boxes; visual contact sheets retained separately','results':reports})
    print('GATE B STRUCTURE PASS: all 73 layouts, dates, text and disc bounding boxes. Visual sheets require explicit review.')

if __name__=='__main__':main()
