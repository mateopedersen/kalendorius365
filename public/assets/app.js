import { icon } from "/assets/releases/e4d0b4c1c5ab76e39d0c/icons.js";
import * as cal from "/assets/releases/e4d0b4c1c5ab76e39d0c/calendar.js";
import { Store, download } from "/assets/releases/e4d0b4c1c5ab76e39d0c/storage.js";
import { exportICS, importICS } from "/assets/releases/e4d0b4c1c5ab76e39d0c/ics.js";
import { notice } from "/assets/releases/e4d0b4c1c5ab76e39d0c/common.js";
import { renderWeather } from "/assets/releases/e4d0b4c1c5ab76e39d0c/weather.js";
import { WEATHER_CITY_BY_ID, DEFAULT_WEATHER_CITY } from "/assets/releases/e4d0b4c1c5ab76e39d0c/data/weather-cities.js";
const $ = (s) => document.querySelector(s),
  el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
const homeIcon = (name, className = "") => {
  const svg = icon(name, className);
  svg.querySelector("use").setAttribute(
    "href",
    "/assets/visuals/home-icons.svg?v=icons-20261016a#" + name,
  );
  return svg;
};
const [data, editorial] = await Promise.all([
  fetch("/assets/releases/e4d0b4c1c5ab76e39d0c/data/calendar.json")
    .then((r) => {
      if (!r.ok) throw Error("Nepavyko įkelti kalendoriaus");
      return r.json();
    })
    .catch((e) => {
      notice(e.message);
      throw e;
    }),
  fetch("/assets/releases/e4d0b4c1c5ab76e39d0c/data/home-holiday-data.json")
    .then((r) => (r.ok ? r.json() : { articles: [], commemorations: [] }))
    .catch(() => ({ articles: [], commemorations: [] })),
]);
const store = new Store();
if (store.error) notice(store.error);
let selected = cal.dateFromSearch(location.search) || cal.today(),
  display = selected,
  mini = selected,
  view = "month",
  visible = store.data.preferences.visible || [
    true,
    true,
    true,
    true,
    true,
    true,
    true,
  ],
  showHolidays = store.data.preferences.holidays !== false;
let lastToday = cal.today(),
  noteDate = selected,
  noteDirty = false;
const hs = (y) => cal.holidays(y, data),
  editorialArticles = () => [
    ...(editorial.articles || []),
    ...(editorial.commemorations || []),
  ],
  editorialForHoliday = (id) =>
    editorialArticles().find(
      (article) => article.id === id || article.holiday_ids?.includes(id),
    ),
  calendarEntries = (y) => [
    ...hs(y),
    ...(editorial.commemorations || []).map((item) => ({
      id: item.id,
      name: item.title,
      date: `${y}-${String(item.month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}`,
      classification: "commemoration",
    })),
  ],
  dayHolidays = (s) =>
    showHolidays
      ? calendarEntries(+s.slice(0, 4)).filter((h) => h.date === s)
      : [];
const events = (s) =>
  store.data.events
    .filter((e) => visible[e.category] && cal.occursOn(e, s))
    .map((e) => cal.occurrence(e, s))
    .filter((e) => {
      if (e.allDay) return true;
      try {
        cal.zonedInstant(e.start);
        cal.zonedInstant(e.end);
        return true;
      } catch {
        return false;
      }
    })
    .sort(
      (a, b) =>
        Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start),
    );
function transact(fn) {
  try {
    store.update(fn);
    return true;
  } catch (e) {
    notice(e.message);
    return false;
  }
}
function pref(key, value) {
  transact((d) => (d.preferences[key] = value));
}
function setNoteStatus(text, state) {
  const status = $("#note-status");
  status.textContent = text;
  status.dataset.state = state;
}
function saveNote(silent = false) {
  const text = $("#daily-note").value;
  if (text === (store.data.notes[noteDate] || "")) {
    noteDirty = false;
    setNoteStatus("Išsaugota šioje naršyklėje", "saved");
    return true;
  }
  if (
    !transact((d) => {
      if (text) d.notes[noteDate] = text;
      else delete d.notes[noteDate];
    })
  )
    return false;
  noteDirty = false;
  setNoteStatus("Išsaugota šioje naršyklėje", "saved");
  if (!silent) notice("Užrašas išsaugotas.");
  return true;
}
function selectDate(s) {
  if (!saveNote(true)) return;
  cal.parse(s);
  selected = s;
  display = s;
  mini = s;
  $("#day-details").open = true;
  render();
}
function monthTable(date, isMini = false) {
  const y = +date.slice(0, 4),
    m = +date.slice(5, 7),
    table = el("table", undefined, "month-table");
  table.setAttribute("aria-label", `${y} m. ${data.months[m - 1][2]}`);
  const head = table.createTHead(),
    hr = head.insertRow();
  let wn = el("th", "Sav.", "week-number");
  wn.scope = "col";
  hr.append(wn);
  for (const label of data.weekdays) {
    let th = el("th", label);
    th.scope = "col";
    hr.append(th);
  }
  const body = table.createTBody(),
    grid = cal.monthGrid(y, m);
  for (
    let w = 0;
    w <
    Math.ceil(
      (cal.weekday(`${y}-${String(m).padStart(2, "0")}-01`) +
        cal.monthLength(y, m)) /
        7,
    );
    w++
  ) {
    const row = body.insertRow(),
      week = el("th", cal.isoWeek(grid[w * 7]).week);
    week.scope = "row";
    row.append(week);
    for (let d = 0; d < 7; d++) {
      const s = grid[w * 7 + d],
        holiday = dayHolidays(s),
        items = isMini ? [] : events(s),
        td = row.insertCell(),
        b = el("button", undefined, "day-cell");
      b.type = "button";
      b.dataset.date = s;
      b.setAttribute("aria-pressed", String(s === selected));
      b.setAttribute(
        "aria-label",
        cal.formatDate(s, { weekday: "long" }) +
          (holiday.length ? "; " + holiday.map((h) => h.name).join(", ") : "") +
          (items.length ? `; ${items.length} įvykiai` : ""),
      );
      if (s.slice(0, 7) !== date.slice(0, 7)) b.classList.add("other-month");
      if (s === cal.today()) b.classList.add("today");
      if (d > 4) b.classList.add("weekend");
      if (holiday.some((h) => h.classification === "statutory"))
        b.classList.add("holiday");
      if (holiday.some((h) => h.classification === "commemoration"))
        b.classList.add("commemoration-day");
      b.append(el("span", +s.slice(8), "day-number"));
      if (!isMini) {
        for (const h of holiday)
          b.append(
            el(
              "span",
              (h.classification === "commemoration" ? "◦ " : "◆ ") + h.name,
              "holiday-label" +
                (h.classification === "commemoration"
                  ? " commemoration-label"
                  : ""),
            ),
          );
        for (const e of items.slice(0, 2))
          b.append(
            el(
              "span",
              (e.important ? "! " : "") + e.title,
              "event-chip cat" + e.category,
            ),
          );
        if (items.length > 2) b.append(el("small", "+" + (items.length - 2)));
      }
      td.append(b);
    }
  }
  return table;
}
function item(e, date) {
  const entry = el("div", undefined, "agenda-entry cat" + e.category),
    text = el("div");
  text.append(el("strong", (e.important ? "! " : "") + e.title));
  text.append(
    el(
      "small",
      (e.allDay ? "Visa diena" : e.start.slice(11) + "–" + e.end.slice(11)) +
        " · " +
        data.categories[e.category],
    ),
  );
  if (e.description) text.append(el("p", e.description, "muted"));
  const minutes = cal.durationMinutes(e),
    span = e.allDay
      ? `${Math.round(minutes / 1440)} d.`
      : `${Math.floor(minutes / 60) ? Math.floor(minutes / 60) + " val. " : ""}${minutes % 60 ? (minutes % 60) + " min." : ""}`.trim() ||
        "0 min.";
  text.append(el("small", "Trukmė: " + span));
  if (e.start.slice(0, 10) !== e.end.slice(0, 10))
    text.append(el("small", e.start.slice(0, 10) + " – " + e.end.slice(0, 10)));
  const edit = el("button");
  edit.append(icon("edit"));
  edit.dataset.edit = e.id;
  edit.setAttribute("aria-label", "Redaguoti " + e.title);
  entry.append(text, edit);
  return entry;
}
function listDates(start, count) {
  const wrap = el("div", undefined, "list-view");
  for (let i = 0; i < count; i++) {
    const s = cal.addDays(start, i),
      button = el(
        "button",
        cal.formatDate(s, { weekday: "long" }),
        "date-link",
      );
    button.dataset.date = s;
    wrap.append(button);
    for (const h of dayHolidays(s)) {
      const p = el(
          "p",
          undefined,
          h.classification === "commemoration" ? "commemoration-label" : "danger",
        ),
        a = el("a", "◆ " + h.name),
        article = editorialForHoliday(h.id);
      a.href = article ? `/sventes/${article.slug}/` : "/sventes/";
      p.append(a);
      wrap.append(p);
    }
    const es = events(s);
    if (!es.length && count < 8)
      wrap.append(el("p", "Įvykių nėra.", "empty-state"));
    for (const e of es) wrap.append(item(e, s));
  }
  return wrap;
}
function renderFilterChips() {
  const host = $("#category-chips");
  if (!host) return;
  host.replaceChildren();
  const all = el("button", "Visi įvykiai", "filter-chip");
  all.prepend(homeIcon("layer-stack", "filter-chip__icon"));
  all.setAttribute(
    "aria-pressed",
    String(showHolidays && visible.every(Boolean)),
  );
  all.onclick = () => {
    showHolidays = true;
    visible = visible.map(() => true);
    syncFilters();
    host.querySelector("button")?.focus();
  };
  host.append(all);
  const definitions = [
    ["Šventės", -1, "layer-holidays"],
    ...data.categories.map((name, i) => [
      name,
      i,
      [
        "layer-personal",
        "layer-work",
        "layer-study",
        "layer-health",
        "layer-family",
        "layer-birthday",
        "layer-other",
      ][i],
    ]),
  ];
  for (const [name, i, symbol] of definitions) {
    const b = el("button", undefined, "filter-chip");
    b.classList.add(i < 0 ? "filter-chip--holiday" : `filter-chip--category-${i}`);
    b.append(homeIcon(symbol, "filter-chip__icon"), document.createTextNode(name));
    b.setAttribute("aria-pressed", String(i < 0 ? showHolidays : visible[i]));
    b.onclick = () => {
      if (i < 0) showHolidays = !showHolidays;
      else visible[i] = !visible[i];
      syncFilters();
      host.querySelectorAll("button")[i + 2]?.focus();
    };
    host.append(b);
  }
}
function syncFilters() {
  pref("holidays", showHolidays);
  pref("visible", visible);
  const inputs = document.querySelectorAll("#layers input");
  inputs.forEach((input, index) => {
    input.checked = index === 0 ? showHolidays : visible[index - 1];
  });
  render();
}
function renderCalendar() {
  renderFilterChips();
  const y = +display.slice(0, 4),
    m = +display.slice(5, 7);
  $("#period-title").textContent =
    view === "year"
      ? `${y} metai`
      : view === "day"
        ? cal.formatDate(selected)
        : `${y} m. ${data.months[m - 1][1].toLocaleLowerCase("lt-LT")}`;
  $("#jump-year").value = y;
  const host = $("#calendar");
  host.replaceChildren();
  if (view === "month") host.append(monthTable(display));
  else if (view === "week")
    host.append(listDates(cal.addDays(selected, -cal.weekday(selected)), 7));
  else if (view === "day") host.append(listDates(selected, 1));
  else if (view === "agenda") host.append(listDates(display, 30));
  else {
    const grid = el("div", undefined, "year-app-grid");
    for (let month = 1; month <= 12; month++) {
      const d = `${y}-${String(month).padStart(2, "0")}-01`,
        section = el("section", undefined, "mini-calendar");
      section.append(el("h3", data.months[month - 1][1]), monthTable(d, true));
      grid.append(section);
    }
    host.append(grid);
  }
  for (const b of document.querySelectorAll("[data-view]"))
    b.setAttribute("aria-pressed", String(b.dataset.view === view));
  $("#mini-title").textContent = cal.formatDate(mini, { day: undefined });
  $("#mini").replaceChildren(monthTable(mini, true));
  let last = `${y}-${String(m).padStart(2, "0")}-${cal.monthLength(y, m)}`,
    first = `${y}-${String(m).padStart(2, "0")}-01`;
  const remaining = cal.workStats(
    display > cal.today()
      ? first
      : cal.today().slice(0, 7) === first.slice(0, 7)
        ? cal.today()
        : first,
    last,
    data,
  );
  const monthH = calendarEntries(y).filter(
    (h) => h.date.slice(0, 7) === first.slice(0, 7),
  );
  $("#stats").replaceChildren(
    ...[
      [cal.isoWeek(cal.today()).week, "Dabartinė ISO savaitė"],
      [
        remaining.days,
        display.slice(0, 7) === cal.today().slice(0, 7)
          ? "Liko darbo dienų"
          : "Darbo dienos mėnesį",
      ],
      [monthH.length, "Šventės ir atmintinos dienos"],
      [
        cal.difference(cal.today(), `${+cal.today().slice(0, 4) + 1}-01-01`),
        "Iki Naujųjų metų",
      ],
    ].map(([n, label], index) => {
      const e = el("div", undefined, "stat");
      const art = el("span", undefined, "stat-art stat-art-" + index);
      art.append(
        homeIcon(
          ["stat-calendar", "stat-briefcase", "stat-gift", "stat-clock"][index],
          "home-icon",
        ),
      );
      e.append(art, el("b", n), el("span", label));
      return e;
    }),
  );
  const list = el("ul");
  for (const h of monthH) {
    const li = el("li"),
      a = el("a", `${cal.formatDate(h.date)} — ${h.name}`),
      article = editorialForHoliday(h.id);
    if (article) a.href = `/sventes/${article.slug}/`;
    li.append(
      a,
      el(
        "small",
        h.classification === "commemoration"
          ? "Atmintina diena"
          : "Šventinė diena · paprastai nedirbama",
      ),
    );
    list.append(li);
  }
  $("#month-holidays").replaceChildren(
    monthH.length
      ? list
      : el("p", "Šį mėnesį šventinių ar atmintinų dienų nėra.", "muted"),
  );
  const current = cal.today(),
    currentYear = +current.slice(0, 4),
    dayNumber = cal.difference(`${currentYear}-01-01`, current) + 1;
  $("#today-facts").textContent =
    `Šiandien: ${dayNumber}-oji metų diena. Po šiandienos iki mėnesio pabaigos liko ${cal.monthLength(currentYear, +current.slice(5, 7)) - Number(current.slice(8))} d.; iki metų pabaigos – ${cal.difference(current, `${currentYear}-12-31`)} d.`;
  const link = $("#current-download");
  if ([2027, 2028].includes(y)) {
    link.href = `/${y}/${data.months[m - 1][0]}/`;
    link.textContent = "Šio mėnesio PDF ir WebP →";
  } else {
    link.href = `/kurti-kalendoriu/?metai=${y}&menuo=${m}`;
    link.textContent = "Kurti šio mėnesio kalendorių →";
  }
}
function renderDetails() {
  $("#selected-number").textContent = +selected.slice(8);
  $("#selected-title").textContent = cal.formatDate(selected);
  $("#selected-week").textContent =
    cal.formatDate(selected, {
      weekday: "long",
      year: undefined,
      month: undefined,
      day: undefined,
    }) +
    " · " +
    cal.isoWeek(selected).week +
    " savaitė";
  $("#day-holidays").replaceChildren(
    ...dayHolidays(selected).map((h) => {
      const p = el("p", undefined, "source-note holiday-detail-link"),
        a = el("a", "◆ " + h.name),
        status = el(
          "small",
          h.classification === "commemoration"
          ? "Atmintinos dienos statusas pats savaime nesuteikia nedarbo dienos"
            : "Šventinė diena; paprastai nedirbama",
        ),
        article = editorialForHoliday(h.id);
      a.href = article ? `/sventes/${article.slug}/` : "/sventes/";
      p.append(a, status);
      return p;
    }),
  );
  const es = events(selected);
  $("#day-agenda").replaceChildren(
    ...(es.length
      ? es.map((e) => item(e, selected))
      : [
          el(
            "p",
            "Šiai dienai įvykių dar nėra. Skirkite vietos svarbiausiems planams.",
            "empty-state",
          ),
        ]),
  );
  if (noteDate !== selected || !noteDirty)
    $("#daily-note").value = store.data.notes[selected] || "";
  noteDate = selected;
  setNoteStatus("Saugoma tik šioje naršyklėje.", "local");
  renderTasks();
  const upcoming = [];
  for (let n = 1; n <= 90 && upcoming.length < 5; n++) {
    const s = cal.addDays(cal.today(), n);
    for (const e of events(s))
      if (upcoming.length < 5) {
        const row = el("div");
        row.append(el("small", cal.formatDate(s)), item(e, s));
        upcoming.push(row);
      }
  }
  $("#upcoming-events").replaceChildren(
    ...(upcoming.length
      ? upcoming
      : [el("p", "Per artimiausias 90 dienų įvykių nėra.", "empty-state")]),
  );
}
function renderTasks() {
  const filter = $("#task-filter").value,
    ts = store.data.tasks.filter(
      (t) =>
        t.date === selected &&
        (filter === "all" || (filter === "done") === t.done),
    );
  if (!ts.length) {
    const empty = el("div", undefined, "task-empty");
    empty.append(
      homeIcon("task-empty", "task-empty__icon"),
      el(
        "span",
        filter === "done"
          ? "Atliktų užduočių nėra."
          : filter === "open"
            ? "Visos užduotys atliktos."
            : "Šiai dienai užduočių nėra.",
      ),
    );
    $("#tasks").replaceChildren(empty);
    return;
  }
  $("#tasks").replaceChildren(
    ...ts.map((t) => {
      const row = el("div", undefined, "task-entry" + (t.done ? " done" : "")),
        label = el("label", undefined, "check"),
        c = el("input");
      c.type = "checkbox";
      c.checked = t.done;
      c.dataset.taskToggle = t.id;
      label.append(c, document.createTextNode(t.title));
      const edit = el("button", undefined, "task-action task-action--edit");
      edit.append(homeIcon("task-edit", "task-action__icon"));
      edit.title = "Redaguoti užduotį";
      edit.dataset.taskEdit = t.id;
      edit.setAttribute("aria-label", "Redaguoti užduotį " + t.title);
      const del = el("button", undefined, "task-action task-action--delete");
      del.append(homeIcon("task-delete", "task-action__icon"));
      del.title = "Ištrinti užduotį";
      del.dataset.taskDelete = t.id;
      del.setAttribute("aria-label", "Ištrinti užduotį " + t.title);
      row.append(label, edit, del);
      return row;
    }),
  );
}
function render() {
  renderCalendar();
  renderDetails();
}
function showEvent(id) {
  const e = store.data.events.find((e) => e.id === id),
    f = $("#event-form");
  f.reset();
  f.elements.id.value = e?.id || "";
  f.elements.title.value = e?.title || "";
  f.elements.startDate.value = e?.start.slice(0, 10) || selected;
  f.elements.endDate.value = e?.end.slice(0, 10) || selected;
  f.elements.allDay.checked = e?.allDay || false;
  f.elements.startTime.value = e && !e.allDay ? e.start.slice(11) : "09:00";
  f.elements.endTime.value = e && !e.allDay ? e.end.slice(11) : "10:00";
  f.elements.category.value = e?.category || 0;
  f.elements.description.value = e?.description || "";
  f.elements.repeat.value = e?.repeat || "none";
  f.elements.until.value = e?.until || "";
  f.elements.important.checked = e?.important || false;
  $("#event-dialog-title").textContent = e
    ? "Redaguoti įvykį"
    : "Naujas įvykis";
  $("#delete-event").hidden = !e;
  $("#event-error").hidden = true;
  updateEventTimeFields();
  $("#event-dialog").showModal();
}
function composeHolidayFromLink() {
  const params = new URLSearchParams(location.search),
    slug = params.get("prideti"),
    date = params.get("data");
  if (!slug || !date) return;
  const article = editorialArticles().find((item) => item.slug === slug),
    dateShape = /^20\d{2}-\d{2}-\d{2}$/.test(date),
    dateYear = dateShape ? Number(date.slice(0, 4)) : 0,
    mapped = article && dateShape && [2027, 2028, 2029].includes(dateYear)
      ? calendarEntries(dateYear).some(
          (item) =>
            item.date === date &&
            (item.id === article.id || article.holiday_ids?.includes(item.id)),
        )
      : false;
  history.replaceState(null, "", location.pathname);
  if (!mapped) {
    notice("Šios šventės datos nepavyko patikrinti. Kalendoriaus įvykis nesukurtas.");
    return;
  }
  selectDate(date);
  const existing = store.data.events.find(
      (item) =>
        item.allDay &&
        item.start === date &&
        item.end === date &&
        item.title === article.title,
    );
  if (existing) {
    showEvent(existing.id);
    notice("Toks įvykis šiai datai jau yra. Atvėriau jį redaguoti.");
    return;
  }
  showEvent();
  const form = $("#event-form");
  form.elements.title.value = article.title;
  form.elements.description.value =
    article.category + ". Daugiau: https://kalendorius365.lt/sventes/" + slug + "/";
  form.elements.startDate.value = date;
  form.elements.endDate.value = date;
  form.elements.allDay.checked = true;
  form.elements.repeat.value = "none";
  updateEventTimeFields();
}
$("#event-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const f = event.currentTarget,
    a = f.elements;
  const e = {
    id: a.id.value || crypto.randomUUID(),
    title: a.title.value.trim(),
    description: a.description.value,
    allDay: a.allDay.checked,
    start:
      a.startDate.value + (a.allDay.checked ? "" : "T" + a.startTime.value),
    end: a.endDate.value + (a.allDay.checked ? "" : "T" + a.endTime.value),
    category: +a.category.value,
    repeat: a.repeat.value,
    until: a.until.value,
    important: a.important.checked,
  };
  try {
    store.update((d) => {
      const i = d.events.findIndex((x) => x.id === e.id);
      if (i < 0) d.events.push(e);
      else d.events[i] = e;
    });
    $("#event-dialog").close();
    render();
    notice("Įvykis išsaugotas.");
  } catch (error) {
    $("#event-error").textContent = error.message;
    $("#event-error").hidden = false;
  }
});
function updateEventTimeFields() {
  const fields = $("#event-form").elements;
  $("#event-times").hidden = fields.allDay.checked;
  for (const input of [fields.startTime, fields.endTime]) {
    input.disabled = fields.allDay.checked;
    input.required = !fields.allDay.checked;
  }
}
$("#event-form").elements.allDay.addEventListener(
  "change",
  updateEventTimeFields,
);
$("#close-event").onclick = () => $("#event-dialog").close();
$("#delete-event").onclick = () => {
  const id = $("#event-form").elements.id.value;
  if (transact((d) => (d.events = d.events.filter((e) => e.id !== id)))) {
    $("#event-dialog").close();
    render();
    notice("Įvykis ištrintas.");
  }
};
$("#add-event").onclick = () => showEvent();
if (location.hash === "#add-event") requestAnimationFrame(() => showEvent());
document.addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  if (b.dataset.date) selectDate(b.dataset.date);
  if (b.dataset.edit) showEvent(b.dataset.edit);
  if (
    b.dataset.taskDelete &&
    transact(
      (d) => (d.tasks = d.tasks.filter((t) => t.id !== b.dataset.taskDelete)),
    )
  )
    renderTasks();
  if (b.dataset.taskEdit) {
    const t = store.data.tasks.find((t) => t.id === b.dataset.taskEdit);
    $("#task-edit-form").elements.id.value = t.id;
    $("#task-edit-form").elements.title.value = t.title;
    $("#task-dialog").showModal();
  }
});
$("#task-form").onsubmit = (e) => {
  e.preventDefault();
  const title = $("#task-title").value.trim();
  if (
    title &&
    transact((d) =>
      d.tasks.push({
        id: crypto.randomUUID(),
        date: selected,
        title,
        done: false,
      }),
    )
  ) {
    $("#task-title").value = "";
    renderTasks();
  }
};
$("#tasks").addEventListener("change", (e) => {
  const id = e.target.dataset.taskToggle;
  if (
    id &&
    transact((d) => (d.tasks.find((t) => t.id === id).done = e.target.checked))
  )
    renderTasks();
});
$("#task-filter").onchange = renderTasks;
$("#task-edit-form").onsubmit = (e) => {
  e.preventDefault();
  const a = e.target.elements;
  if (
    transact(
      (d) =>
        (d.tasks.find((t) => t.id === a.id.value).title = a.title.value.trim()),
    )
  ) {
    $("#task-dialog").close();
    renderTasks();
  }
};
$("#task-cancel").onclick = () => $("#task-dialog").close();
$("#save-note").onclick = () => saveNote();
$("#daily-note").oninput = () => {
  noteDirty = true;
  setNoteStatus("Neišsaugoti pakeitimai", "dirty");
};
window.addEventListener("beforeunload", () => saveNote(true));
function navigate(n) {
  let s =
    view === "year"
      ? cal.shiftMonth(display, 12 * n)
      : view === "month"
        ? cal.shiftMonth(display, n)
        : cal.addDays(
            selected,
            (view === "week" ? 7 : view === "agenda" ? 30 : 1) * n,
          );
  if (+s.slice(0, 4) < 1900 || +s.slice(0, 4) > 2100) {
    notice("Kalendorius palaiko 1900–2100 metus.");
    return;
  }
  selectDate(s);
}
$("#prev").onclick = () => navigate(-1);
$("#next").onclick = () => navigate(1);
$("#today").onclick = () => selectDate(cal.today());
$("#day-prev").onclick = () => selectDate(cal.addDays(selected, -1));
$("#day-next").onclick = () => selectDate(cal.addDays(selected, 1));
$("#mini-prev").onclick = () => {
  mini = cal.shiftMonth(mini, -1);
  $("#mini-title").textContent = cal.formatDate(mini, { day: undefined });
  $("#mini").replaceChildren(monthTable(mini, true));
};
$("#mini-next").onclick = () => {
  mini = cal.shiftMonth(mini, 1);
  $("#mini-title").textContent = cal.formatDate(mini, { day: undefined });
  $("#mini").replaceChildren(monthTable(mini, true));
};
for (const b of document.querySelectorAll("[data-view]"))
  b.onclick = () => {
    if (!saveNote(true)) return;
    view = b.dataset.view;
    renderCalendar();
  };
$("#jump-year").onchange = (e) => {
  const y = +e.target.value;
  if (y >= 1900 && y <= 2100)
    selectDate(cal.shiftMonth(selected, (y - +selected.slice(0, 4)) * 12));
};
$("#calendar").addEventListener("keydown", (e) => {
  const b = e.target.closest("[data-date]");
  if (!b) return;
  const key = e.key;
  let s = b.dataset.date;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key))
    s = cal.addDays(
      s,
      { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[key],
    );
  else if (key === "Home") s = cal.addDays(s, -cal.weekday(s));
  else if (key === "End") s = cal.addDays(s, 6 - cal.weekday(s));
  else if (key === "PageUp" || key === "PageDown")
    s = cal.shiftMonth(s, (key === "PageUp" ? -1 : 1) * (e.shiftKey ? 12 : 1));
  else return;
  e.preventDefault();
  selectDate(s);
  $("#calendar").querySelector(`[data-date="${s}"]`)?.focus();
});
const layers = $("#layers");
[
  { name: "Lietuvos šventės", index: -1 },
  ...data.categories.map((name, index) => ({ name, index })),
].forEach(({ name, index }) => {
  const label = el("label", undefined, "check"),
    c = el("input");
  c.type = "checkbox";
  c.checked = index < 0 ? showHolidays : visible[index];
  const glyph = homeIcon(
    index < 0
      ? "layer-holidays"
      : [
          "layer-personal",
          "layer-work",
          "layer-study",
          "layer-health",
          "layer-family",
          "layer-birthday",
          "layer-other",
        ][index],
    `home-icon layer-icon layer-icon-${index < 0 ? "holidays" : index}`,
  );
  label.append(c, glyph, el("span", name, "layer-name"));
  c.onchange = () => {
    if (index < 0) {
      showHolidays = c.checked;
      pref("holidays", showHolidays);
    } else {
      visible[index] = c.checked;
      pref("visible", visible);
    }
    render();
  };
  layers.append(label);
});
$("#search").oninput = (e) => {
  const q = e.target.value.trim().toLocaleLowerCase("lt-LT"),
    host = $("#search-results");
  host.replaceChildren();
  host.hidden = !q;
  if (!q) return;
  if (/^\d{4}-\d{2}-\d{2}$/.test(q)) {
    try {
      cal.parse(q);
      const b = el("button", "Pereiti į " + cal.formatDate(q));
      b.dataset.date = q;
      host.append(b);
    } catch {
      host.append(el("p", "Neteisinga data."));
    }
  }
  for (const ev of store.data.events
    .filter((x) => x.title.toLocaleLowerCase("lt-LT").includes(q))
    .slice(0, 12)) {
    const b = el(
      "button",
      ev.title + " · " + cal.formatDate(ev.start.slice(0, 10)),
    );
    b.dataset.date = ev.start.slice(0, 10);
    host.append(b);
  }
  if (!host.children.length)
    host.append(el("small", "Įvykių nerasta. Datos pavyzdys: 2027-03-28."));
};
function tick() {
  const now = new Date();
  $("#clock").textContent = new Intl.DateTimeFormat("lt-LT", {
    timeZone: cal.TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: $("#seconds").checked ? "2-digit" : undefined,
    hour12: $("#hour12").checked,
  }).format(now);
  $("#clock-date").textContent = cal.formatDate(cal.today(now));
  $("#clock-weekday").textContent = new Intl.DateTimeFormat("lt-LT", {
    timeZone: cal.TZ,
    weekday: "long",
  }).format(now);
  const cityId = window.k365WeatherCity || DEFAULT_WEATHER_CITY;
  const cityName = WEATHER_CITY_BY_ID.get(cityId)?.name || "Vilnius";
  $("#clock").setAttribute("aria-label", `Dabartinis ${cityName} laikas`);
  $("#clock-zone").textContent =
    cityName + " · " +
    new Intl.DateTimeFormat("en-GB", {
      timeZone: cal.TZ,
      timeZoneName: "short",
    })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName").value;
  if (lastToday !== cal.today(now)) {
    lastToday = cal.today(now);
    renderCalendar();
    renderHolidayList();
  }
}
for (const id of ["seconds", "hour12", "large-text", "high-contrast"]) {
  const input = $("#" + id);
  input.checked = store.data.preferences[id] ?? id === "seconds";
  const apply = () => {
    if (id === "large-text")
      document.documentElement.classList.toggle("large-text", input.checked);
    if (id === "high-contrast")
      document.documentElement.classList.toggle("high-contrast", input.checked);
  };
  apply();
  input.onchange = () => {
    pref(id, input.checked);
    apply();
    tick();
  };
}
function renderHolidayList() {
  const now = cal.today(),
    year = +now.slice(0, 4),
    items = [...calendarEntries(year), ...calendarEntries(year + 1)]
      .filter((h) => h.date >= now)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4);
  const yearLink = $("#upcoming-holiday-year");
  if (yearLink) yearLink.textContent = (items[0]?.date || now).slice(0, 4);
  $("#upcoming-holidays").replaceChildren(
    ...items.map((h) => {
      const li = el("li"),
        iconType = ["restoration", "independence", "statehood"].includes(h.id)
          ? "flag"
          : ["easter", "easter-monday"].includes(h.id)
            ? "easter"
            : ["all-saints", "all-souls"].includes(h.id)
              ? "candle"
              : ["jonines", "mothers", "fathers", "assumption", "labour"].includes(h.id)
                ? "bloom"
                : ["christmas-eve", "christmas", "christmas-second"].includes(h.id)
                  ? "evergreen"
                  : "spark",
        date = el("button", h.date.slice(5).replace("-", "."), "holiday-date holiday-date--button"),
        mark = el("span", undefined, `holiday-mark holiday-mark--${iconType}`),
        text = el("div"),
        title = el("div", undefined, "holiday-title"),
        a = el("a", h.name),
        article = editorialForHoliday(h.id);
      mark.append(homeIcon(`holiday-${iconType}`, "holiday-mark__icon"));
      mark.setAttribute("aria-hidden", "true");
      date.type = "button";
      date.dataset.date = h.date;
      date.setAttribute("aria-label", `Rodyti ${cal.formatDate(h.date)} kalendoriuje`);
      a.href = article ? `/sventes/${article.slug}/` : "/sventes/";
      a.className = "holiday-select holiday-article-link";
      title.append(mark, a);
      text.append(
        title,
        el(
          "small",
          (cal.difference(now, h.date) === 0
            ? "Šiandien"
            : `Liko ${cal.difference(now, h.date)} d.`) +
            " · " +
            (h.classification === "commemoration"
              ? "Atmintina diena"
              : "Šventinė diena"),
        ),
      );
      li.classList.add(`holiday-row--${iconType}`);
      li.append(date, text);
      return li;
    }),
  );
}
$("#backup").onclick = () => {
  if (store.locked && store.raw) {
    download(
      "kalendorius365-neperskaityti-duomenys.json",
      store.raw,
      "application/json",
    );
    notice("Originalūs neperskaityti duomenys atsisiųsti nepakeisti.");
    return;
  }
  if (!saveNote(true)) return;
  download(
    "kalendorius365-kopija.json",
    JSON.stringify(store.data, null, 2),
    "application/json",
  );
};
$("#restore").onclick = () => $("#restore-dialog").showModal();
$("#restore-cancel").onclick = () => $("#restore-dialog").close();
$("#restore-confirm").onclick = () => {
  $("#restore-dialog").close();
  $("#json-file").click();
};
$("#delete-personal-data").onclick = () => $("#delete-data-dialog").showModal();
$("#delete-data-cancel").onclick = () => $("#delete-data-dialog").close();
$("#delete-data-confirm").onclick = () => {
  try {
    const preferencesPreserved = store.clearPersonalData();
    noteDirty = false;
    $("#daily-note").value = "";
    $("#delete-data-dialog").close();
    render();
    notice(
      preferencesPreserved
        ? "Asmeniniai įrašai ištrinti iš šios naršyklės. Nuostatos išsaugotos."
        : "Asmeniniai įrašai ir nuostatos ištrinti iš šios naršyklės.",
    );
  } catch (error) {
    notice(error.message);
  }
};
$("#json-file").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    if (f.size > 4e6) throw Error("Failas per didelis");
    store.restore(await f.text());
    noteDirty = false;
    render();
    notice(
      "Kopija atkurta. Atnaujinkite puslapį, kad būtų pritaikytos visos nuostatos.",
    );
  } catch (error) {
    notice(error.message);
  }
  e.target.value = "";
};
$("#export-ics").onclick = () =>
  download(
    "kalendorius365-ivykiai.ics",
    exportICS(store.data.events),
    "text/calendar;charset=utf-8",
  );
$("#import-ics").onclick = () => $("#ics-file").click();
$("#ics-file").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    if (f.size > 2e6) throw Error("Failas per didelis");
    const r = importICS(await f.text());
    if (r.imported.length && transact((d) => d.events.push(...r.imported)))
      render();
    notice(
      `Importuota: ${r.imported.length}. Praleista: ${r.rejected.length}.` +
        (r.rejected[0] ? " " + r.rejected[0] : ""),
    );
  } catch (error) {
    notice(error.message);
  }
  e.target.value = "";
};
$("#share").onclick = async () => {
  try {
    await navigator.clipboard.writeText("https://kalendorius365.lt/");
    notice(
      "Viešo kalendoriaus nuoroda nukopijuota. Asmeniniai įrašai neperduodami.",
    );
  } catch {
    notice("Viešas adresas: https://kalendorius365.lt/");
  }
};
const weatherCity = $("#weather-city");
let cityRequest = 0;
const savedCity = store.data.preferences.city || "";
const hasSavedCity = WEATHER_CITY_BY_ID.has(savedCity);
weatherCity.value = hasSavedCity ? savedCity : DEFAULT_WEATHER_CITY;
function applyWeatherCity(city) {
  window.k365WeatherCity = WEATHER_CITY_BY_ID.has(city)
    ? city
    : DEFAULT_WEATHER_CITY;
  weatherCity.value = window.k365WeatherCity;
  renderWeather(window.k365WeatherCity);
  tick();
}
async function detectWeatherCity() {
  const requestId = ++cityRequest;
  try {
    const response = await fetch("/api/location", {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw Error("Nepavyko nustatyti miesto");
    const result = await response.json();
    if (requestId !== cityRequest) return;
    applyWeatherCity(
      WEATHER_CITY_BY_ID.has(result.city) ? result.city : DEFAULT_WEATHER_CITY,
    );
  } catch {
    if (requestId === cityRequest) applyWeatherCity(DEFAULT_WEATHER_CITY);
  }
}
weatherCity.onchange = () => {
  const city = weatherCity.value;
  if (!WEATHER_CITY_BY_ID.has(city)) {
    applyWeatherCity(DEFAULT_WEATHER_CITY);
    return;
  }
  cityRequest += 1;
  pref("city", city);
  applyWeatherCity(city);
};
if (hasSavedCity) applyWeatherCity(savedCity);
else {
  applyWeatherCity(DEFAULT_WEATHER_CITY);
  detectWeatherCity();
}
setInterval(() => {
  if (document.visibilityState === "visible")
    renderWeather(window.k365WeatherCity || DEFAULT_WEATHER_CITY);
}, 1200000);
render();
renderHolidayList();
composeHolidayFromLink();
tick();
setInterval(tick, 1000);
