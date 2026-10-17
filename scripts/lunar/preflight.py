"""Gate A: structural PDF/PPI/font/localization checks for every print pair."""
from __future__ import annotations
import csv,json,re,sys
from pathlib import Path
from PIL import Image
from pypdf import PdfReader
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from preflight import inspect_stream
from core import ROOT,MONTHS,WEEKDAYS,PRIMARY,load_data,digest,write_json

FORBIDDEN=re.compile(r'\b(?:Moon|Full Moon|New Moon|First Quarter|Last Quarter|May|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|June|July|August|September|October|November|December)\b',re.I)

def main():
    assets=json.loads((ROOT/'data/lunar/assets.json').read_text())['assets'];data=load_data()
    assert len(assets)==73
    results=[];manifest=[]
    for asset in assets:
        pdf=ROOT/'site'/asset['pdf'].lstrip('/');webp=ROOT/'site'/asset['webp'].lstrip('/')
        reader=PdfReader(pdf);assert len(reader.pages)==1
        assert str(reader.trailer['/Root'].get('/Lang'))=='lt-LT'
        page=reader.pages[0];w,h=float(page.mediabox.width),float(page.mediabox.height)
        assert abs(w-asset['width_pt'])<.01 and abs(h-asset['height_pt'])<.01
        assert list(page.trimbox)==list(page.mediabox)
        text=page.extract_text();assert not FORBIDDEN.search(text),(pdf,FORBIDDEN.findall(text))
        fonts=[]
        for f in page['/Resources']['/Font'].values():
            f=f.get_object();name=str(f.get('/BaseFont',''));descriptor=f.get('/FontDescriptor')
            assert 'Lato' in name and descriptor and '/ToUnicode' in f,(pdf,name)
            assert '/FontFile2' in descriptor.get_object(),(pdf,name)
            fonts.append(name)
        assert len(fonts)>=2
        stream=inspect_stream(page.get_contents(),reader,page['/Resources'])
        assert stream['textOperators']>40 and stream['pathOperators']>10
        wanted=365 if asset['month'] is None else sum(r['date_local'].startswith(f"{asset['year']}-{asset['month']:02}") for r in data['records'])
        assert len(stream['raster'])==wanted,(pdf,len(stream['raster']),wanted)
        for word in ['Mėnulio','Lietuvos','Šiaurė','Jaunatis','Priešpilnis','Pilnatis','Delčia']:
            assert word in text,(pdf,word)
        if asset['month'] is None:
            assert all(m in text for m in MONTHS)
        else:
            assert all(day in text for day in WEEKDAYS)
        with Image.open(webp) as image:
            assert image.format=='WEBP'
            assert image.size==(asset['pixel_width'],asset['pixel_height'])
            actual_ppi=[image.width/(w/72),image.height/(h/72)]
            assert min(actual_ppi)>=600
        assert digest(pdf)==asset['pdf_sha256'] and digest(webp)==asset['webp_sha256']
        assert max(pdf.stat().st_size,webp.stat().st_size)<25*1024*1024
        row={'pdf':asset['pdf'],'status':'passed','fonts':fonts,'days':wanted,'raster_count':len(stream['raster']),'minimum_effective_ppi':min(min(i['effectivePPI']) for i in stream['raster']),'webp_actual_ppi':actual_ppi,'text_operators':stream['textOperators'],'path_operators':stream['pathOperators'],'color':'RGB / grayscale; PDF/X not claimed','lithuanian_terms_present':True,'english_calendar_words':0}
        row.update(pdf_sha256=digest(pdf),webp_sha256=digest(webp))
        results.append(row)
        for ext,mime in [('pdf','application/pdf'),('webp','image/webp')]:
            manifest.append({'page_url':asset['page_url'],'asset_url':'https://kalendorius365.lt'+asset[ext],'year':asset['year'],'month':asset['month'],'design':asset['design'],'mime':mime,'bytes':asset[f'{ext}_bytes'],'sha256':asset[f'{ext}_sha256'],'width_mm':round(w/72*25.4,4),'height_mm':round(h/72*25.4,4),'orientation':asset['orientation'],'pixel_width':asset['pixel_width'] if ext=='webp' else None,'pixel_height':asset['pixel_height'] if ext=='webp' else None,'pdf_fonts':fonts if ext=='pdf' else [],'minimum_texture_ppi':row['minimum_effective_ppi'] if ext=='pdf' else None,'source_ephemeris_sha256':asset['ephemeris_sha256'],'creation_engine_version':asset['engine_version'],'validation_status':'passed','preview_url':'https://kalendorius365.lt'+asset['preview']})
    assert len(manifest)==146
    write_json(ROOT/'docs/lunar/qa/print-pass-a.json',{'status':'passed','pdf_count':73,'webp_count':73,'results':results})
    write_json(ROOT/'docs/lunar/asset-manifest.json',manifest)
    with (ROOT/'docs/lunar/asset-manifest.csv').open('w') as stream:
        writer=csv.DictWriter(stream,fieldnames=list(manifest[0]));writer.writeheader();writer.writerows(manifest)
    import shutil
    for ext in ('csv','json'):
        shutil.copyfile(ROOT/f'docs/lunar/asset-manifest.{ext}',ROOT/f'site/downloads/lunar/asset-manifest.{ext}')
    print('GATE A PASS: 73 PDFs, 73 genuine 600-PPI WebPs; embedded Lato, 1096 dates × 2 monthly designs + 365 poster discs; no English calendar labels.')

if __name__=='__main__':main()
