import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import indexnow_notify
import search_health


class SearchHealthTests(unittest.TestCase):
    def test_robots_groups_keep_search_bots_separate(self):
        text = "User-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: *\nAllow: /\n"
        groups = search_health.robots_groups(text)
        self.assertEqual(groups[0]["agents"], ["oai-searchbot"])
        self.assertEqual(groups[1]["agents"], ["*"])

    def test_internal_link_allows_cache_buster_but_skips_other_queries(self):
        base = "https://kalendorius365.lt"
        link, reason = search_health.normalize_link("/2028/vasaris/?v=abc123", base + "/", base)
        self.assertEqual(link, base + "/2028/vasaris/")
        self.assertIsNone(reason)
        link, reason = search_health.normalize_link("/kurti-kalendoriu/?event=private", base + "/", base)
        self.assertIsNone(link)
        self.assertEqual(reason, "query-skipped")

    def test_cloudflare_email_obfuscation_is_not_crawled_as_a_page(self):
        base = "https://kalendorius365.lt"
        link, reason = search_health.normalize_link(
            "/cdn-cgi/l/email-protection#1234", base + "/kontaktai/", base
        )
        self.assertIsNone(link)
        self.assertEqual(reason, "cloudflare-email-obfuscation")

    def test_sitemap_counts_pages_not_image_locations(self):
        xml = b'''<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
          xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
          <url><loc>https://kalendorius365.lt/</loc><image:image><image:loc>https://kalendorius365.lt/a.webp</image:loc></image:image></url>
          </urlset>'''
        class Report:
            errors = []
        report = Report()
        self.assertEqual(search_health.collect_sitemap_from_bytes(xml, report, "https://kalendorius365.lt"), ["https://kalendorius365.lt/"])


class IndexNowTests(unittest.TestCase):
    def test_asset_allowlist_is_public_download_scope_only(self):
        self.assertTrue(indexnow_notify.public_asset("public/downloads/example.pdf"))
        self.assertTrue(indexnow_notify.public_asset("public/assets/previews/example.webp"))
        self.assertTrue(indexnow_notify.public_asset("public/assets/holiday-phase2-ics/example.ics"))
        self.assertFalse(indexnow_notify.public_asset("public/assets/fonts/private.pdf"))
        self.assertFalse(indexnow_notify.public_asset("public/assets/previews/example.png"))

    def test_renamed_public_assets_notify_both_the_old_and_new_urls(self):
        paths = [
            "public/downloads/old-calendar.pdf",
            "public/downloads/new-calendar.pdf",
            "public/private/old-calendar.pdf",
        ]
        self.assertEqual(
            indexnow_notify.changed_public_assets("R100", paths),
            paths[:2],
        )

    def test_cosmetic_asset_hash_changes_do_not_change_page_signature(self):
        first = b'<html><head><title>Calendar</title><meta name="description" content="Month"><link rel="canonical" href="https://kalendorius365.lt/2028/vasaris/"><script src="/assets/releases/aaa/app.js"></script></head><body><main><h1>2028</h1><p>Days</p></main></body></html>'
        second = first.replace(b"/assets/releases/aaa/app.js", b"/assets/releases/bbb/app.js")
        self.assertEqual(indexnow_notify.page_signature(first)[0], indexnow_notify.page_signature(second)[0])

    def test_page_content_changes_update_signature(self):
        first = b'<html><head><title>Calendar</title><link rel="canonical" href="https://kalendorius365.lt/"></head><body><main><h1>2028</h1><p>Days</p></main></body></html>'
        second = first.replace(b"Days", b"Holidays")
        self.assertNotEqual(indexnow_notify.page_signature(first)[0], indexnow_notify.page_signature(second)[0])


if __name__ == "__main__":
    unittest.main()
