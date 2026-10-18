import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('native document fonts avoid initial downloads and retain all original complete fonts',()=>{
 const css=readFileSync(new URL('../site/assets/design-system.css',import.meta.url),'utf8');
 const layout=readFileSync(new URL('../site/_layouts/default.html',import.meta.url),'utf8');
 assert.match(css,/--font-ui:\s*system-ui/);
 assert.doesNotMatch(layout,/<link\b[^>]*as="font"/);
 const proof=JSON.parse(readFileSync(new URL('../docs/performance/font-subsets.json',import.meta.url),'utf8'));
 for(const [i,weight]of ['Regular','Bold','Black'].entries()){
  const bytes=readFileSync(new URL('../site/assets/fonts/Lato-'+weight+'.woff2',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),proof.fonts[i].original_sha256);
 }
});
