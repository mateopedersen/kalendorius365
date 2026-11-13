import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {dateFromSearch} from '../site/assets/calendar.js';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('download canonicals preserve PDF discovery and immutable caching within Pages limits', () => {
  const headers = read('public/_headers');
  assert.match(headers, /\/downloads\/\*\n  Cache-Control: public, max-age=31536000, immutable\n  Link: <https:\/\/kalendorius365\.lt\/downloads\/:splat>; rel="canonical"/);
  assert.ok(headers.split('\n').filter(line => line.startsWith('/')).length <= 100);
  assert.doesNotMatch(headers.split('/downloads/*\n')[1].split('\n/')[0], /noindex/);
});

test('retired dataset links recover narrowly and historical months retain their actual dates', () => {
  const redirects = read('public/_redirects').trim().split('\n');
  const recovered = redirects.filter(line => line.startsWith('/assets/releases/'));
  assert.equal(recovered.length, 11);
  for (const rule of recovered) assert.match(rule, /^\/assets\/releases\/[0-9a-f]{20}\/data\/namedays\/cc-by-sa-4\.0\.json \/assets\/data\/namedays\/cc-by-sa-4\.0\.json 301$/);
  assert.equal(new Set(redirects.map(rule => rule.split(' ')[0])).size, redirects.length);
  for (const [month, date] of [['spalis','2026-10-01'], ['lapkritis','2026-11-01']]) {
    assert.ok(redirects.includes(`/2026/${month}/ /?data=${date} 301`));
    assert.equal(dateFromSearch(`?data=${date}`), date);
  }
  assert.ok(!redirects.some(rule => rule.startsWith('/cdn-cgi/')));
});

test('HTML dataset download remains durable while runtime JSON retains its immutable revision', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'k365-dataset-'));
  try {
    fs.mkdirSync(path.join(dir, 'assets/data/namedays'), {recursive:true});
    fs.writeFileSync(path.join(dir, 'assets/data/namedays/cc-by-sa-4.0.json'), '{"records":[]}');
    fs.writeFileSync(path.join(dir, 'assets/app.js'), 'fetch("/assets/data/namedays/cc-by-sa-4.0.json");');
    fs.writeFileSync(path.join(dir, 'index.html'), '<a download href="/assets/data/namedays/cc-by-sa-4.0.json">JSON</a><script src="/assets/app.js"></script>');
    const manifest = JSON.parse(execFileSync(process.env.K365_RUBY || 'ruby', ['-r',path.join(root,'lib/asset_release.rb'),'-e','puts AssetRelease.publish(ARGV.fetch(0)).to_json',dir], {encoding:'utf8'}));
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.match(html, /download href="\/assets\/data\/namedays\/cc-by-sa-4\.0\.json"/);
    const script = fs.readFileSync(path.join(dir, manifest.assets['/assets/app.js'].url), 'utf8');
    assert.ok(script.includes(manifest.assets['/assets/data/namedays/cc-by-sa-4.0.json'].url));
  } finally {fs.rmSync(dir, {recursive:true, force:true});}
});
