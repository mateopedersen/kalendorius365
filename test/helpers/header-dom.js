import fs from 'node:fs';
import vm from 'node:vm';

export function headerHarness({mobile = true, serverRendered = false, loadIndex = async () => [], search = null} = {}) {
  const timers = new Map(); let nextTimer = 0; let imports = 0;
  const flush = async () => { const pending = [...timers.values()]; timers.clear(); await Promise.all(pending.map(fn => fn())); };
  const events = target => {
    target.handlers = new Map();
    target.addEventListener = (name, handler) => {
      const handlers = target.handlers.get(name) || [];
      handlers.push(handler);
      target.handlers.set(name, handlers);
    };
    target.emit = (name, detail = {}) => {
      const event = {target, currentTarget: target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...detail};
      target.lastEvent = event;
      return Promise.all((target.handlers.get(name) || []).map(handler => handler(event)));
    };
    return target;
  };
  let document;
  const element = (tag = 'div') => {
    const node = events({tag, tagName: tag.toUpperCase(), attrs: new Map(), children: [], value: '', dataset: {}, textContent: ''});
    let classes = new Set();
    Object.defineProperty(node, 'className', {
      get: () => [...classes].join(' '),
      set: value => { classes = new Set(value.split(/\s+/).filter(Boolean)); },
    });
    node.classList = {
      add: (...values) => values.forEach(value => classes.add(value)),
      remove: (...values) => values.forEach(value => classes.delete(value)),
      contains: value => classes.has(value),
      toggle(value, force = !classes.has(value)) {
        if (force) classes.add(value); else classes.delete(value);
        return force;
      },
    };
    node.style = new Map();
    node.style.setProperty = (key, value) => node.style.set(key, value);
    node.setAttribute = (key, value) => node.attrs.set(key, value);
    node.getAttribute = key => node.attrs.get(key) ?? null;
    node.hasAttribute = key => node.attrs.has(key);
    node.removeAttribute = key => node.attrs.delete(key);
    Object.defineProperty(node, 'hidden', {
      get: () => node.attrs.has('hidden'),
      set: value => { if (value) node.attrs.set('hidden', ''); else node.attrs.delete('hidden'); },
    });
    Object.defineProperty(node, 'childElementCount', {get: () => node.children.length});
    node.contains = other => other === node || node.children.some(child => child.contains(other));
    node.append = (...children) => {
      for (const child of children) {
        if (child.parent) child.parent.children = child.parent.children.filter(item => item !== child);
        child.parent = node;
        node.children.push(child);
      }
    };
    node.prepend = child => { node.append(child); node.children.unshift(node.children.pop()); };
    node.before = other => {
      const parent = node.parent;
      parent.append(other);
      parent.children.pop();
      parent.children.splice(parent.children.indexOf(node), 0, other);
    };
    node.replaceChildren = (...children) => { node.children.forEach(child => { child.parent = null; }); node.children = []; node.append(...children); };
    const matches = selector => selector.split(',').some(value => {
      value = value.trim();
      if (value.startsWith('.')) return classes.has(value.slice(1));
      if (value === '[type="submit"]') return node.type === 'submit';
      if (value === '[role="option"]') return node.getAttribute('role') === 'option';
      if (value === 'a[href]') return tag === 'a' && Boolean(node.href);
      return false;
    });
    node.closest = selector => matches(selector) ? node : node.parent?.closest(selector) || null;
    node.querySelectorAll = selector => node.children.flatMap(child => [
      ...(child.closest(selector) === child ? [child] : []), ...child.querySelectorAll(selector),
    ]);
    node.querySelector = selector => node.querySelectorAll(selector)[0] || null;
    node.getBoundingClientRect = () => ({top: 70, bottom: 132, height: 62});
    node.focus = () => {
      const old = document.activeElement;
      document.activeElement = node;
      old?.emit('focusout', {relatedTarget: node});
      if (old !== node) node.emit('focus');
    };
    node.blur = () => { document.activeElement = document.body; node.emit('focusout', {relatedTarget: null}); };
    node.click = () => { node.clicked = true; return node.emit('click'); };
    node.scrollIntoView = () => {};
    return node;
  };
  const selectors = new Map(['#site-search', '#site-search-results', '.header-search', '#site-search-status', '#nav-toggle', '#primary-nav'].map(key => [key, element()]));
  const input = selectors.get('#site-search');
  const results = selectors.get('#site-search-results');
  const form = selectors.get('.header-search'); form.className = 'header-search';
  const header = element(); header.className = 'site-header';
  const submit = element('button'); submit.type = 'submit'; submit.className = 'visually-hidden';
  const icon = element('svg'); icon.className = 'icon'; icon.outerHTML = '<svg class="icon"></svg>';
  const nav = selectors.get('#primary-nav');
  const navLink = element('a'); navLink.href = '/'; nav.append(navLink);
  form.append(icon, input, submit, results);
  header.append(selectors.get('#nav-toggle'), nav, form);
  if (serverRendered) {
    const toggle = element('a'); toggle.className = 'header-search-toggle icon-button'; toggle.href = '/paieska/'; toggle.setAttribute('role', 'button');
    form.before(toggle); selectors.set('.header-search-toggle', toggle); header.classList.add('search-ready');
  }
  document = events({
    body: element(), documentElement: element(),
    querySelector: selector => selectors.get(selector) || null,
    querySelectorAll: () => [], createElement: element,
  });
  document.activeElement = document.body;
  const media = events({matches: mobile});
  const viewport = events({height: 844, offsetTop: 0});
  const window = events({innerHeight: 844, visualViewport: viewport, matchMedia: () => media});
  const matches = Array.from({length: 10}, (_, index) => ({url: `/page-${index}/`, title: `Page ${index}`, description: 'A description'}));
  const engine = {loadSearchIndex: loadIndex, normalizeSearchText: text => text.toLowerCase(), searchPages: search || (() => matches)};
  const code = fs.readFileSync(new URL('../../site/assets/common.js', import.meta.url), 'utf8')
    .replace('export function notice', 'function notice')
    .replace('import("./search-engine.js")', 'testLoadEngine()');
  vm.runInNewContext(code, {
    document, window, location: {pathname: '/'}, localStorage: {getItem: () => null},
    clearTimeout: id => timers.delete(id), setTimeout: fn => { timers.set(++nextTimer,fn); return nextTimer; },
    testLoadEngine: async () => { imports++; return engine; },
  });
  return {
    document, form, input, results, submit, header, nav, viewport, media, flush, imports: () => imports,
    navToggle: selectors.get('#nav-toggle'),
    toggle: header.querySelector('.header-search-toggle'),
    close: header.querySelector('.header-search-close'),
    panel: form.querySelector('.header-search-panel'),
    all: form.querySelector('.header-search-all'),
  };
}
