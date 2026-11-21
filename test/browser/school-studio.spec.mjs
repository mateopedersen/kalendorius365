import { test, expect } from '@playwright/test';

test('school studio fills new periods, updates a printable template and restores its choices', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('kalendorius365:privacy-notice:v1', 'dismissed');
    window.print = () => { window.didPrintSchedule = true; };
  });
  await page.goto('/pamoku-tvarkarastis/');
  await page.locator('[data-school-day="1"]').click();
  await expect(page.locator('#lesson-add-day')).toHaveValue('1');
  await page.locator('#lesson-add').click();
  await page.getByLabel('Antradienis, 1 pamoka: dalykas', { exact: true }).fill('Matematika');
  await page.getByLabel('Antradienis, 1 pamoka: kabinetas', { exact: true }).fill('205A');
  await page.getByLabel('Antradienis, 1 pamoka: mokytojo trumpinys', { exact: true }).fill('R. J.');
  for (const template of ['regular', 'large', 'compact', 'mono']) {
    await page.locator(`[data-school-template="${template}"]`).click();
    await expect(page.locator('#school-sheet')).toHaveAttribute('data-template', template);
    await expect(page.locator('#school-sheet-rows')).toContainText('Matematika');
    await expect(page.locator('#school-sheet-rows')).toContainText('205A · R. J.');
  }

  await page.locator('#school-slots-open').click();
  await page.locator('#school-slot-count').fill('2');
  await page.locator('#school-slot-start').fill('08:20');
  await page.locator('#school-slots-form button[type="submit"]').click();
  await expect(page.locator('#school-slots-dialog')).toBeHidden();
  await expect(page.getByLabel('Antradienis, 1 pamoka: pradžia', { exact: true })).toHaveValue('08:20');
  await expect(page.getByLabel('Antradienis, 2 pamoka: pradžia', { exact: true })).toHaveValue('09:15');
  await expect(page.locator('#school-sheet-rows')).toContainText('205A');

  await page.locator('#school-title').fill('Mano antroji savaitė');
  await page.locator('[data-school-template="large"]').click();
  await expect(page.locator('#school-template')).toHaveValue('large');
  await expect(page.locator('#school-sheet-tasks')).toBeVisible();
  await page.locator('#homework-subject').fill('Matematika');
  await page.locator('#homework-task').fill('Išspręsti du uždavinius');
  await page.locator('#homework-due').fill('2028-02-29');
  await page.locator('#homework-form button').click();
  await expect(page.locator('#school-sheet-tasks')).toContainText('Išspręsti du uždavinius');
  await page.locator('#school-print').click();
  expect(await page.evaluate(() => window.didPrintSchedule)).toBe(true);

  await page.reload();
  await expect(page.locator('#school-sheet-title')).toHaveText('Mano antroji savaitė');
  await expect(page.locator('[data-school-template="large"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#school-sheet-rows')).toContainText('08:20–09:05');
  if (page.viewportSize().width <= 610) {
    await page.locator('.school-preview-jump').click();
    await expect(page).toHaveURL(/#school-print-preview$/);
    const overflow = await page.locator('.school-sheet-mat').evaluate(region => ({
      fitsScreen: document.documentElement.scrollWidth <= window.innerWidth,
      canScroll: region.scrollWidth > region.clientWidth,
    }));
    expect(overflow).toEqual({ fitsScreen: true, canScroll: true });
  }
  await expect(page.locator('#school-sheet-tasks')).toContainText('Išspręsti du uždavinius');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#school-sheet')).toBeVisible();
  await expect(page.locator('.school-hero')).toBeHidden();
  await expect(page.locator('#school-planner')).toBeHidden();
});

test('school studio backup retains Saturday lessons when the display shows five weekdays', async ({ page }) => {
  await page.goto('/pamoku-tvarkarastis/');
  await page.locator('#school-days').selectOption('6');
  await page.locator('[data-school-day="5"]').click();
  await page.locator('#lesson-add').click();
  await page.getByLabel('Šeštadienis, 1 pamoka: dalykas', { exact: true }).fill('Dailė');
  await page.locator('#school-days').selectOption('5');
  await expect(page.locator('[data-school-day="5"]')).toBeHidden();
  const backup = await page.evaluate(() => localStorage.getItem('k365:phase568:school:v1'));
  await page.locator('#school-json-import').setInputFiles({ name:'tvarkarastis.json', mimeType:'application/json', buffer: Buffer.from(backup) });
  await expect(page.locator('#school-message')).toHaveText('Atsarginė kopija atkurta.');
  await page.locator('#school-days').selectOption('6');
  await expect(page.locator('#school-sheet-rows')).toContainText('Dailė');
});
