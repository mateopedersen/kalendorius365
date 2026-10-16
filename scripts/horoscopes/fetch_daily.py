#!/usr/bin/env python3
"""Fetch only AstroWay's date-specific calculation fields, never horoscope prose."""

from __future__ import annotations

import hashlib
import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any, Callable

PROVIDER_URL = "https://api.astroway.info/v1/public/horoscope/daily"
TERMS_URL = "https://api.astroway.info/en/terms/"
DOCS_URL = "https://api.astroway.info/en/docs/api/operations/publichoroscopedaily/"
REQUESTED_FIELDS = ("sign", "date", "transits", "aspects", "events")
ALLOWED_DATA_FIELDS = set(REQUESTED_FIELDS)
ENGLISH_SIGNS = (
    "aries", "taurus", "gemini", "cancer", "leo", "virgo",
    "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
)
PLANETS = {"Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"}
ASPECTS = {"Conjunction", "Sextile", "Square", "Trine", "Opposition"}
MAX_ATTEMPTS_PER_SIGN = 2
MAX_REQUESTS_PER_RUN = 24  # 12 ordinary requests and one targeted retry per sign; provider documents 30/hour/IP.


class SourceError(RuntimeError):
    def __init__(self, message: str, *, retryable: bool = False, retry_after: int | None = None):
        super().__init__(message)
        self.retryable = retryable
        self.retry_after = retry_after


@dataclass(frozen=True)
class SourceResult:
    sign: str
    local_date: str
    transits: list[dict[str, Any]]
    aspects: list[dict[str, Any]]
    events: list[dict[str, Any]]
    footer: str
    fetched_at_utc: str
    response_sha256: str
    http_status: int
    rate_limit_remaining: str | None


def validate_response(
    payload: dict[str, Any], *, sign: str, requested_date: date,
    headers: dict[str, str], http_status: int = 200, response_bytes: bytes = b"",
) -> SourceResult:
    if http_status != 200 or payload.get("ok") is not True:
        raise SourceError(f"{sign}: tiekėjas negrąžino sėkmingo atsakymo")
    data = payload.get("data")
    if not isinstance(data, dict) or not ALLOWED_DATA_FIELDS.issuperset(data):
        raise SourceError(f"{sign}: atsakyme yra netikėtų arba neleistinų laukų")
    if data.get("sign") != sign:
        raise SourceError(f"{sign}: atsakymo ženklo raktas nesutampa")
    if data.get("date") != requested_date.isoformat():
        raise SourceError(f"{sign}: skaičiavimų data neatitinka prašytos dienos")
    if not {"sign", "date", "transits", "aspects", "events"}.issubset(data):
        raise SourceError(f"{sign}: trūksta skaičiavimo laukų")
    # These calculations are explicitly date-bound by the provider docs. Its stale-text
    # header is intentionally ignored here because the fields filter excludes all prose.
    transits = data["transits"]
    aspects = data["aspects"]
    events = data["events"]
    if not isinstance(transits, list) or not 8 <= len(transits) <= 24:
        raise SourceError(f"{sign}: tranzitų sąrašas tuščias arba netikėto dydžio")
    if not isinstance(aspects, list) or not 1 <= len(aspects) <= 40:
        raise SourceError(f"{sign}: aspektų sąrašas tuščias arba netikėto dydžio")
    if not isinstance(events, list) or len(events) > 100:
        raise SourceError(f"{sign}: įvykių sąrašas netikėto dydžio")
    seen_planets: set[str] = set()
    for row in transits:
        if not isinstance(row, dict) or row.get("planet") not in PLANETS:
            raise SourceError(f"{sign}: tranzito duomenyse yra nežinomas planetos įrašas")
        if row["planet"] in seen_planets:
            raise SourceError(f"{sign}: pasikartoja tranzito planeta")
        seen_planets.add(row["planet"])
        if not isinstance(row.get("house"), int) or isinstance(row.get("house"), bool) or not 1 <= row["house"] <= 12:
            raise SourceError(f"{sign}: tranzito būstas nepatenka į 1–12 intervalą")
        if not isinstance(row.get("sign"), str) or not row["sign"]:
            raise SourceError(f"{sign}: tranzito ženklo reikšmė tuščia")
        if not isinstance(row.get("degree"), (int, float)) or not math.isfinite(float(row["degree"])) or not 0 <= float(row["degree"]) < 30:
            raise SourceError(f"{sign}: tranzito laipsnis neteisingas")
        if not isinstance(row.get("retrograde"), bool):
            raise SourceError(f"{sign}: tranzito retrogradinis požymis neteisingas")
    if "Sun" not in seen_planets or "Moon" not in seen_planets:
        raise SourceError(f"{sign}: skaičiavimuose trūksta Saulės arba Mėnulio")
    for row in aspects:
        if not isinstance(row, dict) or row.get("aspect") not in ASPECTS:
            raise SourceError(f"{sign}: aspektas nėra atpažintas")
        if row.get("planet1") not in PLANETS or row.get("planet2") not in PLANETS:
            raise SourceError(f"{sign}: aspekto planetos pavadinimas neatpažintas")
        orb = row.get("orb")
        if not isinstance(orb, (int, float)) or not math.isfinite(float(orb)) or not 0 <= float(orb) <= 20:
            raise SourceError(f"{sign}: aspekto nuokrypis neteisingas")
    for row in events:
        if not isinstance(row, dict) or not isinstance(row.get("type"), str) or not isinstance(row.get("at"), str):
            raise SourceError(f"{sign}: astrologinio įvykio struktūra neteisinga")
    footer = payload.get("_footer")
    if not isinstance(footer, str) or "astroway" not in footer.casefold():
        raise SourceError(f"{sign}: atsakyme trūksta AstroWay šaltinio žymos")
    digest = hashlib.sha256(response_bytes or json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
    return SourceResult(
        sign=sign, local_date=requested_date.isoformat(), transits=transits, aspects=aspects,
        events=events, footer=footer,
        fetched_at_utc=datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        response_sha256=digest, http_status=http_status,
        rate_limit_remaining=headers.get("x-ratelimit-remaining") or headers.get("X-RateLimit-Remaining"),
    )


def request_one(sign: str, target_date: date, *, opener: Callable = urllib.request.urlopen) -> SourceResult:
    query = urllib.parse.urlencode({
        "sign": sign, "date": target_date.isoformat(), "lang": "en",
        "fields": ",".join(REQUESTED_FIELDS),
    })
    req = urllib.request.Request(
        f"{PROVIDER_URL}?{query}",
        headers={"User-Agent": "Kalendorius365-calculation-reader/1.0", "Accept": "application/json"},
    )
    try:
        with opener(req, timeout=30) as response:
            raw = response.read(256_000)
            if len(raw) >= 256_000:
                raise SourceError(f"{sign}: API atsakymas viršija saugų dydį")
            payload = json.loads(raw)
            headers = dict(response.headers.items())
            return validate_response(payload, sign=sign, requested_date=target_date, headers=headers,
                                     http_status=response.status, response_bytes=raw)
    except SourceError:
        raise
    except urllib.error.HTTPError as exc:
        try:
            retry_after = int(exc.headers.get("Retry-After", ""))
        except (TypeError, ValueError):
            retry_after = None
        if retry_after is not None:
            retry_after = max(1, min(retry_after, 90))
        retryable = exc.code == 429 or 500 <= exc.code <= 599
        raise SourceError(f"{sign}: AstroWay HTTP {exc.code}", retryable=retryable, retry_after=retry_after) from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        raise SourceError(f"{sign}: nepavyko gauti patikrinamų API skaičiavimų ({type(exc).__name__})", retryable=True) from exc


def fetch_all(target_date: date, *, opener: Callable = urllib.request.urlopen,
              pause: Callable[[float], None] = time.sleep) -> list[SourceResult]:
    results: dict[str, SourceResult] = {}
    calls = 0
    failures: dict[str, str] = {}
    for sign in ENGLISH_SIGNS:
        for attempt in range(MAX_ATTEMPTS_PER_SIGN):
            calls += 1
            if calls > MAX_REQUESTS_PER_RUN:
                raise SourceError("Viršytas šio vykdymo 24 API užklausų limitas")
            try:
                results[sign] = request_one(sign, target_date, opener=opener)
                failures.pop(sign, None)
                break
            except SourceError as exc:
                failures[sign] = str(exc)
                if attempt + 1 == MAX_ATTEMPTS_PER_SIGN or not exc.retryable:
                    continue
                # Retry only the affected sign and honor server-provided quota delays.
                delay = exc.retry_after or (30 if "HTTP 429" in str(exc) else min(2 ** (attempt + 1), 8))
                pause(delay)
            if sign != ENGLISH_SIGNS[-1]:
                pause(1.15)
    if failures or set(results) != set(ENGLISH_SIGNS):
        detail = "; ".join(f"{key}: {value}" for key, value in sorted(failures.items()))
        raise SourceError(f"Nepavyko patvirtinti visų 12 ženklų; nieko nepaskelbsime. {detail}")
    if any(result.local_date != target_date.isoformat() for result in results.values()):
        raise SourceError("Skirtingų ženklų skaičiavimų datos nesutampa")
    return [results[sign] for sign in ENGLISH_SIGNS]
