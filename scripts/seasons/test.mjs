import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {SEASON_IDS,nextSeasonEvent,validatedSelection,durationLabel,chartPath,countdownParts,seasonGuideHref} from '../../site/assets/seasons-core.js';
import {Astronomy} from '../../site/assets/lunar/astronomy-engine.js';
const d=JSON.parse(fs.readFileSync('site/assets/data/seasons.json'));
const fields=['mar_equinox','jun_solstice','sep_equinox','dec_solstice'];
for(const y of [2026,2027,2028,2029,2030])test(`Independent Astronomy Engine comparison ${y}`,()=>{const seasons=Astronomy.Seasons(y);for(let i=0;i<4;i++){const e=d.events.find(e=>e.year===y&&e.id===SEASON_IDS[i]);assert.ok(Math.abs(seasons[fields[i]].date-Date.parse(e.utc))<90000,e.utc);}});
test('Next occurrence in current boundary year',()=>assert.equal(nextSeasonEvent(d.events,'winter',Date.parse('2026-10-17T12:00Z')).year,2026));
test('Exact occurrence advances rather than negative countdown',()=>assert.equal(nextSeasonEvent(d.events,'winter',Date.parse(d.events.find(e=>e.year===2026&&e.id==='winter').utc)).year,2027));
test('Post-2029 boundary preserved',()=>assert.equal(nextSeasonEvent(d.events,'spring',Date.parse('2029-12-31T12:00Z')).year,2030));
test('Exhausted coverage is explicit null',()=>assert.equal(nextSeasonEvent(d.events,'winter',Date.parse('2031-01-01T00:00Z')),null));
test('Valid selection',()=>assert.deepEqual(validatedSelection(new URLSearchParams('metai=2028&miestas=klaipeda'),d.years,d.cities),{year:2028,city:'klaipeda'}));
test('Malformed selection falls back',()=>assert.deepEqual(validatedSelection(new URLSearchParams('metai=NaN&miestas=<script>'),d.years,d.cities),{year:2027,city:'vilnius'}));
test('Day duration in Lithuanian',()=>assert.equal(durationLabel(1038),'17 val. 18 min.'));
test('Chart uses absolute 24h scale',()=>assert.equal(chartPath([0,720,1440]),'M0.00,250.00 L500.00,125.00 L1000.00,0.00'));
for(const a of [[0],[0,NaN],[0,-1],[0,1441]])test(`Invalid graph ${String(a)}`,()=>assert.throws(()=>chartPath(a)));
test('Countdown clamps past instants',()=>assert.deepEqual(countdownParts('2026-01-01T00:00Z',Date.parse('2026-02-01T00:00Z')),{days:0,hours:0,minutes:0}));
test('Minute countdown decomposition',()=>assert.deepEqual(countdownParts('2027-01-02T03:04Z',Date.parse('2027-01-01T00:00Z')),{days:1,hours:3,minutes:4}));
for(const y of d.years)for(const c of d.cities)test(`Solar context consistency ${y} ${c.id}`,()=>{
 const a=d.annual[y][c.id];assert.equal(a.curve.length,y===2028?366:365);assert.equal(Math.min(...a.curve),a.min);assert.equal(Math.max(...a.curve),a.max);
 for(const id of SEASON_IDS){const e=d.events.find(e=>e.year===y&&e.id===id),rows=d.contexts[`${id}-${y}`][c.id].days;assert.equal(rows.length,15);assert.equal(rows[7][0],e.date);for(const r of rows){const n=(Date.parse(r[0])-Date.UTC(y,0,1))/86400000;assert.equal(a.curve[n],r[3]);assert.ok(r[1]<r[2]);}}
});

test('Guide links retain selected year and city',()=>assert.equal(seasonGuideHref('/vasaros-saulegriza/',2029,'klaipeda'),'/vasaros-saulegriza/?metai=2029&miestas=klaipeda'));
test('Guide link rejects unknown route',()=>assert.throws(()=>seasonGuideHref('/unsafe/',2027,'vilnius')));
test('Guide link rejects unsupported year and city',()=>{assert.throws(()=>seasonGuideHref('/metu-laikai/',2030,'vilnius'));assert.throws(()=>seasonGuideHref('/metu-laikai/',2027,'<script>'));});
