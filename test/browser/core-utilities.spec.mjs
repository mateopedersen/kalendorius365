import {test,expect} from '@playwright/test';

test('regional privacy notice dismisses and stays dismissed without clearing other stored data',async({page,context})=>{
 await context.addInitScript(()=>localStorage.setItem('qa-unrelated-preference','keep'));
 await page.route('**/api/privacy-region',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({showNotice:true})}));
 await page.goto('/2028/');await expect(page.locator('#cookie-notice')).toBeVisible();
 await page.locator('#cookie-notice-dismiss').click();await expect(page.locator('#cookie-notice')).toHaveCount(0);
 await page.reload();await expect(page.locator('#cookie-notice')).toHaveCount(0);
 expect(await page.evaluate(()=>localStorage.getItem('qa-unrelated-preference'))).toBe('keep');
 expect(await page.evaluate(()=>localStorage.getItem('kalendorius365:privacy-notice:v1'))).toBe('dismissed');
});

test('calendar ICS import opens the file chooser and malformed follow-up preserves the imported event',async({page,context})=>{
 await context.addInitScript(()=>localStorage.setItem('kalendorius365:privacy-notice:v1','dismissed'));
 await page.goto('/?data=2028-02-29');
 await expect(page.locator('.dashboard')).toHaveAttribute('aria-busy','false');
 const content=['BEGIN:VCALENDAR','VERSION:2.0','BEGIN:VEVENT','UID:qa-disposable-leap-day','DTSTART;VALUE=DATE:20280229','DTEND;VALUE=DATE:20280301','SUMMARY:QA imported leap day','END:VEVENT','END:VCALENDAR',''].join('\r\n');
 const pending=page.waitForEvent('filechooser');await page.locator('#import-ics').click();
 await (await pending).setFiles({name:'qa.ics',mimeType:'text/calendar',buffer:Buffer.from(content)});
 await expect(page.locator('#day-agenda')).toContainText('QA imported leap day');
 await page.locator('#ics-file').setInputFiles({name:'invalid.ics',mimeType:'text/calendar',buffer:Buffer.from('not a calendar')});
 await expect(page.locator('#day-agenda')).toContainText('QA imported leap day');await page.reload();
 await expect(page.locator('#day-agenda')).toContainText('QA imported leap day');
});

test('print control invokes the browser print action and the main content renders in print media',async({page,context})=>{
 await context.addInitScript(()=>{localStorage.setItem('kalendorius365:privacy-notice:v1','dismissed');window.print=()=>{window.__qaPrintCalls=(window.__qaPrintCalls||0)+1;};});
 await page.goto('/?data=2028-02-29');await expect(page.locator('.dashboard')).toHaveAttribute('aria-busy','false');await page.locator('[data-print]').click();
 expect(await page.evaluate(()=>window.__qaPrintCalls)).toBe(1);
 await page.emulateMedia({media:'print'});await expect(page.locator('#main')).toBeVisible();await expect(page.locator('#calendar')).toBeVisible();await expect(page.locator('#period-title')).toContainText('2028');
});

test('404 template is excluded from indexing and its home link recovers navigation',async({page})=>{
 const missing=await page.goto('/qa-authorized-nonexistent-page-20261018/');expect(missing.status()).toBe(404);
 await page.goto('/404.html');await expect(page.locator('meta[name=robots]')).toHaveAttribute('content',/noindex/);
 await expect(page.locator('#main h1')).toContainText('Puslapis nerastas');
 await page.locator('#main a[href="/"]').first().click();await expect(page).toHaveURL(/\/$/);await expect(page.locator('#main h1')).toBeVisible();
});

test('weather city and clock preferences survive reload without changing the saved note',async({page,context})=>{
 await context.addInitScript(()=>localStorage.setItem('kalendorius365:privacy-notice:v1','dismissed'));
 await page.goto('/?data=2028-02-29');await expect(page.locator('.dashboard')).toHaveAttribute('aria-busy','false');await page.locator('#daily-note').fill('Disposable weather preference note');await page.locator('#save-note').click();
 const cityPicker=page.locator('.weather-city-picker');const weatherCity=page.locator('#weather-city');
 await expect(cityPicker).toBeVisible();await expect(cityPicker.locator('.weather-city-picker__location')).toBeVisible();await expect(cityPicker.locator('.weather-city-picker__chevron')).toBeVisible();
 const pickerBox=await cityPicker.boundingBox();expect(pickerBox.height).toBeGreaterThanOrEqual(44);expect(pickerBox.height).toBeLessThan(48);
 const chevronBox=await cityPicker.locator('.weather-city-picker__chevron').boundingBox();
 const arrowHitsSelect=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('#weather-city')!==null,{x:chevronBox.x+chevronBox.width/2,y:chevronBox.y+chevronBox.height/2});expect(arrowHitsSelect).toBe(true);
 await weatherCity.focus();await expect(cityPicker).toHaveCSS('outline-style','solid');
 await weatherCity.selectOption('kaunas');await page.locator('#seconds').uncheck();
 await expect(page.locator('#clock-zone')).toContainText('Kaunas');await page.reload();
 await expect(page.locator('#weather-city')).toHaveValue('kaunas');await expect(page.locator('#seconds')).not.toBeChecked();
 await expect(page.locator('#daily-note')).toHaveValue('Disposable weather preference note');
});

test('personal calendar date search, invalid date feedback and category filters update actual state',async({page,context})=>{
 await context.addInitScript(()=>localStorage.setItem('kalendorius365:privacy-notice:v1','dismissed'));
 await page.goto('/');await expect(page.locator('.dashboard')).toHaveAttribute('aria-busy','false');await page.locator('#search').fill('2028-02-30');await expect(page.locator('#search-results')).toContainText('Neteisinga data');
 await page.locator('#search').fill('2028-02-29');await page.locator('#search-results [data-date="2028-02-29"]').click();
 await expect(page.locator('#period-title')).toContainText('2028 m. vasaris');
 await page.locator('.filter-chip--holiday').click();await expect(page.locator('.filter-chip--holiday')).toHaveAttribute('aria-pressed','false');
 await page.locator('#category-chips').getByRole('button',{name:'Visi įvykiai',exact:true}).click();
 await expect(page.locator('.filter-chip--holiday')).toHaveAttribute('aria-pressed','true');
 await page.reload();await expect(page.locator('.filter-chip--holiday')).toHaveAttribute('aria-pressed','true');
});
