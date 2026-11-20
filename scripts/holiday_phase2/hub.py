"""Render the holiday directory from the same records as the individual guides."""

from html import escape
import json

ART = '/assets/visuals/holiday-hub/'
CATEGORIES = {
    'statutory': 'Šventinė diena',
    'memorial': 'Atmintina diena',
    'tradition': 'Tradicijos ir kitos progos',
}


def category(article):
    if article.get('holiday_ids'):
        return 'statutory'
    if article['category'].startswith('Atmintina diena'):
        return 'memorial'
    return 'tradition'


def symbol(name, css='lh-icon'):
    return (f'<svg class="{css}" aria-hidden="true" focusable="false">'
            f'<use href="{ART}marks.svg#{name}"></use></svg>')


def date_range(dates, months):
    start, end = dates[0], dates[-1]
    month = months[start.month - 1][2]
    if start == end:
        return f'{start.year} m. {month} {start.day} d.'
    if start.month != end.month:
        return f'{start.year} m. {month} {start.day} d. ir {months[end.month - 1][2]} {end.day} d.'
    return f'{start.year} m. {month} {start.day}–{end.day} d.'


def render_hub(root, articles, media, sources, months, years, occurrences, readable):
    target = root / 'site/sventes/index.html'
    additional = json.loads((root / 'site/_data/lithuanian_dates.json').read_text())['commemorations']
    slugs = {a['slug'] for a in articles}
    catalog = articles + [a for a in additional if a['slug'] not in slugs]
    first_year = min(years)
    records = [(a, {year: sorted(occurrences(a, year)) for year in years}) for a in catalog]
    records.sort(key=lambda entry: entry[1][first_year][0])
    by_id = {a['id']: dates for a, dates in records}

    month_cards = '\n'.join(
        f'<a href="/sventes/{first_year}/{slug}/" class="lh-month">'
        f'{symbol(slug, "lh-month__art")}<span>{name}</span>{symbol("arrow")}</a>'
        for slug, name, _ in months
    )
    year_links = '\n'.join(f'<a href="/sventes/{year}/">{year}</a>' for year in years)
    year_options = ''.join(f'<option value="{year}">{year}</option>' for year in years)
    filters = '\n'.join(
        f'<button type="button" aria-pressed="false" data-lh-filter="{key}">{label}</button>'
        for key, label in zip(CATEGORIES, ('Šventinės dienos', 'Atmintinos dienos', 'Tradicijos ir kitos progos'))
    )

    def guide(a, dates):
        kind = category(a)
        dates_attributes = ' '.join(
            f'data-date-{year}="{escape(date_range(days, months))}" data-start-{year}="{days[0].isoformat()}"'
            for year, days in dates.items()
        )
        label = 'Kita proga' if kind == 'tradition' and a['category'].startswith('Neoficiali') else (
            'Tradicija' if kind == 'tradition' else CATEGORIES[kind]
        )
        year_link = ' data-lh-year-link' if a['slug'] in slugs else ''
        return f'''<article class="lh-guide" data-lh-guide="{kind}">
  <div class="lh-guide__meta">
    <span class="lh-tag lh-tag--{kind}">{label}</span>
    <span class="lh-guide__date" {dates_attributes}>{escape(date_range(dates[first_year], months))}</span>
  </div>
  <h3><a href="/sventes/{a['slug']}/"{year_link}>{escape(a['title'])}{symbol("arrow")}</a></h3>
  <p>{escape(a['summary'])}</p>
</article>'''

    def spotlight(a):
        m = media[a['id']]
        date = by_id[a['id']][first_year][0]
        return f'''<article class="lh-story" data-holiday-id="{a['id']}" data-holiday-hub-feature>
  <a class="lh-story__link" href="/sventes/{a['slug']}/">
    <img src="{escape(m['src'])}" srcset="{escape(m['srcset'])}"
      sizes="(max-width: 620px) 92vw, (max-width: 980px) 46vw, 410px"
      width="{m['width']}" height="{m['height']}" alt="{escape(m['caption'])}" loading="lazy" decoding="async">
    <span class="lh-story__text">
      <time datetime="{date.isoformat()}" data-next-occurrence>{escape(readable(date))}</time>
      <strong>{escape(a['title'])}{symbol('arrow')}</strong>
    </span>
  </a>
  <a class="lh-story__credit" href="/nuotrauku-licencijos/#{a['slug']}">Nuotrauka: {escape(m['author'])} · {escape(m['license'])}</a>
</article>'''

    featured_ids = ('easter', 'jonines', 'statehood')
    stories = '\n'.join(spotlight(next(a for a in articles if a['id'] == key)) for key in featured_ids)
    guides = '\n'.join(guide(a, dates) for a, dates in records)
    planning = (
        ('/atmintinos-dienos/', 'Atmintinų dienų gidas'),
        ('/renginiai/', 'Renginių ir festivalių kalendorius'),
        ('/atostogu-planavimas/', 'Atostogų planavimas'),
        ('/darbo-dienos/2027/', 'Darbo dienų kalendorius'),
        ('/menesiai/', 'Mėnesių kalendoriai spausdinimui'),
        ('/juodasis-penktadienis/', 'Juodasis penktadienis'),
        ('/kibernetinis-pirmadienis/', 'Kibernetinis pirmadienis'),
    )
    planning_links = '\n'.join(f'<a href="{url}">{name}{symbol("arrow")}</a>' for url, name in planning)
    source_links = ', '.join(
        f'<a href="{escape(sources[key]["url"])}">{label}</a>'
        for key, label in (
            ('labour-code', 'DK 123 straipsnis (2026 m. redakcija)'),
            ('labour-code-2027', 'DK 123 straipsnis (nuo 2027-01-01)'),
            ('memoriam-law', 'Atmintinų dienų įstatymas'),
        )
    )
    title = 'Lietuvos šventės ir atmintinos dienos'
    html = f'''<div class="lh" data-holiday-directory>
  <header class="lh-hero">
    <div class="lh-hero__copy">
      <p class="lh-kicker"><span aria-hidden="true"></span>Lietuvos kalendorius · {first_year}–{max(years)} m.</p>
      <h1>{title}</h1>
      <p class="lh-hero__lead">Raskite šventės datą, sužinokite, ar tai nedarbo diena, ir skaitykite apie Lietuvos tradicijas.</p>
      <div class="lh-hero__actions">
        <a class="lh-cta lh-cta--primary" href="#sventes-pagal-menesi">Rinktis mėnesį {symbol('down')}</a>
        <a class="lh-cta" href="#sventes-ir-minejimai">Rasti dieną {symbol('search')}</a>
      </div>
    </div>
    <img class="lh-hero__art" src="{ART}celebration-calendar.svg" width="600" height="390"
      alt="" aria-hidden="true" decoding="async" fetchpriority="high">
  </header>

  <section class="lh-months" id="sventes-pagal-menesi" aria-labelledby="lh-months-title">
    <div class="lh-section-head">
      <div><p class="lh-kicker">{first_year} m. kalendorius</p><h2 id="lh-months-title">Šventės pagal mėnesį</h2></div>
      <nav class="lh-years" aria-label="Metų šventinių dienų sąrašai">{year_links}</nav>
    </div>
    <div class="lh-month-grid">{month_cards}</div>
  </section>

  <section class="lh-stories" aria-labelledby="lh-stories-title">
    <div class="lh-section-head"><h2 id="lh-stories-title">Švenčių istorijos ir tradicijos</h2></div>
    <div class="lh-story-grid">{stories}</div>
  </section>

  <section class="lh-catalog" id="sventes-ir-minejimai" aria-labelledby="lh-catalog-title">
    <div class="lh-section-head">
      <div><h2 id="lh-catalog-title">Raskite šventę ar minėjimą</h2>
      <p>Pasirinkite metus ir atverkite dienos gidą.</p></div>
    </div>
    <div class="lh-controls" data-lh-controls hidden>
      <div class="lh-controls__fields">
        <div><label for="lh-query">Paieška</label>
          <input id="lh-query" type="search" maxlength="100" autocomplete="off" placeholder="Pvz., Velykos arba Sausio 13-oji">
        </div>
        <div><label for="lh-year">Metai</label>
          <select id="lh-year">{year_options}</select>
        </div>
      </div>
      <div class="lh-filters" role="group" aria-label="Dienų rūšys">
        <button type="button" data-lh-filter="all" aria-pressed="true">Visos dienos</button>
        {filters}
      </div>
      <p class="lh-result-count" data-lh-count role="status"></p>
    </div>
    <div class="lh-guide-grid">{guides}</div>
    <p class="lh-empty" data-lh-empty hidden>Pagal pasirinktus filtrus dienų nerasta. Pakeiskite paiešką arba rinkitės visas dienas.</p>
  </section>

  <section class="lh-archive" aria-labelledby="lh-archive-title">
    <div>
      <h2 id="lh-archive-title">Planuokite pagal kalendorių</h2>
      <nav class="lh-planning" aria-label="Susiję kalendoriai ir gidai">{planning_links}</nav>
    </div>
    <div class="lh-method">
      <h2>Šventinė ar atmintina diena?</h2>
      <p><strong>Šventinė diena.</strong> Pagal Darbo kodekso 123 straipsnį šiomis dienomis paprastai nedirbama. Kodekse numatytos išimtys.</p>
      <p><strong>Atmintina diena.</strong> Tai įstatyme įrašyta minėjimo data. Šis statusas savaime nesuteikia nedarbo dienos.</p>
      <details>
        <summary>Teisės aktai ir datų metodika {symbol('down')}</summary>
        <p>Teisės aktų duomenys sutikrinti <time datetime="2026-10-16">2026 m. spalio 16 d.</time> Darbo grafikas ir taikoma teisės akto redakcija turi reikšmės.</p>
        <p>Datas skaičiuojame pagal paskelbtame Darbo kodekso 123 straipsnyje nustatytą švenčių tvarką. Iki {max(years)} m. ši tvarka gali pasikeisti.</p>
        <p>{source_links}.</p>
        <p>Vienai datai gali būti skirti keli minėjimai. Renginių laiką ir vietą tikrinkite rengėjo skelbiamoje programoje.</p>
      </details>
    </div>
  </section>
</div>
'''
    title_description = f'Lietuvos šventės ir atmintinos dienos: {first_year}–{max(years)} m. datos, savaitės dienos, nedarbo dienų statusas, tradicijos ir istoriniai šaltiniai.'
    front = {'title': title, 'description': title_description, 'holiday_hub': True, 'holiday_editorial': True}
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text('---\n' + '\n'.join(f'{k}: {json.dumps(v, ensure_ascii=False)}' for k, v in front.items()) + '\n---\n' + html)
