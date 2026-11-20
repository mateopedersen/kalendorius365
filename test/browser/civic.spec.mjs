import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const hub = '/ismokos/';
const retirement = '/pensijos/';
const taxes = '/mokesciu-skaiciuokle/';
const benefits = [
  'vaiko-pinigai', 'vienkartine-ismoka-vaikui', 'vaiko-prieziuros-ismoka',
  'motinystes-ir-tevystes-ismokos', 'aukles-kompensacija', 'nedarbo-ismoka',
  'ligos-ismoka', 'socialine-pasalpa', 'sildymo-kompensacija',
];
const routes = [hub, retirement, taxes, ...benefits.map(slug => hub + slug + '/')];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kalendorius365:analytics-consent:v1', JSON.stringify({
    version: 1, analytics: false, expiresAt: Date.now() + 3600000,
  })));
});

test('all Lithuanian benefits routes are responsive and in the sitemap and tools menu', async ({ page }) => {
  const sitemap = await (await page.request.get('/sitemap.xml')).text();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const route of routes) {
    expect(sitemap).toContain('<loc>https://kalendorius365.lt' + route + '</loc>');
    expect((await page.goto(route)).status()).toBe(200);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('main [data-civic] fieldset')).not.toHaveCount(0);
    await expect(page.locator('main [data-civic] fieldset').first()).toBeEnabled();
    await expect(page.locator('.civic-ticket img')).toHaveJSProperty('complete', true);
    expect(await page.locator('.civic-ticket img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width + 1);
    const sourceLinks = await page.locator('#saltiniai a, #kita-parama a, #prasymas .civic-button').evaluateAll(links =>
      links.map(link => [link.getAttribute('href'), link.textContent.trim()]));
    expect(sourceLinks.length).toBeGreaterThan(1);
    expect(sourceLinks.every(([href, label]) => href?.startsWith('https://') && label)).toBe(true);
  }
  expect(errors).toEqual([]);
  await page.locator('#tools-open').click();
  await page.locator('[data-menu-group="finances"]').click();
  await expect(page.locator('[data-menu-section="finances"] [data-menu-tool]')).toHaveCount(12);
  await page.locator('#tools-query').fill('npd');
  await expect(page.locator('#tools-results a[href="' + taxes + '"]')).toBeVisible();
  await page.goto('/irankiai/');
  await page.locator('[data-tool-filter="finances"]').click();
  await expect(page.locator('[data-tool-category="finances"]:visible')).toHaveCount(12);
});

test('VMI monthly NPD, annual tiers, and extracting VAT change the calculated amounts', async ({ page }) => {
  await page.goto(taxes);
  const pay = page.locator('#skaiciuoti');
  await expect(pay.locator('[data-result-value]')).toContainText(/1\s174,99/);
  await pay.locator('[name="npd"]').uncheck();
  await expect(pay.locator('[data-result-value]')).toContainText(/1\s089,00/);
  await pay.locator('[name="pension"]').check();
  await expect(pay.locator('[data-result-value]')).toContainText(/1\s035,00/);
  await pay.locator('[name="period"]').selectOption('year');
  await pay.locator('[name="gross"]').fill('138754');
  await expect(pay.locator('[data-result-rows]')).toContainText(/30\s528,38/);
  await expect(pay.locator('[data-npd-choice]')).toBeHidden();
  const vat = page.locator('#pvm');
  await vat.locator('[name="direction"]').selectOption('extract');
  await vat.locator('[name="amount"]').fill('121');
  await expect(vat.locator('[data-result-value]')).toContainText('21,00');
  await expect(vat.locator('[data-result-rows]')).toContainText('100,00');
});

test('pension dates use the transition table and export a private reminder for a future date', async ({ page }) => {
  await page.goto(retirement);
  const form = page.locator('[data-calc="pension"]');
  const output = page.locator('#skaiciuoti [data-result-value]');
  await form.locator('[name="birth"]').fill('1961-01-31');
  await form.locator('[name="sex"]').selectOption('female');
  await expect(output).toContainText('2025 m. rugsėjo 30 d.');
  await form.locator('[name="sex"]').selectOption('male');
  await expect(output).toContainText('2025 m. lapkričio 30 d.');
  await form.locator('[name="birth"]').fill('1980-10-15');
  await form.locator('[name="insurance"]').fill('34.5');
  await expect(output).toContainText('2045 m. spalio 15 d.');
  await expect(page.locator('#skaiciuoti [data-result-rows]')).toContainText('0,5 m.');
  const pending = page.waitForEvent('download');
  await page.locator('[data-pension-download]').click();
  const file = await pending;
  const ics = await readFile(await file.path(), 'utf8');
  expect(ics).toContain('DTSTART;VALUE=DATE:20450715');
  expect(ics).toContain('BEGIN:VALARM');
});

test('benefit filters, date boundaries and local reminders work', async ({ page }) => {
  await page.goto(hub);
  await page.getByRole('button', { name: 'Pajamos ir būstas', exact: true }).click();
  await expect(page.locator('[data-benefit-cards] a:visible')).toHaveCount(2);
  const form = page.locator('[data-civic-reminders]');
  await form.locator('[name="label"]').fill('Patikrinti mokėjimą');
  await form.locator('[name="date"]').fill('2027-01-11');
  await form.getByRole('button', {name: 'Išsaugoti priminimą'}).click();
  await expect(page.locator('[data-reminder-list]')).toContainText('Patikrinti mokėjimą');
  await page.reload();
  await expect(page.locator('[data-reminder-list] time')).toHaveAttribute('datetime', '2027-01-11');
  const exported = page.waitForEvent('download');
  await page.locator('[data-reminder-download]').click();
  const file = await exported;
  const ics = await readFile(await file.path(), 'utf8');
  expect(ics).toContain('DTSTART;VALUE=DATE:20270111');
  expect(ics).toContain('TRIGGER;VALUE=DATE-TIME:20270111T070000Z');
  await page.getByRole('button', {name: /Pašalinti: Patikrinti/}).click();
  await expect(page.locator('[data-reminder-download]')).toBeDisabled();

  await page.goto(hub + 'vienkartine-ismoka-vaikui/');
  const birth = page.locator('[data-calc="birth"] [name="birth"]');
  await birth.fill('2026-05-31');
  await expect(page.locator('[data-result-value]')).toContainText('814,00');
  await birth.fill('2026-06-01');
  await expect(page.locator('[data-result-value]')).toContainText(/1\s036,00/);

  await page.goto(hub + 'sildymo-kompensacija/');
  await expect(page.locator('[data-result-value]')).toContainText('68,90');
  await page.locator('[name="members"]').fill('4');
  await expect(page.locator('[data-result-rows]')).toContainText('70 m²');
  await expect(page.locator('[data-result-value]')).toContainText('80,00');

  await page.goto(hub + 'nedarbo-ismoka/');
  await expect(page.locator('[data-result-value]')).toContainText('847,95');
  await page.locator('[name="insurance"]').fill('11');
  await expect(page.locator('[data-result-value]')).toHaveText('Trūksta draudimo stažo');
});

test('child, care, illness and household estimates react to the supplied inputs', async ({ page }) => {
  const value = page.locator('[data-result-value]');
  await page.goto(hub + 'vaiko-pinigai/');
  await page.locator('[name="children"]').fill('2');
  await page.locator('[name="eligible"]').fill('1');
  await expect(value).toContainText('335,22');
  await page.locator('[name="eligible"]').fill('3');
  await expect(value).toHaveText('Per daug papildomų gavėjų');

  await page.goto(hub + 'vaiko-prieziuros-ismoka/');
  await page.locator('[name="income"]').fill('2000');
  await expect(value).toContainText(/1\s560,00/);
  await expect(page.locator('[data-result-rows]')).toContainText('900,00');
  await expect(page.locator('[data-result-rows]')).toContainText('600,00');

  await page.goto(hub + 'motinystes-ir-tevystes-ismokos/');
  await expect(value).toContainText('65,94');
  await page.goto(hub + 'aukles-kompensacija/');
  await page.locator('[name="children"]').fill('2');
  await expect(value).toContainText('769,60');

  await page.goto(hub + 'ligos-ismoka/');
  await page.locator('[name="days"]').fill('2');
  await expect(value).toContainText('83,34');

  await page.goto(hub + 'socialine-pasalpa/');
  await expect(value).toContainText('126,20');
  await page.locator('[name="duration"]').selectOption('2');
  await expect(value).toContainText('56,30');
  await page.locator('[name="income"]').fill('256.30');
  await expect(value).toContainText('0,00');
});
