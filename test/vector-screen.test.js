import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
test('screen wheel keeps the full vector geometry and retains its original asset',()=>{
 const proof=JSON.parse(readFileSync(new URL('../docs/performance/zodiac-wheel-vector.json',import.meta.url),'utf8'));
 for(const [path,key]of[[proof.source,'original_sha256'],[proof.target,'optimized_sha256']]){const bytes=readFileSync(new URL('../'+path,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),proof[key]);}
 const svg=readFileSync(new URL('../'+proof.target,import.meta.url),'utf8');assert.match(svg,/viewBox="0 0 320 320"/);assert.match(svg,/aria-labelledby="title desc"/);assert.match(svg,/<title id="title">/);assert.match(svg,/<desc id="desc">/);assert.doesNotMatch(svg,/<image\b/);assert.ok(proof.optimized_bytes<proof.original_bytes*.65);
});
test('off-screen calendar containment is disabled for printing',()=>{const css=readFileSync(new URL('../site/assets/homepage.css',import.meta.url),'utf8');assert.match(css,/content-visibility:auto/);assert.match(css,/@media print\{[\s\S]*?content-visibility:visible/);assert.match(css,/contain-intrinsic-block-size:none/);});
