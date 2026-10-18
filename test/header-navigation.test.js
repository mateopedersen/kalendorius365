import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

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
  const listeners = new Map();
  const element = () => ({
    attrs: new Map(), handlers: new Map(),
    classList: {toggle() {}, remove() {}},
    setAttribute(key, value) { this.attrs.set(key, value); },
    getAttribute(key) { return this.attrs.get(key); },
    removeAttribute(key) { this.attrs.delete(key); },
    addEventListener(key, fn) { this.handlers.set(key, fn); },
    click() { this.handlers.get('click')?.({currentTarget:this}); },
    append() {}, focus() {}, blur() {}, querySelector() { return null; },
  });
  const elements = new Map(['#site-search', '#site-search-results', '.header-search', '#site-search-status', '#nav-toggle', '#primary-nav'].map(key => [key, element()]));
  const document = {
    querySelector: selector => elements.get(selector) || null,
    querySelectorAll: () => [], createElement: element,
    addEventListener(key, fn) { listeners.set(key, fn); },
    documentElement: element(),
  };
  vm.runInNewContext(read('site/assets/common.js').replace('export function notice', 'function notice'), {
    document, location:{pathname:'/'}, localStorage:{getItem:()=>null},
    clearTimeout, setTimeout,
  });
  const toggle = elements.get('#nav-toggle');
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.doesNotThrow(() => listeners.get('keydown')({key:'Escape'}));
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(elements.get('#site-search').getAttribute('aria-expanded'), 'false');
  assert.equal(elements.get('#site-search-results').getAttribute('hidden'), '');
});
