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
