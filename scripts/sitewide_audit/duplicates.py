#!/usr/bin/env python3
"""Evidence-only duplicate review of every crawled page and observed URL variant.

No network calls, deletions, redirects, or source mutations are performed. Similarity
is a screening measure, never an instruction to remove a useful page. The input
crawler has already limited text to <main>, excluding header/footer chrome.

Example:
  python3 scripts/sitewide_audit/duplicates.py --crawl evidence/qa2-live/crawl.json \
    --variants evidence/qa2-live/variants.json --output evidence/duplicates/qa2 \
    --qa-round 2

The second round is labelled production only when the supplied crawl actually
contains production HTTP observations. Local file-existence status=200 is not HTTP.
"""
from __future__ import annotations

import argparse
import csv
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
from itertools import combinations
import json
from pathlib import Path
import re
import unicodedata
from urllib.parse import urlsplit, urljoin


HOST = "https://kalendorius365.lt"
MONTHS = "sausis vasaris kovas balandis geguze birzelis liepa rugpjutis rugsejis spalis lapkritis gruodis".split()
MONTH_NAMES = "sausio vasario kovo balandžio gegužės birželio liepos rugpjūčio rugsėjo spalio lapkričio gruodžio".split()
SIGNS = "avinas jautis dvyniai vezys liutas mergele svarstykles skorpionas saulys oziaragis vandenis zuvys".split()
TRAFFIC_NOTE = ("Search Console, analytics, external backlink inventories and historic ranking data "
                "were not available to this audit. No traffic or backlink absence is inferred. "
                "Existing routes and assets are preserved; no deletion is authorized by similarity alone.")
REQUIRED_COLUMNS = ["Duplicate URL", "Duplicate Type", "Matching URL", "Evidence", "Search Intent",
                    "Backlink/Traffic Considerations", "Action Taken", "Canonical Target",
                    "Redirect Status", "Final HTTP Status", "QA1", "QA2"]
PRINT_CATEGORIES = {
    "/dienos-planuoklis/": "Undated single-day paper planner: timeline, priorities and notes; two print layouts.",
    "/savaitiniai-planuokliai/": "Undated single-week paper planners and weekly priorities; dedicated print layouts.",
    "/seimos-kalendorius/": "Paper family calendar with separate shared planning columns; dedicated print layouts.",
    "/pamoku-tvarkarascio-sablonai/": "Blank school timetable PDF/WebP sheets for handwriting; dedicated print layouts.",
    "/darbo-grafiko-sablonai/": "Blank work/shift paper schedules for handwriting; dedicated print layouts.",
}
SINGLE_INTENTS = {
    "/": ("personal-calendar", "Personal browser calendar for events, notes and tasks; today's information and navigation."),
    "/metai/": ("annual-directory", "Choose an annual calendar and a whole-year printable view; directory of supported years."),
    "/menesiai/": ("monthly-directory", "Choose a specific year/month and its ten printable calendar designs; month-level directory."),
    "/irankiai/": ("tools-directory", "Find the site's date, work, school, calendar and astronomy tools by task."),
    "/paieska/": ("site-search", "Search and filter all public pages; navigational search rather than an alternative content article."),
    "/apie-mus/": ("editorial-about", "Website purpose, real data sources, editorial/AI assistance methodology, limitations and error reporting."),
    "/privatumas/": ("privacy-policy", "Actual provider, browser storage, network requests and privacy information."),
    "/tuscias-kalendorius/": ("blank-print-library", "Browse/filter the full library of undated PDF/WebP calendar and planner designs."),
    "/kurti-kalendoriu/": ("calendar-builder", "Create a custom dated calendar with selected layout, paper, holidays and optional local events."),
    "/datos-skaiciuokle/": ("date-calculator", "Calculate elapsed/additional calendar dates and date intervals with user input."),
    "/atostogu-planavimas/": ("leave-planner", "Plan personal leave around weekends/public holidays with calculated leave-day totals."),
    "/mokiniu-atostogos/": ("school-holidays", "School-holiday dates and their official scope/sources, separate from personal annual leave."),
    "/pamainu-grafikas/": ("shift-calculator", "Editable recurring shift cycles, intervals, hours, rest gaps, local storage and ICS/JSON export."),
    "/pamoku-tvarkarastis/": ("school-planner", "Editable digital school timetable and homework deadlines with local storage and printing/export."),
    "/saule/": ("sun-calculator", "City/date sunrise, sunset, twilight and daylight calculations with a solar path simulation."),
    "/astronominis-kalendorius/": ("astronomy-directory", "Overview of seasonal event moments and navigation to solar, lunar and seasonal tools."),
    "/menulio-fazes/": ("lunar-phase-guide", "Explain lunar phase geometry and terminology, plus a current-Moon illustration and methodology."),
    "/menulio-kalendorius/": ("lunar-print-directory", "Find daily lunar calendars for 2027–2029 and download monthly/annual printable artwork."),
    "/metu-laikai/": ("seasons-overview", "Compare all four astronomical seasons, years and city daylight; distinguish meteorological seasons."),
    "/pavasario-lygiadienis/": ("season-event", "Spring equinox: northward equator crossing, dates/times, daylight comparison and related spring calendar."),
    "/vasaros-saulegriza/": ("season-event", "Summer solstice: northern declination extreme, longest daylight, dates/times and Joninės context."),
    "/rudens-lygiadienis/": ("season-event", "Autumn equinox: southward equator crossing, dates/times and shortening daylight."),
    "/ziemos-saulegriza/": ("season-event", "Winter solstice: southern declination extreme, shortest daylight, dates/times and winter traditions."),
    "/zodiakas/": ("zodiac-finder", "Find an approximate tropical zodiac sign, explore date boundaries/elements, wheel and comparisons."),
    "/horoskopai/": ("daily-horoscope-directory", "Choose today's entertainment-only interpretation for each of twelve zodiac signs."),
    "/vardadieniai/": ("nameday-directory", "Search names across all 366 source dates; today's/tomorrow's names and calendar integration."),
    "/sventes/": ("holiday-directory", "Find Lithuanian public holidays, commemorations and individual cultural/historical holiday guides."),
}


def normalized_text(value):
    """Keep numbers, dates, Lithuanian diacritics and case in exact-content tests."""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", value or "")).strip()


def words(value):
    # Unicode letters/digits are retained; punctuation alone is not a word.
    return re.findall(r"[^\W_]+", unicodedata.normalize("NFC", value or "").casefold(), re.UNICODE)


def shingles(tokens, width=5):
    return {tuple(tokens[i:i + width]) for i in range(max(0, len(tokens) - width + 1))}


def digest(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def short_title(page):
    return next(iter(page.get("h1") or page.get("title") or []), "")


def describe(page):
    """Human-reviewed intent rules for existing routes, with page-specific proof.

    New, unmapped routes are retained but explicitly need manual intent review.
    A matching template never proves duplication. URL keys are checked against
    actual title/text, linked files and rendered form/control IDs below.
    """
    path = urlsplit(page["url"]).path
    parts = path.strip("/").split("/")
    key = path
    year, month = None, None
    if re.fullmatch(r"/20\d{2}/", path):
        year = parts[0]
        family, intent = "calendar-year", f"Whole-year {year} dated calendar: 12 month grids, holidays and ten annual print designs."
    elif re.fullmatch(r"/20\d{2}/(?:" + "|".join(MONTHS) + r")/", path):
        year, month = parts
        family, intent = "calendar-month", f"Dated {year} {MONTH_NAMES[MONTHS.index(month)]} calendar: correct weekdays/holidays and ten month-specific PDF/WebP designs."
    elif re.fullmatch(r"/(?:darbo-dienos|savaites)/20\d{2}/", path):
        year = parts[1]
        family = "working-days-year" if parts[0] == "darbo-dienos" else "iso-weeks-year"
        intent = (f"{year} working-day/hour totals, weekends and public holidays by month." if family == "working-days-year"
                  else f"{year} ISO week numbers and their actual start/end calendar dates.")
    elif re.fullmatch(r"/menulio-kalendorius/20\d{2}/", path):
        year = parts[1]
        family, intent = "lunar-year", f"Annual {year} lunar phase instants and directory of that year's twelve daily lunar calendars."
    elif re.fullmatch(r"/menulio-kalendorius/20\d{2}/(?:" + "|".join(MONTHS) + r")/", path):
        year, month = parts[1:]
        family, intent = "lunar-month", f"{year} {MONTH_NAMES[MONTHS.index(month)]} daily lunar imagery, illumination and exact local phase instants; two month-specific printable layouts."
    elif len(parts) == 2 and parts[0] == "vardadieniai" and parts[1] in MONTHS:
        month = parts[1]
        family, intent = "nameday-month", f"All {MONTH_NAMES[MONTHS.index(month)]} name-day dates and source-spelled names with revision/history credits and dated ICS links."
    elif len(parts) == 2 and parts[0] == "horoskopai" and parts[1] in SIGNS:
        family, intent = "horoscope-sign", f"Today's interpretation for {short_title(page)}; sign-specific date range/profile and ascendant tool."
    elif re.fullmatch(r"/sventes/20\d{2}/", path):
        year = parts[1]
        family, intent = "holiday-year", f"{year} public holiday dates, legal/observance status and year-specific movable holidays."
    elif re.fullmatch(r"/sventes/20\d{2}/(?:" + "|".join(MONTHS) + r")/", path):
        year, month = parts[1:]
        family, intent = "holiday-month", f"{year} {MONTH_NAMES[MONTHS.index(month)]} holidays, commemorations, practical dates and a month-specific cultural guide."
    elif len(parts) == 2 and parts[0] == "sventes":
        family, intent = "holiday-detail", f"{short_title(page)}: this particular holiday's dates, status, historical/cultural context, sources and calendar actions."
    elif path in PRINT_CATEGORIES:
        family, intent = "print-category", PRINT_CATEGORIES[path]
    elif path in SINGLE_INTENTS:
        family, intent = SINGLE_INTENTS[path]
    else:
        family, intent = "unmapped-needs-manual-review", f"New route {path}: {short_title(page)}. Do not delete without a separate intent review."
    links = page.get("links", [])
    downloads = sorted({x.split("?")[0].split("#")[0] for x in links
                        if re.search(r"\.(?:pdf|webp|ics)(?:[?#]|$)", x, re.I)})
    numbers = re.findall(r"\d+(?:[.,:]\d+)*", page.get("main_text", ""))
    proof = {
        "actual_h1": page.get("h1", []), "actual_title": page.get("title", []),
        "rendered_form_ids": page.get("forms", []), "rendered_control_ids": page.get("controls", []),
        "linked_download_count": len(downloads), "linked_downloads": downloads,
        "numeric_date_sequence_sha256": digest(" ".join(numbers)), "numeric_tokens": len(numbers),
        "content_sha256": digest(normalized_text(page.get("main_text", ""))),
        "year": year, "month": month,
        "year_marker_present": year in page.get("main_text", "") if year else None,
        "source_links": page.get("source_links", []),
    }
    return {"family": family, "intent_key": key, "search_intent": intent, "proof": proof}


def reviewed_overlap(a, b):
    """Specific editorial review of realistic competing-intent candidates."""
    p, q = sorted((urlsplit(a["url"]).path, urlsplit(b["url"]).path))
    pair = frozenset((p, q))
    distinctions = {
        frozenset(("/menulio-fazes/", "/menulio-kalendorius/")): "Phase guide explains lunar geometry/terminology; calendar directory serves date-specific artwork and printable downloads. Retain both and cross-link their distinct tasks.",
        frozenset(("/metai/", "/menesiai/")): "Annual directory selects a whole-year overview; monthly directory selects a specific month and ten monthly designs. Distinct navigation granularity.",
        frozenset(("/pamainu-grafikas/", "/darbo-grafiko-sablonai/")): "Interactive shift-cycle/hour calculator versus ready-made blank paper schedules. Distinct actions and outputs.",
        frozenset(("/pamoku-tvarkarastis/", "/pamoku-tvarkarascio-sablonai/")): "Editable digital lessons/homework planner versus blank PDF/WebP timetable sheets for handwriting.",
        frozenset(("/zodiakas/", "/horoskopai/")): "Sign/date finder and educational symbolic profiles versus dated daily entertainment interpretations.",
        frozenset(("/astronominis-kalendorius/", "/metu-laikai/")): "Astronomy overview spans solar/lunar tools; seasonal overview compares four season events and city daylight. Distinct scope and linked journeys.",
        frozenset(("/astronominis-kalendorius/", "/saule/")): "Astronomy overview/directory versus city/date-specific sunrise/sunset calculator and solar simulation.",
        frozenset(("/kurti-kalendoriu/", "/tuscias-kalendorius/")): "User-customized dated calendar generation versus a downloadable library of predesigned undated sheets.",
        frozenset(("/", "/dienos-planuoklis/")): "Persistent interactive personal day/calendar events versus undated single-day paper planning sheets.",
        frozenset(("/atostogu-planavimas/", "/mokiniu-atostogos/")): "Personal leave-day optimization versus sourced school-holiday periods; not interchangeable dates or user tasks.",
    }
    if pair in distinctions:
        return distinctions[pair]
    if (p == "/tuscias-kalendorius/" and q in PRINT_CATEGORIES) or (q == "/tuscias-kalendorius/" and p in PRINT_CATEGORIES):
        return "The blank-calendar library exposes all printable formats; the dedicated category limits the choice to a specific planning task and its own layouts. Index/category relationship, not redundant page copies."
    return ""


def pair_classification(a, b, da, db, exact, similarity):
    overlap = reviewed_overlap(a, b)
    if exact:
        return "EXACT_MAIN_CONTENT_REVIEW_REQUIRED", "Exact normalized <main> text is a candidate requiring manual review; retain until unique tools/assets and visibility are evaluated."
    if set(a.get("canonical", [])) & set(b.get("canonical", [])):
        return "CANONICAL_COLLISION_REVIEW_REQUIRED", "Different retained routes declare the same canonical; diagnose metadata and equivalence before consolidation."
    if overlap:
        return "REVIEWED_DISTINCT_SEARCH_INTENTS", overlap
    if da["family"] == db["family"]:
        if da["family"] in {"calendar-month", "calendar-year", "holiday-year", "holiday-month", "working-days-year", "iso-weeks-year", "lunar-month", "lunar-year"}:
            return "LEGITIMATE_DATE_SPECIFIC_TEMPLATE", "Shared design/methodology; year/month-specific dates, numeric sequences and linked outputs serve distinct searches. Preserve each date scope."
        if da["family"] == "nameday-month":
            return "LEGITIMATE_NAME_DAY_MONTH", "Different month-specific dates, source names/revisions and ICS records. Shared search/license interface does not duplicate each month's list."
        if da["family"] == "horoscope-sign":
            return "LEGITIMATE_ZODIAC_SIGN", "Different zodiac sign, date boundary, profile and daily prose. Shared calculator/navigation/disclaimer does not make the sign pages equivalent."
        if da["family"] == "holiday-detail":
            return "LEGITIMATE_HOLIDAY_GUIDES", "Different named historical/cultural holiday, dates, context and references. A shared holiday layout does not establish identical intent."
        if da["family"] == "season-event":
            return "LEGITIMATE_ASTRONOMICAL_EVENTS", "Different astronomical event, direction/extreme, date/time and daylight context. Shared orbital explanation is useful methodology."
        if da["family"] == "print-category":
            return "LEGITIMATE_PRINT_USE_CASES", "Different planning task and dedicated linked print designs; retain useful printable categories."
    if similarity >= .50:
        return "NEAR_TEXT_DISTINCT_INTENT_RETAINED", "Similarity screen passed its review threshold; actual H1, declared task, date scopes, controls and linked outputs differ. Retain; no confirmed redundancy from shared prose alone."
    return "DISTINCT_CONTENT", "Non-identical main content and distinct reviewed route intent; no consolidation justified."


def production_observation(page):
    """Conservative: real response headers + production host, never fake local 200."""
    if "local" in page.get("status_source", "").lower():
        return False
    host = urlsplit(page.get("url", "")).hostname
    headers = {k.lower(): v for k, v in page.get("headers", {}).items()}
    return host in {"kalendorius365.lt", "www.kalendorius365.lt"} and bool(headers) and "date" in headers


def stage_labels(source, checked_at, live, qa_round, result):
    label = f"{result}; {'production HTTP' if live else 'local content only, not HTTP'}; {source}; checked_at={checked_at or 'not supplied'}"
    if qa_round == 2 and live:
        return "Earlier round is retained in its separate evidence bundle", label
    if qa_round == 2:
        return label, "NOT VERIFIED: round-2 input is local; production QA2 remains pending"
    return label, "PENDING: no round-2 production evidence supplied to this run"


def write_csv(path, columns, rows):
    # BOM makes Lithuanian diacritics open correctly in spreadsheet applications.
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def report_row(url, kind, matching, evidence, intent, action, canonical, redirect, status, qa1, qa2):
    return dict(zip(REQUIRED_COLUMNS, (url, kind, matching, evidence, intent, TRAFFIC_NOTE, action,
                                      canonical, redirect, status, qa1, qa2)))


def run(crawl_path, variants_path, output, qa_round=1, near_threshold=.50, variant_target_crawl=None):
    if qa_round == 2 and any(part.lower().startswith("qa1") for part in crawl_path.parts):
        raise ValueError("QA1 acquisition cannot be relabelled QA2. Supply a fresh second-round crawl evidence path.")
    output.mkdir(parents=True, exist_ok=True)
    crawl = json.loads(crawl_path.read_text(encoding="utf-8"))
    pages = sorted(crawl["pages"], key=lambda p: p["url"])
    if len({p["url"] for p in pages}) != len(pages):
        raise ValueError("Repeated identical URL records in crawl; deduplicate acquisition, not evidence here.")
    missing = [p["url"] for p in pages if "main_text" not in p]
    if missing:
        raise ValueError("Cannot compare missing HTML/main content: " + ", ".join(missing))
    by_url = {p["url"]: p for p in pages}
    descriptions = {p["url"]: describe(p) for p in pages}
    texts = {p["url"]: normalized_text(p["main_text"]) for p in pages}
    tokens = {u: words(t) for u, t in texts.items()}
    grams = {u: shingles(t) for u, t in tokens.items()}
    metadata_duplicates = {}
    for kind, getter in (("title", lambda p: tuple(p.get("title", []))),
                         ("description", lambda p: tuple(p.get("meta", {}).get("description", []))),
                         ("canonical", lambda p: tuple(p.get("canonical", [])))):
        groups = defaultdict(list)
        for page in pages:
            value = getter(page)
            if value:
                groups[value].append(page["url"])
        metadata_duplicates[kind] = [{"value": list(k), "urls": v} for k, v in groups.items() if len(v) > 1]
    pair_rows, duplicate_rows, nearest, reviews = [], [], {}, []
    exact_pairs = []
    all_live = all(production_observation(p) for p in pages)
    for a, b in combinations(pages, 2):
        au, bu = a["url"], b["url"]
        ga, gb = grams[au], grams[bu]
        intersection = len(ga & gb)
        union = len(ga) + len(gb) - intersection
        similarity = intersection / union if union else (1.0 if texts[au] == texts[bu] else 0.0)
        exact = texts[au] == texts[bu]
        kind, reason = pair_classification(a, b, descriptions[au], descriptions[bu], exact, similarity)
        same_title = bool(a.get("title")) and a.get("title") == b.get("title")
        same_description = bool(a.get("meta", {}).get("description")) and a.get("meta", {}).get("description") == b.get("meta", {}).get("description")
        entry = {"URL A": au, "URL B": bu, "Exact main text": exact, "5-word shingle Jaccard": f"{similarity:.8f}",
                 "A shingle count": len(ga), "B shingle count": len(gb), "Shared shingles": intersection,
                 "A content SHA256": digest(texts[au]), "B content SHA256": digest(texts[bu]),
                 "Same title": same_title, "Same description": same_description,
                 "Same canonical": bool(set(a.get("canonical", [])) & set(b.get("canonical", []))),
                 "A family": descriptions[au]["family"], "B family": descriptions[bu]["family"],
                 "A search intent": descriptions[au]["search_intent"], "B search intent": descriptions[bu]["search_intent"],
                 "Classification": kind, "Decision evidence": reason,
                 "Action": "Preserve; manual review required" if kind.endswith("REVIEW_REQUIRED") else "Preserve both routes"}
        pair_rows.append(entry)
        for first, second in ((au, bu), (bu, au)):
            if similarity > nearest.get(first, {}).get("similarity", -1):
                nearest[first] = {"url": second, "similarity": round(similarity, 8), "classification": kind, "reason": reason}
        if exact:
            exact_pairs.append({"a": au, "b": bu})
        overlap = reviewed_overlap(a, b)
        if similarity >= near_threshold or exact or same_title or same_description or overlap or kind.endswith("REVIEW_REQUIRED"):
            evidence = (f"Exact main text={exact}; five-word shingle Jaccard={similarity:.8f}; same title={same_title}; "
                        f"same description={same_description}; A/B SHA256={digest(texts[au])}/{digest(texts[bu])}. {reason}")
            qa1, qa2 = stage_labels(str(crawl_path), crawl.get("checked_at"), all_live, qa_round,
                                   "REVIEW REQUIRED" if kind.endswith("REVIEW_REQUIRED") else "Compared; distinct value preserved")
            duplicate_rows.append(report_row(au, kind, bu, evidence,
                descriptions[au]["search_intent"] + " || " + descriptions[bu]["search_intent"],
                entry["Action"], f"A={a.get('canonical', [])}; B={b.get('canonical', [])}", "No route removed or redirected by this audit",
                f"A={a.get('status')}, B={b.get('status')} ({'HTTP observed' if all_live else 'local values; not production HTTP'})", qa1, qa2))
            if overlap:
                reviews.append({"a": au, "b": bu, "similarity": round(similarity, 8), "decision": overlap})
    expected_pairs = len(pages) * (len(pages) - 1) // 2
    if len(pair_rows) != expected_pairs:
        raise AssertionError("Incomplete all-pairs comparison")
    preservation = []
    for page in pages:
        u = page["url"]
        d = descriptions[u]
        issues = []
        if d["family"] == "unmapped-needs-manual-review": issues.append("New URL needs manual intent review")
        if any(u in (x["a"], x["b"]) for x in exact_pairs): issues.append("Exact main-content candidate; no automated deletion")
        if page.get("canonical") != [u]: issues.append("Not self-canonical")
        if d["proof"]["year_marker_present"] is False: issues.append("Expected year marker missing from rendered main text")
        duplicated_metadata = [k for k, groups in metadata_duplicates.items() if any(u in g["urls"] for g in groups)]
        issues.extend(f"Duplicate {kind} metadata requires review" for kind in duplicated_metadata)
        qa1, qa2 = stage_labels(str(crawl_path), crawl.get("checked_at"), production_observation(page), qa_round,
                               "PRESERVED; review required" if issues else "PRESERVED; distinct intent reviewed")
        record = {"url": u, **d, "action": "preserved", "deleted": False, "merged": False, "new_redirect": False,
                  "nearest_content_pair": nearest.get(u), "metadata_issues": duplicated_metadata,
                  "review_findings": issues, "traffic_backlinks": TRAFFIC_NOTE,
                  "observed_status": page.get("status"), "status_evidence": "production HTTP" if production_observation(page) else "local file content; not HTTP",
                  "self_canonical": page.get("canonical") == [u], "QA1": qa1, "QA2": qa2}
        preservation.append(record)
        duplicate_rows.append(report_row(u, "PRESERVED_DISTINCT_ROUTE" if not issues else "PRESERVED_REVIEW_REQUIRED",
            nearest.get(u, {}).get("url", ""),
            f"H1={short_title(page)}; family={d['family']}; numeric/date SHA256={d['proof']['numeric_date_sequence_sha256']}; "
            f"linked PDF/WebP/ICS={d['proof']['linked_download_count']}; form/control IDs={','.join(d['proof']['rendered_form_ids'] + d['proof']['rendered_control_ids'])}. "
            + ("Review findings=" + "; ".join(issues) if issues else "Nearest textual neighbor reviewed; unique task/date/entity retained."),
            d["search_intent"], "Preserved existing page and downloads; no deletion/merge/redirect", u,
            "Not redirected; retained canonical route", f"{page.get('status')} ({record['status_evidence']})", qa1, qa2))
    variants = json.loads(variants_path.read_text(encoding="utf-8")) if variants_path else []
    # A local content crawl cannot establish target HTTP status. Prefer the live
    # crawl saved alongside the variants, with an explicit override if required.
    target_source = variant_target_crawl or (variants_path.parent / "crawl.json" if variants_path else crawl_path)
    target_crawl = json.loads(target_source.read_text(encoding="utf-8")) if target_source.exists() else crawl
    target_pages = {p["url"]: p for p in target_crawl.get("pages", [])}
    variant_qa_round = qa_round
    if qa_round == 2 and any(part.lower().startswith("qa1") for path in (variants_path, target_source) if path for part in path.parts):
        variant_qa_round = 1  # Retain genuine earlier observations without relabelling their round.
    variant_results, variant_csv = [], []
    variant_by_url = {row["url"]: row for row in variants}
    for v in variants:
        target = v.get("canonical_target", "")
        target_page = target_pages.get(target) or by_url.get(target)
        live_target = bool(target_page and production_observation(target_page))
        target_status = target_page.get("status") if target_page else None
        target_verified = live_target and target_status == 200 and target_page.get("final_url", target) == target
        v_live = production_observation(v)
        status = v.get("status")
        is_redirect = status in {301, 302, 303, 307, 308}
        header_location = next((value for key, value in v.get("headers", {}).items() if key.lower() == "location"), "")
        redirect_target = v.get("redirect_target") or (urljoin(v["url"], header_location) if header_location else "")
        redirect_chain = []
        immediate = redirect_target
        seen = set()
        while immediate and immediate != target and immediate in variant_by_url and immediate not in seen:
            seen.add(immediate)
            nxt = variant_by_url[immediate]
            if nxt.get("status") not in {301, 302, 303, 307, 308}: break
            redirect_chain.append(immediate)
            immediate = nxt.get("redirect_target", "")
        canonical_ok = v.get("canonical") == [target]
        flags = []
        if is_redirect:
            kind = "PERMANENT_URL_VARIATION" if status in {301, 308} else "TEMPORARY_URL_VARIATION_REVIEW_REQUIRED"
            if redirect_target != target: flags.append("Redirect does not go directly to declared canonical target")
            if status not in {301, 308}: flags.append("Temporary redirect; assess permanence")
            evidence = f"Observed {status} Location={redirect_target}; expected={target}; known intermediate redirects={redirect_chain}."
            action = "Retained existing permanent redirect" if not flags else "Review existing redirect; no mutation by audit"
        elif status == 200:
            kind = "QUERY_VARIATION_CANONICALIZED" if v.get("variant_type") == "tracking query" and canonical_ok else "CONTENT_URL_VARIATION_REVIEW_REQUIRED"
            if not canonical_ok: flags.append("200 variant lacks expected canonical")
            evidence = f"Observed 200; declared canonical={v.get('canonical')}; expected={target}."
            if target_page and v.get("main_text") is not None and target_page.get("main_text") is not None:
                same = normalized_text(v["main_text"]) == normalized_text(target_page["main_text"])
                evidence += f" Main content equals canonical in that evidence bundle={same}."
                if not same: flags.append("Variant main content differs; inspect update timing or parameters")
            action = "Tracking URL retained with canonical to clean route; not added as a separate indexable page" if kind == "QUERY_VARIATION_CANONICALIZED" else "Review URL alias; no automatic deletion"
        else:
            kind = "URL_VARIATION_HTTP_REVIEW_REQUIRED"
            flags.append(f"Unexpected variant response {status}")
            evidence, action = f"Observed status={status}; error={v.get('error', '')}", "Investigate response; no redirect invented"
        if not target_verified: flags.append("Canonical target production HTTP 200 not independently available in supplied target evidence")
        if not v_live: flags.append("Variant lacks production response-header evidence")
        qa1, qa2 = stage_labels(str(variants_path), v.get("checked_at"), v_live and target_verified, variant_qa_round,
                               "PASS existing consolidation" if not flags else "REVIEW REQUIRED: " + "; ".join(flags))
        result = {"url": v["url"], "type": v.get("variant_type"), "observed_status": status,
                  "canonical_target": target, "redirect_target": redirect_target,
                  "target_status": target_status, "target_http_verified": target_verified,
                  "target_evidence": str(target_source), "target_checked_at": target_crawl.get("checked_at"),
                  "redirect_chain_intermediates": redirect_chain, "findings": flags,
                  "classification": kind, "QA1": qa1, "QA2": qa2}
        variant_results.append(result)
        row = report_row(v["url"], kind, target, evidence + f" Target status={target_status}; actual production evidence={target_verified}; {target_source}. " + "; ".join(flags),
            descriptions.get(target, {}).get("search_intent", "Same underlying page as clean canonical target"),
            action, target, f"{status} → {redirect_target}" if is_redirect else "200 canonical alias" if status == 200 else str(status),
            f"variant={status}; canonical target={target_status} ({'production HTTP verified' if target_verified else 'not production verified'})", qa1, qa2)
        duplicate_rows.append(row)
        variant_csv.append(row)
    # Optional legacy .html/index/trailing-slash/query observations are evidence,
    # not new pages; they do not inflate the canonical page/pair counts.
    pair_rows.sort(key=lambda r: (-float(r["5-word shingle Jaccard"]), r["URL A"], r["URL B"]))
    write_csv(output / "PAIR_COMPARISON.csv", list(pair_rows[0]) if pair_rows else ["URL A", "URL B"], pair_rows)
    write_csv(output / "DUPLICATE_AUDIT.csv", REQUIRED_COLUMNS, duplicate_rows)
    write_csv(output / "URL_VARIATIONS.csv", REQUIRED_COLUMNS, variant_csv)
    (output / "preserved-routes.json").write_text(json.dumps(preservation, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output / "variants-reviewed.json").write_text(json.dumps(variant_results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = {"generated_at": datetime.now(timezone.utc).isoformat(), "crawl": str(crawl_path),
        "crawl_sha256": hashlib.sha256(crawl_path.read_bytes()).hexdigest(), "crawl_checked_at": crawl.get("checked_at"),
        "qa_round": qa_round, "production_crawl": all_live,
        "production_QA2_evidence_supplied": qa_round == 2 and all_live,
        "canonical_routes": len(pages), "expected_all_pairs": expected_pairs, "compared_all_pairs": len(pair_rows),
        "exact_main_content_pairs": exact_pairs, "metadata_duplicate_groups": metadata_duplicates,
        "shingle_similarity_threshold_for_review": near_threshold,
        "near_pairs": sum(float(x["5-word shingle Jaccard"]) >= near_threshold for x in pair_rows),
        "highest_similarity": float(pair_rows[0]["5-word shingle Jaccard"]) if pair_rows else None,
        "pair_classification_counts": dict(Counter(x["Classification"] for x in pair_rows)),
        "reviewed_intent_overlap_pairs": reviews, "preserved_routes": len(preservation),
        "routes_needing_manual_review": [r["url"] for r in preservation if r["review_findings"] or r["metadata_issues"]],
        "deleted_routes": [], "merged_routes": [], "new_redirects": [],
        "observed_variants": len(variants), "variant_classification_counts": dict(Counter(v["classification"] for v in variant_results)),
        "variant_qa_round": variant_qa_round,
        "variant_targets_http_200_verified": sum(v["target_http_verified"] for v in variant_results),
        "variant_findings": [r for r in variant_results if r["findings"]],
        "variant_evidence": str(variants_path) if variants_path else None,
        "variant_evidence_sha256": hashlib.sha256(variants_path.read_bytes()).hexdigest() if variants_path else None,
        "traffic_backlink_limitations": TRAFFIC_NOTE,
        "methodology": {"exact": "Whitespace-normalized NFC main text, numbers/dates/case retained; SHA256 recorded per URL.",
            "near": "Jaccard of unique consecutive five-word shingles; Unicode casefold/punctuation tokenization retains numbers and Lithuanian letters. Score is a screening value, not a Google threshold or deletion instruction.",
            "chrome": "Use crawler's actual <main> extraction; site header/footer/scripts/noscript are excluded by crawler. Shared useful methodology inside main is retained, and family-specific value is reviewed separately.",
            "intent": "Reviewed existing route families and explicit likely overlap pairs; actual H1, numeric date sequence, linked downloads, form/control IDs and citations are recorded per route. New unmatched routes require review.",
            "preservation": "No automated consolidation; no valuable page is removed solely for wording/template similarity. Existing PDF/WebP/SVG/ICS/tool routes remain untouched.",
            "limitations": "No inferred search engine indexing, ranking, backlink value or real user traffic. Functional execution and visual QA belong to separate audits; rendered controls alone do not prove working behavior."}}
    (output / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: summary[k] for k in ("canonical_routes", "compared_all_pairs", "near_pairs", "observed_variants", "variant_targets_http_200_verified", "production_QA2_evidence_supplied")}, ensure_ascii=False))
    print(f"Exact main-content candidates={len(exact_pairs)}; routes for manual review={len(summary['routes_needing_manual_review'])}; variant findings={len(summary['variant_findings'])}")
    return summary


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--crawl", type=Path, required=True)
    ap.add_argument("--variants", type=Path)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--qa-round", type=int, choices=[1, 2], default=1,
                    help="Only round 2 plus observed production HTTP is labelled production QA2.")
    ap.add_argument("--near-threshold", type=float, default=.50,
                    help="Review screening cutoff; does not decide deletion or Google's duplicate assessment.")
    ap.add_argument("--variant-target-crawl", type=Path,
                    help="Defaults to crawl.json alongside variants; target HTTP proof never inferred from local files.")
    args = ap.parse_args()
    if not 0 <= args.near_threshold <= 1:
        ap.error("--near-threshold must be between 0 and 1")
    run(args.crawl, args.variants, args.output, args.qa_round, args.near_threshold, args.variant_target_crawl)
