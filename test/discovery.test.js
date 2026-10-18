import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {holidays,addDays,weekday,difference} from '../site/assets/calendar.js';
import { solarFor } from '../site/assets/phase-5-6-8-core.js';
import { foldIcsLine, recommendExtendedWeekend, thirdFridayOfMay } from '../site/assets/discovery-core.js';
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
  assert.match(svg,/viewBox="0 0 320 210"/);
  assert.match(svg,/<linearGradient/);
 }
 assert.match(read('public/atmintinos-dienos/index.html'),/commemoration-export/);
 assert.match(read('public/dienos-ilgumas/index.html'),/daylight-chart/);
 assert.match(read('public/ilgieji-savaitgaliai/index.html'),/weekend-recommendations/);
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

test('floating commemoration dates resolve to the third Friday in May',()=>{
 assert.deepEqual([2027,2028,2029].map(thirdFridayOfMay),['2027-05-21','2028-05-19','2029-05-18']);
});
test('iCalendar line folding preserves Lithuanian UTF-8 and the 75-octet limit',()=>{
 const source='DESCRIPTION:'+('Šv. ' + 'kalendorinis įvykis ').repeat(12);
 const folded=foldIcsLine(source);
 assert.equal(folded.replace(/\r\n /g,''),source);
 for(const line of folded.split('\r\n')) assert.ok(new TextEncoder().encode(line).length<=75);
});
test('weekend planner extends adjacent weekends and spends only selected weekday leave',()=>{
 assert.deepEqual(recommendExtendedWeekend('2027-01-01','2027-01-03',0),{
  start:'2027-01-01',end:'2027-01-03',daysOff:3,leaveDays:0,leaveDates:[],
 });
 const one=recommendExtendedWeekend('2027-01-01','2027-01-03',1);
 assert.equal(one.daysOff,4);assert.equal(one.leaveDays,1);
 assert.deepEqual(one.leaveDates,['2026-12-31']);
 assert.ok(one.start==='2026-12-31'||one.end==='2027-01-04');
 const two=recommendExtendedWeekend('2027-01-01','2027-01-03',2);
 assert.equal(two.daysOff,5);assert.equal(two.leaveDays,2);
 assert.deepEqual(two.leaveDates,['2026-12-30','2026-12-31']);
 assert.deepEqual(recommendExtendedWeekend('2027-01-01','2027-01-03',0).leaveDates,[]);
});
test('weekend planner validates dates and keeps the leave-day limit bounded',()=>{
 assert.throws(()=>recommendExtendedWeekend('2027-02-30','2027-03-01',1));
 assert.throws(()=>recommendExtendedWeekend('2027-03-02','2027-03-01',1));
 assert.throws(()=>recommendExtendedWeekend('2027-03-01','2027-03-02',4));
});

test('every displayed long weekend matches statutory free days including the previous December',()=>{
 const html=read('site/ilgieji-savaitgaliai/index.html');const data=JSON.parse(read('data/calendar.json'));
 for(const year of [2027,2028,2029]){
  const section=html.match(new RegExp('<section id="savaitgaliai-'+year+'"[\\s\\S]*?</section>'))[0];
  const actual=[...section.matchAll(/data-start="([^"]+)" data-end="([^"]+)"/g)].map(m=>m.slice(1));
  const days=new Set([year-1,year,year+1].flatMap(y=>holidays(y,data).map(h=>h.date)));
  const free=d=>weekday(d)>=5||days.has(d);const first=year+'-01-01',last=year+'-12-31',expected=[];
  for(let day=addDays(first,-7);day<=addDays(last,7);day=addDays(day,1)){
   if(!free(day)||free(addDays(day,-1)))continue;let end=day;while(free(addDays(end,1)))end=addDays(end,1);
   if(difference(day,end)>=2&&end>=first&&day<=last)expected.push([day,end]);day=end;
  }
  assert.deepEqual(actual,expected,String(year));
 }
});
