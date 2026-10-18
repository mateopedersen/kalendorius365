import {openHeaderSearch} from './header-helpers.mjs';
import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

// Every test gets a fresh browser context. Only synthetic data is created, and
// the consent key is set explicitly rather than clearing any browser storage.
test.beforeEach(async({context})=>{
 await context.addInitScript(()=>localStorage.setItem('kalendorius365:privacy-notice:v1','dismissed'));
});
const downloadBytes=async(page,action)=>{
 const [file]=await Promise.all([page.waitForEvent('download'),action()]);
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
 await page.goto('/2028/');await openHeaderSearch(page);await page.locator('#site-search').fill('saulėlydis Kaune');
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
 // Full backup/event journeys include several navigations, dialogs and downloads.
 test.setTimeout(90000);
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
 await f.locator('[name=start]').fill('2028-02-28');await f.locator('[name=end]').fill('2028-03-01');await f.locator('[name=offset]').fill('1');await f.locator('button[type="submit"]').click();
 await expect(page.locator('#calc-result .calculator-results strong').first()).toHaveText('2');
 await f.locator('[name=inclusive]').check();await f.locator('button[type="submit"]').click();await expect(page.locator('#calc-result .calculator-results strong').first()).toHaveText('3');
 await page.locator('#iso-date').fill('2028-01-01');await page.locator('#iso-date').press('Tab');await expect(page.locator('#iso-result')).toContainText('52');
});

test('date calculator skips Lithuanian holidays for workday offsets and shares a reusable result',async({page})=>{
 await page.setViewportSize({width:320,height:812});
 await page.goto('/datos-skaiciuokle/?nuo=2027-06-23&iki=2027-06-25&imtinai=1&poslinkis=1&vienetas=darbo');
 const form=page.locator('#calculator');
 await expect(form.locator('[name=start]')).toHaveValue('2027-06-23');
 await expect(form.locator('[name=end]')).toHaveValue('2027-06-25');
 await expect(form.locator('[name=inclusive]')).toBeChecked();
 await expect(form.locator('[name=offset-unit]')).toHaveValue('workday');
 const cards=page.locator('#calc-result .calculator-results > div');
 await expect(cards).toHaveCount(4);
 await expect(cards.nth(0)).toContainText('3');await expect(cards.nth(0)).toContainText('Kalendorinės dienos');
 await expect(cards.nth(1)).toContainText('2');await expect(cards.nth(1)).toContainText('Darbo dienos');
 await expect(cards.nth(2)).toContainText('0');await expect(cards.nth(2)).toContainText('Savaitgalio dienos');
 await expect(cards.nth(3)).toContainText('1');await expect(cards.nth(3)).toContainText('Šventės darbo dienomis');
 await expect(page.locator('#calc-result')).toContainText('penktadienis');
 await expect(page.locator('#calc-chart svg')).toHaveAttribute('aria-label',/2 darbo dienų, 0 savaitgalio dienų ir 1 šventinių darbo dienų/);
 const geometry=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
 expect(geometry.scroll,JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.viewport+1);
 await page.evaluate(()=>{
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__copiedDateResult=value;}}});
  Object.defineProperty(navigator,'share',{configurable:true,value:async value=>{window.__sharedDateResult=value;}});
 });
 await page.locator('#share-date-result').click();
 await expect(page.locator('#date-calculator-status')).toHaveText('Nuoroda paruošta dalytis.');
 const shared=await page.evaluate(()=>window.__sharedDateResult);
 const url=new URL(shared.url);expect(url.searchParams.get('nuo')).toBe('2027-06-23');expect(url.searchParams.get('iki')).toBe('2027-06-25');
 expect(url.searchParams.get('imtinai')).toBe('1');expect(url.searchParams.get('poslinkis')).toBe('1');expect(url.searchParams.get('vienetas')).toBe('darbo');
 await page.locator('#copy-date-result').click();
 await expect(page.locator('#date-calculator-status')).toHaveText('Rezultatas nukopijuotas.');
 expect(await page.evaluate(()=>window.__copiedDateResult)).toContain('šventės darbo dienomis: 1');
});

test('workweek selector changes visible table and CSV exports real content',async({page})=>{
 await page.goto('/darbo-dienos/2028/');await page.locator('#work-schedule').selectOption('6');
 await expect(page.locator('[data-work-table="6"]')).toBeVisible();await expect(page.locator('[data-work-table="5"]')).toBeHidden();
 const result=await downloadBytes(page,()=>page.locator('#work-csv').click());expect(result.file.suggestedFilename()).toMatch(/\.csv$/);expect(result.file.suggestedFilename()).toContain('2028');expect(result.bytes.length).toBeGreaterThan(100);
});

test('2027 workday planner updates Saturday status when the schedule changes',async({page})=>{
 for(const year of [2027,2028,2029]){
  await page.goto(`/darbo-dienos/${year}/`);await expect(page.locator('body')).toHaveClass(/tool-workdays/);
  const layout=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));expect(layout.content,JSON.stringify(layout)).toBeLessThanOrEqual(layout.viewport+1);
 }
 await page.goto('/darbo-dienos/2027/');const date=page.locator('#workday-check-date'),result=page.locator('#workday-check-result');
 await date.fill('2027-01-09');await date.blur();await page.locator('#workday-check-form button[type=submit]').click();
 await expect(result).toHaveAttribute('data-state','rest');await expect(result).toContainText('Poilsio diena');
 await page.locator('#work-schedule').selectOption('6');await expect(result).toHaveAttribute('data-state','work');await expect(result).toContainText('5 darbo val.');
 await expect(page.locator('[data-work-table="6"]')).toBeVisible();await expect(page.locator('[data-work-table="5"]')).toBeHidden();
});

test('blank-calendar gallery filters on mobile, changes 5/6-row downloads and exports valid PDF',async({page})=>{
 await page.setViewportSize({width:320,height:812});await page.goto('/tuscias-kalendorius/');
 const select=page.locator('#dizainas-tuscias-01-5-eilutes [data-blank-rows]');await expect(select).toBeVisible();
 await expect(select).toHaveValue('tuscias-01-5-eilutes');
 await select.selectOption('tuscias-01-6-eilutes');await expect(select).toHaveValue('tuscias-01-6-eilutes');
 await expect(page.locator('#selected-preview')).toHaveAttribute('src',/tuscias-01-6-eilutes\.webp/);
 await expect(page.locator('#preview-format')).toContainText('6 eilutės');
 const download=page.locator('#selected-pdf');await expect(download).toHaveAttribute('download','tuscias-01-6-eilutes.pdf');await expect(download).toHaveAttribute('href',/tuscias-01-6-eilutes\.pdf/);
 const school=page.locator('[data-design-filter="school"]');await school.click();await expect(school).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-blank-section="month"]')).toBeHidden();await expect(page.locator('[data-blank-section="school"]')).toBeVisible();
 await page.locator('[data-design-filter="all"]').click();await expect(page.locator('[data-blank-section="month"]')).toBeVisible();
 const geometry=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));expect(geometry.scroll,JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.viewport+1);
 const pdf=await downloadBytes(page,()=>download.click());expect(pdf.bytes.subarray(0,5).toString()).toBe('%PDF-');
});

test('calendar builder renders leap month and print template picker downloads valid PDF',async({page})=>{
 await page.goto('/kurti-kalendoriu/?metai=2028&menuo=2');
 await expect(page.locator('#calendar-editor [data-path="period.year"]')).toHaveValue('2028');await expect(page.locator('#calendar-editor [data-path="period.month"]')).toHaveValue('2');
 const previewTab=page.locator('[data-action="tab-preview"]');if(await previewTab.isVisible())await previewTab.click();await expect(page.locator('#ce-paper svg')).toBeVisible();await expect(page.locator('#ce-paper')).toContainText('29');
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
 await expect(page.locator('.dashboard')).toHaveAttribute('aria-busy','false');
 await page.locator('#daily-note').fill('QA saved note');await page.locator('#save-note').click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('kalendorius365:v1')||'{}').notes?.['2028-02-29'])).toBe('QA saved note');
 await page.goto('/pamoku-tvarkarastis/');await page.locator('#lesson-add').click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('kalendorius365:v1')||'{}').notes?.['2028-02-29'])).toBe('QA saved note');
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
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('kalendorius365:v1')||'{}').notes?.['2028-02-29'])).toBe('QA saved note');
 await page.goto('/?data=2028-02-29');await expect(page.locator('.dashboard')).toHaveAttribute('aria-busy','false');await expect(page.locator('#daily-note')).toHaveValue('QA saved note');
});

test('leave planner produces inspectable date rows and a valid ICS',async({page})=>{
 await page.goto('/atostogu-planavimas/');await page.locator('#leave-planner [name=year]').selectOption('2028');await page.locator('#leave-planner [name=budget]').fill('5');await page.locator('#leave-planner button[type=submit]').click();
 await expect(page.locator('#leave-results .leave-result-card').first()).toBeVisible();const card=page.locator('#leave-results .leave-result-card').first();
 await card.getByRole('button',{name:'Dienų eiga',exact:true}).click();await expect(page.locator('#leave-detail tbody tr').first()).toBeVisible();
 const result=await downloadBytes(page,()=>card.getByRole('button',{name:'Atsisiųsti ICS',exact:true}).click());ics(result.bytes);
});

test('contact Google form prefill, source link and email copy work without sending a message',async({page,context})=>{
 await context.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{window.__copiedContact=value;}}}));
 await page.route('https://docs.google.com/forms/**',route=>route.abort());
 await page.goto('/kontaktai/?tema=technical&puslapis=https%3A%2F%2Fkalendorius365.lt%2F2028%2F%3Fq%3Dprivate');
 const frame=page.locator('[data-contact-frame]');
 await expect(frame).toHaveAttribute('data-src',/entry.122884581=/);
 await expect(page.locator('[data-contact-launch]')).toBeVisible();
 await page.locator('[data-contact-launch]').click();
 await expect(frame).toHaveAttribute('src',/entry.122884581=/);
 await expect(frame).toBeVisible();
 const source=new URL(await frame.getAttribute('src'));
 expect(source.origin).toBe('https://docs.google.com');expect(source.searchParams.get('embedded')).toBe('true');
 expect(source.searchParams.get('entry.122884581')).toBe('Techninė problema');expect(source.searchParams.get('entry.1784264088')).toBe('https://kalendorius365.lt/2028/');
 await expect(page.locator('[data-contact-source-link]')).toHaveAttribute('href','https://kalendorius365.lt/2028/');
 const topic=new URL(await page.locator('[data-topic="namedays"]').getAttribute('href'));expect(topic.searchParams.get('entry.122884581')).toBe('Vardadieniai ir šventės');
 for(const link of await page.locator('[data-open-contact-form]').all())await expect(link).toHaveAttribute('href',/docs.google.com\/forms\//);
 await page.locator('[data-copy-email]').click();await expect(page.locator('[data-copy-status]')).toHaveText('El. pašto adresas nukopijuotas.');
 expect(await page.evaluate(()=>window.__copiedContact)).toBe('kalendorius365@gmail.com');
});
