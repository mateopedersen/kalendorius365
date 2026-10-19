#!/usr/bin/env python3
"""Read-only daily and weekly production checks for Kalendorius365."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

DEFAULT_BASE = "https://kalendorius365.lt"
USER_AGENT = "Kalendorius365SearchHealth/1.0 (+https://kalendorius365.lt/apie-mus/)"
SITEMAP_LIMIT = 50_000
PAGE_LIMIT = 2 * 1024 * 1024
LINK_LIMIT = 5_000
MIN_REQUEST_INTERVAL = 0.25
_last_request = 0.0


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = []
        self.h1 = []
        self.canonicals = []
        self.robots = []
        self.description = []
        self.links = []
        self.in_title = False
        self.in_h1 = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self.in_title = True
        elif tag == "h1":
            self.in_h1 = True
        elif tag == "meta":
            name = attrs.get("name", "").lower()
            if name == "robots" and attrs.get("content"):
                self.robots.append(attrs["content"])
            elif name == "description" and attrs.get("content"):
                self.description.append(attrs["content"])
        elif tag == "link" and "canonical" in attrs.get("rel", "").lower().split():
            if attrs.get("href"):
                self.canonicals.append(attrs["href"])
        elif tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        elif tag == "h1":
            self.in_h1 = False

    def handle_data(self, data):
        if self.in_title:
            self.title.append(data)
        if self.in_h1:
            self.h1.append(data)


def fetch(url, *, limit=PAGE_LIMIT, headers=None, timeout=25):
    global _last_request
    elapsed = time.monotonic() - _last_request
    if elapsed < MIN_REQUEST_INTERVAL:
        time.sleep(MIN_REQUEST_INTERVAL - elapsed)
    request_headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    if headers:
        request_headers.update(headers)
    request = urllib.request.Request(url, headers=request_headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            result = {
                "status": response.status,
                "final_url": response.geturl(),
                "headers": response.headers,
                "body": response.read(limit),
            }
    except urllib.error.HTTPError as error:
        result = {
            "status": error.code,
            "final_url": error.geturl(),
            "headers": error.headers,
            "body": error.read(limit),
        }
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        result = {"status": 0, "final_url": url, "headers": {}, "body": b"", "error": str(error)}
    _last_request = time.monotonic()
    return result


def add_error(report, check, message):
    report["errors"].append({"check": check, "message": message})


def response_check(report, name, response, expected=200):
    check = {
        "name": name,
        "status": response["status"],
        "final_url": response["final_url"],
        "content_type": response["headers"].get("Content-Type", ""),
    }
    if response.get("error"):
        check["error"] = response["error"]
    report["checks"].append(check)
    if response["status"] != expected:
        add_error(report, name, f"HTTP {response['status']}" + (f": {response['error']}" if response.get("error") else ""))
    return check


def text_body(report, name, response):
    try:
        charset = response["headers"].get_content_charset() if hasattr(response["headers"], "get_content_charset") else None
        return response["body"].decode(charset or "utf-8")
    except (UnicodeDecodeError, LookupError) as error:
        add_error(report, name, f"Response is not valid UTF-8 text: {error}")
        return ""


def parse_page(body):
    parser = PageParser()
    parser.feed(body.decode("utf-8", errors="replace"))
    return parser


def collect_sitemap(url, report, base, depth=0):
    if depth > 3:
        add_error(report, "sitemap", "Sitemap nesting exceeds three levels")
        return []
    response = fetch(url, limit=4 * 1024 * 1024)
    response_check(report, "sitemap" if depth == 0 else "nested sitemap", response)
    if response["status"] != 200:
        return []
    try:
        root = ET.fromstring(response["body"])
    except ET.ParseError as error:
        add_error(report, "sitemap", f"Invalid XML: {error}")
        return []

    return collect_sitemap_from_root(root, report, base, depth)


def collect_sitemap_from_bytes(data, report, base):
    try:
        root = ET.fromstring(data)
    except ET.ParseError as error:
        add_error(report, "sitemap", f"Invalid XML: {error}")
        return []
    return collect_sitemap_from_root(root, report, base, 0)


def collect_sitemap_from_root(root, report, base, depth=0):
    local_name = root.tag.rsplit("}", 1)[-1]
    if local_name == "sitemapindex":
        entries = []
        for child in root:
            loc = next((element.text for element in child if element.tag.rsplit("}", 1)[-1] == "loc"), None)
            if loc:
                if urllib.parse.urlsplit(loc).netloc.lower() != urllib.parse.urlsplit(base).netloc.lower():
                    add_error(report, "sitemap", f"Nested sitemap leaves the site host: {loc}")
                    continue
                entries.extend(collect_sitemap(loc, report, base, depth + 1))
                if len(entries) > SITEMAP_LIMIT:
                    add_error(report, "sitemap", f"More than {SITEMAP_LIMIT} page URLs")
                    return []
        return entries

    if local_name != "urlset":
        add_error(report, "sitemap", f"Expected urlset or sitemapindex, got {local_name}")
        return []
    urls = []
    for item in root:
        if item.tag.rsplit("}", 1)[-1] != "url":
            continue
        loc = next((element.text for element in item if element.tag.rsplit("}", 1)[-1] == "loc"), None)
        if loc:
            urls.append(loc.strip())
    if len(urls) > SITEMAP_LIMIT:
        add_error(report, "sitemap", f"More than {SITEMAP_LIMIT} page URLs")
        return []
    seen = set()
    host = urllib.parse.urlsplit(base).netloc.lower()
    for url_value in urls:
        parsed = urllib.parse.urlsplit(url_value)
        if parsed.scheme != "https" or parsed.netloc.lower() != host or parsed.query or parsed.fragment:
            add_error(report, "sitemap", f"URL is not a clean HTTPS URL on the canonical host: {url_value}")
        if url_value in seen:
            add_error(report, "sitemap", f"Duplicate page URL: {url_value}")
        seen.add(url_value)
    return urls


def robots_groups(text):
    groups = []
    current = None
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line or ":" not in line:
            continue
        key, value = (part.strip() for part in line.split(":", 1))
        if key.lower() == "user-agent":
            if current is None or current["rules"]:
                current = {"agents": [], "rules": []}
                groups.append(current)
            current["agents"].append(value.lower())
        elif current is not None:
            current["rules"].append((key.lower(), value))
    return groups


def check_robots(text, report, sitemap_url):
    groups = robots_groups(text)
    for agent in ("oai-searchbot", "claude-searchbot", "perplexitybot", "*"):
        matching = [group for group in groups if agent in group["agents"]]
        if not matching:
            add_error(report, "robots.txt", f"Missing expected user-agent group: {agent}")
            continue
        rules = [rule for group in matching for rule in group["rules"]]
        if ("allow", "/") not in [(key, value) for key, value in rules]:
            add_error(report, "robots.txt", f"{agent} has no Allow: / rule")
        if any(key == "disallow" and value.strip() in ("/", "/*") for key, value in rules):
            add_error(report, "robots.txt", f"{agent} has a site-wide Disallow rule")
    if f"Sitemap: {sitemap_url}" not in text:
        add_error(report, "robots.txt", f"Missing sitemap declaration for {sitemap_url}")


def normalize_link(raw, page_url, base):
    absolute = urllib.parse.urljoin(page_url, raw.strip())
    parsed = urllib.parse.urlsplit(absolute)
    base_host = urllib.parse.urlsplit(base).netloc.lower()
    if parsed.scheme not in ("http", "https") or parsed.netloc.lower() != base_host:
        return None, "external-or-non-web"
    if parsed.path.startswith("/cdn-cgi/l/email-protection"):
        return None, "cloudflare-email-obfuscation"
    query = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    if query:
        if set(query) != {"v"} or len(query["v"]) != 1 or not re.fullmatch(r"[a-fA-F0-9]{1,64}", query["v"][0]):
            return None, "query-skipped"
    path = urllib.parse.quote(urllib.parse.unquote(parsed.path or "/"), safe="/:@-._~!$&'()*+,;=")
    return urllib.parse.urlunsplit(("https", urllib.parse.urlsplit(base).netloc, path, "", "")), None


def run_audit(scope, base):
    base = base.rstrip("/")
    report = {
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "scope": scope,
        "base_url": base,
        "checks": [],
        "errors": [],
    }
    homepage_url = base + "/"
    home = fetch(homepage_url, limit=PAGE_LIMIT)
    response_check(report, "homepage", home)
    if home["status"] == 200:
        if home["final_url"] != homepage_url:
            add_error(report, "homepage", f"Redirected to {home['final_url']}")
        if not home["headers"].get("Content-Type", "").lower().startswith("text/html"):
            add_error(report, "homepage", f"Expected HTML, got {home['headers'].get('Content-Type', '')}")
        head = parse_page(home["body"])
        if head.canonicals != [homepage_url]:
            add_error(report, "homepage", f"Expected one self canonical, got {head.canonicals}")

    robots_url = base + "/robots.txt"
    robots = fetch(robots_url, limit=256 * 1024)
    response_check(report, "robots.txt", robots)
    robots_text = text_body(report, "robots.txt", robots)
    if robots["status"] == 200:
        if not robots["headers"].get("Content-Type", "").lower().startswith("text/plain"):
            add_error(report, "robots.txt", f"Expected text/plain, got {robots['headers'].get('Content-Type', '')}")
        check_robots(robots_text, report, base + "/sitemap.xml")

    sitemap = collect_sitemap(base + "/sitemap.xml", report, base)
    report["sitemap_page_count"] = len(sitemap)
    report["sample_sitemap_urls"] = sitemap[:5]
    if not sitemap:
        add_error(report, "sitemap", "No page URLs discovered")

    llms_url = base + "/llms.txt"
    llms = fetch(llms_url, limit=256 * 1024)
    response_check(report, "llms.txt", llms)
    llms_text = text_body(report, "llms.txt", llms)
    if llms["status"] == 200:
        if not llms["headers"].get("Content-Type", "").lower().startswith("text/plain"):
            add_error(report, "llms.txt", f"Expected text/plain, got {llms['headers'].get('Content-Type', '')}")
        if not llms_text.startswith("# ") or len(llms_text.strip()) < 200:
            add_error(report, "llms.txt", "Response is empty or does not start with a Markdown heading")

    if scope == "daily":
        return report

    checked_links = set()
    samples = {}
    skipped_query = 0
    for index, url in enumerate(sitemap, 1):
        response = fetch(url, limit=PAGE_LIMIT)
        response_check(report, f"sitemap page {index}", response)
        if response["status"] != 200:
            continue
        if response["final_url"] != url:
            add_error(report, "canonical pages", f"{url} resolved to {response['final_url']}")
        if not response["headers"].get("Content-Type", "").lower().startswith("text/html"):
            add_error(report, "canonical pages", f"{url} returned {response['headers'].get('Content-Type', '')}")
            continue
        parser = parse_page(response["body"])
        if parser.canonicals != [url]:
            add_error(report, "canonical pages", f"{url} has canonical values {parser.canonicals}")
        if not "".join(parser.title).strip():
            add_error(report, "page metadata", f"{url} has no title")
        if not "".join(parser.h1).strip():
            add_error(report, "page metadata", f"{url} has no H1")
        robots_values = ",".join(parser.robots).lower().replace(" ", "")
        header_robots = response["headers"].get("X-Robots-Tag", "").lower()
        if "noindex" in robots_values or "noindex" in header_robots:
            add_error(report, "index policy", f"Indexable sitemap page is marked noindex: {url}")
        for raw_link in parser.links:
            normalized, reason = normalize_link(raw_link, url, base)
            if reason == "query-skipped":
                skipped_query += 1
            if normalized:
                checked_links.add(normalized)
        if "/2028/vasaris/" in url:
            for raw_link in parser.links:
                normalized, _ = normalize_link(raw_link, url, base)
                if not normalized:
                    continue
                suffix = urllib.parse.urlsplit(normalized).path.lower()
                if suffix.endswith(".pdf") and "2028" in suffix and "vasar" in suffix:
                    samples.setdefault("pdf", normalized)
                if suffix.endswith(".webp") and "2028" in suffix and "vasar" in suffix:
                    samples.setdefault("webp", normalized)
        if index % 50 == 0:
            print(f"page_progress {index}/{len(sitemap)}", flush=True)

    for match in re.finditer(r"\[[^\]]*\]\((https?://[^)\s]+)\)", llms_text):
        normalized, reason = normalize_link(match.group(1), llms_url, base)
        if reason == "query-skipped":
            skipped_query += 1
        if normalized:
            checked_links.add(normalized)

    if len(checked_links) > LINK_LIMIT:
        add_error(report, "internal links", f"{len(checked_links)} unique internal targets exceed safe limit {LINK_LIMIT}")
    else:
        for index, url in enumerate(sorted(checked_links), 1):
            response = fetch(url, limit=1, headers={"Range": "bytes=0-0"})
            check = {
                "url": url,
                "status": response["status"],
                "final_url": response["final_url"],
                "content_type": response["headers"].get("Content-Type", ""),
            }
            report.setdefault("internal_link_results", []).append(check)
            if not 200 <= response["status"] < 400:
                add_error(report, "internal links", f"HTTP {response['status']} for {url}")
            if index % 250 == 0:
                print(f"link_progress {index}/{len(checked_links)}", flush=True)

    for kind, url in samples.items():
        response = fetch(url, limit=8192, headers={"Range": "bytes=0-8191"})
        check = {
            "url": url,
            "status": response["status"],
            "content_type": response["headers"].get("Content-Type", ""),
            "bytes_read": len(response["body"]),
            "content_range": response["headers"].get("Content-Range", ""),
        }
        body = response["body"]
        if kind == "pdf":
            check["signature_valid"] = body.startswith(b"%PDF-")
            if not check["signature_valid"] or not response["headers"].get("Content-Type", "").lower().startswith(("application/pdf", "application/octet-stream")):
                add_error(report, "sample downloads", f"2028 February PDF response is not a PDF: {url}")
        else:
            check["signature_valid"] = len(body) >= 12 and body[:4] == b"RIFF" and body[8:12] == b"WEBP"
            if not check["signature_valid"] or not response["headers"].get("Content-Type", "").lower().startswith("image/webp"):
                add_error(report, "sample downloads", f"2028 February WebP response is not a WebP: {url}")
        if response["status"] not in (200, 206):
            add_error(report, "sample downloads", f"HTTP {response['status']} for {url}")
        if response["status"] == 206 and not response["headers"].get("Content-Range", "").startswith("bytes 0-"):
            add_error(report, "sample downloads", f"Unexpected partial response range for {url}")
        report.setdefault("sample_downloads", {})[kind] = check
    if set(samples) != {"pdf", "webp"}:
        add_error(report, "sample downloads", f"Could not find a 2028 February PDF/WebP pair: {sorted(samples)}")

    report["weekly_summary"] = {
        "sitemap_pages_checked": len(sitemap),
        "unique_internal_links_checked": len(report.get("internal_link_results", [])),
        "links_with_query_skipped_for_privacy": skipped_query,
        "links_skipped": len(checked_links) - len(report.get("internal_link_results", [])),
        "indexable_page_errors": sum(1 for item in report["errors"] if item["check"] in ("canonical pages", "page metadata", "index policy")),
    }
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scope", choices=("daily", "weekly"), required=True)
    parser.add_argument("--base-url", default=DEFAULT_BASE)
    parser.add_argument("--output", help="Write the complete JSON report to this path")
    args = parser.parse_args()
    report = run_audit(args.scope, args.base_url)
    result = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as output:
            output.write(result + "\n")
    print(result)
    return 1 if report["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
