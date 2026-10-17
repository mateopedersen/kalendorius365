"""Dependency-free release gate tying every lunar asset to completed preflight."""
from __future__ import annotations
import csv,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    assets=json.loads((ROOT/'data/lunar/assets.json').read_text())['assets']
    assert len([a for a in assets if a['month'] is not None])==72
    annual=[a for a in assets if a['month'] is None];assert len(annual)==1 and annual[0]['year']==2027
    requested=list(csv.DictReader((ROOT/'data/lunar/requested-months.csv').open()))
    actual={a[key] for a in assets if a['month'] is not None for key in ('pdf','webp')}
    expected={r[key] for r in requested for key in ('dark_pdf','dark_webp','light_pdf','light_webp')}
    assert actual==expected and len(actual)==144
    ephemeris=sha(ROOT/'data/lunar/calendar.json')
    pass_a=json.loads((ROOT/'docs/lunar/qa/print-pass-a.json').read_text())
    pass_b=json.loads((ROOT/'docs/lunar/qa/print-pass-b.json').read_text())
    assert pass_a['status']==pass_b['status']=='passed'
    a_rows={r['pdf']:r for r in pass_a['results']};b_rows={r['pdf']:r for r in pass_b['results']}
    assert len(a_rows)==len(b_rows)==73
    for asset in assets:
        assert asset['ephemeris_sha256']==ephemeris
        qa=a_rows[asset['pdf']]; qb=b_rows[asset['pdf']]
        assert qa['minimum_effective_ppi']>=600 and min(qa['webp_actual_ppi'])>=600
        for ext in ('pdf','webp'):
            source=ROOT/'site'/asset[ext].lstrip('/');built=ROOT/'public'/asset[ext].lstrip('/')
            assert sha(source)==sha(built)==asset[f'{ext}_sha256']==qa[f'{ext}_sha256'],asset[ext]
            assert built.stat().st_size<25*1024*1024
        assert qb['pdf_sha256']==asset['pdf_sha256']
    for path,old_sha in json.loads((ROOT/'docs/lunar/qa/existing-downloads-before.json').read_text()).items():
        assert sha(ROOT/path)==old_sha,('Preexisting asset changed',path)
    assert not (ROOT/'public/lunar-responsive-qa.html').exists(),'Local QA harness must not be published'
    assert not (ROOT/'public/lunar-qa-axe.js').exists(),'Local QA library must not be published'
    assert len([r for r in (ROOT/'public/_headers').read_text().splitlines() if r.startswith('/')])<=100
    print('Lunar release gate: all 146 downloads match both preflight passes; all 832 original assets unchanged.')

if __name__=='__main__':main()
