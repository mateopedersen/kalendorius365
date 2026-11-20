import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    localStorage.setItem('kalendorius365:analytics-consent:v1', JSON.stringify({
      version: 1, analytics: false, expiresAt: Date.now() + 600000,
    }));
    window.print = () => { window.printCalls = (window.printCalls || 0) + 1; };
  });
});

test('the Lithuanian garden is discoverable and filters the photos and periods', async ({ page }) => {
  await page.goto('/irankiai/');
  const tool = page.locator('#tool-directory').getByRole('link', { name: /Sėjos kalendorius/ }).first();
  await expect(tool).toHaveAttribute('href', '/sejos-kalendorius/');
  await page.locator('#tools-open').click();
  const menu = page.locator('#tools-dialog');
  await menu.locator('#tools-query').fill('sejos');
  await menu.getByRole('link', { name: /Sėjos kalendorius/ }).click();
  await expect(page).toHaveURL(/\/sejos-kalendorius\/$/);
  const garden = page.locator('[data-garden]');
  await expect(garden).toHaveAttribute('data-ready', 'true');
  await expect(garden.locator('[data-garden-row]:visible')).toHaveCount(21);
  const filters = garden.getByRole('group', { name: 'Sėjos kalendoriaus filtrai' });
  await filters.getByRole('searchbox').fill('obuolys');
  await expect(garden.locator('[data-garden-row="obelys"]')).toBeVisible();
  await expect(garden.locator('[data-garden-row]:visible')).toHaveCount(1);
  await filters.getByRole('searchbox').fill('braskes');
  const row = garden.locator('[data-garden-row="braskes"]');
  await expect(garden.locator('[data-garden-row]:visible')).toHaveCount(1);
  await row.getByRole('button', { name: 'Braškės', exact: true }).click();
  const detail = garden.locator('#darzas-braskes-isamiai');
  await expect(detail).toBeVisible();
  expect(await detail.getByRole('img').evaluate(image => image.decode().then(() => image.naturalWidth))).toBeGreaterThan(300);
  await filters.getByRole('combobox', { name: 'Mėnuo' }).selectOption('3');
  await expect(garden.locator('[data-garden-empty]')).toBeVisible();
  await expect(detail).toBeHidden();
  await filters.getByRole('combobox', { name: 'Mėnuo' }).selectOption('4');
  await filters.getByRole('combobox', { name: 'Darbas', exact: true }).selectOption('plant');
  await filters.getByRole('combobox', { name: 'Auginimo būdas' }).selectOption('greenhouse');
  await expect(garden.locator('[data-garden-empty]')).toBeVisible();
  await filters.getByRole('combobox', { name: 'Auginimo būdas' }).selectOption('outdoor');
  await expect(row).toBeVisible();
  await garden.getByRole('combobox', { name: 'Vietovė arba sąlygos' }).selectOption('southeast');
  await expect(garden.locator('#garden-climate-note')).toContainText('Varėnos');
  await garden.getByRole('button', { name: 'Išvalyti filtrus' }).click();
  await expect(garden.locator('[data-garden-row]:visible')).toHaveCount(21);
  await page.clock.setFixedTime(new Date('2027-03-31T21:05:00Z'));
  await garden.getByRole('button', { name: 'Šis mėnuo' }).click();
  await expect(filters.getByRole('combobox', { name: 'Mėnuo' })).toHaveValue('4');
  await garden.getByRole('button', { name: 'Išvalyti filtrus' }).click();

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    const layout = await garden.evaluate(root => ({
      viewport: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
      right: root.getBoundingClientRect().right,
      table: root.querySelector('.garden-table-scroll').clientWidth,
      tableWidth: root.querySelector('.garden-table').offsetWidth,
    }));
    expect(layout.right).toBeLessThanOrEqual(layout.viewport + 1);
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewport + 1);
    if (width < 768) expect(layout.tableWidth).toBeGreaterThan(layout.table);
  }
});

test('the garden plan saves, edits, exports and reimports a personalized Lithuanian job', async ({ page }) => {
  await page.goto('/sejos-kalendorius/');
  const garden = page.locator('[data-garden]');
  await expect(garden).toHaveAttribute('data-ready', 'true');
  await garden.getByRole('button', { name: 'Įtraukti į mano daržo planą: Braškės' }).click();
  const form = garden.locator('[data-garden-form]');
  await expect(form.getByRole('combobox', { name: 'Augalas' })).toHaveValue('braskes');
  await form.getByRole('combobox', { name: 'Darbas' }).selectOption('plant');
  await form.locator('#garden-plan-date').fill('2027-04-23');
  await form.getByRole('textbox', { name: /Pastaba/ }).fill('Lysvė prie šiltnamio');
  await form.getByRole('button', { name: 'Įtraukti į planą' }).click();
  const list = garden.locator('[data-garden-list]');
  await expect(list.locator('li')).toHaveCount(1);
  await list.getByRole('checkbox').check();
  await garden.getByRole('checkbox', { name: /Pasirinkau augalą/ }).check();
  await page.reload();
  await expect(list.getByRole('checkbox')).toBeChecked();
  await expect(garden.getByRole('checkbox', { name: /Pasirinkau augalą/ })).toBeChecked();
  await list.getByRole('button', { name: /Redaguoti/ }).click();
  await form.locator('#garden-plan-date').fill('2027-04-24');
  await form.getByRole('button', { name: 'Išsaugoti pakeitimus' }).click();
  await expect(list.locator('time')).toHaveAttribute('datetime', '2027-04-24');
  await expect(list.getByRole('checkbox')).toBeChecked();

  async function download(name) {
    const [file] = await Promise.all([page.waitForEvent('download'), garden.getByRole('button', { name }).click()]);
    return { name: file.suggestedFilename(), bytes: await readFile(await file.path()) };
  }

  const calendar = await download('Atsisiųsti ICS');
  expect(calendar.name).toBe('mano-darzas.ics');
  expect(calendar.bytes.toString()).toContain('DTSTART;VALUE=DATE:20270424');
  expect(calendar.bytes.toString()).toContain('DTEND;VALUE=DATE:20270425');
  expect(calendar.bytes.toString()).toContain('SUMMARY:Braškės');
  const backup = await download('Išsaugoti JSON');
  expect(JSON.parse(backup.bytes).entries[0].note).toBe('Lysvė prie šiltnamio');
  await garden.getByRole('button', { name: /Spausdinti/ }).click();
  expect(await page.evaluate(() => window.printCalls)).toBe(1);
  await page.emulateMedia({ media: 'print' });
  await expect(list).toBeVisible();
  await expect(garden.locator('.garden-hero')).toBeHidden();
  await expect(form).toBeHidden();
  await page.emulateMedia({ media: 'screen' });

  await list.getByRole('button', { name: /Pašalinti/ }).click();
  await expect(list.locator('li')).toHaveCount(0);
  const input = garden.locator('[data-garden-import]');
  await input.setInputFiles({ name: backup.name, mimeType: 'application/json', buffer: backup.bytes });
  await expect(list.locator('time')).toHaveAttribute('datetime', '2027-04-24');
  await input.setInputFiles({ name: backup.name, mimeType: 'application/json', buffer: backup.bytes });
  await expect(list.locator('li')).toHaveCount(1);
});

test('the source table and text remain usable with scripting disabled', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await page.goto('/sejos-kalendorius/');
    await expect(page.locator('[data-garden-row]:visible')).toHaveCount(21);
    await page.getByText('Visi laikotarpiai tekstu').click();
    await expect(page.locator('.garden-reference')).toContainText('Uogų skynimas');
    await expect(page.locator('[data-garden-save]')).toBeDisabled();
  } finally {
    await context.close();
  }
});
