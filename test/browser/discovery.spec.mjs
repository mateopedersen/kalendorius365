import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const downloadText=async(page,action)=>{const [file]=await Promise.all([page.waitForEvent('download'),action()]);expect(await file.failure()).toBeNull();return (await fs.readFile(await file.path())).toString('utf8');};

test('commemoration filter finds Lithuanian text, reports empty results and restores all cards',async({page})=>{
 await page.goto('/atmintinos-dienos/');const cards=page.locator('[data-commemoration]:visible');const count=await cards.count();expect(count).toBeGreaterThan(10);
 await page.locator('#commemoration-search').fill('mokytoju');await expect(cards).toHaveCount(1);await expect(cards).toContainText('mokytojų');
 await page.locator('#commemoration-search').fill('qa_no_such_day');await expect(cards).toHaveCount(0);await expect(page.locator('#commemoration-status')).toContainText('dienų nerasta');await expect(page.locator('#commemoration-export')).toBeDisabled();
 await page.locator('#commemoration-clear').click();await expect(cards).toHaveCount(count);await expect(page.locator('#commemoration-search')).toBeFocused();
});

test('daylight comparison changes all five cities and can retry a failed data request',async({page})=>{
 let requests=0;await page.route('**/data/astronomy/cities.json',route=>++requests===1?route.abort():route.continue());
 await page.goto('/dienos-ilgumas/');await expect(page.locator('#daylight-status')).toContainText('Duomenų nepavyko įkelti');
 await page.locator('#daylight-form button[type=submit]').click();await expect(page.locator('#daylight-rows tr')).toHaveCount(5);const summer=await page.locator('#daylight-rows meter').evaluateAll(es=>es.map(e=>e.value));
 await page.locator('#daylight-date').fill('2028-12-21');await page.locator('#daylight-form button[type=submit]').click();await expect(page).toHaveURL(/date=2028-12-21/);
 const winter=await page.locator('#daylight-rows meter').evaluateAll(es=>es.map(e=>e.value));expect(winter).toHaveLength(5);for(let i=0;i<5;i++){expect(winter[i]).toBeLessThan(summer[i]);expect(winter[i]).toBeGreaterThan(350);}expect(requests).toBe(2);
});

test('long-weekend year controls and month destinations open the intended calendar',async({page})=>{
 await page.goto('/ilgieji-savaitgaliai/');await page.locator('[data-weekend-year="2028"]').click();await expect(page.locator('[data-weekend-year="2028"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#savaitgaliai-2028 h2')).toBeVisible();await expect(page.locator('#savaitgaliai-2027')).toBeHidden();
 const link=page.locator('#savaitgaliai-2028 article a').first();const href=await link.getAttribute('href');expect(href).toMatch(/^\/2028\/[a-z]+\/$/);await link.click();await expect(page).toHaveURL(new RegExp(href+'$'));await expect(page.locator('#main h1')).toBeVisible();
});

test('commemoration year, category and ICS export preserve the floating date and filtered records',async({page})=>{
 await page.goto('/atmintinos-dienos/');await page.locator('#commemoration-year').selectOption('2028');await page.locator('#commemoration-search').fill('vaiko');const cards=page.locator('[data-commemoration]:visible');await expect(cards).toHaveCount(1);await expect(cards.locator('time')).toHaveAttribute('datetime','2028-05-19');
 const ics=await downloadText(page,()=>page.locator('#commemoration-export').click());expect(ics).toContain('DTSTART;VALUE=DATE:20280519');expect(ics).toContain('DTEND;VALUE=DATE:20280520');expect((ics.match(/BEGIN:VEVENT/g)||[])).toHaveLength(1);expect(ics).toContain('SUMMARY:Vaiko diena');
 await page.locator('#commemoration-category').selectOption('history');await expect(cards).toHaveCount(0);await expect(page.locator('#commemoration-export')).toBeDisabled();await page.locator('#commemoration-clear').click();await expect(cards).toHaveCount(12);await expect(page.locator('#commemoration-year')).toHaveValue('2028');
});

test('daylight city selection, presets, comparison chart and CSV export use the chosen real date',async({page})=>{
 await page.goto('/dienos-ilgumas/?date=2028-02-29');await expect(page.locator('#daylight-rows tr')).toHaveCount(5);await expect(page.locator('#daylight-chart .daylight-line')).toHaveCount(5);
 const csv=await downloadText(page,()=>page.locator('#daylight-export').click());expect(csv).toContain('2028-02-29');expect(csv).toContain('Europe/Vilnius');expect(csv.trim().split(/\r?\n/)).toHaveLength(6);
 await page.locator('.daylight-preset[data-month-day="12-21"]').click();await expect(page.locator('#daylight-date')).toHaveValue('2028-12-21');await expect(page).toHaveURL(/date=2028-12-21/);
 const choices=page.locator('#daylight-cities input');for(let i=0;i<4;i++)await choices.nth(i).uncheck();await expect(page.locator('#daylight-status')).toContainText('bent du miestus');await expect(page.locator('#daylight-rows tr')).toHaveCount(0);await expect(page.locator('#daylight-export')).toBeDisabled();await page.locator('#daylight-all-cities').click();await expect(page.locator('#daylight-rows tr')).toHaveCount(5);await expect(page.locator('#daylight-export')).toBeEnabled();
});

test('weekend budgets, copied plans and the 2029 cross-year break use the selected year',async({page,context})=>{
 await context.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__discoveryCopy=text;}}}));
 await page.goto('/ilgieji-savaitgaliai/');await page.locator('[data-weekend-year="2029"]').click();await expect(page.locator('#savaitgaliai-2029 [data-weekend]').first()).toHaveAttribute('data-start','2028-12-30');await expect(page.locator('#savaitgaliai-2029 [data-weekend]').first()).toHaveAttribute('data-end','2029-01-01');
 await page.locator('#weekend-leave-budget').selectOption('0');await expect(page.locator('#weekend-recommendations article')).toHaveCount(0);await expect(page.locator('#weekend-plan-export')).toBeDisabled();
 await page.locator('#weekend-leave-budget').selectOption('3');const first=page.locator('#weekend-recommendations article').first();await expect(first).toBeVisible();await expect(page.locator('#weekend-plan-caption')).toContainText(/Išnaudojama [1-3] atostogų/);
 await first.getByRole('button').click();await expect(first.getByRole('button')).toHaveText('Nukopijuota');expect(await page.evaluate(()=>window.__discoveryCopy)).toContain('atostogų');
});

test('saved commemorations survive reload and their next-date countdown preserves the separate calendar note',async({page})=>{
 await page.clock.setFixedTime(new Date('2028-05-18T12:00:00Z'));
 await page.goto('/?data=2028-02-29');await expect(page.locator('.dashboard')).toHaveAttribute('aria-busy','false');await page.locator('#daily-note').fill('Atskiras laikinas įrašas');await page.locator('#save-note').click();
 await page.goto('/atmintinos-dienos/');await page.locator('#commemoration-year').selectOption('2028');await page.locator('#commemoration-search').fill('vaiko');
 const card=page.locator('[data-commemoration]:visible');await expect(card).toHaveCount(1);await expect(page.locator('#commemoration-next-count')).toHaveText('1');await expect(page.locator('#commemoration-next-title')).toContainText('Vaiko');
 await card.locator('.commemoration-favorite').click();await expect(card.locator('.commemoration-favorite')).toHaveAttribute('aria-pressed','true');await page.locator('#commemoration-favorites-only').check();await expect(card).toHaveCount(1);
 await page.reload();const saved=page.locator('.commemoration-favorite[aria-pressed=true]');await expect(saved).toHaveCount(1);await page.locator('#commemoration-favorites-only').check();await expect(card).toHaveCount(1);await card.locator('.commemoration-favorite').click();await expect(card).toHaveCount(0);await expect(page.locator('#commemoration-export')).toBeDisabled();
 await page.goto('/?data=2028-02-29');await expect(page.locator('.dashboard')).toHaveAttribute('aria-busy','false');await expect(page.locator('#daily-note')).toHaveValue('Atskiras laikinas įrašas');
});

test('daylight date steps, boundaries, focused city, year-curve mouse and keyboard and copied links respond',async({page,context})=>{
 await context.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__discoveryCopy=text;}}}));
 await page.goto('/dienos-ilgumas/?date=2028-02-29');await expect(page.locator('#daylight-rows tr')).toHaveCount(5);await page.locator('#daylight-next-day').click();await expect(page.locator('#daylight-date')).toHaveValue('2028-03-01');await page.locator('#daylight-previous-day').click();await expect(page.locator('#daylight-date')).toHaveValue('2028-02-29');
 await page.locator('#daylight-focus-city').selectOption('klaipeda');await expect(page.locator('#daylight-year-chart')).toHaveAttribute('aria-label',/Klaipėda/);const markers=page.locator('#daylight-year-chart circle[role=button]');await expect(markers).toHaveCount(12);
 await markers.nth(11).press('Enter');await expect(page.locator('#daylight-date')).toHaveValue('2028-12-21');await markers.nth(5).press('Space');await expect(page.locator('#daylight-date')).toHaveValue('2028-06-21');await markers.nth(8).click();await expect(page.locator('#daylight-date')).toHaveValue('2028-09-21');
 await page.locator('#daylight-copy-link').click();expect(await page.evaluate(()=>window.__discoveryCopy)).toMatch(/\/dienos-ilgumas\/\?date=2028-09-21$/);
 await page.locator('#daylight-date').fill('2027-01-01');await page.locator('#daylight-form button[type=submit]').click();await expect(page.locator('#daylight-previous-day')).toBeDisabled();await expect(page.locator('#daylight-next-day')).toBeEnabled();
 await page.locator('#daylight-date').fill('2029-12-31');await page.locator('#daylight-form button[type=submit]').click();await expect(page.locator('#daylight-next-day')).toBeDisabled();await expect(page.locator('#daylight-previous-day')).toBeEnabled();
});

test('annual weekend budget waits for statutory data, retries failure and exports nonoverlapping real calendar intervals',async({page})=>{
 let requests=0;await page.route('**/data/calendar.json',route=>++requests===1?route.abort():route.continue());
 await page.goto('/ilgieji-savaitgaliai/');await expect(page.locator('#weekend-plan-caption')).toContainText('nepavyko įkelti');await expect(page.locator('#weekend-leave-budget')).toBeDisabled();await expect(page.locator('[data-weekend-year="2028"]')).toBeDisabled();
 await page.locator('#weekend-plan-retry').click();await expect(page.locator('#weekend-leave-budget')).toBeEnabled();await page.locator('[data-weekend-year="2028"]').click();
 for(let budget=0;budget<=5;budget++){
  await page.locator('#weekend-leave-budget').selectOption(String(budget));
  if(!budget){await expect(page.locator('#weekend-plan-export')).toBeDisabled();continue;}
  await expect(page.locator('#weekend-plan-export')).toBeEnabled();const spent=Number((await page.locator('#weekend-plan-caption').innerText()).match(/Išnaudojama (\d+)/)[1]);expect(spent).toBeGreaterThan(0);expect(spent).toBeLessThanOrEqual(budget);
 }
 const count=await page.locator('#weekend-recommendations article').count();const raw=await downloadText(page,()=>page.locator('#weekend-plan-export').click());const ics=raw.replace(/\r\n /g,'');expect((ics.match(/BEGIN:VEVENT/g)||[])).toHaveLength(count);const starts=[...ics.matchAll(/DTSTART;VALUE=DATE:(\d{8})/g)].map(m=>m[1]),ends=[...ics.matchAll(/DTEND;VALUE=DATE:(\d{8})/g)].map(m=>m[1]);expect(starts).toHaveLength(count);expect(ends).toHaveLength(count);
 for(let i=0;i<count;i++){expect(starts[i]<ends[i]).toBe(true);if(i)expect(starts[i]>=ends[i-1]).toBe(true);}expect(requests).toBe(2);
});
