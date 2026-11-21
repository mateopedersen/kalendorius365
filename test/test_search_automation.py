import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import indexnow_notify
import search_health


class SearchHealthTests(unittest.TestCase):
    def test_sitemap_coverage_rejects_missing_unexpected_and_duplicate_urls(self):
        report = {"errors": []}
        search_health.check_sitemap_coverage(report, "main sitemap", {"/", "/new/"}, ["/", "/", "/old/"])
        self.assertIn("1 missing, 1 unexpected, 1 duplicate", report["errors"][0]["message"])
        self.assertIn("/new/", report["errors"][0]["message"])

    def test_weather_sitemap_checks_the_registry_robots_and_canonical_samples(self):
        base = "https://kalendorius365.lt"
        main = [base + "/orai/", base + "/saule/kaunas/"]
        weather = [base + path for path in (
            "/orai/miestai/", "/orai/savivaldybes/", "/orai/savivaldybes/kauno-m/",
            "/orai/kaunas/", "/orai/zalgirio-31593/",
        )]
        robots = f"Sitemap: {base}/sitemap-orai.xml\n"

        def response(url):
            return {
                "status": 200, "final_url": url, "headers": {"Content-Type": "text/html"},
                "body": f'<link rel="canonical" href="{url}">'.encode(),
            }

        with tempfile.TemporaryDirectory() as temporary:
            registry = Path(temporary) / "places.json"
            registry.write_text('{"municipalities":{"1":["kauno-m"]},"places":[["kaunas"],["zalgirio-31593"]]}')
            with patch.object(search_health, "WEATHER_REGISTRY", registry), \
                 patch.object(search_health, "fetch", side_effect=response), \
                 patch.object(search_health, "collect_sitemap", return_value=weather) as collect:
                report = {"checks": [], "errors": []}
                search_health.audit_weather_sitemap(report, base, robots, main)
                self.assertEqual(report["errors"], [])
                self.assertEqual(report["weather_sitemap_page_count"], 5)
                self.assertEqual(len(report["checks"]), 6)

                collect.return_value = weather[:-1]
                report = {"checks": [], "errors": []}
                search_health.audit_weather_sitemap(report, base, "", main)
                self.assertEqual([error["check"] for error in report["errors"]],
                                 ["robots.txt", "weather sitemap", "sitemap coverage"])
                self.assertIn("zalgirio-31593", report["errors"][1]["message"])

    def test_workflow_artifact_paths_use_runner_temp_expression(self):
        workflow = (ROOT / ".github/workflows/search-health.yml").read_text(encoding="utf-8")
        for scope in ("daily", "weekly"):
            report = f"search-health-{scope}.json"
            self.assertIn(f'--output "$RUNNER_TEMP/{report}"', workflow)
            self.assertIn(f"path: ${{{{ runner.temp }}}}/{report}", workflow)

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
    def test_deployed_pretty_routes_match_their_index_files(self):
        routes = (
            ("https://kalendorius365.lt/", "public/index.html"),
            ("https://kalendorius365.lt/apie-mus/", "public/apie-mus/index.html"),
            ("https://kalendorius365.lt/2027/vasaris/", "public/2027/vasaris/index.html"),
        )
        for url, path in routes:
            html = (
                '<html><head><title>Kalendorius</title>'
                f'<link rel="canonical" href="{url}"></head>'
                '<body><main><h1>Kalendorius</h1></main></body></html>'
            ).encode()
            with patch.object(indexnow_notify, "live_response", return_value=(200, url, {}, html)):
                with self.subTest(url=url):
                    self.assertTrue(indexnow_notify.deployed(url, {path: html}))

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
