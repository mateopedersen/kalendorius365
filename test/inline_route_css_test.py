import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import inline_route_css as inliner


class InlineRouteCssTests(unittest.TestCase):
    def test_follows_lazy_imports_and_template_class_prefixes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            (root / 'assets').mkdir()
            (root / 'assets/main.js').write_text('import("./lazy.js?v=123");')
            (root / 'assets/lazy.js').write_text('node.className = `result-${kind}`; node.classList.add("opened"); dot.className = "dot cat" + index;')
            with patch.object(inliner, 'PUBLIC', root):
                actual = inliner.runtime_classes(['/assets/main.js?v=abc'], {'result-ok', 'result-error', 'opened', 'cat1', 'cat2', 'unrelated'})
            self.assertEqual(actual, {'result-ok', 'result-error', 'opened', 'cat1', 'cat2'})

    def test_inline_cascade_print_preferences_and_other_preloads(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            (root / 'assets').mkdir()
            first = root / 'assets/a.css'
            second = root / 'assets/b.css'
            first.write_text('.used{color:red}.unused{color:blue}@media print{.used{color:black}}')
            second.write_text('.used{color:green}.high-contrast .used{color:white}')
            page = root / 'index.html'
            page.write_text('<link rel="preload" as="font" href="/assets/font.woff2"><link rel="preload" as="style" href="/assets/a.css"><link rel="stylesheet" href="/assets/a.css"><link rel="stylesheet" href="/assets/b.css"><div class="used">Tekstas</div>')
            with patch.object(inliner, 'PUBLIC', root):
                row = inliner.inline_page(page, {first:first.read_text(), second:second.read_text()}, {})
            output = page.read_text()
            self.assertEqual(row['stylesheet_requests_removed'], 2)
            self.assertEqual(output.count('<style '), 1)
            self.assertNotIn('rel="stylesheet"', output)
            self.assertNotIn('as="style"', output)
            self.assertIn('as="font"', output)
            self.assertIn('@media print', output)
            self.assertIn('.high-contrast .used', output)
            self.assertNotIn('.unused', output)
            self.assertLess(output.index('color:red'), output.index('color:green'))

    def test_external_styles_are_not_removed(self):
        parser = inliner.Context()
        parser.feed('<body class="route"><link rel="stylesheet" href="https://example.com/style.css">')
        self.assertEqual(parser.classes, {'route'})
        self.assertIsNone(inliner.local_file(parser.styles[0]))


if __name__ == '__main__':
    unittest.main()
