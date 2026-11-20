import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { importICS } from '../../site/assets/ics.js';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-20T17:00:00Z'));
  await page.addInitScript(() => {
    localStorage.setItem('kalendorius365:analytics-consent:v1', JSON.stringify({
      version: 1, analytics: false, expiresAt: Date.now() + 600_000,
    }));
    window.print = () => { window.__printed = true; };
  });
});

const open = async (page, date = '2027-02-16') => {
  await page.goto('/mano-diena/?data=' + date);
  await expect(page.locator('[data-personal-workspace]')).toHaveAttribute('aria-busy', 'false');
};
const action = (page, name) => page.locator('[data-personal-action="' + name + '"]').first();
const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('kalendorius365:v1')));
const row = (page, title) => page.locator('.personal-task').filter({ hasText: title });

test('the weekly plan links Lithuanian holidays, creates events and saves a separate note for each date', async ({ page }) => {
  await open(page);
  await expect(page.locator('#personal-date')).toHaveValue('2027-02-16');
  await expect(page.locator('[data-personal-days] button')).toHaveCount(7);
  await expect(page.locator('[data-personal-week-number]')).toContainText('7 savaitė');
  await expect(page.locator('[data-personal-agenda]').getByRole('link', { name: 'Lietuvos valstybės atkūrimo diena' })).toBeVisible();
  await action(page, 'add-event').click();
  const eventForm = page.locator('#event-form');
  await expect(eventForm.locator('[name=startDate]')).toHaveValue('2027-02-16');
  await eventForm.locator('[name=title]').fill('Pamokų planavimas');
  await eventForm.locator('[name=repeat]').selectOption('weekly');
  await eventForm.locator('button[type=submit]').click();
  const edit = page.locator('[data-personal-agenda]').getByRole('button', { name: 'Redaguoti įvykį Pamokų planavimas' });
  await expect(edit).toContainText('Kartojasi');
  await expect(page.locator('[data-personal-count=events]')).toHaveText('1');

  const note = page.locator('#daily-note');
  await note.fill('Vasario 16-osios tvarkaraštis.');
  await page.getByRole('button', { name: 'Kita savaitė' }).click();
  await expect(page.locator('#personal-date')).toHaveValue('2027-02-23');
  await expect(edit).toBeVisible();
  await expect(note).toHaveValue('');
  await note.fill('Kitos savaitės užrašas');
  await page.getByRole('button', { name: 'Ankstesnė savaitė' }).click();
  await expect(note).toHaveValue('Vasario 16-osios tvarkaraštis.');
  await page.locator('[data-personal-days] [data-date="2027-02-16"]').press('ArrowRight');
  await expect(page.locator('#personal-date')).toHaveValue('2027-02-17');
  await expect(note).toHaveValue('');
  await expect(page.locator('#current-download')).toHaveAttribute('href', '/2027/vasaris/');
  await page.reload();
  await expect(page.locator('#personal-date')).toHaveValue('2027-02-17');
  await page.getByRole('button', { name: 'Šiandien', exact: true }).click();
  await expect(page.locator('#personal-date')).toHaveValue('2026-11-20');
});

test('task priority, editing, completion, undo and calendar scheduling preserve existing entries', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('kalendorius365:v1')) return;
    localStorage.setItem('kalendorius365:v1', JSON.stringify({
      schema: 1, events: [], notes: {}, preferences: {},
      tasks: [{ id: 'a'.repeat(100), date: '2027-02-15', title: 'Ankstesnė užduotis', done: false }],
    }));
  });
  await open(page);
  await expect(row(page, 'Ankstesnė užduotis')).toContainText('Įprastas');
  const form = page.locator('[data-personal-task-form]');
  await form.locator('[name=title]').fill('Pasiruošti susitikimui');
  await form.locator('[name=priority]').selectOption('high');
  await form.locator('button[type=submit]').click();
  await expect(row(page, 'Pasiruošti susitikimui')).toContainText('Aukštas');
  await expect(page.locator('[data-personal-count=open]')).toHaveText('2');
  await row(page, 'Pasiruošti susitikimui').getByRole('button', { name: /Redaguoti užduotį/ }).click();
  await form.locator('[name=title]').fill('Parengti susitikimo medžiagą');
  await form.locator('button[type=submit]').click();
  const task = row(page, 'Parengti susitikimo medžiagą');
  await task.getByRole('button', { name: /Planuoti laiką/ }).click();
  const eventForm = page.locator('#event-form');
  await expect(eventForm.locator('[name=title]')).toHaveValue('Parengti susitikimo medžiagą');
  await eventForm.locator('button[type=submit]').click();
  await expect(page.locator('[data-personal-agenda]')).toContainText('Parengti susitikimo medžiagą');
  await task.getByRole('button', { name: /Planuoti laiką/ }).click();
  await expect(page.locator('#event-dialog-title')).toHaveText('Redaguoti įvykį');
  await page.locator('#close-event').click();
  await task.getByRole('checkbox').click();
  await expect(page.locator('[data-personal-count=done]')).toHaveText('1');
  await expect(task).toHaveCount(0);
  await page.locator('[data-personal-filter=done]').click();
  await expect(task).toBeVisible();
  await task.getByRole('button', { name: /Pašalinti užduotį/ }).click();
  await expect(task).toHaveCount(0);
  await action(page, 'undo-task').click();
  await expect(task).toBeVisible();
  await expect(page.locator('[data-personal-count=events]')).toHaveText('1');
  await page.reload();
  expect((await state(page)).tasks.find((task) => task.title === 'Parengti susitikimo medžiagą')).toMatchObject({ done: true, priority: 'high' });
  const olderTask = row(page, 'Ankstesnė užduotis').getByRole('button', { name: /Planuoti laiką/ });
  await olderTask.click();
  await eventForm.locator('button[type=submit]').click();
  await olderTask.click();
  await expect(page.locator('#event-dialog-title')).toHaveText('Redaguoti įvykį');
});

test('Lithuanian published dates are selectable, repeat-safe and distinguish personal deadlines', async ({ page }) => {
  await open(page, '2026-11-20');
  const school = page.locator('[data-personal-topic-panel=school]');
  const grade = school.locator('select');
  await expect(school.locator('time[datetime="2027-03-22"]')).toHaveCount(1);
  await grade.selectOption('secondary');
  await expect(school.locator('time[datetime="2027-04-04"]')).toHaveCount(1);
  await expect(school.locator('time[datetime="2027-03-22"]')).toHaveCount(0);
  await action(page, 'add-school').click();
  await expect(school.getByRole('status')).toContainText('4');
  await action(page, 'add-school').click();
  await expect(school.getByRole('status')).toContainText('jau yra');
  const admissions = page.locator('[data-personal-topic-panel=admissions]');
  await expect(admissions).toContainText('2027 m. bendrojo priėmimo datų dar nepatvirtino');
  await admissions.locator('select').selectOption('vocational');
  await expect(admissions.locator('[data-personal-admissions-link]')).toHaveAttribute('href', /mokausi\.lt\/profesinis-mokymas/);
  await action(page, 'admissions-event').click();
  await expect(page.locator('#event-form [name=title]')).toHaveValue('Stojimo į profesinę mokyklą terminas');
  await expect(page.locator('#event-form [name=allDay]')).toBeChecked();
  await page.locator('#close-event').click();
  const payments = page.locator('[data-personal-topic-panel=payments]');
  await payments.locator('select').selectOption('annuity');
  await expect(payments.locator('time')).toHaveAttribute('datetime', '2026-11-26');
  await action(page, 'add-payment').click();
  await action(page, 'add-payment').click();
  const stored = await state(page);
  expect(stored.events).toHaveLength(5);
  expect(stored.events.some((event) => event.end === '2027-04-04' && event.category === 2)).toBe(true);
  expect(stored.events.find((event) => event.id.startsWith('sodra-'))).toMatchObject({ start: '2026-11-26', allDay: true });
  await page.locator('[data-personal-topic][value=payments]').uncheck();
  await page.reload();
  await expect(payments).toBeHidden();
  await expect(grade).toHaveValue('secondary');
});

test('week print, ICS export and JSON restore include the intended records', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('kalendorius365:v1')) return;
    const event = (id, title, date, repeat = 'none') => ({
      id, title, start: date, end: date, repeat, until: '', description: '', category: 0, allDay: true, important: false,
    });
    localStorage.setItem('kalendorius365:v1', JSON.stringify({
      schema: 1, events: [event('series', 'Savaitinis planas', '2027-02-09', 'weekly'), event('future', 'Kito mėnesio planas', '2027-03-05')],
      tasks: [{ id: 'task', title: 'Paruošti užrašus', date: '2027-02-16', done: false }],
      notes: { '2027-02-16': 'Privati savaitės pastaba' }, preferences: {},
    }));
  });
  await open(page);
  const icsPromise = page.waitForEvent('download');
  await action(page, 'week-ics').click();
  const ics = await icsPromise;
  const output = await readFile(await ics.path(), 'utf8');
  const parsed = importICS(output);
  expect(parsed.rejected).toEqual([]);
  expect(parsed.imported.map(({ title, start, repeat }) => ({ title, start, repeat }))).toEqual([
    { title: 'Savaitinis planas', start: '2027-02-16', repeat: 'none' },
  ]);
  expect(output).not.toContain('Privati savaitės pastaba');

  const jsonPromise = page.waitForEvent('download');
  await action(page, 'backup').click();
  const backup = await readFile(await (await jsonPromise).path());
  expect(JSON.parse(backup).notes['2027-02-16']).toBe('Privati savaitės pastaba');
  await action(page, 'print').click();
  expect(await page.evaluate(() => window.__printed)).toBe(true);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.personal-print')).toBeVisible();
  await expect(page.locator('.personal-print')).toContainText('Paruošti užrašus');
  await expect(page.locator('.personal-print')).toContainText('Privati savaitės pastaba');
  await expect(page.locator('.personal-workspace')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });

  await page.locator('.personal-transfer__details summary').click();
  const importChooser = page.waitForEvent('filechooser');
  await action(page, 'import-ics').click();
  await (await importChooser).setFiles({ name: 'copy.ics', mimeType: 'text/calendar', buffer: Buffer.from(output) });
  await expect(page.locator('[data-personal-transfer-status]')).toContainText('Importuota: 1.');
  await action(page, 'delete-data').click();
  await page.locator('#delete-data-dialog').getByRole('button', { name: 'Ištrinti įrašus' }).click();
  expect((await state(page)).events).toEqual([]);
  const restoreChooser = page.waitForEvent('filechooser');
  await action(page, 'restore').click();
  await page.locator('#restore-dialog').getByRole('button', { name: 'Pasirinkti JSON failą' }).click();
  await (await restoreChooser).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
  await expect(page.locator('#daily-note')).toHaveValue('Privati savaitės pastaba');
  expect((await state(page)).events).toHaveLength(2);
});
