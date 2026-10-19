"""Regression checks for complete Lithuanian teasers and ICS punctuation."""
import importlib.util
from pathlib import Path
import re
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


DETAIL = load('holiday_copy_detail', 'scripts/holiday_phase2/pages.py')
sys.path.insert(0, str(ROOT / 'scripts/monthly_holidays'))
MONTHLY = load('holiday_copy_monthly', 'scripts/monthly_holidays/pages.py')


class HolidayCopyGenerationTests(unittest.TestCase):
    def test_common_lithuanian_abbreviations_do_not_clip_sentences(self):
        for abbreviation in ('m.', 'd.', 'šv.', 'str.', 'pvz.', 'prof.', 'dr.'):
            with self.subTest(abbreviation=abbreviation):
                text = f'Pirmas sakinys. Nuoroda {abbreviation} Lietuvos istorijoje yra svarbi. Trečias sakinys.'
                self.assertEqual(DETAIL.brief(text), text.rsplit(' Trečias', 1)[0])

    def test_personal_initials_do_not_clip_sentences(self):
        text = 'Pirmas sakinys. J. Basanavičius ir M. K. Čiurlionis minimi tekste. Trečias sakinys.'
        self.assertEqual(DETAIL.brief(text), text.rsplit(' Trečias', 1)[0])

    def test_actual_mothers_day_teaser_reaches_end_of_research_sentence(self):
        article = next(a for a in DETAIL.ARTICLES if a['id'] == 'mothers')
        teaser = DETAIL.brief(article['history'])
        self.assertIn('2016 m. Lietuvos istorijos instituto', teaser)
        self.assertTrue(teaser.endswith('minėjo bažnyčioje.'))
        self.assertNotIn('1990 m.', teaser)

    def test_actual_jonines_teaser_does_not_end_at_saint_abbreviation(self):
        article = next(a for a in DETAIL.ARTICLES if a['slug'] == 'jonines')
        teaser = DETAIL.brief(article['history'])
        self.assertIn('šv. Jono diena.', teaser)
        self.assertFalse(teaser.endswith('šv.'))

    def test_short_text_is_preserved_and_two_sentences_are_complete(self):
        self.assertEqual(DETAIL.brief('Vienas sakinys.'), 'Vienas sakinys.')
        self.assertEqual(DETAIL.brief('Pirmas? Antras! Trečias.'), 'Pirmas? Antras!')

    def test_all_monthly_ics_descriptions_have_single_join_period(self):
        original_root = MONTHLY.ROOT
        try:
            with tempfile.TemporaryDirectory() as directory:
                MONTHLY.ROOT = Path(directory)
                for month in range(1, 13):
                    events = [e for e in MONTHLY.DATA['events'] if e['date'].startswith(f'2027-{month:02d}')]
                    MONTHLY.write_ics(month, events)
                for path in Path(directory).rglob('*.ics'):
                    unfolded = re.sub(r'\r\n[ \t]', '', path.read_bytes().decode())
                    self.assertNotIn('str..', unfolded)
                    if 'Šventinė diena' in unfolded:
                        self.assertIn('Šventinė diena · DK 123 str. ', unfolded)
        finally:
            MONTHLY.ROOT = original_root


if __name__ == '__main__':
    unittest.main()
