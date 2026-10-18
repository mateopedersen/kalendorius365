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
