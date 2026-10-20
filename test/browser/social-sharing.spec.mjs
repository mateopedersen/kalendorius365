import {test,expect} from '@playwright/test';

async function dismissConsent(page){const b=page.getByRole('button',{name:'Supratau',exact:true});if(await b.isVisible().catch(()=>false))await b.click();}
async function openCurrent(page){await page.locator('.share-entry>summary').click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('link[rel="stylesheet"][href$="/sharing/dialog.css"]')).toHaveCount(1);}

test('mobile share sheet keeps personal calendar entries local and offers real link sharing',async({page},testInfo)=>{
 test.setTimeout(90000);const secret='K365-PRIVATE-LOCAL-NOTE-6F9D';const sent=[];
 await page.addInitScript(({secret})=>localStorage.setItem('kalendorius365:v1',JSON.stringify({schema:1,events:[],tasks:[],notes:{'2026-10-20':secret},preferences:{}})),{secret});
 page.on('request',r=>{if((r.url()+' '+(r.postData()||'')).includes(secret))sent.push(r.url());});
 await page.setViewportSize({width:390,height:844});await page.goto('/');await dismissConsent(page);await openCurrent(page);
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'Pasidalyti',exact:true})).toBeVisible();
 await expect(dialog.locator('.share-link-card')).toContainText('Kalendorius365');
 await expect(dialog.locator('.share-link-card')).not.toContainText(secret);
 await expect(dialog.locator('textarea').first()).not.toHaveValue(new RegExp(secret));
 await expect(dialog.getByRole('button',{name:'Kopijuoti nuorodą',exact:true})).toContainText('Kopijuoti nuorodą');
 await expect(dialog.locator('.share-platforms [data-share-platform=x]')).toHaveAttribute('href',/x\.com\/intent\/tweet/);
 await expect(dialog.locator('.share-platforms [data-share-platform=facebook]')).toHaveAttribute('href',/facebook\.com\/sharer/);
 await expect(dialog.locator('.share-platforms [data-share-platform=instagram]')).toContainText('Instagram');
 const instagramLogo=dialog.locator('.share-platforms [data-share-platform=instagram] img');
 const instagramSvg=await(await page.request.get(new URL(await instagramLogo.getAttribute('src'),page.url()).href)).text();
 expect(instagramSvg).toContain('<path');expect(instagramSvg).not.toMatch(/<image\b(?![^>]*\b(?:href|xlink:href)=)[^>]*\/?\s*>/iu);
 expect(await instagramLogo.evaluate(async img=>{await img.decode();const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,64,64);return [...ctx.getImageData(0,0,64,64).data].some((v,i)=>i%4===3&&v>0);})).toBe(true);
 await dialog.getByRole('tab',{name:'Paveikslėlis'}).click();
 await expect(dialog.locator('.share-render-preview')).toBeVisible({timeout:30000});
 await expect(dialog.locator('.share-status')).toContainText('1080 × 1920');
 expect(await dialog.locator('.share-render-preview').evaluate(i=>[i.naturalWidth,i.naturalHeight])).toEqual([1080,1920]);
 await dialog.getByRole('button',{name:'Uždaryti'}).click();
 expect(await page.evaluate(()=>localStorage.getItem('kalendorius365:v1'))).toContain(secret);expect(sent).toEqual([]);
 for(const width of [320,360,390]){
  await page.setViewportSize({width,height:844});await page.locator('.share-entry>summary').scrollIntoViewIfNeeded();await openCurrent(page);
  const metrics=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,dialog:document.querySelector('dialog').scrollWidth,client:document.querySelector('dialog').clientWidth}));
  expect(metrics.document).toBeLessThanOrEqual(width+1);expect(metrics.dialog).toBeLessThanOrEqual(metrics.client+1);
  const shot=testInfo.outputPath(`sharing-mobile-${width}.png`);await page.screenshot({path:shot,fullPage:false});
  if(width===320){await page.evaluate(()=>document.documentElement.style.fontSize='200%');const zoom=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,dialog:document.querySelector('dialog').scrollWidth,client:document.querySelector('dialog').clientWidth}));expect(zoom.document).toBeLessThanOrEqual(321);expect(zoom.dialog).toBeLessThanOrEqual(zoom.client+1);await page.evaluate(()=>document.documentElement.style.fontSize='');}
  await page.getByRole('dialog').getByRole('button',{name:'Uždaryti'}).click();
 }
});

test('calendar design and dated horoscope share their own permanent page metadata',async({page})=>{
 await page.goto('/2028/vasaris/');const month=await page.locator('#share-page-data').textContent();const m=JSON.parse(month);expect(m.kind).toBe('calendar');expect(m.year).toBe(2028);expect(m.month).toBe(2);expect(m.shareUrl).toBe('https://kalendorius365.lt/2028/vasaris/');
 // Resolve the currently published immutable identity from the public horoscope page.
 await page.goto('/horoskopai/avinas/');const snapshot=JSON.parse(await page.locator('#share-page-data').textContent());await expect(page.locator('.share-horoscope-primary')).toHaveAttribute('data-share-key',snapshot.contentId);await page.route('**/assets/sharing/records/horoscope-avinas.json',route=>route.abort());await page.locator('.share-horoscope-primary').click();const d=page.getByRole('dialog');await expect(d).toBeVisible();expect(snapshot.kind).toBe('horoscope');expect(snapshot.signSlug).toBe('avinas');expect(snapshot.shareUrl).toContain(`/${snapshot.contentDate}/v-${snapshot.contentVersion}/`);expect(snapshot.displayDate).toContain(String(snapshot.contentDate.slice(0,4)));await expect(d.locator('input[type=url]')).toHaveValue(snapshot.shareUrl);await d.getByRole('button',{name:'Uždaryti'}).click();await page.goto(new URL(snapshot.shareUrl).pathname);
 const meta=await page.evaluate(()=>Object.fromEntries(['canonical','og:url','og:title','og:image','twitter:card'].map(k=>[k,(k==='canonical'?document.querySelector('link[rel=canonical]')?.href:document.querySelector(`meta[property="${k}"]`)?.content)||document.querySelector(`meta[name="${k}"]`)?.content])));expect(meta['canonical']).toBe(snapshot.shareUrl);expect(meta['og:url']).toBe(snapshot.shareUrl);expect(meta['og:image']).toBe(snapshot.imageUrl);expect(meta['twitter:card']).toBe('summary_large_image');
});

test('social metadata and its PNG are present in the original HTML response with JavaScript disabled',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();const response=await page.goto('/2027/vasaris/');expect(response.status()).toBe(200);const meta=await page.evaluate(()=>({canonical:document.querySelector('link[rel=canonical]')?.href,url:document.querySelector('meta[property="og:url"]')?.content,image:document.querySelector('meta[property="og:image"]')?.content,type:document.querySelector('meta[property="og:image:type"]')?.content,width:document.querySelector('meta[property="og:image:width"]')?.content,height:document.querySelector('meta[property="og:image:height"]')?.content,locale:document.querySelector('meta[property="og:locale"]')?.content,card:document.querySelector('meta[name="twitter:card"]')?.content}));expect(meta.canonical).toBe('https://kalendorius365.lt/2027/vasaris/');expect(meta.url).toBe(meta.canonical);expect(meta.type).toBe('image/png');expect(meta.width).toBe('1200');expect(meta.height).toBe('630');expect(meta.locale).toBe('lt_LT');expect(meta.card).toBe('summary_large_image');const imageResponse=await context.request.get(new URL(new URL(meta.image).pathname,page.url()).href);expect(imageResponse.status()).toBe(200);expect(imageResponse.headers()['content-type']).toContain('image/png');await context.close();
});

test('dated calendar design cards point to their matching preview and download page',async({page})=>{
 await page.goto('/2027/sausis/');const action=page.locator('.share-design-action').first();await expect(action).toBeVisible();const href=await action.getAttribute('href');const route=new URL(href).pathname;expect(route).toMatch(/^\/dalintis\/kalendorius\/[a-z0-9-]+\/$/);await action.click();const d=page.getByRole('dialog');await expect(d).toBeVisible();await expect(d.locator('input[type=url]')).toHaveValue(href);await d.getByRole('button',{name:'Uždaryti'}).click();await page.goto(route);await expect(page.locator('main img.share-design-preview')).toBeVisible();await expect(page.getByRole('link',{name:'Atsisiųsti PDF',exact:true})).toBeVisible();
});

test('blank calendar row selection changes the shared design identity and preview',async({page})=>{
 await page.goto('/tuscias-kalendorius/');await dismissConsent(page);const card=page.locator('#dizainas-tuscias-01-5-eilutes');const rows=card.locator('[data-blank-rows]');await expect(rows).toBeEnabled();await rows.selectOption('tuscias-01-6-eilutes');const share=card.locator('.share-design-action');await expect(share).toHaveAttribute('href',/tuscias-01-6-eilutes/);await share.click();const d=page.getByRole('dialog');await expect(d.locator('.share-content-title')).toContainText('Tuščias mėnesio kalendorius');await expect(d.locator('input[type=url]')).toHaveValue(/tuscias-01-6-eilutes/);
});

test('manual-copy fallback remains usable when clipboard access is denied',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new DOMException('denied','NotAllowedError'))}}));await page.goto('/2027/');await dismissConsent(page);await openCurrent(page);const d=page.getByRole('dialog');await d.getByRole('button',{name:'Kopijuoti nuorodą'}).click();await expect(d.locator('.share-copy-details')).toHaveAttribute('open','');await expect(d.locator('input[type=url]')).toBeFocused();await expect(d.locator('.share-status')).toContainText('nukopijuoti nepavyko');
});

test('Escape closes the dialog and restores focus to the share control',async({page})=>{
 await page.goto('/2027/');await dismissConsent(page);const trigger=page.locator('.share-entry>summary');await trigger.click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(trigger).toBeFocused();
});

test('a delayed earlier share request cannot replace the latest selected content',async({page})=>{
 await page.goto('/2027/');await dismissConsent(page);
 let started;const firstHead=new Promise(resolve=>started=resolve);
 await page.route('**/2027/',async route=>{if(route.request().method()==='HEAD'){started();await new Promise(resolve=>setTimeout(resolve,600));await route.fulfill({status:200,headers:{date:new Date().toUTCString()}});}else await route.continue();});
 await page.locator('.share-entry>summary').click();await firstHead;
 await page.locator('[data-share-site]').click();
 await expect(page.getByRole('dialog').locator('.share-content-title')).toHaveText('Kalendorius365');
 await page.waitForTimeout(750);
 await expect(page.getByRole('dialog').locator('.share-content-title')).toHaveText('Kalendorius365');
});

test('platform cancellation is announced as cancellation instead of a failed post',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:()=>Promise.reject(new DOMException('dismissed','AbortError'))});Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});});await page.goto('/2027/');await dismissConsent(page);await openCurrent(page);const d=page.getByRole('dialog');await d.getByRole('button',{name:'Bendrinti įrenginyje'}).click();await expect(d.locator('.share-status')).toContainText('atšauktas');await expect(d.locator('.share-status')).not.toContainText('nepavyko');
});

test('calendar image renderer creates all requested image ratios and themes',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='chromium','Canvas matrix runs once in Chromium; image layout is shared across browser engines.');await page.goto('/2027/');await dismissConsent(page);await openCurrent(page);const d=page.getByRole('dialog');await d.getByRole('tab',{name:'Paveikslėlis'}).click();const preview=d.locator('.share-render-preview');await expect(preview).toBeVisible({timeout:30000});const format=d.locator('.share-controls select').first();
 for(const [label,w,h] of [['Vertikalus įrašas · 1080 × 1350',1080,1350],['Kvadratas · 1080 × 1080',1080,1080],['Pinterest · 1000 × 1500',1000,1500],['Nuorodos kortelė · 1200 × 630',1200,630],['Story · 1080 × 1920',1080,1920]]){await format.selectOption({label});await expect(d.locator('.share-status')).toContainText(`${w} × ${h}`,{timeout:30000});expect(await preview.evaluate(i=>[i.naturalWidth,i.naturalHeight])).toEqual([w,h]);}
 for(const v of ['dark','accent','light']){await d.locator(`[data-share-theme="${v}"]`).click();await expect(d.locator('.share-status')).toContainText('Paveikslėlis paruoštas',{timeout:30000});}
 expect(await preview.evaluate(async i=>(await(await fetch(i.src)).blob()).type)).toBe('image/png');
 await d.locator('.share-controls select').last().selectOption('image/jpeg');await expect(d.locator('.share-status')).toContainText('Paveikslėlis paruoštas',{timeout:30000});expect(await preview.evaluate(async i=>(await(await fetch(i.src)).blob()).type)).toBe('image/jpeg');
 const download=d.getByRole('link',{name:'Atsisiųsti paveikslėlį',exact:true});await expect(download).toHaveAttribute('download',/\.jpg$/);const saved=page.waitForEvent('download');await download.click();const file=await saved;expect(file.suggestedFilename()).toMatch(/\.jpg$/);expect(await file.failure()).toBeNull();await file.saveAs(testInfo.outputPath('sharing-render.jpg'));
});
