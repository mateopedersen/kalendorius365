import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the actual event handlers with controlled network completion order.
function setup(load) {
  const timers = new Map(); let nextTimer = 0;
  const element = tag => ({tag, value:'', hidden:true, attrs:new Map(), handlers:new Map(), children:[], dataset:{},
    classList:{add(){},remove(){},toggle(){}},
    setAttribute(k,v){this.attrs.set(k,v); if(k==='hidden')this.hidden=true;},
    getAttribute(k){return this.attrs.get(k);}, removeAttribute(k){this.attrs.delete(k);},
    addEventListener(k,f){this.handlers.set(k,f);},
    append(...items){this.children.push(...items);}, prepend(item){this.children.unshift(item);}, replaceChildren(...items){this.children=items;},
    querySelector(){return null;},querySelectorAll(){return this.children.filter(x=>x.attrs.get('role')==='option');},
    focus(){},blur(){},scrollIntoView(){},click(){this.handlers.get('click')?.({currentTarget:this});},
  });
  const selectors=['#site-search','#site-search-results','.header-search','#site-search-status','#nav-toggle','#primary-nav'];
  const els=new Map(selectors.map(s=>[s,element('div')])); const handlers=new Map();
  const document={querySelector:s=>els.get(s)||null,querySelectorAll:()=>[],createElement:element,documentElement:element('html'),
    addEventListener(k,f){handlers.set(k,f);}};
  let imports=0;
  vm.runInNewContext(fs.readFileSync(new URL('../site/assets/common.js',import.meta.url),'utf8')
    .replace('export function notice','function notice').replace('import("./search-engine.js")','__loadSearchEngine()'),{
      document,location:{pathname:'/'},localStorage:{getItem:()=>null},matchMedia:()=>({matches:true}),
      setTimeout:f=>{timers.set(++nextTimer,f);return nextTimer;},clearTimeout:id=>timers.delete(id),
      __loadSearchEngine:async()=>{imports++;return {loadSearchIndex:load,normalizeSearchText:s=>s.toLowerCase(),searchPages:(_,q)=>[{url:'/result/',title:q}]};},
    });
  const input=els.get('#site-search'),results=els.get('#site-search-results');
  return {input,results,els,handlers,imports:()=>imports,
    async run(q){input.value=q;input.handlers.get('input')();return this.flush();},
    async flush(){const pending=[...timers.values()];timers.clear();return Promise.all(pending.map(f=>f()));},
  };
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
 assert.equal(h.results.hidden,true);assert.equal(h.results.children.length,0);
});
test('failed search offers retry and succeeds without page reload',async()=>{
 let count=0;const h=setup(async()=>{if(++count===1)throw new Error('offline');return [];});
 await h.run('Joninės');const retry=h.results.children.find(e=>e.tag==='button');assert.ok(retry);
 await retry.handlers.get('click')();assert.equal(h.results.children[0].children[0].textContent,'Joninės');
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
 assert.equal(h.input.getAttribute('aria-activedescendant'),undefined);
});

test('retry remains an inside click after its button is detached',async()=>{
 const h=setup(async()=>[]);await h.run('Kaunas');
 h.handlers.get('click')({composedPath:()=>[{},h.els.get('.header-search')],target:{closest:()=>null}});
 assert.equal(h.results.hidden,false);
 h.handlers.get('click')({composedPath:()=>[{}],target:{closest:()=>null}});
 assert.equal(h.results.hidden,true);
});
