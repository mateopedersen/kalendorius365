import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const site = join(root, 'site');
const publicDir = join(root, 'public');
const iconHref = '/favicon-96x96.png';

function pngSize(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'valid PNG signature');
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR', 'PNG dimensions are in the IHDR chunk');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

function htmlFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? htmlFiles(path) : path.endsWith('.html') ? [path] : [];
  });
}

test('Google-supported square PNG favicon is linked consistently across every generated page', () => {
  const layout = readFileSync(join(site, '_layouts/default.html'), 'utf8');
  assert.match(layout, /<link rel="icon" href="\/favicon-96x96\.png" type="image\/png" sizes="96x96">/);
  assert.doesNotMatch(layout, /<link rel="icon"[^>]+image\/svg\+xml/);

  const favicon = readFileSync(join(site, 'favicon-96x96.png'));
  assert.deepEqual(pngSize(favicon), [96, 96]);

  const generatedPages = htmlFiles(publicDir);
  assert.ok(generatedPages.length > 100, 'the release contains all site routes');
  for (const page of generatedPages) {
    const html = readFileSync(page, 'utf8');
    assert.ok(html.includes(`href="${iconHref}" type="image/png" sizes="96x96"`), `${page} exposes the same favicon`);
  }
});

test('root ICO fallback is valid, square, multi-size, and copied unchanged to the release', () => {
  const ico = readFileSync(join(site, 'favicon.ico'));
  assert.equal(ico.readUInt16LE(0), 0, 'reserved ICO header');
  assert.equal(ico.readUInt16LE(2), 1, 'ICO image type');
  const count = ico.readUInt16LE(4);
  assert.equal(count, 4);

  const sizes = [];
  for (let i = 0; i < count; i++) {
    const entry = 6 + i * 16;
    const size = ico[entry] || 256;
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    const image = ico.subarray(offset, offset + length);
    assert.deepEqual(pngSize(image), [size, size]);
    sizes.push(size);
  }
  assert.deepEqual(sizes, [16, 32, 48, 96]);
  assert.deepEqual(readFileSync(join(publicDir, 'favicon.ico')), ico);
  assert.deepEqual(readFileSync(join(publicDir, 'favicon-96x96.png')), readFileSync(join(site, 'favicon-96x96.png')));
});
