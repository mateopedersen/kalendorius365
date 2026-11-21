"""Produce lightweight web previews from the approved calendar PDFs."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import io
import json
from pathlib import Path
import subprocess
from tempfile import NamedTemporaryFile

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
MANIFEST = SITE / 'assets/data/manifest.json'
INDEX = ROOT / 'data/print-preview-details.json'
DETAILS = SITE / 'assets/previews-detail'
LONG_EDGES = (1360, 2040)
PROFILE = 'trim-webp-94-v1'


def sha(content):
    return hashlib.sha256(content).hexdigest()


def write(path, content):
    with NamedTemporaryFile(dir=path.parent, delete=False) as handle:
        temporary = Path(handle.name)
        handle.write(content)
    temporary.chmod(0o644)
    temporary.replace(path)


def read_index():
    return json.loads(INDEX.read_text(encoding='utf-8')) if INDEX.exists() else {}


def approved_assets():
    return [
        asset for asset in json.loads(MANIFEST.read_text(encoding='utf-8'))['assets']
        if asset['kind'] in ('annual', 'monthly') and asset['verification']['status'] == 'passed'
    ]


def valid_detail(entry, pdf_hash):
    if not entry or entry['profile'] != PROFILE or entry['pdf_sha256'] != pdf_hash:
        return False
    variants = entry['variants']
    if tuple(max(item['width'], item['height']) for item in variants) != LONG_EDGES:
        return False
    for item in variants:
        path = SITE / item['url'].lstrip('/')
        if not path.is_file() or sha(path.read_bytes()) != item['sha256']:
            return False
        with Image.open(path) as image:
            if image.size != (item['width'], item['height']) or image.format != 'WEBP':
                return False
    return True


def detail(asset, previous, check):
    pdf = SITE / asset['pdf'].lstrip('/')
    pdf_hash = asset['files']['pdf']['sha256']
    if sha(pdf.read_bytes()) != pdf_hash:
        raise ValueError(f'{pdf}: source differs from the approved PDF')
    if valid_detail(previous, pdf_hash):
        return previous
    if check:
        raise ValueError(f'{asset["stem"]}: missing or stale detail preview')

    raster = subprocess.run(
        ['pdftoppm', '-f', '1', '-l', '1', '-singlefile', '-cropbox',
         '-scale-to', str(LONG_EDGES[-1]), '-png', str(pdf)],
        check=True, capture_output=True,
    ).stdout
    with Image.open(io.BytesIO(raster)) as original:
        page = original.convert('RGB')
    thumbnail = SITE / asset['preview'].lstrip('/')
    with Image.open(thumbnail) as image:
        thumbnail_width, thumbnail_height = image.size
    if abs(page.width / page.height - thumbnail_width / thumbnail_height) > .01:
        raise ValueError(f'{pdf}: rendered page does not match the calendar preview proportions')

    variants = []
    for size in LONG_EDGES:
        image = page.copy()
        image.thumbnail((size, size), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        image.save(buffer, 'WEBP', quality=94, method=4)
        content = buffer.getvalue()
        checksum = sha(content)
        path = DETAILS / f'{asset["stem"]}-{size}-{checksum[:16]}.webp'
        if not path.exists() or sha(path.read_bytes()) != checksum:
            write(path, content)
        variants.append({'url': '/' + path.relative_to(SITE).as_posix(),
                         'width': image.width, 'height': image.height, 'sha256': checksum})
    return {'profile': PROFILE, 'pdf_sha256': pdf_hash,
            'thumbnail_width': thumbnail_width, 'variants': variants}


def small_previews():
    source = SITE / 'assets/previews'
    target = SITE / 'assets/previews-small'
    target.mkdir(exist_ok=True)
    for path in source.glob('*.webp'):
        out = target / path.name
        if out.exists() and out.stat().st_mtime >= path.stat().st_mtime:
            continue
        with Image.open(path) as image:
            image.thumbnail((340, 340), Image.Resampling.LANCZOS)
            image.save(out, 'WEBP', quality=87, method=4)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--details-only', action='store_true')
    modes.add_argument('--check', action='store_true')
    arguments = parser.parse_args()
    if not arguments.check and not arguments.details_only:
        small_previews()
    assets = approved_assets()
    previous = read_index()
    keys = [asset['stem'] for asset in assets]
    if not keys or len(set(keys)) != len(keys):
        raise ValueError('The approved calendar print manifest is empty or contains repeated designs')
    if arguments.check and set(previous) != set(keys):
        raise ValueError('Detail previews do not cover the approved calendar print manifest')
    if not arguments.check:
        DETAILS.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        records = list(pool.map(lambda asset: detail(asset, previous.get(asset['stem']), arguments.check), assets))
    result = dict(zip(keys, records, strict=True))
    if not arguments.check and result != previous:
        content = json.dumps(result, ensure_ascii=False, separators=(',', ':'), sort_keys=True) + '\n'
        write(INDEX, content.encode('utf-8'))
    print(f'{len(result)} calendar designs with verified 1360px and 2040px detail previews.')


if __name__ == '__main__':
    main()
