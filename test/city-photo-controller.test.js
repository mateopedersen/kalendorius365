import test from 'node:test';
import assert from 'node:assert/strict';
import {createCityPhotoController} from '../site/assets/data/city-photo-controller.js';
function setup(){
 const cities=[{id:'a'},{id:'b'}],day={a:{image:'a-day'},b:{image:'b-day'}},night={a:{image:'a-night'},b:{image:'b-night'}};
 const pending=new Map(),frames=[],timers=[];let time=new Date(0);
 const controller=createCityPhotoController({cities,day,night,now:()=>time,
  stateFor:async()=>({period:+time<1000?'day':'night',nextChange:new Date(+time<1000?1000:86400000)}),
  setTimer(fn,delay){const t={fn,delay};timers.push(t);return t;},clearTimer(){},
  load:photo=>new Promise((resolve,reject)=>pending.set(photo.image,{resolve,reject})),
  display:frame=>frames.push(frame),
 });
 return{controller,pending,frames,timers,time:value=>{time=new Date(value);}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('rapid changes never show a stale city; decoded revisits reuse their frames',async()=>{
 const h=setup();const a=h.controller.select('a');await flush();const b=h.controller.select('b');await flush();h.pending.get('a-day').resolve('decoded a');await a;assert.equal(h.frames.length,0);
 h.pending.get('b-day').resolve('decoded b');await b;assert.equal(h.frames[0].city.id,'b');await h.controller.select('a');assert.equal(h.frames[1].frame,'decoded a');
});
test('the exact solar timer changes a stationary selected city without a weather request',async()=>{
 const h=setup();let done=h.controller.select('a');await flush();h.pending.get('a-day').resolve('day frame');await done;assert.equal(h.timers.at(-1).delay,1025);
 h.time(1025);h.timers.at(-1).fn();await flush();assert.equal(h.frames.at(-1).period,'day','last clear frame remains during decoding');h.pending.get('a-night').resolve('night frame');await flush();assert.equal(h.frames.at(-1).period,'night');assert.equal(h.frames.at(-1).frame,'night frame');
});
test('failed photographs preserve the last frame and can be retried',async()=>{
 const h=setup();const a=h.controller.select('a');await flush();h.pending.get('a-day').resolve('a');await a;const b=h.controller.select('b');await flush();h.pending.get('b-day').reject(Error('offline'));assert.equal(await b,false);assert.equal(h.frames.at(-1).city.id,'a');const retry=h.controller.update();await flush();h.pending.get('b-day').resolve('b');await retry;assert.equal(h.frames.at(-1).city.id,'b');
});
