import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// Keep the release gate dependency-free; these fixtures never touch real assets.
test('lunar legacy preservation allows only the exact reviewed annual legend transition', () => {
  const code = String.raw`
import copy,hashlib,importlib.util,sys,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('lunar_gate','scripts/lunar/check_release.py')
gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
hash_bytes=lambda value:hashlib.sha256(value).hexdigest()
class TransitionTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
  self.stems,self.paths=gate.legacy_legend_paths();self.baseline={};self.original={};self.transition={'version':gate.LEGEND_TRANSITION_VERSION,'before_text':'Šventės pažymėtos raudonai','after_text':'12 mėnesių apžvalga','changed_files':[],'selected_assets':[{'stem':s} for s in sorted(self.stems)]}
  for path in sorted(self.paths):
   before=('old:'+path).encode();after=('new:'+path).encode();self.original[path]=before
   self.transition['changed_files'].append({'path':path,'before':{'sha256':hash_bytes(before),'bytes':len(before)},'after':{'sha256':hash_bytes(after),'bytes':len(after)}})
   for location in [path,'public/'+path.removeprefix('site/')]:
    p=self.root/location;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(after)
   if path.startswith('site/downloads/'):self.baseline['public/'+path.removeprefix('site/')]=hash_bytes(before)
  retained=self.root/'public/downloads/retained.pdf';retained.write_bytes(b'original retained file');self.baseline['public/downloads/retained.pdf']=hash_bytes(retained.read_bytes())
 def test_only_exact30_download_hashes_transition(self):
  self.assertEqual(len(gate.approved_legacy_replacements(self.baseline,self.transition)),30)
  self.assertEqual(gate.verify_existing_downloads(self.root,self.baseline,self.transition),(1,30))
 def test_original_baseline_still_works_without_transition(self):
  for path,before in self.original.items():
   if path.startswith('site/downloads/'):(self.root/('public/'+path.removeprefix('site/'))).write_bytes(before)
  self.assertEqual(gate.verify_existing_downloads(self.root,self.baseline),(31,0))
 def test_extra_file_rejected(self):
  self.transition['changed_files'].append(copy.deepcopy(self.transition['changed_files'][0]));self.transition['changed_files'][-1]['path']='site/downloads/unrelated.pdf'
  with self.assertRaises(AssertionError):gate.approved_legacy_replacements(self.baseline,self.transition)
 def test_missing_file_rejected(self):
  self.transition['changed_files'].pop()
  with self.assertRaises(AssertionError):gate.approved_legacy_replacements(self.baseline,self.transition)
 def test_old_hash_must_match_historical_baseline(self):
  row=next(r for r in self.transition['changed_files'] if r['path'].startswith('site/downloads/'));row['before']['sha256']='a'*64
  with self.assertRaises(AssertionError):gate.approved_legacy_replacements(self.baseline,self.transition)
 def test_other_wording_or_version_rejected(self):
  self.transition['after_text']='Unreviewed replacement'
  with self.assertRaises(AssertionError):gate.approved_legacy_replacements(self.baseline,self.transition)
  self.transition['after_text']='12 mėnesių apžvalga';self.transition['version']='v2'
  with self.assertRaises(AssertionError):gate.approved_legacy_replacements(self.baseline,self.transition)
 def test_retained_file_tampering_rejected(self):
  (self.root/'public/downloads/retained.pdf').write_bytes(b'tampered')
  with self.assertRaises(AssertionError):gate.verify_existing_downloads(self.root,self.baseline,self.transition)
 def test_changed_source_preview_rejected(self):
  path=next(p for p in self.paths if p.startswith('site/assets/previews-small/'));(self.root/path).write_bytes(b'tampered preview')
  with self.assertRaises(AssertionError):gate.verify_existing_downloads(self.root,self.baseline,self.transition)
 def test_reverting_corrected_download_to_old_hash_rejected(self):
  path=next(p for p in self.paths if p.startswith('site/downloads/'));(self.root/('public/'+path.removeprefix('site/'))).write_bytes(self.original[path])
  with self.assertRaises(AssertionError):gate.verify_existing_downloads(self.root,self.baseline,self.transition)
 def test_wrong_design_set_rejected(self):
  self.transition['selected_assets'][0]['stem']='2027-metinis-06'
  with self.assertRaises(AssertionError):gate.approved_legacy_replacements(self.baseline,self.transition)
 def test_unreviewed_transition_manifest_rejected(self):
  path=self.root/gate.LEGEND_TRANSITION_PATH;path.parent.mkdir(parents=True);path.write_text('{}')
  with self.assertRaises(AssertionError):gate.read_approved_legacy_transition(self.root,self.baseline)
unittest.main(testRunner=unittest.TextTestRunner(stream=sys.stdout,verbosity=1))
`;
  const result = execFileSync(process.env.K365_PYTHON || 'python3', ['-c', code], { encoding: 'utf8', stdio: 'pipe' });
  assert.match(result, /Ran 11 tests/);
  assert.match(result, /OK/);
});
