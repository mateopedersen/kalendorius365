import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import css_route_split as splitter


class RouteCssSplitterTests(unittest.TestCase):
    def test_keeps_only_matching_selector_branches(self):
        source = ".used,.unused{color:red}.unused:hover{color:blue}.used .child{margin:0}"
        result = splitter.filter_css(source, {"used"})
        self.assertIn(".used{color:red}", result)
        self.assertNotIn(".unused", result)
        self.assertNotIn(".used .child", result)

    def test_handles_not_and_keeps_relational_selectors_conservatively(self):
        source = ".used:not(.missing){color:red}.unknown:has(.used){color:blue}"
        result = splitter.filter_css(source, {"used"})
        self.assertIn(".used:not(.missing)", result)
        self.assertIn(".unknown:has(.used)", result)

    def test_filters_nested_media_rules_and_retains_keyframes(self):
        source = "@media(max-width:600px){.used{color:red}.unused{color:blue}}@keyframes pulse{from{opacity:0}to{opacity:1}}"
        result = splitter.filter_css(source, {"used"})
        self.assertIn("@media(max-width:600px){", result)
        self.assertIn(".used{color:red}", result)
        self.assertNotIn(".unused", result)
        self.assertIn("@keyframes pulse", result)

    def test_malformed_and_unknown_css_is_preserved(self):
        source = "@font-face{font-family:Brand;src:url(font.woff2)}"
        self.assertEqual(splitter.filter_css(source, set()), source)
        malformed = ".used{color:red"
        self.assertEqual(splitter.filter_css(malformed, {"used"}), malformed)

    def test_dynamic_template_layout_classes_are_not_mixed_between_routes(self):
        parser = splitter.ClassCollector()
        parser.feed('<body{% if page.horoscope %} class="horoscope-app"{% elsif page.app %} class="homepage-app"{% endif %}><main class="{% if page.app %}dashboard-main{% else %}content-main{% endif %}"><header class="site-header">')
        self.assertEqual(parser.classes, {"site-header"})

    def test_only_classes_from_the_route_javascript_are_safelisted(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "site/assets").mkdir(parents=True)
            (root / "site/assets/used.js").write_text('node("div", "", "route-result");', encoding="utf-8")
            (root / "site/assets/unused.js").write_text('node("div", "", "calendar-result");', encoding="utf-8")
            with patch.object(splitter, "ROOT", root):
                classes = splitter.javascript_classes(("used.js",), {"route-result", "calendar-result"})
        self.assertEqual(classes, {"route-result"})

    def test_generated_bundles_keep_each_family_and_omit_other_family_heroes(self):
        detail = (ROOT / "site/assets/horoscope-detail.css").read_text(encoding="utf-8")
        hub = (ROOT / "site/assets/horoscope-hub.css").read_text(encoding="utf-8")
        guide = (ROOT / "site/assets/zodiac-guide.css").read_text(encoding="utf-8")
        homepage = (ROOT / "site/assets/homepage-bundle.css").read_text(encoding="utf-8")
        self.assertIn(".horoscope-sign-hero", detail)
        self.assertIn(".ascendant-result__title", detail)
        self.assertNotIn(".horoscope-hub-hero", detail)
        self.assertIn(".horoscope-hub-hero", hub)
        self.assertIn(".z-daily-cta", hub)
        self.assertNotIn(".horoscope-sign-hero", hub)
        self.assertIn(".zodiac-guide", guide)
        self.assertIn(".horoscope-teaser", homepage)


if __name__ == "__main__":
    unittest.main()
