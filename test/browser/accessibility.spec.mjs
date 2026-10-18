import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {openHeaderSearch} from './header-helpers.mjs';
const routes=['/','/paieska/','/vardadieniai/','/zodiakas/','/pamoku-tvarkarastis/','/pamainu-grafikas/','/menulio-kalendorius/2028/vasaris/','/atostogu-planavimas/'];
for(const width of[320,390])for(const route of routes)test(`enlarged text at ${width}px: ${route}`,async({page,context})=>{
 await context.addInitScript(()=>localStorage.setItem('kalendorius365:privacy-notice:v1','dismissed'));
 await page.setViewportSize({width,height:844});await page.goto(route);
 await page.addStyleTag({content:'html {font-size:200% !important}'});
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
