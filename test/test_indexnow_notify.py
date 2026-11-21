"""Production parity accepts delivery transforms and rejects editorial changes."""

import json
import unittest
from http.client import RemoteDisconnected
from subprocess import CalledProcessError
from unittest.mock import call, patch

from scripts import indexnow_notify

from scripts.indexnow_notify import cloudflare_email, page_signature


def encoded(address, key=42):
    return bytes([key, *(byte ^ key for byte in address.encode("utf-8"))]).hex()


def page(content, title="Calendar", canonical="https://kalendorius365.lt/about/"):
    return (f'<title>{title}</title><meta name="description" content="Calendar dates">'
            f'<link rel="canonical" href="{canonical}"><main><h1>About</h1>{content}</main>').encode()


def protected(address, key=42, href_address=None, span_address=None):
    href = encoded(href_address or address, key)
    text = encoded(span_address or address, key ^ 83)
    return (f'<a href="/cdn-cgi/l/email-protection#{href}">'
            f'<span class="__cf_email__" data-cfemail="{text}">[email&#160;protected]</span></a>')


class IndexNowEmailParityTest(unittest.TestCase):
    address = "kalendorius365@gmail.com"

    def original(self):
        return page(f'<p>Contact <a href="mailto:{self.address}">{self.address}</a>.</p>')

    def test_obfuscation_with_independent_keys_preserves_signature(self):
        for key in (0, 1, 42, 127, 255):
            with self.subTest(key=key):
                actual = page(f'<p>Contact {protected(self.address, key)}.</p>')
                self.assertEqual(page_signature(self.original())[0], page_signature(actual)[0])

    def test_repeated_and_standalone_protected_addresses(self):
        old = page(f'<p>{self.address}</p><p>{self.address}</p>')
        span = protected(self.address).split('>', 1)[1].removesuffix('</a>')
        self.assertEqual(page_signature(old)[0], page_signature(page(f'<p>{span}</p><p>{span}</p>'))[0])

    def test_automatically_linked_plain_address_preserves_sentence(self):
        original = page(f'<p>Siųsti į {self.address}. Registruotis nereikia.</p>')
        anchor = (f'<a class="__cf_email__" data-cfemail="{encoded(self.address)}" '
                  'href="/cdn-cgi/l/email-protection">[email&#160;protected]</a>')
        actual = page(f'<p>Siųsti į {anchor}. Registruotis nereikia.</p>')
        expected = page_signature(original)[0]
        self.assertEqual(expected, page_signature(actual)[0])
        self.assertNotEqual(expected, page_signature(actual.replace(encoded(self.address).encode(), encoded('other@example.com').encode()))[0])
        self.assertNotEqual(expected, page_signature(actual.replace(b'/cdn-cgi/l/email-protection', b'/another-link'))[0])
        self.assertNotEqual(expected, page_signature(actual.replace(b'[email&#160;protected]', b'Something else'))[0])

    def test_different_email_href_or_text_is_rejected(self):
        expected = page_signature(self.original())[0]
        for kwargs in ({"href_address": "other@example.com"}, {"span_address": "other@example.com"}):
            self.assertNotEqual(expected, page_signature(page(f'<p>Contact {protected(self.address, **kwargs)}.</p>'))[0])

    def test_other_content_and_metadata_changes_are_rejected(self):
        body = f'<p>Contact {protected(self.address)}.</p>'
        expected = page_signature(self.original())[0]
        variants = [page(body.replace("Contact", "Wrong")), page(body, title="Wrong"),
                    page(body, canonical="https://example.com/"), page(body + '<a href="/wrong/">Wrong</a>'),
                    page(body + '<img src="/different.webp" alt="Changed">')]
        for actual in variants:
            self.assertNotEqual(expected, page_signature(actual)[0])

    def test_only_known_placeholder_is_normalized(self):
        wrong = protected(self.address).replace('[email&#160;protected]', 'unexpected text')
        self.assertNotEqual(page_signature(self.original())[0], page_signature(page(f'<p>Contact {wrong}.</p>'))[0])

    def test_malformed_tokens_and_non_email_content_are_not_decoded(self):
        for value in ("", "a", "00", "00zz", encoded("javascript:alert(1)"), encoded("bad\n@example.com"), "00ff"):
            self.assertIsNone(cloudflare_email(value))
        invalid = protected(self.address).replace(encoded(self.address), "zz")
        self.assertNotEqual(page_signature(self.original())[0], page_signature(page(f'<p>Contact {invalid}.</p>'))[0])

    def test_neighboring_span_text_is_preserved(self):
        old = page(f'<p><a href="mailto:{self.address}">{self.address}</a><span>Important</span></p>')
        actual = page(protected(self.address) + '<span>Important</span>')
        self.assertEqual(page_signature(old)[0], page_signature(actual)[0])
        self.assertNotEqual(page_signature(old)[0], page_signature(page(protected(self.address) + '<span>Changed</span>'))[0])


class IndexNowAssetParityTest(unittest.TestCase):
    def signature(self, url, alt="Mėnulis"):
        return page_signature(page(f'<a href="{url}">Šaltinis</a><img src="{url}" alt="{alt}">'))[0]

    def test_release_directory_is_not_an_editorial_change(self):
        for origin in ("", "https://kalendorius365.lt"):
            a = origin + "/assets/releases/" + "a" * 20 + "/data/source.json?v=3"
            b = a.replace("a" * 20, "b" * 20)
            self.assertEqual(self.signature(a), self.signature(b))
            self.assertNotEqual(self.signature(a), self.signature(b.replace("source", "other")))
            self.assertNotEqual(self.signature(a), self.signature(b.replace("v=3", "v=4")))
            self.assertNotEqual(self.signature(a), self.signature(b, alt="Saulė"))

    def test_unrelated_hosts_and_directories_still_matter(self):
        for root in ("https://other.lt/assets/releases/", "/documents/releases/"):
            a = root + "a" * 20 + "/source.json"
            self.assertNotEqual(self.signature(a), self.signature(a.replace("a" * 20, "b" * 20)))


class IndexNowReleaseRetryTest(unittest.TestCase):
    @patch("scripts.indexnow_notify.live_response", side_effect=RemoteDisconnected())
    def test_interrupted_get_proves_neither_publication_nor_removal(self, _get):
        url = "https://kalendorius365.lt/about/"
        self.assertFalse(indexnow_notify.deployed(url, {"public/about/index.html": b"content"}))
        self.assertFalse(indexnow_notify.deployed(url, {}))

    @patch("scripts.indexnow_notify.git_changed_paths", return_value=[])
    @patch("scripts.indexnow_notify.time.sleep")
    def test_only_unconfirmed_urls_are_polled_again(self, _sleep, _paths):
        visits = []
        def ready(url, _files):
            visits.append(url)
            return url == "first" or visits.count(url) > 1
        with patch("scripts.indexnow_notify.deployed", side_effect=ready):
            self.assertEqual(indexnow_notify.wait_for_deployment(["first", "second"], "base", "head", 60), 2)
        self.assertEqual(visits.count("first"), 1)
        self.assertEqual(visits.count("second"), 2)


class IndexNowWeatherTest(unittest.TestCase):
    kaunas = indexnow_notify.WEATHER_PREFIX + "kaunas/"
    village = indexnow_notify.WEATHER_PREFIX + "kernaves-17745/"
    old_village = indexnow_notify.WEATHER_PREFIX + "retired-place/"
    district = indexnow_notify.WEATHER_PREFIX + "savivaldybes/kauno-m/"

    @staticmethod
    def sitemap(*urls):
        return ("<urlset>" + "".join(f"<url><loc>{url}</loc></url>" for url in urls) + "</urlset>").encode()

    def test_first_weather_release_discovers_all_new_urls(self):
        def read(revision, path):
            self.assertEqual(path, indexnow_notify.WEATHER_SITEMAP)
            if revision == "old":
                raise CalledProcessError(128, "git show")
            return self.sitemap(self.kaunas, self.village)
        with patch.object(indexnow_notify, "git_bytes", side_effect=read):
            changes = indexnow_notify.discover_weather_changes("old", "new")
        self.assertEqual(changes, {self.kaunas: "added-or-updated", self.village: "added-or-updated"})

    def test_weather_delta_notifies_added_removed_and_edited_places(self):
        def read(revision, path):
            slug = "retired-place" if revision == "old" else "kernaves-17745"
            if path == indexnow_notify.WEATHER_SITEMAP:
                return self.sitemap(self.kaunas, indexnow_notify.WEATHER_PREFIX + slug + "/", self.district)
            return json.dumps({
                "snapshot": revision,
                "municipalities": {"1": ["kauno-m", "Kauno miesto", "Kauno", 54.9, 23.9]},
                "places": [
                    ["kaunas", "Kaunas", 1, 54.9, 23.8 if revision == "old" else 23.9, "Kaune", "kaunas", "Kauno", "2"],
                    [slug, "Vietovė", 1, 54.6, 23.7, "", None, "", "2"],
                ],
                "wards": {"2": ["Centras"]},
            }).encode()
        with patch.object(indexnow_notify, "git_bytes", side_effect=read):
            changes = indexnow_notify.discover_weather_changes("old", "new")
        self.assertEqual(changes, {
            self.kaunas: "added-or-updated", self.village: "added-or-updated",
            self.old_village: "removed", self.district: "added-or-updated",
        })

    def test_registry_snapshot_timestamp_alone_does_not_notify(self):
        def read(revision, path):
            if path == indexnow_notify.WEATHER_SITEMAP:
                return self.sitemap(self.kaunas)
            return json.dumps({
                "snapshot": revision,
                "municipalities": {"1": ["kauno-m", "Kauno miesto", "Kauno", 54.9, 23.9]},
                "wards": {},
                "places": [["kaunas", "Kaunas", 1, 54.9, 23.9, "Kaune", "kaunas", "Kauno", None]],
            }).encode()
        with patch.object(indexnow_notify, "git_bytes", side_effect=read):
            self.assertEqual(indexnow_notify.discover_weather_changes("old", "new"), {})

    def test_weather_sitemap_excludes_other_sites_and_queries(self):
        for url in ("https://example.com/orai/kaunas/", self.kaunas + "?dienos=15"):
            with self.subTest(url=url), patch.object(indexnow_notify, "git_bytes", return_value=self.sitemap(url)):
                with self.assertRaises(ValueError):
                    indexnow_notify.weather_sitemap("head")

    def test_production_requires_complete_live_url_set_and_matching_revision(self):
        sitemap = indexnow_notify.BASE_URL + "/sitemap-orai.xml"
        manifest = indexnow_notify.BASE_URL + "/assets/release-manifest.json"
        expected = {self.kaunas, self.village}
        with patch.object(indexnow_notify, "live_response", return_value=(200, sitemap, {}, self.sitemap(self.kaunas))):
            self.assertFalse(indexnow_notify.deployed_weather_sitemap(expected, "release"))
        for revision in ("old", "release"):
            responses = [(200, sitemap, {}, self.sitemap(*expected)),
                         (200, manifest, {}, json.dumps({"revision": revision}).encode())]
            with patch.object(indexnow_notify, "live_response", side_effect=responses):
                self.assertEqual(indexnow_notify.deployed_weather_sitemap(expected, "release"), revision == "release")

    def test_production_requires_indexable_canonical_page_or_removed_status(self):
        for status, headers, canonical, change, expected in [
            (200, {}, self.kaunas, "added-or-updated", True),
            (200, {"X-Robots-Tag": "noindex"}, self.kaunas, "added-or-updated", False),
            (200, {}, self.village, "added-or-updated", False),
            (200, {}, self.kaunas, "removed", False),
            (404, {}, self.kaunas, "removed", True),
        ]:
            with self.subTest(status=status, headers=headers, change=change):
                with patch.object(indexnow_notify, "live_response", return_value=(
                    status, self.kaunas, headers, page("Orai", canonical=canonical)
                )):
                    self.assertEqual(indexnow_notify.deployed_weather_route(self.kaunas, change), expected)

    def test_weather_probes_wait_for_live_sitemap(self):
        changes = {self.kaunas: "added-or-updated", self.old_village: "removed"}
        with (
            patch.object(indexnow_notify, "git_changed_paths", return_value=[]),
            patch.object(indexnow_notify, "weather_sitemap", return_value={self.kaunas}),
            patch.object(indexnow_notify, "git_bytes", return_value=b'{"revision":"current"}'),
            patch.object(indexnow_notify, "deployed_weather_sitemap", side_effect=[False, True]) as sitemap,
            patch.object(indexnow_notify, "deployed_weather_route", return_value=True) as routes,
            patch.object(indexnow_notify.time, "sleep"),
        ):
            self.assertEqual(indexnow_notify.wait_for_deployment(list(changes), "old", "new", 60, changes), 2)
            self.assertEqual(sitemap.call_count, 2)
            routes.assert_has_calls([call(self.kaunas, "added-or-updated"), call(self.old_village, "removed")], any_order=True)
            self.assertEqual(routes.call_count, 2)

    def test_batch_limit_and_partial_key_validation_status(self):
        urls = [indexnow_notify.WEATHER_PREFIX + f"place-{i}/" for i in range(20_901)]
        receipts = []
        responses = [{"http_status": 200}, {"http_status": 200}, {"http_status": 202}]
        with patch.object(indexnow_notify, "submit", side_effect=responses) as post:
            status = indexnow_notify.submit_batches(urls, "public-key", receipts)
        self.assertEqual(status, "received_key_validation_pending")
        self.assertEqual([receipt["url_count"] for receipt in receipts], [10_000, 10_000, 901])
        self.assertEqual([url for args in post.call_args_list for url in args.args[0]], urls)


if __name__ == "__main__":
    unittest.main()
