import { test, expect } from '@playwright/test';

test('year directory loads verified annual PDF and WebP choices from the immutable release', async ({ page }) => {
  const errors = [];
  const dataResponses = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/data/year-print-assets.json')) dataResponses.push(response);
  });

  await page.goto('/metai/');
  await expect(page.locator('[data-year-downloads]')).toHaveCount(3);
  await expect.poll(() => dataResponses.length).toBe(1);
  expect(dataResponses[0].status()).toBe(200);
  expect(new URL(dataResponses[0].url()).pathname).toMatch(/^\/assets\/releases\/[a-f0-9]{20}\/data\/year-print-assets\.json$/);

  for (const year of [2027, 2028, 2029]) {
    const host = page.locator(`[data-year-downloads="${year}"]`);
    await expect(host.locator('details summary')).toContainText('10');
    await host.locator('details summary').click();
    await expect(host.locator('.year-print-list li')).toHaveCount(10);
    await expect(host.locator('.year-print-list a')).toHaveCount(20);
    const hrefs = await host.locator('.year-print-list a').evaluateAll(links => links.map(link => link.getAttribute('href')));
    expect(hrefs.filter(href => href.endsWith('.pdf'))).toHaveLength(10);
    expect(hrefs.filter(href => href.endsWith('.webp'))).toHaveLength(10);
    expect(hrefs.every(href => href.startsWith(`/downloads/metiniai/${year}/`))).toBeTruthy();
  }
  expect(errors).toEqual([]);
});

test('annual previews keep their download panel in the same row until there is room for only one column', async ({ page }) => {
  for (const year of [2027, 2028, 2029]) {
    await page.goto(`/${year}/`, { waitUntil: 'domcontentloaded' });
    const feature = page.locator('.annual-templates__feature');
    for (const width of [390, 1120, 1180]) {
      await page.setViewportSize({ width, height: 844 });
      const layout = await feature.evaluate(region => {
        const preview = region.querySelector('#perziura').getBoundingClientRect();
        const downloads = region.querySelector('.download-panel').getBoundingClientRect();
        const buttons = [...region.querySelectorAll('.download-actions a')].map(link => link.getBoundingClientRect());
        return {
          regionWidth: region.getBoundingClientRect().width,
          aligned: Math.abs(preview.top - downloads.top) <= 1 && preview.right < downloads.left,
          stacked: Math.abs(preview.left - downloads.left) <= 1 && preview.bottom < downloads.top,
          readable: buttons.length === 3 && buttons.every(button => button.width >= 165 && Math.abs(button.height - buttons[0].height) <= 1),
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        };
      });
      const context = `${year} at ${width}px`;
      expect(layout.regionWidth, context).toBeGreaterThan(width === 390 ? 280 : 550);
      expect(width === 390 ? layout.stacked : layout.aligned, context).toBe(true);
      expect(layout.readable, context).toBe(true);
      expect(layout.overflow, context).toBe(false);
    }
  }
});

test('2030 is reachable from the mobile year shortcuts and supports comparison and PDF creation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('kalendorius365:privacy-notice:v1', 'dismissed');
  });
  await page.goto('/metai/');
  const shortcuts = page.getByRole('navigation', { name: 'Pereiti prie metų kortelės' });
  await expect(shortcuts.getByRole('link')).toHaveCount(4);
  await shortcuts.getByRole('link', { name: '2030 m.', exact: true }).click();
  const card = page.locator('#metai-2030');
  await expect(page).toHaveURL(/\/metai\/#metai-2030$/);
  await expect(card.getByRole('heading', { name: '2030' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  const month = page.locator('#year-preview-month');
  await month.selectOption('2');
  await expect(card.locator('[data-year-preview] time')).toHaveCount(28);
  await expect(card.getByRole('link', { name: 'Atverti pasirinktą mėnesį' })).toHaveAttribute('href', '/2030/vasaris/');

  await page.locator('#year-compare-b').selectOption('2030');
  await expect(page.locator('#year-comparison-result').getByRole('heading', { name: /2030/ })).toBeVisible();

  await card.getByRole('link', { name: 'Sukurti 2030 m. PDF' }).click();
  await expect(page.locator('[data-path="period.year"]')).toHaveValue('2030');
  await expect(page.locator('[data-path="period.mode"]')).toHaveValue('annual');
});
