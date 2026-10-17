#!/usr/bin/env python3
"""Offline tests for calculations-only fetch, original Lithuanian generation and atomic data shape."""

from __future__ import annotations

import hashlib
import json
import sys
import unittest
import urllib.error
import urllib.parse
from dataclasses import replace
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))

from editorial_lt import ENGLISH_SIGNS, SIGN_NAMES, render_forecast, validate_original_copy
from fetch_daily import SourceError, SourceResult, fetch_all, validate_response
from publish import build_data
from validate_source import validate_batch
from validate_horoscopes import validate as validate_release_data


DAY = date(2026, 10, 16)
FOOTER = "Powered by astroway.api - get your own key at https://api.astroway.info"


def payload(sign="aries", requested_date=DAY, include_prose=False):
    data = {
        "sign": sign,
        "date": requested_date.isoformat(),
        "transits": [
            {"planet": "Sun", "house": 7, "degree": 23.1, "retrograde": False, "sign": "Libra"},
            {"planet": "Moon", "house": 9, "degree": 29.5, "retrograde": False, "sign": "Sagittarius"},
            {"planet": "Mercury", "house": 8, "degree": 17.7, "retrograde": False, "sign": "Scorpio"},
            {"planet": "Venus", "house": 8, "degree": 5.1, "retrograde": True, "sign": "Scorpio"},
            {"planet": "Mars", "house": 5, "degree": 10.5, "retrograde": False, "sign": "Leo"},
            {"planet": "Jupiter", "house": 5, "degree": 22.2, "retrograde": False, "sign": "Leo"},
            {"planet": "Saturn", "house": 1, "degree": 10.4, "retrograde": True, "sign": "Aries"},
            {"planet": "Uranus", "house": 3, "degree": 5.2, "retrograde": True, "sign": "Gemini"},
        ],
        "aspects": [
            {"planet1": "Sun", "planet2": "Jupiter", "aspect": "Trine", "orb": 0.1},
            {"planet1": "Mercury", "planet2": "Mars", "aspect": "Square", "orb": 1.2},
        ],
        "events": [{"type": "station", "at": "2026-10-16T12:00:00Z", "planet": "Pluto"}],
    }
    if include_prose:
        data["horoscope"] = "This must never enter the source workflow."
    return {"ok": True, "data": data, "_footer": FOOTER}


def source_result(sign, idx):
    data = payload(sign)
    transits = data["data"]["transits"]
    transits[0]["house"] = idx
    transits[1]["house"] = (idx % 12) + 1
    return SourceResult(
        sign=sign, local_date=DAY.isoformat(), transits=transits,
        aspects=data["data"]["aspects"], events=data["data"]["events"], footer=FOOTER,
        fetched_at_utc="2026-10-16T13:30:00Z", response_sha256=hashlib.sha256(sign.encode()).hexdigest(),
        http_status=200, rate_limit_remaining="18",
    )


class ProviderValidationTests(unittest.TestCase):
    def test_calculation_only_response_passes(self):
        result = validate_response(payload(), sign="aries", requested_date=DAY, headers={"X-RateLimit-Remaining": "29"}, response_bytes=b"safe")
        self.assertEqual(result.local_date, DAY.isoformat())
        self.assertEqual(result.transits[0]["planet"], "Sun")
        self.assertEqual(result.rate_limit_remaining, "29")

    def test_fields_filter_must_remove_horoscope_prose(self):
        with self.assertRaisesRegex(SourceError, "netikėtų arba neleistinų laukų"):
            validate_response(payload(include_prose=True), sign="aries", requested_date=DAY, headers={})

    def test_wrong_date_rejected(self):
        with self.assertRaisesRegex(SourceError, "data neatitinka"):
            validate_response(payload(requested_date=date(2026, 10, 15)), sign="aries", requested_date=DAY, headers={})

    def test_wrong_sign_rejected(self):
        with self.assertRaisesRegex(SourceError, "ženklo raktas nesutampa"):
            validate_response(payload(sign="taurus"), sign="aries", requested_date=DAY, headers={})

    def test_stale_text_header_is_ignored_when_prose_is_excluded(self):
        result = validate_response(payload(), sign="aries", requested_date=DAY, headers={"X-AI-Cache": "STALE"})
        self.assertEqual(result.sign, "aries")

    def test_impossible_house_rejected(self):
        bad = payload()
        bad["data"]["transits"][0]["house"] = 13
        with self.assertRaisesRegex(SourceError, "būstas nepatenka"):
            validate_response(bad, sign="aries", requested_date=DAY, headers={})

    def test_batch_requests_only_calculation_fields_for_all_twelve_signs(self):
        calls = []
        pauses = []

        class Response:
            status = 200
            headers = {"X-RateLimit-Remaining": "29"}

            def __init__(self, body):
                self.body = body

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self, _limit):
                return self.body

        def opener(request, timeout):
            query = urllib.parse.parse_qs(urllib.parse.urlparse(request.full_url).query)
            self.assertEqual(query["fields"], ["sign,date,transits,aspects,events"])
            self.assertEqual(query["date"], [DAY.isoformat()])
            self.assertEqual(timeout, 30)
            sign = query["sign"][0]
            calls.append(sign)
            return Response(json.dumps(payload(sign)).encode("utf-8"))

        results = fetch_all(DAY, opener=opener, pause=pauses.append)
        self.assertEqual(len(results), 12)
        self.assertEqual(len(calls), 12)
        self.assertEqual(set(calls), set(ENGLISH_SIGNS))

    def test_429_retry_honors_retry_after_and_retries_only_affected_sign(self):
        calls = []
        pauses = []

        class Response:
            status = 200
            headers = {}

            def __init__(self, body):
                self.body = body

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self, _limit):
                return self.body

        def opener(request, timeout):
            query = urllib.parse.parse_qs(urllib.parse.urlparse(request.full_url).query)
            sign = query["sign"][0]
            calls.append(sign)
            if sign == "aries" and calls.count(sign) == 1:
                raise urllib.error.HTTPError(request.full_url, 429, "rate limited", {"Retry-After": "3"}, None)
            return Response(json.dumps(payload(sign)).encode("utf-8"))

        results = fetch_all(DAY, opener=opener, pause=pauses.append)
        self.assertEqual(len(results), 12)
        self.assertEqual(calls.count("aries"), 2)
        self.assertEqual(len(calls), 13)
        self.assertIn(3, pauses)

    def test_503_uses_bounded_exponential_backoff(self):
        calls = []
        pauses = []

        class Response:
            status = 200
            headers = {}

            def __init__(self, body):
                self.body = body

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self, _limit):
                return self.body

        def opener(request, timeout):
            query = urllib.parse.parse_qs(urllib.parse.urlparse(request.full_url).query)
            sign = query["sign"][0]
            calls.append(sign)
            if sign == "aries" and calls.count(sign) == 1:
                raise urllib.error.HTTPError(request.full_url, 503, "temporarily unavailable", {}, None)
            return Response(json.dumps(payload(sign)).encode("utf-8"))

        results = fetch_all(DAY, opener=opener, pause=pauses.append)
        self.assertEqual(len(results), 12)
        self.assertEqual(calls.count("aries"), 2)
        self.assertEqual(len(calls), 13)
        self.assertIn(2, pauses)


class EditorialAndPublishTests(unittest.TestCase):
    def setUp(self):
        self.results = [source_result(sign, idx) for idx, sign in enumerate(ENGLISH_SIGNS, 1)]

    def test_complete_batch_produces_distinct_lithuanian_copy(self):
        validate_batch(self.results, DAY)
        forecasts = []
        for idx, key in enumerate(SIGN_NAMES, 1):
            forecasts.append(render_forecast(key, idx, idx, {"aspect": "Trine", "planet1": "Sun", "planet2": "Jupiter", "orb": 0.1}, DAY))
        validate_original_copy(forecasts)
        self.assertEqual(len({row["editorial_heading"] for row in forecasts}), 12)
        self.assertIn("Svarstyklių", forecasts[6]["lead"])
        self.assertIn("Žuvų", forecasts[-1]["lead"])

    def test_build_data_passes_publication_validator(self):
        now = datetime(2026, 10, 16, 16, 30, tzinfo=ZoneInfo("Europe/Vilnius"))
        data = build_data(self.results, DAY, now)
        signs_path = HERE.parents[1] / "site/_data/horoscope_signs.json"
        signs = json.loads(signs_path.read_text(encoding="utf-8"))
        validate_release_data(data, signs, expected_current_date=DAY)
        self.assertEqual(data["automation"]["provider_text_used"], False)
        self.assertIsNone(data["automation"]["translation_model"])
        self.assertEqual(data["automation"]["provider_footer_preserved"], FOOTER)
        self.assertEqual(len(data["source_provenance"]), 12)

    def test_all_twelve_are_required(self):
        with self.assertRaisesRegex(ValueError, "12 ženklų"):
            validate_batch(self.results[:-1], DAY)

    def test_lithuanian_planet_genitives_and_decimal_comma(self):
        pairs = [
            ("Sun", "Saulės"), ("Moon", "Mėnulio"),
            ("Mercury", "Merkurijaus"), ("Venus", "Veneros"),
            ("Mars", "Marso"), ("Jupiter", "Jupiterio"),
            ("Saturn", "Saturno"), ("Uranus", "Urano"),
            ("Neptune", "Neptūno"), ("Pluto", "Plutono"),
        ]
        for planet, genitive in pairs:
            forecast = render_forecast("zuvys", 8, 9, {
                "aspect": "Sextile", "planet1": planet,
                "planet2": "Pluto", "orb": 0.6,
            }, DAY)
            self.assertIn(f"{genitive} ir Plutono aspektas", forecast["overview"])
            self.assertIn("0,6°", forecast["overview"])
            self.assertNotIn("akcentas: dėmesį", forecast["overview"])

    def test_every_house_has_complete_moon_sentence_without_repeated_lead_filler(self):
        forecasts = []
        for idx, key in enumerate(SIGN_NAMES, 1):
            forecast = render_forecast(key, idx, idx, {
                "aspect": "Trine", "planet1": "Sun",
                "planet2": "Jupiter", "orb": 0.1,
            }, DAY)
            self.assertIn("Papildoma astrologinė Mėnulio tema – ", forecast["overview"])
            self.assertNotIn("Rinkis tempą pagal savo aplinkybes", forecast["lead"])
            self.assertNotIn("Vieną neaiškų susitarimą paversk", forecast["tip"])
            forecasts.append(forecast)
        validate_original_copy(forecasts)

    def test_corrected_copy_survives_next_day_and_spring_dst_fixture_publications(self):
        signs = json.loads((HERE.parents[1] / "site/_data/horoscope_signs.json").read_text(encoding="utf-8"))
        for target in (date(2026, 10, 18), date(2027, 3, 28)):
            results = [replace(row, local_date=target.isoformat()) for row in self.results]
            now = datetime(target.year, target.month, target.day, 6, 20, tzinfo=ZoneInfo("Europe/Vilnius"))
            data = build_data(results, target, now)
            validate_release_data(data, signs, expected_current_date=target)
            self.assertEqual(data["local_date"], target.isoformat())
            self.assertEqual(len(data["forecasts"]), 12)
            for row in data["forecasts"]:
                self.assertIn("Saulės ir Jupiterio aspektas", row["overview"])
                self.assertNotIn("akcentas: dėmesį", row["overview"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
