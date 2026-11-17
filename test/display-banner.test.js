import test from 'node:test';
import assert from 'node:assert/strict';
import {mountDisplayBanner} from '../site/assets/advertising/display-runtime.js';
const key='1234567890abcdef1234567890abcdef';
const unit=(width,height)=>({key,width,height,src:'https://bauval.org/22/'+key});
const config={enabled:true,mode:'display-banner',hosts:['example.fi'],scriptHosts:['bauval.org'],storageKey:'ad-choice',desktop:unit(728,90),mobile:unit(300,250)};
function fixture({width=1000,host='example.fi',search='',hash='',stored=null,canonical='https://example.fi/',failStorage=false,visible=true}={}){
 const scripts=[],events={},docEvents={},writes=[];let storage=stored,reloads=0;
 const stage={style:{},append(script){scripts.push(script);},replaceChildren(){scripts.length=0;}};
 const slot={dataset:{},hidden:false,clientWidth:width,querySelector:()=>stage};
 const doc={visibilityState:visible?'visible':'hidden',querySelector(selector){return selector.startsWith('link')?{href:canonical}:slot;},querySelectorAll:()=>[],addEventListener(type,fn){docEvents[type]=fn;},createElement(tag){assert.equal(tag,'script');return{addEventListener(){}};}};
 const target={document:doc,location:{hostname:host,pathname:'/',search,hash,reload(){reloads++;}},requestAnimationFrame(fn){fn();},addEventListener(type,fn){events[type]=fn;},localStorage:{getItem(){if(failStorage)throw Error('Unavailable');return storage;},setItem(k,v){writes.push([k,v]);storage=v;}}};
 return {target,slot,stage,scripts,writes,events,docEvents,reloads:()=>reloads};
}
test('a fresh public visit requests the exact fitting official tag automatically without an invented creative or permission write',()=>{
 for(const [width,expected] of [[1000,728],[728,728],[727,300],[300,300]]){
  const f=fixture({width});mountDisplayBanner(config,f.target);assert.equal(f.scripts.length,1);assert.equal(f.scripts[0].src,'https://bauval.org/22/'+key);assert.equal(f.scripts[0].async,true);assert.deepEqual(f.target.atOptions,{key,format:'iframe',width:expected,height:expected===728?90:250,params:{}});assert.equal(f.slot.hidden,false);assert.equal(f.writes.length,0);
 }
});
test('preview hosts, personal query/hash, bad canonical, disabled delivery and undersized slots never request the provider',()=>{
 for(const options of [{host:'localhost'},{host:'preview.pages.dev'},{search:'?private=note'},{hash:'#private'},{canonical:'https://example.fi/other/'},{width:299}]){
  const f=fixture(options);mountDisplayBanner(config,f.target);assert.equal(f.scripts.length,0,JSON.stringify(options));assert.equal(f.slot.hidden,true);
 }
 const f=fixture();mountDisplayBanner({...config,enabled:false},f.target);assert.equal(f.scripts.length,0);
});
test('a saved explicit rejection is honored and private-mode storage failure does not crash the page',()=>{
 const f=fixture({stored:JSON.stringify({version:1,advertising:false,expiresAt:Date.now()+86400000})});mountDisplayBanner(config,f.target);assert.equal(f.scripts.length,0);assert.equal(f.slot.hidden,true);
 const other=fixture({failStorage:true});mountDisplayBanner(config,other.target);assert.equal(other.scripts.length,1);
});
test('mounting, visibility changes and resizing cannot issue a second paid tag or reload unfinished work',()=>{
 const f=fixture();mountDisplayBanner(config,f.target);mountDisplayBanner(config,f.target);f.events.resize();f.docEvents.visibilitychange();assert.equal(f.scripts.length,1);f.slot.clientWidth=320;f.events.resize();assert.equal(f.slot.hidden,true);assert.equal(f.reloads(),0);assert.equal(f.writes.length,0);
});
test('hidden documents defer the request and only approved vendor URLs can become tags',()=>{
 const f=fixture({visible:false});mountDisplayBanner(config,f.target);assert.equal(f.scripts.length,0);f.target.document.visibilityState='visible';f.docEvents.visibilitychange();assert.equal(f.scripts.length,1);
 for(const src of ['https://evil.invalid/22/'+key,'https://bauval.org/22/'+key+'?private=note','https://bauval.org/22/'+key+'#fragment']){const bad=fixture();mountDisplayBanner({...config,desktop:{...config.desktop,src},mobile:{...config.mobile,src}},bad.target);assert.equal(bad.scripts.length,0);}
});
test('turning the banner off hides it without erasing plans, navigating or automatically refreshing an impression',()=>{
 const f=fixture();mountDisplayBanner(config,f.target);f.target.Calendar365Banner.setAllowed(false);assert.equal(f.slot.hidden,true);assert.equal(f.scripts.length,0);assert.equal(JSON.parse(f.writes[0][1]).advertising,false);assert.equal(f.reloads(),0);f.target.Calendar365Banner.setAllowed(true);assert.equal(f.scripts.length,0,'already executed tags are not reissued; next page load applies the choice');
});
