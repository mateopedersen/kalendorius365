import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const fingerprint = bytes => createHash('sha256').update(bytes).digest('hex');

test('contact illustration uses the shared scalable artwork and retains the copy control', () => {
 const source = read('site/kontaktai/index.html');
 const art = read('site/assets/visuals/shell/contact.svg');
 assert.match(source, /<figure class="contact-art">\s*<img src="\/assets\/visuals\/shell\/contact\.svg" width="320" height="260" alt="[^"]+"/);
 assert.match(source, /aria-label="Kopijuoti el. pašto adresą"/);
 assert.match(art, /<svg [^>]+viewBox="0 0 320 260"/);
 assert.doesNotMatch(art, /data:|<image\b|<script\b|<text\b/);
 assert.ok(Buffer.byteLength(art) < 9000);
 const proof = JSON.parse(read('docs/performance/contact-art-fonts.json'));
 assert.equal(fingerprint(read('docs/performance/contact-art-original.svg')), proof.original_svg_sha256);
});
