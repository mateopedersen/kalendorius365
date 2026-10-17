"""Optional authoring utility. Never run during a site build or touch legacy assets.

Requires Pillow. Explicit --write downloads verified originals to an external cache
and creates only the phase2 derivatives listed in the committed media registry.
"""
from pathlib import Path
import argparse,json,hashlib,urllib.request,time
from PIL import Image,ImageOps
ROOT=Path(__file__).resolve().parents[2]
def run():
 ap=argparse.ArgumentParser();ap.add_argument('--write',action='store_true');ap.add_argument('--cache',default='/private/tmp/k365-phase2-original-cache');args=ap.parse_args();data=json.loads((ROOT/'data/holiday-phase2.json').read_text());cache=Path(args.cache)
 for key,m in data['media'].items():
  if not m['src'].startswith('/assets/visuals/holiday-phase2/'):continue
  if not args.write:print(key,m['commons_url'],m['license']);continue
  cache.mkdir(parents=True,exist_ok=True);src=cache/(key+'.original')
  if not src.exists():
   req=urllib.request.Request(m['original_media_url'],headers={'User-Agent':'Kalendorius365 licensed-media authoring/1.0 (https://kalendorius365.lt/)'});src.write_bytes(urllib.request.urlopen(req,timeout=60).read());time.sleep(1)
  assert hashlib.sha256(src.read_bytes()).hexdigest()==m['original_sha256'],key+' original changed; review new source rights before replacing'
  im=ImageOps.exif_transpose(Image.open(src)).convert('RGB')
  for variant in m['srcset'].split(','):
   url,size=variant.strip().split();width=int(size[:-1]);assert width<=im.width
   target=ROOT/'site'/url.lstrip('/');assert target.parent==ROOT/'site/assets/visuals/holiday-phase2'
   if target.exists():continue
   target.parent.mkdir(parents=True,exist_ok=True);im.resize((width,round(im.height*width/im.width)),Image.Resampling.LANCZOS).save(target,'WEBP',quality=m.get('webp_quality',86),method=6)
if __name__=='__main__':run()
