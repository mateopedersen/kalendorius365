#!/usr/bin/env python3
"""Package real, privately isolated tool captures; never invents screenshots."""
import argparse
import hashlib
import json
import io
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
MANIFEST=ROOT/'data/blog/tool-examples.json'
def sha(data):return hashlib.sha256(data).hexdigest()
def prepare():
    capture_dir=ROOT/'docs/adsense-v2/captures'
    records=json.loads((capture_dir/'manifest.json').read_text())
    result={}
    for slug,record in records.items():
        source=capture_dir/(slug+'.png')
        if sha(source.read_bytes())!=record['sha256']:raise ValueError('Capture changed: '+slug)
        original=Image.open(source).convert('RGB');width=min(1200,original.width)
        sizes=sorted({min(480,width),min(800,width),width});variants=[]
        for size in sizes:
            height=round(original.height*size/original.width)
            image=original.resize((size,height),Image.Resampling.LANCZOS)
            encoded=io.BytesIO();image.save(encoded,'WEBP',quality=86,method=6);delivery=encoded.getvalue()
            path=f'/assets/blog/examples/{slug}-{sha(delivery)[:16]}-{size}.webp'
            out=ROOT/'site'/path.lstrip('/');out.parent.mkdir(parents=True,exist_ok=True)
            out.write_bytes(delivery)
            variants.append(dict(src=path,width=size,height=height,sha256=sha(out.read_bytes()),bytes=out.stat().st_size))
        result[slug]={**record,'variants':variants,'alt':record['reviewed_alt'],
                      'kind':'real_tool_screenshot','contains_real_visitor_data':False}
    MANIFEST.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    validate()
def validate():
    records=json.loads(MANIFEST.read_text())
    if len(records)!=20:raise ValueError('Expected20 reviewed tool examples')
    for slug,record in records.items():
        if record['contains_real_visitor_data'] or record['source_url']!='https://kalendorius365.lt'+record['route']:raise ValueError('Invalid provenance: '+slug)
        for variant in record['variants']:
            path=ROOT/'site'/variant['src'].lstrip('/')
            if sha(path.read_bytes())!=variant['sha256']:raise ValueError('Screenshot delivery changed: '+slug)
            with Image.open(path) as im:
                if list(im.size)!=[variant['width'],variant['height']]:raise ValueError('Invalid screenshot dimensions')
    print(json.dumps({'real_tool_screenshots':len(records),'delivery_files':sum(len(r['variants'])for r in records.values())}))
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--prepare',action='store_true');args=parser.parse_args()
    prepare()if args.prepare else validate()
