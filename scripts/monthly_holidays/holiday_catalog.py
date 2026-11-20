"""Shared date and guide resolution for the published Lithuanian holiday calendar."""
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
import calendar
import csv
import json
import subprocess
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
YEARS = tuple(json.loads((ROOT / 'data/holiday-years.json').read_text()))
MONTHS = json.loads((ROOT / 'data/calendar.json').read_text())['months']
PHASE2 = json.loads((ROOT / 'data/holiday-phase2.json').read_text())
TRADITIONS = json.loads((ROOT / 'data/traditional-holiday-guides.json').read_text())
WD = ('pirmadienis', 'antradienis', 'trečiadienis', 'ketvirtadienis', 'penktadienis', 'šeštadienis', 'sekmadienis')


def enacted_registry():
    registry = json.loads((ROOT / 'data/monthly-holidays-2027.json').read_text())
    amendment = json.loads((ROOT / 'data/holiday-law-xv-1223.json').read_text())
    changes = sorted(amendment['additions'], key=lambda row: row['point'])
    edition = amendment['effective']
    registry['reviewed'] = amendment['reviewed']
    registry['sources']['law'] = {
        'title': f'Atmintinų dienų įstatymas: redakcija nuo {edition}',
        'url': amendment['source'], 'publisher': 'Teisės aktų registras',
    }
    registry['sources']['law-xv-1223'] = {
        'title': 'Atmintinų dienų įstatymo pakeitimas Nr. XV-1223',
        'url': amendment['amendment'], 'publisher': 'Teisės aktų registras',
    }
    for event in registry['events']:
        if 'law_point' not in event:
            continue
        point = event['law_point']
        for change in changes:
            if point >= change['point']:
                point += 1
        event.update(law_point=point, law_version=edition)
    for change in changes:
        month, day = change['month'], change['day']
        occurrence_2027 = date(2027, month, day)
        registry['events'].append({
            'id': change['id'], 'date': occurrence_2027.isoformat(), 'weekday': occurrence_2027.isoweekday(),
            'category': 'legally_commemorative', 'statutory_nonworking': False,
            'title': change['title'], 'summary': change['summary'], 'sources': ['law', 'law-xv-1223'],
            'law_point': change['point'], 'law_version': edition, 'first_year': int(edition[:4]),
            'recurrence': {'type':'fixed', 'month': month, 'day': day},
        })
    for key, source in TRADITIONS['sources'].items():
        url = urlsplit(source['url'])
        if url.scheme != 'https' or not url.hostname or not url.hostname.endswith('.lt'):
            raise ValueError(f"Expected a Lithuanian source: {source['url']}")
        registry['sources']['folk-' + key] = source

    for guide in TRADITIONS['guides']:
        registry['events'].append({
            'id': 'folk-' + guide['slug'], 'title': guide['title'], 'summary': guide['summary'],
            'category': 'traditional_cultural', 'statutory_nonworking': False,
            'sources': ['folk-' + key for key in guide['sources']],
            'recurrence': guide['recurrence'], 'verified_at': '2026-11-20', 'tags': ['tradition'],
        })
    return registry


REGISTRY = enacted_registry()
EVENTS = {event['id']: event for event in REGISTRY['events']}


def path(month, year):
    return f'/sventes/{year}/{MONTHS[month - 1][0]}/'


def calendar_years(years=YEARS):
    data = json.loads((ROOT / 'site/assets/data/years.json').read_text())
    engines = {row['year']: row for row in data}
    missing = [year for year in years if year not in engines]
    if missing:
        extra = subprocess.check_output([
            'ruby', '-r', str(ROOT / 'lib/calendar'),
            '-e', 'puts JSON.generate(ARGV.map { |year| Kalendorius.year(Integer(year)) })',
            *map(str, missing),
        ], text=True)
        engines.update((row['year'], row) for row in json.loads(extra))
    return engines


def occurrence(event, year, engine):
    holidays = {item['id']: item['date'] for item in engine['holidays']}
    if 'engine_holiday_id' in event:
        return date.fromisoformat(holidays[event['engine_holiday_id']])
    rule = event['recurrence']
    if rule['type'] == 'fixed':
        return date(year, rule['month'], rule['day'])
    if rule['type'] == 'easter-offset':
        return date.fromisoformat(holidays['easter']) + timedelta(days=rule['offset'])
    if rule['type'] == 'advent':
        first = date(year, 11, 27)
        return first + timedelta(days=(6 - first.weekday()) % 7)
    if rule['type'] == 'nth-weekday':
        month = rule['month']
        days = [day for day in calendar.Calendar().itermonthdates(year, month)
                if day.month == month and day.isoweekday() == rule['weekday']]
        ordinal = rule['ordinal']
        return days[ordinal - 1 if ordinal > 0 else ordinal]
    raise ValueError(f"Unsupported recurrence for {event['id']}")


def date_text(day, *, year=True):
    prefix = f'{day.year} m. ' if year else ''
    return f'{prefix}{MONTHS[day.month - 1][2]} {day.day} d.'


def rule_text(event):
    rule = event['recurrence']
    if rule['type'] == 'fixed':
        return f"Kasmet {MONTHS[rule['month'] - 1][2]} {rule['day']} d."
    if rule['type'] == 'advent':
        return 'Pirmasis sekmadienis tarp lapkričio 27 ir gruodžio 3 d.'
    if rule['type'] == 'easter-offset':
        return {
            -47: 'Antradienis likus 47 dienoms iki vakarietiškųjų Velykų.',
            -46: 'Trečiadienis po Užgavėnių.',
            -3: 'Ketvirtadienis prieš Velykas.',
            -2: 'Penktadienis prieš Velykas.',
            -1: 'Šeštadienis prieš Velykas.',
            -7: 'Sekmadienis likus savaitei iki vakarietiškųjų Velykų.',
            0: 'Vakarietiškųjų Velykų sekmadienis.',
            1: 'Pirmadienis po Velykų sekmadienio.',
            7: 'Pirmasis sekmadienis po vakarietiškųjų Velykų.',
            42: 'Lietuvoje švenčiama šeštą sekmadienį po Velykų.',
            49: 'Septintasis sekmadienis po Velykų.',
            63: 'Lietuvoje švenčiama antrą sekmadienį po Sekminių.',
        }[rule['offset']]
    ordinal = {1: 'pirmasis', 2: 'antrasis', 3: 'trečiasis', -1: 'paskutinis'}[rule['ordinal']]
    return f"{MONTHS[rule['month'] - 1][2].capitalize()} {ordinal} {WD[rule['weekday'] - 1]}."


def guides():
    columns = ('event', 'slug', 'title', 'summary', 'meaning', 'visit', 'source', 'source_label')
    with (ROOT / 'data/holiday-guide-research.tsv').open() as file:
        reader = csv.DictReader(file, delimiter='\t', fieldnames=columns)
        records = list(reader)
    seen = set()
    for record in records:
        if record['event'] not in EVENTS or record['slug'] in seen or any(not record.get(key) for key in columns):
            raise ValueError(f'Incomplete or duplicate holiday guide: {record}')
        if not record['source'].startswith('https://'):
            raise ValueError(f"Invalid reference for {record['slug']}")
        seen.add(record['slug'])
        yield record

    for guide in TRADITIONS['guides']:
        slug = guide['slug']
        if slug in seen:
            raise ValueError(f'Duplicate holiday guide: {slug}')
        seen.add(slug)
        reference = TRADITIONS['sources'][guide['sources'][0]]
        yield dict(guide, event='folk-' + slug, source=reference['url'], source_label=reference['title'])


def guide_links(records):
    links = defaultdict(list)
    articles = {event['id']: event for event in PHASE2['articles']}
    matched = {f"comm-{article['law_point']:03d}": article for article in articles.values() if article.get('law_point')}
    matched.update({f'comm-012': articles['sv-kazimiero-diena'], 'uzgavenes': articles['uzgavenes'], 'book-carriers': articles['knygnesio-diena']})
    for event in EVENTS.values():
        key = event['id']
        if 'detail_url' in event:
            links[key].append((event['title'], event['detail_url']))
        elif key in matched:
            article = matched[key]
            links[key].append((article['title'], f"/sventes/{article['slug']}/"))
        elif key == 'comm-074':
            links[key].append(('Lietuvos žydų genocido atminimo diena', '/sventes/lietuvos-zydu-genocido-atminimo-diena/'))
    for record in records:
        links[record['event']].append((record['title'], f"/sventes/{record['slug']}/"))
    missing = set(EVENTS) - links.keys()
    if missing:
        raise ValueError(f'Calendar events missing guide routes: {sorted(missing)}')
    return links


def events_in_year(year, engine, links):
    for item in EVENTS.values():
        if year < item.get('first_year', year):
            continue
        day = occurrence(item, year, engine)
        yield dict(item, date=day.isoformat(), weekday=day.isoweekday(), links=links[item['id']])
