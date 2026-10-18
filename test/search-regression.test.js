import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {searchPages, normalizeSearchText, loadSearchIndex} from '../site/assets/search-engine.js';

const pages=JSON.parse(fs.readFileSync(new URL('../site/assets/data/search.json',import.meta.url)));
const fixtures=JSON.parse(fs.readFileSync(new URL('./fixtures/search-acceptance.json',import.meta.url)));
const strictFirst=new Set(['S009','S010','S045','S079','S087','S088']);
const canonical=url=>new URL(url,'https://kalendorius365.lt').pathname;
for(const fixture of fixtures) test(`acceptance ${fixture.id}: ${fixture.query}`,()=>{
  const results=searchPages(pages,fixture.query);
  if(fixture.expected.startsWith('NO_RESULTS')) assert.equal(results.length,0);
  else {
    const candidates=results.slice(0,strictFirst.has(fixture.id)?1:5);
    assert.ok(candidates.some(item=>canonical(item.url)===fixture.expected),`expected ${fixture.expected}, got ${candidates.map(item=>item.url).join(', ')}`);
  }
});

const additional=[
 ['2027 sausio kalendorius','/2027/sausis/'],['2028 vasario kalendorius','/2028/vasaris/'],
 ['2029 rugsėjo kalendorius','/2029/rugsejis/'],['2028 gegužės kalendorius','/2028/geguze/'],
 ['2027 birželio kalendorius','/2027/birzelis/'],['2029 gruodžio kalendorius','/2029/gruodis/'],
 ['2027 liepos Mėnulis','/menulio-kalendorius/2027/liepa/'],['2028 rugpjūčio Mėnulis','/menulio-kalendorius/2028/rugpjutis/'],
 ['2027 lapkričio šventės','/sventes/2027/lapkritis/'],['2027 balandžio šventės','/sventes/2027/balandis/'],
 ['saulėtekis Kaune','/saule/'],['saulėlydis Klaipėdoje','/saule/'],
 ['horoskopai rytoj','/horoskopai/'],['zodiako ženklai','/zodiakas/'],
 ['vasario vardadienis','/vardadieniai/vasaris/'],['rugpjūčio vardadieniai','/vardadieniai/rugpjutis/'],
 ['2028-02-29','/2028/vasaris/'],['2029-12-31','/2029/gruodis/'],
];
for(const[query,expected]of additional)test(`intent: ${query}`,()=>assert.equal(canonical(searchPages(pages,query)[0]?.url),expected));

test('Unicode, empty and oversized input are bounded and deterministic',()=>{
 assert.equal(normalizeSearchText('ŽIVILĖ'),normalizeSearchText('Z\u030CIVILE\u0307'));
 for(const value of ['', '   ', '<>', '🗓️'])assert.deepEqual(searchPages(pages,value),[]);
 assert.deepEqual(searchPages(pages,'2027-02-29'),[]);
 const huge='kalendorius '.repeat(100_000);
 assert.deepEqual(searchPages(pages,huge).map(item=>item.url),searchPages(pages,huge.slice(0,256)).map(item=>item.url));
 assert.ok(searchPages(pages,'kalendorius',{category:'calendar',limit:3}).every(item=>item.category==='calendar'));
 assert.equal(searchPages(pages,'kalendorius',{limit:3}).length,3);
});

test('real name entities preserve native spelling, all dates and working lookup URLs',()=>{
 const snapshot=JSON.parse(fs.readFileSync(new URL('../data/namedays/cc-by-sa-4.0/snapshot.json',import.meta.url)));
 const names={};for(const row of snapshot.records)for(const name of row.names)(names[name]||=[]).push(row.date);
 const hub=pages.find(item=>item.url==='/vardadieniai/');
 assert.deepEqual(hub.namedays,names,'generated search metadata must derive from the genuine dataset');
 for(const query of ['Jonas vardadienis','Ona','Živilė','zivile','Gustis']){
  const result=searchPages(pages,query)[0];
  const url=new URL(result.url,'https://kalendorius365.lt');
  assert.equal(url.pathname,'/vardadieniai/');assert.equal(url.hash,'#nd-search-title');
  const name=url.searchParams.get('q');assert.ok(names[name]);
  assert.equal(result.title,`${name} – vardadienis`);
  for(const date of names[name])assert.ok(result.description.includes(`${Number(date.slice(3))} d.`));
 }
});

test('one transient index failure can be retried; concurrent consumers share one request',async()=>{
 const originalFetch=globalThis.fetch;
 let requests=0;
 globalThis.fetch=async(url,options)=>{
  requests++;assert.equal(options.cache,'default');assert.ok(String(url).endsWith('/data/search.json'));
  if(requests===1)throw Error('temporary network failure');
  return{ok:true,json:async()=>pages};
 };
 try{
  await assert.rejects(loadSearchIndex(),/temporary network failure/);
  const first=loadSearchIndex(),second=loadSearchIndex();assert.equal(first,second);
  assert.deepEqual(await first,pages);assert.equal(requests,2);
 }finally{globalThis.fetch=originalFetch;}
});

test('generated search keeps a no-JavaScript directory whose destinations all exist',()=>{
 const generated=fs.readFileSync(new URL('../site/paieska/index.html',import.meta.url),'utf8');
 const generator=fs.readFileSync(new URL('../scripts/pages.rb',import.meta.url),'utf8');
 const layout=fs.readFileSync(new URL('../site/_layouts/default.html',import.meta.url),'utf8');
 const directory=generated.match(/<nav id="search-no-js-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
 assert.ok(directory,'build-time output must retain the fallback directory');
 assert.ok(generator.replace(/\s+/g,' ').includes(directory.replace(/\s+/g,' ')),'fallback must be owned by the generator');
 for(const match of directory.matchAll(/href="([^"]+)"/g))assert.ok(pages.some(item=>item.url===match[1]),`missing fallback target ${match[1]}`);
 const globalFallback=layout.indexOf('aria-label="Paieška ir svetainės skiltys"');
 assert.ok(globalFallback>layout.indexOf('</header>'),'fallback must avoid mobile header navigation hiding rules');
});
