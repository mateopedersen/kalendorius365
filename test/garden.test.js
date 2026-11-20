import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterPeriods, validatePlan } from '../site/assets/shell/garden.js';

test('garden filters apply the month, task and growing location to the same period', () => {
  const periods = [
    { stage: 'sow', place: 'seedlings', months: [3] },
    { stage: 'plant', place: 'greenhouse', months: [5] },
    { stage: 'plant', place: 'outdoor', months: [5, 6] },
  ];
  assert.deepEqual(filterPeriods(periods, { month: 0, stage: '', place: '' }), periods);
  assert.deepEqual(filterPeriods(periods, { month: 3, stage: 'plant', place: 'seedlings' }), []);
  assert.deepEqual(filterPeriods(periods, { month: 6, stage: 'plant', place: 'greenhouse' }), []);
  assert.deepEqual(filterPeriods(periods, { month: 6, stage: 'plant', place: 'outdoor' }), [periods[2]]);
});

test('garden backups validate actual dates and reject incompatible or duplicate entries', () => {
  const plants = new Set(['pomidorai', 'braskes']);
  const tasks = new Set(['sow', 'plant', 'harvest']);
  const entry = { id:'garden-1', plant:'pomidorai', task:'sow', date:'2028-02-29', note:'Lysvė Nr. 2', done:true };
  const check = entries => validatePlan({ version: 1, entries }, plants, tasks);
  assert.deepEqual(check([entry]), [entry]);
  for (const invalid of [
    { date: '2027-02-29' }, { date: '2101-01-01' }, { plant: 'not-a-plant' },
    { task: 'not-a-task' }, { note: 'ą'.repeat(181) }, { done: 'true' },
  ]) assert.throws(() => check([{ ...entry, ...invalid }]));
  assert.throws(() => check([entry, entry]));
});
