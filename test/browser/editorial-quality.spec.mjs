import {readFileSync} from 'node:fs';
import {test,expect} from '@playwright/test';
const blog=JSON.parse(readFileSync(new URL('../../site/_data/blog.json',import.meta.url)));
test.beforeEach(async({context})=>{
 await context.addInitScript(()=>localStorage.setItem('kalendorius365:analytics-consent:v1',JSON.stringify({version:1,analytics:false,expiresAt:Date.now()+86400000})));
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
 await page.goto('/blogas/');await expect(page.locator('.editorial-card')).toHaveCount(blog.length);
 const examples=JSON.parse(readFileSync(new URL('../../data/blog/tool-examples.json',import.meta.url)));
 const routes=blog.filter(post=>Object.hasOwn(examples,post.slug)).map(post=>post.url);
 for(const route of [routes[0],routes[1],routes.at(-1)]){
  await page.goto(route);
  const photo=page.locator('.editorial-photograph img');
  await expect(photo).toHaveAttribute('src',/\/assets\/blog\/photos\/.*\.webp/);
  await expect(photo).toHaveAttribute('srcset',/480w.*800w.*1200w/);
  await expect(page.locator('.editorial-photograph figcaption')).toContainText('Nuotrauka:');
  await expect(page.locator('.editorial-photograph figcaption a')).toHaveCount(2);
  await expect(page.locator('main>.breadcrumbs a[href="/blogas/"]')).toBeVisible();
  expect(await page.locator('.editorial-article header').evaluate(header=>header.querySelector('.page-intro').compareDocumentPosition(header.querySelector('.editorial-photograph'))&Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  await page.locator('.editorial-example img').scrollIntoViewIfNeeded();
  await expect.poll(()=>page.locator('.editorial-example img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
  await expect(page.locator('.editorial-example figcaption')).toContainText('lankytojų įrašai nenaudojami');
  await page.locator('.share-entry>summary').click();
  await expect(page.getByRole('dialog')).toBeVisible();
 }
});

test('Lithuanian calendar stories link to sources, calendar tools and photo credits',async({page,request})=>{
 const routes=[
  'baltijos-kelias-rugpjucio-23',
  'kaziuko-muges-kalendorius',
  'gandrines-ir-pavasario-stebejimai',
  'juros-sventes-savaitgalio-planas',
  'veliniu-lapkricio-kalendorius',
 ].map(slug=>`/blogas/${slug}/`);
 await page.goto('/blogas/');
 expect(await page.locator('.editorial-card>a').evaluateAll(items=>items.slice(0,5).map(a=>a.getAttribute('href')))).toEqual(routes);
 const licenses=await (await request.get('/nuotrauku-licencijos/')).text();

 for(const route of routes){
  await page.goto(route);
  const article=page.locator('.editorial-article');
  await expect(article.locator('h1')).toHaveCount(1);
  await expect(article.locator('.editorial-byline time')).toHaveAttribute('datetime','2026-11-21');
  const photo=article.locator('.editorial-photograph img');
  await expect(photo).toBeVisible();
  await expect.poll(()=>photo.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  const footnote=article.locator('.editorial-photograph figcaption');
  await expect(footnote.locator('a').first()).toHaveAttribute('href',/^https:\/\/commons\.wikimedia\.org\//);
  const internal=article.locator('section p a[href^="/"]').first();
  const external=article.locator('section p a[href^="https://"]').first();
  await expect(external).toBeVisible();
  expect((await request.get(await internal.getAttribute('href'))).status()).toBe(200);
  const credit=article.locator('.editorial-sources a[href^="/nuotrauku-licencijos/"]');
  expect(licenses).toContain(`id="${(await credit.getAttribute('href')).split('#')[1]}"`);
  await article.locator('.editorial-toc a').last().click();
  await expect(page).toHaveURL(/#dalis-\d+$/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
