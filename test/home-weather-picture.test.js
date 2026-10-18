import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('responsive weather picture preserves its absolute background layout and original fallback assets', () => {
 const html=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../site/assets/design-system.css',import.meta.url),'utf8');
 assert.match(html,/<picture><source type="image\/avif"[^>]+><img class="climate-card__image"[^>]+><\/picture>/);
 assert.match(css,/\.climate-card > picture,\s*\.climate-card > picture > \.climate-card__image\s*\{\s*position: absolute;/);
 const evidence=JSON.parse(readFileSync(new URL('../docs/performance/weather-avif.json',import.meta.url),'utf8'));
 for(const row of evidence){const source=readFileSync(new URL('../'+row.source,import.meta.url));assert.equal(createHash('sha256').update(source).digest('hex'),row.source_sha256);assert.equal(row.source_retained,true);}
});
