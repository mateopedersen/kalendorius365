#!/usr/bin/env python3
"""Submit only materially changed public URLs after they are live in production."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
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

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
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
                self.main_refs.append(("a", attrs["href"]))
            elif tag == "img":
                self.main_refs.append(("img", attrs.get("src", ""), attrs.get("alt", "")))

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        elif tag == "h1":
            self.in_h1 = False
        elif tag == "main" and self.in_main:
            self.in_main -= 1

    def handle_data(self, data):
        if self.in_title:
            self.title.append(data)
        if self.in_h1:
            self.h1.append(data)
        if self.in_main:
            self.main_text.append(data)


def page_signature(data):
    parser = MeaningfulPage()
    parser.feed(data.decode("utf-8", errors="replace"))
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
    current_sitemap = sitemap_urls((ROOT / "public/sitemap.xml").read_bytes())
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

    if len(urls) > MAX_URLS:
        raise ValueError(f"Refusing to submit {len(urls)} URLs; the IndexNow limit is {MAX_URLS} per request")
    return sorted(urls), statuses


def live_response(url, data_limit=2 * 1024 * 1024):
    request = urllib.request.Request(url, headers={"User-Agent": "Kalendorius365IndexNow/1.0", "Range": "bytes=0-2097151"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, response.geturl(), response.headers, response.read(data_limit)
    except urllib.error.HTTPError as error:
        return error.code, error.geturl(), error.headers, error.read(data_limit)


def deployed(url, current_files):
    path = urllib.parse.unquote(urllib.parse.urlsplit(url).path)
    relative = "public" + path
    if relative.endswith("/") or relative == "public":
        relative += "/index.html"
    if relative in current_files:
        expected = current_files[relative]
        status, final_url, headers, body = live_response(url)
        if status not in (200, 206) or final_url != url:
            return False
        if relative.lower().endswith((".pdf", ".webp", ".ics")):
            content_length = headers.get("Content-Length", "")
            content_range = headers.get("Content-Range", "")
            if content_range and "/" in content_range:
                return content_range.rsplit("/", 1)[-1].strip() == str(len(expected))
            return content_length.isdigit() and int(content_length) == len(expected)
        return page_signature(body)[0] == page_signature(expected)[0]
    status, final_url, _, _ = live_response(url)
    return status in (404, 410) or final_url != url


def wait_for_deployment(urls, base, head, timeout_seconds):
    current_files = {}
    for status, paths in git_changed_paths(base, head):
        for path in paths:
            if status.startswith(("A", "M", "R", "C")) and path.startswith("public/"):
                file_path = ROOT / path
                if file_path.is_file():
                    current_files[path] = file_path.read_bytes()
    deadline = time.monotonic() + timeout_seconds
    attempts = 0
    while True:
        pending = [url for url in urls if not deployed(url, current_files)]
        if not pending:
            return attempts + 1
        if time.monotonic() >= deadline:
            raise TimeoutError("Production deploy was not confirmed for: " + ", ".join(pending[:10]))
        attempts += 1
        print(f"deployment_wait attempt={attempts} pending={len(pending)}", flush=True)
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, help="Prior production commit SHA")
    parser.add_argument("--head", required=True, help="New production commit SHA")
    parser.add_argument("--post", action="store_true", help="Wait for deployment and submit to IndexNow")
    parser.add_argument("--wait-seconds", type=int, default=480)
    args = parser.parse_args()
    report = {"base": args.base, "head": args.head, "submitted_urls": [], "status": "no_changes"}
    try:
        if set(args.base) == {"0"}:
            print(json.dumps(report, ensure_ascii=False))
            return 0
        urls, changes = discover_changed_urls(args.base, args.head)
        report["detected_changes"] = changes
        report["submitted_urls"] = urls
        if not urls:
            print(json.dumps(report, ensure_ascii=False, indent=2))
            return 0
        if args.post:
            key, key_path = load_key()
            key_url = f"{BASE_URL}/{key}.txt"
            status, _, _, body = live_response(key_url)
            if status not in (200, 206) or body.decode("utf-8", errors="replace").strip() != key:
                raise RuntimeError("The IndexNow key file is not confirmed live; no URLs were sent")
            report["production_deploy_checks"] = wait_for_deployment(urls, args.base, args.head, args.wait_seconds)
            report["submission"] = submit(urls, key)
            report["key_file"] = str(key_path.relative_to(ROOT))
            report["status"] = report["submission"]["result"]
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
