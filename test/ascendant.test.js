import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { BIRTH_CITIES } from '../site/assets/data/birth-cities.js';

// Run the actual browser module with its DOM initialization inactive. Its only
// import supplies city options; none are needed to test numeric formatting.
const source = fs.readFileSync(new URL('../site/assets/ascendant-calculator.js', import.meta.url), 'utf8');
const moduleBody = source.replace(/^import .*;\n/gm, '').replace(/^export \{.*\};\s*$/m, '');
const { resultParts, localTimeToUtc, ascendantLongitude } = vm.runInNewContext(
  `${moduleBody}\n({ resultParts, localTimeToUtc, ascendantLongitude });`,
  { document: { querySelector: () => null }, Intl, Date },
);
const keys = ['avinas', 'jautis', 'dvyniai', 'vezys', 'liutas', 'mergele',
  'svarstykles', 'skorpionas', 'saulys', 'oziaragis', 'vandenis', 'zuvys'];

for (let index = 0; index < keys.length; index++) {
  test(`ascendant sign is stable immediately before, at and after boundary ${index * 30}°`, () => {
    const boundary = index * 30;
    const before = resultParts(boundary - 0.001);
    assert.equal(before.sign.key, keys[(index + 11) % 12]);
    assert.equal(before.degree, 29);
    assert.equal(before.minute, 59);
    const exact = resultParts(boundary);
    assert.equal(exact.sign.key, keys[index]);
    assert.equal(exact.degree, 0);
    assert.equal(exact.minute, 0);
    assert.equal(resultParts(boundary + 0.001).sign.key, keys[index]);
  });
}

test('ascendant display truncation never changes the mathematical sign', () => {
  for (let step = 0; step < 36000; step++) {
    const longitude = step / 100 + 0.00999;
    const result = resultParts(longitude);
    assert.equal(result.sign.key, keys[Math.floor(longitude / 30)]);
    assert.ok(result.degree >= 0 && result.degree < 30);
    assert.ok(result.minute >= 0 && result.minute < 60);
    const displayed = Math.floor(longitude / 30) * 30 + result.degree + result.minute / 60;
    assert.ok(displayed <= longitude + 1e-10);
    assert.ok(longitude - displayed < 1 / 60 + 1e-10);
  }
});

test('ascendant longitude normalizes complete turns without changing sign', () => {
  for (const longitude of [0, 30, 180, 359.999, 360, -0.001, -360, 720]) {
    const normalized = ((longitude % 360) + 360) % 360;
    assert.equal(resultParts(longitude).sign.key, keys[Math.floor(normalized / 30)]);
  }
});

test('ascendant local birth time preserves Vilnius clock-change handling', () => {
  assert.throws(() => localTimeToUtc('2026-03-29', '03:30', 'Europe/Vilnius'), /Dėl laikrodžio persukimo.*tokio laiko nebuvo/);
  const repeated = localTimeToUtc('2026-10-25', '03:30', 'Europe/Vilnius');
  assert.equal(repeated.repeated, true);
  assert.equal(new Date(repeated.instant).toISOString(), '2026-10-25T00:30:00.000Z');
  const ordinary = localTimeToUtc('2000-01-01', '12:00', 'Europe/Vilnius');
  assert.equal(ordinary.repeated, false);
  assert.equal(new Date(ordinary.instant).toISOString(), '2000-01-01T10:00:00.000Z');
});

test('real form inputs cannot cross a sign boundary through display rounding', () => {
  const city = BIRTH_CITIES.find(item => item.name === 'Vilnius');
  const { instant } = localTimeToUtc('2000-01-02', '08:05', city.zone);
  const longitude = ascendantLongitude(instant, city.lat, city.lon);
  assert.ok(longitude > 269.99 && longitude < 270);
  const result = resultParts(longitude);
  assert.equal(result.sign.key, 'saulys');
  assert.equal(result.degree, 29);
  assert.equal(result.minute, 59);
});
