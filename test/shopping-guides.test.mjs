import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {dates,ics,calendarURL} from '../scripts/shopping-guides/render.mjs';
import config from '../data/shopping-guides.json' with {type:'json'};
const moduleFile=new URL('../site/assets/shopping/'+config.script.split('/').at(-1),import.meta.url);
const {compareCosts}=await import(moduleFile.href);

test('Delivery changes the winner; currency comparison uses cents',()=>{
 assert.deepEqual(compareCosts(199,9,205,0),{a:208,b:205,difference:3,winner:'b'});
 assert.equal(compareCosts(0.1,0.2,0.3,0).winner,'equal');
 assert.equal(compareCosts(199,0,205,0).winner,'a');
 for(const invalid of [NaN,-1,Infinity,10000001])assert.equal(compareCosts(invalid,0,1,0),null);
});

test('Shopping dates include the December rollover in 2030',()=>{
 const expected={2026:['2026-11-27','2026-11-30'],2027:['2027-11-26','2027-11-29'],2028:['2028-11-24','2028-11-27'],2029:['2029-11-23','2029-11-26'],2030:['2030-11-29','2030-12-02']};
 for(const [year,pair] of Object.entries(expected))assert.deepEqual(dates(Number(year)),{friday:pair[0],monday:pair[1]});
});

test('All localized calendar files match their exclusive dates and stable IDs',async()=>{
 const ids=new Set();
 for(const page of config.pages)for(let year=2026;year<=2030;year++){
  const content=ics(config,page,year),unfolded=content.replaceAll('\r\n ','');
  assert.equal(await fs.readFile(new URL('../site/assets/shopping/'+page.slug+'-'+year+'.ics',import.meta.url),'utf8'),content);
  assert.ok(content.endsWith('END:VCALENDAR\r\n'));
  for(const line of content.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
  const uid=unfolded.match(/UID:([^\r]+)/)[1];assert.ok(!ids.has(uid));ids.add(uid);
  const start=dates(year)[page.kind],end=new Date(+new Date(start+'T00:00:00Z')+86400000).toISOString().slice(0,10);
  assert.ok(unfolded.includes('DTSTART;VALUE=DATE:'+start.replaceAll('-','')+'\r\n'));
  assert.ok(unfolded.includes('DTEND;VALUE=DATE:'+end.replaceAll('-','')+'\r\n'));
  assert.ok(unfolded.includes('SUMMARY:'+page.name+' '+year));
  assert.ok(unfolded.includes('TRIGGER:-P1D'));
  assert.equal(new URL(calendarURL(config,page,year)).searchParams.get('dates'),start.replaceAll('-','')+'/'+end.replaceAll('-',''));
 }
 assert.equal(ids.size,10);
});
