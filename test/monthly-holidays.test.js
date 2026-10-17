import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeText,matchesRecord,nextWithinMonth,vilniusDate} from '../site/assets/monthly-holidays.js';
const registry=JSON.parse(readFileSync(new URL('../data/monthly-holidays-2027.json',import.meta.url)));
test('126 source-backed dates, all 101 commemorative legal entries retained',()=>{
 assert.equal(registry.events.length,126);
 assert.deepEqual(registry.events.filter(e=>e.law_point).map(e=>e.law_point).sort((a,b)=>a-b),Array.from({length:101},(_,i)=>i+1));
 assert.equal(registry.events.filter(e=>e.statutory_nonworking).length,16);
});
test('all weekday and nth-weekday rules agree independently with JavaScript UTC',()=>{
 for(const e of registry.events){
  const d=new Date(e.date+'T12:00:00Z');assert.equal((d.getUTCDay()+6)%7+1,e.weekday,e.id);
  const r=e.recurrence;if(r.type==='nth-weekday'){
   const candidates=[];for(let i=1;i<=31;i++){const x=new Date(Date.UTC(2027,r.month-1,i));if(x.getUTCMonth()===r.month-1&&((x.getUTCDay()+6)%7+1)===r.weekday)candidates.push(x.toISOString().slice(0,10));}
   assert.equal(e.date,r.ordinal===-1?candidates.at(-1):candidates[r.ordinal-1],e.id);
  }
 }
});
test('2027 movable dates use the correct 47-day Shrove Tuesday interval',()=>{
 const get=id=>registry.events.find(e=>e.id===id).date;
 assert.equal(get('stat-easter'),'2027-03-28');assert.equal(get('stat-easter-monday'),'2027-03-29');
 assert.equal(get('uzgavenes'),'2027-02-09');assert.equal(get('atvelykis'),'2027-04-04');assert.equal(get('palms'),'2027-03-21');
 assert.equal((Date.parse(get('stat-easter'))-Date.parse(get('uzgavenes')))/86400000,47);
 assert.equal(get('comm-045'),'2027-05-21');assert.equal(get('stat-mothers'),'2027-05-02');assert.equal(get('stat-fathers'),'2027-06-06');
});
test('overlapping dates preserve each legal category independently',()=>{
 const jan=registry.events.filter(e=>e.date==='2027-01-01');assert.equal(jan.length,2);assert.equal(jan.filter(e=>e.statutory_nonworking).length,1);
 assert.equal(registry.events.filter(e=>e.date==='2027-02-09').length,2);
 assert.equal(registry.events.filter(e=>e.date==='2027-03-29').length,2);
 assert.equal(registry.events.filter(e=>e.date==='2027-05-21').length,2);
 assert.ok(registry.events.every(e=>e.statutory_nonworking===(e.category==='statutory_holiday')));
});
test('Lithuanian accent-insensitive search and category AND query filtering',()=>{
 assert.equal(normalizeText('  ŽOLINĖ ŠVENTĖ  '),'zoline svente');
 const rec={category:'statutory_holiday',search:'Žolinė rugpjūčio 15 d. 2027-08-15'};
 assert.equal(matchesRecord(rec,'all','zoline rugpjucio'),true);assert.equal(matchesRecord(rec,'legally_commemorative','zoline'),false);assert.equal(matchesRecord(rec,'all','zoline sausis'),false);
 assert.equal(matchesRecord(rec,'all','2027-08'),true);assert.equal(matchesRecord(rec,'all',''),true);
});
test('next notable day handles unsorted duplicates and archive months',()=>{
 assert.equal(nextWithinMonth(['2027-01-13','2027-01-01','2027-01-01'],'2026-12-31'),'2027-01-01');
 assert.equal(nextWithinMonth(['2027-01-01','2027-01-13'],'2027-01-02'),'2027-01-13');assert.equal(nextWithinMonth(['2027-01-01'],'2028-01-01'),null);assert.equal(nextWithinMonth([],'2027-01-01'),null);
});
test('Vilnius civil date respects midnight across winter and summer offsets',()=>{
 assert.equal(vilniusDate(new Date('2027-01-01T22:30:00Z')),'2027-01-02');assert.equal(vilniusDate(new Date('2027-06-01T21:30:00Z')),'2027-06-02');
});
