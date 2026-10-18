import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

// Every test gets a fresh browser context. Only synthetic data is created, and
// the consent key is set explicitly rather than clearing any browser storage.
test.beforeEach(async({context})=>{
 await context.addInitScript(()=>localStorage.setItem('kalendorius365:privacy-notice:v1','dismissed'));
});
const downloadBytes=async(page,action)=>{
 const pending=page.waitForEvent('download');await action();const file=await pending;
 expect(await file.failure()).toBeNull();return {file,bytes:await fs.readFile(await file.path())};
};
const ics=bytes=>{const text=bytes.toString();expect(text).toContain('BEGIN:VCALENDAR');expect(text).toContain('BEGIN:VEVENT');expect(text).toContain('END:VCALENDAR');return text;};

test('full search filters, shareable URL, back, pagination, clear and XSS text',async({page})=>{
 await page.goto('/paieska/?q=2029%20gegu%C5%BE%C4%97');
 await expect(page.locator('#site-search-page-results a').first()).toHaveAttribute('href','/2029/geguze/');
 await page.locator('#site-search-clear').click();await expect(page.locator('#site-search-page-query')).toHaveValue('');
 await page.locator('#site-search-category').selectOption('calendar');
 await expect(page).toHaveURL(/skiltis=calendar/);
 const next=page.locator('#site-search-pagination').getByRole('button',{name:'Kitas →',exact:true});
 await next.click();await expect(page).toHaveURL(/puslapis=2/);
 await page.goBack();await expect(page).not.toHaveURL(/puslapis=2/);
 await page.locator('#site-search-clear').click();
 await page.locator('#site-search-page-query').fill('<script>alert(1)</script>');
 await page.locator('#site-search-page-form button[type=submit]').click();
 await expect(page.locator('#site-search-page-status')).toContainText('Rezultatų nerasta');
 await expect(page.locator('#site-search-page-results script')).toHaveCount(0);
});

test('header search recovers from a failed index request without a reload',async({page})=>{
 let requests=0;await page.route('**/data/search.json',route=>++requests===1?route.abort():route.continue());
 await page.goto('/2028/');await page.locator('#site-search').fill('saulėlydis Kaune');
 await page.getByRole('button',{name:'Bandyti dar kartą',exact:true}).click();
 await expect(page.locator('#site-search-results [role=option]').first()).toHaveAttribute('href','/saule/');
 await expect(page.locator('#site-search-results')).toBeVisible();
 expect(requests).toBeGreaterThanOrEqual(2);
 const input=page.locator('#site-search');
 await input.focus();
 await expect(page.locator('#site-search-results [role=option]').first()).toHaveAttribute('href','/saule/');
 await page.keyboard.press('ArrowDown');
 await expect(input).toHaveAttribute('aria-activedescendant','site-search-option-0');
 await page.keyboard.press('Enter');await expect(page).toHaveURL(/\/saule\/$/);
});

test('calendar event create, edit, reload, export and delete preserve notes and tasks',async({page})=>{
 await page.goto('/?data=2028-02-29');await page.locator('#add-event').click();
 const form=page.locator('#event-form');await form.locator('[name=title]').fill('QA leap-day event');
 await form.locator('[name=allDay]').check();await form.locator('button[type=submit]').click();
 await expect(page.locator('#day-agenda')).toContainText('QA leap-day event');
 await page.locator('#day-agenda [data-edit]').first().click();await form.locator('[name=title]').fill('QA edited event');await form.locator('button[type=submit]').click();
 await page.locator('#daily-note').fill('QA saved note');await page.locator('#save-note').click();
 await page.locator('#task-title').fill('QA task');await page.locator('#task-form button').click();
 await page.locator('#tasks [data-task-toggle]').check();
 await page.reload();await expect(page.locator('#day-agenda')).toContainText('QA edited event');
 await expect(page.locator('#daily-note')).toHaveValue('QA saved note');await expect(page.locator('#tasks [data-task-toggle]')).toBeChecked();
 const exported=await downloadBytes(page,()=>page.locator('#export-ics').click());expect(ics(exported.bytes)).toContain('QA edited event');
 await page.locator('#day-agenda [data-edit]').first().click();await page.locator('#delete-event').click();
 await expect(page.locator('#day-agenda')).not.toContainText('QA edited event');await expect(page.locator('#daily-note')).toHaveValue('QA saved note');
});

test('calendar views and period navigation update actual state',async({page})=>{
 await page.goto('/?data=2028-02-29');
 for(const view of ['week','day','agenda','year','month']){await page.locator(`[data-view=${view}]`).click();await expect(page.locator(`[data-view=${view}]`)).toHaveAttribute('aria-pressed','true');}
 await expect(page.locator('#period-title')).toContainText('vasaris');await page.locator('#next').click();await expect(page.locator('#period-title')).toContainText('kovas');
 await page.locator('#prev').click();await expect(page.locator('#period-title')).toContainText('vasaris');
});

test('date calculator handles leap-day difference, inclusive endpoints and ISO week',async({page})=>{
 await page.goto('/datos-skaiciuokle/');const f=page.locator('#calculator');
 await f.locator('[name=start]').fill('2028-02-28');await f.locator('[name=end]').fill('2028-03-01');await f.locator('[name=offset]').fill('1');await f.locator('button').click();
 await expect(page.locator('#calc-result .calculator-results strong').first()).toHaveText('2');
 await f.locator('[name=inclusive]').check();await f.locator('button').click();await expect(page.locator('#calc-result .calculator-results strong').first()).toHaveText('3');
 await page.locator('#iso-date').fill('2028-01-01');await page.locator('#iso-date').press('Tab');await expect(page.locator('#iso-result')).toContainText('52');
});

test('workweek selector changes visible table and CSV exports real content',async({page})=>{
 await page.goto('/darbo-dienos/2028/');await page.locator('#work-schedule').selectOption('6');
 await expect(page.locator('[data-work-table="6"]')).toBeVisible();await expect(page.locator('[data-work-table="5"]')).toBeHidden();
 const result=await downloadBytes(page,()=>page.locator('#work-csv').click());expect(result.file.suggestedFilename()).toMatch(/\.csv$/);expect(result.file.suggestedFilename()).toContain('2028');expect(result.bytes.length).toBeGreaterThan(100);
});

test('calendar builder renders leap month and print template picker downloads valid PDF',async({page})=>{
 await page.goto('/kurti-kalendoriu/?metai=2028&menuo=2');
 await page.locator('#generator [name=year]').fill('2028');await page.locator('#generator [name=month]').selectOption('2');
 await page.locator('#generator button[type=submit]').click();await expect(page.locator('#generator-preview svg')).toBeVisible();await expect(page.locator('#generator-preview')).toContainText('29');
 await page.goto('/2028/vasaris/');const picker=page.locator('#design-picker');
 const values=await picker.locator('option').evaluateAll(es=>es.map(e=>e.value));await picker.selectOption(values[1]);
 await expect(page.locator('.design-card.selected-design')).toHaveAttribute('id',`dizainas-${values[1]}`);
 const pdf=await downloadBytes(page,()=>page.locator('#selected-pdf').click());expect(pdf.bytes.subarray(0,4).toString()).toBe('%PDF');
});

test('holiday year switching updates exact Easter dates, ICS and calendar prefill',async({page})=>{
 await page.goto('/sventes/velykos/');await page.locator('[data-hd-select="2028"]').click();
 await expect(page.locator('[data-hd-year="2028"]')).toBeVisible();await expect(page.locator('[data-hd-year="2027"]')).toBeHidden();
 await expect(page.locator('[data-hd-selected-date]')).toContainText('2028');
 const calendar=await downloadBytes(page,()=>page.locator('[data-hd-year="2028"] a[download]').click());expect(ics(calendar.bytes)).toContain('20280416');
 await page.locator('[data-hd-year="2028"] .hd-my-calendar').first().click();
 await expect(page.locator('#event-dialog')).toBeVisible();await expect(page.locator('#event-form [name=startDate]')).toHaveValue('2028-04-16');
 await expect(page.locator('#event-form [name=title]')).toHaveValue(/Velykos/);await page.locator('#close-event').click();
});

test('monthly holiday query, empty state, reset and date selection work',async({page})=>{
 await page.goto('/sventes/2027/sausis/');await page.locator('#mh-search').fill('asdcxz_no_such_term');await expect(page.locator('.mh-empty')).toBeVisible();
 await page.locator('[data-reset]').click();await expect(page.locator('.mh-empty')).toBeHidden();
 await page.locator('[data-day="2027-01-13"]').click();await expect(page.locator('#mh-day-info')).toContainText('13');
});

test('name search prefill, leap date and recurring ICS export keep real names',async({page})=>{
 await page.goto('/vardadieniai/?q=Jonas');await expect(page.locator('#nd-query')).toHaveValue('Jonas');await expect(page.locator('#nd-results')).toContainText('Jonas');
 await page.locator('#nd-date').fill('2028-02-29');await page.locator('#nd-date').press('Tab');await expect(page.locator('#nd-selected-names')).toContainText('Gustis');
 await page.locator('#nd-recurring').check();const result=await downloadBytes(page,()=>page.locator('#nd-ics').click());const text=ics(result.bytes);expect(text).toContain('20280229');expect(text).toContain('FREQ=YEARLY');
 await page.locator('#nd-year').selectOption('2027');await expect(page.locator('#nd-date')).toHaveValue('2028-02-29');await expect(page.locator('#nd-feedback')).toContainText('keliamaisiais');
});

test('zodiac wheel, finder, invalid date, filters and comparison respond',async({page})=>{
 await page.goto('/zodiakas/');await expect(page.locator('.zodiac-guide')).toHaveAttribute('data-ready','true');
 await page.locator('[data-wheel-sign]').first().press('ArrowRight');await expect(page.locator('#z-wheel-name')).toHaveText('Jautis');
 await page.locator('#z-month').selectOption('2');await page.locator('#z-day').fill('29');await page.locator('#z-finder button[type=submit]').click();await expect(page.locator('#z-finder-result')).toContainText('Žuvys');
 await page.locator('#z-month').selectOption('4');await page.locator('#z-day').fill('31');await page.locator('#z-finder button[type=submit]').click();await expect(page.locator('#z-finder-result')).toHaveClass(/--error/);
 await page.locator('[data-element-filter="water"]').click();await expect(page.locator('[data-sign-card]:visible')).toHaveCount(3);
 await page.locator('#z-compare-first').selectOption('zuvys');await expect(page.locator('#z-compare-a [data-compare-name]')).toHaveText('Žuvys');
});

test('ascendant computes valid input and rejects unknown cities',async({page})=>{
 await page.goto('/horoskopai/avinas/');await page.locator('#birth-date').fill('1990-01-15');await page.locator('#birth-time').fill('12:00');await page.locator('#birth-city').fill('Vilnius');
 await page.locator('#ascendant-form button[type=submit]').click();await expect(page.locator('#ascendant-result')).toBeVisible();await expect(page.locator('#ascendant-result')).not.toHaveClass(/--error/);
 await page.locator('#birth-city').fill('QA nonexistent city');await page.locator('#ascendant-form button[type=submit]').click();await expect(page.locator('#ascendant-result')).toHaveClass(/--error/);
});

test('sun city/date and simulation moment update the displayed calculations',async({page})=>{
 await page.goto('/saule/');await page.locator('#sun-city').selectOption('kaunas');await page.locator('#sun-date').fill('2028-02-29');await page.locator('#sun-date').press('Tab');
 await expect(page.locator('#sun-summary')).toContainText('Kaunas');await expect(page.locator('#sun-rows tr')).toHaveCount(29);
 await page.locator('[data-sun-moment="sunset"]').click();
 // The visualization slider has 1000 steps across daylight; its rounded
 // simulation moment can differ from the exact event label by one minute.
 const minute=text=>{const [h,m]=text.trim().split(':').map(Number);return h*60+m;};
 const simulated=minute(await page.locator('#sun-sim-output').innerText());
 const actual=minute(await page.locator('#sunset-time').innerText());
 expect(Math.abs(simulated-actual)).toBeLessThanOrEqual(1);
});

test('seasons year/city and orbit selector preserve context in navigation and ICS',async({page})=>{
 await page.goto('/pavasario-lygiadienis/');await expect(page.locator('.sp3')).toHaveAttribute('data-ready','true');
 await page.locator('#sp3-year').selectOption('2029');await page.locator('#sp3-city').selectOption('kaunas');await expect(page.locator('#sp3-status')).toContainText('Kaunas · 2029');
 await page.locator('[data-step="1"]').click();await expect(page.locator('#sp3-diagram-name')).toContainText('Vasaros');
 await expect(page.locator('a[href^="/vasaros-saulegriza/"]').first()).toHaveAttribute('href',/metai=2029.*miestas=kaunas/);
 const result=await downloadBytes(page,()=>page.locator('[data-ics]').first().click());ics(result.bytes);
});

test('lunar leap-date selection, keyboard movement, ICS and lightbox work',async({page})=>{
 await page.goto('/menulio-kalendorius/2028/vasaris/');await page.locator('[data-selected-date]').fill('2028-02-29');await page.locator('[data-selected-date]').press('Tab');
 await expect(page.locator('[data-lunar-date="2028-02-29"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('[data-lunar-date="2028-02-29"]').press('ArrowLeft');await expect(page.locator('[data-selected-date]')).toHaveValue('2028-02-28');
 const result=await downloadBytes(page,()=>page.locator('[data-all-ics]').click());ics(result.bytes);
 const zoom=page.locator('[data-zoom]').first();await zoom.click();await expect(page.locator('.lunar-lightbox')).toBeVisible();await page.locator('.lunar-lightbox button').click();await expect(page.locator('.lunar-lightbox')).toBeHidden();
});

test('shift planner generates a real cycle, validates bad JSON and exports ICS',async({page})=>{
 await page.goto('/pamainu-grafikas/');await page.locator('#shift-anchor').fill('2028-02-28');await page.locator('#shift-from').fill('2028-02-28');await page.locator('#shift-to').fill('2028-03-06');
 await page.locator('#shift-planner button[type=submit]').click();await expect(page.locator('#shift-rows tr')).toHaveCount(4);
 const result=await downloadBytes(page,()=>page.locator('#shift-ics').click());expect(ics(result.bytes)).toContain('20280229');
 await page.locator('#shift-definitions').fill('{bad');await page.locator('#shift-planner button[type=submit]').click();await expect(page.locator('#shift-message')).toHaveAttribute('role','alert');await expect(page.locator('#shift-rows tr')).toHaveCount(0);
});

test('school lesson text edits persist after reload and duplication can be undone',async({page})=>{
 await page.goto('/?data=2028-02-29');
 await page.locator('#daily-note').fill('QA saved note');await page.locator('#save-note').click();
 await page.goto('/pamoku-tvarkarastis/');await page.locator('#lesson-add').click();
 const subject=page.getByLabel('Pirmadienis, 1 pamoka: dalykas',{exact:true});await subject.fill('Lietuvių kalba');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('k365:phase568:school:v1')||'{}').lessons?.[0]?.subject)).toBe('Lietuvių kalba');
 await subject.press('Tab');
 await page.getByLabel('Pirmadienis, 1 pamoka: kabinetas',{exact:true}).fill('205A');await page.getByLabel('Pirmadienis, 1 pamoka: kabinetas',{exact:true}).press('Tab');
 await page.getByLabel('Pirmadienis, 1 pamoka: mokytojo trumpinys',{exact:true}).fill('Ž. Jonaitė');await page.getByLabel('Pirmadienis, 1 pamoka: mokytojo trumpinys',{exact:true}).press('Tab');
 await page.reload();await expect(subject).toHaveValue('Lietuvių kalba');await expect(page.getByLabel('Pirmadienis, 1 pamoka: kabinetas',{exact:true})).toHaveValue('205A');
 await page.locator('#school-duplicate-week').click();await expect(page.locator('#school-lessons tr')).toHaveCount(5);await page.locator('#school-undo').click();await expect(page.locator('#school-lessons tr')).toHaveCount(1);
 const backup=await downloadBytes(page,()=>page.locator('#school-json-export').click());expect(JSON.parse(backup.bytes).lessons[0].teacher).toBe('Ž. Jonaitė');
 await page.getByRole('button',{name:'Pirmadienis 1 pamoką pašalinti'}).click();await expect(page.locator('#school-lessons tr')).toHaveCount(0);
 await expect(page.locator('#school-message')).toHaveText('Pamoka pašalinta.');
 await page.goto('/?data=2028-02-29');await expect(page.locator('#daily-note')).toHaveValue('QA saved note');
});

test('leave planner produces inspectable date rows and a valid ICS',async({page})=>{
 await page.goto('/atostogu-planavimas/');await page.locator('#leave-planner [name=year]').selectOption('2028');await page.locator('#leave-planner [name=budget]').fill('5');await page.locator('#leave-planner button[type=submit]').click();
 await expect(page.locator('#leave-results .leave-result-card').first()).toBeVisible();const card=page.locator('#leave-results .leave-result-card').first();
 await card.getByRole('button',{name:'Dienų eiga',exact:true}).click();await expect(page.locator('#leave-detail tbody tr').first()).toBeVisible();
 const result=await downloadBytes(page,()=>card.getByRole('button',{name:'Atsisiųsti ICS',exact:true}).click());ics(result.bytes);
});

test('contact topic, validation and address copy work without sending a message',async({page,context})=>{
 await context.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{window.__copiedContact=value;}}}));
 await page.goto('/kontaktai/?tema=technical&puslapis=https%3A%2F%2Fkalendorius365.lt%2F2028%2F%3Fq%3Dprivate');
 await expect(page.locator('#contact-topic')).toHaveValue('technical');
 await expect(page.locator('#contact-page-url')).toHaveValue('https://kalendorius365.lt/2028/');
 await page.locator('[data-contact-submit]').click();await expect(page.locator('#contact-email')).toHaveAttribute('aria-invalid','true');
 await page.locator('#contact-email').fill('qa@example.test');await page.locator('#contact-email').press('Tab');
 await expect(page.locator('#contact-email')).not.toHaveAttribute('aria-invalid','true');
 await page.locator('#contact-page-url').fill('https://example.test/');await page.locator('#contact-page-url').press('Tab');
 await expect(page.locator('#contact-page-error')).toBeVisible();
 await page.locator('[data-topic="namedays"]').click();await expect(page.locator('#contact-topic')).toHaveValue('namedays');
 await page.locator('[data-copy-email]').click();await expect(page.locator('[data-copy-status]')).toHaveText('El. pašto adresas nukopijuotas.');
 expect(await page.evaluate(()=>window.__copiedContact)).toBe('kalendorius365@gmail.com');
});
