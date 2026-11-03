import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {openHeaderSearch} from './header-helpers.mjs';
const routes=['/','/paieska/','/vardadieniai/','/zodiakas/','/pamoku-tvarkarastis/','/pamainu-grafikas/','/menulio-kalendorius/2028/vasaris/','/atostogu-planavimas/','/atmintinos-dienos/','/dienos-ilgumas/','/ilgieji-savaitgaliai/','/apie-mus/','/kurti-kalendoriu/'];
test('weather credits and static calendar dates remain usable touch targets',async({page})=>{
 // Firefox may report an exact24px box as23.9999847 after layout transforms.
 // A thousandth of a CSS pixel only absorbs floating-point quantization.
 const minimumTarget=24-.001;
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 const credits=page.locator('.weather-attribution a');
 await expect(credits.first()).toBeVisible();
 for(const link of await credits.all()){
  const box=await link.boundingBox();expect(box.width).toBeGreaterThanOrEqual(minimumTarget);expect(box.height).toBeGreaterThanOrEqual(minimumTarget);
 }
 await page.goto('/2027/');
 for(const width of [390,800]){
 await page.setViewportSize({width,height:844});
 const dates=page.locator('.static-month .calendar-holiday-date');
 expect(await dates.count()).toBeGreaterThan(10);
 for(const link of await dates.all()){
  const day=(await link.locator('time').textContent()).trim();
  await expect(link).toHaveAccessibleName(new RegExp('^'+day+' d\\.'));
  const box=await link.boundingBox();expect(box.width).toBeGreaterThanOrEqual(minimumTarget);expect(box.height).toBeGreaterThanOrEqual(minimumTarget);
  // Center the date away from the sticky navigation and first-visit notice;
  // then test whether neighboring calendar cells obscure its horizontal area.
  await link.evaluate(el=>el.scrollIntoView({block:'center'}));
  expect(await link.evaluate(el=>{const r=el.getBoundingClientRect();return [r.left+2,r.right-2].every(x=>el.contains(document.elementFromPoint(x,r.top+r.height/2)))})).toBe(true);
 }
 }
});
test('daylight chart has list items and filtered holiday dates retain their visible name',async({page})=>{
 await page.goto('/dienos-ilgumas/',{waitUntil:'networkidle'});
 const chart=page.getByRole('list',{name:'Saulės šviesos laikas nuo vidurnakčio iki vidurnakčio'});
 await expect(chart.getByRole('listitem').first()).toBeVisible();
 await page.goto('/sventes/2027/sausis/');
 const first=page.locator('.mh-day').first();
 await expect(first).toHaveAccessibleName('1');
 await expect(first).toHaveAttribute('title',/sausio 1 d\./);
 const category=page.locator('[data-category-filter]').last();
 await category.click();
 await expect(first).toHaveAccessibleName('1');
 await expect(first).toHaveAttribute('title',/sausio 1 d\./);
 await page.goto('/vardadieniai/balandis/');
 const nameday=page.locator('#nd-calendar a[data-calendar-date]').first();
 await expect(nameday).toHaveAccessibleName(/^1 \d+ v\.$/);
 await expect(nameday).toHaveAttribute('title',/balandžio 1 d\./);
});
for(const width of[320,390])for(const route of routes)test(`enlarged text at ${width}px: ${route}`,async({page,context})=>{
 await context.addInitScript(()=>localStorage.setItem('kalendorius365:privacy-notice:v1','dismissed'));
 await page.setViewportSize({width,height:844});await page.goto(route);
 await page.addStyleTag({content:'html {font-size:200% !important}'});
 // Measure the enlarged layout after its actual font faces have settled.
 await page.evaluate(()=>document.fonts.ready);
 const input=await openHeaderSearch(page);await input.fill('2029 gegužė');
 const options=page.locator('#site-search-results [role=option]');
 await expect(options.first()).toHaveAttribute('href','/2029/geguze/');
 const geometry=await options.evaluateAll(es=>es.map(e=>{const box=e.getBoundingClientRect(),title=e.querySelector('strong').getBoundingClientRect();return {top:box.top,bottom:box.bottom,height:box.height,titleHeight:title.height};}));
 for(let i=0;i<geometry.length;i++){
  expect(geometry[i].titleHeight).toBeLessThanOrEqual(geometry[i].height+1);
  if(i)expect(geometry[i].top).toBeGreaterThanOrEqual(geometry[i-1].bottom-1);
 }
 for(let i=0;i<3;i++)await input.press('ArrowDown');
 await expect(input).toHaveAttribute('aria-activedescendant','site-search-option-2');
 await expect(options.nth(2)).toBeInViewport({ratio:.95});
 await input.press('Escape');
 const layout=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,font:parseFloat(getComputedStyle(document.documentElement).fontSize)}));
 expect(layout.font).toBe(32);expect(layout.scroll,JSON.stringify(layout)).toBeLessThanOrEqual(layout.viewport+1);
 if(route==='/pamainu-grafikas/'){
  await page.locator('#shift-preset').selectOption('day-night');await expect(page.locator('#shift-cycle')).toHaveValue('D,D,N,N,P,P,P,P');
  const [file]=await Promise.all([page.waitForEvent('download'),page.locator('#shift-json-export').click()]);
  expect(await file.failure()).toBeNull();const backup=JSON.parse(await fs.readFile(await file.path(),'utf8'));expect(backup.schema).toBe(1);expect(backup.data['shift-cycle']).toBe('D,D,N,N,P,P,P,P');
 }
});
