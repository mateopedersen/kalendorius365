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

test('previous immutable releases survive Jekyll destination cleanup',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'k365-retain-'));
 const stash=fs.mkdtempSync(path.join(os.tmpdir(),'k365-stash-'));
 try {
  const revisions=['a'.repeat(20),'b'.repeat(20),'c'.repeat(20)];
  fs.mkdirSync(path.join(dir,'assets/releases'),{recursive:true});
  fs.writeFileSync(path.join(dir,'assets/release-manifest.json'),JSON.stringify({retained_revisions:revisions}));
  for(const revision of revisions){
   fs.mkdirSync(path.join(dir,'assets/releases',revision),{recursive:true});
   fs.writeFileSync(path.join(dir,'assets/releases',revision,'app.js'),`// ${revision}`);
  }
  const source=`dir=ARGV.fetch(0); stash=ARGV.fetch(1); previous=AssetRelease.previous_revisions(dir); AssetRelease.stash_previous_releases(dir,stash,previous); FileUtils.rm_rf(File.join(dir,'assets','releases')); FileUtils.mkdir_p(File.join(dir,'assets','releases')); AssetRelease.restore_previous_releases(dir,stash,previous)`;
  const result=spawnSync(ruby,['-r',path.join(root,'lib/asset_release.rb'),'-e',source,dir,stash],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.ok(fs.existsSync(path.join(dir,'assets/releases',revisions[0],'app.js')));
  assert.ok(fs.existsSync(path.join(dir,'assets/releases',revisions[1],'app.js')));
  assert.ok(fs.existsSync(path.join(dir,'assets/releases',revisions[2],'app.js')),'keep all three until the next revision is known');
 } finally {
  fs.rmSync(dir,{recursive:true,force:true});
  fs.rmSync(stash,{recursive:true,force:true});
 }
});

test('unchanged clean rebuilds retain two previous revisions and a fourth release prunes only the oldest',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'k365-stable-retain-'));
 const stash=fs.mkdtempSync(path.join(os.tmpdir(),'k365-stable-stash-'));
 try {
  fs.mkdirSync(path.join(dir,'assets'),{recursive:true});
  const run=(version,clean=false)=>{
   const source=`dir,stash,version,clean=ARGV; previous=AssetRelease.previous_revisions(dir); if clean=='yes'; AssetRelease.stash_previous_releases(dir,stash,previous); FileUtils.rm_rf(File.join(dir,'assets','releases')); previous=AssetRelease.restore_previous_releases(dir,stash,previous); end; File.write(File.join(dir,'assets','app.js'),version); puts AssetRelease.publish(dir,previous:previous).to_json`;
   const result=spawnSync(ruby,['-r',path.join(root,'lib/asset_release.rb'),'-e',source,dir,stash,version,clean?'yes':'no'],{encoding:'utf8'});
   assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
  };
  const first=run('first'),second=run('second'),third=run('third');
  const expected=[third.revision,second.revision,first.revision];
  for(let n=0;n<3;n++)assert.deepEqual(run('third',true).retained_revisions,expected);
  const fourth=run('fourth',true);
  assert.deepEqual(fourth.retained_revisions,[fourth.revision,third.revision,second.revision]);
  assert.equal(fs.existsSync(path.join(dir,'assets/releases',first.revision)),false);
 } finally {fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(stash,{recursive:true,force:true});}
});

test('nested editor configuration and TrueType fonts share the release graph without fingerprinting its own manifest',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'k365-editor-cache-'));
 try{
  fs.mkdirSync(path.join(dir,'assets/calendar-editor'),{recursive:true});fs.mkdirSync(path.join(dir,'assets/fonts'),{recursive:true});
  const original='fetch("/assets/calendar-editor/data.json");fetch("/assets/fonts/Inter-Regular.ttf");';
  fs.writeFileSync(path.join(dir,'assets/calendar-editor/editor.js'),original);fs.writeFileSync(path.join(dir,'assets/calendar-editor/data.json'),' {"source":"first"}');fs.writeFileSync(path.join(dir,'assets/fonts/Inter-Regular.ttf'),Buffer.from('synthetic font bytes used only for cache hashing'));
  const run=()=>{const r=spawnSync(ruby,['-r',path.join(root,'lib/asset_release.rb'),'-e','dir=ARGV.fetch(0); puts AssetRelease.publish(dir,previous:AssetRelease.previous_revisions(dir)).to_json',dir],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
  const first=run();for(const key of ['/assets/calendar-editor/data.json','/assets/fonts/Inter-Regular.ttf'])assert.ok(first.assets[key],key);
  assert.equal(first.assets['/assets/release-manifest.json'],undefined);
  const module=fs.readFileSync(path.join(dir,first.assets['/assets/calendar-editor/editor.js'].url),'utf8');assert.ok(module.includes(first.assets['/assets/calendar-editor/data.json'].url));assert.ok(module.includes(first.assets['/assets/fonts/Inter-Regular.ttf'].url));
  fs.writeFileSync(path.join(dir,'assets/calendar-editor/editor.js'),original);assert.equal(run().revision,first.revision,'the generated manifest cannot change its own fingerprint');
  fs.writeFileSync(path.join(dir,'assets/calendar-editor/editor.js'),original);fs.writeFileSync(path.join(dir,'assets/calendar-editor/data.json'),' {"source":"updated"}');assert.notEqual(run().revision,first.revision,'nested configuration changes invalidate its dependent release');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('each current root and fingerprinted application asset matches exactly one cache lifetime rule',()=>{
 const publicDir=path.join(root,'public'),manifest=JSON.parse(fs.readFileSync(path.join(publicDir,'assets/release-manifest.json')));const rules=[];let current;
 for(const line of fs.readFileSync(path.join(publicDir,'_headers'),'utf8').split('\n')){
  if(line.startsWith('/')){current={pattern:line,policies:[]};rules.push(current);}else if(line.trim().startsWith('Cache-Control:'))current.policies.push(line.trim());
 }
 const compile=pattern=>new RegExp('^'+pattern.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/:[a-zA-Z][\w-]*/g,'[^/]+')+'$');
 const policies=rules.filter(r=>r.policies.length).map(r=>({...r,regex:compile(r.pattern)}));
 const urls=[...Object.keys(manifest.assets),...Object.values(manifest.assets).map(a=>a.url),'/', '/2028/vasaris/','/menulio-kalendorius/2028/vasaris/','/404.html','/assets/release-manifest.json','/sitemap.xml'];
 for(const url of urls){const matches=policies.filter(r=>r.regex.test(url)).flatMap(r=>r.policies);assert.equal(matches.length,1,url+' matched '+JSON.stringify(matches));}
});
