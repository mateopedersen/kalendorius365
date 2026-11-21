"""Build the 2030 additions with the same layouts as the existing print set."""
import argparse
from concurrent.futures import ProcessPoolExecutor
import json

from core import ROOT, VERSION, digest, load_data, write_json
from optimize_previews import optimize
import render

DAILY = ROOT / 'data/lunar/calendar-2030.json'
EVENTS = ROOT / 'data/lunar/calendar.json'
MANIFEST = ROOT / 'data/lunar/print-2030.json'


def prepare_renderer():
    render.prepare()
    render.DATA = load_data()
    render.DATA['records'] = json.loads(DAILY.read_text())


def export_scope(month):
    designs = ('night', 'editorial') if month is not None else ('annual',)
    return [render.export(2030, month, design) for design in designs]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workers', default=3, type=int)
    args = parser.parse_args()
    # Generate the shared font files before any worker accesses them.
    render.prepare()
    with ProcessPoolExecutor(max_workers=args.workers, initializer=prepare_renderer) as pool:
        assets = [asset for group in pool.map(export_scope, [None, *range(1, 13)]) for asset in group]
    day_hash = digest(DAILY)
    for asset in assets:
        asset['ephemeris_sha256'] = day_hash
    write_json(MANIFEST, {
        'version': VERSION,
        'events_sha256': digest(EVENTS),
        'assets': optimize(assets),
    })
    print('2030 print collection: 25 PDF/WebP pairs and matching responsive previews.')


if __name__ == '__main__':
    main()
