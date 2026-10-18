"""Evidence manifests outside the frozen asset set must not inflate its count."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    'monthly_preservation_gate', ROOT / 'scripts/monthly_holidays/check_release.py'
)
GATE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GATE)


class PreservationAccountingTests(unittest.TestCase):
    def test_transition_evidence_document_is_not_counted_as_a_baseline_asset(self):
        baseline = {'site/assets/data/search.json': 'search', 'site/assets/app.js': 'old'}
        updates = [
            {'path': 'site/assets/app.js'},
            {'path': 'docs/blank-calendar-redesign/asset-transition.json'},
        ]
        result = GATE.preservation_accounting(0, updates, 0, [], baseline)
        self.assertEqual(result, {
            'accounted': 1,
            'expected': 1,
            'intentional_baseline_assets': 1,
        })

    def test_retired_package_paths_are_counted_with_the_baseline_manifest(self):
        baseline = {'site/assets/data/manifest.json': 'manifest', 'site/old.pdf': 'old'}
        updates = [{'path': 'site/assets/data/manifest.json', 'retired_asset_paths': 1}]
        result = GATE.preservation_accounting(0, updates, 1, [], baseline)
        self.assertEqual(result['accounted'], result['expected'])
        self.assertEqual(result['expected'], 2)


if __name__ == '__main__':
    unittest.main()
