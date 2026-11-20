"""Decorative calendar covers composed from the site's checked lunar day images."""
import base64
from html import escape

from core import ROOT

COVER_DIRECTORY = '/assets/visuals/lunar-covers'
COLORS = (
    ('#aacacf', '#315477'), ('#d1cbe4', '#584365'), ('#b8cfaa', '#34654b'),
    ('#d8d19a', '#65703a'), ('#e5c7ad', '#7a5943'), ('#b4d0c0', '#2e6657'),
    ('#e8c578', '#786135'), ('#e6b791', '#875036'), ('#d5bb86', '#725b35'),
    ('#dca99c', '#804739'), ('#bba9c6', '#594061'), ('#b3c4d1', '#455979'),
)


def disc(day, x, y, size):
    source = ROOT / 'site/assets/lunar/days' / f'{day}.webp'
    data = base64.b64encode(source.read_bytes()).decode('ascii')
    center_x, center_y = x + size / 2, y + size / 2
    return (
        f'<circle cx="{center_x}" cy="{center_y}" r="{size/2}" fill="#122725"/>'
        f'<image x="{x}" y="{y}" width="{size}" height="{size}" href="data:image/webp;base64,{data}"/>'
    )


def cover(name, label, year, samples, color):
    shade, shadow = color
    phase_art = ''.join(
        disc(day['date_local'], x, y, size)
        for day, (x, y, size) in zip(samples, ((82, 64, 42), (68, 92, 15), (118, 107, 11), (97, 110, 10)))
    )
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 148">
  <desc>Kalendorius365. Mėnulio disko vaizdai pagal NASA SVS ir LRO / LROC paviršiaus duomenis.</desc>
  <defs>
    <linearGradient id="paper" x2="1" y2="1"><stop stop-color="#fffcef"/><stop offset="1" stop-color="#dfdfc4"/></linearGradient>
    <linearGradient id="sky" x2="1" y2="1"><stop stop-color="{shadow}"/><stop offset="1" stop-color="#132d2b"/></linearGradient>
    <linearGradient id="metal" x2="1" y2="1"><stop stop-color="#fff4c7"/><stop offset=".53" stop-color="#c8ab6c"/><stop offset="1" stop-color="#79613a"/></linearGradient>
    <radialGradient id="shade"><stop stop-color="#001812" stop-opacity=".57"/><stop offset="1" stop-color="#001812" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="82" cy="130" rx="72" ry="13" fill="url(#shade)"/>
  <path d="M20 125 39 62l96 8 10 57-26 6Z" fill="{shadow}" stroke="#1c3a30" stroke-width="2"/>
  <g transform="rotate(-7 80 73)">
    <rect x="18" y="28" width="125" height="98" rx="9" fill="#b1a886"/>
    <rect x="15" y="23" width="125" height="99" rx="8" fill="url(#paper)" stroke="#fff7e4"/>
    <path d="M16 31a8 8 0 0 1 8-7h108a7 7 0 0 1 7 7v23H16Z" fill="{shade}"/>
    <rect x="23" y="61" width="108" height="51" rx="6" fill="url(#sky)"/>
    <ellipse cx="99" cy="86" rx="33" ry="14" transform="rotate(-16 99 86)" fill="none" stroke="{shade}" stroke-opacity=".46"/>
    <path d="M33 73h27m-27 8h21m-21 8h24m-24 8h18" stroke="{shade}" stroke-width="1.3" stroke-linecap="round" opacity=".55"/>
    <g font-family="Arial,sans-serif" fill="#172d26" font-weight="700">
      <text x="24" y="43" font-size="11">{escape(label)}</text>
      <text x="132" y="43" text-anchor="end" font-size="10">{escape(year)}</text>
    </g>
    <g fill="none" stroke="#163324" stroke-width="4" opacity=".55"><path d="M33 30v-8q0-7 5-7t5 7v5m66 3v-8q0-7 5-7t5 7v5"/></g>
    <g fill="none" stroke="url(#metal)" stroke-width="3" stroke-linecap="round"><path d="M32 28v-8q0-7 5-7t5 7v6m66 2v-8q0-7 5-7t5 7v6"/></g>
    {phase_art}
  </g>
  <path d="M15 133h38" stroke="#fdb913" stroke-width="3" stroke-linecap="round"/>
  <path d="M27 133h12" stroke="#006a44" stroke-width="3"/>
  <path d="M40 133h13" stroke="#c1272d" stroke-width="3" stroke-linecap="round"/>
</svg>'''
    directory = ROOT / 'site' / COVER_DIRECTORY.lstrip('/')
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f'{name}.svg'
    if not target.exists() or target.read_text() != svg:
        target.write_text(svg)
    return f'{COVER_DIRECTORY}/{target.name}'


def monthly_cover(year, month, title, rows):
    representative = min(rows, key=lambda day: abs(day['elongation_deg'] - 110))
    remaining = [rows[index] for index in (1, 10, 18)]
    return cover(f'{year}-{month:02}', title, str(year), [representative, *remaining], COLORS[month - 1])


def annual_cover(year, rows):
    samples = [rows[index] for index in (5, 98, 190, 290)]
    return cover(str(year), 'Mėnulio fazės', str(year), samples, COLORS[(year - 2027) * 3])


def collection_cover(rows):
    samples = [rows[index] for index in (12, 72, 171, 268)]
    return cover('kalendorius', 'Mėnulio fazės', '', samples, ('#e7cb83', '#426453'))
