"""Avoid a separate round trip for the small, above-fold decorative image.

The exact AVIF bytes are embedded. Original responsive WebP fallback, image
dimensions, original files, vectors and printable assets are preserved.
"""
from pathlib import Path
import re,base64,hashlib,json
ROOT=Path(__file__).resolve().parents[1]

def inline_image(document, asset, filename='weather-640.avif'):
    uri='data:image/avif;base64,'+base64.b64encode(asset).decode()
    pattern=r'<source\b(?=[^>]*\btype="image/avif")(?=[^>]*'+re.escape(filename)+r')[^>]*>'
    document,count=re.subn(pattern,lambda _:'<source type="image/avif" srcset="'+uri+'">',document)
    if count!=1:raise ValueError('Expected exactly one above-fold weather picture source')
    return document

def main():
    filename='weather-city-vilnius-day-640.avif'
    image=ROOT/'public/assets/visuals'/filename;page=ROOT/'public/index.html'
    asset=image.read_bytes();page.write_text(inline_image(page.read_text(),asset,filename))
    proof={'method':'Exact licensed Vilnius daylight AVIF bytes in the homepage HTML. Separate original night photograph changes after calculated sunset.','asset':'/assets/visuals/'+filename,'bytes':len(asset),'sha256':hashlib.sha256(asset).hexdigest()}
    (ROOT/'docs/performance/critical-image.json').write_text(json.dumps(proof,indent=2)+'\n')
    print(f'Embedded the {len(asset)}-byte above-fold image without re-encoding')
if __name__=='__main__':main()
