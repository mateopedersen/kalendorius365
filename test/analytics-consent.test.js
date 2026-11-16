import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnalytics} from '../site/assets/cookie-notice.js';
const id='G-X6YPLKE9K9',key='test:analytics-choice',host='kalendorius365.lt';
function browser({saved,hostname=host,pathname='/',blocked=false}={}){
  const data=new Map([['personal',JSON.stringify({note:'private calendar note'})]]),scripts=[],handlers={},cookies=new Map([['_ga','test'],['_ga_X6YPLKE9K9','test'],['essential','keep']]);
  if(saved)data.set(key,JSON.stringify(saved));
  const document={title:'Public page',referrer:'https://example.com/page?email=PRIVATE#PRIVATE',querySelector:()=>({content:'Public page'}),head:{append:s=>scripts.push(s)},createElement:()=>({})};
  Object.defineProperty(document,'cookie',{get:()=>[...cookies].map(([k,v])=>k+'='+v).join(';'),set:s=>{if(s.includes('Max-Age=0'))cookies.delete(s.split('=')[0]);}});
  const target={document,location:{hostname,pathname,href:'https://'+hostname+pathname+'?q=PRIVATE#PRIVATE'},localStorage:{getItem:k=>data.get(k)||null,setItem(k,v){if(blocked)throw Error('blocked');data.set(k,v);}},addEventListener:(name,fn)=>handlers[name]=fn};
  const api=createAnalytics({id,hosts:[host,'www.'+host],key},target);
  return{api,target,scripts,data,cookies,commands:()=>Array.from(target.dataLayer||[],c=>Array.from(c)),storage(value){handlers.storage({key,newValue:value});}};
}
test('unapproved, invalid, expired, rejected, and preview visits never request Google',()=>{
  for(const saved of [undefined,{version:0,analytics:true,expiresAt:Date.now()+5000},{version:1,analytics:'true',expiresAt:Date.now()+5000},{version:1,analytics:true,expiresAt:Date.now()-1},{version:1,analytics:false,expiresAt:Date.now()+5000}])assert.equal(browser({saved}).scripts.length,0);
  for(const hostname of ['127.0.0.1','preview.pages.dev','other.example']){const b=browser({hostname});b.api.choose(true);assert.equal(b.scripts.length,0);}
  const privatePage=browser({pathname:'/admin/'});privatePage.api.choose(true);assert.equal(privatePage.scripts.length,0);
});
test('one page view source starts only after clean URLs and privacy defaults are set',()=>{
  const b=browser();b.api.choose(true);b.api.choose(true);createAnalytics({id,hosts:[host],key},b.target);
  assert.equal(b.scripts.length,1);assert.equal(b.scripts[0].src,'https://www.googletagmanager.com/gtag/js?id='+id);
  const c=b.commands(),config=c.filter(x=>x[0]==='config');assert.equal(config.length,1);assert.equal(c.filter(x=>x[0]==='event'&&x[1]==='page_view').length,0);
  assert(c.findIndex(x=>x[0]==='set')<c.findIndex(x=>x[0]==='js'));
  const settings=config[0][2];assert.equal(settings.send_page_view,true);assert.equal(settings.page_location,'https://'+host+'/');assert.equal(settings.page_referrer,'https://example.com/page');assert(!JSON.stringify(c).includes('PRIVATE'));
  assert.equal(settings.allow_google_signals,false);assert.equal(settings.allow_ad_personalization_signals,false);assert.equal(settings.cookie_expires,15552000);assert.equal(settings.cookie_update,false);
  for(const command of c.filter(x=>x[0]==='consent'))for(const k of ['ad_storage','ad_user_data','ad_personalization'])assert.equal(command[2][k],'denied');
});
test('withdrawal erases only GA cookies and regrant does not duplicate the page view',()=>{
  const b=browser(),personal=b.data.get('personal');b.api.choose(true);b.api.choose(false);assert.equal(b.target['ga-disable-'+id],true);assert.deepEqual([...b.cookies.keys()],['essential']);assert.equal(b.data.get('personal'),personal);
  b.api.choose(true);assert.equal(b.target['ga-disable-'+id],false);assert.equal(b.scripts.length,1);assert.equal(b.commands().filter(x=>x[0]==='config').length,1);
});
test('cross-tab changes apply without reloading unsaved work, and blocked storage is safe',()=>{
  const b=browser();let choices=[];b.api.subscribe(x=>choices.push(x));b.api.choose(true);b.storage(JSON.stringify({version:1,analytics:false,expiresAt:Date.now()+5000}));assert.equal(b.target['ga-disable-'+id],true);assert.equal(choices.at(-1).analytics,false);
  b.storage(null);assert.equal(b.api.choice(),null);assert.equal(b.scripts.length,1);
  const blocked=browser({blocked:true});blocked.api.choose(true);assert.equal(blocked.api.choice().analytics,true);assert.equal(blocked.data.has(key),false);assert.equal(blocked.scripts.length,1);
});
