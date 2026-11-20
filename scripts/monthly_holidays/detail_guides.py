"""Render recurring days as canonical, source-linked guides reusable in every year."""
from datetime import timedelta
from html import escape as esc
import hashlib
import json

from holiday_catalog import EVENTS, MONTHS, REGISTRY, ROOT, WD, YEARS, date_text, occurrence, path, rule_text

ORIGIN = 'https://kalendorius365.lt'
CATEGORIES = {
    'legally_commemorative': 'Atmintina diena',
    'traditional_cultural': 'Tradicija',
    'international_observance': 'Tarptautinė diena',
}


def escape(text):
    return esc(str(text), quote=True)


def route(slug):
    return f'/sventes/{slug}/'


def anchor(href, label, css=''):
    return f'<a class="{css}" href="{escape(href)}">{escape(label)}</a>'


def year_window(dates, record, event, fold_ics, ics_escape):
    rows, calendar_occurrences = [], []
    for day in dates:
        year = day.year
        following = day + timedelta(days=1)
        calendar_href = path(day.month, year) + '#ivykis-' + event['id'] if year in YEARS else f'/?data={day}'
        calendar_label = f'{year} m. {MONTHS[day.month - 1][2]} šventės' if year in YEARS else 'Rodyti kalendoriuje'
        ics = f'/assets/holiday-guides-ics/{record["slug"]}-{year}.ics'
        values = [
            'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kalendorius365//Lietuvos datos//LT', 'CALSCALE:GREGORIAN',
            'BEGIN:VEVENT', f'UID:{record["slug"]}-{year}@kalendorius365.lt', 'DTSTAMP:20261120T090000Z',
            f'DTSTART;VALUE=DATE:{day:%Y%m%d}', f'DTEND;VALUE=DATE:{following:%Y%m%d}',
            'SUMMARY:' + ics_escape(record['title']), 'DESCRIPTION:' + ics_escape(record['summary']),
            'URL:' + ORIGIN + route(record['slug']), 'TRANSP:TRANSPARENT', 'END:VEVENT', 'END:VCALENDAR',
        ]
        target = ROOT / 'site' / ics[1:]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(('\r\n'.join(fold_ics(value) for value in values) + '\r\n').encode())
        calendar_occurrences.append({'start': str(day), 'end_exclusive': str(following), 'ics': ics})
        rows.append(f'''<section class="hg-date-panel" id="metai-{year}" data-hg-year="{year}" data-hg-label="{escape(date_text(day))}">
<div class="hg-date-panel__top">
  <div class="hg-date-tile" aria-hidden="true"><span>{MONTHS[day.month - 1][2]}</span><b>{day.day:02d}</b></div>
  <div><h3><time datetime="{day}">{escape(date_text(day))}</time></h3><p>{WD[day.weekday()].capitalize()}</p></div>
  {anchor(calendar_href, calendar_label, 'hg-btn hg-btn--outline')}
</div>
{anchor('#prideti-i-kalendoriu', 'Pridėti į kalendorių', 'hg-btn hg-btn--outline')}
</section>''')
    return ''.join(rows), calendar_occurrences


def image_markup(photo, slug):
    if photo is None:
        return ''
    return f'''<figure class="hg-photo">
  <img src="{escape(photo['src'])}" srcset="{escape(photo['small'])} {photo['small_width']}w, {escape(photo['src'])} {photo['width']}w" sizes="(max-width: 670px) 90vw, 46vw" width="{photo['width']}" height="{photo['height']}" alt="{escape(photo['caption'])}" decoding="async" fetchpriority="high">
  <figcaption><p>{escape(photo['caption'])}</p><p>{anchor(photo['commons_url'], photo['author'])} · {anchor(photo['license_url'], photo['license'])} · {anchor('/nuotrauku-licencijos/#' + slug, 'Nuotraukos duomenys')}</p></figcaption>
</figure>'''


def render_details(records, engines, links, fold_ics, ics_escape):
    photo_path = ROOT / 'data/holiday-guide-photos.json'
    photos = json.loads(photo_path.read_text())
    if photos.keys() != {record['slug'] for record in records if not record['event'].startswith('folk-')}:
        raise ValueError('Each new holiday guide requires an approved photo')
    for slug, photo in photos.items():
        for field, checksum in (('src', 'sha256'), ('small', 'small_sha256')):
            src = ROOT / 'site' / photo[field].lstrip('/')
            if hashlib.sha256(src.read_bytes()).hexdigest() != photo[checksum]:
                raise ValueError(f'Photo no longer matches reviewed bytes: {slug}')
    credits = []
    for record in records:
        slug = record['slug']
        event = EVENTS[record['event']]
        title = record['title']
        destinations = [item for item in links[event['id']] if item[1] != route(slug)]
        first = occurrence(event, YEARS[0], engines[YEARS[0]])
        guide_years = tuple(year for year in (2026, *YEARS) if year >= event.get('first_year', year))
        dates = [occurrence(event, year, engines[year]) for year in guide_years]
        photo = photos.get(slug)
        year_navigation = ''.join(anchor(f'#metai-{day.year}', str(day.year), 'hg-year') for day in dates)
        shared_dates = ''
        if destinations:
            related = ''.join(f'<li>{anchor(href, label)}</li>' for label, href in destinations)
            shared_dates = f'<section class="hg-text"><h2>Tą pačią dieną minima</h2><ul>{related}</ul></section>'
        bases = []
        for key in event['sources']:
            source = REGISTRY['sources'][key]
            if source['url'] != record['source']:
                bases.append(f'<li>{anchor(source["url"], source["title"])}</li>')
        source_list = f'<li>{anchor(record["source"], record["source_label"])}</li>' + ''.join(bases)
        status = ('Atmintina diena savaime nesuteikia papildomos nedarbo dienos.' if event.get('law_point')
                  else 'Ši data nėra atskira šventinė nedarbo diena pagal Darbo kodeksą.')
        category = CATEGORIES[event['category']]
        year_panels, calendar_occurrences = year_window(dates, record, event, fold_ics, ics_escape)
        html = f'''<article class="hg" data-holiday-research data-default-year="{first.year}">
<header class="hg-hero{' hg-hero--photo' if photo else ''}">
  <div class="hg-intro"><span class="hg-category">{category}</span>
    <h1>{escape(title)}</h1><p>{escape(record['summary'])}</p>
    <div class="hg-quick-date"><span>Kada minima?</span><strong data-hg-selected>{escape(date_text(first))}</strong></div>
    <div class="hg-actions">{anchor('#datos', 'Visų metų datos', 'hg-btn')}{anchor('#kur', 'Kur ir kaip minima', 'hg-btn hg-btn--outline')}</div>
  </div>
  {image_markup(photo, slug)}
</header>
<section class="hg-schedule" id="datos" aria-labelledby="hg-date-title">
  <div class="hg-schedule__head"><div><h2 id="hg-date-title">Datos {guide_years[0]}–{guide_years[-1]} metais</h2><p>{escape(rule_text(event))}</p></div>
  <nav class="hg-years" aria-label="Pasirinkite metus">{year_navigation}</nav></div>
  {year_panels}
</section>
{{% include event-calendar-links.html occurrences=page.event_calendar_occurrences event_title=page.breadcrumb_label default_year=page.event_calendar_default_year %}}
<div class="hg-reading">
  <section class="hg-text"><h2>Kilmė ir istorija</h2><p>{escape(record['meaning'])}</p></section>
  <section class="hg-text" id="kur"><h2>Kur ir kaip minima?</h2><p>{escape(record['visit'])}</p>{anchor(record['source'], record['source_label'], 'hg-btn hg-btn--outline')}</section>
</div>
{shared_dates}
<section class="hg-info" aria-label="Dienos statusas ir naudoti šaltiniai">
  <div><h2>Ar tai nedarbo diena?</h2><p>{status} Jei tą pačią dieną minimos kelios progos, skaičiuodami darbo laiką datą įtraukite vieną kartą. Darbo ir švenčių dienas palyginkite {anchor(f"/darbo-dienos/{first.year}/", f"{first.year} m. darbo dienų kalendoriuje")}.</p></div>
  <div><h2>Šaltiniai</h2><ul>{source_list}</ul></div>
</section>
<nav class="hg-related" aria-label="Susiję kalendoriai">{anchor(path(first.month, first.year), f"{MONTHS[first.month - 1][2].capitalize()} datos")}{anchor('/sventes/', 'Lietuvos švenčių kalendorius')}{anchor('/renginiai/', 'Lietuvos renginiai ir festivaliai')}</nav>
</article>'''
        schema = {
            '@context': 'https://schema.org', '@type': 'Article', 'headline': title, 'url': ORIGIN + route(slug),
            'description': record['summary'], 'inLanguage': 'lt-LT', 'mainEntityOfPage': ORIGIN + route(slug),
            'publisher': {'@type': 'Organization', 'name': 'Kalendorius365', 'url': ORIGIN},
            'citation': [record['source'], *[REGISTRY['sources'][key]['url'] for key in event['sources']]],
        }
        data = {'title': f'{title} {guide_years[0]}–{guide_years[-1]}', 'breadcrumb_label': title,
                'description': record['summary'], 'holiday_research': True,
                'event_calendar_occurrences': calendar_occurrences, 'event_calendar_default_year': first.year}
        if photo:
            src = ORIGIN + photo['src']
            schema['image'] = {
                '@type': 'ImageObject', 'url': src, 'contentUrl': src, 'caption': photo['caption'],
                'width': photo['width'], 'height': photo['height'],
                'creditText': photo['author'], 'license': photo['license_url'],
                'copyrightNotice': f"{photo['license']} · {photo['author']}",
                'acquireLicensePage': photo['commons_url'], 'isBasedOn': photo['commons_url'],
            }
            data.update(og_image=photo['src'], og_image_type='image/webp', og_image_width=photo['width'],
                        og_image_height=photo['height'], og_image_alt=photo['caption'])
            credits.append(dict(photo, id=slug, page=route(slug), credit=f"{photo['author']} · {photo['license']}",
                                source=photo['commons_url'], license=photo['license_url']))
        encoded = json.dumps(schema, ensure_ascii=False).replace('</', '<\\/')
        html += f'\n<script type="application/ld+json">{encoded}</script>\n'
        target = ROOT / 'site' / route(slug).strip('/') / 'index.html'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text('---\n' + ''.join(f'{k}: {json.dumps(v, ensure_ascii=False)}\n' for k, v in data.items()) + '---\n' + html)
    (ROOT / 'site/_data/holiday_research_credits.json').write_text(json.dumps(credits, ensure_ascii=False, indent=2) + '\n')
