import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {lunarState,noonInVilnius,nextPhase,countdown,phaseICS} from '../site/assets/lunar/lunar-engine.js';
import {importICS} from '../site/assets/ics.js';
const data=JSON.parse(fs.readFileSync(new URL('../data/lunar/calendar.json',import.meta.url)));

test('all 1096 browser noon calculations match the canonical independent-verified Python records',()=>{
  assert.equal(data.records.length,1096);
  for(const record of data.records){
    const instant=noonInVilnius(record.date_local);
    assert.equal(instant.toISOString().replace('.000Z','Z'),record.sampled_instant_utc);
    const state=lunarState(instant);
    assert(Math.abs(state.illumination-record.illumination_fraction)<1e-9,record.date_local);
    assert.equal(state.waxing,record.waxing_or_waning==='waxing');
    assert.equal(state.label,record.phase_label_lt);
  }
});
test('noon and phase dates respect Vilnius DST, leap day and cross-year lookup',()=>{
  assert.equal(noonInVilnius('2027-03-27').toISOString(),'2027-03-27T10:00:00.000Z');
  assert.equal(noonInVilnius('2027-03-28').toISOString(),'2027-03-28T09:00:00.000Z');
  assert.equal(noonInVilnius('2027-10-31').toISOString(),'2027-10-31T10:00:00.000Z');
  assert.equal(noonInVilnius('2028-02-29').toISOString(),'2028-02-29T10:00:00.000Z');
  assert.throws(()=>noonInVilnius('2027-02-29'));
  assert.equal(nextPhase(0,new Date('2029-12-31T12:00:00Z')).getUTCFullYear(),2030);
});
test('every primary event agrees with USNO within the declared three-minute engine tolerance',()=>{
  const quarters={new:0,first:1,full:2,last:3};
  for(const event of data.events.filter(e=>/^202[789]-/.test(e.utc))){
    const found=nextPhase(quarters[event.phase],new Date(+new Date(event.utc)-86400000));
    assert(Math.abs(found-new Date(event.utc))<180000,event.utc);
  }
});
test('countdowns never become negative and change phase after an event boundary',()=>{
  assert.equal(countdown('2027-01-01T00:00:00Z',new Date('2027-01-02T00:00:00Z')),'0 d. 0 val. 0 min.');
  const first=nextPhase(0,new Date('2027-01-06T00:00:00Z'));
  const following=nextPhase(0,new Date(+first+2000));assert(following-first>28*86400000);
});
test('lunar ICS uses stable UIDs, UTC instants, valid UTF-8 folding and a separate parser round trip',()=>{
  const events=data.events.filter(e=>e.local_date.startsWith('2027-01'));
  const raw=phaseICS(events,new Date('2026-10-17T10:00:00Z'));
  for(const line of raw.split('\r\n'))assert(Buffer.byteLength(line,'utf8')<=75);
  const parsed=importICS(raw);assert.equal(parsed.rejected.length,0);assert.equal(parsed.imported.length,4);
  assert.equal(raw,phaseICS(events,new Date('2026-10-17T10:00:00Z')));
  assert(raw.includes('DTSTART:20270107T202400Z'));
  assert(!raw.includes('VALUE=DATE'));
  const escaped=phaseICS([{...events[0],label_lt:'Jaunatis, pastaba; nauja\neilutė'}]);
  assert(escaped.includes('Jaunatis\\, pastaba\\; nauja\\neilutė'));
});
