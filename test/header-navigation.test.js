import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {headerHarness} from './helpers/header-dom.js';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const nav = html => html.match(/<nav id="primary-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
const added = [
  ['/menulio-kalendorius/', 'Mėnulio kalendorius', 'moon-calendar'],
  ['/metu-laikai/', 'Metų laikai', 'seasons'],
  ['/datos-skaiciuokle/', 'Datos skaičiuoklė', 'date-calculator'],
];

test('the shared header exposes fourteen unique destinations with named decorative SVGs', () => {
  const menu = nav(read('public/index.html'));
  const links = [...menu.matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.equal(links.length, 14);
  assert.equal(new Set(links.map(link => link[1])).size, 14);
  for (const [route, label, symbol] of added) {
    const link = links.find(link => link[1] === route);
    assert.ok(link, route);
    assert.ok(link[2].includes(`<span>${label}</span>`));
    const sprite = link[2].match(/href="(\/assets\/visuals\/navigation-extras\.svg\?v=([a-f0-9]{12})#[^"]+)"/);
    assert.ok(sprite, 'navigation sprite uses a content version');
    assert.ok(sprite[1].endsWith(`#${symbol}`));
    assert.ok(link[2].includes('aria-hidden="true" focusable="false"'));
    assert.ok(fs.existsSync(path.join(root, 'public', route, 'index.html')));
  }
});

test('new destinations and their child pages mark the correct navigation card', () => {
  for (const [route] of added.concat([
    ['/menulio-kalendorius/2028/vasaris/'], ['/pavasario-lygiadienis/'],
  ])) {
    const menu = nav(read(`public${route}index.html`));
    const current = [...menu.matchAll(/<a href="([^"]+)" aria-current="page"/g)];
    assert.equal(current.length, 1, route);
    assert.equal(current[0][1], route.startsWith('/menulio-kalendorius/') ? '/menulio-kalendorius/' : route === '/pavasario-lygiadienis/' ? '/metu-laikai/' : route);
  }
});

test('every generated public page inherits the same complete navigation', () => {
  let count = 0;
  for (const file of fs.readdirSync(path.join(root, 'public'), {recursive: true})) {
    if (!file.endsWith('.html')) continue;
    const menu = nav(read(`public/${file}`));
    assert.ok(menu, file);
    assert.equal([...menu.matchAll(/<a href=/g)].length, 14, file);
    count++;
  }
  assert.ok(count >= 185);
});

test('the original vector sprite has three distinct symbols and no embedded raster or script', () => {
  const svg = read('site/assets/visuals/navigation-extras.svg');
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const [, , symbol] of added) assert.ok(ids.includes(symbol));
  for (const [, id] of svg.matchAll(/url\(#([^)]*)\)/g)) assert.ok(ids.includes(id));
  assert.doesNotMatch(svg, /<(?:image|script|foreignObject)\b|https?:\/\/(?!www\.w3\.org)/);
  assert.ok(Buffer.byteLength(svg) < 8000);
  assert.equal(svg, read('public/assets/visuals/navigation-extras.svg'));
});

test('Escape closes the navigation and search through the shared script', () => {
  const h = headerHarness();
  const toggle = h.navToggle;
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.doesNotThrow(() => h.document.emit('keydown', {key:'Escape'}));
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(h.input.getAttribute('aria-expanded'), 'false');
  assert.equal(h.results.getAttribute('hidden'), '');
});
