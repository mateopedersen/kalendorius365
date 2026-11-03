import {test,expect} from '@playwright/test';
test.beforeEach(async({context})=>{
 await context.addInitScript(()=>localStorage.setItem('kalendorius365:privacy-notice:v1','dismissed'));
});

// Regression: the comparison had no matching ID and remained dashes; the hero
// and date-checker fallback also displayed2027 on the2028/2029 routes.
test('workday totals and year-specific examples are correct without JavaScript',async({browser,baseURL})=>{
 const context=await browser.newContext({javaScriptEnabled:false});
 const page=await context.newPage();
 for(const [year,days,hours,weekday]of [[2027,252,2009,'pirmadienis'],[2028,251,2002,'antradienis'],[2029,250,1994,'ketvirtadienis']]){
  await page.goto(`${baseURL}/darbo-dienos/${year}/`);
  await expect(page.locator('[data-work-compare="5"] [data-work-days]')).toHaveText(String(days));
  await expect(page.locator('[data-work-compare="5"] [data-work-hours]')).toHaveText(String(hours));
  await expect(page.locator('[data-workday-detail]')).toContainText(`${year} m. sausio 4 d. · ${weekday}`);
  const image=page.locator('.workyear-hero__art img');
  await expect(image).toHaveAttribute('src',new RegExp(`workday-year-${year}\\.svg`));
  const response=await page.request.get(await image.getAttribute('src'));
  expect(response.status()).toBe(200);const svg=await response.text();
  expect(svg).toContain(`Sausis ${year}`);expect(svg).toContain(`>${days}</text>`);
 }
 await context.close();
});

test('workday comparison initializes and stays consistent when the schedule changes',async({page})=>{
 await page.goto('/darbo-dienos/2028/',{waitUntil:'networkidle'});
 await expect(page.locator('#workday-check-form')).toHaveAttribute('aria-busy','false');
 await expect(page.locator('#workday-compare-delta')).toContainText('mažiau');
 await page.locator('#work-schedule').selectOption('6');
 await expect(page.locator('[data-work-table="6"]')).toBeVisible();
 await expect(page.locator('[data-work-compare="6"] [data-work-days]')).toHaveText('301');
 await expect(page.locator('[data-work-compare="6"] [data-work-hours]')).toHaveText(/1.?997/);
});

test('blog photographs have working responsive sources and visible provenance',async({page})=>{
 await page.goto('/blogas/');await expect(page.locator('.editorial-card')).toHaveCount(20);
 const links=await page.locator('.editorial-card>a').evaluateAll(items=>items.map(a=>a.getAttribute('href')));
 for(const route of [links[0],links[1],links[16]]){
  await page.goto(route);
  const photo=page.locator('.editorial-photograph img');
  await expect(photo).toHaveAttribute('src',/\/assets\/blog\/photos\/.*\.webp/);
  await expect(photo).toHaveAttribute('srcset',/480w.*800w.*1200w/);
  await expect(page.locator('.editorial-photograph figcaption')).toContainText('Nuotrauka:');
  await expect(page.locator('.editorial-photograph figcaption a')).toHaveCount(2);
  await expect(page.locator('main>.breadcrumbs')).toHaveCount(0);
  expect(await page.locator('.editorial-article header').evaluate(header=>header.querySelector('.editorial-photograph').compareDocumentPosition(header.querySelector('.page-intro'))&Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  await page.locator('.editorial-example img').scrollIntoViewIfNeeded();
  await expect.poll(()=>page.locator('.editorial-example img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
  await expect(page.locator('.editorial-example figcaption')).toContainText('lankytojų įrašai nenaudojami');
  await page.locator('.share-entry>summary').click();
  await expect(page.getByRole('dialog')).toBeVisible();
 }
});
