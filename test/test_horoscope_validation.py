import copy
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("horoscope_validation", ROOT / "scripts/validate_horoscopes.py")
VALIDATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VALIDATOR)


class HoroscopeValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / "site/_data/horoscope_current.json").read_text(encoding="utf-8"))
        cls.signs = json.loads((ROOT / "site/_data/horoscope_signs.json").read_text(encoding="utf-8"))

    def test_current_complete_original_set_passes(self):
        VALIDATOR.validate(copy.deepcopy(self.data), self.signs, require_current=True)

    def test_missing_sign_is_rejected(self):
        data = copy.deepcopy(self.data)
        data["forecasts"].pop()
        with self.assertRaisesRegex(VALIDATOR.ValidationError, "exactly twelve"):
            VALIDATOR.validate(data, self.signs)

    def test_checksum_tampering_is_rejected(self):
        data = copy.deepcopy(self.data)
        data["forecasts"][0]["tip"] += " Pakeista."
        with self.assertRaisesRegex(VALIDATOR.ValidationError, "content_checksum"):
            VALIDATOR.validate(data, self.signs)

    def test_wrong_lithuanian_genitive_is_rejected(self):
        signs = copy.deepcopy(self.signs)
        signs[0]["genitive"] = "Avinas"
        with self.assertRaisesRegex(VALIDATOR.ValidationError, "nominative/genitive"):
            VALIDATOR.validate(copy.deepcopy(self.data), signs)

    def test_autumn_dst_uses_vilnius_offset_not_fixed_utc_plus_three(self):
        data = copy.deepcopy(self.data)
        data["local_date"] = "2026-10-25"
        data["display_date_lt"] = "2026 m. spalio 25 d."
        data["generated_at_utc"] = "2026-10-25T01:30:00Z"
        data["prepared_at_vilnius"] = "2026-10-25T03:30:00+02:00"
        data["prepared_at_display_lt"] = "2026 m. spalio 25 d., 03:30 Lietuvos laiku"
        data["source_publication_date"] = data["local_date"]
        VALIDATOR.validate(data, self.signs)

    def test_candidate_promotion_requires_a_native_editor_review(self):
        data = copy.deepcopy(self.data)
        data["editorial_review_status"] = "automated-structure-review; native-human-proofread-not-performed"
        with self.assertRaisesRegex(VALIDATOR.ValidationError, "native-language editor"):
            VALIDATOR.validate(data, self.signs, require_review=True)


if __name__ == "__main__":
    unittest.main()
