import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ALPHABET,buildIndex,searchNames,validOccurrence,nextOccurrence,nameDayEvent,vilniusToday,weekDates} from '../site/assets/namedays-engine.js';
import {exportICS,importICS} from '../site/assets/ics.js';
import {Store,empty,validate} from '../site/assets/storage.js';
import {occursOn,weekday,monthLength} from '../site/assets/calendar.js';
import {searchPages} from '../site/assets/search-engine.js';
const data=JSON.parse(fs.readFileSync(new URL('../data/namedays/cc-by-sa-4.0/snapshot.json',import.meta.url)));
const records=data.records,index=buildIndex(records);
test('the preserved global search discovers the hub and all twelve specific month directories',()=>{
 const pages=JSON.parse(fs.readFileSync(new URL('../site/assets/data/search.json',import.meta.url)));
 assert.equal(pages.filter(r=>r.url.startsWith('/vardadieniai/')).length,13);
 for(const query of ['vardadieniai','vardadieniai šiandien','nameday'])assert.equal(searchPages(pages,query)[0].url,'/vardadieniai/');
 const months=JSON.parse(fs.readFileSync(new URL('../site/assets/data/calendar.json',import.meta.url))).months;
 for(const[slug,,genitive]of months)assert.equal(searchPages(pages,`${genitive} vardadieniai`)[0].url,`/vardadieniai/${slug}/`);
});
test('name-day coverage has all 366 keys, keeps native spelling and both January 1 source lists',()=>{
 assert.equal(records.length,366);assert.equal(new Set(records.map(r=>r.date)).size,366);
 assert.equal(records[0].names.length,11);assert.deepEqual(records.find(r=>r.date==='02-29').names,['Gustis','Tolvaldas']);
 for(const row of records){assert.ok(row.names.length);for(const name of row.names)assert.equal(name.normalize('NFC'),name);}
});
test('Lithuanian alphabet has 32 letters including Į before Y and all diacritics',()=>{
 assert.equal(ALPHABET.length,32);assert.equal(ALPHABET.join(' '),'A Ą B C Č D E Ę Ė F G H I Į Y J K L M N O P R S Š T U Ų Ū V Z Ž');
});
test('every native name, uppercase variant, partial and accentless form finds all original dates',()=>{
 for(const row of index){
  for(const query of [row.name,row.name.toLocaleUpperCase('lt'),row.name.normalize('NFD').replace(/\p{M}/gu,''),row.name.slice(0,3)]){
   const result=searchNames(index,{query}).find(r=>r.name===row.name);assert.ok(result,row.name);assert.deepEqual(result.dates,row.dates);
  }
 }
});
test('all alphabet and month combinations preserve dates and native initials',()=>{
 for(const letter of ALPHABET)for(let month=1;month<=12;month++)for(const r of searchNames(index,{letter,month})){
  assert.equal(r.name[0].toLocaleUpperCase('lt'),letter);assert.ok(r.dates.every(d=>Number(d.slice(0,2))===month));
 }
 assert.deepEqual(searchNames(index,{query:'<img onerror=alert(1)>'}),[]);
 assert.deepEqual(searchNames(index,{query:'zzzzzzzzzzzzzz'}),[]);
});
test('all name/date occurrences make valid one-off and recurring schema-safe events and round-trip ICS',()=>{
 for(const row of records){const date=validOccurrence(row.date,2028);
  for(const recurring of [false,true]){
   const event=nameDayEvent(row,date,row.names[0],recurring),result=importICS(exportICS([event]));
   assert.equal(result.rejected.length,0);assert.equal(result.imported.length,1);assert.equal(result.imported[0].start,date);assert.equal(result.imported[0].end,date);assert.equal(result.imported[0].repeat,event.repeat);
   assert.ok(event.description.includes(row.source_revision));assert.ok(event.description.includes('CC BY-SA 4.0'));
  }
 }
});
test('leap-day never shifts, annual recurrence skips non-leap years and next occurrence is real',()=>{
 const row=records.find(r=>r.date==='02-29');
 assert.equal(validOccurrence('02-29',2027),null);assert.equal(validOccurrence('02-29',2029),null);assert.equal(validOccurrence('02-29',2028),'2028-02-29');
 assert.equal(nextOccurrence('02-29','2026-10-17'),'2028-02-29');assert.equal(nextOccurrence('02-29','2028-03-01'),'2032-02-29');
 const event=nameDayEvent(row,'2028-02-29','Gustis',true);
 for(const date of ['2029-02-28','2029-03-01','2030-02-28','2031-03-01'])assert.equal(occursOn(event,date),false);
 assert.equal(occursOn(event,'2032-02-29'),true);
 assert.throws(()=>nameDayEvent(row,'2027-02-29','Gustis'));assert.throws(()=>nameDayEvent(row,'2028-02-29','Invented'));
});
test('repeat occurrences stay separate, stable IDs prevent duplicates, existing local data survives',()=>{
 const multiple=index.find(r=>r.dates.length>1);assert.ok(multiple);
 const selected=records.find(r=>r.date===multiple.dates[0]),event=nameDayEvent(selected,`2028-${selected.date}`,multiple.name);
 let value=JSON.stringify({...empty(),notes:{'2028-01-01':'Mano pastaba'},tasks:[{id:'t1',title:'Mano darbas',date:'2028-01-01',done:false}]});
 const memory={getItem:()=>value,setItem:(k,v)=>{value=v}},store=new Store(memory);store.update(s=>s.events.push(event));
 assert.equal(store.data.events.length,1);assert.equal(store.data.notes['2028-01-01'],'Mano pastaba');assert.equal(store.data.tasks.length,1);assert.equal(validate(store.data).events.length,1);
 assert.equal(event.id,nameDayEvent(selected,event.start,multiple.name).id);
});
test('Vilnius midnight works independently of visitor timezone through all 2027–2029 DST boundaries',()=>{
 for(const [instant,date]of [['2026-12-31T21:59:59Z','2026-12-31'],['2026-12-31T22:00:00Z','2027-01-01'],['2027-03-27T22:00:00Z','2027-03-28'],['2027-03-28T21:00:00Z','2027-03-29'],['2028-02-28T22:00:00Z','2028-02-29'],['2028-02-29T22:00:00Z','2028-03-01'],['2027-10-31T22:00:00Z','2027-11-01']])assert.equal(vilniusToday(new Date(instant)),date);
 for(const y of [2027,2028,2029])for(const m of [3,10]){
  const lastSunday=new Date(Date.UTC(y,m,0));lastSunday.setUTCDate(lastSunday.getUTCDate()-lastSunday.getUTCDay());
  for(let h=-30;h<=30;h++){
   const instant=new Date(+lastSunday+h*3600000),parts=Object.fromEntries(new Intl.DateTimeFormat('lt',{timeZone:'Europe/Vilnius',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instant).map(p=>[p.type,p.value]));
   assert.equal(vilniusToday(instant),`${parts.year}-${parts.month}-${parts.day}`);
  }
 }
 assert.deepEqual(weekDates('2026-12-29'),['2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03','2027-01-04']);
});
test('2027–2029 calendar days and weekdays match an independent Python calendar implementation',()=>{
 const python=process.env.K365_PYTHON||'python3';const raw=execFileSync(python,['-c','import calendar,json;print(json.dumps([[y,m,calendar.monthrange(y,m)[0],calendar.monthrange(y,m)[1]] for y in (2027,2028,2029) for m in range(1,13)]))'],{encoding:'utf8'});
 for(const[y,m,start,length]of JSON.parse(raw)){assert.equal(monthLength(y,m),length);assert.equal(weekday(`${y}-${String(m).padStart(2,'0')}-01`),start);}
});
test('independent Python source, HTML, SVG, all ICS and indexability gate',()=>{
 const report=JSON.parse(execFileSync(process.env.K365_PYTHON||'python3',['scripts/namedays/audit.py'],{cwd:fileURLToPath(new URL('..',import.meta.url)),encoding:'utf8'}));
 assert.equal(report.status,'passed');assert.equal(report.date_records,366);assert.equal(report.pages.length,13);assert.equal(report.static_ics_checked,366);
});
test('the actual Ruby generator preserves all thirteen pages and 366 ICS through repeated offline builds',()=>{
 const r=JSON.parse(execFileSync(process.env.K365_RUBY||'ruby',['test/namedays_generator_test.rb'],{cwd:fileURLToPath(new URL('..',import.meta.url)),encoding:'utf8'}));
 assert.equal(r.status,'passed');assert.equal(r.pages,13);assert.equal(r.ics,366);assert.equal(r.source_modified,false);
});
test('source parser boundaries and malformed input are independently exercised',()=>{
 execFileSync(process.env.K365_PYTHON||'python3',['-m','unittest','discover','-s','test','-p','test_namedays_import.py'],{cwd:fileURLToPath(new URL('..',import.meta.url)),encoding:'utf8'});
});
