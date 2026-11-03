// Real tool captures in fresh browser storage. Never attaches a user's browser.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.K365_PLAYWRIGHT_MODULE||'@playwright/test');
const base=process.env.K365_QA_URL||'http://127.0.0.1:8799';
const rows=JSON.parse(await fs.readFile('data/blog/photo-sources.json','utf8'));
const routes=['/2028/kovas/','/2028/vasaris/','/savaites/2027/','/2028/vasaris/','/darbo-dienos/2028/','/sventes/','/savaitiniai-planuokliai/','/seimos-kalendorius/','/','/sventes/kovo-11-oji/','/tuscias-kalendorius/','/pamainu-grafikas/','/mokiniu-atostogos/','/ilgieji-savaitgaliai/','/datos-skaiciuokle/','/metai/','/menulio-kalendorius/2028/vasaris/','/metu-laikai/','/dienos-ilgumas/','/dienos-planuoklis/'];
const browser=await chromium.launch({headless:true});
await fs.mkdir('site/assets/blog/examples',{recursive:true});
await fs.mkdir('docs/adsense-v2/captures',{recursive:true});
const results={};
for(let i=0;i<rows.length;i++){
 const context=await browser.newContext({viewport:{width:1280,height:900},locale:'lt-LT',timezoneId:'Europe/Vilnius'});
 const page=await context.newPage();
 await page.goto(base+routes[i],{waitUntil:'networkidle'});
 const dismiss=page.locator('#cookie-notice-dismiss');if(await dismiss.isVisible())await dismiss.click();
 let target=page.locator('main');let state='Public page, clean storage; no visitor data.';
 if(i===8){target=page.locator('#backup').locator('xpath=ancestor::section[1]');state='Backup controls only; blank synthetic calendar in an isolated context.';}
 if(i===11){
  await page.locator('#shift-anchor').fill('2028-01-30');await page.locator('#shift-from').fill('2028-01-30');await page.locator('#shift-to').fill('2028-02-04');
  assert.equal(await page.locator('#shift-cycle').inputValue(),'D,D,P,P');
  const calculate=page.getByRole('button',{name:/Apskaičiuoti/}).first();await calculate.click();
  await page.locator('#shift-rows tr').first().waitFor();
  assert.equal(await page.locator('#shift-rows tr').count(),4);
  assert.ok((await page.locator('#shift-rows').innerText()).includes('2028'));
  target=page.locator('#shift-rows').locator('xpath=ancestor::section[1]');
  state='Synthetic cycle D,D,P,P; anchor/from2028-01-30; through2028-02-04. No real worker data.';
 }
 if(i===14){
  await page.getByLabel('Pradžios data',{exact:true}).fill('2028-02-28');await page.getByLabel('Pabaigos data',{exact:true}).fill('2028-03-01');await page.getByLabel('Pabaigos data',{exact:true}).blur();
  await page.waitForTimeout(300);state='Synthetic date interval2028-02-28 to2028-03-01, exclusive calendar difference.';
 }
 await target.scrollIntoViewIfNeeded();
 const box=await target.boundingBox();assert.ok(box&&box.width>0);
 // Explicit top excerpt, never stitched or fabricated output.
 const clip={x:Math.max(0,box.x),y:Math.max(0,box.y),width:Math.min(box.width,1280-box.x),height:Math.min(box.height,820)};
 const path=`docs/adsense-v2/captures/${rows[i].slug}.png`;
 await page.screenshot({path,clip});
 const bytes=await fs.readFile(path);
 results[rows[i].slug]={route:routes[i],source_url:'https://kalendorius365.lt'+routes[i],capture_base:base,viewport:[1280,900],clip,state,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),captured_at:new Date().toISOString(),public_caption:'Kalendorius365 įrankio ekrano ištrauka. Rodomi tik vieši duomenys arba mokomieji pavyzdžiai; lankytojų įrašai nenaudojami.'};
 await context.close();
}
await browser.close();
await fs.writeFile('docs/adsense-v2/captures/manifest.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({real_tool_captures:Object.keys(results).length}));
