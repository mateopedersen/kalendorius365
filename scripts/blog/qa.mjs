import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium,webkit}=require(process.env.K365_PLAYWRIGHT_MODULE||'@playwright/test');
const base=process.env.K365_QA_URL||'http://127.0.0.1:8799';
const label=process.env.K365_QA_LABEL||'local';
const out=`docs/adsense/qa-${label}`;await fs.mkdir(out,{recursive:true});
const routes=['/','/blogas/','/blogas/kaip-spausdinti-kalendoriu/','/blogas/menulio-faziu-kalendoriaus-skaitymas/','/autoriai/julius-vainauskas/','/redakcine-politika/','/apie-mus/','/privatumas/','/kontaktai/','/2027/','/2028/vasaris/','/savaites/2027/','/sventes/','/horoskopai/','/horoskopai/jautis/','/kurti-kalendoriu/','/datos-skaiciuokle/','/pamainu-grafikas/','/pamoku-tvarkarastis/','/menulio-kalendorius/2027/sausis/'];
const result=[];
for(const [engine,type]of Object.entries({chromium,webkit})){
 const browser=await type.launch({headless:true});
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage();
  for(const route of routes){
   const errors=[];const listener=e=>errors.push(e.message);page.on('pageerror',listener);
   const response=await page.goto(base+route,{waitUntil:'networkidle',timeout:45000});
   await page.evaluate(async()=>{
    for(const img of document.images)img.loading='eager';
    await Promise.all([...document.images].map(img=>Promise.race([img.decode().catch(()=>{}),new Promise(r=>setTimeout(r,5000))])));
   });
   const report=await page.evaluate(()=>{
    const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'};
    const rect=e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,text:(e.innerText||e.getAttribute('aria-label')||'').slice(0,70),width:Math.round(r.width),height:Math.round(r.height)}};
    return {title:document.title,viewport:document.querySelector('meta[name=viewport]')?.content,overflow:document.documentElement.scrollWidth>innerWidth+1,overflowElements:[...document.querySelectorAll('main *')].filter(e=>visible(e)&&e.getBoundingClientRect().right>innerWidth+2).slice(0,5).map(rect),h1:document.querySelectorAll('main h1').length,rootFont:getComputedStyle(document.documentElement).fontSize,brokenImages:[...document.images].filter(e=>visible(e)&&(!e.complete||!e.naturalWidth)).map(e=>e.src),smallButtons:[...document.querySelectorAll('button,.button')].filter(e=>visible(e)&&e.getBoundingClientRect().width<24&&e.getBoundingClientRect().height<24).map(rect),og:document.querySelector('meta[property="og:image"]')?.content,legal:{about:!!document.querySelector('footer a[href="/apie-mus/"]'),privacy:!!document.querySelector('footer a[rel="privacy-policy"]')},text:document.querySelector('main')?.innerText.length};
   });
   result.push({engine,width,route,status:response.status(),errors,...report});
   if(width===390&&['/','/blogas/','/blogas/kaip-spausdinti-kalendoriu/'].includes(route)){
    const stem=`${out}/${engine}-${route==='/'?'home':route.split('/').filter(Boolean).at(-1)}`;
    await page.screenshot({path:stem+'.png',fullPage:true});
    await page.screenshot({path:stem+'-viewport.png',fullPage:false});
   }
   page.off('pageerror',listener);
  }
  await context.close();
 }
 await browser.close();
}
const failures=result.filter(x=>x.status!==200||x.overflow||x.h1!==1||x.brokenImages.length||x.smallButtons.length||!x.legal.about||!x.legal.privacy||x.errors.length);
await fs.writeFile(`${out}/results.json`,JSON.stringify({base,checked:result.length,failures,result},null,2));
console.log(JSON.stringify({base,checked:result.length,failures:failures.map(x=>({engine:x.engine,width:x.width,route:x.route,status:x.status,overflow:x.overflow,h1:x.h1,images:x.brokenImages,errors:x.errors,small:x.smallButtons}))},null,2));
process.exitCode=failures.length?1:0;
