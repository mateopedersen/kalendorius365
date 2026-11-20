import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('responsive weather picture fills its frame and retains the original fallback assets', () => {
 const html=readFileSync(new URL('../site/_includes/planner-workspace.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../site/assets/shell/site-shell.css',import.meta.url),'utf8');
 assert.match(html,/<picture class="clock-photo__frame">\s*<source type="image\/avif"[^>]+>\s*<img class="climate-card__image"[^>]+>\s*<\/picture>/);
 assert.match(css,/\.clock-photo__frame \.climate-card__image\s*\{[^}]*object-fit:\s*cover;/);
 const evidence=JSON.parse(readFileSync(new URL('../docs/performance/weather-avif.json',import.meta.url),'utf8'));
 for(const row of evidence){const source=readFileSync(new URL('../'+row.source,import.meta.url));assert.equal(createHash('sha256').update(source).digest('hex'),row.source_sha256);assert.equal(row.source_retained,true);}
});
