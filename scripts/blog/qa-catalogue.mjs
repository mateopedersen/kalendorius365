import fs from 'node:fs/promises';
import {createRequire}from'node:module';
const require=createRequire(import.meta.url);
const {chromium,webkit}=require(process.env.K365_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.K365_QA_URL||'http://127.0.0.1:8799';
const label=process.env.K365_QA_LABEL||'catalogue-round-1';
const selected=process.env.K365_QA_ROUTES?.split(',');
const routes=JSON.parse(await fs.readFile('docs/adsense-v2/url-review.json','utf8')).pages.filter(r=>r.robots.startsWith('index')&&(!selected||selected.includes(r.route))).map(r=>r.route);
const out=`docs/adsense-v2/${label}`;await fs.mkdir(out,{recursive:true});
const results=[];
for(const [engine,type]of Object.entries({chromium,webkit})){
 const browser=await type.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'lt-LT',timezoneId:'Europe/Vilnius',isMobile:true,hasTouch:true});
 for(const route of routes){
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let result={engine,route};
  try{
   const response=await page.goto(base+route,{waitUntil:'networkidle',timeout:30000});
   await page.evaluate(async()=>{
    await document.fonts.ready;
    // Decode public images, including lazy gallery previews, before checking them.
    const images=[...document.images];for(const image of images)image.loading='eager';
    // Lazy/srcset selection can abort an immediately requested decode. Wait for
    // the actual selected resource's load/error state before classifying it.
    await new Promise(resolve=>requestAnimationFrame(resolve));
    await Promise.all(images.map(image=>new Promise(resolve=>{
     if(image.complete)return resolve();
     image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});
     setTimeout(resolve,8000);
    })));
   });
   const metrics=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,
    h1:document.querySelectorAll('main h1').length,
    brokenImages:[...document.querySelectorAll('main img')].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.currentSrc||i.src),
    cover:document.querySelector('.editorial-photograph img')?.currentSrc||null}));
   result={...result,status:response.status(),...metrics,errors};
   result.passed=result.status===200&&metrics.h1===1&&metrics.document<=metrics.viewport+2&&metrics.brokenImages.length===0&&errors.length===0;
   if(!result.passed)await page.screenshot({path:`${out}/${engine}-${route.replaceAll('/','_')||'home'}.png`,fullPage:true});
  }catch(error){result={...result,passed:false,error:error.message,errors};}
  results.push(result);await page.close();
 }
 await context.close();await browser.close();
}
const failures=results.filter(r=>!r.passed);
await fs.writeFile(`${out}/results.json`,JSON.stringify({base,profile:'390×844 mobile Chromium and WebKit engines; isolated test storage; no physical device claim',total:results.length,failures,results},null,2)+'\n');
console.log(JSON.stringify({base,total:results.length,failures:failures.length,details:failures}));
if(failures.length)process.exitCode=1;
