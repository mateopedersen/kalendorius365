import { difference, parse, today } from '../calendar.js';

const labels = {
  holiday: 'Šventinė diena',
  commemoration: 'Atmintina diena',
  tradition: 'Tradicija',
  observance: 'Tarptautinė diena',
  festival: 'Renginys',
};

const monthFormatter = new Intl.DateTimeFormat('lt-LT', { month: 'long', day: 'numeric', timeZone: 'UTC' });

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function card(entry, currentDate) {
  const item = element('li');
  item.dataset.kind = entry.kind;
  const link = element('a');
  link.href = entry.href;
  const time = element('time');
  time.dateTime = entry.date;
  const month = monthFormatter.formatToParts(parse(entry.date)).find(part => part.type === 'month').value;
  time.append(element('b', String(Number(entry.date.slice(-2)))), element('span', month));

  const copy = element('span', '', 'home-upcoming__copy');
  const days = difference(currentDate, entry.date);
  const when = days < 0 ? 'Vyksta dabar' : days === 0 ? 'Šiandien' : days === 1 ? 'Rytoj' : 'Po ' + days + ' d.';
  copy.append(element('strong', entry.title),
    element('small', [labels[entry.kind], entry.place, when].filter(Boolean).join(' · ')));

  const arrow = element('span', '→', 'home-upcoming__arrow');
  arrow.setAttribute('aria-hidden', 'true');
  link.append(time, copy, arrow);
  item.append(link);
  return item;
}

function enhance(root) {
  const list = root.querySelector('ul');
  const filters = root.querySelector('.home-upcoming__filters');
  const buttons = [...filters.querySelectorAll('button')];
  const feeds = JSON.parse(root.dataset.feeds);
  let selected = 'all';
  let latestDate = '';
  let loadedYear = '';
  let pendingYear = '';
  let entries = [];

  function render(currentDate) {
    const matches = entries.filter(entry => entry.end >= currentDate &&
      (selected === 'all' || selected === entry.kind)).slice(0, 4);
    if (matches.length) list.replaceChildren(...matches.map(entry => card(entry, currentDate)));
    else list.replaceChildren(element('li', 'Šiame kalendoriuje daugiau patvirtintų šio tipo datų nėra.', 'home-upcoming__empty'));
  }

  async function refresh() {
    const currentDate = today();
    const year = currentDate.slice(0, 4);
    if (year !== loadedYear) {
      const feed = feeds[year];
      if (!feed || pendingYear === year) return;
      pendingYear = year;
      try {
        const response = await fetch(feed.url + '?v=' + feed.revision);
        if (!response.ok) return;
        const data = await response.json();
        if (!Array.isArray(data) || today().slice(0, 4) !== year) return;
        entries = data;
        loadedYear = year;
        filters.hidden = false;
      } catch {
        return;
      } finally {
        pendingYear = '';
      }
    }
    if (latestDate !== currentDate) {
      latestDate = currentDate;
      render(currentDate);
    }
  }

  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-upcoming-kind]');
    if (!button) return;
    selected = button.dataset.upcomingKind;
    for (const option of buttons) option.setAttribute('aria-pressed', String(option === button));
    render(today());
  });
  void refresh();
  setInterval(() => { if (!document.hidden) void refresh(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
}

const panel = document.querySelector('.home-upcoming');
if (panel) enhance(panel);
