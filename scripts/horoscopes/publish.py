#!/usr/bin/env python3
"""Fetch calculations, create original Lithuanian copy, validate, then replace one file atomically."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from editorial_lt import SIGN_NAMES, render_forecast, validate_original_copy
from fetch_daily import DOCS_URL, ENGLISH_SIGNS, PROVIDER_URL, TERMS_URL, SourceError, SourceResult, fetch_all
from validate_source import sanitized_report, validate_batch
from validate_horoscopes import ValidationError, validate as validate_release_data

DATA_PATH = ROOT / "site/_data/horoscope_current.json"
SIGNS_PATH = ROOT / "site/_data/horoscope_signs.json"
VALIDATION_DIR = ROOT / "docs/horoscopes/validation"
TZ = ZoneInfo("Europe/Vilnius")
MONTHS = (
    "sausio", "vasario", "kovo", "balandžio", "gegužės", "birželio",
    "liepos", "rugpjūčio", "rugsėjo", "spalio", "lapkričio", "gruodžio",
)
ENGINE_VERSION = "original-lithuanian-calculation-copy-v1.0"
SOURCE_ID = "astroway-public-calculations-original-lithuanian"
LICENSE_EVIDENCE_ID = "astroway-terms-2026-07-31-calculations-own-interpretation"


def canonical_checksum(forecasts: list[dict]) -> str:
    fields = ("sign_key", "editorial_heading", "lead", "overview", "relationships", "work", "reflection", "tip")
    records = sorted(forecasts, key=lambda row: row["sign_key"])
    canonical = "\1".join("\0".join(str(row[field]) for field in fields) for row in records)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def build_data(results: list[SourceResult], target_date: date, now: datetime | None = None) -> dict:
    validate_batch(results, target_date)
    if now is None:
        now = datetime.now(TZ)
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("Leidimo laikas turi turėti laiko juostą")
    prepared = now.astimezone(TZ)
    if prepared.date() != target_date:
        raise ValueError("Lietuvos vietos data nesutampa su prašoma šaltinio data")
    now_utc = prepared.astimezone(timezone.utc).replace(microsecond=0)
    sign_keys = list(SIGN_NAMES)
    forecasts: list[dict] = []
    provenance: list[dict] = []
    source_by_sign = {ENGLISH_SIGNS.index(result.sign): result for result in results}
    for idx, sign_key in enumerate(sign_keys):
        result = source_by_sign[idx]
        sun = next(row for row in result.transits if row["planet"] == "Sun")
        moon = next(row for row in result.transits if row["planet"] == "Moon")
        aspect = min(result.aspects, key=lambda row: (float(row["orb"]), row["aspect"], row["planet1"], row["planet2"]))
        forecast = render_forecast(sign_key, sun["house"], moon["house"], aspect, target_date)
        forecasts.append(forecast)
        provenance.append({
            "sign_key": sign_key,
            "source_sign": result.sign,
            "response_sha256": result.response_sha256,
            "solar_house": sun["house"],
            "lunar_house": moon["house"],
            "dominant_aspect_type": aspect["aspect"],
        })
    # QA pass 1: licensed-source structure/date and calculated fields.
    validate_batch(results, target_date)
    # QA pass 2: Lithuanian copy shape, length, safety, and cross-sign distinction.
    validate_original_copy(forecasts)
    display_date = f"{target_date.year} m. {MONTHS[target_date.month - 1]} {target_date.day} d."
    checksum = canonical_checksum(forecasts)
    data = {
        "local_date": target_date.isoformat(),
        "display_date_lt": display_date,
        "generated_at_utc": now_utc.isoformat().replace("+00:00", "Z"),
        "fetched_at_utc": now_utc.isoformat().replace("+00:00", "Z"),
        "prepared_at_vilnius": prepared.replace(microsecond=0).isoformat(),
        "prepared_at_display_lt": f"{display_date}, {prepared:%H:%M} Lietuvos laiku",
        "source_publication_date": target_date.isoformat(),
        "source_timezone": "Europe/Vilnius",
        "source_provider_id": SOURCE_ID,
        "source_url": PROVIDER_URL,
        "source_terms_url": TERMS_URL,
        "source_docs_url": DOCS_URL,
        "source_data_fields": ["sign", "date", "transits", "aspects", "events"],
        "source_text_requested": False,
        "provider_footer": results[0].footer,
        "source_data_only": "date-bound astronomical calculations; no provider horoscope prose or translation",
        "license_evidence_id": LICENSE_EVIDENCE_ID,
        "attribution_text": "Astrologinių skaičiavimų šaltinis – AstroWay /api. Lietuviški dienos tekstai originaliai parengti Kalendorius365.lt pagal skaičiavimo duomenis; AstroWay horoskopo tekstas nepaimtas ir neverstas.",
        "canonical_requirement": "self-canonical",
        "original_text_or_licensed_translation": "original-lithuanian-copy-from-calculation-data",
        "editorial_review_status": "automated-rule-based-two-pass-review; native-human-proofread-not-performed",
        "content_status": "published",
        "content_checksum": checksum,
        "source_provenance": provenance,
        "automation": {
            "engine": ENGINE_VERSION,
            "provider": "AstroWay public calculations endpoint (no-key, 30 requests/hour/IP per provider documentation)",
            "terms_url": TERMS_URL,
            "source_fields": ["sign", "date", "transits", "aspects", "events"],
            "provider_text_requested": False,
            "provider_text_used": False,
            "provider_footer_preserved": results[0].footer,
            "locale_source": "date-specific astronomy calculation fields only",
            "locale_output": "lt-LT",
            "translation_model": None,
            "qa_status": "passed",
            "deterministic_gate": "passed",
            "independent_content_gate": "passed",
            "native_human_proofread": False,
            "content_hash": checksum,
            "qa_passes": [
                "12/12 source sign/date/calculation/attribution validation",
                "12/12 Lithuanian length/structure/safety/distinctness validation",
            ],
        },
        "forecasts": forecasts,
    }
    return data


def atomic_write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(encoded)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_name, path)
    except Exception:
        try:
            os.unlink(temp_name)
        except OSError:
            pass
        raise


def write_report(results: list[SourceResult], target_date: date) -> Path:
    report = sanitized_report(results, target_date)
    report["checked_at_utc"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    path = VALIDATION_DIR / "horoscope-source-qa.json"
    atomic_write(path, report)
    return path


def target_day(raw: str | None) -> date:
    if raw:
        try:
            return date.fromisoformat(raw)
        except ValueError as exc:
            raise ValueError("--date peab olema YYYY-MM-DD formaadis") from exc
    return datetime.now(TZ).date()


def needs_publication(day: date) -> bool:
    if not DATA_PATH.is_file():
        return True
    try:
        data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
        if data.get("local_date") != day.isoformat() or data.get("content_status") != "published":
            return True
        signs = json.loads(SIGNS_PATH.read_text(encoding="utf-8"))
        validate_release_data(data, signs, expected_current_date=day)
        return False
    except (ValidationError, OSError, ValueError, KeyError, TypeError, json.JSONDecodeError):
        return True


def set_github_output(name: str, value: str) -> None:
    destination = os.environ.get("GITHUB_OUTPUT")
    if destination:
        with open(destination, "a", encoding="utf-8") as stream:
            stream.write(f"{name}={value}\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", help="Lietuvos leidimo data YYYY-MM-DD formatu; numatyta – šiandien")
    parser.add_argument("--check-only", action="store_true", help="Patikrinti šaltinį, nieko nerašant į publikavimo duomenis")
    parser.add_argument("--report-only", action="store_true", help="Įrašyti tik sanitizuotą šaltinio QA įrodymą")
    parser.add_argument("--check-date", action="store_true", help="Nustatyti, ar šiandienos 12 ženklų rinkinį reikia atnaujinti")
    parser.add_argument("--force", action="store_true", help="Iš naujo gauti ir patikrinti šiandienos rinkinio duomenis")
    args = parser.parse_args(argv)
    try:
        day = target_day(args.date)
        if day != datetime.now(TZ).date():
            raise ValueError("Automatinė publikacija leidžia tik esamos Europe/Vilnius datos turinį")
        required = needs_publication(day)
        if args.check_date:
            print(f"needs_publish={'true' if required else 'false'}")
            set_github_output("needs_publish", "true" if required else "false")
            set_github_output("target_date", day.isoformat())
            return 0
        if not required and not args.force and not args.check_only and not args.report_only:
            print(f"{day.isoformat()} data jau tinkamai paskelbta; antrasis dienos bandymas šaltinio užklausų nedarys.")
            set_github_output("changed", "false")
            return 0
        results = fetch_all(day)
        validate_batch(results, day)
        report = write_report(results, day)
        if args.report_only:
            print(f"Patvirtinta 12/12 skaičiavimų; įrodymas: {report.relative_to(ROOT)}")
            return 0
        data = build_data(results, day)
        if args.check_only:
            print(f"Pass 1: 12/12 skaičiavimų patvirtinti; pass 2: 12/12 originalių LT tekstų patvirtinti; failai nepakeisti. Įrodymas: {report.relative_to(ROOT)}")
            return 0
        atomic_write(DATA_PATH, data)
        set_github_output("changed", "true")
        print(f"Atominiu būdu parengtas 12/12 ženklų rinkinys {day.isoformat()} dienai; tekstas: originalus LT; įrodymas: {report.relative_to(ROOT)}")
        return 0
    except (SourceError, ValueError, OSError) as exc:
        print(f"HOROSKOPŲ LEIDIMAS SUSTABDYTAS: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
