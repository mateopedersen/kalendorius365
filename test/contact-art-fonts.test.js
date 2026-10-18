import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync}from'node:fs';import{createHash}from'node:crypto';
test('contact illustration embeds only exact original glyphs and retains its scalable text',()=>{
 const source=readFileSync(new URL('../site/kontaktai/index.html',import.meta.url),'utf8'),proof=JSON.parse(readFileSync(new URL('../docs/performance/contact-art-fonts.json',import.meta.url),'utf8'));
 const embedded=[...source.matchAll(/src:url\(data:font\/woff2;base64,([^)]*)\) format\("woff2"\);font-weight:(\d+)/g)];assert.equal(embedded.length,3);
 for(const match of embedded){const bytes=Buffer.from(match[1],'base64'),record=proof.fonts.find(r=>r.weight===Number(match[2]));assert.equal(bytes.length,record.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256);assert.equal(record.outlines_advances_hinting_identical,true);}
 assert.ok(proof.fonts.reduce((n,f)=>n+f.bytes,0)<15000);assert.match(source,/<svg viewBox="0 0 700 430"/);assert.match(source,/font-family="K365ContactArt,Lato,Arial,sans-serif"/);assert.match(source,/<text /);assert.match(source,/aria-label="Kopijuoti el. pašto adresą"/);
 const original=readFileSync(new URL('../docs/performance/contact-art-original.svg',import.meta.url));assert.equal(createHash('sha256').update(original).digest('hex'),proof.original_svg_sha256);
});
