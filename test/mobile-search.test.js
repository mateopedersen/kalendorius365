import test from 'node:test';
import assert from 'node:assert/strict';
import {headerHarness} from './helpers/header-dom.js';
import {loadSearchIndex} from '../site/assets/search-engine.js';

test('mobile search has an explicit opener, closer, and native submit button', async () => {
  const h = headerHarness();
  await h.toggle.click();
  assert.equal(h.document.activeElement, h.input);
  assert.equal(h.toggle.getAttribute('aria-expanded'), 'true');
  assert.ok(h.form.classList.contains('search-open'));
  assert.ok(h.document.documentElement.classList.contains('search-active'));
  assert.equal(h.submit.className, 'header-search-submit');
  h.input.value = 'Velykos';
  await h.input.emit('input');
  assert.equal(h.panel.hidden, false);
  assert.equal(h.results.children.length, 4);
  assert.equal(h.all.parent, h.panel, 'the all-results link stays outside the scrolling listbox');
  assert.equal(h.all.href, '/paieska/?q=Velykos');
  await h.close.click();
  assert.equal(h.panel.hidden, true);
  assert.equal(h.document.activeElement, h.toggle);
  assert.equal(h.document.documentElement.classList.contains('search-active'), false);
  assert.equal(h.input.value, 'Velykos', 'closing preserves the query');
});

test('navigation and search cannot cover each other; leaving search closes it', async () => {
  const h = headerHarness();
  await h.navToggle.click();
  assert.equal(h.navToggle.getAttribute('aria-expanded'), 'true');
  await h.toggle.click();
  assert.equal(h.navToggle.getAttribute('aria-expanded'), 'false');
  assert.equal(h.nav.classList.contains('nav-open'), false);
  await h.navToggle.click();
  assert.equal(h.form.classList.contains('search-open'), false);
  await h.toggle.click();
  await h.form.emit('focusout', {relatedTarget: null});
  assert.equal(h.form.classList.contains('search-open'), true, 'Safari blur must not swallow a result tap');
  await h.form.emit('focusout', {relatedTarget: h.document.body});
  assert.equal(h.form.classList.contains('search-open'), false);
});

test('suggestions fit the visual viewport when the phone keyboard opens', async () => {
  const h = headerHarness();
  await h.toggle.click();
  h.input.value = 'velykos';
  await h.input.emit('input');
  h.viewport.height = 360;
  await h.viewport.emit('resize');
  const height = Number.parseInt(h.form.style.get('--search-results-height'));
  assert.ok(height <= 360 * .45);
  assert.ok(height + 132 + 18 <= 360);
  assert.equal(h.panel.hidden, false);
  h.viewport.height = 210;
  await h.viewport.emit('resize');
  assert.equal(h.panel.hidden, true, 'hide suggestions if only the field and submit action fit');
  h.viewport.height = 640;
  await h.viewport.emit('resize');
  assert.equal(h.panel.hidden, false);
});

test('a delayed index response cannot reopen a closed search panel', async () => {
  let resolve;
  const h = headerHarness({loadIndex: () => new Promise(done => { resolve = done; })});
  await h.toggle.click();
  h.input.value = 'velykos';
  const pending = h.input.emit('input');
  await Promise.resolve();
  await h.close.click();
  resolve([]);
  await pending;
  assert.equal(h.panel.hidden, true);
  assert.equal(h.input.getAttribute('aria-expanded'), 'false');
});

test('keyboard selection, Escape, and form submission remain usable', async () => {
  const h = headerHarness({mobile: false});
  h.input.focus();
  h.input.value = 'velykos';
  await h.input.emit('input');
  assert.equal(h.results.children.length, 7);
  await h.input.emit('keydown', {key: 'ArrowDown', preventDefault() {}});
  assert.equal(h.input.getAttribute('aria-activedescendant'), 'site-search-option-0');
  await h.input.emit('keydown', {key: 'Enter', preventDefault() {}});
  assert.equal(h.results.children[0].clicked, true);
  await h.input.emit('keydown', {key: 'Escape', preventDefault() {}});
  assert.equal(h.document.activeElement, h.input);
  assert.equal(h.panel.hidden, true);
  h.input.value = 'kalendorius';
  await h.input.emit('input');
  assert.equal(h.panel.hidden, false, 'typing after Escape reopens desktop suggestions');
  await h.form.emit('submit');
  assert.equal(h.panel.hidden, true);
  assert.equal(h.input.value, 'kalendorius');
  await h.document.emit('keydown', {key: 'Escape'});
  assert.equal(h.results.hidden, true);
});

test('a temporary search-index failure can be retried', async () => {
  const original = global.fetch;
  let attempts = 0;
  global.fetch = async () => {
    if (++attempts === 1) throw new Error('Temporary network error');
    return {ok: true, json: async () => [{title: 'Velykos'}]};
  };
  try {
    await assert.rejects(loadSearchIndex(), /Temporary network error/);
    assert.deepEqual(await loadSearchIndex(), [{title: 'Velykos'}]);
    assert.equal(attempts, 2);
  } finally {
    global.fetch = original;
  }
});
