#!/usr/bin/env python3
"""Explicit low-frequency update: isolated candidate + reviewable diff only."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
ap = argparse.ArgumentParser()
ap.add_argument('--output', type=Path, required=True, help='New folder outside accepted snapshot')
args = ap.parse_args()
accepted = ROOT / 'data/namedays/cc-by-sa-4.0'
if args.output.resolve() == accepted.resolve() or args.output.exists():
    ap.error('Use a new isolated candidate directory; accepted data is immutable')
args.output.mkdir(parents=True)
subprocess.run([sys.executable, str(Path(__file__).with_name('import_wikipedia.py')),
    '--cache', str(args.output / 'api-cache'), '--output', str(args.output / 'data'), '--refresh'], check=True)
old = {r['date']: r for r in json.loads((accepted / 'snapshot.json').read_text())['records']}
new = json.loads((args.output / 'data/snapshot.json').read_text())['records']
diff = [{'date': r['date'], 'before': old[r['date']]['names'], 'after': r['names'],
         'old_revision': old[r['date']]['source_revision_id'], 'new_revision': r['source_revision_id']}
        for r in new if r['names'] != old[r['date']]['names']]
report = {'created_at': datetime.now(timezone.utc).isoformat(), 'changed_dates': diff,
          'accepted_snapshot_modified': False, 'next_step': 'Review source sections, run both QA gates, and open a pull request. No automatic publication.'}
(args.output / 'REVIEW_DIFF.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'changed_dates': len(diff), 'report': str(args.output / 'REVIEW_DIFF.json')}))
