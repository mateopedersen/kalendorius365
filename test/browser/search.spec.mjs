import {test,expect} from '@playwright/test';

for(const width of [320,360,375,390,414,768,1024,1280,1440,1920])test(`header search works at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/paieska/');
 const input=page.locator('#site-search');await input.fill('2029 geguze');
 await expect(page.locator('#site-search-results [role=option]').first()).toHaveAttribute('href','/2029/geguze/');
 await expect(input).toHaveAttribute('aria-expanded','true');
 const bounds=await input.boundingBox();expect(bounds.width).toBeGreaterThan(100);
 await input.press('ArrowDown');await expect(input).toHaveAttribute('aria-activedescendant','site-search-option-0');
 await input.press('Escape');await expect(page.locator('#site-search-results')).toBeHidden();
 if(width<=760){
  await page.locator('#nav-toggle').click();await expect(page.locator('#nav-toggle')).toHaveAttribute('aria-expanded','true');
  await page.keyboard.press('Escape');await expect(page.locator('#nav-toggle')).toHaveAttribute('aria-expanded','false');
 }
 const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width+1);expect(errors).toEqual([]);
});

test('name-day search opens the native name with all genuine dates prefilled',async({page})=>{
 await page.goto('/paieska/');await page.locator('#site-search').fill('zivile');
 const first=page.locator('#site-search-results [role=option]').first();
 await expect(first).toContainText('Živilė – vardadienis');await first.click();
 await expect(page.locator('#nd-query')).toHaveValue('Živilė');
 await expect(page.locator('#nd-results')).toContainText('Živilė');
 await expect(page.locator('#nd-results a')).toHaveCount(2);
 await expect(page.locator('#nd-results')).toContainText('vasario 6 d.');
 await expect(page.locator('#nd-results')).toContainText('liepos 24 d.');
});

for(const[query,path]of[
 ['rugsėjis 2027','/2027/rugsejis/'],['saulėlydis Kaune','/saule/'],['astrologija','/zodiakas/'],
 ['horoskopai šiandien','/horoskopai/'],['2028-02-29','/2028/vasaris/'],['Velykos 2027','/sventes/velykos/'],
])test(`full results preserve intent: ${query}`,async({page})=>{
 await page.goto(`/paieska/?q=${encodeURIComponent(query)}`);
 await expect(page.locator('#site-search-page-query')).toHaveValue(query);
 await expect(page.locator('#site-search-page-results a').first()).toHaveAttribute('href',path);
});

test('paging, filter and Back restore the visible search state',async({page})=>{
 await page.goto('/paieska/?q=kalendorius');
 await expect(page.locator('#site-search-page-status')).toContainText('Rodoma 1–18.');
 await page.locator('#site-search-pagination').getByRole('button',{name:'Kitas →',exact:true}).click();
 await expect(page).toHaveURL(/puslapis=2/);await expect(page.locator('#site-search-page-status')).toContainText('Rodoma 19–36.');
 await page.goBack();await expect(page.locator('#site-search-page-status')).toContainText('Rodoma 1–18.');
 await page.locator('#site-search-category').selectOption('astronomy');
 await expect(page).toHaveURL(/skiltis=astronomy/);
 for(const label of await page.locator('.search-page-result__category').allTextContents())expect(label).toBe('Astronomija');
 await page.locator('#site-search-clear').click();await expect(page.locator('#site-search-page-query')).toHaveValue('');
 await expect(page.locator('#site-search-category')).toHaveValue('all');
 await page.goBack();await expect(page.locator('#site-search-category')).toHaveValue('astronomy');
 await expect(page.locator('#site-search-page-query')).toHaveValue('kalendorius');
});

test('an index network failure exposes an actual working retry',async({page})=>{
 let requests=0;await page.route('**/data/search.json',async route=>{
  if(++requests===1)await route.abort('failed');else await route.continue();
 });
 await page.goto('/paieska/?q=2029');
 const retry=page.getByRole('button',{name:'Bandyti dar kartą',exact:true});await expect(retry).toBeVisible();
 await retry.click();await expect(retry).toBeHidden();
 await expect(page.locator('#site-search-page-results a').first()).toHaveAttribute('href','/2029/');expect(requests).toBe(2);
});

test('header fetch failure recovers on the next query in the same visit',async({page})=>{
 let requests=0;await page.route('**/data/search.json',async route=>{
  if(++requests===1)await route.abort('failed');else await route.continue();
 });
 await page.goto('/saule/');await page.locator('#site-search').fill('2029');
 await expect(page.locator('#site-search-results')).toContainText('Paieška nepasiekiama');
 await page.locator('#site-search').fill('2028');
 await expect(page.locator('#site-search-results [role=option]').first()).toHaveAttribute('href','/2028/');expect(requests).toBe(2);
});

test('untrusted query stays visible as text and does not execute HTML',async({page})=>{
 const dialogs=[];page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss();});
 const payload='<img src=x onerror=alert("search-xss")>';
 await page.goto(`/paieska/?q=${encodeURIComponent(payload)}`);
 await expect(page.locator('#site-search-page-heading')).toContainText(payload);
 await expect(page.locator('#site-search-page-heading img, #site-search-page-heading script')).toHaveCount(0);
 expect(dialogs).toEqual([]);
 await page.locator('#site-search-page-query').fill('asdcxz_no_such_term');
 await expect(page.locator('#site-search-page-status')).toContainText('Rezultatų nerasta');
 await expect(page.locator('#site-search-page-results a')).toHaveCount(0);
});

test('unknown filters and out-of-range pages recover to usable results',async({page})=>{
 await page.goto('/paieska/?q=2029&skiltis=unknown&puslapis=999999999999999999999');
 await expect(page.locator('#site-search-category')).toHaveValue('all');
 await expect(page.locator('#site-search-page-results a').first()).toHaveAttribute('href','/2029/');
});

for(const width of [320,390,768,1280])test(`major category navigation remains available without JavaScript at ${width}px`,async({browser,baseURL})=>{
 const context=await browser.newContext({javaScriptEnabled:false,baseURL,viewport:{width,height:844}});
 try{
  const page=await context.newPage();await page.goto('/paieska/');
  await expect(page.locator('#main')).toContainText('kalendori');
  await expect(page.getByRole('navigation',{name:'Svetainės skiltys',exact:true}).locator('a[href="/2027/"]')).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Svetainės skiltys',exact:true}).locator('a[href="/sventes/"]')).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Paieška ir svetainės skiltys',exact:true}).locator('a[href="/paieska/"]')).toBeVisible();
  await expect(page.locator('#site-search-page-form')).toBeHidden();
  await expect(page.locator('.search-page__results')).toBeHidden();
  const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  expect(layout.scroll).toBeLessThanOrEqual(layout.width+1);
 }finally{await context.close();}
});
