#!/usr/bin/env python3
"""Submit only materially changed public URLs after they are live in production."""

from __future__ import annotations

import argparse
import hashlib
import html
import http.client
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://kalendorius365.lt"
API_URL = "https://api.indexnow.org/indexnow"
KEY_NAME = re.compile(r"^[A-Za-z0-9-]{8,128}\.txt$")
ASSET_EXTENSIONS = {".pdf", ".webp", ".ics"}
ASSET_PREFIXES = (
    "public/downloads/",
    "public/assets/previews/",
    "public/assets/previews-small/",
    "public/assets/holiday-ics/",
    "public/assets/holiday-phase2-ics/",
    "public/assets/seasons-ics/",
    "public/assets/namedays-ics/",
    "public/assets/holiday-guides-ics/",
)
MAX_URLS = 10_000
WEATHER_PREFIX = BASE_URL + "/orai/"
WEATHER_SITEMAP = "public/sitemap-orai.xml"
WEATHER_REGISTRY = "public/assets/data/weather-places.json"
RELEASE_MANIFEST = "public/assets/release-manifest.json"
WEATHER_ROUTE = re.compile(re.escape(WEATHER_PREFIX) + r"(?:[a-z0-9-]+/){1,2}")
WEATHER_PROBES = 12
RELEASE_DIRECTORY = re.compile(r"^((?:" + re.escape(BASE_URL) + r")?/assets/)releases/[0-9a-f]{20}/")


def asset_reference(url):
    # The release identifier namespaces all assets, including unchanged ones.
    return RELEASE_DIRECTORY.sub(r"\1", url)


def cloudflare_email(value):
    """Decode only a complete Cloudflare email token, never discard content."""
    if not re.fullmatch(r"(?:[0-9a-fA-F]{2}){2,321}", value):
        return None
    encoded = bytes.fromhex(value)
    try:
        address = bytes(byte ^ encoded[0] for byte in encoded[1:]).decode("utf-8")
    except UnicodeDecodeError:
        return None
    if not re.fullmatch(r"[^@\s<>\x00-\x1f\x7f]+@[^@\s<>\x00-\x1f\x7f]+", address):
        return None
    return address


PLAIN_EMAIL_WRAPPER = re.compile(
    r"""<a\s+(?=[^>]*\bhref=["']/cdn-cgi/l/email-protection["'])"""
    r"""(?=[^>]*\bclass=["']__cf_email__["'])(?=[^>]*\bdata-cfemail=["']([0-9a-f]+)["'])"""
    r"""[^>]*>\[email(?:&#160;|&nbsp;|\xa0| )protected\]</a>""",
    re.IGNORECASE,
)


def unwrap_plain_email(match):
    # The edge also wraps bare text addresses, including ones inside a sentence.
    # Restore the original text node with its punctuation and no invented link.
    address = cloudflare_email(match[1])
    return html.escape(address) if address else match[0]


class MeaningfulPage(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = []
        self.description = ""
        self.canonical = ""
        self.robots = ""
        self.h1 = []
        self.main_text = []
        self.main_refs = []
        self.in_title = False
        self.in_h1 = False
        self.in_main = 0
        self.has_main = False
        self.email_spans = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "span":
            address = cloudflare_email(attrs.get("data-cfemail", "")) if "__cf_email__" in attrs.get("class", "").split() else None
            self.email_spans.append(address)
        if tag == "title":
            self.in_title = True
        elif tag == "h1":
            self.in_h1 = True
        elif tag == "main":
            self.in_main += 1
            self.has_main = True
        elif tag == "meta":
            name = attrs.get("name", "").lower()
            if name == "description":
                self.description = attrs.get("content", "")
            elif name == "robots":
                self.robots = attrs.get("content", "")
        elif tag == "link" and "canonical" in attrs.get("rel", "").lower().split():
            self.canonical = attrs.get("href", "")
        if self.in_main:
            if tag == "a" and attrs.get("href"):
                href = attrs["href"]
                prefix = "/cdn-cgi/l/email-protection#"
                address = cloudflare_email(href[len(prefix):]) if href.startswith(prefix) else None
                self.main_refs.append(("a", "mailto:" + address if address else asset_reference(href)))
            elif tag == "img":
                self.main_refs.append(("img", asset_reference(attrs.get("src", "")), attrs.get("alt", "")))

    def handle_endtag(self, tag):
        if tag == "span" and self.email_spans:
            self.email_spans.pop()
        if tag == "title":
            self.in_title = False
        elif tag == "h1":
            self.in_h1 = False
        elif tag == "main" and self.in_main:
            self.in_main -= 1

    def handle_data(self, data):
        # Cloudflare changes both the mailto reference and its visible text.
        # Preserve their decoded values in the signature, rather than omitting
        # email links/text or trusting an arbitrary protection placeholder.
        if self.email_spans and self.email_spans[-1] and data in ("[email\xa0protected]", "[email protected]"):
            data = self.email_spans[-1]
        if self.in_title:
            self.title.append(data)
        if self.in_h1:
            self.h1.append(data)
        if self.in_main:
            self.main_text.append(data)


def page_signature(data):
    parser = MeaningfulPage()
    parser.feed(PLAIN_EMAIL_WRAPPER.sub(unwrap_plain_email, data.decode("utf-8", errors="replace")))
    main_text = parser.main_text if parser.has_main else parser.h1
    normalized = {
        "title": " ".join("".join(parser.title).split()),
        "description": " ".join(parser.description.split()),
        "canonical": parser.canonical,
        "robots": " ".join(parser.robots.lower().split()),
        "h1": " ".join("".join(parser.h1).split()),
        "main_text": " ".join(" ".join(main_text).split()),
        "main_refs": parser.main_refs,
    }
    return hashlib.sha256(json.dumps(normalized, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest(), parser


def git_bytes(revision, path):
    return subprocess.check_output(["git", "show", f"{revision}:{path}"], cwd=ROOT, stderr=subprocess.DEVNULL)


def git_changed_paths(base, head):
    output = subprocess.check_output(["git", "diff", "--name-status", "-z", base, head, "--", "public"], cwd=ROOT)
    tokens = output.decode("utf-8", errors="surrogateescape").split("\0")
    changed = []
    index = 0
    while index < len(tokens) and tokens[index]:
        status = tokens[index]
        index += 1
        count = 2 if status.startswith(("R", "C")) else 1
        paths = tokens[index:index + count]
        index += count
        changed.append((status, paths))
    return changed


def sitemap_urls(data):
    root = ET.fromstring(data)
    result = set()
    for item in root:
        if item.tag.rsplit("}", 1)[-1] != "url":
            continue
        loc = next((child.text for child in item if child.tag.rsplit("}", 1)[-1] == "loc"), None)
        if loc:
            result.add(loc.strip())
    return result


def weather_sitemap(revision):
    try:
        data = git_bytes(revision, WEATHER_SITEMAP)
    except subprocess.CalledProcessError:
        return set()
    urls = sitemap_urls(data)
    if any(not WEATHER_ROUTE.fullmatch(url) for url in urls):
        raise ValueError("The weather sitemap contains an invalid public route")
    return urls


def weather_records(revision):
    registry = json.loads(git_bytes(revision, WEATHER_REGISTRY))
    municipalities = registry["municipalities"]
    wards = registry["wards"]
    records = {}
    members = {district: [] for district in municipalities}
    for row in registry["places"]:
        slug, name, district = row[:3]
        ward = wards.get(str(row[-1]), [])
        town = municipalities[str(district)]
        records[WEATHER_PREFIX + slug + "/"] = (row[1:], town[:3], ward[:1])
        members[str(district)].append((slug, name))
    for district, town in municipalities.items():
        records[WEATHER_PREFIX + "savivaldybes/" + town[0] + "/"] = (town, sorted(members[district]))
    records[WEATHER_PREFIX + "savivaldybes/"] = municipalities
    return records


def discover_weather_changes(base, head):
    old = weather_sitemap(base)
    new = weather_sitemap(head)
    changes = {url: "added-or-updated" for url in new - old}
    changes.update((url, "removed") for url in old - new)
    if old & new and git_bytes(base, WEATHER_REGISTRY) != git_bytes(head, WEATHER_REGISTRY):
        before, after = weather_records(base), weather_records(head)
        changes.update((url, "added-or-updated") for url in old & new if before.get(url) != after.get(url))
    return changes


def canonical_for(data):
    _, parser = page_signature(data)
    return parser.canonical


def public_asset(path):
    if not any(path.startswith(prefix) for prefix in ASSET_PREFIXES):
        return False
    return Path(path).suffix.lower() in ASSET_EXTENSIONS


def changed_public_assets(status, paths):
    if not status.startswith(("A", "M", "D", "R", "C")):
        return []
    return [path for path in paths if public_asset(path)]


def encoded_public_url(path):
    relative = path.removeprefix("public/")
    escaped = urllib.parse.quote(urllib.parse.unquote(relative), safe="/:@-._~")
    return BASE_URL + "/" + escaped.lstrip("/")


def discover_changed_urls(base, head):
    previous_sitemap = sitemap_urls(git_bytes(base, "public/sitemap.xml"))
    current_sitemap = sitemap_urls(git_bytes(head, "public/sitemap.xml"))
    urls = set()
    statuses = []

    for status, paths in git_changed_paths(base, head):
        for path_index, path in enumerate(paths):
            if path.endswith(".html") and ("/index.html" in path or path == "public/index.html"):
                old_data = None
                new_data = None
                try:
                    old_data = git_bytes(base, path)
                except subprocess.CalledProcessError:
                    pass
                current_path = ROOT / path
                if current_path.exists():
                    new_data = current_path.read_bytes()
                if old_data and new_data and page_signature(old_data)[0] == page_signature(new_data)[0]:
                    continue
                removed_path = status.startswith("D") or (len(paths) == 2 and path_index == 0 and status.startswith(("R", "C")))
                if removed_path:
                    if old_data:
                        canonical = canonical_for(old_data)
                        if canonical in previous_sitemap:
                            urls.add(canonical)
                            statuses.append({"url": canonical, "change": "removed"})
                    continue
                if new_data:
                    canonical = canonical_for(new_data)
                    if canonical in current_sitemap and urllib.parse.urlsplit(canonical).netloc == urllib.parse.urlsplit(BASE_URL).netloc:
                        urls.add(canonical)
                        statuses.append({"url": canonical, "change": "added-or-updated"})
                elif old_data:
                    canonical = canonical_for(old_data)
                    if canonical in previous_sitemap:
                        urls.add(canonical)
                        statuses.append({"url": canonical, "change": "removed"})
            elif path in changed_public_assets(status, paths):
                urls.add(encoded_public_url(path))
                statuses.append({"url": encoded_public_url(path), "change": "asset-added-updated-or-removed"})

    return sorted(urls), statuses


def live_response(url, data_limit=2 * 1024 * 1024):
    request = urllib.request.Request(url, headers={"User-Agent": "Kalendorius365IndexNow/1.0", "Range": f"bytes=0-{data_limit - 1}"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, response.geturl(), response.headers, response.read(data_limit)
    except urllib.error.HTTPError as error:
        return error.code, error.geturl(), error.headers, error.read(data_limit)


def public_path_for(url):
    path = urllib.parse.unquote(urllib.parse.urlsplit(url).path)
    relative = "public" + path
    if relative.endswith("/") or relative == "public":
        relative = relative.rstrip("/") + "/index.html"
    return relative


def deployed(url, current_files):
    relative = public_path_for(url)
    try:
        status, final_url, headers, body = live_response(url)
    except (urllib.error.URLError, http.client.HTTPException, TimeoutError, ConnectionError):
        # A transient origin failure proves neither publication nor removal.
        return False
    if relative in current_files:
        expected = current_files[relative]
        if status not in (200, 206) or final_url != url:
            return False
        if relative.lower().endswith((".pdf", ".webp", ".ics")):
            content_length = headers.get("Content-Length", "")
            content_range = headers.get("Content-Range", "")
            if content_range and "/" in content_range:
                return content_range.rsplit("/", 1)[-1].strip() == str(len(expected))
            return content_length.isdigit() and int(content_length) == len(expected)
        return page_signature(body)[0] == page_signature(expected)[0]
    return status in (404, 410) or final_url != url


def weather_probe_urls(changes):
    for action in ("added-or-updated", "removed"):
        urls = sorted(url for url, status in changes.items() if status == action)
        if len(urls) <= WEATHER_PROBES:
            yield from urls
        else:
            # Include both ends and evenly spaced places in large releases.
            for i in range(WEATHER_PROBES):
                yield urls[i * (len(urls) - 1) // (WEATHER_PROBES - 1)]


def deployed_weather_route(url, change):
    try:
        status, final_url, headers, body = live_response(url)
    except (urllib.error.URLError, http.client.HTTPException, TimeoutError, ConnectionError):
        return False
    if change == "removed":
        return status in (404, 410) or (status == 200 and final_url != url)
    if status not in (200, 206) or final_url != url:
        return False
    _, page = page_signature(body)
    return (
        page.canonical == url and bool(page.h1) and bool(page.description)
        and "noindex" not in (page.robots + " " + headers.get("X-Robots-Tag", "")).lower()
    )


def deployed_weather_sitemap(expected_urls, expected_revision):
    sitemap_url = BASE_URL + "/sitemap-orai.xml"
    manifest_url = BASE_URL + "/assets/release-manifest.json"
    try:
        status, final_url, _, body = live_response(sitemap_url, data_limit=8 * 1024 * 1024)
        if status not in (200, 206) or final_url != sitemap_url or sitemap_urls(body) != expected_urls:
            return False
        status, final_url, _, body = live_response(manifest_url)
        return (
            status in (200, 206) and final_url == manifest_url
            and json.loads(body).get("revision") == expected_revision
        )
    except (urllib.error.URLError, http.client.HTTPException, TimeoutError, ConnectionError,
            ET.ParseError, ValueError):
        return False


def wait_for_deployment(urls, base, head, timeout_seconds, weather=None):
    weather = weather or {}
    pending = [url for url in urls if url not in weather]
    paths_to_check = {public_path_for(url) for url in pending}
    current_files = {
        path: git_bytes(head, path)
        for status, paths in git_changed_paths(base, head)
        for path in paths
        if status.startswith(("A", "M", "R", "C"))
        and path in paths_to_check and (ROOT / path).is_file()
    }
    pending_weather = list(weather_probe_urls(weather))
    sitemap_ready = not weather
    if weather:
        expected_urls = weather_sitemap(head)
        expected_revision = json.loads(git_bytes(head, RELEASE_MANIFEST))["revision"]

    deadline = time.monotonic() + timeout_seconds
    attempts = 0
    while True:
        if not sitemap_ready:
            sitemap_ready = deployed_weather_sitemap(expected_urls, expected_revision)
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = pool.map(lambda url: deployed(url, current_files), pending)
            pending = [url for url, ready in zip(pending, results) if not ready]
            if sitemap_ready:
                results = pool.map(lambda url: deployed_weather_route(url, weather[url]), pending_weather)
                pending_weather = [url for url, ready in zip(pending_weather, results) if not ready]
        if sitemap_ready and not pending and not pending_weather:
            return attempts + 1
        if time.monotonic() >= deadline:
            remaining = (["weather sitemap and release revision"] if not sitemap_ready else []) + pending + pending_weather
            raise TimeoutError("Production deploy was not confirmed for: " + ", ".join(remaining[:10]))
        attempts += 1
        print(f"deployment_wait attempt={attempts} pending={len(pending) + len(pending_weather)} weather_sitemap_ready={sitemap_ready}", flush=True)
        time.sleep(min(20, max(1, deadline - time.monotonic())))


def load_key():
    candidates = []
    for path in (ROOT / "public").glob("*.txt"):
        if KEY_NAME.match(path.name):
            value = path.read_text(encoding="utf-8").strip()
            if value == path.stem:
                candidates.append((path.stem, path))
    if len(candidates) != 1:
        raise ValueError(f"Expected exactly one public IndexNow key file, found {len(candidates)}")
    return candidates[0]


def submit(urls, key):
    payload = {
        "host": urllib.parse.urlsplit(BASE_URL).netloc,
        "key": key,
        "keyLocation": f"{BASE_URL}/{key}.txt",
        "urlList": urls,
    }
    request = urllib.request.Request(
        API_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8", "User-Agent": "Kalendorius365IndexNow/1.0"},
        method="POST",
    )
    for attempt, delay in enumerate((0, 15, 45), 1):
        if delay:
            time.sleep(delay)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                status = response.status
                body = response.read(2048).decode("utf-8", errors="replace")
        except urllib.error.HTTPError as error:
            status = error.code
            body = error.read(2048).decode("utf-8", errors="replace")
        if status in (200, 202):
            return {"http_status": status, "result": "accepted" if status == 200 else "received_key_validation_pending", "response": body}
        if status != 429 and status < 500:
            raise RuntimeError(f"IndexNow rejected request with HTTP {status}: {body}")
        if attempt == 3:
            raise RuntimeError(f"IndexNow failed after three attempts with HTTP {status}: {body}")
    raise RuntimeError("IndexNow did not return a response")


def submit_batches(urls, key, receipts):
    for offset in range(0, len(urls), MAX_URLS):
        batch = urls[offset:offset + MAX_URLS]
        response = submit(batch, key)
        receipts.append({"url_count": len(batch), **response})
    pending = any(receipt["http_status"] == 202 for receipt in receipts)
    return "received_key_validation_pending" if pending else "accepted"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, help="Prior production commit SHA")
    parser.add_argument("--head", required=True, help="New production commit SHA")
    parser.add_argument("--weather-only", action="store_true", help="Replay only weather changes")
    parser.add_argument("--post", action="store_true", help="Wait for deployment and submit to IndexNow")
    parser.add_argument("--wait-seconds", type=int, default=1200)
    args = parser.parse_args()
    report = {"base": args.base, "head": args.head, "submitted_urls": [], "status": "no_changes"}
    try:
        if set(args.base) == {"0"}:
            print(json.dumps(report, ensure_ascii=False))
            return 0
        weather = discover_weather_changes(args.base, args.head)
        urls, changes = ([], []) if args.weather_only else discover_changed_urls(args.base, args.head)
        urls = sorted(set(urls) | set(weather))
        changes.extend({"url": url, "change": action} for url, action in sorted(weather.items()))
        report["url_count"] = len(urls)
        report["weather_url_count"] = len(weather)
        if len(urls) <= 100:
            report["detected_changes"] = changes
            report["submitted_urls"] = urls
        else:
            report["change_counts"] = dict(Counter(change["change"] for change in changes))
            report["sample_urls"] = urls[:12]
        if not urls:
            print(json.dumps(report, ensure_ascii=False, indent=2))
            return 0
        if args.post:
            key, key_path = load_key()
            key_url = f"{BASE_URL}/{key}.txt"
            status, _, _, body = live_response(key_url)
            if status not in (200, 206) or body.decode("utf-8", errors="replace").strip() != key:
                raise RuntimeError("The IndexNow key file is not confirmed live; no URLs were sent")
            report["production_deploy_checks"] = wait_for_deployment(urls, args.base, args.head, args.wait_seconds, weather)
            report["batches"] = []
            report["key_file"] = str(key_path.relative_to(ROOT))
            report["status"] = submit_batches(urls, key, report["batches"])
        else:
            report["status"] = "dry_run_only"
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        report["status"] = "failed"
        report["error"] = str(error)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1


if __name__ == "__main__":
    sys.exit(main())
