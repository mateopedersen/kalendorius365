import * as cal from "./calendar.js?v=1f40c6feba23";
import { Store, download } from "./storage.js?v=1f40c6feba23";
import { exportICS } from "./ics.js?v=1f40c6feba23";

const DAY_MS = 86400000;
const MIN_YEAR = 2026;
const MAX_YEAR = 2029;
const STORAGE_KEY = "k365:leave-planner:v1";
const $ = (selector, root = document) => root.querySelector(selector);

export function parseDateList(raw, { year, label = "datos", limit = 80 } = {}) {
  const values = String(raw || "")
    .split(/[\n,;]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length > limit) throw Error(`${label}: galima nurodyti iki ${limit} datų.`);
  const unique = new Set();
  for (const value of values) {
    cal.parse(value);
    if (year && Number(value.slice(0, 4)) !== Number(year))
      throw Error(`${label}: visos datos turi priklausyti ${year} metams.`);
    if (unique.has(value)) throw Error(`${label}: data ${value} įvesta kelis kartus.`);
    unique.add(value);
  }
  return [...unique].sort();
}

function dateRange(start, end, maxDays = 90) {
  cal.parse(start);
  cal.parse(end);
  if (start > end) throw Error("Pradžios data turi būti ankstesnė už pabaigos datą.");
  const count = cal.difference(start, end) + 1;
  if (count > maxDays) throw Error(`Pasirinkite ne ilgesnį kaip ${maxDays} kalendorinių dienų laikotarpį.`);
  if (+start.slice(0, 4) < MIN_YEAR || +end.slice(0, 4) > MAX_YEAR)
    throw Error(`Skaičiuoklė šiuo metu apima ${MIN_YEAR}–${MAX_YEAR} metus.`);
  return Array.from({ length: count }, (_, index) => cal.addDays(start, index));
}

export function buildDays(start, end, data, options = {}) {
  const dates = dateRange(start, end, options.rangeLimit || 90);
  const workdays = new Set(options.workdays || [0, 1, 2, 3, 4]);
  if (!workdays.size || [...workdays].some((day) => !Number.isInteger(day) || day < 0 || day > 6))
    throw Error("Pasirinkite bent vieną galimą darbo savaitės dieną.");
  const customRest = new Set(options.customRest || []);
  const blackouts = new Set(options.blackouts || []);
  const booked = new Set(options.booked || []);
  const holidayByDate = new Map();
  const firstYear = +start.slice(0, 4);
  const lastYear = +end.slice(0, 4);
  for (let year = firstYear; year <= lastYear; year++)
    for (const holiday of cal.holidays(year, data)) holidayByDate.set(holiday.date, holiday);

  return dates.map((date) => {
    const weekday = cal.weekday(date);
    const holiday = holidayByDate.get(date) || null;
    const scheduled = workdays.has(weekday);
    const customDayOff = customRest.has(date);
    const regularWorkday = scheduled && !holiday && !customDayOff;
    const isBooked = booked.has(date);
    const isBlackout = blackouts.has(date);
    return {
      date,
      weekday,
      holiday,
      scheduled,
      customDayOff,
      booked: isBooked,
      blackout: isBlackout,
      regularWorkday,
      eligible: regularWorkday && !isBlackout && !isBooked,
      resumesWork: regularWorkday && !isBooked,
      restDay: !scheduled || customDayOff,
    };
  });
}

export function validateDateInputs(year, data, options = {}) {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const customRest = parseDateList(options.customRestText, { year, label: "Papildomos poilsio dienos" });
  const blackouts = parseDateList(options.blackoutText, { year, label: "Užblokuotos datos" });
  const booked = parseDateList(options.bookedText, { year, label: "Jau suplanuotos atostogos" });
  const workdays = options.workdays || [0, 1, 2, 3, 4];
  const days = buildDays(start, end, data, { workdays, customRest, blackouts, booked, rangeLimit: 366 });
  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const date of booked) {
    const day = byDate.get(date);
    if (!day.regularWorkday) throw Error(`${date} nėra pagal pasirinktą grafiką įprastai dirbama diena.`);
    if (blackouts.includes(date)) throw Error(`${date} negali būti ir suplanuotos, ir užblokuotos atostogos.`);
  }
  for (const date of blackouts) {
    const day = byDate.get(date);
    if (!day.regularWorkday) throw Error(`${date} nėra pagal pasirinktą grafiką įprasta darbo diena.`);
  }
  return { days, workdays, customRest, blackouts, booked };
}

export function generateCandidates(days, { minDays = 3, maxDays = 21, season = "all" } = {}) {
  if (!Number.isInteger(minDays) || !Number.isInteger(maxDays) || minDays < 1 || maxDays < minDays || maxDays > 60)
    throw Error("Laikotarpio ribos turi būti 1–60 dienų; maksimali trukmė negali būti mažesnė už minimalią.");
  const firstYear = +days[0].date.slice(0, 4);
  const candidates = [];
  for (let start = 0; start < days.length; start++) {
    const month = Number(days[start].date.slice(5, 7));
    if (season !== "all" && !seasonMonths(season).has(month)) continue;
    let leaveDays = 0;
    let restDays = 0;
    let holidayDays = 0;
    for (let end = start; end < days.length && end - start + 1 <= maxDays; end++) {
      const day = days[end];
      if ((day.blackout && day.regularWorkday) || day.booked) break;
      if (day.eligible) leaveDays++;
      if (day.holiday) holidayDays++;
      if (day.restDay && !day.holiday) restDays++;
      const length = end - start + 1;
      if (length >= minDays) {
        candidates.push({
          start: dayDate(days, start),
          end: dayDate(days, end),
          startIndex: start,
          endIndex: end,
          daysOff: length,
          leaveDays,
          restDays,
          holidayDays,
        });
      }
    }
  }
  return candidates;
}

function dayDate(days, index) { return days[index].date; }

function seasonMonths(season) {
  const seasons = {
    spring: [3, 4, 5],
    summer: [6, 7, 8],
    autumn: [9, 10, 11],
    winter: [12, 1, 2],
  };
  if (!seasons[season]) throw Error("Neatpažintas metų laikas.");
  return new Set(seasons[season]);
}

export function rankCandidates(candidates, { budget, mode = "longest", limit = 3 } = {}) {
  const score = (candidate) => candidate.leaveDays === 0 ? Number.POSITIVE_INFINITY : candidate.daysOff / candidate.leaveDays;
  const compare = (a, b) => {
    if (mode === "efficiency" && score(a) !== score(b)) return score(b) - score(a);
    if (a.daysOff !== b.daysOff) return b.daysOff - a.daysOff;
    if (a.leaveDays !== b.leaveDays) return a.leaveDays - b.leaveDays;
    return a.start.localeCompare(b.start) || a.end.localeCompare(b.end);
  };
  return candidates
    .filter((candidate) => candidate.leaveDays <= budget)
    .sort(compare)
    .slice(0, limit);
}

function betterPlan(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.daysOff !== b.daysOff) return a.daysOff > b.daysOff ? a : b;
  if (a.leaveDays !== b.leaveDays) return a.leaveDays < b.leaveDays ? a : b;
  if (a.periods.length !== b.periods.length) return a.periods.length < b.periods.length ? a : b;
  const aa = a.periods.map((period) => period.start).join("|");
  const bb = b.periods.map((period) => period.start).join("|");
  return aa <= bb ? a : b;
}

export function optimizeMultiple(days, candidates, { budget = 20, maxPeriods = 4 } = {}) {
  if (!Number.isInteger(budget) || budget < 0 || budget > 60) throw Error("Atostogų biudžetas turi būti nuo 0 iki 60 darbo dienų.");
  if (!Number.isInteger(maxPeriods) || maxPeriods < 1 || maxPeriods > 10) throw Error("Galima pasirinkti nuo 1 iki 10 atostogų laikotarpių.");
  const byStart = new Map();
  for (const candidate of candidates) {
    const list = byStart.get(candidate.startIndex) || [];
    list.push(candidate);
    byStart.set(candidate.startIndex, list);
  }
  for (const list of byStart.values()) list.sort((a, b) => b.daysOff - a.daysOff || a.leaveDays - b.leaveDays || a.end.localeCompare(b.end));
  const nextAfterGap = (endIndex) => {
    let index = endIndex + 1;
    while (index < days.length && !days[index].resumesWork) index++;
    return index < days.length ? index + 1 : days.length;
  };
  const memo = new Map();
  const solve = (index, remaining, periodsLeft) => {
    if (index >= days.length || periodsLeft === 0) return { daysOff: 0, leaveDays: 0, periods: [] };
    const key = `${index}:${remaining}:${periodsLeft}`;
    if (memo.has(key)) return memo.get(key);
    let best = solve(index + 1, remaining, periodsLeft);
    for (const candidate of byStart.get(index) || []) {
      if (candidate.leaveDays > remaining) continue;
      const rest = solve(nextAfterGap(candidate.endIndex), remaining - candidate.leaveDays, periodsLeft - 1);
      best = betterPlan(best, {
        daysOff: candidate.daysOff + rest.daysOff,
        leaveDays: candidate.leaveDays + rest.leaveDays,
        periods: [candidate, ...rest.periods],
      });
    }
    memo.set(key, best);
    return best;
  };
  return solve(0, budget, maxPeriods);
}

export function evaluateRange(start, end, data, options = {}) {
  const days = buildDays(start, end, data, options);
  const blocked = days.filter((day) => day.blackout && day.regularWorkday).map((day) => day.date);
  const leaveDates = days.filter((day) => day.eligible || day.booked).map((day) => day.date);
  const extraLeaveDates = days.filter((day) => day.eligible).map((day) => day.date);
  const holidays = days.filter((day) => day.holiday);
  const restDays = days.filter((day) => day.restDay && !day.holiday).length;
  const newLeaveDays = extraLeaveDates.length;
  return {
    start,
    end,
    daysOff: days.length,
    leaveDays: newLeaveDays + days.filter((day) => day.booked && day.regularWorkday).length,
    additionalLeaveDays: newLeaveDays,
    bookedLeaveDays: days.filter((day) => day.booked && day.regularWorkday).length,
    restDays,
    holidayDays: holidays.length,
    holidayNames: holidays.map((day) => ({ date: day.date, name: day.holiday.name })),
    leaveDates,
    additionalLeaveDates: extraLeaveDates,
    blockedDates: blocked,
    days,
  };
}

function settingsFromForm(form) {
  const year = Number(form.elements.year.value);
  if (![2027, 2028].includes(year)) throw Error("Pasirinkite 2027 arba 2028 metus.");
  const budget = Number(form.elements.budget.value);
  if (!Number.isInteger(budget) || budget < 0 || budget > 60) throw Error("Atostogų biudžetas turi būti sveikas skaičius nuo 0 iki 60.");
  let workdays;
  if (form.elements.schedule.value === "5") workdays = [0, 1, 2, 3, 4];
  else if (form.elements.schedule.value === "6") workdays = [0, 1, 2, 3, 4, 5];
  else workdays = [...form.querySelectorAll("[name=custom-weekday]:checked")].map((input) => Number(input.value));
  if (!workdays.length) throw Error("Pasirinkite bent vieną darbo savaitės dieną.");
  const inputs = {
    year,
    budget,
    workdays,
    customRestText: form.elements.customRest.value,
    blackoutText: form.elements.blackouts.value,
    bookedText: form.elements.booked.value,
    minDays: Number(form.elements.minDays.value),
    maxDays: Number(form.elements.maxDays.value),
    maxPeriods: Number(form.elements.maxPeriods.value),
    season: form.elements.season.value,
  };
  for (const [name, min, max] of [["minDays", 1, 60], ["maxDays", 1, 60], ["maxPeriods", 1, 10]])
    if (!Number.isInteger(inputs[name]) || inputs[name] < min || inputs[name] > max) throw Error("Patikrinkite laikotarpių trukmės ir skaičiaus ribas.");
  if (inputs.minDays > inputs.maxDays) throw Error("Minimali trukmė negali viršyti maksimalios.");
  return inputs;
}

function preserveSettings(form) {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!stored || stored.version !== 1 || typeof stored.values !== "object") return;
    for (const [name, value] of Object.entries(stored.values)) {
      const field = form.elements[name];
      if (!field) continue;
      if (name === "customWeekdays" && Array.isArray(value)) {
        for (const input of form.querySelectorAll("[name=custom-weekday]")) input.checked = value.includes(Number(input.value));
      } else if (field.type !== "checkbox" && typeof value === "string") field.value = value;
    }
  } catch { /* Private planning remains usable when storage is unavailable. */ }
}

function saveSettings(form) {
  const names = ["year", "budget", "schedule", "customRest", "blackouts", "booked", "minDays", "maxDays", "maxPeriods", "season"];
  const values = Object.fromEntries(names.map((name) => [name, form.elements[name].value]));
  values.customWeekdays = [...form.querySelectorAll("[name=custom-weekday]:checked")].map((input) => Number(input.value));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, values })); } catch { /* Show a result even in storage-restricted browsers. */ }
}

function formatPeriod(period) {
  return `${cal.formatDate(period.start, { weekday: "long" })} – ${cal.formatDate(period.end, { weekday: "long" })}`;
}

function ratioText(days, leaveDays) {
  return leaveDays === 0 ? `${days} d. · nereikia atostogų dienų` : `${(days / leaveDays).toLocaleString("lt-LT", { maximumFractionDigits: 2 })} d. už 1 atostogų d.`;
}

function countNoun(value, forms) {
  const lastTwo = Math.abs(value) % 100;
  const last = Math.abs(value) % 10;
  if (last === 1 && lastTwo !== 11) return forms[0];
  if (last >= 2 && last <= 9 && (lastTwo < 12 || lastTwo > 19)) return forms[1];
  return forms[2];
}

const leaveDayLabel = (value) => countNoun(value, ["papildoma atostogų darbo diena", "papildomos atostogų darbo dienos", "papildomų atostogų darbo dienų"]);
const restDayLabel = (value) => countNoun(value, ["grafiko poilsio diena", "grafiko poilsio dienos", "grafiko poilsio dienų"]);
const holidayLabel = (value) => countNoun(value, ["valstybinė šventė", "valstybinės šventės", "valstybinių švenčių"]);
const holidayPeriodLabel = (value) => countNoun(value, ["į laikotarpį patenkanti šventinė diena", "į laikotarpį patenkančios šventinės dienos", "į laikotarpį patenkančių šventinių dienų"]);
const calendarDayLabel = (value) => countNoun(value, ["kalendorinė diena iš eilės", "kalendorinės dienos iš eilės", "kalendorinių dienų iš eilės"]);

function eventFor(period, index = 1) {
  const label = period.start === period.end ? cal.formatDate(period.start) : `${period.start}–${period.end}`;
  return {
    id: globalThis.crypto.randomUUID(),
    title: `Atostogos · ${label}`,
    description: `Suplanuota Kalendorius365 atostogų skaičiuokle. Laikotarpis: ${period.start}–${period.end}. Naudojamos atostogų darbo dienos: ${period.leaveDays}. Darbdavio patvirtinimas reikalingas.`,
    start: period.start,
    end: period.end,
    allDay: true,
    category: 0,
    important: false,
    repeat: "none",
    until: "",
    index,
  };
}

function downloadPeriod(periods) {
  const events = periods.map((period, index) => eventFor(period, index + 1));
  download(`atostogu-planas-${periods[0].start.slice(0, 4)}.ics`, exportICS(events), "text/calendar;charset=utf-8");
}

function addPeriod(periods) {
  if (!window.confirm("Įtraukti pasirinktą atostogų planą į šios naršyklės asmeninį kalendorių? Esami įvykiai nebus keičiami.")) return;
  try {
    const store = new Store();
    const additions = periods.map((period, index) => eventFor(period, index + 1));
    const existing = new Set(store.data.events.map((event) => `${event.start}|${event.end}|${event.title}`));
    const fresh = additions.filter((event) => !existing.has(`${event.start}|${event.end}|${event.title}`));
    if (!fresh.length) throw Error("Šis atostogų planas kalendoriuje jau yra.");
    store.update((data) => data.events.push(...fresh));
    notice(`${fresh.length} atostogų laikotarpis įtrauktas į šios naršyklės kalendorių.`);
  } catch (error) {
    notice(error.message || "Nepavyko išsaugoti atostogų plano.");
  }
}

function notice(message) {
  const status = $("#notice");
  if (!status) return;
  status.textContent = message;
  status.hidden = false;
  clearTimeout(notice.timer);
  notice.timer = setTimeout(() => { status.hidden = true; }, 5000);
}

function makeMetric(value, label) {
  const item = document.createElement("div");
  item.className = "leave-metric";
  const strong = document.createElement("strong");
  strong.textContent = String(value);
  const span = document.createElement("span");
  span.textContent = label;
  // Preserve a readable separator even if a stale stylesheet temporarily
  // falls back to inline browser defaults before the cache-busted CSS loads.
  item.append(strong, document.createTextNode(" "), span);
  return item;
}

function showDayTable(container, period, data, options) {
  const result = evaluateRange(period.start, period.end, data, options);
  const panel = document.createElement("section");
  panel.className = "panel leave-day-breakdown";
  const heading = document.createElement("h3");
  heading.textContent = `Dienų eiga: ${formatPeriod(period)}`;
  panel.append(heading);
  const table = document.createElement("table");
  table.className = "data-table leave-days-table";
  table.innerHTML = "<thead><tr><th scope=\"col\">Data</th><th scope=\"col\">Dienos tipas</th><th scope=\"col\">Skaičiavimas</th></tr></thead>";
  const tableScroll = document.createElement("div");
  tableScroll.className = "table-scroll leave-table-scroll";
  tableScroll.setAttribute("role", "region");
  tableScroll.setAttribute("aria-label", "Dienų eigos lentelė; jei reikia, slinkite horizontaliai");
  tableScroll.tabIndex = 0;
  const body = document.createElement("tbody");
  for (const day of result.days) {
    const row = document.createElement("tr");
    const dateCell = document.createElement("td");
    const time = document.createElement("time");
    time.dateTime = day.date;
    time.textContent = cal.formatDate(day.date, { weekday: "long" });
    dateCell.append(time);
    const typeCell = document.createElement("td");
    let type = "Darbo diena";
    if (day.holiday) type = `Šventinė diena · ${day.holiday.name}`;
    else if (day.booked) type = "Jau suplanuotos atostogos";
    else if (day.blackout && day.regularWorkday) type = "Užblokuota darbo diena";
    else if (day.restDay) type = "Poilsio diena";
    else if (day.eligible) type = "Atostogų diena";
    typeCell.textContent = type;
    const countCell = document.createElement("td");
    countCell.textContent = day.eligible || (day.booked && day.regularWorkday) ? "Įskaičiuojama į atostogų dienas" : "Atostogų dienų nenaudoja";
    row.append(dateCell, typeCell, countCell);
    body.append(row);
  }
  table.append(body);
  tableScroll.append(table);
  panel.append(tableScroll);
  container.replaceChildren(panel);
}

function plannerPage() {
  const form = $("#leave-planner");
  if (!form) return;
  const dataPromise = fetch("/assets/data/calendar.json").then((response) => {
    if (!response.ok) throw Error("Nepavyko įkelti patvirtinto Lietuvos švenčių rinkinio.");
    return response.json();
  });
  preserveSettings(form);
  const customGroup = $("#custom-weekdays");
  const toggleCustom = () => { customGroup.hidden = form.elements.schedule.value !== "custom"; };
  form.elements.schedule.addEventListener("change", toggleCustom);
  toggleCustom();

  const resultRoot = $("#leave-results");
  const errorRoot = $("#leave-error");
  const summary = $("#leave-summary");
  const detailRoot = $("#leave-detail");
  let latest = null;
  let dataCache = null;

  function candidateDescription(candidate) {
    const reasons = [];
    if (candidate.holidayDays) reasons.push(`${candidate.holidayDays} ${holidayLabel(candidate.holidayDays)} patenka į laikotarpį`);
    if (candidate.restDays) reasons.push(`${candidate.restDays} ${restDayLabel(candidate.restDays)}`);
    if (!candidate.holidayDays && !candidate.restDays) reasons.push("laikotarpis telpa į pasirinktą atostogų biudžetą");
    return reasons.join("; ");
  }

  function card(candidate, label, data, options) {
    const article = document.createElement("article");
    article.className = "panel leave-result-card";
    const title = document.createElement("h3");
    title.textContent = label;
    article.append(title);
    const range = document.createElement("p");
    range.className = "leave-date-range";
    range.textContent = formatPeriod(candidate);
    article.append(range);
    const metrics = document.createElement("div");
    metrics.className = "leave-metrics";
    metrics.append(
      makeMetric(candidate.daysOff, calendarDayLabel(candidate.daysOff)),
      makeMetric(candidate.leaveDays, leaveDayLabel(candidate.leaveDays)),
      makeMetric(candidate.restDays, restDayLabel(candidate.restDays)),
      makeMetric(candidate.holidayDays, holidayPeriodLabel(candidate.holidayDays)),
    );
    article.append(metrics);
    const ratio = document.createElement("p");
    ratio.className = "leave-ratio";
    ratio.textContent = `Naudos santykis: ${ratioText(candidate.daysOff, candidate.leaveDays)}.`;
    article.append(ratio);
    const reasons = document.createElement("p");
    reasons.textContent = candidateDescription(candidate);
    article.append(reasons);
    const actions = document.createElement("div");
    actions.className = "leave-actions";
    const inspect = document.createElement("button");
    inspect.type = "button";
    inspect.textContent = "Dienų eiga";
    inspect.addEventListener("click", () => showDayTable(detailRoot, candidate, data, options));
    const ics = document.createElement("button");
    ics.type = "button";
    ics.textContent = "Atsisiųsti ICS";
    ics.addEventListener("click", () => downloadPeriod([candidate]));
    const add = document.createElement("button");
    add.type = "button";
    add.className = "primary";
    add.textContent = "Įtraukti į kalendorių";
    add.addEventListener("click", () => addPeriod([candidate]));
    actions.append(inspect, ics, add);
    article.append(actions);
    return article;
  }

  function makeTable(single, efficient, multiple) {
    const table = document.createElement("table");
    table.className = "data-table leave-compare-table";
    table.innerHTML = "<caption>Atostogų planų palyginimas</caption><thead><tr><th scope=\"col\">Planavimo būdas</th><th scope=\"col\">Laikotarpiai</th><th scope=\"col\">Laisvos dienos</th><th scope=\"col\">Papildomos atostogų d.</th><th scope=\"col\">Santykis</th></tr></thead>";
    const body = document.createElement("tbody");
    const rows = [
      ["Ilgiausia viena pertrauka", single ? formatPeriod(single) : "Nėra tinkamo laikotarpio", single?.daysOff || 0, single?.leaveDays || 0],
      ["Mažiausiai atostogų vienai laisvai dienai", efficient ? formatPeriod(efficient) : "Nėra tinkamo laikotarpio", efficient?.daysOff || 0, efficient?.leaveDays || 0],
      ["Keli atskiri poilsio laikotarpiai", multiple.periods.length ? multiple.periods.map(formatPeriod).join("; ") : "Nėra tinkamo derinio", multiple.daysOff, multiple.leaveDays],
    ];
    for (const [label, periods, days, leaveDays] of rows) {
      const tr = document.createElement("tr");
      for (const value of [label, periods, String(days), String(leaveDays), ratioText(days, leaveDays)]) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      body.append(tr);
    }
    table.append(body);
    return table;
  }

  function plan() {
    errorRoot.textContent = "";
    detailRoot.replaceChildren();
    dataPromise.then((data) => {
      dataCache = data;
      const settings = settingsFromForm(form);
      const parsed = validateDateInputs(settings.year, data, settings);
      const fixedDays = parsed.booked.length;
      if (fixedDays > settings.budget) throw Error(`Jau suplanuota ${fixedDays} atostogų d., bet biudžetas yra ${settings.budget} d.`);
      const available = settings.budget - fixedDays;
      const candidates = generateCandidates(parsed.days, settings);
      const pool = candidates.filter((candidate) => candidate.leaveDays <= available);
      const single = rankCandidates(pool, { budget: available, mode: "longest", limit: 1 })[0] || null;
      const efficient = rankCandidates(pool, { budget: available, mode: "efficiency", limit: 1 })[0] || null;
      const multiple = optimizeMultiple(parsed.days, pool, { budget: available, maxPeriods: settings.maxPeriods });
      const cards = [];
      if (single) cards.push(card(single, "Ilgiausia viena pertrauka", data, { ...settings, booked: parsed.booked, blackouts: parsed.blackouts, customRest: parsed.customRest }));
      if (efficient && (!single || efficient.start !== single.start || efficient.end !== single.end)) cards.push(card(efficient, "Geriausias laisvų dienų ir atostogų dienų santykis", data, { ...settings, booked: parsed.booked, blackouts: parsed.blackouts, customRest: parsed.customRest }));
      if (multiple.periods.length) {
        const multiPeriod = {
          start: multiple.periods[0].start,
          end: multiple.periods.at(-1).end,
          leaveDays: multiple.leaveDays,
        };
        const multiCard = document.createElement("article");
        multiCard.className = "panel leave-result-card";
        const h = document.createElement("h3");
        h.textContent = "Geriausias kelių poilsio laikotarpių derinys";
        multiCard.append(h);
        const list = document.createElement("ol");
        for (const [index, period] of multiple.periods.entries()) {
          const li = document.createElement("li");
          const description = document.createElement("span");
          description.textContent = `${formatPeriod(period)} · ${period.daysOff} laisvos d. · ${period.leaveDays} atostogų d.`;
          const inspect = document.createElement("button");
          inspect.type = "button";
          inspect.textContent = "Dienų eiga";
          inspect.setAttribute("aria-label", `Peržiūrėti dienų eigą: ${formatPeriod(period)}`);
          inspect.addEventListener("click", () => showDayTable(detailRoot, period, data, { ...settings, booked: parsed.booked, blackouts: parsed.blackouts, customRest: parsed.customRest }));
          li.append(description, inspect);
          list.append(li);
        }
        multiCard.append(list);
        const metrics = document.createElement("div");
        metrics.className = "leave-metrics";
        metrics.append(
          makeMetric(multiple.daysOff, countNoun(multiple.daysOff, ["kalendorinė poilsio diena pasiūlytuose intervaluose", "kalendorinės poilsio dienos pasiūlytuose intervaluose", "kalendorinių poilsio dienų pasiūlytuose intervaluose"])),
          makeMetric(multiple.leaveDays, leaveDayLabel(multiple.leaveDays)),
        );
        multiCard.append(metrics);
        const row = document.createElement("div");
        row.className = "leave-actions";
        const ics = document.createElement("button");
        ics.type = "button";
        ics.textContent = "Atsisiųsti visų laikotarpių ICS";
        ics.addEventListener("click", () => downloadPeriod(multiple.periods));
        const add = document.createElement("button");
        add.type = "button";
        add.className = "primary";
        add.textContent = "Įtraukti pasirinktus laikotarpius";
        add.addEventListener("click", () => addPeriod(multiple.periods));
        row.append(ics, add);
        multiCard.append(row);
        cards.push(multiCard);
        multiCard.dataset.lastEnd = multiPeriod.end;
      }
      resultRoot.replaceChildren(...cards);
      summary.replaceChildren();
      const line = document.createElement("p");
      line.textContent = `Pagal ${settings.year} m. švenčių kalendorių ir pasirinktą ${settings.workdays.length} d. savaitės grafiką liko ${available} naujų atostogų darbo dienų iš ${settings.budget}; iš anksto suplanuota ${fixedDays} d.`;
      summary.append(line, makeTable(single, efficient, multiple));
      if (fixedDays) {
        const fixed = document.createElement("p");
        fixed.className = "source-note";
        fixed.textContent = `Jau suplanuotos ${fixedDays} darbo dienos atimtos iš biudžeto. Jos rodomos kaip atskiri fiksuoti laikotarpiai; skaičiuoklė jų prie naujų pasiūlymų neprijungia.`;
        summary.append(fixed);
      }
      latest = { settings, parsed, single, efficient, multiple, data };
      renderCustom(latest);
      saveSettings(form);
    }).catch((error) => {
      resultRoot.replaceChildren();
      summary.replaceChildren();
      detailRoot.replaceChildren();
      errorRoot.textContent = error.message || "Nepavyko apskaičiuoti atostogų planų.";
    });
  }

  function renderCustom(state) {
    const customRoot = $("#custom-evaluation");
    const button = $("#evaluate-period");
    button.onclick = () => {
      try {
        const start = form.elements.evalStart.value;
        const end = form.elements.evalEnd.value;
        const options = { workdays: state.settings.workdays, customRest: state.parsed.customRest, blackouts: state.parsed.blackouts, booked: state.parsed.booked };
        const evaluation = evaluateRange(start, end, state.data, options);
        if (evaluation.blockedDates.length) throw Error(`Pasirinktame laikotarpyje yra užblokuota darbo diena: ${evaluation.blockedDates.join(", ")}.`);
        const required = state.parsed.booked.length + evaluation.additionalLeaveDays;
        if (required > state.settings.budget) throw Error(`Šiam laikotarpiui ir iš anksto suplanuotoms dienoms reikėtų ${required} atostogų d.; biudžetas ${state.settings.budget} d.`);
        const candidate = { start, end, daysOff: evaluation.daysOff, leaveDays: evaluation.additionalLeaveDays, restDays: evaluation.restDays, holidayDays: evaluation.holidayDays };
        const details = document.createElement("p");
        details.textContent = `${formatPeriod(candidate)}: ${evaluation.daysOff} kalendorinių dienų, ${evaluation.additionalLeaveDays} papildomų atostogų darbo d., ${evaluation.bookedLeaveDays} jau suplanuotų atostogų d., ${evaluation.restDays} grafiko poilsio d. ir ${evaluation.holidayDays} švenčių.`;
        const result = document.createElement("div");
        result.className = "panel leave-result-card";
        result.append(details, makeMetric(evaluation.daysOff, "dienos iš eilės"), makeMetric(evaluation.additionalLeaveDays, "naujos atostogų dienos"));
        const actions = document.createElement("div");
        actions.className = "leave-actions";
        const inspect = document.createElement("button");
        inspect.type = "button";
        inspect.textContent = "Dienų eiga";
        inspect.onclick = () => showDayTable(detailRoot, candidate, state.data, options);
        const ics = document.createElement("button");
        ics.type = "button";
        ics.textContent = "Atsisiųsti ICS";
        ics.onclick = () => downloadPeriod([candidate]);
        const add = document.createElement("button");
        add.type = "button";
        add.className = "primary";
        add.textContent = "Įtraukti į kalendorių";
        add.onclick = () => addPeriod([candidate]);
        actions.append(inspect, ics, add);
        result.append(actions);
        customRoot.replaceChildren(result);
      } catch (error) {
        customRoot.textContent = error.message || "Nepavyko įvertinti laikotarpio.";
      }
    };
    if (!form.elements.evalStart.value) form.elements.evalStart.value = `${state.settings.year}-06-01`;
    if (!form.elements.evalEnd.value) form.elements.evalEnd.value = `${state.settings.year}-06-07`;
  }

  form.addEventListener("submit", (event) => { event.preventDefault(); plan(); });
  $("#reset-leave").addEventListener("click", () => {
    form.reset();
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    toggleCustom();
    $("#custom-evaluation").replaceChildren();
    plan();
  });
  $("#leave-print").addEventListener("click", () => window.print());
  plan();
}

if (typeof document !== "undefined") plannerPage();
