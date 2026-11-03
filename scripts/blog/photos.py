#!/usr/bin/env python3
"""Offline, checksum-bound delivery of reviewed photographs. No inference or downloads."""
import argparse
import hashlib
import json
import io
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / 'site'
SPEC = ROOT / 'data/blog/photo-sources.json'
MANIFEST = ROOT / 'data/blog/photographs.json'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def signature(row):
    return sha(json.dumps(row, ensure_ascii=False, sort_keys=True).encode())

def prepare(originals):
    rows = json.loads(SPEC.read_text())
    media = json.loads((ROOT / 'data/holiday-editorial.json').read_text())['media']
    receipts = {r['id']: r for r in json.loads((originals / 'download-receipts.json').read_text())}
    result = {}
    for row in rows:
        if 'id' in row:
            source = originals / f'{row["id"]}.jpg'
            receipt = receipts[row['id']]
            if sha(source.read_bytes()) != receipt['sha256']:
                raise ValueError(f'Original changed: {source}')
            meta = dict(author=row['author'], source=row['source'], source_name='Pexels',
                        license='Pexels License', license_url='https://www.pexels.com/license/',
                        original_sha256=receipt['sha256'], download_url=receipt['url'],
                        input_kind='downloaded_original')
        else:
            old = media[row['existing']]
            source = SITE / old['src'].lstrip('/')
            meta = dict(author=old['author'], source=old['commons_url'], source_name='Wikimedia Commons',
                        license=old['license_name'], license_url=old['license_url'],
                        original_sha256=old['original_sha256'], input_kind='existing_site_web_derivative',
                        existing_media_key=row['existing'])
        raw = source.read_bytes()
        image = ImageOps.exif_transpose(Image.open(source)).convert('RGB')
        variants = []
        for width in (480, 800, 1200):
            height = width * 630 // 1200
            # Fixed, reviewed focal coordinates keep portrait subjects in the crop.
            output = ImageOps.fit(image, (width, height), Image.Resampling.LANCZOS,
                                  centering=tuple(row['crop_center']))
            encoded=io.BytesIO();output.save(encoded,'WEBP',quality=84,method=6)
            delivery=encoded.getvalue();token=sha(delivery)[:16]
            relative = f'/assets/blog/photos/{row["slug"]}-{token}-{width}.webp'
            path = SITE / relative.lstrip('/')
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(delivery)
            variants.append(dict(src=relative, width=width, height=height,
                                 bytes=path.stat().st_size, sha256=sha(path.read_bytes())))
        result[row['slug']] = dict(**meta, input_sha256=sha(raw), spec_sha256=signature(row),
                                  input_dimensions=list(image.size), alt=row['alt'], caption=row['caption'],
                                  review={**row['review'], 'input_sha256': sha(raw)}, variants=variants,
                                  changes='Apkirpta santykiu 1200:630, sumažinta ir paruošta WebP formatu; pašalinti EXIF metaduomenys.')
    MANIFEST.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    validate()

def validate():
    rows = json.loads(SPEC.read_text())
    records = json.loads(MANIFEST.read_text())
    if len(rows) != 20 or len(records) != 20 or len({r['slug'] for r in rows}) != 20:
        raise ValueError('Expected exactly 20 photograph assignments')
    for row in rows:
        record = records[row['slug']]
        if record['spec_sha256'] != signature(row) or record['review']['input_sha256'] != record['input_sha256']:
            raise ValueError(f'Photo review invalidated: {row["slug"]}')
        for variant in record['variants']:
            path = SITE / variant['src'].lstrip('/')
            if sha(path.read_bytes()) != variant['sha256']:
                raise ValueError(f'Photo delivery changed: {path}')
            with Image.open(path) as image:
                image.verify()
            if variant['bytes'] > 250_000:
                raise ValueError(f'Oversized photograph: {path}')
    print(json.dumps({'reviewed_photo_covers': len(records), 'responsive_files': len(records) * 3,
                      'largest_bytes': max(v['bytes'] for r in records.values() for v in r['variants'])}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--prepare-from', type=Path)
    args = parser.parse_args()
    prepare(args.prepare_from) if args.prepare_from else validate()
