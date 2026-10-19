import {test,expect} from '@playwright/test';

const months=['sausis','vasaris','kovas','balandis','geguze','birzelis','liepa','rugpjutis','rugsejis','spalis','lapkritis','gruodis'];

test('monthly print downloads stay aligned and readable across every month on phones',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const year of [2027,2028,2029]) for(const month of months){
  const response=await page.goto(`/${year}/${month}/`,{waitUntil:'domcontentloaded'});
  expect(response?.status(),`${year}/${month} should load`).toBe(200);
  const layout=await page.locator('.gallery.compact-gallery').evaluate(gallery=>{
   const first=gallery.querySelector('.design-card');
   const actions=first?.querySelector('.design-actions');
   const buttons=[...(actions?.querySelectorAll(':scope > .button')||[])];
   return {
    columns:getComputedStyle(gallery).gridTemplateColumns.trim().split(/\s+/).length,
    galleryWidth:gallery.getBoundingClientRect().width,
    buttonCount:buttons.length,
    buttons:buttons.map(button=>({width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height})),
    actionLayout:actions&&getComputedStyle(actions).display,
    pageOverflow:document.documentElement.scrollWidth>window.innerWidth
   };
  });
  expect(layout.columns,`${year}/${month} should use one card per row`).toBe(1);
  expect(layout.actionLayout,`${year}/${month} download actions should use a grid`).toBe('grid');
  expect(layout.buttonCount,`${year}/${month} should expose preview, PDF, WebP and print actions`).toBe(4);
  expect(layout.buttons[1].width,`${year}/${month} PDF button should remain comfortably wide`).toBeGreaterThanOrEqual(120);
  expect(layout.buttons[2].width,`${year}/${month} WebP button should remain comfortably wide`).toBeGreaterThanOrEqual(120);
  expect(layout.buttons.every(button=>button.height>=44),`${year}/${month} actions should be easy to tap`).toBe(true);
  expect(layout.pageOverflow,`${year}/${month} should not scroll sideways`).toBe(false);
 }
 await page.setViewportSize({width:320,height:720});
 await page.goto('/2029/vasaris/',{waitUntil:'domcontentloaded'});
 const narrow=await page.locator('.gallery.compact-gallery .design-actions').first().evaluate(actions=>[...actions.querySelectorAll(':scope > .button')].map(button=>button.getBoundingClientRect().width));
 expect(narrow[1]).toBeGreaterThanOrEqual(120);
 expect(narrow[2]).toBeGreaterThanOrEqual(120);
});

test('other printable templates keep download choices organized on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/tuscias-kalendorius/',{waitUntil:'domcontentloaded'});
 const blankActions=page.locator('.blank-gallery .design-actions').first();
 await expect(blankActions).toBeVisible();
 const blank=await blankActions.evaluate(actions=>({
  columns:getComputedStyle(actions).gridTemplateColumns.trim().split(/\s+/).length,
  widths:[...actions.querySelectorAll(':scope > .button')].map(button=>button.getBoundingClientRect().width),
  heights:[...actions.querySelectorAll(':scope > .button')].map(button=>button.getBoundingClientRect().height)
 }));
 expect(blank.columns).toBe(2);
 expect(blank.widths[1]).toBeGreaterThanOrEqual(120);
 expect(blank.widths[2]).toBeGreaterThanOrEqual(120);
 expect(blank.heights.every(height=>height>=44)).toBe(true);

 await page.goto('/menulio-kalendorius/2029/vasaris/',{waitUntil:'domcontentloaded'});
 const lunarActions=page.locator('.lunar-print-card .lunar-downloads').first();
 await expect(lunarActions).toBeVisible();
 const lunar=await lunarActions.evaluate(actions=>({
  columns:getComputedStyle(actions).gridTemplateColumns.trim().split(/\s+/).length,
  buttons:[...actions.children].map(button=>({width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height,wordBreak:getComputedStyle(button).wordBreak}))
 }));
 expect(lunar.columns).toBe(2);
 expect(lunar.buttons[0].width).toBeGreaterThanOrEqual(120);
 expect(lunar.buttons[1].width).toBeGreaterThanOrEqual(120);
 expect(lunar.buttons.every(button=>button.height>=44&&button.wordBreak==='normal')).toBe(true);
});
