#!/usr/bin/env python3
"""Extend the imported A3 designs with 2030 dates, using their original PDF artwork."""
import argparse
import calendar
from concurrent.futures import ProcessPoolExecutor
from copy import deepcopy
from dataclasses import dataclass
from datetime import date
from functools import cache
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import re
import subprocess

from fontTools.ttLib import TTFont
from PIL import Image, ImageCms

from calendar_package import TEMPLATE_EXTENSION_PATH, TEMPLATE_EXTENSION_YEAR
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ByteStringObject, DecodedStreamObject, FloatObject, NameObject, NumberObject,
)

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'site/assets/data/manifest.json'
EVIDENCE = ROOT / TEMPLATE_EXTENSION_PATH
YEAR = TEMPLATE_EXTENSION_YEAR
WEEKDAYS = ('Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št', 'Sk')
FILL = b'f*'
RENDER_YEARS = (2029, 2028, 2027)


@dataclass(frozen=True)
class Run:
    index: int
    x: float
    y: float
    font: str
    size: float
    spacing: float
    text: str

    @property
    def start(self):
        return self.index - 6

    @property
    def end(self):
        return self.index + 2



def embedded_font(pdf_font):
    return TTFont(BytesIO(pdf_font['/FontDescriptor']['/FontFile2'].get_data()))


def outline(font, code):
    name = font['cmap'].tables[0].cmap[code]
    return name, font['glyf'][name]


@cache
def source_pdfs():
    original_assets = [a for a in json.loads(MANIFEST.read_text())['assets'] if a.get('year') in RENDER_YEARS]
    return [ROOT / 'site' / a['pdf'].lstrip('/') for a in sorted(
        original_assets, key=lambda a: (a['kind'] != 'annual', -a['year']))]


@cache
def donor_glyph(family, code, units, advance):
    for path in source_pdfs():
        page = PdfReader(path).pages[0]
        for reference in page['/Resources']['/Font'].values():
            pdf_font = reference.get_object()
            if str(pdf_font['/BaseFont']).split('+')[-1] != family:
                continue
            font = embedded_font(pdf_font)
            name, glyph = outline(font, code)
            if glyph.numberOfContours > 0 and font['head'].unitsPerEm == units and font['hmtx'][name][0] == advance:
                return glyph, font['hmtx'][name]
    raise ValueError(f'No original outline for {family}, character code {code}')


class Template:
    def __init__(self, item):
        self.item = item
        self.reader = PdfReader(ROOT / 'site' / item['pdf'].lstrip('/'))
        page = self.reader.pages[0]
        self.stream = page.get_contents()
        self.ops = self.stream.operations
        self.fonts = {}
        for key, reference in page['/Resources']['/Font'].items():
            font = reference.get_object()
            cmap = font['/ToUnicode'].get_data().decode()
            table = {
                int(code, 16): bytes.fromhex(char).decode('utf-16-be')
                for code, char in re.findall(r'^<([\da-fA-F]{2})>\s+<([\da-fA-F]{4,})>\s*$', cmap, re.M)
            }
            self.fonts[str(key)] = (font, table, {char: code for code, char in table.items()})
        self.runs = []
        for index, (args, operator) in enumerate(self.ops):
            if operator != b'Tj':
                continue
            assert self.ops[index - 4][1] == b'Tm' and self.ops[index + 1][1] == b'ET'
            matrix = self.ops[index - 4][0]
            font, size = self.ops[index - 2][0]
            raw = args[0].original_bytes if hasattr(args[0], 'original_bytes') else bytes(args[0])
            text = ''.join(self.fonts[str(font)][1][code] for code in raw)
            self.runs.append(Run(index, float(matrix[4]), float(matrix[5]), str(font), float(size),
                                 float(self.ops[index - 3][0][0]), text))
        self.edits = []
        self.embedded = {}
        self.modified_fonts = set()

    def width(self, run, text=None):
        font, _, codes = self.fonts[run.font]
        encoded = bytes(codes[char] for char in (run.text if text is None else text))
        widths = font['/Widths']
        offset = int(font['/FirstChar'])
        # ReportLab uses the custom character spacing when aligning its text runs.
        return sum(float(widths[code - offset]) for code in encoded) * run.size / 1000 + max(0, len(encoded) - 1) * run.spacing

    def write_run(self, run, text=None, *, x=None, y=None, color=None):
        ops = list(self.ops[run.start:run.end])
        assert [op for _, op in ops] == [b'k', b'BT', b'Tm', b'Tc', b'Tf', b'TL', b'Tj', b'ET'], run
        if text is not None:
            encoded = bytes(self.fonts[run.font][2][char] for char in text)
            self.ensure_outlines(run.font, text, encoded)
            ops[6] = ([ByteStringObject(encoded)], b'Tj')
        matrix = list(ops[2][0])
        matrix[4] = number(run.x if x is None else x)
        matrix[5] = number(run.y if y is None else y)
        ops[2] = (matrix, b'Tm')
        if color is not None:
            ops[0] = (list(color), b'k')
        return ops

    def ensure_outlines(self, key, text, encoded):
        if key not in self.embedded:
            self.embedded[key] = embedded_font(self.fonts[key][0])
        font = self.embedded[key]
        for char, code in set(zip(text, encoded)):
            if char.isspace():
                continue
            name, glyph = outline(font, code)
            if glyph.numberOfContours:
                continue
            assert char.isascii(), (self.item['stem'], char)
            family = str(self.fonts[key][0]['/BaseFont']).split('+')[-1]
            donor, metrics = donor_glyph(family, code, font['head'].unitsPerEm, font['hmtx'][name][0])
            font['glyf'][name] = deepcopy(donor)
            font['hmtx'][name] = metrics
            self.modified_fonts.add(key)

    def color(self, run):
        return self.ops[run.start][0]

    def patch(self, start, end, operations):
        self.edits.append((start, end, operations))

    def update_year(self):
        old_year = str(self.item['year'])
        count = 0
        design = int(self.item['design'])
        if self.item['kind'] == 'monthly':
            align = 1 if design in (1, 6, 8, 10) else 0.5 if design in (2, 5, 7, 9) else 0
        else:
            align = 0.5 if design in (4, 5) else 0
        for run in self.runs:
            if old_year not in run.text:
                continue
            text = run.text.replace(old_year, str(YEAR))
            x = run.x + (self.width(run) - self.width(run, text)) * (align if run.text == old_year else 0)
            self.patch(run.start, run.end, self.write_run(run, text, x=x))
            count += 1
        assert count, self.item['stem']

    def save(self, destination):
        new_ops = []
        cursor = 0
        for start, end, replacement in sorted(self.edits, key=lambda edit: edit[0]):
            assert cursor <= start, (self.item['stem'], cursor, start)
            new_ops.extend(self.ops[cursor:start])
            new_ops.extend(replacement)
            cursor = end
        new_ops.extend(self.ops[cursor:])
        self.stream.operations = new_ops
        writer = PdfWriter(clone_from=self.reader)
        stream = DecodedStreamObject()
        stream.set_data(self.stream.get_data())
        writer.pages[0].replace_contents(stream.flate_encode())
        for key in sorted(self.modified_fonts):
            font = writer.pages[0]['/Resources']['/Font'][key]
            repaired = BytesIO()
            self.embedded[key].recalcTimestamp = False
            self.embedded[key].save(repaired)
            data = repaired.getvalue()
            embedded = DecodedStreamObject()
            embedded.set_data(data)
            embedded[NameObject('/Length1')] = NumberObject(len(data))
            font['/FontDescriptor'][NameObject('/FontFile2')] = writer._add_object(embedded.flate_encode())

        old_year = str(self.item['year'])
        writer.add_metadata({
            key: value.replace(old_year, str(YEAR))
            for key, value in (self.reader.metadata or {}).items()
            if isinstance(value, str) and key in ('/Title', '/Subject', '/Keywords')
        })
        writer.write(destination)


def number(value):
    return FloatObject(round(value, 6))


def transform(ops, *, dx=0, dy=0, yscale=1, origin=0):
    """Translate drawn artwork, with optional vertical resizing for six-week months."""
    def y_at(value):
        return number(origin + (float(value) - origin) * yscale + dy)
    result = []
    for args, operator in ops:
        if operator in (b'm', b'l', b'c'):
            args = [number(float(v) + dx) if not i % 2 else y_at(v) for i, v in enumerate(args)]
        elif operator == b're':
            args = [number(float(args[0]) + dx), y_at(args[1]), args[2], number(float(args[3]) * yscale)]
        elif operator == b'Tm':
            args = [*args[:4], number(float(args[4]) + dx), y_at(args[5])]
        result.append((args, operator))
    return result


def group(ops, start, length, expected):
    selected = ops[start:start + length]
    assert tuple(op for _, op in selected) == expected, (start, expected, selected)
    return selected


def week_count(year, month):
    return len(calendar.monthcalendar(year, month))


def days_of_month(year, month):
    offset, length = calendar.monthrange(year, month)
    return offset, length, range(1, length + 1)


def holiday_days(year_data, month):
    return {d['day']: d['holidays'][0] for d in year_data['months'][month - 1]['days'] if d['holidays']}


def consecutive_days(runs, length, start):
    found = []
    for run in runs[start:]:
        if run.text == str(len(found) + 1):
            found.append(run)
            if len(found) == length:
                return found
    raise ValueError('Could not identify the complete date sequence')


def step(values, origin, labels):
    distances = [(v - origin) / coordinate for v, coordinate in zip(values, labels) if coordinate]
    width = sum(distances) / len(distances)
    assert all(abs(width - d) < .04 for d in distances), distances
    return width


ANNUAL_MARK = (b'k', b'w', b'n', b'm', b'c', b'c', b'c', b'c', FILL)
LINE = (b'K', b'w', b'n', b'm', b'l', b'S')
TILE = (b'k', b'w', b'n', b'm', b'l', b'c', b'l', b'l', b'l', b'c', b'l', b'c', b'h', FILL)
NOTEBOOK_LINES = (b'q', b'd', *LINE, *LINE, b'Q')


def update_annual(template, source_year, target_year):
    source = template.item['year']
    starts = [i + 1 for i, run in enumerate(template.runs) if run.text == 'Sk']
    assert len(starts) == 12
    source_days = []
    for month, start in enumerate(starts, 1):
        days = consecutive_days(template.runs, calendar.monthrange(source, month)[1], start)
        source_days.append(days)
    fallback = source_days[0][0]
    for month, days in enumerate(source_days, 1):
        first = days[0]
        old_offset, _, _ = days_of_month(source, month)
        new_offset, _, day_numbers = days_of_month(YEAR, month)
        old_holidays = holiday_days(source_year, month)
        holiday = next((days[day - 1] for day in old_holidays), fallback)
        dot = group(template.ops, holiday.end, 9, ANNUAL_MARK)
        normal = next(run for run in days if date(source, month, int(run.text)).weekday() < 5
                      and int(run.text) not in old_holidays)
        weekend = next(run for run in days if date(source, month, int(run.text)).weekday() >= 5
                       and int(run.text) not in old_holidays)
        centers = [run.x + template.width(run) / 2 for run in days]
        dx = step(centers, centers[0], [(old_offset + d - 1) % 7 - old_offset for d in range(1, len(days) + 1)])
        dy = step([run.y for run in days], first.y, [(old_offset + d - 1) // 7 for d in range(1, len(days) + 1)])
        base_x = centers[0] - dx * old_offset
        holidays = holiday_days(target_year, month)
        operations = []
        for day in day_numbers:
            row, column = divmod(new_offset + day - 1, 7)
            center = base_x + column * dx
            y = first.y + row * dy
            model = holiday if day in holidays else weekend if column >= 5 else normal
            x = center - template.width(model, str(day)) / 2
            operations.extend(template.write_run(model, str(day), x=x, y=y))
            if day in holidays:
                original_center = holiday.x + template.width(holiday) / 2
                operations.extend(transform(dot, dx=center - original_center, dy=y - holiday.y))
        end = days[-1].end + (9 if len(days) in old_holidays else 0)
        template.patch(first.start, end, operations)


def update_radial(template):
    source = template.item['year']
    month = template.item['month']
    offset, length, _ = days_of_month(YEAR, month)
    original_offset = date(source, month, 1).weekday()
    start = next(i for i, run in enumerate(template.runs) if run.text == '1')
    runs = template.runs[start:start + length * 2]
    assert [int(r.text) for r in runs[::2]] == list(range(1, length + 1))
    colors = {run.text: template.color(run) for run in runs[1::2]}

    for index in range(length):
        day, label = runs[index * 2:index * 2 + 2]
        weekday = WEEKDAYS[(offset + index) % 7]
        assert label.text == WEEKDAYS[(original_offset + index) % 7]
        x = label.x + (template.width(label) - template.width(label, weekday)) / 2
        template.patch(day.start, label.end,
                       template.write_run(day, color=colors[weekday]) +
                       template.write_run(label, weekday, x=x, color=colors[weekday]))
    # The ring tick and the dot between two dates use the previous date's style.
    marker_ops = (b'k', b'w', b'n', b'm', b'c', b'c', b'c', b'c', FILL)
    for index, label in enumerate(runs[1::2]):
        start = label.end
        tick = list(group(template.ops, start, 6, LINE))
        dot = list(group(template.ops, start + 6, 9, marker_ops))
        color = colors[WEEKDAYS[(offset + index) % 7]]
        tick[0] = (color, b'K')
        dot[0] = (color, b'k')
        template.patch(start, start + 15, tick + dot)


def resize_grid(template, start, end, rows, new_rows, top, old_pitch):
    """Reuse the original separators and keep the outside of the grid fixed."""
    if rows == new_rows:
        return
    operations = template.ops
    bottom = top - rows * old_pitch
    horizontal = []
    for index in range(start, end - 5):
        (a, op), (b, next_op) = operations[index + 3:index + 5]
        if op == b'm' and next_op == b'l' and abs(float(a[1]) - float(b[1])) < .001:
            y = float(a[1])
            if bottom + .02 < y < top - .02:
                ratio = (top - y) / old_pitch
                if abs(ratio - round(ratio)) < .001:
                    horizontal.append(index)
    assert len(horizontal) == rows - 1, (template.item['stem'], horizontal, rows)
    begin = horizontal[0]
    finish = horizontal[-1] + 6
    assert horizontal == list(range(begin, finish, 6))
    example = group(operations, begin, 6, LINE)
    new_pitch = old_pitch * rows / new_rows
    template.patch(begin, finish, [
        op for index in range(1, new_rows)
        for op in transform(example, dy=old_pitch - new_pitch * index)
    ])


# Each imported design has a fixed grid height and a variable number of rows.
# Values are offsets from its original calendar grid lines, not approximate page positions.
GRID_LAYOUT = {
    1: (29, 421, 6, False),
    3: (53, 630, 6, False),
    4: (35, 523, 6, False),
    5: (68, 445, 0, True),
    6: (32, 452, 0, False),
    7: (38, 621, 12, False),
    9: (41, 527, 6, True),
    10: (35, 410, 15, False),
}


def update_month_grid(template, source_year, target_year):
    design = int(template.item['design'])
    source = template.item['year']
    month = template.item['month']
    old_offset, length, _ = days_of_month(source, month)
    new_offset, new_length, day_numbers = days_of_month(YEAR, month)
    rows = week_count(source, month)
    new_rows = week_count(YEAR, month)
    y_offset, grid_height, line_length, centered = GRID_LAYOUT[design]
    assert length == new_length

    start = next(i for i, run in enumerate(template.runs) if run.text == '1' and
                 (design != 4 or i > 8) and (design != 1 or i > 8))
    day_runs = consecutive_days(template.runs, length, start)
    first = day_runs[0]
    old_pitch, new_pitch = grid_height / rows, grid_height / new_rows
    top = first.y + y_offset
    centers = [r.x + (template.width(r) / 2 if centered else 0) for r in day_runs]
    old_columns = [(old_offset + d - 1) % 7 for d in day_numbers]
    if design == 10:
        # The binding separates a four-column left page from a three-column right page.
        positions = [centers[old_columns.index(column)] for column in range(7)]
    else:
        dx = step(centers, centers[0], [col - old_offset for col in old_columns])
        base_x = centers[0] - old_offset * dx
        positions = [base_x + column * dx for column in range(7)]

    old_holidays = holiday_days(source_year, month) if design == 1 else {}
    new_holidays = holiday_days(target_year, month) if design == 1 else {}
    labels = {h['id']: d for d, h in old_holidays.items()}
    assert {h['id'] for h in old_holidays.values()} == {h['id'] for h in new_holidays.values()}
    normal = next(run for run in day_runs if date(source, month, int(run.text)).weekday() < 5
                  and int(run.text) not in old_holidays)
    weekend = next(run for run in day_runs if date(source, month, int(run.text)).weekday() >= 5
                   and int(run.text) not in old_holidays)
    ops = template.ops
    first_start = first.start
    end = day_runs[-1].end + line_length
    lead_blank = []
    if design in (3, 4):
        trailing = rows * 7 - old_offset - length
        first_start -= old_offset * 6
        end += trailing * 6
        assert old_offset or trailing, template.item['stem']
        if old_offset:
            lead_blank = group(ops, first_start, 6, LINE)
            blank_x = base_x
            blank_y = first.y
        else:
            lead_blank = group(ops, end - trailing * 6, 6, LINE)
            blank_x = base_x + ((old_offset + length) % 7) * dx
            blank_y = first.y - (rows - 1) * old_pitch
    grid_header = template.runs[start - 1].end
    if design == 7:
        first_start -= 14
        if template.runs[start - 1].text == 'Naujos mintys.':
            quote_start = template.runs[start - 3].end
            if new_offset < 5:
                first_start = quote_start
            else:
                quote_old_right = base_x + dx * old_offset - 20
                quote_new_right = base_x + dx * new_offset - 20
                quote = []
                for args, op in ops[quote_start:first_start]:
                    if op in (b'm', b'l', b'c'):
                        args = list(args)
                        for i in range(0, len(args), 2):
                            if float(args[i]) > quote_old_right - 110:
                                args[i] = number(float(args[i]) + quote_new_right - quote_old_right)
                    quote.append((args, op))
                template.patch(quote_start, first_start, quote)
    if design in (1, 3, 4, 6, 9):
        resize_grid(template, grid_header, first_start, rows, new_rows, top, old_pitch)
    labels_by_day = {}
    if design == 1:
        for day in old_holidays:
            run = day_runs[day - 1]
            index = template.runs.index(run) + 1
            while template.runs[index].size in (6.4, 9.2):
                index += 1
            labels_by_day[day] = ops[run.end:template.runs[index].start]
            assert len(labels_by_day[day]) in (8, 16), (template.item['stem'], day)
        holiday_geometry(template, day_runs, old_holidays, new_holidays, old_offset, new_offset,
                         rows, new_rows, base_x, dx, top, old_pitch, new_pitch)
        if len(day_runs) in old_holidays:
            end = day_runs[-1].end + len(labels_by_day[len(day_runs)])

    updated = []
    for slot in range(new_rows * 7):
        row, column = divmod(slot, 7)
        day = slot - new_offset + 1
        y = first.y - row * new_pitch
        x = positions[column]
        if not 1 <= day <= new_length:
            if lead_blank:
                updated.extend(transform(lead_blank, dx=x - blank_x, dy=y - blank_y))
            continue
        old_run = day_runs[day - 1]
        model = old_run
        if design == 1 and day in new_holidays:
            model = day_runs[labels[new_holidays[day]['id']] - 1]
        elif design in (1, 3, 4, 5, 6, 9, 10):
            model = weekend if column >= 5 else normal
        if centered:
            x -= template.width(model, str(day)) / 2
        if design == 7:
            # Tile fills use the same original alternating colors as the date columns.
            model = next((r for r in day_runs if (old_offset + int(r.text) - 1) % 7 == column
                          and ((old_offset + int(r.text) - 1) // 7) % 2 == row % 2), old_run)
            prefix = group(ops, model.start - 14, 14, TILE)
            updated.extend(transform(prefix, dx=x - model.x, dy=y - model.y,
                                     yscale=new_pitch / old_pitch, origin=model.y + y_offset))
        updated.extend(template.write_run(model, str(day), x=x, y=y))
        if design == 1 and day in new_holidays:
            updated.extend(transform(labels_by_day[int(model.text)], dx=x - model.x, dy=y - model.y))
        elif line_length:
            source_line = model
            line = ops[source_line.end:source_line.end + line_length]
            expected = NOTEBOOK_LINES if design == 10 else LINE * (line_length // 6)
            assert tuple(op for _, op in line) == expected, (template.item['stem'], source_line, expected, line)
            offset_x = x - source_line.x
            if centered:
                offset_x += (template.width(model, str(day)) - template.width(model)) / 2
            # Open-notebook columns straddle the binding; the rule width differs by page.
            if design == 10:
                source_line = next(r for r in day_runs if (old_offset + int(r.text) - 1) % 7 == column)
                offset_x = x - source_line.x
                line = ops[source_line.end:source_line.end + line_length]
            updated.extend(transform(line, dx=offset_x, dy=y - source_line.y,
                                     yscale=new_pitch / old_pitch if design == 7 else 1,
                                     origin=source_line.y + y_offset if design == 7 else 0))
    template.patch(first_start, end, updated)


def holiday_geometry(template, day_runs, old_holidays, new_holidays, old_offset, new_offset,
                     rows, new_rows, base_x, dx, top, old_pitch, new_pitch):
    ops = template.ops
    rectangles = []
    for i, (args, op) in enumerate(ops[:day_runs[0].start]):
        if op == b're' and len(args) == 4 and abs(float(args[2]) - dx) < .02 and abs(float(args[3]) - old_pitch) < .02:
            rectangles.append(i - 3)
    assert len(rectangles) == rows * 2 + len(old_holidays), (template.item['stem'], rectangles)
    assert rectangles == list(range(rectangles[0], rectangles[-1] + 1, 5))
    colors = {}
    weekend_rect = None
    for begin in rectangles:
        sample = ops[begin:begin + 5]
        coords = sample[3][0]
        col = round((float(coords[0]) - base_x + 13) / dx)
        row = round((top - float(coords[1])) / old_pitch) - 1
        if col >= 5 and (col, row) not in colors:
            colors[(col, row)] = sample
            weekend_rect = sample
        else:
            holiday_rect = sample
    assert weekend_rect is not None
    painted = []
    for slot in range(new_rows * 7):
        row, col = divmod(slot, 7)
        day = slot - new_offset + 1
        if col < 5 and day not in new_holidays:
            continue
        samples = ([weekend_rect] if col >= 5 else []) + ([holiday_rect] if day in new_holidays else [])
        for sample in samples:
            sample = list(sample)
            sample[3] = ([number(base_x - 13 + dx * col), number(top - new_pitch * (row + 1)),
                          number(dx), number(new_pitch)], b're')
            painted.extend(sample)
    template.patch(rectangles[0], rectangles[-1] + 5, painted)

    for run in template.runs:
        if run.index <= day_runs[-1].index or len(run.text) != 2 or not run.text.isdigit():
            continue
        original = int(run.text)
        holiday = old_holidays.get(original)
        if holiday:
            day = next(d for d, entry in new_holidays.items() if entry['id'] == holiday['id'])
            template.patch(run.start, run.end, template.write_run(run, f'{day:02}'))


def update_week_strip(template):
    source = template.item['year']
    month = template.item['month']
    old_weeks = calendar.monthcalendar(source, month)
    new_weeks = calendar.monthcalendar(YEAR, month)
    ranges = [r for r in template.runs if re.fullmatch(r'\d\d-\d\d', r.text)]
    assert len(ranges) == len(old_weeks)
    ops = template.ops
    old_pitch = ranges[0].y - ranges[1].y
    new_pitch = old_pitch * len(old_weeks) / len(new_weeks)
    template_rows = []
    for row, (run, week) in enumerate(zip(ranges, old_weeks)):
        head = run.index - 20
        begin = run.index + 28
        assert ops[head][1] == b'k' and ops[begin - 1][1] == b'B*'
        prefix = ops[head:begin]
        cells = []
        cursor = begin
        for column, day in enumerate(week):
            before = (5 if column >= 5 else 0) + (6 if column else 0)
            before_ops = ops[cursor:cursor + before]
            cursor += before
            if day:
                run_for_day = next(r for r in template.runs if r.start == cursor)
                assert run_for_day.text == str(day)
                body = ops[run_for_day.end:run_for_day.end + 12]
                assert tuple(op for _, op in body) == LINE * 2
                cursor = run_for_day.end + 12
            else:
                run_for_day = None
                body = group(ops, cursor, 6, LINE)
                cursor += 6
            cells.append((before_ops, run_for_day, body))
        if row + 1 < len(ranges):
            assert cursor == ranges[row + 1].index - 20, (row, cursor, ranges[row + 1])
        template_rows.append((head, cursor, prefix, cells))
    full_row = next(cells for _, _, _, cells in template_rows if all(cell[1] for cell in cells))
    empty = next(cell for _, _, _, cells in template_rows for cell in cells if cell[1] is None)
    empty_x = float(empty[2][3][0][0])
    empty_row = next(i for i, (_, _, _, cells) in enumerate(template_rows) if empty in cells)
    updated = []
    for new_row, week in enumerate(new_weeks):
        sample_row = min(new_row, len(old_weeks) - 1)
        head, _, prefix, cells = template_rows[sample_row]
        run = ranges[sample_row]
        dates = [day for day in week if day]
        first, last = dates[0], dates[-1]
        prefix = list(prefix)
        prefix[run.index - head] = template.write_run(run, f'{first:02}-{last:02}')[6]
        offset = sample_row * old_pitch - new_row * new_pitch
        scale = new_pitch / old_pitch
        top = float(prefix[-2][0][1]) + float(prefix[-2][0][3])
        updated.extend(transform(prefix, dy=offset, yscale=scale, origin=top))
        for column, day in enumerate(week):
            updated.extend(transform(cells[column][0], dy=offset, yscale=scale, origin=top))
            _, model, rules = full_row[column]
            model_row = next(i for i, (_, _, _, row_cells) in enumerate(template_rows) if row_cells is full_row)
            row_shift = (model_row - sample_row) * old_pitch
            if day:
                updated.extend(template.write_run(model, str(day), y=model.y + model_row * old_pitch - new_row * new_pitch))
                updated.extend(transform(rules, dy=offset + row_shift, yscale=scale, origin=top - row_shift))
            else:
                shift = (empty_row - sample_row) * old_pitch
                updated.extend(transform(empty[2], dx=model.x - empty_x, dy=offset + shift,
                                         yscale=scale, origin=top - shift))
    template.patch(template_rows[0][0], template_rows[-1][1], updated)


def update_template(item, source_year, target_year, destination):
    template = Template(item)
    design = int(item['design'])
    template.update_year()
    if item['kind'] == 'annual':
        update_annual(template, source_year, target_year)
    elif design == 2:
        update_radial(template)
    elif design == 8:
        update_week_strip(template)
    else:
        update_month_grid(template, source_year, target_year)
    template.save(destination)


def record(path):
    return {'bytes': path.stat().st_size, 'sha256': sha256(path.read_bytes()).hexdigest()}


def site_path(item, key):
    return ROOT / 'site' / item[key].lstrip('/')


def target_item(item, target_year):
    old = str(item['year'])
    out = dict(item)
    for key, value in out.items():
        if isinstance(value, str) and key != 'sourcePackage':
            out[key] = value.replace(old, str(YEAR))
    out['year'] = YEAR
    out['markedHolidayCount'] = (
        sum(len(holiday_days(target_year, month)) for month in range(1, 13)) if item['kind'] == 'annual'
        else len(holiday_days(target_year, item['month'])) if item['holidayInformation'] else 0
    )
    return out


def render_webp(path, webp, dimensions, poppler):
    image_bytes = subprocess.run(
        [poppler, '-r', '600', '-singlefile', '-cropbox', str(path)],
        check=True, stdout=subprocess.PIPE,
    ).stdout
    with Image.open(BytesIO(image_bytes)) as image:
        assert image.size == (dimensions['width'], dimensions['height']), image.size
        icc = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
        image.save(webp, format='WEBP', lossless=True, method=3, icc_profile=icc)


def generate(task):
    source, source_year, target_year, poppler, pdf_dir = task
    target = target_item(source, target_year)
    pdf = pdf_dir / (target['stem'] + '.pdf') if pdf_dir else site_path(target, 'pdf')
    pdf.parent.mkdir(parents=True, exist_ok=True)
    if pdf_dir:
        update_template(source, source_year, target_year, pdf)
        return target, None
    update_template(source, source_year, target_year, pdf)
    from import_calendar_package import make_preview
    webp, preview, small_preview = (site_path(target, k) for k in ('webp', 'preview', 'smallPreview'))
    for path in (webp, preview, small_preview):
        path.parent.mkdir(parents=True, exist_ok=True)
    render_webp(pdf, webp, target['dimensions'], poppler)
    make_preview(webp, preview, 680)
    make_preview(webp, small_preview, 340)
    target['files'] = {key: record(site_path(target, key)) for key in ('pdf', 'webp', 'preview', 'smallPreview')}
    target.pop('legacyPaths', None)
    target.pop('verification', None)
    return target, {'source': source['stem'], 'source_pdf_sha256': source['files']['pdf']['sha256'],
                    'stem': target['stem'], 'files': target['files']}


def choose_source(assets, month, design):
    options = [assets[year, month, design] for year in RENDER_YEARS]
    if month is None or design == '02':
        return options[0]
    return next((item for item in options if week_count(item['year'], month) == week_count(YEAR, month)), options[0])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--poppler', default='pdftoppm')
    parser.add_argument('--workers', type=int, default=2)
    parser.add_argument('--pdf-dir', type=Path, help='Render PDFs to a separate directory for inspection')
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text())
    assets = {(a.get('year'), a.get('month'), a['design']): a for a in manifest['assets'] if a['kind'] != 'blank'}
    source_years = {a['year']: a for a in json.loads((ROOT / 'site/assets/data/years.json').read_text())}
    calendar_data = subprocess.check_output(
        ['ruby', '-Ilib', '-rcalendar', '-rjson', '-e', f'puts JSON.generate(Kalendorius.year({YEAR}))'],
        cwd=ROOT,
    )
    target_year = json.loads(calendar_data)
    sources = [choose_source(assets, month, f'{design:02}') for month in (*range(1, 13), None)
               for design in range(1, 11)]
    tasks = [(item, source_years[item['year']], target_year, args.poppler, args.pdf_dir) for item in sources]
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        generated = list(pool.map(generate, tasks))
    if args.pdf_dir:
        print(f'Rendered {len(generated)} PDFs to {args.pdf_dir}')
        return
    assets = [a for a in manifest['assets'] if a.get('year') != YEAR]
    manifest['assets'] = assets + [item for item, _ in generated]
    manifest['templateExtension'] = str(EVIDENCE.relative_to(ROOT))
    from preflight import YEAR_DATA, preflight
    if not any(record['year'] == YEAR for record in YEAR_DATA):
        YEAR_DATA.append(target_year)
    for item, _ in generated:
        item['verification'] = preflight(item, ROOT / 'site/downloads')
    EVIDENCE.write_text(json.dumps({'year': YEAR, 'calendar': target_year, 'assets': [proof for _, proof in generated]},
                                   ensure_ascii=False, indent=2) + '\n')
    manifest['templateExtensionSha256'] = record(EVIDENCE)['sha256']
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'Rendered {len(generated)} A3 template sets')


if __name__ == '__main__':
    main()
