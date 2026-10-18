import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const layout=readFileSync(new URL('../site/_layouts/default.html',import.meta.url),'utf8');
const boot=layout.match(/<script>(.*?)<\/script>/s)[1];
const moduleSource=readFileSync(new URL('../site/assets/cookie-notice.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function scenario({dismissed=false,outside=false,failed=false,blocked=false,early=true}={}){
 const personal='{"notes":{"2028-01-02":"Ąčęėįšųūž"},"tasks":[],"preferences":{}}';
 const values=new Map([['kalendorius365:v1',personal],...(dismissed?[['kalendorius365:privacy-notice:v1','dismissed']]:[])]);
 const calls=[],listeners={};const notice={hidden:true,removed:false,remove(){this.removed=true}};
 const button={addEventListener(name,handler){listeners[name]=handler}};
 const context=vm.createContext({window:{},document:{documentElement:{classList:{toggle(){}}},querySelector(selector){return selector==='#cookie-notice'?notice:button}},localStorage:{getItem(key){if(blocked)throw Error('Storage blocked');return values.get(key)},setItem(key,value){if(blocked)throw Error('Storage blocked');values.set(key,value)}},fetch:async(url,options)=>{calls.push({url,options});if(failed)throw Error('Offline');return {ok:true,json:async()=>({showNotice:!outside})}}});
 if(early)vm.runInContext(boot,context);
 vm.runInContext(moduleSource,context);await flush();await flush();
 assert.equal(values.get('kalendorius365:v1'),personal,'Personal calendar bytes must remain unchanged');
 for(const call of calls){assert.equal(call.url,'/api/privacy-region');assert.equal(call.options.cache,'no-store');assert.equal(call.options.credentials,'same-origin');assert.equal(call.options.priority,'low');}
 return {calls,notice,values,listeners};
}
test('head and module reuse one non-cacheable region request without changing personal data',async()=>{const x=await scenario();assert.equal(x.calls.length,1);assert.equal(x.notice.hidden,false);x.listeners.click();assert.equal(x.values.get('kalendorius365:privacy-notice:v1'),'dismissed');assert.equal(x.notice.removed,true)});
test('previous dismissal avoids both the early and module region requests',async()=>{const x=await scenario({dismissed:true});assert.equal(x.calls.length,0);assert.equal(x.notice.removed,true)});
test('failed early lookup keeps the conservative privacy notice',async()=>{const x=await scenario({failed:true});assert.equal(x.calls.length,1);assert.equal(x.notice.hidden,false)});
test('blocked storage still permits the notice without a duplicate lookup',async()=>{const x=await scenario({blocked:true});assert.equal(x.calls.length,1);assert.equal(x.notice.hidden,false)});
test('region result retains the existing outside-Europe behavior',async()=>{const x=await scenario({outside:true});assert.equal(x.calls.length,1);assert.equal(x.notice.removed,true)});
test('module retains its fallback when no head promise exists',async()=>{const x=await scenario({early:false});assert.equal(x.calls.length,1);assert.equal(x.notice.hidden,false)});
