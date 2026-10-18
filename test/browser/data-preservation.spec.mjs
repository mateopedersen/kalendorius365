import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

// All records below belong to a new, disposable test browser context.
test.beforeEach(async({context})=>{
 await context.addInitScript(()=>{try{localStorage.setItem('kalendorius365:privacy-notice:v1','dismissed');}catch{}});
});
const exported=async(page,selector)=>{
 const [file]=await Promise.all([page.waitForEvent('download'),page.locator(selector).click()]);
 expect(await file.failure()).toBeNull();return fs.readFile(await file.path());
};
const upload=(name,bytes)=>({name,mimeType:'application/json',buffer:bytes});

test('calendar backups round trip, malformed imports preserve data and deletion keeps preferences',async({page})=>{
 await page.goto('/?data=2028-02-29');
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
 await page.goto('/?data=2028-02-29');await page.locator('#task-title').fill('Disposable task');await page.locator('#task-form button').click();
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
 await page.locator('#homework-list button').click();await expect(page.locator('#homework-list li')).toHaveCount(0);
});

test('name-day filters, more results, reset and calendar insertion respond',async({page})=>{
 await page.goto('/vardadieniai/');await page.locator('#nd-query').fill('');
 await expect(page.locator('#nd-results>li')).toHaveCount(12);await page.locator('#nd-more').click();await expect(page.locator('#nd-results>li')).toHaveCount(24);
 await page.locator('[data-letter="J"]').click();await expect(page.locator('[data-letter="J"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#nd-month-filter').selectOption('6');await page.locator('#nd-reset').click();await expect(page.locator('#nd-month-filter')).toHaveValue('');
 await page.locator('#nd-query').fill('Jonas');await page.locator('#nd-results a').first().click();await expect(page.locator('#nd-export-name')).toHaveValue('Jonas');
 await page.locator('#nd-add').click();await expect(page.locator('#nd-feedback')).toContainText('Išsaugota');
 await page.locator('#nd-add').click();await expect(page.locator('#nd-feedback')).toContainText('jau įtrauktas');
 await page.locator('#nd-tomorrow').click();const tomorrow=await page.locator('#nd-date').inputValue();await page.locator('#nd-today').click();expect(await page.locator('#nd-date').inputValue()).not.toBe(tomorrow);
});

test('shift presets, view controls and JSON restore retain the chosen cycle',async({page})=>{
 await page.goto('/pamainu-grafikas/');await page.locator('#shift-preset').selectOption('day-night');await expect(page.locator('#shift-cycle')).toHaveValue('D,D,N,N,P,P,P,P');
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
