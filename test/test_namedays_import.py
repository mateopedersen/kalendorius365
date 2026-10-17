import importlib.util
from pathlib import Path
import unittest

path=Path(__file__).resolve().parents[1]/'scripts/namedays/import_wikipedia.py'
spec=importlib.util.spec_from_file_location('nameday_importer',path)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class ImportSafety(unittest.TestCase):
    def section(self,body):
        return '<h2 id="Šventės">Šventės</h2><ul><li>Naujieji metai</li></ul><div class="mw-heading"><h3 id="Vardadieniai">Vardadieniai</h3></div>'+body+'<div class="mw-heading"><h2 id="Istorija">Istorija</h2></div><ul><li>Unrelated Person</li></ul>'
    def test_two_lists_citations_and_paragraphs(self):
        raw,names=module.extract(self.section('<ul><li><a>Živilė</a> – Gustis <sup>[1]</sup></li></ul><ul><li>Tolvaldas</li></ul><p>Arvaidė</p>'))
        self.assertEqual(names,['Živilė','Gustis','Tolvaldas','Arvaidė']);self.assertNotIn('Unrelated',raw)
    def test_parenthetical_variants_and_unicode_minus(self):
        _,names=module.extract(self.section('<p>Jaugeda (Jaugedas) − Daugilė – Živilė</p>'))
        self.assertEqual(names,['Jaugeda','Jaugedas','Daugilė','Živilė'])
    def test_within_day_duplicates_are_removed_without_romanizing(self):
        _,names=module.extract(self.section('<p>Arvaidė – Arvaidė – Aistė</p>'))
        self.assertEqual(names,['Arvaidė','Aistė'])
    def test_hyphen_is_not_a_list_separator(self):
        _,names=module.extract(self.section('<p>Marija-Ona – Živilė</p>'))
        self.assertEqual(names,['Marija-Ona','Živilė'])
    def test_missing_empty_ambiguous_or_non_name_sections_fail(self):
        for raw in ['<h2 id="Other">Other</h2>',self.section('<p></p>'),self.section('<p>1940 m. įvykis</p>'),self.section('<p>n/a</p>'),self.section('<p>Jaugeda (neaiški pastaba 123)</p>')]:
            with self.assertRaises(ValueError):module.extract(raw)

if __name__=='__main__':unittest.main()
