import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { addMonths, heating, payroll, pensionDates, socialSupport, unemployment, vatTotal } from '../site/assets/shell/civic.js';

const { rules } = JSON.parse(readFileSync(new URL('../site/_data/civic.json', import.meta.url), 'utf8'));

test('salary models keep NPD, employee deductions and employer costs separate', () => {
  const sample = payroll({ gross: 1153, annual: false, npd: true, pension: true, contract: 'permanent' }, rules.tax);
  assert.deepEqual([sample.allowance, sample.gpm, sample.vsd, sample.psd, sample.retirement],
    [747, 81.2, 144.36, 80.48, 34.59]);
  assert.deepEqual([sample.net, sample.employer, sample.total], [812.37, 20.41, 1173.41]);
  const noNpd = payroll({ gross: 1800, annual: false, npd: false, pension: false, contract: 'fixed' }, rules.tax);
  assert.deepEqual([noNpd.gpm, noNpd.net, noNpd.employer], [360, 1089, 44.82]);
  const phased = payroll({ gross: 1800, annual: false, npd: true, pension: false, contract: 'permanent' }, rules.tax);
  assert.equal(phased.allowance, 429.97);
  assert.equal(phased.net, 1174.99);
});

test('2026 annual GPM is marginal at both brackets and VSD alone uses the ceiling', () => {
  const amounts = gross => payroll({ gross, annual: true, npd: false, pension: false, contract: 'permanent' }, rules.tax);
  assert.equal(amounts(13836).allowance, 8964);
  assert.equal(amounts(83237.4).gpm, 16647.48);
  assert.equal(amounts(83241.4).gpm, 16648.48);
  assert.equal(amounts(138729).gpm, 30520.38);
  assert.equal(amounts(138754).gpm, 30528.38);
  assert.equal(amounts(140000).vsd, amounts(138729).vsd);
  assert.equal(amounts(140000).psd, 9772);
  assert.equal(amounts(140000).employer, null);
});

test('VAT really derives a base from the final amount and preserves cents for both directions', () => {
  assert.deepEqual(vatTotal(121, 21, true), { base: 100, total: 121, vat: 21 });
  assert.deepEqual(vatTotal(100, 12, false), { base: 100, total: 112, vat: 12 });
  assert.deepEqual(vatTotal(19.99, 5, false), { base: 19.99, total: 20.99, vat: 1 });
  assert.deepEqual(vatTotal(19.99, 0, true), { base: 19.99, total: 19.99, vat: 0 });
});

test('retirement dates across year boundaries use the rules for the year of retirement', () => {
  assert.deepEqual(pensionDates('1961-05-31', rules.pension),
    { regular: '2026-05-31', ageMonths: 780, application: '2026-02-28', early: '2021-05-31', necessary: 34.5 });
  assert.deepEqual(pensionDates('1964-02-29', rules.pension),
    { regular: '2029-02-28', ageMonths: 780, application: '2028-11-28', early: '2024-02-28', necessary: 35 });
  assert.equal(pensionDates('1961-01-31', rules.pension, 'male').regular, '2025-11-30');
  assert.equal(pensionDates('1961-01-31', rules.pension, 'female').regular, '2025-09-30');
  assert.equal(pensionDates('1961-03-01', rules.pension, 'male').regular, '2026-03-01');
  assert.equal(pensionDates('1956-02-29', rules.pension, 'male'), null);
  assert.equal(addMonths('2026-05-31', 12), '2027-05-31');
});

test('housing support protects the correct income and is clamped to qualifying cost', () => {
  assert.deepEqual(heating({ members: 1, income: 810, cost: 80 }, rules.support),
    { threshold: 699, personalShare: 11.1, area: 50, compensation: 68.9 });
  assert.deepEqual(heating({ members: 4, income: 1269, cost: 120 }, rules.support),
    { threshold: 1864, personalShare: 0, area: 70, compensation: 120 });
  assert.equal(heating({ members: 2, income: 2000, cost: 50 }, rules.support).compensation, 0);
});

test('social assistance tests the income limit first and weights eligible family members', () => {
  assert.equal(socialSupport({ members: 1, income: 200, duration: 0 }, rules.support).benefit, 126.2);
  assert.equal(socialSupport({ members: 1, income: 256.3, duration: 0 }, rules.support).withinLimit, false);
  assert.equal(socialSupport({ members: 3, income: 600, duration: 0 }, rules.support).benefit, 146.38);
});

test('unemployment phases use the official example and both second-half limits', () => {
  assert.deepEqual(unemployment(1500, rules.job), [847.95, 697.95, 547.95]);
  assert.deepEqual(unemployment(0, rules.job), [370, 370, 370]);
  assert.deepEqual(unemployment(10000, rules.job), [1618.51, 1618.51, 1618.51]);
});
