import sys
import base64
import hashlib
import re
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import inline_route_css as inliner


class InlineScripts(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=False)
        self.sources = []
        self.source = None
        self.template_depth = 0
        self.feed(html)
        self.close()

    def handle_starttag(self, tag, attributes):
        if tag == 'template':
            self.template_depth += 1
        if tag != 'script' or self.template_depth:
            return
        attrs = dict(attributes)
        kind = (attrs.get('type') or '').strip().lower()
        if 'src' not in attrs and kind in {
            '', 'module', 'text/javascript', 'application/javascript',
            'text/ecmascript', 'application/ecmascript',
        }:
            self.source = []

    def handle_data(self, data):
        if self.source is not None:
            self.source.append(data)

    def handle_endtag(self, tag):
        if tag == 'template' and self.template_depth:
            self.template_depth -= 1
        if tag == 'script' and self.source is not None:
            self.sources.append(''.join(self.source))
            self.source = None


class InlineRouteCssTests(unittest.TestCase):
    def test_every_generated_inline_bootstrap_has_an_exact_csp_hash(self):
        headers = (ROOT / 'public/_headers').read_text()
        pages = list((ROOT / 'public').rglob('*.html'))
        self.assertGreaterEqual(len(pages), 190)
        for page in pages:
            scripts = InlineScripts(page.read_text()).sources
            for source in scripts:
                digest = base64.b64encode(hashlib.sha256(source.encode()).digest()).decode()
                self.assertIn("'sha256-" + digest + "'", headers, str(page))
            self.assertEqual(len(scripts), 2, str(page))

    def test_script_parser_keeps_exact_source_and_ignores_inert_markup(self):
        document = ('<!-- <script>comment</script> -->'
                    '<template><script>template</script></template>'
                    '<script type=application/json>{"label":"calendar"}</script>'
                    '<script data-note="1 > 0">console.log("calendar &amp; date")</script >')
        self.assertEqual(InlineScripts(document).sources, ['console.log("calendar &amp; date")'])

    def test_initial_modules_are_preloaded_and_evaluate_after_the_dom_exists(self):
        head_modules = {'catalog-finders.js', 'date-guides.js'}
        deferred = head_modules | {'app.js', 'personal-planner.js'}
        for page in (ROOT / 'public').rglob('*.html'):
            source = page.read_text()
            modules = list(re.finditer(r'<script\b([^>]*)\bsrc="([^"]+\.js(?:\?v=[^"]+)?)"[^>]*>', source))
            head_end = source.index('</head>')
            notice = source.index('<p id="notice"')
            self.assertGreaterEqual(len(modules), 2, str(page))
            self.assertEqual(len({match[2] for match in modules}), len(modules), str(page))
            for match in modules:
                attributes, url = match.groups()
                module = url.split('?', 1)[0].rsplit('/', 1)[-1]
                if module in deferred:
                    self.assertNotRegex(attributes, r'\basync\b', str(page))
                else:
                    self.assertRegex(attributes, r'\basync\b', str(page))
                if module == 'app.js':
                    self.assertIn('<div class="dashboard" inert aria-busy="true">', source, str(page))
                if module == 'personal-planner.js':
                    self.assertIn('data-personal-workspace inert aria-busy="true"', source, str(page))
                if module in head_modules:
                    self.assertLess(match.start(), head_end, str(page))
                else:
                    self.assertGreater(match.start(), notice, str(page))
                self.assertIn('<link rel="modulepreload" href="'+url+'">', source[:head_end], str(page))

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
