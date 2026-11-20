"""Prepare the 2030 screen calendar without changing preflighted print assets."""
import json
import math
import subprocess

from PIL import Image

from core import ROOT, write_json


def calculate_days():
    source = """
import { lunarState, noonInVilnius } from './site/assets/lunar/lunar-engine.js';
const dates = Array.from({length: 365}, (_, index) => new Date(Date.UTC(2030, 0, index + 1)));
console.log(JSON.stringify(dates.map(date => {
  const day = date.toISOString().slice(0, 10);
  const instant = noonInVilnius(day);
  const state = lunarState(instant);
  return {
    date_local: day, weekday: (date.getUTCDay() + 6) % 7,
    sampled_instant_utc: instant.toISOString().replace('.000Z', 'Z'),
    illumination_fraction: state.illumination, phase_angle_deg: state.phaseAngle,
    elongation_deg: state.elongation, waxing_or_waning: state.waxing ? 'waxing' : 'waning',
    phase_label_lt: state.label
  };
})));
"""
    return json.loads(subprocess.check_output(
        ['node', '--input-type=module', '-e', source], cwd=ROOT, text=True,
    ))


def render_days(rows):
    size = 128
    lunar_assets = ROOT / 'site/assets/lunar'
    texture = Image.open(lunar_assets / 'albedo.png').convert('RGBA')
    texels = texture.resize((size, size), Image.Resampling.LANCZOS).getdata()
    points = []
    for index, color in enumerate(texels):
        x = (index % size + .5) / size * 2 - 1
        y = (index // size + .5) / size * 2 - 1
        points.append((color, x, math.sqrt(max(0, 1 - x*x - y*y))))
    for row in rows:
        angle = math.radians(row['phase_angle_deg'])
        sideways = math.sin(angle) * (1 if row['waxing_or_waning'] == 'waxing' else -1)
        forward = math.cos(angle)
        pixels = []
        # Use the same projection and reflectance as the existing print renderer.
        for (red, green, blue, alpha), x, z in points:
            lit = max(0, x * sideways + z * forward)
            value = min(1, 1.85 * lit / (lit + z + 1e-6)) * (.92 + .08 * z)
            light = .012 + value * .988
            pixels.append((int(red * light), int(green * light), int(blue * light), alpha))
        image = Image.new('RGBA', (size, size))
        image.putdata(pixels)
        image.save(lunar_assets / 'days' / (row['date_local'] + '.webp'), 'WEBP', quality=86, method=4)


if __name__ == '__main__':
    records = calculate_days()
    render_days(records)
    write_json(ROOT / 'data/lunar/calendar-2030.json', records)
