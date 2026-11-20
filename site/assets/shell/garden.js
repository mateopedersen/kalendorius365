import { formatDate, parse, today } from '../calendar.js';
import { exportICS } from '../ics.js';
import { normalizeToolSearchText } from '../tool-directory-core.js';

const PLAN_KEY = 'kalendorius365:garden-plan:v1';
const PREP_KEY = 'kalendorius365:garden-prep:v1';
const DATE_MIN = '1900-01-01';
const DATE_MAX = '2100-12-31';
const LIMIT = 200;

export function filterPeriods(periods, { month, stage, place }) {
  return periods.filter(period => (!month || period.months.includes(month)) &&
    (!stage || stage === period.stage) && (!place || place === period.place));
}

export function validatePlan(input, plants, tasks) {
  if (input?.version !== 1 || !Array.isArray(input.entries) || input.entries.length > LIMIT) {
    throw new Error('Netinkamas Kalendorius365 planas. Plane gali būti iki 200 darbų.');
  }
  const ids = new Set();
  return input.entries.map(entry => {
    if (!entry || typeof entry.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(entry.id) ||
      ids.has(entry.id) || !plants.has(entry.plant) || !tasks.has(entry.task) ||
      typeof entry.date !== 'string' || entry.date < DATE_MIN || entry.date > DATE_MAX ||
      typeof entry.note !== 'string' || entry.note.length > 180 || typeof entry.done !== 'boolean') {
      throw new Error('Faile yra netinkamas arba pasikartojantis daržo darbas.');
    }
    try {
      parse(entry.date);
    } catch {
      throw new Error('Faile yra netinkama darbo data.');
    }
    ids.add(entry.id);
    const { id, plant, task, date, note, done } = entry;
    return { id, plant, task, date, note, done };
  });
}

function connectFilters(root, form, resetForm) {
  const get = selector => root.querySelector(selector);
  const filters = ['search', 'month', 'stage', 'place'].map(key => get('[data-garden-' + key + ']'));
  const [search, month, stage, place] = filters;
  const climate = get('[data-garden-climate]');
  const count = get('[data-garden-count]');
  const table = get('.garden-table-scroll');
  // The expanded detail remains readable within a horizontally scrolling table.
  function fitDetails() {
    table.style.setProperty('--garden-table-width', table.clientWidth + 'px');
  }
  new ResizeObserver(fitDetails).observe(table);
  fitDetails();
  const rows = [...root.querySelectorAll('[data-garden-row]')].map(row => {
    const button = row.querySelector('[data-garden-details]');
    const detail = document.getElementById(button.getAttribute('aria-controls'));
    const title = normalizeToolSearchText(button.querySelector('img + span').textContent + ' ' + row.dataset.keywords);
    const markers = [...row.querySelectorAll('[data-periods]')].map(badge => ({
      badge,
      periods: badge.dataset.periods.split(' ').map(value => {
        const [stage, place] = value.split(':');
        return { stage, place, months: [Number(badge.closest('td').dataset.month)] };
      }),
    }));
    button.disabled = false;
    button.addEventListener('click', () => {
      detail.hidden = !detail.hidden;
      button.setAttribute('aria-expanded', String(!detail.hidden));
    });
    const pick = row.querySelector('[data-garden-pick]');
    pick.disabled = false;
    pick.addEventListener('click', () => {
      resetForm();
      form.elements.plant.value = pick.dataset.gardenPick;
      if (stage.value) form.elements.task.value = stage.value;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      form.closest('section').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
      form.elements.date.focus({ preventScroll: true });
    });
    return { row, button, detail, title, markers };
  });

  function update() {
    const terms = normalizeToolSearchText(search.value).split(/\s+/).filter(Boolean);
    const selected = { month: Number(month.value), stage: stage.value, place: place.value };
    let visible = 0;
    for (const { row, title, markers, button, detail } of rows) {
      const matching = markers.filter(({ periods }) => filterPeriods(periods, selected).length > 0);
      row.hidden = !terms.every(term => title.includes(term)) || !matching.length;
      if (row.hidden) {
        detail.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        continue;
      }
      visible++;
      for (const { badge, periods } of markers) {
        const matchingMode = filterPeriods(periods, { ...selected, month: 0 }).length > 0;
        badge.hidden = !matchingMode;
      }
    }
    for (const cell of root.querySelectorAll('.garden-table [data-month]')) {
      cell.classList.toggle('garden-month-selected', Number(cell.dataset.month) === selected.month);
    }
    count.textContent = `Rodoma ${visible} iš ${rows.length} augalų`;
    get('[data-garden-empty]').hidden = visible > 0;
    table.hidden = visible === 0;
  }

  search.addEventListener('input', update);
  for (const filter of filters.slice(1)) filter.addEventListener('change', update);
  for (const control of [climate, get('[data-garden-current]'), get('[data-garden-reset]')]) control.disabled = false;
  get('[data-garden-current]').addEventListener('click', () => {
    month.value = String(Number(today().slice(5, 7)));
    update();
  });
  get('[data-garden-reset]').addEventListener('click', () => {
    for (const filter of filters) filter.value = '';
    update();
  });
  climate.addEventListener('change', () => {
    get('#garden-climate-note').textContent = climate.selectedOptions[0].dataset.note;
  });
  update();
}

function connectPreparation(root) {
  const boxes = [...root.querySelectorAll('[data-garden-prep]')];
  const status = root.querySelector('[data-garden-prep-status]');
  function summary(persist) {
    const selected = boxes.filter(box => box.checked).map(box => box.value);
    let note = '';
    if (persist) {
      try {
        localStorage.setItem(PREP_KEY, JSON.stringify(selected));
      } catch {
        note = '. Naršyklė negali išsaugoti sąrašo.';
      }
    }
    status.textContent = `Atlikta ${selected.length} iš ${boxes.length}${note}`;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(PREP_KEY) || '[]');
    if (Array.isArray(saved)) for (const box of boxes) box.checked = saved.includes(box.value);
  } catch {
    // The checklist can still be used in memory when storage is unavailable.
  }
  boxes.forEach(box => box.addEventListener('change', () => summary(true)));
  root.querySelector('[data-garden-prep-clear]').addEventListener('click', () => {
    boxes.forEach(box => { box.checked = false; });
    summary(true);
  });
  summary(false);
}

function connectPlanner(root) {
  const get = selector => root.querySelector(selector);
  const form = get('[data-garden-form]');
  const fields = form.elements;
  const names = field => new Map([...field.options].map(option => [option.value, option.textContent.trim()]));
  const plants = names(fields.plant);
  const tasks = names(fields.task);
  const status = get('[data-garden-status]');
  const submit = get('[data-garden-save]');
  const cancel = get('[data-garden-cancel]');
  const list = get('[data-garden-list]');
  const template = get('[data-garden-entry]');
  const print = get('[data-garden-print]');
  const backup = get('[data-garden-backup]');
  const calendar = get('[data-garden-ics]');
  const importInput = get('[data-garden-import]');
  let editing = '';
  let entries = [];
  let snapshot;
  const say = message => { status.textContent = message; };
  const titleOf = entry => `${plants.get(entry.plant)} · ${tasks.get(entry.task)}`;
  const serialize = () => JSON.stringify({ version: 1, entries }, null, 2);

  function readLatest() {
    const stored = localStorage.getItem(PLAN_KEY);
    if (stored !== snapshot) {
      entries = stored ? validatePlan(JSON.parse(stored), plants, tasks) : [];
      snapshot = stored;
    }
  }

  function commit(update, message) {
    let canWrite = true;
    try {
      readLatest();
    } catch {
      say('Naršyklės plano nepavyko perskaityti. Išsaugokite JSON kopiją.');
      canWrite = false;
    }
    try {
      entries = validatePlan({ version: 1, entries: update(entries) }, plants, tasks);
    } catch (error) {
      say(error.message);
      return false;
    }
    try {
      if (!canWrite) throw new Error();
      const content = serialize();
      localStorage.setItem(PLAN_KEY, content);
      snapshot = content;
      say(message);
    } catch {
      say('Plano nepavyko išsaugoti naršyklėje. Atsisiųskite JSON kopiją.');
    }
    render();
    return true;
  }

  function resetForm() {
    editing = '';
    form.reset();
    submit.textContent = 'Įtraukti į planą';
    cancel.hidden = true;
  }

  function render() {
    const items = entries.toSorted((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    list.replaceChildren(...items.map(entry => {
      const row = template.content.firstElementChild.cloneNode(true);
      const check = row.querySelector('[data-entry-done]');
      const time = row.querySelector('time');
      const title = titleOf(entry);
      const edit = row.querySelector('[data-entry-edit]');
      const remove = row.querySelector('[data-entry-delete]');
      row.dataset.entryId = entry.id;
      row.classList.toggle('is-done', entry.done);
      check.checked = entry.done;
      check.setAttribute('aria-label', 'Atlikta: ' + title);
      edit.setAttribute('aria-label', 'Redaguoti: ' + title);
      remove.setAttribute('aria-label', 'Pašalinti: ' + title);
      time.dateTime = entry.date;
      time.textContent = formatDate(entry.date);
      row.querySelector('strong').textContent = title;
      const note = row.querySelector('p');
      note.textContent = entry.note;
      note.hidden = !entry.note;
      check.addEventListener('change', () => {
        commit(current => current.map(item => item.id === entry.id ? { ...item, done: check.checked } : item), 'Darbo būsena atnaujinta.');
        list.querySelector(`[data-entry-id="${entry.id}"] [data-entry-done]`)?.focus();
      });
      edit.addEventListener('click', () => {
        editing = entry.id;
        for (const key of ['plant', 'task', 'date', 'note']) fields[key].value = entry[key];
        submit.textContent = 'Išsaugoti pakeitimus';
        cancel.hidden = false;
        fields.date.focus();
      });
      remove.addEventListener('click', () => {
        if (commit(current => current.filter(item => item.id !== entry.id), 'Darbas pašalintas.')) {
          if (editing === entry.id) resetForm();
          (list.querySelector('[data-entry-delete]') || fields.plant).focus();
        }
      });
      return row;
    }));
    get('[data-garden-total]').textContent = `Darbų: ${entries.length}`;
    get('[data-garden-list-empty]').hidden = entries.length > 0;
    for (const control of [print, backup, calendar]) control.disabled = entries.length === 0;
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const entry = {
      id: editing || 'darzas-' + crypto.randomUUID(),
      plant: fields.plant.value, task: fields.task.value,
      date: fields.date.value, note: fields.note.value.trim(), done: false,
    };
    const updated = commit(current => editing
      ? current.map(old => old.id === editing ? { ...entry, done: old.done } : old)
      : [...current, entry], editing ? 'Pakeitimai išsaugoti.' : 'Darbas įtrauktas į planą.');
    if (updated) resetForm();
  });
  cancel.addEventListener('click', () => { resetForm(); fields.plant.focus(); });
  print.addEventListener('click', () => window.print());
  backup.addEventListener('click', () => download(serialize(), 'mano-darzas.json', 'application/json'));
  calendar.addEventListener('click', () => download(exportICS(entries.map(entry => ({
    id: entry.id, title: titleOf(entry), description: entry.note, start: entry.date, end: entry.date,
    allDay: true, category: 0, repeat: 'none',
  }))), 'mano-darzas.ics', 'text/calendar'));

  function download(content, name, type) {
    try {
      globalThis.Calendar365Downloads.save(content, name, type);
    } catch (error) {
      say(error.message);
    }
  }

  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    if (!file) return;
    try {
      if (file.size > 256000) throw new Error('Failas per didelis. Didžiausias dydis – 256 KB.');
      const imported = validatePlan(JSON.parse(await file.text()), plants, tasks);
      if (commit(current => {
        const merged = new Map(current.map(entry => [entry.id, entry]));
        for (const entry of imported) merged.set(entry.id, entry);
        return [...merged.values()];
      }, 'JSON planas įkeltas. Jūsų darbai sujungti.')) resetForm();
    } catch (error) {
      say(error instanceof SyntaxError ? 'Failas nėra tinkamas JSON planas.' : error.message);
    } finally {
      importInput.value = '';
    }
  });
  window.addEventListener('storage', event => {
    if (event.key !== PLAN_KEY && event.key !== null) return;
    try { readLatest(); render(); }
    catch { say('Pakeisto plano nepavyko perskaityti.'); }
  });
  try { readLatest(); }
  catch { say('Išsaugoto plano nepavyko perskaityti.'); }
  importInput.disabled = false;
  render();
  return { form, resetForm };
}

if (typeof document !== 'undefined') {
  for (const root of document.querySelectorAll('[data-garden]')) {
    const { form, resetForm } = connectPlanner(root);
    connectFilters(root, form, resetForm);
    connectPreparation(root);
    root.querySelectorAll('[data-garden-enable]').forEach(fieldset => { fieldset.disabled = false; });
    root.dataset.ready = 'true';
  }
}
