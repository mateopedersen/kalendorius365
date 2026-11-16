import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {consentRecord,validConsent,validUnit,unitForWidth} from '../site/assets/advertising/ad-policy.js';
const productionConfig=JSON.parse(fs.readFileSync(new URL('../site/_data/advertising.json',import.meta.url),'utf8'));
const config={...productionConfig,enabled:true};
const code=fs.readFileSync(new URL('../site/assets/advertising/advertising.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/,'');
function browser({width=1000,choice=null,query='',host=config.hosts[0],blocked=false,hasSlot=true,enabled=true}={}){
 const scripts=[],events={},docEvents={},data=new Map(),dialogs=[];let observer;
 if(choice)data.set(config.storageKey,JSON.stringify(choice));
 const node=()=>({dataset:{},style:{},children:[],hidden:false,setAttribute(){},addEventListener(){},append(...children){this.children.push(...children);},showModal(){this.open=true;},close(){this.open=false;}});
 const placeholder=node(),stage={...node(),clientWidth:width,append(n){scripts.push(n);}};
 const slot={...node(),clientWidth:width,querySelector:s=>s==='[data-advertising-stage]'?stage:placeholder,getBoundingClientRect:()=>({top:300,bottom:700})};
 const document={visibilityState:'visible',getElementById:()=>({textContent:JSON.stringify({...config,enabled})}),querySelector:()=>hasSlot?slot:null,createElement(tag){const n=node();if(tag==='dialog')dialogs.push(n);return n;},body:{append(){}},addEventListener:(k,f)=>docEvents[k]=f};
 const context={document,URL,Date,innerHeight:800,location:{hostname:host,search:query,reload(){context.reloads++;}},localStorage:{getItem(k){if(blocked)throw Error('blocked');return data.get(k)||null;},setItem(k,v){if(blocked)throw Error('blocked');data.set(k,v);}},consentRecord,validConsent,unitForWidth,addEventListener:(k,f)=>events[k]=f,reloads:0,IntersectionObserver:function(cb){observer={cb,observe(){},disconnect(){}};return observer;}};context.window=context;
 vm.createContext(context);vm.runInContext(code,context);
 return {context,scripts,data,slot,stage,placeholder,dialogs,near:()=>observer?.cb([{isIntersecting:true}]),storage(key,newValue){if(key===null)data.clear();else if(newValue===null)data.delete(key);else data.set(key,newValue);events.storage({key,newValue});},click(action){docEvents.click({target:{closest:()=>({dataset:{advertisingChoice:action},hasAttribute:()=>false})},preventDefault(){}});},resize(w){slot.clientWidth=w;events.resize();}};
}
test('advertising records reject expired, forged, analytics-only and necessary-only choices',()=>{
 const now=Date.now();assert(validConsent(consentRecord(false,now),now));assert(validConsent(consentRecord(true,now),now));
 for(const record of [null,{version:1,analytics:true,expiresAt:now+1000},{version:1,advertising:'true',expiresAt:now+1000},{version:1,advertising:true,expiresAt:now},{version:1,advertising:true,expiresAt:now+181*86400000}])assert.equal(validConsent(record,now),false);
});
test('only the exact official host, key and supported size can become a tag',()=>{
 for(const unit of [config.desktop,config.mobile])assert(validUnit(unit,config.scriptHosts));
 assert.equal(validUnit({...config.mobile,src:'https://example.com/22/'+config.mobile.key},config.scriptHosts),false);
 assert.equal(validUnit({...config.mobile,src:config.mobile.src+'?private=data'},config.scriptHosts),false);
 assert.equal(validUnit({...config.mobile,width:299},config.scriptHosts),false);
 assert.equal(unitForWidth(728,config),config.desktop);assert.equal(unitForWidth(727,config),config.mobile);assert.equal(unitForWidth(299,config),null);
});
test('no vendor script before BOTH explicit advertising consent and viewport proximity',()=>{
 const b=browser();assert.equal(b.scripts.length,0);b.near();assert.equal(b.scripts.length,0);b.click('deny');assert.equal(b.scripts.length,0);b.click('allow');assert.equal(b.scripts.length,1);assert.equal(b.scripts[0].src,config.desktop.src);assert.equal(b.context.atOptions.key,config.desktop.key);assert.equal(b.context.atOptions.format,'iframe');assert.equal(b.context.atOptions.width,728);assert.equal(Object.keys(b.context.atOptions.params).length,0);b.near();b.click('allow');assert.equal(b.scripts.length,1);
 const saved=browser({choice:consentRecord(true)});assert.equal(saved.scripts.length,0);saved.near();assert.equal(saved.scripts.length,1);
});
test('mobile gets only300x250; resize never scales, clips or starts another impression',()=>{
 const b=browser({width:300});b.near();b.click('allow');assert.equal(b.scripts.length,1);assert.equal(b.scripts[0].src,config.mobile.src);assert.equal(b.context.atOptions.width,300);assert.equal(b.context.atOptions.height,250);
 const d=browser();d.near();d.click('allow');d.resize(300);assert.equal(d.slot.hidden,true);assert.equal(d.scripts.length,1);d.resize(1000);assert.equal(d.slot.hidden,false);assert.equal(d.scripts.length,1);
});
test('private query strings, preview hosts and refusals cannot start ads; revocation ends loaded code',()=>{
 for(const options of [{query:'?name=private'},{host:'127.0.0.1'},{choice:consentRecord(false)}]){const b=browser(options);b.near();if(!options.choice)b.click('allow');assert.equal(b.scripts.length,0);}
 const b=browser();b.near();b.click('allow');b.click('deny');assert.equal(b.context.reloads,1);assert.equal(JSON.parse(b.data.get(config.storageKey)).advertising,false);
 const blocked=browser({blocked:true});blocked.near();blocked.click('allow');assert.equal(blocked.scripts.length,1);assert.equal(blocked.data.has(config.storageKey),false);
});
test('ad placement is responsive, transparent and excluded from print',()=>{
 const css=fs.readFileSync(new URL('../site/assets/advertising/advertising.css',import.meta.url),'utf8');assert.match(css,/@media print\{\.ad-placement/);assert.match(css,/min-height:250px/);assert.match(css,/@container\(min-width:728px\)/);assert(!css.includes('position:fixed'));assert(!code.includes('document.write'));assert(!code.includes('setInterval'));
});

test('cross-tab ad choices preserve unsaved private/query/preview forms and unloaded pages',()=>{
 for(const options of [{hasSlot:false},{query:'?name=private'},{host:'127.0.0.1'},{}]){
  const b=browser(options);b.context.unsavedDraft='Unsent personal plan';
  b.storage('unrelated-planner-key',JSON.stringify(consentRecord(true)));
  assert.equal(b.context.K365Advertising.choice(),null);
  for(const [key,value] of [[null,JSON.stringify(consentRecord(true))],[config.storageKey,null],[config.storageKey,'invalid-json'],[config.storageKey,JSON.stringify({version:1,analytics:true,expiresAt:Date.now()+10000})],[config.storageKey,JSON.stringify(consentRecord(false))],[config.storageKey,JSON.stringify(consentRecord(true))]]){
   b.storage(key,value);assert.equal(b.context.reloads,0);assert.equal(b.scripts.length,0);assert.equal(b.context.unsavedDraft,'Unsent personal plan');
  }
  assert.equal(b.context.K365Advertising.choice().advertising,true);assert.equal(b.dialogs[0].children[3].textContent,config.labels.allowed);
  if(options.hasSlot!==false)assert.equal(b.slot.dataset.advertisingConsent,'granted');
 }
});
test('cross-tab grants still require viewport; loaded ads never refresh and revocation reloads only once',()=>{
 const b=browser();b.storage(config.storageKey,JSON.stringify(consentRecord(true)));assert.equal(b.scripts.length,0);b.near();assert.equal(b.scripts.length,1);
 b.storage(config.storageKey,JSON.stringify(consentRecord(true)));b.storage('analytics-key',null);assert.equal(b.scripts.length,1);assert.equal(b.context.reloads,0);
 for(const [key,value] of [[config.storageKey,JSON.stringify(consentRecord(false))],[config.storageKey,null],[config.storageKey,'invalid-json'],[null,JSON.stringify(consentRecord(true))]]){
  const loaded=browser({choice:consentRecord(true)});loaded.near();assert.equal(loaded.scripts.length,1);loaded.storage(key,value);assert.equal(loaded.context.reloads,1);assert.equal(loaded.scripts.length,1);assert.equal(loaded.slot.dataset.advertisingConsent,'denied');assert.equal(loaded.dialogs[0].children[3].textContent,config.labels.denied);
  loaded.storage(null,null);loaded.storage(config.storageKey,'invalid-json');loaded.storage(config.storageKey,JSON.stringify(consentRecord(true)));assert.equal(loaded.context.reloads,1);assert.equal(loaded.scripts.length,1);
 }
});

test('disabled delivery flag remains a kill switch despite saved, new or cross-tab permission',()=>{
 const disabledConfig={...productionConfig,enabled:false};
 for(const width of [300,728,1000])assert.equal(unitForWidth(width,disabledConfig),null);
 const b=browser({enabled:disabledConfig.enabled,choice:consentRecord(true)});b.near();b.click('allow');b.storage(config.storageKey,JSON.stringify(consentRecord(true)));b.resize(1000);b.near();
 assert.equal(b.scripts.length,0);assert.equal(b.context.reloads,0);assert.equal(b.context.atOptions,undefined);
});
