import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

// All records below belong to a new, disposable test browser context.
test.beforeEach(async({context})=>{
 await context.addInitScript(()=>{try{localStorage.setItem('kalendorius365:privacy-notice:v1','dismissed');localStorage.removeItem('k365:phase568:shift:v1');}catch{}});
});
const exported=async(page,selector)=>{
 const [file]=await Promise.all([page.waitForEvent('download'),page.locator(selector).click()]);
 expect(await file.failure()).toBeNull();return fs.readFile(await file.path());
};
const upload=(name,bytes)=>({name,mimeType:'application/json',buffer:bytes});

test('homepage blocks note controls until its calendar data and handlers are ready',async({page})=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/data/calendar.json',async route=>{await gate;await route.continue();});
 const navigation=page.goto('/?data=2028-02-29');
 try {
  await expect(page.locator('.dashboard')).toHaveAttribute('aria-busy','true');
  expect(await page.locator('.dashboard').evaluate(el=>el.inert)).toBe(true);
 } finally {release();}
 await navigation;
 await expect(page.locator('.dashboard')).toHaveAttribute('aria-busy','false');
 await page.locator('#daily-note').fill('Ready only after startup');await page.locator('#save-note').click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('kalendorius365:v1')||'{}').notes?.['2028-02-29'])).toBe('Ready only after startup');
});

test('shift planner does not accept and discard input before required data loads',async({page})=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/data/calendar.json',async route=>{await gate;await route.continue();});
 try {
  await page.goto('/pamainu-grafikas/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#shift-planner')).toHaveAttribute('aria-busy','true');
  expect(await page.locator('#shift-planner').evaluate(el=>el.inert)).toBe(true);
  release();await expect(page.locator('#shift-planner')).not.toHaveAttribute('aria-busy');
  await page.locator('#shift-preset').selectOption('day-night');await expect(page.locator('#shift-cycle')).toHaveValue('D,D,N,N,P,P,P,P');
  expect(await page.locator('#shift-planner').evaluate(el=>el.inert)).toBe(false);
 } finally {release();}
});

test('date calculator keeps browser-filled dates while its calendar data is loading',async({page})=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/data/calendar.json',async route=>{await gate;await route.continue();});
 const navigation=page.goto('/datos-skaiciuokle/',{waitUntil:'domcontentloaded'});
 try{
  const form=page.locator('#calculator');await expect(form).toHaveAttribute('aria-busy','true');
  expect(await form.evaluate(element=>element.inert)).toBe(true);
  // Simulate date autofill arriving before the async module; initialization must preserve it.
  await page.evaluate(()=>{document.querySelector('[name=start]').value='2028-02-28';document.querySelector('[name=end]').value='2028-03-01';document.querySelector('#countdown-date').value='2028-03-10';});
 }finally{release();}
 await navigation;const form=page.locator('#calculator');await expect(form).toHaveAttribute('aria-busy','false');
 await expect(form.locator('[name=start]')).toHaveValue('2028-02-28');await expect(form.locator('[name=end]')).toHaveValue('2028-03-01');
 await expect(page.locator('#countdown-date')).toHaveAttribute('aria-busy','false');await expect(page.locator('#countdown-date')).toHaveValue('2028-03-10');await expect(page.locator('#countdown-result')).toContainText('2028 m. kovo 10 d.');
 await expect(page.locator('#calc-result .calculator-results strong').first()).toHaveText('2');
});

test('ISO date input survives async tool startup without being reset',async({page})=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/data/calendar.json',async route=>{await gate;await route.continue();});
 const navigation=page.goto('/savaites/2027/',{waitUntil:'domcontentloaded'});
 try{
  const input=page.locator('#iso-date');await expect(input).toHaveAttribute('aria-busy','true');
  expect(await input.evaluate(element=>element.inert)).toBe(true);
  await page.evaluate(()=>{document.querySelector('#iso-date').value='2028-02-29';});
 }finally{release();}
 await navigation;await expect(page.locator('#iso-date')).toHaveAttribute('aria-busy','false');
 await expect(page.locator('#iso-date')).toHaveValue('2028-02-29');await expect(page.locator('#iso-result')).toContainText('2028 metų');
});

test('workday date control stays inert until its holiday data and calculation are ready',async({page})=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/data/calendar.json',async route=>{await gate;await route.continue();});
 const navigation=page.goto('/darbo-dienos/2027/',{waitUntil:'domcontentloaded'});
 try{
  const form=page.locator('#workday-check-form');await expect(form).toHaveAttribute('aria-busy','true');
  expect(await form.evaluate(element=>element.inert)).toBe(true);
  await page.evaluate(()=>{document.querySelector('#workday-check-date').value='2027-01-09';});
 }finally{release();}
 await navigation;await expect(page.locator('#workday-check-form')).toHaveAttribute('aria-busy','false');
 await expect(page.locator('#workday-check-date')).toHaveValue('2027-01-09');
 await expect(page.locator('#workday-check-result')).toHaveAttribute('data-state','rest');
 await expect(page.locator('#workday-check-result')).toContainText('Poilsio diena');
});

test('school startup does not wait for unrelated calendar or astronomy data',async({page})=>{
 const requests=[];await page.route('**/data/**/*.json',route=>{requests.push(route.request().url());return route.abort();});
 await page.goto('/pamoku-tvarkarastis/');await page.locator('#lesson-add').click();
 await expect(page.locator('#school-lessons tr')).toHaveCount(1);expect(requests).toEqual([]);
});

test('calendar backups round trip, malformed imports preserve data and deletion keeps preferences',async({page})=>{
 // Full backup/event journeys include several navigations, dialogs and downloads.
 test.setTimeout(90000);
 await page.goto('/?data=2028-02-29');
 await expect(page.locator('.dashboard')).toHaveAttribute('aria-busy','false');
 await page.locator('#daily-note').fill('Disposable QA note');await page.locator('#save-note').click();
 await page.locator('#hour12').check();
 const backup=await exported(page,'#backup');
 expect(JSON.parse(backup).notes['2028-02-29']).toBe('Disposable QA note');
 await page.locator('#restore').click();await page.locator('#restore-cancel').click();
 await expect(page.locator('#restore-dialog')).toBeHidden();
 await page.locator('#json-file').setInputFiles(upload('invalid.json',Buffer.from('{bad')));
 await expect(page.locator('#daily-note')).toHaveValue('Disposable QA note');
 await page.locator('#delete-personal-data').click();await page.locator('#delete-data-cancel').click();
 await expect(page.locator('#daily-note')).toHaveValue('Disposable QA note');
 await page.locator('#delete-personal-data').click();await page.locator('#delete-data-confirm').click();
 await expect(page.locator('#daily-note')).toHaveValue('');await expect(page.locator('#hour12')).toBeChecked();
 await page.locator('#restore').click();
 const pending=page.waitForEvent('filechooser');await page.locator('#restore-confirm').click();
 await (await pending).setFiles(upload('qa-backup.json',backup));
 await expect(page.locator('#daily-note')).toHaveValue('Disposable QA note');
 await page.reload();await expect(page.locator('#daily-note')).toHaveValue('Disposable QA note');await expect(page.locator('#hour12')).toBeChecked();
});

test('task editing, filtering, deletion and appearance preferences update persisted state',async({page,context})=>{
 await context.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{window.__sharedURL=value;}}}));
 await page.goto('/?data=2028-02-29');await expect(page.locator('.dashboard')).toHaveAttribute('aria-busy','false');await page.locator('#task-title').fill('Disposable task');await page.locator('#task-form button').click();
 await page.locator('[data-task-edit]').click();await page.locator('#task-edit-form [name=title]').fill('Renamed task');await page.locator('#task-edit-form button[type=submit]').click();
 await expect(page.locator('#tasks')).toContainText('Renamed task');
 await page.locator('[data-task-toggle]').check();await page.locator('#task-filter').selectOption('open');await expect(page.locator('[data-task-edit]')).toHaveCount(0);
 await page.locator('#task-filter').selectOption('done');await expect(page.locator('[data-task-edit]')).toHaveCount(1);
 await page.locator('[data-task-delete]').click();await expect(page.locator('[data-task-toggle]')).toHaveCount(0);
 await page.locator('#large-text').check();await page.locator('#high-contrast').check();
 await page.locator('#share').click();expect(await page.evaluate(()=>window.__sharedURL)).toBe('https://kalendorius365.lt/');
 await page.reload();await expect(page.locator('html')).toHaveClass(/large-text/);await expect(page.locator('html')).toHaveClass(/high-contrast/);
 await expect(page.locator('[data-task-toggle]')).toHaveCount(0);
});

test('school homework, formats, clear undo and JSON restore preserve synthetic records',async({page})=>{
 await page.goto('/pamoku-tvarkarastis/');await page.locator('#lesson-add').click();
 await page.locator('#school-title').fill('QA timetable');await page.locator('#school-title').press('Tab');
 await page.locator('#school-days').selectOption('6');await page.locator('#school-template').selectOption('compact');
 await page.locator('#homework-subject').fill('Matematika');await page.locator('#homework-task').fill('QA exercise');await page.locator('#homework-due').fill('2028-02-29');
 await page.locator('#homework-form button').click();await page.locator('#homework-list input').check();
 const backup=await exported(page,'#school-json-export');
 await page.locator('#school-clear-week').click();await expect(page.locator('#school-lessons tr')).toHaveCount(0);
 await page.locator('#school-undo').click();await expect(page.locator('#school-lessons tr')).toHaveCount(1);
 page.once('dialog',dialog=>dialog.accept());await page.locator('#school-reset').click();
 await expect(page.locator('#homework-list li')).toHaveCount(0);
 await page.locator('#school-json-import').setInputFiles(upload('school.json',backup));
 await expect(page.locator('#school-title')).toHaveValue('QA timetable');await expect(page.locator('#school-days')).toHaveValue('6');await expect(page.locator('#school-template')).toHaveValue('compact');
 await expect(page.locator('#school-lessons tr')).toHaveCount(1);await expect(page.locator('#homework-list input')).toBeChecked();
 await page.getByRole('button',{name:'Pašalinti',exact:true}).click();await expect(page.locator('#homework-list li')).toHaveCount(0);
});

test('name-day filters, more results, reset and calendar insertion respond',async({page})=>{
 await page.goto('/vardadieniai/');await page.locator('#nd-query').fill('');
 await expect(page.locator('#nd-results>li')).toHaveCount(12);await page.locator('#nd-more').click();await expect(page.locator('#nd-results>li')).toHaveCount(24);
 await page.locator('[data-letter="J"]').click();await expect(page.locator('[data-letter="J"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#nd-month-filter').selectOption('6');await page.locator('#nd-reset').click();await expect(page.locator('#nd-month-filter')).toHaveValue('');
 await page.locator('#nd-query').fill('Jonas');await page.locator('#nd-results a').first().click();await expect(page.locator('#nd-export-name')).toHaveValue('Jonas');
 await page.locator('#nd-add').click();await expect(page.locator('#nd-feedback')).toContainText('Išsaugota');
 await page.locator('#nd-add').click();await expect(page.locator('#nd-feedback')).toContainText('jau įtrauktas');
 const expectedDates=await page.evaluate(()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Vilnius',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const values=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));const today=`${values.year}-${values.month}-${values.day}`;const tomorrow=new Date(`${today}T12:00:00Z`);tomorrow.setUTCDate(tomorrow.getUTCDate()+1);return{today,tomorrow:tomorrow.toISOString().slice(0,10)};});
 await page.locator('#nd-tomorrow').click();await expect(page.locator('#nd-date')).toHaveValue(expectedDates.tomorrow);
 await page.locator('#nd-today').click();await expect(page.locator('#nd-date')).toHaveValue(expectedDates.today);
 await page.locator('#nd-live-day .nd-tomorrow a').click();await expect(page.locator('#nd-date')).toHaveValue(expectedDates.tomorrow);
});

test('shift presets, view controls and JSON restore retain the chosen cycle',async({page})=>{
 await page.goto('/pamainu-grafikas/');await expect(page.locator('#shift-planner')).toHaveJSProperty('inert',false);await page.locator('#shift-preset').selectOption('day-rest');await page.locator('#shift-preset').selectOption('day-night');await expect(page.locator('#shift-cycle')).toHaveValue('D,D,N,N,P,P,P,P');
 for(const view of ['month','week','year','list']){await page.locator('#shift-display').selectOption(view);await expect(page.locator('#shift-display')).toHaveValue(view);}
 await page.locator('#shift-week-filter').selectOption('custom');await expect(page.locator('#shift-custom-days')).toBeVisible();
 await page.locator('#shift-custom-days-list input').first().uncheck();
 const backup=await exported(page,'#shift-json-export');await page.locator('#shift-preset').selectOption('day-rest');
 await page.locator('#shift-json-import').setInputFiles(upload('shifts.json',backup));await expect(page.locator('#shift-cycle')).toHaveValue('D,D,N,N,P,P,P,P');
 await expect(page.locator('#shift-custom-days-list input').first()).not.toBeChecked();
});

test('lunar month vertical arrow keys select the adjacent week and update details',async({page})=>{
 await page.goto('/menulio-kalendorius/2028/vasaris/');
 await page.locator('[data-lunar-date="2028-02-15"]').click();await page.locator('[data-lunar-date="2028-02-15"]').press('ArrowUp');
 await expect(page.locator('[data-selected-date]')).toHaveValue('2028-02-08');
 await page.locator('[data-lunar-date="2028-02-08"]').press('ArrowDown');await expect(page.locator('[data-selected-date]')).toHaveValue('2028-02-15');
 await expect(page.locator('[data-selected-details]')).not.toBeEmpty();
});

test('lunar selection keeps the latest keyboard choice while its texture is still loading',async({page})=>{
 // Firefox keeps window.load pending for the deliberately paused image.
 // Observe the actual loader script event instead of awaiting that image.
 await page.addInitScript(()=>document.addEventListener('load',event=>{
  if(event.target instanceof HTMLScriptElement&&/\/lunar\/lunar-loader\.js(?:\?|$)/.test(event.target.src))window.__qaLunarLoaderReady=true;
 },true));
 let releaseTexture;const gate=new Promise(done=>{releaseTexture=done;});
 await page.route(/\/assets\/lunar\/albedo-web\.webp(?:\?.*)?$/,async route=>{await gate;await route.continue();});
 try{
  await page.goto('/menulio-kalendorius/2028/vasaris/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__qaLunarLoaderReady===true);const day=page.locator('[data-lunar-date="2028-02-15"]');await day.click();await day.press('ArrowUp');await expect(page.locator('[data-selected-date]')).toHaveValue('2028-02-08');
  releaseTexture();await expect.poll(()=>page.locator('[data-selected-moon]').evaluate(c=>c.getContext('2d').getImageData(c.width>>1,c.height>>1,1,1).data[3])).toBeGreaterThan(0);
  await expect(page.locator('[data-selected-date]')).toHaveValue('2028-02-08');await expect(page.locator('[data-lunar-date="2028-02-08"]')).toHaveAttribute('aria-pressed','true');
 }finally{releaseTexture();}
});

test('annual lunar ICS downloads on the first interaction without loading another tool',async({page})=>{
 await page.goto('/menulio-kalendorius/2028/');
 const [file]=await Promise.all([page.waitForEvent('download',{timeout:15000}),page.locator('[data-all-ics]').click()]);
 expect(await file.failure()).toBeNull();const text=(await fs.readFile(await file.path())).toString('utf8');expect(text).toContain('BEGIN:VCALENDAR');expect(text).toContain('BEGIN:VEVENT');expect(text).toContain('2028');
});
