import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = (await readFile(new URL('../site/assets/lunar/lunar-loader.js', import.meta.url), 'utf8'))
  .replace('import("./lunar.js")', 'globalThis.__lunarImport()');

class FakeElement {
  constructor(kind = '') {
    this.kind = kind;
    this.dispatched = [];
  }

  closest(selector) {
    return this.kind === 'day' && selector.includes('[data-lunar-date]') ? this : null;
  }

  matches(selector) {
    return this.kind === 'date' && selector === '[data-selected-date]';
  }

  dispatchEvent(event) {
    this.dispatched.push(event);
    return true;
  }
}

class FakeEvent {
  constructor(type, options = {}) {
    this.type = type;
    Object.assign(this, options);
  }
}

function makeHarness({ importModule = () => Promise.resolve(), withObserver = true } = {}) {
  const listeners = {};
  const scope = {
    addEventListener(type, listener) { listeners[type] = listener; },
    querySelectorAll() { return [new FakeElement('visible')]; },
    querySelector() { return { textContent: '' }; },
  };
  let observerCallback;
  class FakeObserver {
    constructor(callback) { observerCallback = callback; this.disconnected = false; }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  const window = {};
  if (withObserver) window.IntersectionObserver = FakeObserver;
  else window.setTimeout = (callback) => { window.fallback = callback; };
  const context = {
    document: { querySelector: () => scope },
    window,
    Element: FakeElement,
    IntersectionObserver: FakeObserver,
    MouseEvent: FakeEvent,
    KeyboardEvent: FakeEvent,
    Event: FakeEvent,
    Promise,
    globalThis: null,
    __lunarImport: importModule,
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'lunar-loader.js' });
  return { listeners, observerCallback, window };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('keeps the astronomy module unloaded until the live tool enters view', async () => {
  let imports = 0;
  const harness = makeHarness({ importModule: () => { imports += 1; return Promise.resolve(); } });
  assert.equal(imports, 0);
  harness.observerCallback([{ isIntersecting: false }]);
  assert.equal(imports, 0);
  harness.observerCallback([{ isIntersecting: true }]);
  await flush();
  assert.equal(imports, 1);
});

test('loads before an early calendar click and replays the click once', async () => {
  let imports = 0;
  const harness = makeHarness({ importModule: () => { imports += 1; return Promise.resolve(); } });
  const target = new FakeElement('day');
  let prevented = false;
  let stopped = false;
  harness.listeners.click({
    target,
    preventDefault() { prevented = true; },
    stopImmediatePropagation() { stopped = true; },
  });
  await flush();
  assert.equal(imports, 1);
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.equal(target.dispatched.length, 1);
  assert.equal(target.dispatched[0].type, 'click');
});

test('replays keyboard and date changes after the module loads', async () => {
  let imports = 0;
  const harness = makeHarness({ importModule: () => { imports += 1; return Promise.resolve(); } });
  const day = new FakeElement('day');
  harness.listeners.keydown({
    key: 'ArrowRight', target: day,
    preventDefault() {}, stopImmediatePropagation() {},
  });
  await flush();
  assert.equal(day.dispatched[0]?.type, 'keydown');
  assert.equal(day.dispatched[0]?.key, 'ArrowRight');

  const dateHarness = makeHarness({ importModule: () => { imports += 1; return Promise.resolve(); } });
  const date = new FakeElement('date');
  dateHarness.listeners.change({ target: date, stopImmediatePropagation() {} });
  await flush();
  assert.equal(imports, 2);
  assert.equal(date.dispatched[0]?.type, 'change');
});

test('uses a delayed fallback when IntersectionObserver is unavailable', () => {
  let imports = 0;
  const harness = makeHarness({ importModule: () => { imports += 1; return Promise.resolve(); }, withObserver: false });
  assert.equal(imports, 0);
  assert.equal(typeof harness.window.fallback, 'function');
});
