import {test,expect} from '@playwright/test';

test('commemoration filter finds Lithuanian text, reports empty results and restores all cards',async({page})=>{
 await page.goto('/atmintinos-dienos/');
 const cards=page.locator('[data-commemoration]:visible');
 const count=await cards.count();expect(count).toBeGreaterThan(10);
 await page.locator('#commemoration-search').fill('mokytoju');
 await expect(cards).toHaveCount(1);await expect(cards).toContainText('mokytojų');
 await page.locator('#commemoration-search').fill('qa_no_such_day');await expect(cards).toHaveCount(0);
 await expect(page.locator('#commemoration-status')).toContainText('Nieko nerasta');
 await page.locator('#commemoration-search').fill('');await expect(cards).toHaveCount(count);
});

test('daylight comparison changes all five cities and can retry a failed data request',async({page})=>{
 let requests=0;await page.route('**/data/astronomy/cities.json',route=>++requests===1?route.abort():route.continue());
 await page.goto('/dienos-ilgumas/');await expect(page.locator('#daylight-status')).toContainText('Duomenų nepavyko įkelti');
 await page.locator('#daylight-form button').click();await expect(page.locator('#daylight-rows tr')).toHaveCount(5);
 const summer=await page.locator('#daylight-rows meter').evaluateAll(es=>es.map(e=>e.value));
 await page.locator('#daylight-date').fill('2028-12-21');await page.locator('#daylight-form button').click();
 await expect(page.locator('#daylight-status')).toContainText('2028-12-21');
 const winter=await page.locator('#daylight-rows meter').evaluateAll(es=>es.map(e=>e.value));
 expect(winter).toHaveLength(5);for(let i=0;i<5;i++){expect(winter[i]).toBeLessThan(summer[i]);expect(winter[i]).toBeGreaterThan(350);}
 expect(requests).toBe(2);
});

test('long-weekend year links and month destinations open the intended calendar',async({page})=>{
 await page.goto('/ilgieji-savaitgaliai/');
 await page.getByRole('navigation',{name:'Pasirinkti metus',exact:true}).getByRole('link',{name:'2028',exact:true}).click();
 await expect(page).toHaveURL(/#savaitgaliai-2028$/);await expect(page.locator('#savaitgaliai-2028 h2')).toBeVisible();
 const link=page.locator('#savaitgaliai-2028 article a').first();const href=await link.getAttribute('href');
 expect(href).toMatch(/^\/2028\/[a-z]+\/$/);await link.click();await expect(page).toHaveURL(new RegExp(href+'$'));
 await expect(page.locator('#main h1')).toBeVisible();
});
