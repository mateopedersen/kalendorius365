#!/usr/bin/env python3
"""Independent structural gate for a calculations-only 12-sign source batch."""

from __future__ import annotations

from datetime import date
from typing import Any

from fetch_daily import ENGLISH_SIGNS, SourceResult


def validate_batch(results: list[SourceResult], requested_date: date) -> None:
    if len(results) != 12:
        raise ValueError(f"Šaltinio rinkinyje turi būti 12 ženklų; gauta {len(results)}")
    keys = [item.sign for item in results]
    if len(set(keys)) != 12 or set(keys) != set(ENGLISH_SIGNS):
        raise ValueError("Šaltinio rinkinys turi tiksliai atitikti 12 Vakarų zodiako ženklų")
    if len({item.footer for item in results}) != 1:
        raise ValueError("AstroWay šaltinio žyma turi būti vienoda visuose 12 atsakymų")
    for result in results:
        if result.http_status != 200:
            raise ValueError(f"{result.sign}: HTTP būsena ne 200")
        if result.local_date != requested_date.isoformat():
            raise ValueError(f"{result.sign}: šaltinio data neatitinka Lietuvos datos")
        if not result.footer.startswith("Powered by astroway.api"):
            raise ValueError(f"{result.sign}: trūksta numatytos AstroWay šaltinio žymos")
        if not result.response_sha256 or len(result.response_sha256) != 64:
            raise ValueError(f"{result.sign}: trūksta SHA-256 įrodymo")
        if not any(item["planet"] == "Sun" for item in result.transits) or not any(item["planet"] == "Moon" for item in result.transits):
            raise ValueError(f"{result.sign}: nepatvirtinti Saulės ir Mėnulio tranzitai")
        if not result.aspects:
            raise ValueError(f"{result.sign}: nėra apskaičiuoto aspekto")


def sanitized_report(results: list[SourceResult], requested_date: date) -> dict[str, Any]:
    validate_batch(results, requested_date)
    output = []
    for result in results:
        sun = next(item for item in result.transits if item["planet"] == "Sun")
        moon = next(item for item in result.transits if item["planet"] == "Moon")
        output.append({
            "sign": result.sign,
            "calculation_date": result.local_date,
            "http_status": result.http_status,
            "solar_house": sun["house"],
            "lunar_house": moon["house"],
            "transit_count": len(result.transits),
            "aspect_count": len(result.aspects),
            "event_count": len(result.events),
            "text_fields_excluded": True,
            "attribution_present": True,
            "response_sha256": result.response_sha256,
            "rate_limit_remaining": result.rate_limit_remaining,
        })
    return {
        "target_date": requested_date.isoformat(),
        "source": "https://api.astroway.info/v1/public/horoscope/daily",
        "mode": "calculations-only; fields filter excludes horoscope and sections",
        "requested_fields": ["sign", "date", "transits", "aspects", "events"],
        "provider_footer": results[0].footer,
        "sign_count": len(output),
        "all_twelve_passed": True,
        "results": output,
    }
