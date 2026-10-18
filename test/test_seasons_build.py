import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts/seasons"))
import pages as seasons_pages


class SeasonsBuildTests(unittest.TestCase):
    def test_related_page_integration_is_byte_stable_across_daily_builds(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for route in ("saule", "irankiai", "astronominis-kalendorius"):
                page = root / "site" / route / "index.html"
                page.parent.mkdir(parents=True)
                body = "<main>content</main>\n" + "\n" * 5
                if route == "astronominis-kalendorius":
                    body = body.replace("</main>", '<tbody id="season-rows"></tbody></main>')
                page.write_text(body)

            seasons_pages.integrations(root)
            first_build = {
                route: (root / "site" / route / "index.html").read_bytes()
                for route in ("saule", "irankiai", "astronominis-kalendorius")
            }
            seasons_pages.integrations(root)

            for route, expected in first_build.items():
                page = root / "site" / route / "index.html"
                self.assertEqual(page.read_bytes(), expected, route)
                self.assertEqual(page.read_text().count("<!-- phase3-related -->"), 1, route)


if __name__ == "__main__":
    unittest.main()
