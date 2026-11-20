import { addDays, today, zonedInstant } from '../calendar.js';

export const reminderDays = Object.freeze([1, 7, 0]);

export function reminderInstant(date, days) {
  return zonedInstant(addDays(date, -days) + 'T09:00');
}

export function triggerValue(date, days) {
  return new Date(reminderInstant(date, days)).toISOString().replace(/[-:]|\.\d{3}/g, '');
}

export function activeReminders(events, now = new Date()) {
  const date = today(now);
  return events.filter(event => reminderDays.includes(event.reminder) &&
    event.end >= date && addDays(event.start, -event.reminder) <= date &&
    reminderInstant(event.start, event.reminder) <= now)
    .sort((left, right) => left.start.localeCompare(right.start));
}
