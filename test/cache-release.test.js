import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const ruby=process.env.K365_RUBY || 'ruby';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('asset revisions change for data-only edits and preserve module/data paths without deleting user storage',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'k365-cache-'));
 try {
  fs.mkdirSync(path.join(dir,'assets/data'),{recursive:true});
  fs.writeFileSync(path.join(dir,'index.html'),'<script src="/assets/common.js?v=old"></script><link href="/assets/style.css?v=old">');
  fs.writeFileSync(path.join(dir,'assets/common.js'),'import { value } from "./engine.js"; fetch("/assets/data/search.json");');
  fs.writeFileSync(path.join(dir,'assets/engine.js'),'export const value=new URL("./data/search.json",import.meta.url);');
  fs.writeFileSync(path.join(dir,'assets/style.css'),'body{color:black}');
  fs.writeFileSync(path.join(dir,'assets/data/search.json'),'["first"]');
  const run=()=>{
   const result=spawnSync(ruby,['-r',path.join(root,'lib/asset_release.rb'),'-e','dir=ARGV.fetch(0); before=AssetRelease.previous_revisions(dir); puts AssetRelease.publish(dir,previous:before).to_json',dir],{encoding:'utf8'});
   assert.equal(result.status,0,result.stderr);
   return JSON.parse(result.stdout);
  };
  const originalSource=fs.readFileSync(path.join(dir,'assets/common.js'),'utf8');
  const first=run();
  assert.match(first.revision,/^[0-9a-f]{20}$/);
  const module=first.assets['/assets/common.js'];
  const bytes=fs.readFileSync(path.join(dir,module.url));
  assert.equal(sha(bytes),module.sha256);
  assert.match(bytes.toString(),/from "\.\/engine\.js"/);
  assert.ok(bytes.includes(Buffer.from(first.assets['/assets/data/search.json'].url)));
  assert.ok(fs.readFileSync(path.join(dir,'index.html'),'utf8').includes(module.url));
  assert.ok(fs.readFileSync(path.join(dir,'assets/common.js'),'utf8').includes(first.assets['/assets/engine.js'].url));
  // Simulate a fresh Jekyll copy from source on each build.
  fs.writeFileSync(path.join(dir,'assets/common.js'),originalSource);
  fs.writeFileSync(path.join(dir,'assets/engine.js'),'export const value=new URL("./data/search.json",import.meta.url);');
  fs.writeFileSync(path.join(dir,'index.html'),'<script src="/assets/common.js?v=old"></script>');
  const stable=run();
  assert.equal(first.revision,stable.revision,'same source produces the same cache key');
  fs.writeFileSync(path.join(dir,'assets/common.js'),originalSource);
  fs.writeFileSync(path.join(dir,'assets/engine.js'),'export const value=new URL("./data/search.json",import.meta.url);');
  fs.writeFileSync(path.join(dir,'assets/data/search.json'),'["changed by daily publishing"]');
  fs.writeFileSync(path.join(dir,'index.html'),'<script src="/assets/common.js?v=old"></script>');
  const second=run();
  assert.notEqual(first.revision,second.revision,'data-only publication changes the asset cache key');
  assert.ok(second.retained_revisions.includes(first.revision));
  assert.ok(fs.existsSync(path.join(dir,module.url)),'already open tabs retain the previous immutable module');
  assert.doesNotMatch(fs.readFileSync(path.join(root,'lib/asset_release.rb'),'utf8'),/localStorage|indexedDB|caches\.delete/);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('generated release manifest matches every emitted immutable byte and stays within Cloudflare header limits',()=>{
 const publicDir=path.join(root,'public');
 const manifest=JSON.parse(fs.readFileSync(path.join(publicDir,'assets/release-manifest.json')));
 assert.ok(Object.keys(manifest.assets).length>30);
 for (const item of Object.values(manifest.assets)) {
  assert.ok(item.url.startsWith(`/assets/releases/${manifest.revision}/`));
  assert.equal(sha(fs.readFileSync(path.join(publicDir,item.url))),item.sha256,item.url);
 }
 const headers=fs.readFileSync(path.join(publicDir,'_headers'),'utf8');
 assert.ok(headers.split('\n').filter(line=>line.startsWith('/')).length<=100);
 assert.match(headers,/\/assets\/releases\/\*\n  Cache-Control: public, max-age=31536000, immutable/);
 assert.match(headers,/\/assets\/data\/search\.json\n  Cache-Control: public, no-cache, max-age=0, must-revalidate/);
 assert.match(headers,/\/assets\/common\.js\n  Cache-Control: public, no-cache, max-age=0, must-revalidate/);
 assert.match(headers,/(?:^|\n)\/\n  Cache-Control: public, no-cache, max-age=0, must-revalidate/);
 assert.ok(manifest.retained_revisions.length<=3);
});
