import '../calendar-downloads.js';
import { phaseICS } from './lunar-engine.js';

const picker = document.querySelector('[data-phase-picker]');
const officialEvents = JSON.parse(document.querySelector('#lunar-official-events').textContent);
const yearLinks = [...picker.querySelectorAll('[data-phase-year]')];
const monthSelect = picker.querySelector('[data-phase-month]');
const monthHeading = picker.querySelector('[data-phase-heading]');
const monthCalendar = picker.querySelector('[data-phase-calendar]');
const rows = picker.querySelector('[data-phase-rows]');
const rowTemplate = rows.firstElementChild;
const params = new URLSearchParams(location.search);
let selectedYear = yearLinks.find(link => link.dataset.phaseYear === params.get('metai'))?.dataset.phaseYear
  ?? yearLinks[0].dataset.phaseYear;
let monthEvents;

const initialMonth = String(Number(params.get('menuo'))).padStart(2, '0');
if ([...monthSelect.options].some(option => option.value === initialMonth)) monthSelect.value = initialMonth;

function renderPhases(updateUrl) {
  const month = monthSelect.selectedOptions[0];
  const prefix = `${selectedYear}-${month.value}-`;
  monthEvents = officialEvents.filter(event => event.local_date.startsWith(prefix));
  monthHeading.textContent = `${selectedYear} m. ${month.textContent.toLocaleLowerCase('lt-LT')}`;
  monthCalendar.href = `/menulio-kalendorius/${selectedYear}/${month.dataset.slug}/`;

  for (const link of yearLinks) {
    if (link.dataset.phaseYear === selectedYear) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }

  rows.replaceChildren(...monthEvents.map(event => {
    const row = rowTemplate.cloneNode(true);
    row.querySelector('.lunar-event-mark').className = `lunar-event-mark lunar-event-mark--${event.phase}`;
    row.querySelector('h3').textContent = event.label_lt;
    const time = row.querySelector('time');
    time.dateTime = event.utc;
    time.textContent = event.local_label_lt;
    const download = row.querySelector('[data-phase-event-ics]');
    download.dataset.phaseEventIcs = event.utc;
    download.setAttribute('aria-label', `Atsisiųsti ICS: ${event.label_lt} ${event.local_date}`);
    return row;
  }));

  if (updateUrl) {
    const url = new URL(location.href);
    url.searchParams.set('metai', selectedYear);
    url.searchParams.set('menuo', String(Number(month.value)));
    history.replaceState(history.state, '', url);
  }
}

for (const link of yearLinks) {
  link.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    selectedYear = link.dataset.phaseYear;
    renderPhases(true);
  });
}
monthSelect.addEventListener('change', () => renderPhases(true));

picker.addEventListener('click', event => {
  const button = event.target.closest('[data-phase-event-ics], [data-phase-export]');
  if (!button) return;
  const instant = button.dataset.phaseEventIcs;
  const events = instant ? monthEvents.filter(entry => entry.utc === instant) : monthEvents;
  globalThis.Calendar365Downloads.save(phaseICS(events), 'menulio-fazes.ics', 'text/calendar;charset=utf-8');
});

renderPhases(false);
monthSelect.disabled = false;
