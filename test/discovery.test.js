import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { solarFor } from '../site/assets/phase-5-6-8-core.js';
const read = path => fs.readFileSync(new URL('../'+path, import.meta.url),'utf8');
test('all 22 links in the header and discovery area have different existing page destinations',()=>{
 const html=read('public/index.html');
 const parts=[html.match(/<nav id="primary-nav"[\s\S]*?<\/nav>/)[0],html.match(/<section class="home-discovery"[\s\S]*?<\/section>/)[0]];
 const urls=[...parts.join('').matchAll(/<a[^>]*href="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(urls.length,22);assert.equal(new Set(urls).size,22);
 for(const url of urls) assert.ok(fs.existsSync(new URL('../public'+url+'index.html',import.meta.url)),url);
});
test('the three focused pages are indexed and have independent titles, content and vector artwork',()=>{
 const search=JSON.parse(read('public/assets/data/search.json'));
 for(const slug of ['atmintinos-dienos','dienos-ilgumas','ilgieji-savaitgaliai']){
  const html=read('public/'+slug+'/index.html');
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert.match(html, /\/assets\/releases\/[a-f0-9]{20}\/discovery\.js/);
  assert.ok(search.some(item=>item.url==='/'+slug+'/'));
 }
 for(const type of ['holidays','sun','planning']){
  const svg=read('site/assets/visuals/discovery-'+type+'.svg');
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject)/);
 }
});
test('five city comparison uses the existing solar calculation and sensible common-scale durations',()=>{
 const cities=JSON.parse(read('site/assets/data/astronomy/cities.json')).cities;
 for(const date of ['2027-06-21','2028-02-29','2029-12-21']){
  for(const city of cities){
   const s=solarFor(date,{lat:city.latitude,lon:city.longitude});
   assert.ok(s.sunset>s.sunrise); assert.ok(s.dayMinutes>400&&s.dayMinutes<1100);
  }
 }
});

test('commemoration filtering waits for the DOM and handles accent-insensitive matches and empty results',async()=>{
 const {runInNewContext}=await import('node:vm');
 const makeCard=textContent=>({textContent,hidden:false});
 const cards=[makeCard('Tarptautinė mokytojų diena'),makeCard('Lietuvos vėliavos diena')];
 const sections=cards.map(card=>({hidden:false,querySelectorAll:()=>[card]}));
 const status={textContent:''};const events={};
 const input={value:'',addEventListener:(type,fn)=>{events[type]=fn;}};
 const callbacks={};
 const document={readyState:'loading',addEventListener:(type,fn)=>{callbacks[type]=fn;},querySelector:selector=>({'#commemoration-search':input,'#commemoration-status':status}[selector]||null),querySelectorAll:selector=>selector==='[data-commemoration]'?cards:sections};
 runInNewContext(read('site/assets/discovery.js').replace(/^import .*\n/,''),{document});
 assert.equal(events.input,undefined);callbacks.DOMContentLoaded();
 assert.equal(status.textContent,'Rasta dienų: 2');
 input.value='mokytoju';events.input();assert.equal(cards[0].hidden,false);assert.equal(cards[1].hidden,true);assert.equal(sections[1].hidden,true);
 input.value='zzzz';events.input();assert.ok(cards.every(card=>card.hidden));assert.ok(status.textContent.includes('Nieko nerasta'));
});
