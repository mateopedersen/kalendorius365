import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import productionAdPaths from '../functions/advertising-routes.js';
import {advertisingCandidate,advertisingCsp,advertisingResponse} from '../lib/advertising-csp.mjs';
const original="default-src 'self'; script-src 'self' 'sha256-abc' 'nonce-xyz'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src https://docs.google.com; object-src 'none'; form-action 'self'; frame-ancestors 'none'";
const host='kalendorius365.lt',hosts=[host],paths=new Set(['/']);
test('official creative permissions retain base hashes, nonces and blocked event handlers',()=>{
 const p=advertisingCsp(original);assert.match(p,/(?:^|\s)https:\/\/bauval\.org(?:\s|;|$)/);assert.match(p,/'nonce-xyz'/);assert.match(p,/'sha256-abc'/);assert.doesNotMatch(p,/(?:^|;)\s*script-src\s[^;]*unsafe-inline|asiafilm/);assert.match(p,/(?:^|;)\s*script-src\s[^;]*'unsafe-eval'/);const elements=p.split(';').find(v=>v.trim().startsWith('script-src-elem '));assert(elements.includes("'unsafe-inline'"));assert(elements.includes('https://bauval.org'));assert.doesNotMatch(elements,/sha256-|nonce-|unsafe-eval/);assert.match(p,/script-src-attr 'none'/);assert.match(p,/object-src 'none'/);assert.equal(advertisingCsp(null),null);
});
test('private/query/preview/method/error/download responses never gain a provider exception or require body buffering',async()=>{
 for(const [url,method,status,type]of [[`https://${host}/?q=private`,'GET',200,'text/html'],[`https://${host}/private/`,'GET',200,'text/html'],['https://preview.pages.dev/','GET',200,'text/html'],[`https://${host}/`,'POST',200,'text/html'],[`https://${host}/`,'GET',404,'text/html'],[`https://${host}/`,'GET',200,'application/pdf']]){
  const response=new Response('body',{status,headers:{'Content-Type':type,'Content-Security-Policy':original}});response.clone=()=>{throw Error('Private body must not be buffered');};
  const result=await advertisingResponse({request:new Request(url,{method}),next:async()=>response},paths,hosts);assert.equal(result,response);assert.equal(result.headers.get('Content-Security-Policy'),original);
 }
});
test('only successful public HTML actually containing the display slot gains the provider exception',async()=>{
 for(const [body,expected]of [['plain content',false],['<section data-advertising-mode="display-banner" data-advertising-slot></section>',true]]){
  const response=new Response(body,{headers:{'Content-Type':'text/html','Content-Security-Policy':original,'Cache-Control':'public,max-age=0'}});
  const result=await advertisingResponse({request:new Request(`https://${host}/`),next:async()=>response},paths,hosts);assert.equal(result.headers.get('Content-Security-Policy').split(/[;\s]+/).some(source=>source==='https://bauval.org'),expected);assert.equal(await result.text(),body);assert.equal(result.headers.get('Cache-Control'),'public,max-age=0');
 }
});
test('published HTML contains no Adsterra placement or configuration',()=>{
 assert.deepEqual(productionAdPaths,[]);
 const site=new URL('../public/',import.meta.url);
 const pages=fs.readdirSync(site,{recursive:true}).filter(file=>file.endsWith('.html'));
 assert(pages.length>100,'all public HTML is available');
 for(const file of pages)assert.doesNotMatch(fs.readFileSync(new URL(encodeURI(file),site),'utf8'),/data-advertising-slot|id="advertising-config"|data-sponsored-link|data-banner-choice|adsterra\.com|bauval\.org/i,file);
});

test('a reviewed path alone cannot grant ads to directories, forecasts or robots-excluded responses', async () => {
  for (const path of ['/orai/vilnius/', '/paieska/', '/irankiai/', '/svetaines-zemelapis/', '/404.html']) {
    assert.equal(advertisingCandidate(new Request('https://' + host + path), new Set([path]), hosts), false, path);
  }
  for (const directive of ['noindex, follow', 'none']) {
    const response = new Response('<section data-advertising-mode="display-banner"></section>', {
      headers: {'Content-Type': 'text/html', 'X-Robots-Tag': directive, 'Content-Security-Policy': original}
    });
    const result = await advertisingResponse({request: new Request('https://' + host + '/'), next: () => response}, paths, hosts);
    assert.equal(result, response);
  }
});

test('seller declaration, cookie disclosure and privacy section match the inactive advertising setup', () => {
  const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const declaration = read('../site/ads.txt').trim();
  assert.match(declaration, /^google\.com, pub-\d{16}, DIRECT, f08c47fec0942fa0$/);
  const config = JSON.parse(read('../site/_data/advertising.json'));
  assert.equal(config.enabled, false);
  assert.deepEqual(config.reviewedPages, []);
  const privacy = read('../site/_includes/privacy-policy-lt.html');
  const target = config.privacy.split('#')[1];
  assert.ok(privacy.includes('id="' + target + '"'));
  assert.ok(read('../site/slapukai/index.html').includes('href="' + config.privacy + '"'));
  assert.match(privacy, /Šiuo metu reklamos nerodome/);
  assert.match(privacy, /https:\/\/myadcenter\.google\.com\//);
});
