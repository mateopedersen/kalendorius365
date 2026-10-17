#!/usr/bin/env python3
"""Explicit, serial Wikimedia acquisition. Normal builds never use the network.

Raw API responses stay in the operator's cache; only the relevant section is
released, with its permanent revision, original article and history attribution.
"""
import argparse
import calendar
import csv
import datetime as dt
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
UA = 'Kalendorius365-NameDayImporter/1.0 (+https://kalendorius365.lt/privatumas/)'
VERSION = 'lt-vardadieniai-section-1'
LICENSE = 'https://creativecommons.org/licenses/by-sa/4.0/'


class SectionText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.items = []
        self.current = None
        self.item_tag = None

    def handle_starttag(self, tag, attrs):
        if tag in ('sup', 'style', 'script'):
            self.skip += 1
        if tag in ('li', 'p') and not self.skip:
            if self.current is not None:
                raise ValueError('Nested name-day list requires review')
            self.current = ''
            self.item_tag = tag

    def handle_endtag(self, tag):
        if tag in ('sup', 'style', 'script') and self.skip:
            self.skip -= 1
        if tag == self.item_tag and self.current is not None:
            self.items.append(self.current)
            self.current = None
            self.item_tag = None

    def handle_data(self, data):
        if self.current is not None and not self.skip:
            self.current += data


def extract(markup):
    headings = list(re.finditer(r'<h([1-6])\b[^>]*\bid="([^"]+)"[^>]*>.*?</h\1>', markup, re.S))
    matches = [(i, m) for i, m in enumerate(headings) if html.unescape(m[2]) == 'Vardadieniai']
    if len(matches) != 1:
        raise ValueError('Expected exactly one Vardadieniai section')
    index, heading = matches[0]
    end = len(markup)
    for following in headings[index + 1:]:
        if int(following[1]) <= int(heading[1]):
            end = following.start()
            # Exclude modern MediaWiki heading wrapper before the next heading.
            wrapper = markup.rfind('<div class="mw-heading', heading.end(), end)
            if wrapper > heading.end():
                end = wrapper
            break
    # The trailing heading's editing controls precede the first name list.
    content = markup[heading.end():end]
    block = re.search(r'<(?:ul|p)\b', content)
    if not block:
        raise ValueError('No name-day list or paragraph')
    content = content[block.start():]
    parser = SectionText()
    parser.feed(content)
    names = []
    for line in parser.items:
        line = unicodedata.normalize('NFC', re.sub(r'\s+', ' ', line)).strip()
        tokens = []
        for token in re.split(r'\s+[–—−]\s+|[,;]', line):
            # Source explicitly gives these alternatives, e.g. Jaugeda (Jaugedas).
            # Preserve both actual spellings; never infer a feminine/male variant.
            pair = re.fullmatch(r'\s*([^()]+?)\s*\(([^()]+)\)\s*', token)
            tokens.extend(pair.groups() if pair else [token])
        for name in tokens:
            name = name.strip().rstrip('.').strip()
            if not name:
                continue
            if (len(name) > 70 or not name[0].isupper() or
                any(not (c.isalpha() or c in " -’'") for c in name)):
                raise ValueError(f'Ambiguous name token: {name!r}')
            if name not in names:
                names.append(name)
    if not names or len(names) > 40:
        raise ValueError('Implausible name count')
    return content, names


def fetch(url):
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'}), timeout=60) as response:
                raw = response.read()
            value = json.loads(raw)
            if 'error' in value:
                if value['error'].get('code') in ('maxlag', 'ratelimited'):
                    time.sleep(min(120, 5 * 2 ** attempt))
                    continue
                raise ValueError(value['error'])
            return raw, value
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 5:
                raise
            retry = error.headers.get('Retry-After', '')
            time.sleep(max(int(retry) if retry.isdigit() else 0, min(120, 5 * 2 ** attempt)))
        except (TimeoutError, urllib.error.URLError):
            if attempt == 5:
                raise
            time.sleep(min(120, 5 * 2 ** attempt))
    raise RuntimeError('Wikimedia retry budget exhausted')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--manifest', type=Path, default=ROOT / 'data/namedays/source-manifest.csv')
    ap.add_argument('--cache', type=Path, required=True)
    ap.add_argument('--output', type=Path, default=ROOT / 'data/namedays/cc-by-sa-4.0')
    ap.add_argument('--refresh', action='store_true', help='Explicitly acquire a new reviewed candidate snapshot')
    ap.add_argument('--delay', type=float, default=0.6)
    args = ap.parse_args()
    if args.delay < 0.5:
        ap.error('Use at least 0.5 seconds between serial requests')
    rows = list(csv.DictReader(args.manifest.open(encoding='utf-8-sig')))
    expected = {f'{m:02}-{d:02}' for m in range(1, 13) for d in range(1, calendar.monthrange(2028, m)[1] + 1)}
    if len(rows) != 366 or {r['date_mm_dd'] for r in rows} != expected:
        raise ValueError('Source manifest must have all 366 unique dates')
    genitives = 'Sausio Vasario Kovo Balandžio Gegužės Birželio Liepos Rugpjūčio Rugsėjo Spalio Lapkričio Gruodžio'.split()
    for row in rows:
        month, day = map(int, row['date_mm_dd'].split('-'))
        title = f'{genitives[month-1]} {day}'
        url = urllib.parse.urlsplit(row['wikipedia_source_url'])
        if (int(row['month']) != month or int(row['day']) != day or row['wikipedia_page_title'] != title
            or url.scheme != 'https' or url.netloc != 'lt.wikipedia.org' or url.query or url.fragment
            or urllib.parse.unquote(url.path) != '/wiki/' + title.replace(' ', '_')):
            raise ValueError(f'Invalid source mapping for {row["date_mm_dd"]}')
    args.cache.mkdir(parents=True, exist_ok=True)
    args.output.mkdir(parents=True, exist_ok=True)
    records, failures = [], []
    downloaded = 0
    for i, row in enumerate(rows):
        key = row['date_mm_dd']
        path = args.cache / f'{key}.json'
        stamp = args.cache / f'{key}.fetched-at.txt'
        try:
            if not path.exists() or args.refresh:
                query = urllib.parse.urlencode({'action': 'parse', 'page': row['wikipedia_page_title'], 'prop': 'text|revid', 'format': 'json', 'maxlag': 5})
                raw, value = fetch('https://lt.wikipedia.org/w/api.php?' + query)
                path.write_bytes(raw)
                stamp.write_text(dt.datetime.now(dt.timezone.utc).isoformat())
                downloaded += 1
                time.sleep(args.delay)
            raw = path.read_bytes()
            parsed = json.loads(raw)['parse']
            if parsed['title'] != row['wikipedia_page_title'] or not isinstance(parsed['revid'], int):
                raise ValueError('Article title/revision mismatch')
            section, names = extract(parsed['text']['*'])
            records.append({'date': key, 'names': names,
                'source_project': 'lt.wikipedia.org', 'source_title': parsed['title'],
                'source_page': row['wikipedia_source_url'],
                'source_revision_id': parsed['revid'],
                'source_revision': f'https://lt.wikipedia.org/w/index.php?oldid={parsed["revid"]}#Vardadieniai',
                'source_history': 'https://lt.wikipedia.org/w/index.php?' + urllib.parse.urlencode({'title': parsed['title'], 'action': 'history'}),
                'fetched_at': stamp.read_text().strip(), 'extraction_version': VERSION,
                'api_sha256': hashlib.sha256(raw).hexdigest(),
                'section_sha256': hashlib.sha256(section.encode()).hexdigest(),
                'source_section_html': section, 'license': 'CC-BY-SA-4.0',
                'license_url': LICENSE, 'attribution': 'Lietuviškos Vikipedijos bendraautoriai',
                'transforms': ['Išskirtas tik skyrelis „Vardadieniai“', 'Pašalintas HTML formatavimas ir išnašų numeriai', 'Šaltinyje skliaustais pateikti vardų variantai išskirti kaip atskiri vardai', 'Unicode NFC; suvienodinti tarpai; pašalinti tik tikslūs pasikartojimai vienos dienos sąraše'],
                'quality_status': 'section-extracted'})
        except Exception as error:
            failures.append({'date': key, 'error': str(error), 'source': row['wikipedia_source_url']})
            print(f'REVIEW {key}: {error}', flush=True)
        if (i + 1) % 25 == 0:
            print(f'{i + 1}/366; extracted={len(records)}; issues={len(failures)}', flush=True)
    payload = {'schema': 1, 'license': 'CC-BY-SA-4.0', 'license_url': LICENSE,
        'attribution': 'Lietuviškos Vikipedijos bendraautoriai; duomenis išskyrė ir susistemino Kalendorius365.',
        'scope': 'Vardadieniai pagal nurodytą kalendorių; bendruomenės redaguojamas šaltinis, ne valstybės registras.',
        'extraction_version': VERSION, 'records': records}
    stats = {'manifest_pages': len(rows), 'downloaded_this_run': downloaded,
        'cached_api_pages': len(list(args.cache.glob('??-??.json'))),
        'parsed_records': len(records), 'failures': failures}
    (args.output / 'acquisition.json').write_text(json.dumps(stats, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(stats, ensure_ascii=False), flush=True)
    if failures:
        raise SystemExit(1)
    target = args.output / 'snapshot.json'
    serialized = json.dumps(payload, ensure_ascii=False, indent=2) + '\n'
    accepted = ROOT / 'data/namedays/cc-by-sa-4.0'
    if target.exists() and args.output.resolve() == accepted.resolve() and target.read_text(encoding='utf-8') != serialized:
        raise SystemExit('Accepted snapshot left unchanged. Use --output <new-candidate-folder>, review the diff and open a pull request.')
    if not target.exists() or target.read_text(encoding='utf-8') != serialized:
        temp = target.with_suffix('.json.tmp')
        temp.write_text(serialized, encoding='utf-8')
        temp.replace(target)


if __name__ == '__main__':
    main()
