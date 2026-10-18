// Date-only arithmetic uses UTC; personal wall times are resolved in Europe/Vilnius.
export const TZ = "Europe/Vilnius";
export const DAY = 86400000;
export function parse(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw Error("Neteisinga data");
  const d = new Date(s + "T12:00:00Z");
  if (!Number.isFinite(+d) || iso(d) !== s) throw Error("Neteisinga data");
  return d;
}
export const iso = (d) => d.toISOString().slice(0, 10);
// Lithuanian count forms: singular, paucal and genitive plural.
export function countForm(value, one, few, many) {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric)) throw Error("Netinkamas skaičius.");
  const count = Math.abs(numeric);
  const lastTwo = count % 100, last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 19) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 9) return few;
  return many;
}
export const countNoun = (value, one, few, many) => `${value} ${countForm(value, one, few, many)}`;
// A shared date link opens the day without creating or changing any saved data.
export function dateFromSearch(search) {
  const params = new URLSearchParams(search), value = params.get('data');
  if (params.has('prideti') || !value || value < '1900-01-01' || value > '2100-12-31') return null;
  try { parse(value); return value; } catch { return null; }
}
export const addDays = (s, n) => iso(new Date(+parse(s) + Number(n) * DAY));
export const difference = (a, b) => Math.round((+parse(b) - parse(a)) / DAY);
export const weekday = (s) => (parse(s).getUTCDay() + 6) % 7;
export const monthLength = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export function isoWeek(s) {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() + 3 - weekday(s));
  const y = d.getUTCFullYear();
  return {
    year: y,
    week:
      1 +
      Math.round(
        (+d - +parse(`${y}-01-04`) + weekday(`${y}-01-04`) * DAY - 3 * DAY) /
          (7 * DAY),
      ),
  };
}
export function isoWeekRange(year, week) {
  if (!Number.isInteger(year) || year < 1900 || year > 9999 || !Number.isInteger(week) || week < 1 || week > 53) throw Error("Įrašykite ISO metus nuo 1900 iki 9999 ir savaitę nuo 1 iki 53.");
  const januaryFourth = `${year}-01-04`;
  const monday = addDays(januaryFourth, -weekday(januaryFourth) + (week - 1) * 7);
  const actual = isoWeek(monday);
  if (actual.year !== year || actual.week !== week) throw Error(`${year} ISO metais ${week} savaitės nėra.`);
  return { year, week, start: monday, end: addDays(monday, 6) };
}
export function easter(y) {
  let a = y % 19,
    b = Math.floor(y / 100),
    c = y % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    n = h + l - 7 * m + 114;
  return `${y}-${String(Math.floor(n / 31)).padStart(2, "0")}-${String((n % 31) + 1).padStart(2, "0")}`;
}
export function holidays(y, data) {
  return data.holidays
    .map((h) => {
      let date;
      if (h.rule === "easter") date = addDays(easter(y), h.offset);
      else {
        date = `${y}-${String(h.month).padStart(2, "0")}-${String(h.day || 1).padStart(2, "0")}`;
        if (h.rule === "first-sunday")
          date = addDays(date, (6 - weekday(date) + 7) % 7);
      }
      return { ...h, date, classification: "statutory" };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
// Only public holiday records are memoized. Personal events, notes and
// preferences remain live in Store and never enter this bounded lookup.
export function createCalendarEntries(data, commemorations = []) {
  const years = new Map();
  return (year) => {
    if (!years.has(year)) {
      const records = [...holidays(year, data), ...commemorations.map(item => ({
        id: item.id, name: item.title,
        date: `${year}-${String(item.month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}`,
        classification: "commemoration",
      }))].map(Object.freeze);
      if (years.size >= 16) years.delete(years.keys().next().value);
      years.set(year, Object.freeze(records));
    }
    return years.get(year);
  };
}
export function monthGrid(y, m, start = 0) {
  let first = `${y}-${String(m).padStart(2, "0")}-01`,
    offset = (weekday(first) - start + 7) % 7;
  return Array.from({ length: 42 }, (_, i) => addDays(first, i - offset));
}
export function shiftMonth(s, n) {
  let d = parse(s),
    day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  d.setUTCDate(
    Math.min(day, monthLength(d.getUTCFullYear(), d.getUTCMonth() + 1)),
  );
  return iso(d);
}
// Calendar-month duration is anchored to the original day, clamping at month end.
export function calendarDuration(a, b) {
  parse(a);
  parse(b);
  if (a > b) throw Error("Pradžios data turi būti ankstesnė");
  if (difference(a, b) > 36600)
    throw Error("Rinkitės ne ilgesnį nei 100 metų laikotarpį");
  let months =
    (+b.slice(0, 4) - +a.slice(0, 4)) * 12 +
    (+b.slice(5, 7) - +a.slice(5, 7));
  if (shiftMonth(a, months) > b) months--;
  const anchor = shiftMonth(a, months);
  return {
    years: Math.floor(months / 12),
    months: months % 12,
    days: difference(anchor, b),
  };
}
// Reuse formatters, never dates: midnight and daylight-saving changes must
// still use the instant supplied by the caller.
const todayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dateFormatters = new Map();
export function today(now = new Date()) {
  const parts = todayFormatter.formatToParts(now);
  const value = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}
export function formatDate(s, options = {}) {
  const settings = {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
  };
  const key = JSON.stringify(Object.keys(settings).sort().map(key => [key, typeof settings[key], settings[key]]));
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("lt-LT", settings);
    if (dateFormatters.size >= 32) dateFormatters.delete(dateFormatters.keys().next().value);
    dateFormatters.set(key, formatter);
  }
  return formatter.format(parse(s));
}
export function workStats(a, b, data, six = false) {
  parse(a);
  parse(b);
  if (a > b) throw Error("Pradžios data turi būti ankstesnė");
  if (difference(a, b) > 36600)
    throw Error("Rinkitės ne ilgesnį nei 100 metų laikotarpį");
  let hs = new Set();
  for (let y = +a.slice(0, 4); y <= +b.slice(0, 4) + 1; y++)
    for (const h of holidays(y, data)) hs.add(h.date);
  let days = 0,
    hours = 0,
    shortened = [],
    weekends = 0,
    publicDays = 0;
  for (let s = a; s <= b; s = addDays(s, 1)) {
    let w = weekday(s);
    if (w >= (six ? 6 : 5)) {
      weekends++;
      continue;
    }
    if (hs.has(s)) {
      publicDays++;
      continue;
    }
    days++;
    hours += six ? (w === 5 ? 5 : 7) : 8;
    if (hs.has(addDays(s, 1))) {
      hours--;
      shortened.push(s);
    }
  }
  return { days, hours, shortened, weekends, publicDays };
}
// Add working days after the selected date, skipping weekends and statutory holidays.
export function addWorkdays(start, amount, data) {
  parse(start);
  if (!Number.isInteger(amount) || Math.abs(amount) > 36600)
    throw Error("Darbo dienų skaičius turi būti sveikas skaičius nuo −36600 iki 36600.");
  if (amount === 0) return start;
  const direction = Math.sign(amount), remaining = Math.abs(amount), holidayYears = new Map();
  const isWorkingDay = (date) => {
    if (weekday(date) >= 5) return false;
    const year = Number(date.slice(0, 4));
    if (!holidayYears.has(year))
      holidayYears.set(year, new Set(holidays(year, data).map((holiday) => holiday.date)));
    return !holidayYears.get(year).has(date);
  };
  let date = start, added = 0;
  while (added < remaining) {
    date = addDays(date, direction);
    if (isWorkingDay(date)) added++;
  }
  return date;
}
const wallFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export const wallTime = (instant) =>
  wallFormatter.format(new Date(instant)).replace(" ", "T");
// Enumerate plausible UTC offsets: reject nonexistent spring times; earlier occurrence in autumn.
export function zonedInstant(local) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw Error("Neteisingas laikas");
  parse(local.slice(0, 10));
  let naive = Date.parse(local + "Z"),
    matches = [];
  for (const offset of [120, 180]) {
    const t = naive - offset * 60000;
    if (wallTime(t) === local) matches.push(t);
  }
  if (!matches.length)
    throw Error(
      "Šio vietinio laiko nėra dėl vasaros laiko pokyčio. Pasirinkite kitą laiką.",
    );
  return Math.min(...matches);
}
export function occursOn(e, date) {
  if (date < e.start.slice(0, 10)) return false;
  const start = e.start.slice(0, 10),
    end = e.end.slice(0, 10);
  if (!e.repeat || e.repeat === "none") return date >= start && date <= end;
  if (e.until && date > e.until) return false;
  const delta = difference(start, date);
  if (e.repeat === "daily") return true;
  if (e.repeat === "weekly") return delta % 7 === 0;
  if (e.repeat === "monthly") return date.slice(8) === start.slice(8);
  if (e.repeat === "yearly") return date.slice(5) === start.slice(5);
  return false;
}
export function occurrence(e, date) {
  if (e.repeat === "none") return e;
  if (e.allDay) return { ...e, start: date, end: date };
  return { ...e, start: date + e.start.slice(10), end: date + e.end.slice(10) };
}

export function durationMinutes(event) {
  return event.allDay
    ? (difference(event.start, event.end) + 1) * 1440
    : Math.round((zonedInstant(event.end) - zonedInstant(event.start)) / 60000);
}
