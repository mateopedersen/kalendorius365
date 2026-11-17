import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const config=JSON.parse(read('site/_data/advertising.json')),html=read('site/_includes/advertising.html');
test('public placement is a genuine responsive Banner stage using the approved provider units',()=>{assert.equal(config.enabled,true);assert.equal(config.mode,'display-banner');assert.equal(config.desktop.width,728);assert.equal(config.mobile.width,300);for(const unit of [config.desktop,config.mobile])assert.equal(unit.src,'https://bauval.org/22/'+unit.key);assert.match(html,/data-advertising-stage/);assert.doesNotMatch(html,/data-sponsored-link|sponsored-banner|asiafilm|<a /);});
