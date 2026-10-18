"""Dependency-free release gate tying every lunar asset to completed preflight."""
from __future__ import annotations
import csv,hashlib,json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts'))
from calendar_package import validate_import_evidence
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
LEGEND_TRANSITION_VERSION='2026-10-17-annual-monochrome-legend-v2'
LEGEND_TRANSITION_PATH='docs/language-audit/2026-10-17/annual-monochrome-legend-v2.json'
# Deliberately pinned after independent review. Any later permitted correction
# needs another reviewed version; this is not a path-pattern bypass.
LEGEND_TRANSITION_SHA256='c9fb55864d9afc0ae1d77b6c70ca893b1c6d3689404599ce6d7d19ceb0bec4d0'
BLANK_TRANSITION_VERSION='2026-10-18-blank-calendar-redesign-v1'
BLANK_TRANSITION_PATH='docs/blank-calendar-redesign/asset-transition.json'
BLANK_TRANSITION_SHA256='13bbd9348cabe8965b7590ad1e8714bd032956441ecc7b894ae26341f2b9c8ae'

def legacy_legend_paths():
    stems={f'{year}-metinis-{design:02d}' for year in (2027,2028,2029) for design in (1,2,3,4,5)}
    downloads={f'site/downloads/{stem}.{ext}' for stem in stems for ext in ('pdf','webp')}
    previews={f'site/assets/{folder}/{stem}.webp' for stem in stems for folder in ('previews','previews-small')}
    return stems,downloads|previews

def approved_legacy_replacements(baseline,transition):
    assert transition['version']==LEGEND_TRANSITION_VERSION,'Unreviewed legacy transition version'
    stems,expected=legacy_legend_paths()
    rows=transition['changed_files'];changes={row['path']:row for row in rows}
    assert len(rows)==len(changes)==60 and set(changes)==expected,'Legacy correction must cover exactly the reviewed 60 monochrome annual artifacts'
    selected=transition['selected_assets']
    assert len(selected)==15 and {row['stem'] for row in selected}==stems,'Legacy correction must cover exactly the reviewed 15 monochrome annual designs'
    assert transition['before_text']=='Šventės pažymėtos raudonai' and transition['after_text']=='12 mėnesių apžvalga','Unreviewed legend wording'
    replacements={}
    for path,row in changes.items():
        assert len(row['before']['sha256'])==len(row['after']['sha256'])==64,'Invalid transition digest'
        assert all(c in '0123456789abcdef' for key in ('before','after') for c in row[key]['sha256']),'Invalid transition digest'
        assert row['before']['sha256']!=row['after']['sha256'],'Unchanged artifact cannot be an allowed correction'
        if path.startswith('site/downloads/'):
            public='public/'+path.removeprefix('site/')
            assert public in baseline and baseline[public]==row['before']['sha256'],('Legacy correction old hash does not match immutable original baseline',public)
            replacements[public]=row['after']['sha256']
    assert len(replacements)==30,'Only 30 legacy download hashes may transition'
    return replacements

def package_legacy_replacements(root,baseline):
    """Resolve the exact reviewed old annual files superseded by this package."""
    transition_path=root/LEGEND_TRANSITION_PATH
    assert sha(transition_path)==LEGEND_TRANSITION_SHA256,'Legacy transition differs from the independently reviewed version'
    assert sha(root/'docs/lunar/qa/existing-downloads-before.json')==LEGACY_BASELINE_SHA256,'Original 832-asset baseline must never be rewritten'
    transition=json.loads(transition_path.read_text())
    assert transition['version']==LEGEND_TRANSITION_VERSION
    assert transition['preflight_status']=='passed-twice' and transition['visual_status']=='all15-reviewed'
    assert transition['before_text']=='Šventės pažymėtos raudonai' and transition['after_text']=='12 mėnesių apžvalga'
    stems,expected=legacy_legend_paths()
    assert len(transition['selected_assets'])==15 and {row['stem'] for row in transition['selected_assets']}==stems
    rows={row['path']:row for row in transition['changed_files']}
    assert len(rows)==60 and set(rows)==expected,'Legacy correction must cover exactly the reviewed 60 annual artifacts'
    replacements={}
    for path,row in rows.items():
        if path.startswith('site/downloads/'):
            public='public/'+path.removeprefix('site/')
            assert public in baseline and baseline[public]==row['before']['sha256'],('Legacy correction old hash does not match immutable original baseline',public)
            replacements[path]=row['after']['sha256']
    assert len(replacements)==30
    return replacements

def approved_blank_replacements(root,baseline,transition,manifest):
    """Allow only the 52 exact public download updates for the 26 blank sheets."""
    assert transition['version']==BLANK_TRANSITION_VERSION,'Unreviewed blank-calendar transition version'
    assert transition['after_generator']==manifest['generator'],'Blank print manifest generator differs from its reviewed transition'
    preserved={row['stem']:row for row in transition['preserved_nonblank_assets']}
    redesigned={row['stem']:row for row in transition['redesigned_blank_assets']}
    assets={asset['stem']:asset for asset in manifest['assets']}
    assert len(preserved)==390 and set(preserved)=={stem for stem,asset in assets.items() if asset['kind']!='blank'}
    assert len(redesigned)==26 and set(redesigned)=={stem for stem,asset in assets.items() if asset['kind']=='blank'}
    replacements={}
    for stem,proof in preserved.items():
        asset=assets[stem]
        assert proof['files']==asset['files'],'Unchanged dated print asset metadata changed: '+stem
        for kind,record in proof['files'].items():
            relative=asset[kind].lstrip('/')
            for base in ('site','public'):
                path=root/base/relative
                assert path.is_file() and path.stat().st_size==record['bytes'] and sha(path)==record['sha256'],('Unchanged dated print asset changed',base,relative)
    for stem,proof in redesigned.items():
        asset=assets[stem]
        assert asset['kind']=='blank' and proof['after_files']==asset['files'],'Blank asset manifest differs from the recorded replacement: '+stem
        before=proof['before_files'];after=proof['after_files']
        for kind,record in after.items():
            relative=asset[kind].lstrip('/')
            for base in ('site','public'):
                path=root/base/relative
                assert path.is_file() and path.stat().st_size==record['bytes'] and sha(path)==record['sha256'],('Blank print asset differs from approved replacement',base,relative)
            if kind in ('pdf','webp'):
                public='public/'+relative
                assert public in baseline and baseline[public]==before[kind]['sha256'],('Blank print transition does not match the frozen old-download baseline',public)
                assert before[kind]['sha256']!=record['sha256'],'A claimed blank-calendar replacement did not change its file'
                replacements[public]=record['sha256']
    assert len(replacements)==52,'Only the 52 existing blank-calendar PDF/WebP downloads may change'
    return replacements

def read_approved_blank_transition(root,baseline,manifest):
    path=root/BLANK_TRANSITION_PATH
    assert sha(path)==BLANK_TRANSITION_SHA256,'Blank-calendar transition differs from the reviewed version'
    assert sha(root/'docs/lunar/qa/existing-downloads-before.json')==LEGACY_BASELINE_SHA256,'Original 832-asset baseline must never be rewritten'
    transition=json.loads(path.read_text())
    approved_blank_replacements(root,baseline,transition,manifest)
    return transition

def verify_existing_downloads(root,baseline,transition=None,retired_paths=None,manifest=None):
    if transition and transition.get('version')==BLANK_TRANSITION_VERSION:
        replacements=approved_blank_replacements(root,baseline,transition,manifest)
    else:replacements=approved_legacy_replacements(baseline,transition) if transition else {}
    retired_paths=retired_paths or set()
    for path,old_sha in baseline.items():
        if path in retired_paths:
            assert not (root/path).exists(),('Superseded calendar download still exists in the built site',path)
            continue
        expected=replacements.get(path,old_sha)
        assert sha(root/path)==expected,('Preexisting asset changed without the exact reviewed correction',path)
    if transition and 'changed_files' in transition:
        for row in transition['changed_files']:
            assert sha(root/row['path'])==row['after']['sha256'],('Reviewed correction source differs from pinned artifact',row['path'])
            built='public/'+row['path'].removeprefix('site/')
            assert sha(root/built)==row['after']['sha256'],('Reviewed correction output differs from pinned artifact',built)
    return len(baseline)-len(replacements)-len(retired_paths),len(replacements)+len(retired_paths)

LEGACY_BASELINE_SHA256='ec0bec25e7100438f7dc48c804ca4a31893483178c702b7064344d200e40e80d'

def read_approved_legacy_transition(root,baseline):
    path=root/LEGEND_TRANSITION_PATH
    assert sha(path)==LEGEND_TRANSITION_SHA256,'Legacy transition differs from the independently reviewed version'
    assert sha(root/'docs/lunar/qa/existing-downloads-before.json')==LEGACY_BASELINE_SHA256,'Original 832-asset baseline must never be rewritten'
    transition=json.loads(path.read_text())
    approved_legacy_replacements(baseline,transition)
    assert transition['preflight_status']=='passed-twice' and transition['visual_status']=='all15-reviewed','Reviewed print correction requires completed visual and print preflights'
    manifest=json.loads((root/'site/assets/data/manifest.json').read_text())
    assert manifest['generator']==transition['after_generator'],'Print manifest does not match the reviewed correction renderer'
    assets={a['stem']:a for a in manifest['assets']}
    selected_stems,_=legacy_legend_paths()
    legacy_stems={Path(p).stem for p in baseline if p.endswith('.pdf')}
    assert len(legacy_stems)==416 and selected_stems<=legacy_stems
    for proof in transition['selected_assets']:
        asset=assets[proof['stem']]
        assert asset['kind']=='annual' and asset['style']=='bw','Correction attempted on a non-monochrome annual design'
        assert proof['all_other_text_positions_equal'] is True and proof['vector_geometry_equal'] is True and proof['grayscale_paint_sequence_equal'] is True,'Legend change lacks exact text/date/vector/paint preservation proof'
        assert proof['before_geometry_sha256']==proof['after_geometry_sha256'],'Reviewed annual geometry changed'
        layout=hashlib.sha256(json.dumps(asset['dateLayout'],sort_keys=True).encode()).hexdigest()
        assert layout==proof['date_layout_sha256'],'Current annual date layout differs from reviewed original'
    unaffected=transition['unchanged_current_renderer_pdf_proofs']
    assert len(unaffected)==401 and {r['stem'] for r in unaffected}==legacy_stems-selected_stems,'Correction must prove all 401 other legacy print layout'
    for proof in unaffected:
        asset=assets[proof['stem']]
        assert proof['current_renderer_text_positions_equal'] is True and proof['current_renderer_vector_geometry_equal'] is True and proof['original_paint_preserved_without_regeneration'] is True,'Unaffected legacy print proof is incomplete'
        layout=hashlib.sha256(json.dumps(asset['dateLayout'],sort_keys=True).encode()).hexdigest()
        assert layout==proof['date_layout_sha256'],'Unaffected legacy date layout changed'
        public='public'+asset['pdf']
        assert proof['pdf_sha256']==baseline[public]==sha(root/'site'/asset['pdf'].lstrip('/')),'Unaffected legacy PDF is no longer byte-identical'
    assert sha(root/transition['manifest_path'])==transition['after_manifest_sha256'],'Current print metadata differs from reviewed transition'
    sources=transition['calendar_sources']
    assert len(sources)==2 and {r['path'] for r in sources}=={'data/calendar.json','site/assets/data/years.json'}
    for source in sources:
        assert source['before_sha256']==source['after_sha256']==sha(root/source['path']),'Calendar source changed during a text-only correction'
    preflights=transition['preflight_runs']
    assert len(preflights)==2 and {r['path'] for r in preflights}=={
        'docs/language-audit/2026-10-17/print-preflight-pass-a.json',
        'docs/language-audit/2026-10-17/print-preflight-pass-b.json'}
    for proof in preflights:
        assert sha(root/proof['path'])==proof['sha256'],'Reviewed print preflight evidence changed'
        report=json.loads((root/proof['path']).read_text())
        assert proof['status']==report['status']=='passed' and report['generator']==transition['after_generator']
        assert len(report['results'])==proof['pdf_count']==416 and all(r['status']=='passed' for r in report['results'])
        assert sum(r['datePlacementsChecked'] for r in report['results'])==proof['date_placements']
    operator_proof=transition['operator_and_cache_proof']
    assert sha(root/operator_proof['path'])==operator_proof['sha256'],'Reviewed non-text/cache evidence changed'
    operators=json.loads((root/operator_proof['path']).read_text())
    assert operators['status']=='passed' and len(operators['assets'])==15 and {r['stem'] for r in operators['assets']}==selected_stems
    for proof in operators['assets']:
        assert proof['all_non_text_operators_exactly_equal'] is True and proof['original_operators_sha256']==proof['corrected_operators_sha256']
        assert proof['cache_miss_pdf_byte_reproduction'] is True and proof['new_pdf_sha256']==proof['cache_miss_pdf_sha256']==sha(root/'site'/assets[proof['stem']]['pdf'].lstrip('/'))
    lunar=json.loads((root/'data/lunar/assets.json').read_text())['assets']
    expected_lunar={'public'+asset[ext]:asset[f'{ext}_sha256'] for asset in lunar for ext in ('pdf','webp')}
    lunar_proofs=transition['unchanged_lunar_asset_proofs']
    actual_lunar={proof[ext]:proof[f'{ext}_sha256'] for proof in lunar_proofs for ext in ('pdf','webp')}
    assert len(lunar_proofs)==73 and actual_lunar==expected_lunar,'A legacy legend correction cannot change any lunar download'
    aliases=transition['public_file_aliases']
    changes={r['path']:r for r in transition['changed_files']}
    assert len(aliases)==60 and {r['source_path'] for r in aliases}==set(changes)
    for alias in aliases:
        source=alias['source_path'];row=changes[source]
        assert alias['path']=='public/'+source.removeprefix('site/')
        assert alias['before_sha256']==row['before']['sha256'] and alias['after_sha256']==row['after']['sha256']
    return transition

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
    baseline=json.loads((ROOT/'docs/lunar/qa/existing-downloads-before.json').read_text())
    manifest=json.loads((ROOT/'site/assets/data/manifest.json').read_text())
    retired_public_paths=set();package=None;transition=None
    if manifest.get('packageImport'):
        package=validate_import_evidence(ROOT,manifest,check_files=True)
        package_legacy=package_legacy_replacements(ROOT,baseline)
        for relative,record in package['retiredPaths'].items():
            if relative.startswith('site/downloads/'):
                public='public/'+relative.removeprefix('site/')
                assert public in baseline and record['sha256'] in {baseline[public],package_legacy.get(relative)},('Imported package does not match the frozen old-download baseline or reviewed annual correction',public)
                retired_public_paths.add(public)
        assert len(retired_public_paths)==780,'Imported package must supersede exactly 780 old PDF/WebP downloads'
        package_files={record['path']:record for item in package['evidence']['records'] for record in item['afterFiles'].values()}
        for relative in package['newPaths']:
            source_record=package_files[relative]
            public='public/'+relative.removeprefix('site/')
            assert sha(ROOT/public)==source_record['sha256'],('Built package asset differs from the supplied source',public)
        if manifest.get('blankRedesign'):
            assert manifest['blankRedesign']==BLANK_TRANSITION_PATH
            assert sha(ROOT/BLANK_TRANSITION_PATH)==BLANK_TRANSITION_SHA256
            transition=read_approved_blank_transition(ROOT,baseline,manifest)
    else:
        transition=read_approved_legacy_transition(ROOT,baseline)
        package=None
        retired_public_paths=set()
    unchanged,reviewed=verify_existing_downloads(ROOT,baseline,transition,retired_public_paths,manifest)
    assert not (ROOT/'public/lunar-responsive-qa.html').exists(),'Local QA harness must not be published'
    assert not (ROOT/'public/lunar-qa-axe.js').exists(),'Local QA library must not be published'
    assert len([r for r in (ROOT/'public/_headers').read_text().splitlines() if r.startswith('/')])<=100
    print(f'Lunar release gate: all 146 lunar downloads match both preflight passes; {unchanged} legacy downloads preserved; {reviewed} superseded download hashes match the pinned transition evidence.')

if __name__=='__main__':main()
