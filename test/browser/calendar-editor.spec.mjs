import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {readPortable} from '../../site/assets/calendar-editor/storage.js';

test.beforeEach(async({context})=>{
 await context.addInitScript(()=>{
  localStorage.setItem('kalendorius365:privacy-notice:v1','dismissed');
  if(!localStorage.getItem('kalendorius365:v1'))localStorage.setItem('kalendorius365:v1',JSON.stringify({schema:1,events:[],tasks:[],notes:{'2028-02-29':'Existing home calendar note'},preferences:{hour12:true}}));
  localStorage.setItem('qa-unrelated-personal-value','keep-this-value');
 });
});

const ready=async page=>{
 await page.goto('/kurti-kalendoriu/?metai=2028&menuo=2');
 await expect(page.locator('#calendar-editor')).toHaveAttribute('aria-busy','false');
 await expect(page.locator('#ce-paper svg')).toBeAttached();
};
const openSection=async(page,index)=>{
 const section=page.locator('#calendar-editor details').nth(index);
 if(await section.getAttribute('open')===null)await section.locator('summary').click();
 return section;
};

test('mobile editor tabs show the leap-day preview and settings without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page);
 await expect(page.locator('#ce-paper')).toContainText('29');
 await expect(page.locator('[data-action="tab-settings"]')).toBeVisible();
 await page.locator('[data-action="tab-preview"]').click();
 await expect(page.locator('#calendar-editor')).toHaveAttribute('data-tab','preview');
 await expect(page.locator('#ce-paper svg')).toBeVisible();
 await page.locator('[data-action="tab-settings"]').click();
 await expect(page.locator('#calendar-editor')).toHaveAttribute('data-tab','settings');
 const width=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,editor:document.querySelector('#calendar-editor').scrollWidth}));
 expect(width.document,JSON.stringify(width)).toBeLessThanOrEqual(width.viewport+1);
 expect(width.editor,JSON.stringify(width)).toBeLessThanOrEqual(width.viewport+1);
});

test('personal editor saves events and notes locally while preserving the existing calendar and preferences',async({page})=>{
 await page.goto('/?data=2028-02-29');
 await expect(page.locator('#daily-note')).toHaveValue('Existing home calendar note');
 await expect(page.locator('#hour12')).toBeChecked();
 const original=await page.evaluate(()=>JSON.parse(localStorage.getItem('kalendorius365:v1')));
 await ready(page);
 const name=page.locator('[data-path="name"]');await name.fill('QA šeimos kalendorius');await name.press('Tab');
 const eventSection=await openSection(page,3);await eventSection.locator('[data-action="event-new"]').click();
 const form=page.locator('#ce-event-form');await form.locator('[name="title"]').fill('Močiutės gimtadienis');await form.locator('[name="start"]').fill('2028-02-29');await form.locator('[name="end"]').fill('2028-02-29');await form.locator('[name="category"]').selectOption('birthday');await form.locator('[name="person"]').fill('Močiutė');await form.locator('[type="submit"]').click();
 await expect(page.locator('#ce-event-list')).toContainText('Močiutės gimtadienis');
 const notesSection=await openSection(page,4);await notesSection.locator('#ce-notes').fill('Kvietimai šeimai');await notesSection.locator('#ce-notes').press('Tab');
 await expect(page.locator('#ce-status')).toContainText('Išsaugota šiame įrenginyje');
 const saved=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('kalendorius365-editorius',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const q=r.result.transaction('projects').objectStore('projects').getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);};}));
 expect(saved).toHaveLength(1);expect(saved[0].name).toBe('QA šeimos kalendorius');expect(saved[0].state.events[0].title).toBe('Močiutės gimtadienis');expect(saved[0].state.notes['2028-02']).toBe('Kvietimai šeimai');
 await page.reload();await expect(page.locator('#ce-dialog [data-restore]')).toBeVisible();await page.locator('#ce-dialog [data-restore]').click();
 await expect(page.locator('[data-path="name"]')).toHaveValue('QA šeimos kalendorius');await expect(page.locator('#calendar-editor')).toContainText('Močiutės gimtadienis');
 await page.goto('/?data=2028-02-29');await expect(page.locator('#daily-note')).toHaveValue('Existing home calendar note');await expect(page.locator('#hour12')).toBeChecked();
 const after=await page.evaluate(()=>({calendar:JSON.parse(localStorage.getItem('kalendorius365:v1')),unrelated:localStorage.getItem('qa-unrelated-personal-value')}));
 expect(after.calendar).toEqual(original);expect(after.unrelated).toBe('keep-this-value');
});

test('photo originals round-trip in a portable project; PDF export embeds the selected font',async({page},testInfo)=>{
 test.setTimeout(90000);const requests=[],runtimeErrors=[],consoleErrors=[];page.on('request',request=>requests.push({url:request.url(),method:request.method()}));page.on('pageerror',error=>runtimeErrors.push(error.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});await ready(page);
 const theme=await openSection(page,1);await theme.locator('[data-template="photo"]').click();await page.locator('[data-path="theme.font"]').selectOption('Inter');
 const pngData=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=160;c.height=120;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,160,120);g.addColorStop(0,'#144f40');g.addColorStop(1,'#efbc52');x.fillStyle=g;x.fillRect(0,0,160,120);x.fillStyle='#fff';x.font='bold 18px sans-serif';x.fillText('QA 2028',20,65);return c.toDataURL('image/png');});
 const originalBytes=Buffer.from(pngData.split(',')[1],'base64');await page.locator('#ce-photo-input').setInputFiles({name:'qa-original.png',mimeType:'image/png',buffer:originalBytes});await expect(page.locator('#calendar-editor')).toHaveAttribute('aria-busy','false');await expect(page.locator('#ce-photo-list')).toContainText('qa-original.png');await expect(page.locator('#ce-paper svg image')).toHaveCount(1);await expect(page.locator('#ce-status')).toContainText('Išsaugota šiame įrenginyje',{timeout:15000});
 const stored=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('kalendorius365-editorius',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const q=r.result.transaction('projects').objectStore('projects').getAll();q.onsuccess=()=>resolve(q.result.map(p=>({name:p.name,photoBytes:p.photos.map(x=>Array.from(new Uint8Array(x.bytes)))})));q.onerror=()=>reject(q.error);};}));expect(stored).toHaveLength(1);expect(stored[0].photoBytes).toEqual([Array.from(originalBytes)]);
 await page.reload();await expect(page.locator('#ce-dialog [data-restore]')).toBeVisible();await page.locator('#ce-dialog [data-restore]').click();await expect(page.locator('#ce-photo-list')).toContainText('qa-original.png');await expect(page.locator('#ce-paper svg image')).toHaveCount(1);
 const [projectDownload]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="project"]').click()]);const projectBytes=await fs.readFile(await projectDownload.path());const portable=await readPortable(new Blob([projectBytes]));
 expect(portable.state.period.year).toBe(2028);expect(portable.state.photos).toHaveLength(1);expect(portable.state.photos[0].name).toBe('qa-original.png');expect(portable.photos.size).toBe(1);expect(Buffer.from(await portable.photos.values().next().value.arrayBuffer())).toEqual(originalBytes);
 await testInfo.attach('calendar-editor-project.k365.zip',{body:projectBytes,contentType:'application/zip'});
 const regularFont=page.waitForResponse(response=>response.url().includes('/fonts/Inter-Regular.ttf')&&response.status()===200);const boldFont=page.waitForResponse(response=>response.url().includes('/fonts/Inter-Bold.ttf')&&response.status()===200);
 const [pdfDownload]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="export"]').click()]);const pdfBytes=await fs.readFile(await pdfDownload.path());await regularFont;await boldFont;expect(pdfBytes.subarray(0,5).toString()).toBe('%PDF-');expect(pdfBytes.byteLength).toBeGreaterThan(20000);await testInfo.attach('calendar-editor-output.pdf',{body:pdfBytes,contentType:'application/pdf'});
 try{await expect(page.locator('#calendar-editor')).toHaveAttribute('aria-busy','false',{timeout:30000});}catch{throw new Error(`PDF export did not unlock controls; status=${await page.locator('#ce-status').innerText()}; console=${JSON.stringify(consoleErrors)}; errors=${JSON.stringify(runtimeErrors)}`);}await expect(page.locator('#ce-status')).toHaveAttribute('data-error','false');expect(runtimeErrors).toEqual([]);expect(consoleErrors).toEqual([]);
 await page.locator('[data-path="name"]').fill('Laikinas pavadinimas');await page.locator('[data-path="name"]').press('Tab');await page.locator('#ce-project-input').setInputFiles({name:'qa-project.k365.zip',mimeType:'application/zip',buffer:projectBytes});
 await expect(page.locator('[data-path="name"]')).toHaveValue('Mano kalendorius');await expect(page.locator('#ce-photo-list')).toContainText('qa-original.png');await expect(page.locator('#ce-paper svg image')).toHaveCount(1);
 expect(requests.filter(r=>r.method!=='GET'&&r.method!=='HEAD')).toEqual([]);expect(requests.filter(r=>new URL(r.url).origin!=='http://127.0.0.1:8790')).toEqual([]);
});
