import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('font preloads are limited to the calendar editor and retain complete document fonts',()=>{
 const css=readFileSync(new URL('../site/assets/design-system.css',import.meta.url),'utf8');
 const layout=readFileSync(new URL('../site/_layouts/default.html',import.meta.url),'utf8');
 assert.match(css,/--font-ui:\s*system-ui/);
 const preloads=[...layout.matchAll(/<link\b[^>]*as="font"[^>]*>/g)].map(match=>match[0]);
 assert.equal(preloads.length,2,'only the editor regular and bold Lato subsets should be preloaded');
 assert.match(layout,/{%\s*if\s+page\.calendar_editor\s*%}[\s\S]*{%\s*endif\s*%}/);
 assert.ok(preloads.every(link=>/Lato-(Regular|Bold)-latin-lt\.woff2/.test(link)));
 assert.ok(preloads.every(link=>!/Inter|Lato-(Black|Regular|Bold)\.woff2/.test(link)));
 const proof=JSON.parse(readFileSync(new URL('../docs/performance/font-subsets.json',import.meta.url),'utf8'));
 for(const [i,weight]of ['Regular','Bold','Black'].entries()){
  const bytes=readFileSync(new URL('../site/assets/fonts/Lato-'+weight+'.woff2',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),proof.fonts[i].original_sha256);
 }
});

test('browser interface uses the exact Finnish Regular and Bold files plus Lithuanian extension',()=>{
 const stylesheet=readFileSync(new URL('../site/assets/shell/site-shell.css',import.meta.url),'utf8');
 const hashes={
  400:'918b7dc3e2e2d015c16ce08b57bcb64d2253bafc1707658f361e72865498e537',
  700:'c447dd7677b419db7b21dbdfc6277c7816a913ffda76fd2e52702df538de0e49',
 };
 for(const [weight,hash] of Object.entries(hashes)){
  const regular=readFileSync(new URL(`../site/assets/fonts/lato-latin-${weight}-normal.woff2`,import.meta.url));
  const extended=readFileSync(new URL(`../site/assets/fonts/lato-latin-ext-${weight}-normal.woff2`,import.meta.url));
  assert.equal(createHash('sha256').update(regular).digest('hex'),hash);
  assert.equal(extended.subarray(0,4).toString(),'wOF2');
  assert.ok(stylesheet.includes(`lato-latin-ext-${weight}-normal.woff2`));
 }
 assert.match(stylesheet,/--font-ui: var\(--shell-font\)/);
 assert.match(stylesheet,/Lato-Regular-latin-lt\.woff2[^}]*unicode-range:[^}]*U\+012E-012F/);
 assert.match(stylesheet,/Lato-Bold-latin-lt\.woff2[^}]*unicode-range:[^}]*U\+012E-012F/);
});
