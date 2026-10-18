import sys
import base64
import hashlib
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import inline_route_css as inliner


class InlineRouteCssTests(unittest.TestCase):
    def test_every_generated_inline_bootstrap_has_an_exact_csp_hash(self):
        headers = (ROOT / 'public/_headers').read_text()
        pages = list((ROOT / 'public').rglob('*.html'))
        self.assertGreaterEqual(len(pages), 190)
        for page in pages:
            scripts = []
            for attributes, source in re.findall(r'<script\b([^>]*)>(.*?)</script>', page.read_text(), re.S | re.I):
                script_type = re.search(r'''\btype\s*=\s*["']([^"']+)''', attributes, re.I)
                data_block = script_type and script_type.group(1).lower() not in {'module', 'text/javascript', 'application/javascript', 'text/ecmascript', 'application/ecmascript'}
                if re.search(r'\bsrc\s*=', attributes, re.I) or data_block:
                    continue
                scripts.append(source)
                digest = base64.b64encode(hashlib.sha256(source.encode()).digest()).decode()
                self.assertIn("'sha256-" + digest + "'", headers, str(page))
            self.assertEqual(len(scripts), 2, str(page))

    def test_initial_modules_are_preloaded_and_evaluate_after_the_dom_exists(self):
        for page in (ROOT / 'public').rglob('*.html'):
            source = page.read_text()
            modules = re.findall(r'<script\b([^>]*)\bsrc="([^"]+\.js(?:\?v=[^"]+)?)"[^>]*>', source)
            self.assertGreaterEqual(len(modules), 2, str(page))
            self.assertEqual(len({url for _,url in modules}), len(modules), str(page))
            for attributes,url in modules:
                if url.split('?', 1)[0].endswith('/app.js'):
                    self.assertNotRegex(attributes, r'\basync\b', str(page))
                    self.assertIn('<div class="dashboard" inert aria-busy="true">', source, str(page))
                else:
                    self.assertRegex(attributes, r'\basync\b', str(page))
                self.assertIn('<link rel="modulepreload" href="'+url+'">', source[:source.index('</head>')], str(page))
            self.assertGreater(source.index('<script type="module"'), source.index('<p id="notice"'), str(page))

    def test_regex_quotes_do_not_hide_later_runtime_classes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            script = root / 'tools.js'
            script.write_text('''const escape = s => s.replace(/[&<>"']/g, "");
                metrics.className = "calculator-results";
                const html = `<div class="state-${kind}">${text}</div>`;
            ''')
            with patch.object(inliner, 'PUBLIC', root):
                actual = inliner.runtime_classes(['/tools.js'], {'calculator-results', 'state-ok', 'unrelated'})
            self.assertEqual(actual, {'calculator-results', 'state-ok'})

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

    def test_print_only_link_keeps_its_media_and_cascade(self):
        parser = inliner.Context()
        parser.feed('<link rel="stylesheet" href="/assets/print.css" media="print"><link rel="stylesheet" href="/assets/style.css">')
        self.assertEqual(parser.styles, ['/assets/style.css'])

    def test_external_styles_are_not_removed(self):
        parser = inliner.Context()
        parser.feed('<body class="route"><link rel="stylesheet" href="https://example.com/style.css">')
        self.assertEqual(parser.classes, {'route'})
        self.assertIsNone(inliner.local_file(parser.styles[0]))


if __name__ == '__main__':
    unittest.main()
