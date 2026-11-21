import '../calendar-downloads.js';
import { exportICS } from '../ics.js';
import { download } from '../storage.js';

const page = document.querySelector('#education-calendar');
const filters = page.querySelector('[data-edu-filters]');
const results = page.querySelector('[data-edu-count]');
const stageControl = page.querySelector('[data-edu-stage]');
const school = page.querySelector('[data-edu-schedule]');
const query = filters.elements.paieska;
const city = filters.elements.miestas;
const kind = filters.elements.tipas;
const dateParts = new Intl.DateTimeFormat('lt-LT', {
  timeZone: 'Europe/Vilnius', year: 'numeric', month: '2-digit', day: '2-digit',
});
const today = dateParts.format(new Date());
const displayDate = new Intl.DateTimeFormat('lt-LT', {
  timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric',
});
const utcDate = date => new Date(date + 'T00:00:00Z');
const normalize = text => text.toLocaleLowerCase('lt-LT').normalize('NFD').replace(/\p{Mark}/gu, '');
const listings = [...page.querySelectorAll('[data-edu-institution]')].map(card => ({
  card, search: normalize(card.dataset.eduName + ' ' + card.dataset.eduInstitution + ' ' + card.querySelector('.edu-city').textContent),
  cities: [...card.querySelectorAll('[data-edu-city]')].map(label => label.textContent),
  rows: [...card.querySelectorAll('[data-edu-event]')],
  dates: card.querySelector('[data-edu-dates]'),
  upcoming: card.querySelector('[data-edu-upcoming]'),
}));

function refreshUpcoming(listing, visible) {
  if (!listing.upcoming) return;
  const upcoming = visible.filter(row => row.dataset.end >= today);
  const milestones = upcoming.filter(row => ['break', 'exam', 'retake'].includes(row.dataset.kind));
  const next = (milestones.length ? milestones : upcoming)
    .sort((a, b) => a.dataset.start.localeCompare(b.dataset.start))[0];
  listing.upcoming.hidden = !next;
  if (!next) return;
  const { start, end } = next.dataset;
  listing.upcoming.querySelector('[data-edu-upcoming-label]').textContent = start <= today ? 'Vyksta dabar' : 'Artimiausias laikotarpis';
  listing.upcoming.querySelector('[data-edu-upcoming-title]').textContent = next.querySelector('[data-edu-title]').textContent;
  listing.upcoming.querySelector('[data-edu-upcoming-range]').textContent = start === end
    ? displayDate.format(utcDate(start))
    : displayDate.formatRange(utcDate(start), utcDate(end));
}

function refreshInstitutions() {
  const term = normalize(query.value.trim());
  const type = kind.value;
  let count = 0;
  for (const listing of listings) {
    const match = listing.search.includes(term) && (!city.value || listing.cities.includes(city.value));
    for (const row of listing.rows) row.hidden = Boolean(type && row.dataset.kind !== type);
    const visible = listing.rows.filter(row => !row.hidden);
    const shown = visible.length;
    listing.card.hidden = !match || Boolean(type && !shown);
    if (listing.dates) listing.dates.querySelector('[data-edu-row-count]').textContent = shown;
    if (listing.card.hidden) continue;
    count++;
    refreshUpcoming(listing, visible);
  }
  results.textContent = count
    ? `Rodoma: ${count} iš ${listings.length}`
    : 'Nerasta įstaigų, atitinkančių šiuos filtrus. Pakeiskite paiešką arba išvalykite filtrus.';
}

function refreshSchool() {
  const stage = stageControl.value;
  const visible = [...school.querySelectorAll('[data-edu-event]')].filter(row => {
    row.hidden = stage !== 'all' && row.dataset.stage !== 'all' && row.dataset.stage !== stage;
    return !row.hidden;
  });
  const next = visible.find(row => row.dataset.start > today);
  for (const row of visible) {
    const status = row.querySelector('[data-edu-date-status]');
    const active = row.dataset.start <= today && row.dataset.end >= today;
    status.textContent = active ? 'Dabar' : 'Artimiausios';
    status.hidden = !active && row !== next;
  }
}

function downloadSchedule(button) {
  const group = button.closest('[data-edu-institution], [data-edu-schedule]');
  const source = group.querySelector('[data-edu-source]').href;
  const one = button.closest('[data-edu-event]');
  const rows = one ? [one] : [...group.querySelectorAll('[data-edu-event]:not([hidden])')];
  const events = rows.map(row => ({
    id: 'studijos-2026-2027-' + row.dataset.key,
    title: group === school ? row.querySelector('[data-edu-title]').textContent + ' · ' + row.querySelector('.edu-break-stage').textContent
      : row.querySelector('[data-edu-title]').textContent + ' · ' + group.dataset.eduName,
    description: (group.querySelector('.edu-scope, .edu-section-note')?.textContent.trim() || group.dataset.eduName) + '\nŠaltinis: ' + (row.dataset.source || source),
    start: row.dataset.start,
    end: row.dataset.end,
    allDay: true,
    repeat: 'none',
    category: 'Mokslai',
  }));
  const name = one ? one.dataset.key : group.dataset.id;
  download(name + '-2026-2027.ics', exportICS(events), 'text/calendar;charset=utf-8');
}

filters.addEventListener('submit', event => event.preventDefault());
filters.addEventListener('input', refreshInstitutions);
filters.addEventListener('reset', () => {
  for (const listing of listings) if (listing.dates) listing.dates.open = false;
  requestAnimationFrame(refreshInstitutions);
});
stageControl.addEventListener('change', refreshSchool);

for (const button of page.querySelectorAll('[data-edu-download], [data-edu-add-event]')) {
  button.addEventListener('click', () => downloadSchedule(button));
  button.hidden = false;
}

for (const { rows } of listings) for (const row of rows) {
  for (const time of row.querySelectorAll('time')) {
    time.textContent = displayDate.format(utcDate(time.dateTime));
  }
}

for (const control of page.querySelectorAll('[data-edu-controls], [data-edu-filters], [data-edu-count]')) control.hidden = false;

function revealAnchor() {
  const target = document.getElementById(location.hash.slice(1));
  if (target?.matches('.edu-next-years details')) target.open = true;
  if (target?.matches('[data-edu-institution]')) {
    const dates = target.querySelector('[data-edu-dates]');
    if (dates) dates.open = true;
  }
}

refreshSchool();
refreshInstitutions();
revealAnchor();
window.addEventListener('hashchange', revealAnchor);
