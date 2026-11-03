"""Repeated editorial preparation must leave byte-identical publishable sources."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('blog_enrichment', ROOT / 'scripts/blog/enrich_pages.py')
enrichment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(enrichment)
catalogue_spec = importlib.util.spec_from_file_location('catalogue_enrichment', ROOT / 'scripts/blog/enrich_catalogue.py')
catalogue = importlib.util.module_from_spec(catalogue_spec)
catalogue_spec.loader.exec_module(catalogue)


class PreparationStabilityTest(unittest.TestCase):
    def test_root_and_nested_guides_survive_repeated_rebuilds(self):
        with tempfile.TemporaryDirectory() as directory:
            site = Path(directory)
            for route in ('', 'savaites/2027'):
                path = site / route / 'index.html'
                path.parent.mkdir(parents=True, exist_ok=True)
                original = '---\ntitle: Kalendorius\n---\n<section><h1>Kalendorius</h1></section>\n\n\n'
                path.write_text(original)
                with patch.object(enrichment, 'SITE', site):
                    enrichment.append(route, '<h2>Paaiškinimas</h2><p>Turinys.</p>')
                    first = path.read_bytes()
                    for _ in range(4):
                        enrichment.append(route, '<h2>Paaiškinimas</h2><p>Turinys.</p>')
                        self.assertEqual(path.read_bytes(), first)
                self.assertTrue(path.read_text().startswith(original.rstrip()))
                self.assertEqual(path.read_text().count('data-editorial-extension='), 1)

    def test_catalogue_notes_replace_atomically_without_touching_forecast_or_nesting(self):
        with tempfile.TemporaryDirectory() as directory:
            site = Path(directory)
            path = site / 'horoskopai/zuvys/2026-11-03/v-example/index.html'
            path.parent.mkdir(parents=True)
            original = '---\nrobots: noindex, follow\n---\n<article><time>2026-11-03</time><p>Originali išsaugota publikacija.</p></article>\n'
            path.write_text(original)
            body = '<h2>Versija</h2><section><p>Duomenų paaiškinimas.</p></section>'
            with patch.object(catalogue, 'SITE', site):
                for _ in range(3):
                    catalogue.attach('/horoskopai/zuvys/2026-11-03/v-example/', body)
                    first = path.read_bytes()
                    catalogue.attach('/horoskopai/zuvys/2026-11-03/v-example/', body)
                    self.assertEqual(path.read_bytes(), first)
                self.assertTrue(path.read_text().startswith(original.rstrip()))
                self.assertEqual(path.read_text().count(catalogue.BEGIN), 1)
                catalogue.attach('/horoskopai/zuvys/2026-11-03/v-example/', '<h2>Pataisyta pagalba</h2>')
                self.assertNotIn('Duomenų paaiškinimas.', path.read_text())
                self.assertIn('Originali išsaugota publikacija.', path.read_text())
