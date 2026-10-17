"""A reviewed print correction cannot loosen unrelated frozen asset checks."""
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    'monthly_print_gate', ROOT / 'scripts/monthly_holidays/check_release.py'
)
GATE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GATE)


class PrintLegendAllowanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.review = json.loads((ROOT / GATE.PRINT_LEGEND_TRANSITION).read_text())
        self.baseline = json.loads((ROOT / 'docs/2027-monthly-holidays/baseline.json').read_text())['assets']
        paths = set(GATE.PRINT_LEGEND_PATHS) | {
            GATE.PRINT_LEGEND_TRANSITION, 'site/assets/data/manifest.json',
            *[r['path'] for r in self.review['calendar_sources']],
            *[r['path'] for r in self.review['preflight_runs']],
        }
        for path in paths:
            destination = self.root / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / path, destination)

    def tearDown(self):
        self.temp.cleanup()

    def verify(self):
        return GATE.reviewed_print_updates(self.root, self.baseline)

    def test_exact_reviewed_release_allows_only_sixty_files_and_metadata(self):
        accepted = self.verify()
        self.assertEqual(set(accepted), set(GATE.PRINT_LEGEND_PATHS) | {'site/assets/data/manifest.json'})
        self.assertEqual(len(accepted), 61)

    def test_original_baseline_is_required(self):
        path = sorted(GATE.PRINT_LEGEND_PATHS)[0]
        self.baseline[path] = '0' * 64
        with self.assertRaises(ValueError):
            self.verify()

    def test_modified_reviewed_binary_is_rejected(self):
        path = self.root / sorted(GATE.PRINT_LEGEND_PATHS)[0]
        path.write_bytes(path.read_bytes() + b'changed')
        with self.assertRaises(ValueError):
            self.verify()

    def test_transition_cannot_be_expanded_or_rewritten(self):
        self.review['changed_files'].append(self.review['changed_files'][0])
        (self.root / GATE.PRINT_LEGEND_TRANSITION).write_text(json.dumps(self.review))
        with self.assertRaises(ValueError):
            self.verify()

    def test_unapproved_manifest_changes_are_rejected(self):
        path = self.root / 'site/assets/data/manifest.json'
        manifest = json.loads(path.read_text())
        manifest['assets'][0]['dateLayout'][0]['date'] = '1999-01-01'
        path.write_text(json.dumps(manifest))
        with self.assertRaises(ValueError):
            self.verify()

    def test_calendar_source_changes_are_rejected(self):
        path = self.root / self.review['calendar_sources'][0]['path']
        path.write_bytes(path.read_bytes() + b' ')
        with self.assertRaises(ValueError):
            self.verify()

    def test_actual_full_preflight_evidence_is_required(self):
        path = self.root / self.review['preflight_runs'][0]['path']
        report = json.loads(path.read_text())
        report['results'].pop()
        path.write_text(json.dumps(report))
        with self.assertRaises(ValueError):
            self.verify()

    def test_color_and_monthly_files_are_outside_the_exception(self):
        self.assertNotIn('site/downloads/2027-metinis-06.pdf', GATE.PRINT_LEGEND_PATHS)
        self.assertNotIn('site/downloads/2027-sausis-01.pdf', GATE.PRINT_LEGEND_PATHS)
        self.assertEqual(len(GATE.PRINT_LEGEND_STEMS), 15)


if __name__ == '__main__':
    unittest.main()
