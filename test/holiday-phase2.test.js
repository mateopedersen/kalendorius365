import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {yearFromLocation} from '../site/assets/holiday-phase2.js';
const registry=JSON.parse(readFileSync(new URL('../data/holiday-phase2.json',import.meta.url)));
const old=JSON.parse(readFileSync(new URL('../data/holiday-editorial.json',import.meta.url)));
const all=[...old.articles,...old.commemorations,...registry.articles];
const years=['2027','2028','2029'];
test('31 manifest guides have unique routes and verified original media records',()=>{
 assert.equal(all.length,31);assert.equal(new Set(all.map(a=>a.slug)).size,31);
 for(const a of all){const m=registry.media[a.id];assert.ok(m,a.id);assert.match(m.commons_url,/commons.wikimedia.org\/wiki\/File:/);assert.ok(m.license_url);assert.ok(m.author);assert.ok(m.caption);assert.ok(m.commons_revision);assert.ok(a.sources.every(s=>registry.sources[s]),a.id);}
});
test('deep-link year selection validates input and gives valid hash priority',()=>{
 const location=(search='',hash='')=>({search,hash});
 assert.equal(yearFromLocation(location(),years),'2027');assert.equal(yearFromLocation(location('?metai=2028'),years),'2028');assert.equal(yearFromLocation(location('?metai=2030'),years),'2027');assert.equal(yearFromLocation(location('?metai=2028','#metai-2029'),years),'2029');assert.equal(yearFromLocation(location('?metai=2028','#metai-9999'),years),'2028');
});
test('all 93 ICS files are folded UTF-8 with stable UID, all-day date and exclusive end',()=>{
 const ids=new Set();let events=0;
 for(const a of all)for(const y of years){
  const raw=readFileSync(new URL(`../site/assets/holiday-phase2-ics/${a.slug}-${y}.ics`,import.meta.url));
  for(const line of raw.toString().split('\r\n'))assert.ok(Buffer.byteLength(line)<=75,a.id);
  assert.ok(!raw.toString().replaceAll('\r\n','').includes('\n'));
  const s=raw.toString().replace(/\r\n[ \t]/g,'');
  const blocks=s.split('BEGIN:VEVENT\r\n').slice(1);assert.ok(blocks.length>=1);
  for(const block of blocks){
   const uid=block.match(/UID:(.+)\r\n/)[1];assert.ok(!ids.has(uid));ids.add(uid);events++;
   const start=block.match(/DTSTART;VALUE=DATE:(\d{8})/)[1];const end=block.match(/DTEND;VALUE=DATE:(\d{8})/)[1];
   const parse=d=>Date.UTC(+d.slice(0,4),+d.slice(4,6)-1,+d.slice(6));assert.equal(parse(end)-parse(start),86400000);assert.equal(start.slice(0,4),y);assert.ok(block.includes('URL:https://kalendorius365.lt/sventes/'+a.slug+'/'));
  }
 }
 assert.equal(events,99);
});
test('Vaiko day and Shrove Tuesday independently agree for all supported years',()=>{
 const dates=(slug,y)=>readFileSync(new URL(`../site/assets/holiday-phase2-ics/${slug}-${y}.ics`,import.meta.url),'utf8').match(/DTSTART;VALUE=DATE:(\d{8})/)[1];
 for(const [y,child,shrove] of [['2027','20270521','20270209'],['2028','20280519','20280229'],['2029','20290518','20290213']]){assert.equal(dates('vaiko-diena',y),child);assert.equal(dates('uzgavenes',y),shrove);}
});
test('new candidates do not claim statutory holiday IDs or nonworking status',()=>{
 assert.ok(registry.articles.every(a=>a.holiday_ids.length===0));
 assert.equal(registry.articles.find(a=>a.id==='tarptautine-moters-diena').law_point,13);
 assert.equal(registry.articles.find(a=>a.id==='knygnesio-diena').law_point,null);
 assert.equal(registry.articles.find(a=>a.id==='boso-diena').law_point,null);
});
test('each new holiday title leads to its own detail guide in the preserved search engine',async()=>{
 const {searchPages}=await import('../site/assets/search-engine.js');const index=JSON.parse(readFileSync(new URL('../site/assets/data/search.json',import.meta.url)));
 for(const a of registry.articles)assert.equal(searchPages(index,a.title)[0]?.url,'/sventes/'+a.slug+'/',a.title);
});
