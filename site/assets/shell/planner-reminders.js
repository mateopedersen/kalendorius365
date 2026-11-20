import { formatDate } from '../calendar.js';
import { activeReminders } from './calendar-reminders.js';
import { KEY } from '../storage.js';

export function connectPlannerReminders(store) {
  const panel = document.querySelector('[data-active-reminders]');
  if (!panel) return () => {};
  const list = panel.querySelector('ul');
  let previous = '';
  function render() {
    const reminders = activeReminders(store.data.events);
    const signature = JSON.stringify(reminders.map(({ id, title, start, reminder }) => [id, title, start, reminder]));
    if (signature === previous) return;
    previous = signature;
    list.replaceChildren(...reminders.map(event => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = '/?data=' + event.start + '#day-details';
      link.textContent = event.title;
      const time = document.createElement('time');
      time.dateTime = event.start;
      time.textContent = formatDate(event.start);
      item.append(link, time);
      return item;
    }));
    panel.hidden = reminders.length === 0;
  }
  function refresh() {
    if (!store.locked) {
      try { store.refresh(); } catch { return; }
    }
    render();
  }
  window.addEventListener('storage', event => {
    if (event.key === KEY || event.key === null) refresh();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
  setInterval(() => {
    if (!document.hidden) refresh();
  }, 30000);
  return render;
}
