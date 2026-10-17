"""Responsive web-only derivatives, never loading 600-PPI downloads as previews."""
import json
from pathlib import Path
from PIL import Image
from core import ROOT,digest,write_json

def optimize(assets):
    for asset in assets:
        main=ROOT/'site'/asset['preview'].lstrip('/');small=ROOT/'site'/asset['preview_small'].lstrip('/')
        image=Image.open(main).convert('RGB');variants=[]
        for p in (small,main):
            with Image.open(p) as im:
                variants.append({'url':'/'+str(p.relative_to(ROOT/'site')),'width':im.width,'height':im.height,'bytes':p.stat().st_size,'sha256':digest(p)})
        for width in ([720] if asset['month'] is not None else [1440,2160]):
            if width>=image.width:continue
            target=main.with_name(main.stem+f'-{width}.webp');proof=image.copy();proof.thumbnail((width,10000),Image.Resampling.LANCZOS);proof.save(target,'WEBP',quality=86,method=4)
            variants.append({'url':'/'+str(target.relative_to(ROOT/'site')),'width':proof.width,'height':proof.height,'bytes':target.stat().st_size,'sha256':digest(target)})
        asset['previews']=sorted(variants,key=lambda r:r['width'])
    return assets

if __name__=='__main__':
    path=ROOT/'data/lunar/assets.json';data=json.loads(path.read_text());data['assets']=optimize(data['assets']);write_json(path,data);write_json(ROOT/'site/assets/data/lunar/assets.json',data)
    print('Responsive preview derivatives updated for all 73 layouts.')
