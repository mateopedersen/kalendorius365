"""Production parity accepts delivery transforms and rejects editorial changes."""

import unittest

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


if __name__ == "__main__":
    unittest.main()
