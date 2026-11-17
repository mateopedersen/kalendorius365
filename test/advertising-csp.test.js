import fs from 'node:fs';
import productionAdPaths from '../functions/advertising-routes.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { advertisingCandidate, advertisingCsp, advertisingResponse } from '../lib/advertising-csp.mjs';
const paths = new Set(['/public/']);
const hosts = ['kalendorius365.lt'];
const original = "default-src 'self'; script-src 'self' 'sha256-abc' 'nonce-xyz'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src https://docs.google.com; object-src 'none'; form-action 'self'; frame-ancestors 'none'";
const context = (path, response) => ({ request: new Request('https://kalendorius365.lt' + path), next: async () => response });
const html = (body = '<section data-advertising-slot>Advertising</section>', status = 200) => new Response(body, {status, headers: {'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': original}});
test('advertising policy grants only exact observed origins and removes blocking nonce/hash sources', () => {
  const policy = advertisingCsp(original);
  const scripts = policy.match(/(?:^|; )script-src ([^;]+)/)[1];
  assert.match(scripts, /'unsafe-inline'/);
  assert.match(scripts, /https:\/\/bauval\.org/);
  assert.doesNotMatch(scripts, /sha256|nonce-|unsafe-eval|\*/);
  assert.match(policy, /script-src-attr 'none'/);
  assert.match(policy, /img-src [^;]*https:\/\/static\.nresystems\.com https:\/\/cdn\.storageimagedisplay\.com/);
  assert.match(policy, /object-src 'none'; form-action 'self'; frame-ancestors 'none'/);
  assert.equal(advertisingCsp(null), null);
});
test('public page must be an exact allowlisted path on the production host without any query', () => {
  assert.equal(advertisingCandidate(context('/public/', html()).request, paths, hosts), true);
  for (const path of ['/public/?q=private', '/public/?date=2030-01-01', '/private/', '/', '/public/extra/', '/public.js']) assert.equal(advertisingCandidate(context(path, html()).request, paths, hosts), false);
  assert.equal(advertisingCandidate(new Request('https://preview.pages.dev/public/'), paths, hosts), false);
  assert.equal(advertisingCandidate(new Request('https://kalendorius365.lt/public/', {method: 'POST'}), paths, hosts), false);
});
test('private routes and all query requests preserve strict CSP without reading response bodies', async () => {
  for (const path of ['/private/', '/public/?q=private', '/']) {
    const response = html();
    response.clone = () => { throw new Error('Private response must not be buffered'); };
    const result = await advertisingResponse(context(path, response), paths, hosts);
    assert.equal(result, response);
    assert.equal(result.headers.get('Content-Security-Policy'), original);
  }
});
test('public exception also requires 200 HTML, a real slot, and the base CSP', async () => {
  for (const response of [html('<p>No ad slot</p>'), html(undefined, 404), new Response('data', {headers:{'Content-Type':'application/json'}}), new Response('<section data-advertising-slot></section>', {headers:{'Content-Type':'text/html'}})]) {
    const result = await advertisingResponse(context('/public/', response), paths, hosts);
    assert.equal(result, response);
  }
  const response = html();
  const result = await advertisingResponse(context('/public/', response), paths, hosts);
  assert.notEqual(result, response);
  assert.match(result.headers.get('Content-Security-Policy'), /script-src 'self' 'unsafe-inline' https:\/\/bauval\.org/);
  assert.equal(await result.text(), '<section data-advertising-slot>Advertising</section>');
});

test('approved production routes match real public ad slots and preserve strict private/query policy',()=>{
 const actualPaths=new Set(productionAdPaths);assert.equal(actualPaths.size,productionAdPaths.length);assert(actualPaths.has('/juodasis-penktadienis/'));
 for(const path of ["/", "/privatumas/", "/slapukai/", "/kontaktai/", "/paieska/", "/seimos-kalendorius/"])assert(actualPaths.has(path),path);
 for(const path of actualPaths){const html=fs.readFileSync(new URL('../public'+path+'index.html',import.meta.url),'utf8');assert.equal((html.match(/data-advertising-slot/g)||[]).length,1,path);}
 const headers=fs.readFileSync(new URL('../public/_headers',import.meta.url),'utf8');
 const policy=headers.match(/Content-Security-Policy: ([^\n]+)/)[1];assert.doesNotMatch(policy,/bauval|nresystems|storageimagedisplay/);assert.doesNotMatch(policy.match(/script-src ([^;]+)/)[1],/'unsafe-inline'/);
 const productionHosts=['kalendorius365.lt'];assert(advertisingCandidate(new Request('https://kalendorius365.lt/juodasis-penktadienis/'),actualPaths,productionHosts));
 assert(!advertisingCandidate(new Request('https://kalendorius365.lt/juodasis-penktadienis/?q=private'),actualPaths,productionHosts));
 for(const path of ["/", "/privatumas/", "/slapukai/", "/kontaktai/", "/paieska/", "/seimos-kalendorius/"])assert(advertisingCandidate(new Request('https://kalendorius365.lt'+path),actualPaths,productionHosts),path);
});
