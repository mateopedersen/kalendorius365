import { addDays, formatDate } from '../calendar.js';
import { exportICS } from '../ics.js';
import { Store } from '../storage.js';

const fmt = (key, options) => new Intl.DateTimeFormat('lt-LT', { timeZone: 'UTC', ...options })
  .format(new Date(key + 'T12:00:00Z'));
const capitalize = value => value.charAt(0).toLocaleUpperCase('lt') + value.slice(1);

function enhance(root) {
  const select = selector => root.querySelector(selector);
  const year = select('[data-occasion-year]');
  if (!year) return;
  const alert = select('[data-occasion-status]');
  const reminder = select('[data-occasion-reminder]');
  const google = select('[data-occasion-google]');
  const open = select('[data-occasion-open]');
  const title = root.dataset.title;
  const slug = new URL(root.dataset.source).pathname.split('/').filter(Boolean).at(-1);
  const source = root.dataset.source;
  const host = root.closest('article') || root.parentElement;
  const downloads = root.querySelectorAll('[data-occasion-download]');

  function event() {
    const { start, end } = year.selectedOptions[0].dataset;
    return {
      id: `proga-${slug}-${start}`, title,
      description: `${root.dataset.location}\n${source}`,
      start, end: addDays(end, -1), allDay: true, category: 0, repeat: 'none', until: '', important: false,
      ...(reminder.value === '' ? {} : { reminder: Number(reminder.value) }),
    };
  }

  function render() {
    const { start, end } = event();
    const sourceOption = year.selectedOptions[0].dataset;
    select('[data-occasion-month]').textContent = capitalize(fmt(start, { month: 'long' }));
    select('[data-occasion-day]').textContent = +start.slice(8);
    select('[data-occasion-weekday]').textContent = capitalize(fmt(start, { weekday: 'long' }));
    const date = select('[data-occasion-date]');
    date.dateTime = start;
    date.textContent = start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
    select('[data-occasion-duration]').textContent = start === end ? 'Visą dieną' : 'Kelių dienų įvykis';
    const url = new URL(google.href);
    url.searchParams.set('dates', [start, sourceOption.end].map(day => day.replaceAll('-', '')).join('/'));
    google.href = url.href;
    downloads.forEach(link => { link.href = sourceOption.ics; });
    open.hidden = true;
    alert.textContent = '';
  }

  function selectYear(value) {
    if ([...year.options].some(option => option.value === value)) {
      year.value = value;
      render();
    }
  }

  function syncFromLocation() {
    const hash = location.hash.match(/^#metai-(\d{4})$/)?.[1];
    const query = new URLSearchParams(location.search).get('metai');
    selectYear([...year.options].some(option => option.value === hash) ? hash : query);
  }

  year.addEventListener('change', () => {
    render();
    const anchor = host.querySelector(`a[data-hd-select="${year.value}"], .hg-years a[href="#metai-${year.value}"]`);
    if (anchor) anchor.click();
    else {
      const url = new URL(location.href);
      url.searchParams.set('metai', year.value);
      history.replaceState(null, '', url);
    }
  });
  host.addEventListener('occasion-year', event => selectYear(event.detail));
  window.addEventListener('hashchange', syncFromLocation);
  reminder.addEventListener('change', render);

  for (const link of downloads) {
    link.addEventListener('click', click => {
      if (click.button !== 0 || click.ctrlKey || click.metaKey || click.shiftKey || click.altKey) return;
      click.preventDefault();
      try {
        globalThis.Calendar365Downloads.save(exportICS([{ ...event(), location: root.dataset.location }]), `${slug}-${year.value}.ics`, 'text/calendar');
        alert.textContent = 'Atverkite failą savo kalendoriaus programoje ir patvirtinkite importą.';
      } catch (error) {
        alert.textContent = error.message;
      }
    });
  }
  google.addEventListener('click', () => {
    alert.textContent = 'Patikrinkite pranešimą ir išsaugokite įvykį „Google Calendar“.';
  });
  const save = select('[data-occasion-save]');
  save.addEventListener('click', () => {
    const entry = event();
    let duplicate = false;
    try {
      new Store().update(data => {
        const saved = data.events.find(item => item.allDay && item.repeat === 'none' &&
          item.start === entry.start && item.end === entry.end && item.title === entry.title);
        if (saved) {
          duplicate = true;
          if (entry.reminder === undefined) delete saved.reminder;
          else saved.reminder = entry.reminder;
        } else {
          data.events.push({ ...entry, id: crypto.randomUUID() });
        }
      });
      alert.textContent = duplicate ? 'Įvykis jau buvo kalendoriuje. Priminimas atnaujintas.' : 'Įvykis pridėtas prie jūsų kalendoriaus.';
      open.href = `/?data=${entry.start}#day-details`;
      open.hidden = false;
    } catch (error) {
      alert.textContent = error.message;
    }
  });

  render();
  syncFromLocation();
  for (const selector of ['[data-occasion-fields]', '[data-occasion-help]', '[data-occasion-save]'])
    select(selector).hidden = false;
}

document.querySelectorAll('[data-occasion-calendar]').forEach(enhance);
