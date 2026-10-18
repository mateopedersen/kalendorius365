import { findSign, filterSigns, comparison, wheelIndex } from './zodiac-engine.js?v=ceb08079403f';

const root = document.querySelector('.zodiac-guide');
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (className) el.className = className;
  return el;
};
const signLink = (sign, text) => {
  const link = node('a', text || `${sign.genitive} dienos horoskopas →`);
  link.href = sign.url;
  return link;
};

async function initialize() {
  const response = await fetch(root.dataset.zodiacSource, { credentials: 'same-origin' });
  if (!response.ok) throw new Error('Ženklų lentelės nepavyko įkelti. Datos ir nuorodos pateiktos žemiau.');
  const { signs } = await response.json();
  if (!Array.isArray(signs) || signs.length !== 12 || new Set(signs.map(sign => sign.key)).size !== 12 || signs.some(sign =>
    !/^[a-z]+$/.test(sign.key) || !/^\/horoskopai\/[a-z]+\/$/.test(sign.url) || !/^\/assets\/visuals\/zodiac\/[a-z]+\.svg$/.test(sign.art))) {
    throw new Error('Ženklų lentelė neatpažinta. Naudokitės žemiau pateiktu datų sąrašu.');
  }
  const wheelButtons = [...root.querySelectorAll('[data-wheel-sign]')];
  let selected = 0;
  function selectSign(index, focus = false, announce = true) {
    const sign = signs[index];
    selected = index;
    for (const [i, button] of wheelButtons.entries()) {
      button.setAttribute('aria-pressed', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
    }
    const image = root.querySelector('.z-wheel__image');
    image.src = sign.art;
    image.alt = sign.art_alt;
    root.querySelector('#z-wheel-name').textContent = sign.name;
    root.querySelector('#z-wheel-element').textContent = sign.element;
    root.querySelector('#z-wheel-range').textContent = sign.range;
    root.querySelector('#z-wheel-focus').textContent = sign.focus;
    const link = root.querySelector('#z-wheel-link');
    link.href = sign.url;
    link.textContent = `${sign.genitive} dienos horoskopas →`;
    if (announce) root.querySelector('#z-wheel-status').textContent = `${sign.name}. ${sign.element}. ${sign.range}`;
    if (focus) wheelButtons[index].focus({ preventScroll: true });
  }
  wheelButtons.forEach((button, index) => {
    button.disabled = false;
    button.addEventListener('click', () => selectSign(index));
    button.addEventListener('keydown', event => {
      const next = wheelIndex(selected, event.key);
      if (next !== null) { event.preventDefault(); selectSign(next, true); }
    });
  });

  const form = root.querySelector('#z-finder');
  const finderResult = root.querySelector('#z-finder-result');
  form.querySelector('fieldset').disabled = false;
  form.noValidate = true;
  form.addEventListener('input', () => {
    finderResult.hidden = true;
    for (const control of form.querySelectorAll('input, select')) control.removeAttribute('aria-invalid');
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    finderResult.replaceChildren();
    finderResult.hidden = false;
    finderResult.classList.remove('z-finder-result--error');
    try {
      const result = findSign(Number(form.elements.month.value), Number(form.elements.day.value), signs);
      const sign = result.sign;
      const image = node('img'); image.src = sign.art; image.alt = sign.art_alt; image.width = image.height = 96;
      const copy = node('div');
      copy.append(node('p', 'Pagal įprastą datų lentelę', 'z-eyebrow'), node('strong', sign.name, 'z-result-name'),
        node('p', `${sign.element_name} · ${sign.range}`, 'z-range'));
      if (result.nearBoundary) {
        copy.append(node('p', 'Ši data yra netoli ženklų ribos. Tikslus Saulės ženklas priklauso nuo gimimo metų, laiko ir laiko juostos. Šis įrankis tikslios Saulės padėties neskaičiuoja.', 'z-boundary-note'));
        const alternatives = node('p', 'Ribos ženklai: ', 'z-inline-links');
        result.alternatives.forEach((other, index) => { if (index) alternatives.append(document.createTextNode(' · ')); alternatives.append(signLink(other, other.name)); });
        copy.append(alternatives);
      } else {
        copy.append(node('p', 'Tai orientacinis Saulės ženklas pagal pasirinktą datų sistemą, o ne ascendentas ar gimimo horoskopas.', 'z-small'));
      }
      copy.append(signLink(sign));
      finderResult.append(image, copy);
      selectSign(signs.findIndex(item => item.key === sign.key), false, false);
    } catch (error) {
      finderResult.classList.add('z-finder-result--error');
      finderResult.textContent = error.message;
      for (const control of form.querySelectorAll('input, select')) control.setAttribute('aria-invalid', 'true');
    }
  });

  for (const button of root.querySelectorAll('[data-element-filter]')) {
    button.disabled = false;
    button.addEventListener('click', () => {
      const filtered = new Set(filterSigns(signs, button.dataset.elementFilter).map(sign => sign.key));
      for (const card of root.querySelectorAll('[data-sign-card]')) card.hidden = !filtered.has(card.dataset.signCard);
      for (const other of root.querySelectorAll('[data-element-filter]')) other.setAttribute('aria-pressed', String(other === button));
      root.querySelector('#z-filter-status').textContent = filtered.size === 12 ? 'Rodomi visi 12 ženklų.' : `${button.textContent}: rodomi ${filtered.size} iš 12 ženklų. Pasirinkite „Visi ženklai“, kad atkurtumėte sąrašą.`;
    });
  }
  const first = root.querySelector('#z-compare-first');
  const second = root.querySelector('#z-compare-second');
  const reset = root.querySelector('#z-compare-reset');
  function fillCompareCard(id, sign) {
    const card = root.querySelector(id);
    const image = card.querySelector('img'); image.src = sign.art; image.alt = sign.art_alt;
    for (const [field, text] of Object.entries({ name: sign.name, range: sign.range, element: sign.element_name, symbol: sign.symbol_label, summary: sign.summary })) card.querySelector(`[data-compare-${field}]`).textContent = text;
    const link = card.querySelector('[data-compare-link]'); link.href = sign.url; link.textContent = `${sign.genitive} dienos horoskopas →`;
  }
  function updateComparison() {
    const result = comparison(signs, first.value, second.value);
    fillCompareCard('#z-compare-a', result.first);
    fillCompareCard('#z-compare-b', result.second);
    root.querySelector('#z-compare-status').textContent = result.sameSign ? `${result.first.name}: pasirinktas tas pats ženklas abiejose pusėse.` :
      `${result.first.name} ir ${result.second.name}: ${result.sameElement ? 'ta pati tradicinė stichija' : 'skirtingos tradicinės stichijos'}. Tai simbolių palyginimas, ne santykių prognozė.`;
  }
  for (const control of [first, second, reset]) control.disabled = false;
  first.addEventListener('change', updateComparison);
  second.addEventListener('change', updateComparison);
  reset.addEventListener('click', () => { first.value = 'avinas'; second.value = 'svarstykles'; updateComparison(); });
  selectSign(0, false, false);
  root.dataset.ready = 'true';
}
if (root) initialize().catch(error => {
  root.dataset.ready = 'error';
  root.querySelector('#z-filter-status').textContent = error.message;
});
