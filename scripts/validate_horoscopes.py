#!/usr/bin/env python3
"""Validate the human-edited, twelve-sign horoscope publication set."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
import unicodedata
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "site/_data/horoscope_current.json"
SIGN_PATH = ROOT / "site/_data/horoscope_signs.json"
FIELDS = (
    "sign_key", "editorial_heading", "lead", "overview", "relationships",
    "work", "reflection", "tip",
)
EXPECTED = {
    "avinas": ("Avinas", "Avino"), "jautis": ("Jautis", "Jaučio"),
    "dvyniai": ("Dvyniai", "Dvynių"), "vezys": ("Vėžys", "Vėžio"),
    "liutas": ("Liūtas", "Liūto"), "mergele": ("Mergelė", "Mergelės"),
    "svarstykles": ("Svarstyklės", "Svarstyklių"), "skorpionas": ("Skorpionas", "Skorpiono"),
    "saulys": ("Šaulys", "Šaulio"), "oziaragis": ("Ožiaragis", "Ožiaragio"),
    "vandenis": ("Vandenis", "Vandenio"), "zuvys": ("Žuvys", "Žuvų"),
}
MONTHS = (
    "sausio", "vasario", "kovo", "balandžio", "gegužės", "birželio",
    "liepos", "rugpjūčio", "rugsėjo", "spalio", "lapkričio", "gruodžio",
)
TZ = ZoneInfo("Europe/Vilnius")


class ValidationError(Exception):
    pass


def fail(message: str) -> None:
    raise ValidationError(message)


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"Cannot read {path.relative_to(ROOT)}: {exc}")


def canonical_checksum(records: list[dict]) -> str:
    ordered = sorted(records, key=lambda row: row["sign_key"])
    payload = "\1".join("\0".join(str(row[field]) for field in FIELDS) for row in ordered)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def required_text(value, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        fail(f"{label}: value must be a non-empty string")
    if value != value.strip():
        fail(f"{label}: leading/trailing whitespace is not allowed")
    if value != unicodedata.normalize("NFC", value):
        fail(f"{label}: Lithuanian text must use Unicode NFC")
    if re.search(r"<\s*/?\s*[a-z!]", value, re.I):
        fail(f"{label}: HTML markup is not allowed in source text")
    return value


def validate(data: dict, signs: list[dict], require_current: bool = False, require_review: bool = False) -> None:
    if not isinstance(signs, list) or len(signs) != 12:
        fail("The zodiac dictionary must contain exactly twelve records")
    if {item.get("key") for item in signs} != set(EXPECTED):
        fail("The zodiac dictionary has a missing, duplicate, or unknown slug")
    for sign in signs:
        if (sign.get("name"), sign.get("genitive")) != EXPECTED[sign["key"]]:
            fail(f"Lithuanian nominative/genitive form is incorrect for {sign['key']}")

    records = data.get("forecasts")
    if not isinstance(records, list) or len(records) != 12:
        fail("One complete daily set must contain exactly twelve forecasts")
    if {row.get("sign_key") for row in records} != set(EXPECTED):
        fail("The daily set has a missing, duplicate, or unknown zodiac sign")

    for row in records:
        key = row["sign_key"]
        for field in FIELDS:
            required_text(row.get(field), f"{key}.{field}")
        minimums = {"editorial_heading": 15, "lead": 45, "overview": 110,
                    "relationships": 80, "work": 80, "reflection": 60, "tip": 28}
        for field, minimum in minimums.items():
            if len(row[field]) < minimum:
                fail(f"{key}.{field}: needs at least {minimum} characters")
        if len(row["overview"]) > 520 or any(len(row[field]) > 360 for field in ("relationships", "work", "reflection")):
            fail(f"{key}: text is over the editorial length limit")

    for field in ("editorial_heading", "lead"):
        values = [re.sub(r"[^\w]+", " ", row[field].casefold(), flags=re.UNICODE).strip() for row in records]
        if len(set(values)) != 12:
            fail(f"Repeated {field} detected across the twelve signs")

    local_date = date.fromisoformat(required_text(data.get("local_date"), "local_date"))
    if local_date.isoformat() != data["local_date"]:
        fail("local_date must use canonical YYYY-MM-DD format")
    generated = datetime.fromisoformat(required_text(data.get("generated_at_utc"), "generated_at_utc").replace("Z", "+00:00"))
    if generated.tzinfo is None or generated.utcoffset().total_seconds() != 0:
        fail("generated_at_utc must be an explicit UTC timestamp")
    generated_lt = generated.astimezone(TZ)
    if generated_lt.date() != local_date:
        fail("The Vilnius date derived from generated_at_utc does not match local_date")
    expected_date_label = f"{local_date.year} m. {MONTHS[local_date.month - 1]} {local_date.day} d."
    if data.get("display_date_lt") != expected_date_label:
        fail("display_date_lt does not match local_date")

    prepared = datetime.fromisoformat(required_text(data.get("prepared_at_vilnius"), "prepared_at_vilnius"))
    if prepared.tzinfo is None or prepared.astimezone(TZ).utcoffset() != prepared.utcoffset():
        fail("prepared_at_vilnius must use the correct Europe/Vilnius DST offset")
    if prepared.astimezone(TZ).date() != local_date:
        fail("prepared_at_vilnius does not fall on local_date")
    if generated.astimezone(TZ) != prepared.astimezone(TZ):
        fail("generated_at_utc and prepared_at_vilnius must describe the same instant")
    expected_display = f"{local_date.year} m. {MONTHS[local_date.month - 1]} {local_date.day} d., {prepared.astimezone(TZ):%H:%M} Lietuvos laiku"
    if data.get("prepared_at_display_lt") != expected_display:
        fail("prepared_at_display_lt does not match the timestamp and Lithuanian date")

    for field in ("display_date_lt", "source_publication_date", "source_timezone", "source_provider_id",
                  "license_evidence_id", "attribution_text", "canonical_requirement",
                  "original_text_or_licensed_translation", "editorial_review_status", "content_status"):
        required_text(data.get(field), field)
    if data["source_publication_date"] != local_date.isoformat() or data["source_timezone"] != "Europe/Vilnius":
        fail("Source publication date/timezone do not match the Lithuanian publication date")
    if data["source_provider_id"] != "kalendorius365-original-editorial" or data["source_url"] is not None:
        fail("This publication set accepts only original content without an external source URL")
    if data["canonical_requirement"] != "self-canonical" or data["original_text_or_licensed_translation"] != "original-text":
        fail("Content provenance/canonical requirements are inconsistent with original material")
    if data["content_status"] not in {"draft", "approved", "published", "stale", "unavailable"}:
        fail("Unknown content_status")
    if data.get("content_checksum") != canonical_checksum(records):
        fail("content_checksum does not match all twelve forecast records")
    if require_current and local_date != datetime.now(TZ).date():
        fail(f"Content is dated {local_date}; today's Europe/Vilnius date is {datetime.now(TZ).date()}")
    if require_review and data["editorial_review_status"] != "native-human-proofread-approved":
        fail("A Lithuanian native-language editor must approve the complete set before promotion")


def promote(candidate: Path, require_current: bool) -> None:
    candidate = candidate.resolve()
    draft = load_json(candidate)
    signs = load_json(SIGN_PATH)
    validate(draft, signs, require_current=require_current, require_review=True)
    if draft.get("content_status") not in {"draft", "approved"}:
        fail("A candidate must have content_status draft or approved")
    draft["content_status"] = "published"
    draft["content_checksum"] = canonical_checksum(draft["forecasts"])
    destination = DATA_PATH
    snapshot_dir = ROOT / "docs/horoscopes/snapshots"
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        old = load_json(destination)
        suffix = old.get("content_checksum", "unknown")[:12]
        snapshot = snapshot_dir / f"horoscope-{old.get('local_date', 'unknown')}-{suffix}.json"
        if not snapshot.exists():
            shutil.copy2(destination, snapshot)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=destination.parent, delete=False) as tmp:
        json.dump(draft, tmp, ensure_ascii=False, indent=2)
        tmp.write("\n")
        temporary = Path(tmp.name)
    os.replace(temporary, destination)
    print(f"Published approved twelve-sign content for {draft['local_date']}; previous set saved under docs/horoscopes/snapshots/.")


def check_rendered(release: bool) -> None:
    sitemap_path = ROOT / "public/sitemap.xml"
    sitemap = sitemap_path.read_text(encoding="utf-8") if sitemap_path.exists() else ""
    expected_urls = ["https://kalendorius365.lt/horoskopai/"] + [
        f"https://kalendorius365.lt/horoskopai/{key}/" for key in EXPECTED
    ]
    missing = []
    for url in expected_urls:
        path = ROOT / "public" / url.removeprefix("https://kalendorius365.lt/") / "index.html"
        if not path.is_file():
            missing.append(url)
            continue
        html = path.read_text(encoding="utf-8")
        if f'<link rel="canonical" href="{url}">' not in html:
            fail(f"Wrong or missing canonical in {url}")
        if "<html lang=\"lt\"" not in html or "horoscope" not in html:
            fail(f"Missing Lithuanian language or horoscope page body at {url}")
        if release and '<meta name="robots" content="index, follow">' not in html:
            fail(f"Release page remains noindex: {url}")
        if not release and 'noindex' not in html:
            fail(f"Preview page should remain noindex: {url}")
        if release and url not in sitemap:
            fail(f"Release sitemap is missing {url}")
    if missing:
        fail("Missing generated routes: " + ", ".join(missing))
    if release and "<loc>https://kalendorius365.lt/horoskopai/" not in sitemap:
        fail("Release sitemap does not contain horoscope routes")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--require-current", action="store_true", help="require today's Europe/Vilnius publication date")
    parser.add_argument("--require-native-review", action="store_true", help="require a recorded human Lithuanian proofread")
    parser.add_argument("--check-rendered", action="store_true", help="inspect generated HTML, canonical URLs and sitemap")
    parser.add_argument("--release", action="store_true", help="check indexable release output instead of noindex preview")
    parser.add_argument("--promote", type=Path, help="validate and atomically promote a human-approved candidate JSON")
    args = parser.parse_args()
    try:
        if args.promote:
            promote(args.promote, args.require_current)
        else:
            data = load_json(DATA_PATH)
            signs = load_json(SIGN_PATH)
            validate(data, signs, args.require_current, args.require_native_review)
            print(f"Valid 12-sign original content set: {data['local_date']} ({data['content_status']}); SHA-256 {data['content_checksum']}")
        if args.check_rendered:
            check_rendered(args.release)
            print("Generated horoscope routes, canonicals, robots directives and sitemap checks passed.")
    except (ValidationError, OSError, ValueError, KeyError, TypeError) as exc:
        print(f"HOROSCOPE VALIDATION FAILED: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
