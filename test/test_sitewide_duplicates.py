"""Offline audit regressions. Synthetic fixtures are not production evidence.

Duplicate-audit tests use only the standard library. Parser/crawler tests execute
when lxml is installed and are explicitly skipped otherwise; CI adds no package.
"""
import contextlib
import csv
from collections import defaultdict
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


duplicates = load("sitewide_duplicates_test_subject", "scripts/sitewide_audit/duplicates.py")
try:
    import lxml  # noqa: F401 - optional parser dependency, never installed by test.
except ModuleNotFoundError:
    crawler = None
else:
    crawler = load("sitewide_crawler_test_subject", "scripts/sitewide_audit/crawl.py")


def page(route, text=None, title=None, live=False):
    url = duplicates.HOST + route
    return {"url": url, "status": 200, "final_url": url,
            "headers": {"Date": "Sat, 17 Oct 2026 10:00:00 GMT"} if live else {},
            "main_text": text or f"Unique content for {route}",
            "title": [title or route], "h1": [title or route],
            "canonical": [url], "meta": {"description": [f"Description for {route}"]},
            "links": [], "forms": [], "controls": []}


class DuplicateAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="sitewide-audit-unit-fixtures-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def audit(self, pages, variants=None, qa_round=1, target_pages=None, variant_folder="observations"):
        crawl = self.root / "current" / "crawl.json"
        crawl.parent.mkdir(exist_ok=True)
        crawl.write_text(json.dumps({"checked_at": "SYNTHETIC UNIT FIXTURE", "pages": pages}), encoding="utf-8")
        variants_path = None
        if variants is not None:
            variants_path = self.root / variant_folder / "variants.json"
            variants_path.parent.mkdir(exist_ok=True)
            variants_path.write_text(json.dumps(variants), encoding="utf-8")
            (variants_path.parent / "crawl.json").write_text(json.dumps({
                "checked_at": "SYNTHETIC UNIT FIXTURE", "pages": target_pages or pages}), encoding="utf-8")
        output = self.root / "output"
        with contextlib.redirect_stdout(io.StringIO()):
            summary = duplicates.run(crawl, variants_path, output, qa_round)
        return summary, output

    def variant(self, url, target, status=301, redirect=None, **extra):
        value = {"url": url, "canonical_target": target, "status": status,
                 "headers": {"Date": "Sat, 17 Oct 2026 10:00:00 GMT"},
                 "checked_at": "SYNTHETIC UNIT FIXTURE", "variant_type": "HTTP"}
        if redirect is not None:
            value["redirect_target"] = redirect
        value.update(extra)
        return value

    def test_exact_normalization_keeps_case_numbers_and_lithuanian_letters(self):
        self.assertEqual(duplicates.normalized_text(" e\u0307  vardas \n"), "ė vardas")
        self.assertNotEqual(duplicates.normalized_text("2027 Sausis"), duplicates.normalized_text("2028 sausis"))

    def test_unicode_tokenization_and_five_word_shingles_preserve_dates(self):
        self.assertEqual(duplicates.words("ŽIVILĖ, 2028-02-29!"), ["živilė", "2028", "02", "29"])
        self.assertEqual(len(duplicates.shingles(["a", "b", "c", "d", "e", "f"])), 2)
        self.assertEqual(duplicates.shingles(["a", "b"]), set())
        self.assertNotEqual(duplicates.shingles(duplicates.words("2027 m sausio 1 d")),
                            duplicates.shingles(duplicates.words("2028 m sausio 1 d")))

    def test_local_200_cannot_become_production_http(self):
        self.assertFalse(duplicates.production_observation(page("/")))
        disguised = page("/", live=True)
        disguised["status_source"] = "local file existence; not an HTTP observation"
        self.assertFalse(duplicates.production_observation(disguised))

    def test_production_observation_requires_production_host_and_headers(self):
        self.assertTrue(duplicates.production_observation(page("/", live=True)))
        other = page("/", live=True)
        other["url"] = "http://127.0.0.1:9999/"
        self.assertFalse(duplicates.production_observation(other))

    def test_local_round2_remains_explicitly_unverified(self):
        qa1, qa2 = duplicates.stage_labels("fixture", "time", False, 2, "content passed")
        self.assertIn("local content only", qa1)
        self.assertIn("NOT VERIFIED", qa2)
        summary, _ = self.audit([page("/")], qa_round=2)
        self.assertFalse(summary["production_QA2_evidence_supplied"])

    def test_qa1_acquisition_cannot_be_relabelled_qa2(self):
        with self.assertRaisesRegex(ValueError, "cannot be relabelled"):
            duplicates.run(self.root / "qa1-live" / "crawl.json", None, self.root / "out", 2)

    def test_enumerates_every_unordered_pair_once(self):
        summary, output = self.audit([page("/"), page("/metai/"), page("/menesiai/"), page("/irankiai/")])
        rows = list(csv.DictReader(io.StringIO((output / "PAIR_COMPARISON.csv").read_text(encoding="utf-8-sig"))))
        self.assertEqual(summary["compared_all_pairs"], 6)
        self.assertEqual(len({tuple(sorted((r["URL A"], r["URL B"]))) for r in rows}), 6)

    def test_exact_content_is_review_candidate_never_automatic_deletion(self):
        summary, output = self.audit([page("/2027/", "2027 shared exact text"), page("/2028/", "2027 shared exact text")])
        self.assertEqual(len(summary["exact_main_content_pairs"]), 1)
        self.assertEqual(summary["deleted_routes"], [])
        self.assertEqual(summary["merged_routes"], [])
        self.assertEqual(summary["preserved_routes"], 2)
        records = json.loads((output / "preserved-routes.json").read_text())
        self.assertTrue(all(r["action"] == "preserved" and r["review_findings"] for r in records))

    def test_template_similarity_protects_distinct_year_and_month_value(self):
        a, b = page("/2027/sausis/"), page("/2028/sausis/")
        kind, reason = duplicates.pair_classification(a, b, duplicates.describe(a), duplicates.describe(b), False, .99)
        self.assertEqual(kind, "LEGITIMATE_DATE_SPECIFIC_TEMPLATE")
        self.assertIn("Preserve", reason)

    def test_new_unmapped_route_requires_manual_intent_review(self):
        summary, _ = self.audit([page("/new-unmapped-route/")])
        self.assertEqual(summary["routes_needing_manual_review"], [duplicates.HOST + "/new-unmapped-route/"])

    def test_repeated_title_description_and_canonical_are_reported(self):
        a, b = page("/metai/"), page("/menesiai/")
        b["title"], b["meta"], b["canonical"] = a["title"], a["meta"], a["canonical"]
        summary, output = self.audit([a, b])
        self.assertTrue(all(len(summary["metadata_duplicate_groups"][key]) == 1 for key in ("title", "description", "canonical")))
        records = json.loads((output / "preserved-routes.json").read_text())
        self.assertTrue(all(r["metadata_issues"] for r in records))
        self.assertEqual(summary["new_redirects"], [])

    def test_duplicate_url_and_missing_content_reject_incomplete_input(self):
        with self.assertRaisesRegex(ValueError, "Repeated identical URL"):
            self.audit([page("/"), page("/")])
        missing = page("/")
        del missing["main_text"]
        with self.assertRaisesRegex(ValueError, "missing HTML/main content"):
            self.audit([missing])

    def test_local_canonical_target_200_is_not_verified_http(self):
        p = page("/metai/")
        v = self.variant("http://kalendorius365.lt/metai/", p["url"], redirect=p["url"])
        summary, _ = self.audit([p], [v])
        self.assertEqual(summary["variant_targets_http_200_verified"], 0)
        self.assertTrue(summary["variant_findings"])

    def test_permanent_direct_redirect_has_observed_live_target(self):
        p = page("/metai/", live=True)
        v = self.variant("http://kalendorius365.lt/metai/", p["url"], redirect=p["url"])
        summary, _ = self.audit([p], [v])
        self.assertEqual(summary["variant_targets_http_200_verified"], 1)
        self.assertEqual(summary["variant_findings"], [])

    def test_temporary_and_wrong_redirects_require_review(self):
        p = page("/metai/", live=True)
        v = self.variant("http://kalendorius365.lt/metai/", p["url"], status=302, redirect=duplicates.HOST + "/")
        summary, _ = self.audit([p], [v])
        findings = " ".join(summary["variant_findings"][0]["findings"])
        self.assertIn("directly", findings)
        self.assertIn("Temporary", findings)

    def test_tracking_alias_requires_correct_canonical_and_equal_main_content(self):
        p = page("/metai/", live=True)
        v = self.variant(p["url"] + "?utm_source=unit", p["url"], status=200,
                         variant_type="tracking query", canonical=[p["url"]], main_text=p["main_text"])
        summary, _ = self.audit([p], [v])
        self.assertEqual(summary["variant_findings"], [])
        v["canonical"] = [duplicates.HOST + "/"]
        v["main_text"] = "Different content requiring review"
        summary, _ = self.audit([p], [v])
        self.assertIn("expected canonical", " ".join(summary["variant_findings"][0]["findings"]))

    def test_old_variant_evidence_never_relabelled_as_qa2(self):
        p = page("/metai/", live=True)
        v = self.variant("http://kalendorius365.lt/metai/", p["url"], redirect=p["url"])
        summary, output = self.audit([p], [v], qa_round=2, variant_folder="qa1-live")
        self.assertTrue(summary["production_QA2_evidence_supplied"])
        self.assertEqual(summary["variant_qa_round"], 1)
        records = json.loads((output / "variants-reviewed.json").read_text())
        self.assertIn("PENDING", records[0]["QA2"])

    def test_csv_schema_bom_and_explicit_overlap_decisions(self):
        summary, output = self.audit([page("/metai/"), page("/menesiai/")])
        raw = (output / "DUPLICATE_AUDIT.csv").read_bytes()
        self.assertTrue(raw.startswith(b"\xef\xbb\xbf"))
        records = list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
        self.assertEqual(list(records[0]), duplicates.REQUIRED_COLUMNS)
        self.assertEqual(len(summary["reviewed_intent_overlap_pairs"]), 1)
        self.assertIn("Annual directory", summary["reviewed_intent_overlap_pairs"][0]["decision"])


@unittest.skipIf(crawler is None, "lxml is unavailable; parser/crawler checks explicitly skipped, not passed")
class CrawlerRegressionTests(unittest.TestCase):
    def parse(self, markup):
        return crawler.parse(markup.encode(), duplicates.HOST + "/example/")

    def diagnose(self, parsed):
        value = {"url": duplicates.HOST + "/example/", "status": 200,
                 "headers": {}, "final_url": duplicates.HOST + "/example/", **parsed}
        class AllowAll:
            @staticmethod
            def can_fetch(bot, url):
                return True
        crawler.diagnose(value, {value["url"]}, AllowAll())
        return value["issues"]

    def test_svg_title_never_replaces_or_duplicates_head_title(self):
        parsed = self.parse('<html lang="lt"><head><title>Puslapio pavadinimas</title></head>'
                            '<body><main><h1>Antraštė</h1><svg><title>Diagramos vardas</title></svg></main></body></html>')
        self.assertEqual(parsed["title"], ["Puslapio pavadinimas"])

    def test_main_jsonld_is_retained_but_scripts_are_excluded_from_text(self):
        parsed = self.parse('<html lang="lt"><head><title>Testas</title></head><body><main><h1>Turinys</h1>'
                            '<script>PRIVATE_SCRIPT_TEXT</script><script type="application/ld+json">'
                            '{"@context":"https://schema.org","@type":"WebPage","name":"Schemos vardas"}'
                            '</script></main></body></html>')
        self.assertEqual(parsed["structured_data"][0]["name"], "Schemos vardas")
        self.assertNotIn("PRIVATE_SCRIPT_TEXT", parsed["main_text"])
        self.assertNotIn("Schemos vardas", parsed["main_text"])

    def test_googlebot_noindex_and_none_meta_are_detected(self):
        for directive in ("NOINDEX, follow", "none"):
            parsed = self.parse(f'<html><head><meta name="googlebot" content="{directive}"></head><main><h1>X</h1></main></html>')
            self.assertIn("NOINDEX", self.diagnose(parsed))

    def test_x_robots_header_is_case_insensitive_and_detects_none(self):
        parsed = self.parse('<html><head><title>X</title></head><main><h1>X</h1></main></html>')
        for directive in ("NOINDEX", "none"):
            parsed["headers"] = {"X-Robots-Tag": directive}
            self.assertIn("NOINDEX", self.diagnose(parsed))

    def test_canonical_schema_and_missing_alt_failures_are_detected(self):
        parsed = self.parse('<html><head><title>X</title><link rel="canonical" href="https://kalendorius365.lt/wrong/">'
                            '</head><main><h1>X</h1><img src="x.svg"><script type="application/ld+json">{bad}</script></main></html>')
        issues = self.diagnose(parsed)
        for expected in ("CANONICAL_MISMATCH", "INVALID_JSON_LD", "IMAGE_ALT_MISSING"):
            self.assertIn(expected, issues)

    def test_empty_decorative_alt_is_not_a_missing_alt(self):
        parsed = self.parse('<html><head><title>X</title></head><main><h1>X</h1>'
                            '<img src="x.svg" alt="" aria-hidden="true"></main></html>')
        self.assertEqual(parsed["missing_alt"], [])
        self.assertTrue(parsed["images"][0]["decorative"])

    def test_local_crawl_identifies_an_orphan_then_removes_flag_when_linked(self):
        with tempfile.TemporaryDirectory(prefix="crawler-orphan-unit-fixture-") as tmp:
            root = Path(tmp)
            public = root / "public"
            (public / "example").mkdir(parents=True)
            (public / "robots.txt").write_text("User-agent: *\nAllow: /\n")
            (public / "sitemap.xml").write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
                '<url><loc>https://kalendorius365.lt/</loc></url><url><loc>https://kalendorius365.lt/example/</loc></url></urlset>')
            (public / "index.html").write_text('<html><head><title>Pradžia</title></head><main><h1>Pradžia</h1></main></html>')
            (public / "example/index.html").write_text('<html><head><title>Pavyzdys</title></head><main><h1>Pavyzdys</h1></main></html>')
            def sources():
                return defaultdict(set, {duplicates.HOST + "/": {"fixture"}, duplicates.HOST + "/example/": {"fixture"}})
            with patch.object(crawler, "ROOT", root), patch.object(crawler, "discovered_repo", sources):
                with contextlib.redirect_stdout(io.StringIO()):
                    crawler.run(root / "first", local=True)
                first = json.loads((root / "first/crawl.json").read_text())
                orphan = next(p for p in first["pages"] if p["url"].endswith("/example/"))
                self.assertIn("ORPHAN", orphan["issues"])
                self.assertIn("not an HTTP observation", orphan["status_source"])
                (public / "index.html").write_text('<html><head><title>Pradžia</title></head><main><h1>Pradžia</h1><a href="/example/">Pavyzdys</a></main></html>')
                with contextlib.redirect_stdout(io.StringIO()):
                    crawler.run(root / "second", local=True)
                second = json.loads((root / "second/crawl.json").read_text())
                linked = next(p for p in second["pages"] if p["url"].endswith("/example/"))
                self.assertNotIn("ORPHAN", linked["issues"])
                self.assertEqual(linked["inbound_pages"], [duplicates.HOST + "/"])


if __name__ == "__main__":
    result = unittest.main(exit=False).result
    print(json.dumps({"testsRun": result.testsRun, "failures": len(result.failures),
                      "errors": len(result.errors), "skipped": len(result.skipped),
                      "parser_dependency_available": crawler is not None}))
    raise SystemExit(0 if result.wasSuccessful() else 1)
