"""Practical comparisons using topocentric solar and lunar altitudes."""
from datetime import date, timedelta
from html import escape
import json
from subprocess import check_output

from core import GENITIVE, MONTHS, ROOT, SLUGS

CITIES = {'vilnius': 'Vilnius', 'klaipeda': 'Klaipėda'}
TWILIGHT_SOURCE = 'https://aa.usno.navy.mil/faq/RST_defs'
VIEWING_SOURCE = 'https://science.nasa.gov/moon/observe-the-moon-night/observe-at-home/'


def load_observations(years):
    return json.loads(check_output(
        ['node', str(ROOT / 'scripts/lunar/observation.mjs'), *map(str, years)],
        cwd=ROOT, text=True,
    ))


def dark_dates(records, city):
    # A small buffer below the horizon avoids implying that the upper rim
    # is invisible exactly when the Moon's geometric centre reaches 0°.
    return [day for day, row in records if row[city]['sun'] <= -18 and row[city]['moon'] <= -2]


def waxing_observation(records, city):
    suitable = [(day, row) for day, row in records if (
        55 <= row['elongation'] <= 125 and row[city]['sun'] <= -6 and row[city]['moon'] >= 12
    )]
    return min(suitable, key=lambda item: abs(item[1]['elongation'] - 90), default=None)


def time_tag(day, label):
    return f'<time datetime="{escape(day)}">{escape(label)}</time>'


def date_intervals(dates):
    pairs = []
    for value in dates:
        current = date.fromisoformat(value)
        if pairs and current - pairs[-1][1] == timedelta(days=1):
            pairs[-1][1] = current
        else:
            pairs.append([current, current])
    pieces = []
    for first, last in pairs:
        label = time_tag(first.isoformat(), str(first.day))
        if first != last:
            label += '–' + time_tag(last.isoformat(), str(last.day))
        pieces.append(label)
    return ', '.join(pieces) + ' d.' if pieces else 'Tokių vakarų nėra'


def comparison_table(caption, headings, rows):
    headings_html = ''.join(f'<th scope="col">{escape(title)}</th>' for title in headings)
    rows_html = ''.join(
        f'<tr><th scope="row">{label}</th>' + ''.join(f'<td>{value}</td>' for value in values) + '</tr>'
        for label, *values in rows
    )
    return (
        '<div class="table-scroll"><table class="data-table">'
        f'<caption>{escape(caption)}</caption><thead><tr>{headings_html}</tr></thead>'
        f'<tbody>{rows_html}</tbody></table></div>'
    )


def monthly_observation(year, month, records):
    rows = []
    for city, name in CITIES.items():
        dark = dark_dates(records, city)
        candidate = waxing_observation(records, city)
        if candidate:
            day, values = candidate
            label = f'{GENITIVE[month-1]} {int(day[-2:])} d.'
            altitude = f'{values[city]["moon"]:.0f}°'
            lit = f'{values["illumination"]*100:.0f} %'
            choice = f'{time_tag(day, label)} · Mėnulis {altitude} virš horizonto, apšviesta {lit} disko'
        else:
            choice = 'Pagal pasirinktus kriterijus 23 val. tinkamos datos šį mėnesį nėra'
        rows.append((name, date_intervals(dark), choice))
    headings = ['Miestas', 'Tamsus dangus ir Mėnulis žemiau horizonto', 'Augantis Mėnulis netoli priešpilnio']
    table = comparison_table(f'{year} m. · {GENITIVE[month-1]} vakarai 23:00 Lietuvos laiku', headings, rows)
    return f'''<section class="lunar-insight" id="stebejimai" aria-labelledby="lunar-observation-title">
<h2 id="lunar-observation-title">{MONTHS[month-1]} · Mėnulio ir dangaus stebėjimai</h2>
<p>Planuojate pažvelgti į dangų 23 val.? Pirmame datų stulpelyje ieškokite tamsesnių vakarų, antrame – tinkamo vakaro Mėnulio krateriams stebėti žiūronais. Ši lentelė naudoja vakaro skaičiavimus. Mėnesio tinklelyje aukščiau rodomas vidurdienio vaizdas.</p>
{table}
<details class="lunar-observation-method"><summary>Kaip atrinktos datos?</summary>
<p>Skaičiuojamas geometrinis kūnų centrų aukštis Vilniuje ir Klaipėdoje. Tamsaus dangaus stulpelyje Saulė yra bent 18° žemiau horizonto, Mėnulio centras bent 2° žemiau. Mėnuliui stebėti ieškoma datos netoli priešpilnio, kai Saulė bent 6° žemiau horizonto, o Mėnulis bent 12° aukščiau. Ribos apibrėžia atranką vienam paros momentui. Matomumą vietoje lemia ir debesys, šviesos tarša bei kliūtys ties horizontu.</p>
<p><a href="{TWILIGHT_SOURCE}">USNO prieblandos apibrėžimai</a> · <a href="{VIEWING_SOURCE}">NASA patarimai stebint Mėnulį</a> · <a href="/saule/">Saulėlydžio laikas Lietuvos miestuose</a></p>
</details>
</section>'''


def annual_observation(year, groups):
    rows = []
    for month, records in enumerate(groups, 1):
        title = f'<a href="/menulio-kalendorius/{year}/{SLUGS[month-1]}/#stebejimai">{MONTHS[month-1]}</a>'
        rows.append((title, *[str(len(dark_dates(records, city))) for city in CITIES]))
    table = comparison_table(
        'Vakarų skaičius pagal mėnesį. Skaičiuojama 23:00 Lietuvos laiku.',
        ['Mėnuo', *CITIES.values()], rows,
    )
    return f'''<section class="lunar-insight" id="stebejimai">
<h2>{year} m. tamsaus dangaus vakarų palyginimas</h2>
<p>Kiek kiekvieną mėnesį yra vakarų, kai 23 val. Saulė jau bent 18° žemiau horizonto, o Mėnulis nusileidęs žemiau pasirinktos ribos? Vilniaus ir Klaipėdos palyginimas padeda pasirinkti mėnesį. Paspauskite mėnesį, kad pamatytumėte datas ir atskirą pasiūlymą Mėnuliui stebėti.</p>
{table}
<p>Jei mėnesio eilutėje rodoma 0, pasirinktomis sąlygomis 23 val. tokių vakarų nėra. Tamsos gali būti kitu paros metu. Prieš išvykdami patikrinkite orus ir vietos horizontą.</p>
</section>'''
