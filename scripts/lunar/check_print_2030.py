"""Verify 2030 date placement and the 600-PPI print assets independently."""
import calendar
import csv
import json
from datetime import date, datetime, timedelta

import pymupdf
from PIL import Image, ImageChops, ImageStat
from pypdf import PdfReader

from core import ROOT, MONTHS, TZ, WEEKDAYS, digest, load_data, write_json

MANIFEST = ROOT / 'data/lunar/print-2030.json'
PROOF = ROOT / 'site/downloads/lunar/2030/print-verification.json'
CSV = PROOF.with_suffix('.csv')


def verify_asset(asset, events):
    pdf = ROOT / 'site' / asset['pdf'].lstrip('/')
    webp = ROOT / 'site' / asset['webp'].lstrip('/')
    month = asset['month']
    expected_days = calendar.monthrange(2030, month)[1] if month else 365
    reader = PdfReader(pdf)
    assert len(reader.pages) == 1 and reader.trailer['/Root']['/Lang'] == 'lt-LT', pdf.name
    page = reader.pages[0]
    assert page.trimbox == page.mediabox, pdf.name
    for resource in page['/Resources']['/Font'].values():
        font = resource.get_object()
        assert 'Lato' in font['/BaseFont'] and '/ToUnicode' in font, pdf.name
        assert '/FontFile2' in font['/FontDescriptor'], pdf.name

    with pymupdf.open(pdf) as doc:
        p = doc[0]
        width, height = p.rect.width, p.rect.height
        assert abs(width - asset['width_pt']) < .01 and abs(height - asset['height_pt']) < .01
        text = p.get_text()
        lines = text.splitlines()
        assert '2030' in text and 'Lietuvos laiku' in text, pdf.name
        if month:
            assert all(name in text for name in WEEKDAYS), pdf.name
            date_numbers = [str(day).zfill(2) if asset['design']=='night' else str(day) for day in range(1,expected_days+1)]
            found = [line for line in lines if line in date_numbers]
            assert found == date_numbers, (pdf.name, found)
            for event in events:
                if event['local_date'].startswith(f'2030-{month:02}'):
                    assert event['label_lt'] in text and event['local_time'] in text, (pdf.name, event)
        else:
            assert all(name in text for name in MONTHS)
            expected = [str(day) for m in range(1, 13) for day in range(1, calendar.monthrange(2030, m)[1]+1)]
            assert [line for line in lines if line.isdigit() and line != '2030'] == expected, pdf.name

        images = p.get_image_info()
        assert len(images) == expected_days, (pdf.name, len(images))
        assert all(p.rect.contains(pymupdf.Rect(img['bbox'])) for img in images), pdf.name
        ppi = min(min(72 * img['width'] / (img['bbox'][2] - img['bbox'][0]),
                      72 * img['height'] / (img['bbox'][3] - img['bbox'][1])) for img in images)
        assert ppi >= 600
        bitmap = p.get_pixmap(matrix=pymupdf.Matrix(.68,.68),alpha=False)
        proof = Image.frombytes('RGB', (bitmap.width,bitmap.height), bitmap.samples)

    with Image.open(webp) as image:
        assert image.format == 'WEBP' and image.size == (asset['pixel_width'],asset['pixel_height'])
        raster_ppi = min(image.width * 72 / width, image.height * 72 / height)
        assert raster_ppi >= 600
        # Compare independent PDF and WebP renders at review scale. Tiny
        # anti-aliasing and compression differences are expected.
        delta = ImageChops.difference(proof, image.convert('RGB').resize(proof.size,Image.Resampling.LANCZOS))
        assert max(ImageStat.Stat(delta).mean) < 4, (webp.name, ImageStat.Stat(delta).mean)
    for account in asset['previews']:
        preview = ROOT / 'site' / account['url'].lstrip('/')
        with Image.open(preview) as image:
            assert image.size == (account['width'], account['height']) and image.format == 'WEBP'
        assert digest(preview) == account['sha256']
    assert digest(pdf) == asset['pdf_sha256'] and digest(webp) == asset['webp_sha256']
    return dict(year=2030, month=month, design=asset['design'], date_count=expected_days,
                minimum_pdf_texture_ppi=round(ppi,3), webp_ppi=round(raster_ppi,3),
                pdf=asset['pdf'], pdf_sha256=asset['pdf_sha256'],
                webp=asset['webp'], webp_sha256=asset['webp_sha256'])


def main():
    manifest = json.loads(MANIFEST.read_text())
    daily = json.loads((ROOT / 'data/lunar/calendar-2030.json').read_text())
    events = [row for row in load_data()['events'] if row['local_date'].startswith('2030')]
    assert len(daily) == 365 and len(events) == 50
    for index, row in enumerate(daily):
        stamp = datetime.fromisoformat(row['sampled_instant_utc']).astimezone(TZ)
        wanted = date(2030,1,1) + timedelta(days=index)
        assert stamp.date() == wanted and stamp.strftime('%H:%M') == '12:00'
        assert row['date_local'] == wanted.isoformat() and row['weekday'] == wanted.weekday()
    assets = manifest['assets']
    assert len(assets) == 25
    assert {(a['month'],a['design']) for a in assets} == {(None,'annual')} | {
        (month,design) for month in range(1,13) for design in ('night','editorial')}
    results = [verify_asset(asset, events) for asset in assets]
    write_json(PROOF, {'manifest_sha256':digest(MANIFEST),'daily_samples':365,
                       'principal_phases':50,'results':results})
    with CSV.open('w') as stream:
        output = csv.DictWriter(stream,fieldnames=results[0])
        output.writeheader()
        output.writerows(results)
    print('2030: verified 25 PDF/WebP pairs, 365 daily samples, 50 phase times, and all preview hashes.')


if __name__ == '__main__':
    main()
