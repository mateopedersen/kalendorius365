#!/usr/bin/env python3
"""Poll production horoscope routes until all are current, indexable and date-correct."""

from __future__ import annotations

import argparse
import html as html_lib
import json
import os
import time
import re
from datetime import date, datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE = os.environ.get("K365_VERIFY_BASE", "https://kalendorius365.lt").rstrip("/")
SLUGS = ("avinas", "jautis", "dvyniai", "vezys", "liutas", "mergele", "svarstykles", "skorpionas", "saulys", "oziaragis", "vandenis", "zuvys")
ROUTES = ("/horoskopai/",) + tuple(f"/horoskopai/{slug}/" for slug in SLUGS)
ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "site/_data/horoscope_current.json"
SIGNS_PATH = ROOT / "site/_data/horoscope_signs.json"


class PageAudit(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lang = None
        self.canonical = None
        self.robots = None
        self.times: list[str] = []
        self.h1_count = 0
        self.in_h1 = False
        self.h1_parts = []
        self.text_parts = []
        self.update_dates: list[str] = []
        self.noindex = False

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "html":
            self.lang = values.get("lang")
        if tag == "link" and values.get("rel", "").casefold() == "canonical":
            self.canonical = values.get("href")
        if tag == "meta" and values.get("name", "").casefold() == "robots":
            self.robots = values.get("content", "")
            self.noindex = "noindex" in self.robots.casefold()
        if tag == "time" and values.get("datetime"):
            self.times.append(values["datetime"])
            if "data-horoscope-updated" in values:
                self.update_dates.append(values["datetime"])
        if tag == "h1":
            self.h1_count += 1
            self.in_h1 = True

    def handle_endtag(self, tag):
        if tag == "h1":
            self.in_h1 = False

    def handle_data(self, data):
        self.text_parts.append(data)
        if self.in_h1:
            self.h1_parts.append(data)


def normalized(value: str) -> str:
    return re.sub(r"\s+", " ", html_lib.unescape(value)).strip()


def audit_url(route: str, target_date: str, expected_h1: str, required_text: list[str], timeout: int = 18) -> dict:
    expected = BASE + route
    request = Request(expected, headers={"User-Agent": "Kalendorius365-production-verifier/1.0"})
    with urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise ValueError(f"{route}: HTTP {response.status}")
        html = response.read(2_000_001)
        if len(html) > 2_000_000:
            raise ValueError(f"{route}: HTML exceeds the production safety limit")
        content = html.decode("utf-8")
        audit = PageAudit()
        audit.feed(content)
        errors = []
        if audit.lang != "lt":
            errors.append(f"lang={audit.lang!r}")
        if audit.canonical != expected:
            errors.append("canonical mismatch")
        if not audit.robots or "index" not in audit.robots.casefold() or audit.noindex:
            errors.append("not indexable")
        if target_date not in audit.times:
            errors.append("wrong or missing current publication date")
        if audit.h1_count != 1:
            errors.append(f"expected one H1, got {audit.h1_count}")
        if normalized("".join(audit.h1_parts)) != normalized(expected_h1):
            errors.append("H1 text mismatch")
        if audit.update_dates != [target_date]:
            errors.append("missing or incorrect compact update label")
        visible_text = normalized(" ".join(audit.text_parts))
        missing_text = [text for text in required_text if normalized(text) not in visible_text]
        if missing_text:
            errors.append(f"missing {len(missing_text)} expected content fields")
        if errors:
            raise ValueError(f"{route}: " + ", ".join(errors))
        return {"url": expected, "http_status": response.status, "canonical": audit.canonical,
                "lang": audit.lang, "indexable": True, "publication_date": target_date,
                "single_h1": True, "h1": normalized(expected_h1), "compact_update_label": True,
                "content_fields_checked": len(required_text), "complete_content": True}


def audit_sitemap() -> dict:
    request = Request(f"{BASE}/sitemap.xml", headers={"User-Agent": "Kalendorius365-production-verifier/1.0"})
    with urlopen(request, timeout=18) as response:
        if response.status != 200:
            raise ValueError(f"sitemap.xml: HTTP {response.status}")
        content = response.read(2_000_001).decode("utf-8")
    missing = [BASE + route for route in ROUTES if BASE + route not in content]
    if missing:
        raise ValueError("sitemap.xml missing horoscope routes: " + ", ".join(missing))
    return {"url": f"{BASE}/sitemap.xml", "http_status": 200, "horoscope_routes": len(ROUTES), "all_routes_present": True}


def expected_page_content() -> dict[str, tuple[str, list[str]]]:
    daily = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    signs = json.loads(SIGNS_PATH.read_text(encoding="utf-8"))
    forecasts = {row["sign_key"]: row for row in daily["forecasts"]}
    sign_by_key = {row["key"]: row for row in signs}
    expected = {"/horoskopai/": ("Dienos horoskopai", [])}
    for sign in signs:
        key = sign["key"]
        forecast = forecasts[key]
        expected["/horoskopai/"
                 + key + "/"] = (
            f"{sign['genitive']} dienos horoskopas",
            [forecast[field] for field in ("editorial_heading", "lead", "overview", "relationships", "work", "reflection", "tip")]
            + [sign["name"]],
        )
    expected["/horoskopai/"] = (
        "Dienos horoskopai",
        [forecasts[sign["key"]][field]
         for sign in signs for field in ("editorial_heading", "lead")]
        + [sign_by_key[sign["key"]]["name"] for sign in signs],
    )
    return expected


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", required=True, help="Expected Europe/Vilnius date, YYYY-MM-DD")
    parser.add_argument("--max-wait-seconds", type=int, default=300)
    parser.add_argument("--report-path", help="Optional path for the sanitized production QA report")
    args = parser.parse_args()
    target = date.fromisoformat(args.date).isoformat()
    started = time.monotonic()
    attempts = 0
    last_error = ""
    while time.monotonic() - started <= args.max_wait_seconds:
        attempts += 1
        try:
            expected = expected_page_content()
            results = [audit_url(route, target, *expected[route]) for route in ROUTES]
            report = {
                "checked_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                "target_date": target,
                "route_count": len(results),
                "all_routes_passed": True,
                "attempts": attempts,
                "sitemap": audit_sitemap(),
                "results": results,
            }
            encoded = json.dumps(report, ensure_ascii=False, indent=2)
            print(encoded)
            if args.report_path:
                report_path = Path(args.report_path)
                report_path.parent.mkdir(parents=True, exist_ok=True)
                report_path.write_text(encoded + "\n", encoding="utf-8")
            summary_path = __import__("os").environ.get("GITHUB_STEP_SUMMARY")
            if summary_path:
                with open(summary_path, "a", encoding="utf-8") as summary:
                    summary.write(f"## Horoskopų gyvoji patikra\n\nPatvirtinta **{len(results)}/13** URL ir visos sitemap nuorodos, data **{target}**, bandymai: {attempts}.\n\n")
                    summary.write("| URL | HTTP | Kanoninis | Indeksuojamas | Visas turinys |\n|---|---:|---|---|---|\n")
                    for result in results:
                        summary.write(f"| {result['url']} | {result['http_status']} | Taip | Taip | {result['content_fields_checked']} laukai |\n")
            return 0
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
            last_error = str(exc)
            if time.monotonic() - started + 20 > args.max_wait_seconds:
                break
            time.sleep(20)
    print(f"Gyvoji Cloudflare patikra nepasiekė 13/13 maršrutų su {target} data per {args.max_wait_seconds} s: {last_error}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
