"""The current imported calendar package retires only frozen paths."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    'monthly_print_gate', ROOT / 'scripts/monthly_holidays/check_release.py'
)
GATE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GATE)


class CalendarPackageTransitionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((ROOT / 'site/assets/data/manifest.json').read_text())
        cls.baseline = json.loads(
            (ROOT / 'docs/2027-monthly-holidays/baseline.json').read_text()
        )['assets']

    def test_exact_reviewed_package_retires_only_1560_frozen_paths(self):
        updates, evidence_sha = GATE.reviewed_calendar_package_updates(
            ROOT, self.baseline, copy.deepcopy(self.manifest)
        )
        retired = {path for path, digest in updates.items() if digest is None}
        self.assertEqual(len(retired), 390 * 4)
        self.assertTrue(retired <= self.baseline.keys())
        self.assertEqual(
            updates['site/assets/data/manifest.json'],
            hashlib.sha256((ROOT / 'site/assets/data/manifest.json').read_bytes()).hexdigest(),
        )
        self.assertEqual(evidence_sha, self.manifest['packageImport']['evidenceSha256'])

    def test_manifest_record_cannot_drift_from_the_pinned_package(self):
        changed = copy.deepcopy(self.manifest)
        changed['assets'][0]['files']['pdf']['sha256'] = '0' * 64
        with self.assertRaises(ValueError):
            GATE.reviewed_calendar_package_updates(ROOT, self.baseline, changed)

    def test_package_evidence_digest_is_pinned(self):
        changed = copy.deepcopy(self.manifest)
        changed['packageImport']['evidenceSha256'] = '0' * 64
        with self.assertRaises(ValueError):
            GATE.reviewed_calendar_package_updates(ROOT, self.baseline, changed)

    def test_retired_assets_must_match_the_frozen_baseline(self):
        changed_baseline = dict(self.baseline)
        first_retired = next(iter(GATE.validate_import_evidence(ROOT)['retiredPaths']))
        changed_baseline[first_retired] = '0' * 64
        with self.assertRaises(ValueError):
            GATE.reviewed_calendar_package_updates(
                ROOT, changed_baseline, copy.deepcopy(self.manifest)
            )


if __name__ == '__main__':
    unittest.main()
