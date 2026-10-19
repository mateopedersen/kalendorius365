import {openHeaderSearch} from './header-helpers.mjs';
import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const sitemap=fs.readFileSync(new URL('../../public/sitemap.xml',import.meta.url),'utf8');
const routes=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]).pathname);
for (const route of routes) test(`canonical route, runtime, responsive header: ${route}`,async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(route);expect(response.status()).toBe(200);
 await expect(page.locator('#main h1').first()).toBeVisible();
 await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href',`https://kalendorius365.lt${route}`);
 const robots=await page.locator('meta[name=robots]').getAttribute('content');
 const previewHost=new URL(page.url()).hostname.endsWith('.pages.dev');
 if(previewHost)expect(robots).toContain('noindex');else expect(robots).not.toContain('noindex');
 const input=await openHeaderSearch(page);await input.fill('2029 gegužė');
 await expect(page.locator('#site-search-results [role=option]').first()).toHaveAttribute('href','/2029/geguze/');
 await input.press('Escape');await expect(page.locator('#site-search-results')).toBeHidden();
 if(info.project.use.isMobile){
   await page.locator('#nav-toggle').click();await expect(page.locator('#nav-toggle')).toHaveAttribute('aria-expanded','true');
   await page.keyboard.press('Escape');await expect(page.locator('#nav-toggle')).toHaveAttribute('aria-expanded','false');
 }
 if(info.project.use.isMobile){
   for(const width of [320,390,430]){
     await page.setViewportSize({width,height:844});
     const layout=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
     expect(layout.scroll,`${route} at ${width}px: ${JSON.stringify(layout)}`).toBeLessThanOrEqual(layout.viewport+1);
   }
 }else{
   const layout=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
   expect(layout.scroll,JSON.stringify(layout)).toBeLessThanOrEqual(layout.viewport+1);
 }
 expect(errors).toEqual([]);
});

test('warm reload retains saved preferences while using revision asset URLs',async({page})=>{
 await page.goto('/');
 const before=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
 await page.locator('#hour12').check();
 const warm=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
 await page.reload();
 expect(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)))).toEqual(warm);
 await expect(page.locator('#hour12')).toBeChecked();
 const urls=await page.locator('script[src],link[rel=stylesheet]').evaluateAll(es=>es.map(e=>e.getAttribute('src')||e.getAttribute('href')));
 for(const url of urls)expect(url).toMatch(/^\/assets\/releases\/[a-f0-9]{20}\//);
 expect(Object.keys(before).every(k=>k in warm)).toBeTruthy();
});
