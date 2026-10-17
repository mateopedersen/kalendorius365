import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {findSign,filterSigns,comparison,wheelIndex} from '../site/assets/zodiac-engine.js';
const profiles=JSON.parse(fs.readFileSync(new URL('../site/_data/zodiac_profiles.json',import.meta.url),'utf8'));
const signs=Object.entries(profiles).map(([key,profile])=>({key,...profile}));
const expected=[['oziaragis',1,1],['vandenis',1,20],['zuvys',2,19],['avinas',3,21],['jautis',4,20],['dvyniai',5,21],['vezys',6,21],['liutas',7,23],['mergele',8,23],['svarstykles',9,23],['skorpionas',10,23],['saulys',11,22],['oziaragis',12,22]];
test('all 366 valid month/day pairs match an independent chronological boundary table',()=>{
 const counts=new Map();
 for(let t=Date.UTC(2000,0,1);t<Date.UTC(2001,0,1);t+=86400000){
  const d=new Date(t),m=d.getUTCMonth()+1,day=d.getUTCDate();
  const key=expected.filter(([,mm,dd])=>m*100+day>=mm*100+dd).at(-1)[0];
  assert.equal(findSign(m,day,signs).sign.key,key);counts.set(key,(counts.get(key)||0)+1);
 }
 assert.equal([...counts.values()].reduce((a,b)=>a+b),366);assert.equal(counts.size,12);
});
for(const [index,s] of signs.entries())test(`${s.key}: the boundary window always discloses both adjacent signs`,()=>{
 const start=Date.UTC(2000,s.start[0]-1,s.start[1]);
 for(let shift=-3;shift<=3;shift++){
  const d=new Date(start+shift*86400000),r=findSign(d.getUTCMonth()+1,d.getUTCDate(),signs);
  assert.equal(r.nearBoundary,Math.abs(shift)<=2);
  if(r.nearBoundary)assert.deepEqual(r.alternatives.map(s=>s.key),[signs[(index+11)%12].key,s.key]);
 }
});
test('invalid dates, missing values and noninteger input cannot produce a sign',()=>{
 for(const [m,d] of [[0,1],[13,1],[1,0],[1,32],[2,30],[2,31],[4,31],[6,31],[9,31],[11,31],[1.5,2],[1,2.5],[NaN,1],[1,NaN],[null,1],['1',1]])assert.throws(()=>findSign(m,d,signs),/galiojančią/);
 assert.equal(findSign(2,29,signs).sign.key,'zuvys');assert.throws(()=>findSign(1,1,[]),/lentelės/);
});
test('all four traditional elements contain three signs and reset includes twelve',()=>{
 assert.equal(filterSigns(signs).length,12);
 for(const element of ['fire','earth','air','water'])assert.equal(filterSigns(signs,element).length,3);
 assert.throws(()=>filterSigns(signs,'unknown'));
});
test('all 144 comparisons preserve the two actual selected profiles, without scores',()=>{
 for(const a of signs)for(const b of signs){const r=comparison(signs,a.key,b.key);assert.equal(r.first,a);assert.equal(r.second,b);assert.equal(r.sameSign,a===b);assert.equal(r.sameElement,a.element_key===b.element_key);assert.equal('score'in r,false);}
 assert.throws(()=>comparison(signs,'bad','avinas'));
});
test('wheel arrows wrap, Home and End work, and Tab is never intercepted',()=>{
 for(let i=0;i<12;i++){assert.equal(wheelIndex(i,'ArrowRight'),(i+1)%12);assert.equal(wheelIndex(i,'ArrowDown'),(i+1)%12);assert.equal(wheelIndex(i,'ArrowLeft'),(i+11)%12);assert.equal(wheelIndex(i,'ArrowUp'),(i+11)%12);assert.equal(wheelIndex(i,'Home'),0);assert.equal(wheelIndex(i,'End'),11);assert.equal(wheelIndex(i,'Tab'),null);}
 assert.throws(()=>wheelIndex(12,'ArrowRight'));
});
test('all authored profiles use normalized Lithuanian text and distinctive descriptions',()=>{
 assert.equal(new Set(signs.map(s=>s.summary)).size,12);
 for(const s of signs)for(const field of ['focus','summary','symbol_label','art_alt']){assert.equal(s[field],s[field].normalize('NFC'));assert.ok(!/[<>]/.test(s[field]));assert.ok(s[field].length>8);}
});
test('independent HTML/SVG audit passes for all fourteen built pages',()=>{
 const output=execFileSync(process.env.K365_PYTHON||'python3',['scripts/zodiac/audit.py'],{cwd:fileURLToPath(new URL('..',import.meta.url)),encoding:'utf8'});
 const report=JSON.parse(output);assert.equal(report.status,'passed');assert.equal(report.phase4_pages.length,14);
});
test('the actual Ruby generators preserve features through two isolated daily publications',()=>{
 const output=execFileSync(process.env.K365_RUBY||'ruby',['test/zodiac_generator_test.rb'],{cwd:fileURLToPath(new URL('..',import.meta.url)),encoding:'utf8'});
 const report=JSON.parse(output);assert.equal(report.status,'passed');assert.equal(report.isolated_future_publications.length,2);
 assert.ok(report.isolated_future_publications.every(row=>row.unchanged_profiles===12&&row.real_daily_dataset_modified===false));
});
