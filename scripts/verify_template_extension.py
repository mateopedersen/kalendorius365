#!/usr/bin/env python3
"""Check the printed dates, holiday markers and glyph outlines in the 2030 series."""
import calendar
from datetime import date
import json
import re

from extend_calendar_templates import (
    ANNUAL_MARK, EVIDENCE, MANIFEST, WEEKDAYS, YEAR, Template, embedded_font, outline,
)


def date_runs(template, month, start):
    count = calendar.monthrange(template.item['year'], month)[1]
    dates = []
    for run in template.runs[start:]:
        if run.text.isascii() and run.text.isdecimal() and 1 <= int(run.text) <= count:
            dates.append(run)
            if len(dates) == count:
                break
    assert [run.text for run in dates] == [str(n) for n in range(1, count + 1)], template.item['stem']
    return dates


def annual_months(template):
    headers = [i for i, run in enumerate(template.runs) if run.text == 'Sk']
    assert len(headers) == 12, template.item['stem']
    return [date_runs(template, month, index + 1) for month, index in enumerate(headers, 1)]


def month_start(template):
    design = template.item['design']
    return next(i for i, run in enumerate(template.runs)
                if run.text == '1' and (design not in ('01', '04') or i > 8))


def expected_rectangle(ops, start, x, y, width, height):
    for offset in range(start):
        args, op = ops[offset]
        if op == b're' and all(abs(float(a) - b) < .025
                              for a, b in zip(args, (x, y, width, height))):
            yield offset


def verify_grid(source, output, month, reference, rendered, holidays):
    design = output.item['design']
    annual = output.item['kind'] == 'annual'
    source_year = source.item['year']
    row_count = len(calendar.monthcalendar(YEAR, month))
    old_row_count = len(calendar.monthcalendar(source_year, month))
    old_offset = calendar.monthrange(source_year, month)[0]
    offset = calendar.monthrange(YEAR, month)[0]
    centered = annual or design in ('05', '09')
    original_x = {}
    original_y = {}
    for day, glyph in enumerate(reference, 1):
        row, column = divmod(old_offset + day - 1, 7)
        mid = glyph.x + (source.width(glyph) / 2 if centered else 0)
        assert column not in original_x or abs(original_x[column] - mid) < .03
        assert row not in original_y or abs(original_y[row] - glyph.y) < .03
        original_x[column] = mid
        original_y[row] = glyph.y
    original_step = original_y[0] - original_y[1]
    row_step = original_step if annual else original_step * old_row_count / row_count
    for day, glyph in enumerate(rendered, 1):
        row, column = divmod(offset + day - 1, 7)
        mid = glyph.x + (output.width(glyph) / 2 if centered else 0)
        assert abs(mid - original_x[column]) < .035, (output.item['stem'], month, day, 'wrong weekday column')
        assert abs(glyph.y - (original_y[0] - row_step * row)) < .035, (output.item['stem'], month, day, 'wrong week row')
        assert date(YEAR, month, day).weekday() == column
        if annual:
            mark = output.ops[glyph.end:glyph.end + len(ANNUAL_MARK)]
            # On the last day the same shape can start the separate footer legend.
            marked = (tuple(op for _, op in mark) == ANNUAL_MARK and
                      abs(float(mark[3][0][0]) - mid) < 4 and
                      abs(float(mark[3][0][1]) - glyph.y) < 8)
            assert marked == (day in holidays), (output.item['stem'], month, day, 'holiday marker')
        elif design == '01':
            run_index = output.runs.index(glyph)
            labels = [run for run in output.runs[run_index + 1:run_index + 3] if run.size in (6.4, 9.2)]
            marked = output.runs[run_index + 1].size == 9.2
            assert marked == (day in holidays), (output.item['stem'], month, day, 'printed holiday')
            if marked:
                assert all(abs(r.x - glyph.x) < .02 and glyph.y - 37 <= r.y < glyph.y for r in labels)
                width = original_x[1] - original_x[0]
                bottom = glyph.y + 29 - row_step
                fills = list(expected_rectangle(output.ops, rendered[0].start, glyph.x - 13, bottom, width, row_step))
                assert len(fills) == (2 if column >= 5 else 1), (output.item['stem'], month, day, 'holiday fill')
    return len(rendered)


def verify_glyphs(template):
    fonts = {}
    for run in template.runs:
        if not any(char.isascii() and char.isdigit() for char in run.text):
            continue
        if run.font not in fonts:
            fonts[run.font] = embedded_font(template.fonts[run.font][0])
        codes = template.fonts[run.font][2]
        for char in set(run.text).intersection('0123456789'):
            _, glyph = outline(fonts[run.font], codes[char])
            assert glyph.numberOfContours, (template.item['stem'], run.text, char, 'missing printed glyph')


def verify_period(source, output, year_data):
    assert any(str(YEAR) in run.text for run in output.runs), output.item['stem']
    assert all(str(source.item['year']) not in run.text for run in output.runs), output.item['stem']
    verify_glyphs(output)
    month = output.item.get('month')
    holidays = lambda m: {d['day'] for d in year_data['months'][m - 1]['days'] if d['holidays']}
    if month is None:
        return sum(verify_grid(source, output, m, old, new, holidays(m)) for m, (old, new) in enumerate(
            zip(annual_months(source), annual_months(output)), 1))
    first = month_start(output)
    if output.item['design'] == '02':
        days = list(calendar.Calendar().itermonthdates(YEAR, month))
        dates = [d for d in days if d.month == month]
        for i, day in enumerate(dates):
            count, label = output.runs[first + i * 2:first + i * 2 + 2]
            assert (count.text, label.text) == (str(day.day), WEEKDAYS[day.weekday()]), output.item['stem']
        return len(dates)
    if output.item['design'] == '08':
        printed = [r.text for r in output.runs if re.fullmatch(r'\d\d-\d\d', r.text)]
        expected = []
        for week in calendar.monthcalendar(YEAR, month):
            dates = [d for d in week if d]
            expected.append(f'{dates[0]:02}-{dates[-1]:02}')
        assert printed == expected, (output.item['stem'], printed, expected)
    return verify_grid(source, output, month, date_runs(source, month, month_start(source)),
                       date_runs(output, month, first), holidays(month))


def verify_extension():
    extension = json.loads(EVIDENCE.read_text())
    assets = {a['stem']: a for a in json.loads(MANIFEST.read_text())['assets']}
    checked = 0
    for proof in extension['assets']:
        source = Template(assets[proof['source']])
        output = Template(assets[proof['stem']])
        checked += verify_period(source, output, extension['calendar'])
    assert checked == 7300
    print(f'PASS: {checked} printed day placements in all 130 2030 PDF designs, weekday labels, holiday markings and numeric glyphs.')


if __name__ == '__main__':
    verify_extension()
