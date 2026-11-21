import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    localStorage.setItem('kalendorius365:analytics-consent:v1', JSON.stringify({
      version: 1, analytics: false, expiresAt: Date.now() + 600000,
    }));
    window.print = () => { window.printCalls = (window.printCalls || 0) + 1; };
  });
});

test('a yearly date opens its day plan and keeps a saved note on reload', async ({ page }) => {
  await page.goto('/2029/');
  await page.getByRole('link', { name: 'Peržiūrėti metų datas' }).click();
  await expect(page).toHaveURL(/#metu-apzvalga$/);
  await expect(page.locator('.annual-overview a.calendar-holiday-date time[datetime="2029-02-16"]')).toHaveCount(1);
  const ordinary = page.locator('.annual-overview .calendar-plan-date').first();
  const date = await ordinary.locator('time').getAttribute('datetime');
  await ordinary.click();
  await expect(page).toHaveURL(new RegExp(`/mano-diena/\\?data=${date}$`));
  await expect(page.locator('[data-personal-workspace]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#personal-date')).toHaveValue(date);
  await expect(page.locator(`[data-personal-days] [data-date="${date}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#current-download')).toHaveAttribute('href', /^\/2029\//);
  await page.locator('#daily-note').fill('Patikrintas dienos planas');
  await page.locator('#save-note').click();
  await page.reload();
  await expect(page.locator('#daily-note')).toHaveValue('Patikrintas dienos planas');
});

test('the annual template picker stays ready when calendar data is unavailable', async ({ page }) => {
  await page.route('**/data/calendar.json', (route) => route.abort());
  await page.goto('/2029/');
  const picker = page.locator('#design-picker');
  await expect(picker).toHaveAttribute('aria-busy', 'false');
  const preview = page.locator('#selected-preview');
  const initialPreview = await preview.getAttribute('srcset');
  expect(initialPreview).toMatch(/\/assets\/previews-detail\/2029-/);
  const download = page.locator('#selected-pdf');
  const initial = await download.getAttribute('href');
  await picker.selectOption({ index: 1 });
  await expect(download).not.toHaveAttribute('href', initial);
  await expect(preview).not.toHaveAttribute('srcset', initialPreview);
  await expect.poll(() => preview.evaluate(image => image.currentSrc)).toMatch(/\/assets\/previews-detail\/2029-/);
  const response = await page.request.get(await download.getAttribute('href'));
  expect(response.ok()).toBe(true);
  expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('December opens January across 2029 and 2030, and the 2030 print controls select their calendars', async ({ page }) => {
  await page.goto('/2029/gruodis/');
  await page.locator('.month-heading').getByRole('link', { name: 'Kitas ›' }).click();
  await expect(page).toHaveURL(/\/2030\/sausis\/$/);
  await expect(page.locator('.month-overview .calendar-plan-date').first()).toHaveAttribute('href', /\/mano-diena\/\?data=2030-01-/);
  await expect(page.locator('#design-picker option')).toHaveCount(10);
  await expect(page.locator('#selected-print')).toHaveAttribute('href', /\/downloads\/.*\/2030\/.*\.pdf/);
  await page.goto('/2030/');
  await page.getByRole('button', { name: 'Spausdinti metų apžvalgą' }).click();
  expect(await page.evaluate(() => window.printCalls)).toBe(1);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('[data-print-root="annual"] .static-month')).toHaveCount(12);
  await expect(page.locator('[data-print-root="annual"]')).toBeVisible();
  await expect(page.locator('#metiniai-sablonai')).toBeHidden();
});

test('the PDF catalogue aligns all year cards and links to each month with distinct year illustrations', async ({ page }) => {
  await page.goto('/pdf-kalendoriai/');
  const cards = page.locator('.calendar-year-card');
  await expect(cards).toHaveCount(4);
  for (const year of [2027, 2028, 2029, 2030]) {
    const card = cards.filter({ has: page.getByRole('heading', {name: `${year} Metai`}) });
    await expect(card.locator('img')).toHaveAttribute('src', new RegExp(`/year-${year}\\.svg`));
    await expect(card.locator('nav a')).toHaveCount(12);
    const action = card.getByRole('link', { name: `Atverti metų kalendorių (${year})` });
    await expect(action).toHaveText('Atverti metų kalendorių');
    await expect(action).toHaveAttribute('href', `/${year}/#metiniai-sablonai`);
    expect(await card.locator('img').evaluate((image) => image.decode().then(() => image.naturalWidth))).toBeGreaterThan(0);
  }
  for (const width of [320, 780, 1286]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await cards.evaluateAll((items) => items.map((item) => ({
      height: item.getBoundingClientRect().height,
      button: item.querySelector('.calendar-year-card__actions a').getBoundingClientRect().height,
      fits: item.scrollWidth <= item.clientWidth + 1,
    })));
    expect(dimensions.every(({ height, button, fits }) => fits && height === dimensions[0].height && button === dimensions[0].button)).toBe(true);
    const styles = await cards.locator('.calendar-year-card__actions a').evaluateAll((actions) =>
      actions.map((action) => {
        const { color, backgroundColor, font, borderColor } = getComputedStyle(action);
        return { color, backgroundColor, font, borderColor };
      }),
    );
    expect(styles).toEqual(Array(4).fill(styles[0]));
  }
  const leapYear = cards.filter({ has: page.getByRole('heading', {name: '2028 Metai'}) });
  await leapYear.locator('summary').click();
  await leapYear.getByRole('link', {name: 'Vasaris'}).click();
  await expect(page).toHaveURL(/\/2028\/vasaris\/$/);
  await expect(page.locator('.calendar-period-art')).toHaveAttribute('src', /2028-vasaris\.svg/);
});

test('the PDF catalogue downloads the chosen monthly design and downloads the matching 2030 design', async ({ page }) => {
  await page.goto('/pdf-kalendoriai/');
  const picker = page.locator('[data-print-finder]');
  await expect(picker.locator('[data-print-design] option')).toHaveCount(10);
  const initial = await picker.locator('[data-print-pdf]').getAttribute('href');
  await picker.locator('[data-print-year]').selectOption('2029');
  await picker.locator('[data-print-period]').selectOption('2');
  await picker.locator('[data-print-design]').selectOption('02');
  await expect(picker.locator('[data-print-collection]')).toHaveAttribute('href', '/2029/vasaris/#perziura');
  const pdf = await picker.locator('[data-print-pdf]').getAttribute('href');
  const webp = await picker.locator('[data-print-webp]').getAttribute('href');
  expect(pdf).not.toBe(initial);
  await expect(picker.locator('[data-print-open]')).toHaveAttribute('href', pdf);
  const [pdfResponse, imageResponse] = await Promise.all([page.request.get(pdf), page.request.get(webp)]);
  expect(pdfResponse.ok()).toBe(true);
  expect(imageResponse.ok()).toBe(true);
  expect((await pdfResponse.body()).subarray(0, 5).toString()).toBe('%PDF-');
  expect((await imageResponse.body()).subarray(8, 12).toString()).toBe('WEBP');
  await picker.locator('[data-print-year]').selectOption('2030');
  await expect(picker.locator('[data-print-result]')).toBeVisible();
  await expect(picker.locator('[data-print-design]')).toHaveValue('02');
  await expect(picker.locator('[data-print-collection]')).toHaveAttribute('href', '/2030/vasaris/#perziura');
  const pdf2030 = await picker.locator('[data-print-pdf]').getAttribute('href');
  expect(pdf2030).toMatch(/\/2030\//);
  const response2030 = await page.request.get(pdf2030);
  expect(response2030.ok()).toBe(true);
  expect((await response2030.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('the events catalogue filters accentless searches by city and announcement status', async ({ page }) => {
  await page.goto('/renginiai/');
  const finder = page.locator('[data-event-finder]');
  const query = finder.getByRole('searchbox');
  await query.fill('juros svente');
  await finder.locator('[name="city"]').selectOption('Klaipėda');
  await finder.locator('[name="status"]').selectOption('confirmed');
  await expect(page.locator('.local-date-card:visible')).toHaveCount(1);
  await expect(page.locator('.local-date-card:visible a')).toHaveAttribute('href', '/renginiai/juros-svente/');
  await finder.locator('[name="status"]').selectOption('waiting');
  await expect(finder.locator('[role="status"]')).toContainText('Renginių nerasta');
  await expect(page.locator('.local-date-card:visible')).toHaveCount(0);
  await finder.getByRole('button', { name: 'Valyti filtrus' }).click();
  await expect(page.locator('.local-date-card:visible')).toHaveCount(16);
  await page.locator('.local-date-card a[href="/renginiai/juros-svente/"]').click();
  await expect(page.locator('.occasion-calendar__services a')).toHaveCount(3);
  await expect(page.locator('[data-occasion-save]')).toBeVisible();
});

test('calendar pages leave room for menus, dates and actions at tablet widths', async ({ page }) => {
  for (const [route, width] of [['/2029/', 768], ['/2029/', 1024], ['/2030/vasaris/', 768], ['/2030/vasaris/', 1024]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(route);
    await expect(page.locator('#main h1')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const layout = await page.evaluate(() => ({
      horizontalScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      clipped: [...document.querySelectorAll('.calendar-bar__actions a, #main h1, .calendar-period-heading .toolbar-group > *, .calendar-plan-date')]
        .filter(element => element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 2)
        .map(element => element.textContent.trim()),
    }));

    expect(layout.horizontalScroll, route + ' at ' + width).toBeLessThanOrEqual(1);
    expect(layout.clipped, route + ' at ' + width).toEqual([]);
  }
});

test('leap year and year-day tools update the visible results for quick and manual inputs', async ({ page }) => {
  await page.goto('/keliamieji-metai/');
  const leapResult = page.locator('[data-leap-year] output');
  await expect(leapResult.locator('[data-result-value]')).toHaveText(/36[56] dienos/);
  for (const [year, days, february, next] of [[2028, 366, 29, 2032], [2100, 365, 28, 2104], [2400, 366, 29, 2404]]) {
    await page.getByRole('button', { name: String(year), exact: true }).click();
    await expect(leapResult.locator('[data-result-value]')).toHaveText(days + ' dienos');
    await expect(leapResult.locator('[data-february-days]')).toHaveText(String(february));
    await expect(leapResult.locator('[data-next-leap]')).toHaveText(next + ' m.');
  }
  await page.locator('#leap-year').fill('1900');
  await page.getByRole('button', { name: 'Patikrinti metus' }).click();
  await expect(leapResult.locator('[data-february-days]')).toHaveText('28');

  await page.goto('/metu-diena/');
  const day = page.locator('#year-day-date');
  const dayResult = page.locator('[data-year-day] output');
  await day.fill('2028-02-29');
  await page.getByRole('button', { name: 'Skaičiuoti' }).click();
  await expect(dayResult.locator('[data-result-value]')).toHaveText('60-oji metų diena');
  await expect(dayResult.locator('[data-year-days-left]')).toHaveText('306');
  await expect(dayResult.locator('[data-year-week]')).toHaveText('2028-W09');
  await page.getByRole('button', { name: 'Gruodžio 31 d.' }).click();
  await expect(day).toHaveValue('2028-12-31');
  await expect(dayResult.locator('[data-result-value]')).toHaveText('366-oji metų diena');
  await expect(dayResult.locator('[data-year-days-left]')).toHaveText('0');
});

test('month guides link to the matching year and month without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    for (const year of [2029, 2030]) {
      const month = `/${year}/kovas/`;
      const holidays = `/sventes${month}`;
      const lunar = `/menulio-kalendorius${month}`;
      await page.goto(new URL(month, baseURL).href);
      await expect(page.locator('.month-sidebar a[href="/darbo-dienos/' + year + '/"]')).toHaveText(year + ' m. darbo dienos');
      await expect(page.getByRole('link', { name: year + ' m. darbo kalendoriuje' })).toHaveAttribute('href', '/darbo-dienos/' + year + '/');
      await expect(page.getByRole('link', { name: 'kovo švenčių ir minėjimų gide' })).toHaveAttribute('href', holidays);
      await expect(page.getByRole('link', { name: 'kovo vardadieniai' })).toHaveAttribute('href', '/vardadieniai/kovas/');
      await page.getByRole('link', { name: 'kovo Mėnulio kalendorius' }).click();
      await expect(page).toHaveURL(new URL(lunar, baseURL).href);
      await page.locator('.lunar-related').getByRole('link', { name: 'Kovo kalendorius su Lietuvos šventėmis' }).click();
      await expect(page).toHaveURL(new URL(month, baseURL).href);
      await page.getByRole('link', { name: 'kovo švenčių ir minėjimų gide' }).click();
      await expect(page).toHaveURL(new URL(holidays, baseURL).href);
      await expect(page.locator('.mh-planning a').first()).toHaveAttribute('href', '/vardadieniai/kovas/');
      await expect(page.locator('.mh-planning .mh-actions a').first()).toHaveAttribute('href', month);
    }
  } finally {
    await context.close();
  }
});
