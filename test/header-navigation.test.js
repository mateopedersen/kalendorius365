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

const primary = ['/metai/', '/sventes/', '/mokiniu-atostogos/', '/horoskopai/'];
const tools = [...read('site/_data/tool_directory.yml').matchAll(/^\s+- route: (\/[^\s]+)$/gm)].map(match => match[1]);
const routesIn = html => [...html.matchAll(/<a href="([^"]+)"/g)].map(match => match[1]);
const toolLinks = html => [...html.matchAll(/<a href="([^"]+)" data-menu-tool[^>]*>([\s\S]*?)<\/a>/g)];

test('the two-level shared header and tool menu expose their full inventories on inner pages', () => {
  const html = read('public/irankiai/index.html');
  assert.deepEqual(routesIn(nav(html)), primary);
  const calendarBar = html.match(/<nav class="calendar-bar"[\s\S]*?<\/nav>/)?.[0];
  assert.deepEqual(routesIn(calendarBar), ['/2027/', '/2028/', '/2029/', '/2030/', '/pdf-kalendoriai/', '/darbo-dienos/2027/', '/datos-skaiciuokle/']);
  assert.ok(calendarBar.includes('id="tools-open"'));
  const links = toolLinks(html);
  assert.deepEqual(links.map(link => link[1]), tools);
  assert.equal(new Set(tools).size, tools.length);
  for (const [, route, content] of links) {
    const illustration = content.match(/src="(\/assets\/visuals\/shell\/[^"?]+)(?:\?[^"]*)?" alt=""/);
    assert.ok(illustration, route);
    assert.ok(fs.existsSync(path.join(root, 'public', illustration[1])));
    assert.ok(fs.existsSync(path.join(root, 'public', route, 'index.html')));
  }
});

test('the homepage links to every tool once across shortcuts and the menu', () => {
  const html = read('public/index.html');
  const hrefs = [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(routesIn(nav(html)), primary);
  for (const route of tools) assert.equal(hrefs.filter(href => href === route).length, 1, route);
  const links = hrefs.map(href => new URL(href.replaceAll('&amp;', '&'), 'https://kalendorius365.lt/').href);
  assert.equal(new Set(links).size, links.length);
});

test('calendar years, holiday details and horoscope details highlight their destinations', () => {
  for (const [route, expected] of [
    ['/2030/vasaris/', '/metai/'], ['/sventes/konstitucijos-diena/', '/sventes/'],
    ['/horoskopai/', '/horoskopai/'], ['/mokiniu-atostogos/', '/mokiniu-atostogos/'],
  ]) {
    const html = read(`public${route}index.html`);
    const current = [...nav(html).matchAll(/<a href="([^"]+)" aria-current="page"/g)];
    assert.deepEqual(current.map(match => match[1]), [expected], route);
  }
});

test('every generated public page inherits the shared navigation and tools dialog', () => {
  let count = 0;
  for (const file of fs.readdirSync(path.join(root, 'public'), {recursive: true})) {
    if (!file.endsWith('.html')) continue;
    const html = read(`public/${file}`);
    assert.deepEqual(routesIn(nav(html)), primary, file);
    if (file !== 'index.html') assert.deepEqual(toolLinks(html).map(link => link[1]), tools, file);
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
