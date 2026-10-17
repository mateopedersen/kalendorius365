"""The language audit exception must never become a general asset bypass."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    'monthly_release_gate', ROOT / 'scripts/monthly_holidays/check_release.py'
)
GATE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GATE)


class ReviewedEditorialAllowanceTests(unittest.TestCase):
    def setUp(self):
        self.current = (ROOT / GATE.EDITORIAL_REVIEW_PATH).read_bytes()
        self.manifest = json.loads((ROOT / GATE.EDITORIAL_REVIEW_MANIFEST).read_text())

    def verify(self, current=None, manifest=None, baseline=None):
        return GATE.reviewed_editorial_update(
            self.current if current is None else current,
            GATE.EDITORIAL_REVIEW_BEFORE_SHA256 if baseline is None else baseline,
            self.manifest if manifest is None else manifest,
        )[0]

    def test_exact_reviewed_release_passes(self):
        self.assertTrue(self.verify())

    def test_future_text_change_is_not_implicitly_approved(self):
        self.assertFalse(self.verify(current=self.current.replace(b'Kalendor', b'Kalendar', 1)))

    def test_different_baseline_is_not_approved(self):
        self.assertFalse(self.verify(baseline='0' * 64))

    def test_manifest_cannot_expand_paths_to_identifiers(self):
        altered = copy.deepcopy(self.manifest)
        altered['changes'][0]['path'] = ['articles', 0, 'id']
        self.assertFalse(self.verify(manifest=altered))

    def test_missing_and_duplicate_review_entries_are_rejected(self):
        for mode in ('missing', 'duplicate'):
            with self.subTest(mode=mode):
                altered = copy.deepcopy(self.manifest)
                if mode == 'missing':
                    altered['changes'].pop()
                else:
                    altered['changes'][-1] = altered['changes'][0]
                self.assertFalse(self.verify(manifest=altered))

    def test_before_values_must_reproduce_exact_frozen_original(self):
        altered = copy.deepcopy(self.manifest)
        altered['changes'][0]['before'] += ' pakeista'
        self.assertFalse(self.verify(manifest=altered))

    def test_after_values_must_match_actual_reviewed_document(self):
        altered = copy.deepcopy(self.manifest)
        altered['changes'][0]['after'] += ' pakeista'
        self.assertFalse(self.verify(manifest=altered))

    def test_manifest_cannot_substitute_release_or_hash(self):
        for field in ('version', 'path', 'before_sha256', 'after_sha256'):
            with self.subTest(field=field):
                altered = copy.deepcopy(self.manifest)
                altered[field] += '-changed'
                self.assertFalse(self.verify(manifest=altered))

    def test_only_string_changes_are_allowed(self):
        altered = copy.deepcopy(self.manifest)
        altered['changes'][0]['before'] = 123
        self.assertFalse(self.verify(manifest=altered))

    def test_structural_diff_rejects_key_array_and_type_changes(self):
        before = {'ids': ['one'], 'date': '2027-01-01'}
        for after in (
            {'ids': ['one'], 'date': '2027-01-01', 'extra': 'x'},
            {'ids': ['one', 'two'], 'date': '2027-01-01'},
            {'ids': ['one'], 'date': 20270101},
        ):
            with self.subTest(after=after), self.assertRaises(ValueError):
                GATE.structural_changes(before, after)

    def test_structural_diff_exposes_nontext_factual_changes(self):
        before = {'date': '2027-01-01', 'license': 'CC BY-SA 4.0', 'id': 10}
        after = {'date': '2027-01-02', 'license': 'CC0', 'id': 11}
        changes = GATE.structural_changes(before, after)
        self.assertEqual({x[0] for x in changes}, {('date',), ('license',), ('id',)})
        self.assertFalse({x[0] for x in changes} <= GATE.EDITORIAL_REVIEW_TEXT_PATHS)


if __name__ == '__main__':
    unittest.main()
