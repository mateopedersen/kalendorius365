import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {consentRecord,validConsent,validUnit,unitForWidth} from '../site/assets/advertising/ad-policy.js';
const productionConfig=JSON.parse(readFileSync(new URL('../site/_data/advertising.json',import.meta.url)));
const config={...productionConfig,enabled:true};
test('Lithuanian real banner units fit one responsive placement and do not use another site unit',()=>{
 assert.equal(config.enabled,true);assert.equal(config.mobile.key,'c6b5a54d0ae733339f2fa22b92f7dfcc');assert.equal(config.desktop.key,'d325a59af4ebe4b4db284f3af4fe2611');
 for(const unit of [config.mobile,config.desktop])assert(validUnit(unit,config.scriptHosts));
 assert.equal(unitForWidth(299,config),null);assert.equal(unitForWidth(300,config).width,300);assert.equal(unitForWidth(727,config).width,300);assert.equal(unitForWidth(728,config).width,728);
 assert.equal(unitForWidth(1000,{...config,enabled:false}),null);
 assert.equal(validUnit({...config.mobile,src:'https://bauval.org.evil.invalid/22/'+config.mobile.key},config.scriptHosts),false);
});
test('analytics choices and invalid marketing records never grant advertising',()=>{
 const now=Date.now(),allowed=consentRecord(true,now);assert(validConsent(allowed,now));
 for(const value of [null,{version:1,analytics:true,expiresAt:now+5000},{...allowed,advertising:'true'},{...allowed,expiresAt:now},{...allowed,expiresAt:now+181*86400000}])assert(!validConsent(value,now));
 const denied=consentRecord(false,now);assert(validConsent(denied,now));assert.equal(denied.advertising,false);
});

test('production is enabled after provider safety confirmation',()=>{assert.equal(productionConfig.enabled,true);});
