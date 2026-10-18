import test from 'node:test';
import assert from 'node:assert/strict';
import {headerHarness} from './helpers/header-dom.js';

// Use the real shared handlers with controlled network completion and timers.
function setup(load) {
 const h=headerHarness({loadIndex:load,search:(_,q)=>[{url:'/result/',title:q}]});
 h.toggle.click();
 const handlers=new Map(['keydown','click'].map(name=>[name,event=>h.document.emit(name,event)]));
 const inputEmit=(name,event={})=>h.input.emit(name,event);
 const input={...h.input,handlers:new Map(['input','focus','keydown'].map(name=>[name,event=>inputEmit(name,event)]))};
 Object.defineProperty(input,'value',{get:()=>h.input.value,set:value=>{h.input.value=value;}});
 return {...h,input,els:new Map([['#nav-toggle',h.navToggle],['.header-search',h.form]]),handlers,
  async run(q){h.input.value=q;h.input.emit('input');return h.flush();}};
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

test('a late rejected request cannot replace results for the latest query',async()=>{
 const first=deferred(),second=deferred();let calls=0;const h=setup(()=>++calls===1?first.promise:second.promise);
 const old=h.run('old');await Promise.resolve();const latest=h.run('latest');await Promise.resolve();
 second.resolve([]);await latest;first.reject(new Error('old request failed'));await old;
 assert.equal(h.results.children[0].children[0].textContent,'latest');
});
test('dismissing in-flight search cancels its rendered response',async()=>{
 const pending=deferred();const h=setup(()=>pending.promise);const request=h.run('Velykos');await Promise.resolve();
 h.handlers.get('keydown')({key:'Escape'});pending.resolve([]);await request;
 assert.equal(h.results.hidden,true);assert.equal(h.panel.hidden,true);
});
test('failed search offers retry and succeeds without page reload',async()=>{
 let count=0;const h=setup(async()=>{if(++count===1)throw new Error('offline');return [];});
 await h.run('Joninės');const retry=h.results.children.find(e=>e.tag==='button');assert.ok(retry);
 await retry.emit('click');assert.equal(h.results.children[0].children[0].textContent,'Joninės');
 assert.equal(h.imports(),2);
});
test('typing coalesces work and refocusing restores unchanged-query results',async()=>{
 let calls=0;const h=setup(async()=>{calls++;return [];});
 h.input.value='a';h.input.handlers.get('input')();h.input.value='Avinas';h.input.handlers.get('input')();
 await h.flush();assert.equal(calls,1);
 h.handlers.get('keydown')({key:'Escape'});h.input.handlers.get('focus')();await h.flush();
 assert.equal(h.results.hidden,false);assert.equal(h.results.children[0].children[0].textContent,'Avinas');
});
test('search and the small-screen menu exclude each other and keep ARIA truthful',async()=>{
 const h=setup(async()=>[]);const nav=h.els.get('#nav-toggle');nav.click();assert.equal(nav.getAttribute('aria-expanded'),'true');
 h.input.handlers.get('focus')();assert.equal(nav.getAttribute('aria-expanded'),'false');
 await h.run('Kaunas');nav.click();assert.equal(h.results.hidden,true);assert.equal(h.input.getAttribute('aria-expanded'),'false');
});

test('returning focus from retry controls preserves visible keyboard options',async()=>{
 let calls=0;const h=setup(async()=>{calls++;return [];});await h.run('Kaunas');
 h.input.handlers.get('focus')();await h.flush();
 assert.equal(calls,1,'visible results must not be rerendered between ArrowDown and Enter');
 assert.equal(h.results.hidden,false);
});

test('closed dropdown options cannot be selected before refocus finishes loading',async()=>{
 const h=setup(async()=>[]);await h.run('Kaunas');h.handlers.get('keydown')({key:'Escape'});
 h.input.handlers.get('focus')();h.input.handlers.get('keydown')({key:'ArrowDown',preventDefault(){}});
 assert.equal(h.input.getAttribute('aria-activedescendant'),null);
});

test('retry remains an inside click after its button is detached',async()=>{
 const h=setup(async()=>[]);await h.run('Kaunas');
 h.handlers.get('click')({composedPath:()=>[{},h.els.get('.header-search')],target:{closest:()=>null}});
 assert.equal(h.results.hidden,false);
 h.handlers.get('click')({composedPath:()=>[{}],target:{closest:()=>null}});
 assert.equal(h.results.hidden,true);
});
