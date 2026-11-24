import { connectPlannerReminders } from "./shell/planner-reminders.js";
import { icon } from "./icons.js";
import { connectEventEditor } from "./shell/event-editor.js";
import * as cal from "./calendar.js";
import { Store, download } from "./storage.js";
import { exportICS, importICS } from "./ics.js";
import { notice } from "./notice.js";
import { enhanceWeatherCityPicker, loadWeather, renderWeather } from "./weather.js?v=city-auto-20261016";
import { WEATHER_CITY_BY_ID, DEFAULT_WEATHER_CITY } from "./data/weather-cities.js";
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
const compactDate = { year: undefined, month: "2-digit", day: "2-digit" };
const store = new Store();
const renderReminders = connectPlannerReminders(store);
const savedCity = store.data.preferences.city || "";
const hasSavedCity = WEATHER_CITY_BY_ID.has(savedCity);
void loadWeather(hasSavedCity ? savedCity : DEFAULT_WEATHER_CITY);
const [data, editorial] = await Promise.all([
  fetch("/assets/data/calendar.json")
    .then((r) => {
      if (!r.ok) throw Error("Nepavyko įkelti kalendoriaus");
      return r.json();
    })
    .catch((e) => {
      const loading = $("#calendar-app-status");
      if (loading)
        loading.textContent = "Asmeninio kalendoriaus duomenų nepavyko įkelti. Patikrinkite ryšį ir atnaujinkite puslapį.";
      notice(e.message);
      throw e;
    }),
  fetch("/assets/data/home-holiday-data.json?v=2")
    .then((r) => (r.ok ? r.json() : { articles: [], commemorations: [] }))
    .catch(() => ({ articles: [], commemorations: [] })),
]);
if (store.error) notice(store.error);
let selected = cal.dateFromSearch(location.search) || cal.today(),
  display = selected,
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
const editorialArticles = [
    ...(editorial.articles || []),
    ...(editorial.commemorations || []),
  ],
  calendarEntries = cal.createCalendarEntries(data, editorial.commemorations || []),
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
function paintDayNote(node, text) {
  node.textContent = text;
  node.hidden = !text.trim();
}
function refreshDayNote(date, text) {
  for (const node of $("#calendar").querySelectorAll('[data-day-note="' + date + '"]'))
    paintDayNote(node, text);
}
function buildDayNote(date) {
  const note = el("span", undefined, "calendar-day-note");
  note.dataset.dayNote = date;
  paintDayNote(note, (noteDirty && date === noteDate ? $("#daily-note").value : store.data.notes[date]) || "");
  return note;
}
function noteButton(date) {
  const button = el("button", "+", "calendar-note-add");
  button.type = "button";
  button.dataset.noteEdit = date;
  button.setAttribute("aria-label", "Užrašas · " + cal.formatDate(date));
  return button;
}
const noteDialog = $("#calendar-note-dialog");
const noteDialogText = $("#calendar-note-text");
let dialogNoteDate;
function openDayNote(date) {
  dialogNoteDate = date;
  noteDialog.returnValue = "";
  $("#calendar-note-date").textContent = cal.formatDate(date);
  noteDialogText.value = noteDirty && date === noteDate ? $("#daily-note").value : store.data.notes[date] || "";
  const options = $("#calendar-note-events");
  options.replaceChildren();
  const titles = new Set([...dayHolidays(date).map(item => item.name), ...events(date).map(item => item.title)]);
  for (const title of titles) {
    const button = el("button", title);
    button.type = "button";
    button.onclick = () => {
      if (!noteDialogText.value.split("\n").includes(title))
        noteDialogText.value = [noteDialogText.value.trim(), title].filter(Boolean).join("\n").slice(0,10000);
      noteDialogText.focus();
    };
    options.append(button);
  }
  $("#calendar-note-choices").hidden = !titles.size;
  noteDialog.showModal();
}
noteDialog.addEventListener("close", () => {
  if (noteDialog.returnValue !== "save" || !dialogNoteDate) return;
  const value = noteDialogText.value;
  if (dialogNoteDate === noteDate) {
    $("#daily-note").value = value;
    saveNote();
  } else if (transact(data => {
    if (value.trim()) data.notes[dialogNoteDate] = value;
    else delete data.notes[dialogNoteDate];
  })) refreshDayNote(dialogNoteDate, value);
});
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
  refreshDayNote(noteDate, text);
  setNoteStatus("Išsaugota šioje naršyklėje", "saved");
  if (!silent) notice("Užrašas išsaugotas.");
  return true;
}
function selectDate(s, nextView = view) {
  if (!saveNote(true)) return false;
  cal.parse(s);
  selected = s;
  display = s;
  view = nextView;
  $("#day-details").open = true;
  render();
  return true;
}
function monthTable(date, isMini = false, todayDate = cal.today()) {
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
        [String(+s.slice(8)),
          ...(!isMini ? holiday.map(h => (h.classification === "commemoration" ? "◦ " : "◆ ") + h.name) : []),
          ...items.slice(0, 2).map(e => (e.important ? "! " : "") + e.title),
          ...(items.length > 2 ? ["+" + (items.length - 2)] : []),
        ].join(" ") + "; " + cal.formatDate(s, { weekday: "long" }) +
          (items.length ? `; ${items.length} įvykiai` : ""),
      );
      if (s.slice(0, 7) !== date.slice(0, 7)) b.classList.add("other-month");
      if (s === todayDate) b.classList.add("today");
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
      const inMonth = s.slice(0, 7) === date.slice(0, 7);
      if (inMonth) b.append(buildDayNote(s));
      td.append(b);
      if (!isMini && inMonth) td.append(noteButton(s));
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
    wrap.append(button, noteButton(s), buildDayNote(s));
    for (const h of dayHolidays(s)) {
      wrap.append(el(
        "p", "◆ " + h.name,
        h.classification === "commemoration" ? "commemoration-label" : "danger",
      ));
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
function renderWeekPlan() {
  const start = cal.addDays(selected, -cal.weekday(selected)),
    end = cal.addDays(start, 6),
    work = cal.workStats(start, end, data),
    next = cal.addWorkdays(selected, 1, data),
    nextLink = $("#plan-next-workday"),
    nextDate = nextLink.querySelector("time");
  const range = $("#plan-week-range");
  const rangeText = `${cal.formatDate(start, compactDate)}–${cal.formatDate(end, compactDate)} · ${cal.isoWeek(selected).week} ISO savaitė`;
  if (range.textContent !== rangeText) range.textContent = rangeText;
  $("#plan-week-days").textContent = work.days;
  $("#plan-week-hours").textContent = `${work.hours} val.`;
  $("#plan-week-balance").style.setProperty("--work-share", `${(100 * work.days) / 7}%`);
  $("#plan-week-rest").textContent = cal.countNoun(work.weekends + work.publicDays,
    "nedarbo diena", "nedarbo dienos", "nedarbo dienų");
  nextLink.hidden = next > "2100-12-31";
  nextLink.href = `/?data=${next}#calendar`;
  nextLink.dataset.date = next;
  nextDate.dateTime = next;
  nextDate.textContent = cal.formatDate(next, { year: undefined, weekday: "long" });
  const calculator = $("#plan-week-calculator");
  calculator.hidden = start < "1900-01-01" || end > "2100-12-31";
  calculator.href = `/datos-skaiciuokle/?nuo=${start}&iki=${end}&imtinai=1`;
}
function renderCalendar() {
  renderFilterChips();
  const y = +display.slice(0, 4),
    m = +display.slice(5, 7),
    todayDate = cal.today();
  $(".calendar-toolbar").dataset.periodView = view;
  $("#period-title").textContent =
    view === "year"
      ? `${y} metai`
      : view === "day"
        ? cal.formatDate(selected)
        : `${y} m. ${data.months[m - 1][1].toLocaleLowerCase("lt-LT")}`;
  $("#jump-year").value = y;
  $("#month-jump-year").textContent = y;
  $("#jump-month").value = view === "month" ? m : "";
  const publicShare = $("#share-public-calendar");
  publicShare.hidden = ![2027, 2028, 2029, 2030].includes(y);
  publicShare.dataset.shareKey = `calendar-${y}-${view === "year" ? 0 : m}`;
  publicShare.textContent = view === "year" ? "Pasidalyti metų kalendoriumi" : "Pasidalyti mėnesio kalendoriumi";
  const host = $("#calendar");
  host.dataset.calendarView = view;
  host.replaceChildren();
  if (view === "month") host.append(monthTable(display, false, todayDate));
  else if (view === "week")
    host.append(listDates(cal.addDays(selected, -cal.weekday(selected)), 7));
  else if (view === "day") host.append(listDates(selected, 1));
  else if (view === "agenda") host.append(listDates(display, 30));
  else {
    const grid = el("div", undefined, "year-app-grid");
    for (let month = 1; month <= 12; month++) {
      const d = `${y}-${String(month).padStart(2, "0")}-01`,
        section = el("section", undefined, "mini-calendar");
      section.append(el("h3", data.months[month - 1][1]), monthTable(d, true, todayDate));
      grid.append(section);
    }
    host.append(grid);
  }
  for (const b of document.querySelectorAll("[data-view]"))
    b.setAttribute("aria-pressed", String(b.dataset.view === view));
  renderWeekPlan();
  let last = `${y}-${String(m).padStart(2, "0")}-${cal.monthLength(y, m)}`,
    first = `${y}-${String(m).padStart(2, "0")}-01`;
  const remaining = cal.workStats(
    display > todayDate
      ? first
      : todayDate.slice(0, 7) === first.slice(0, 7)
        ? todayDate
        : first,
    last,
    data,
  );
  const monthH = calendarEntries(y).filter(
    (h) => h.date.slice(0, 7) === first.slice(0, 7),
  );
  $("#stats").replaceChildren(
    ...[
      [cal.isoWeek(todayDate).week, "Dabartinė ISO savaitė"],
      [
        remaining.days,
        display.slice(0, 7) === todayDate.slice(0, 7)
          ? "Liko darbo dienų"
          : "Darbo dienos mėnesį",
      ],
      [monthH.length, "Šventės ir atmintinos dienos"],
      [
        cal.difference(todayDate, `${+todayDate.slice(0, 4) + 1}-01-01`),
        "Iki Naujųjų metų",
      ],
    ].map(([n, label], index) => {
      const e = el("div", undefined, "stat");
      const art = el("span", undefined, "stat-art stat-art-" + index);
      const image = el("img", undefined, "shell-art");
      image.src = [
        "/assets/visuals/shell/calendar.svg",
        "/assets/visuals/shell/briefcase.svg",
        "/assets/visuals/shell/celebrations.svg",
        "/assets/visuals/shell/clock.svg",
      ][index];
      image.alt = "";
      image.width = 50;
      image.height = 50;
      image.decoding = "async";
      art.append(image);
      e.append(art, el("b", n), el("span", label));
      return e;
    }),
  );
  const list = el("ul");
  for (const h of monthH) {
    const li = el("li");
    li.classList.toggle("month-facts__commemoration", h.classification === "commemoration");
    const date = el("time", cal.formatDate(h.date, compactDate));
    date.dateTime = h.date;
    const name = el("button", h.name);
    name.type = "button";
    name.dataset.date = h.date;
    const copy = el("div");
    copy.append(
      name,
      el("small", h.classification === "commemoration"
        ? "Atmintina diena"
        : "Šventinė diena"),
    );
    li.append(date, copy);
    list.append(li);
  }
  $("#month-holidays").replaceChildren(
    monthH.length
      ? list
      : el("p", "Šį mėnesį šventinių ar atmintinų dienų nėra.", "muted"),
  );
  const currentYear = +todayDate.slice(0, 4);
  const facts = [
    ["Metų diena", cal.difference(`${currentYear}-01-01`, todayDate) + 1],
    ["Iki mėnesio pabaigos", cal.monthLength(currentYear, +todayDate.slice(5, 7)) - Number(todayDate.slice(8)) + " d."],
    ["Iki metų pabaigos", cal.difference(todayDate, `${currentYear}-12-31`) + " d."],
  ];
  $("#today-facts").replaceChildren(...facts.map(([label, value]) => {
    const fact = el("div");
    fact.append(el("dt", label), el("dd", value));
    return fact;
  }));
  const link = $("#current-download");
  link.hidden = false;
  if ([2027, 2028, 2029].includes(y)) {
    link.href = `/${y}/${data.months[m - 1][0]}/`;
    link.textContent = "Šio mėnesio PDF ir vaizdai →";
  } else if (y === 2030) {
    link.href = `/${y}/${data.months[m - 1][0]}/`;
    link.textContent = "Atverti ir spausdinti mėnesį →";
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
        name = el("strong", "◆ " + h.name),
        status = el(
          "small",
          h.classification === "commemoration"
          ? "Atmintinos dienos statusas pats savaime nesuteikia nedarbo dienos"
            : "Šventinė diena; paprastai nedirbama",
        );
      p.append(name, status);
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
        const row = el("div", undefined, "upcoming-event");
        const date = el("time", cal.formatDate(s));
        date.dateTime = s;
        row.append(date, item(e, s));
        upcoming.push(row);
      }
  }
  const upcomingList = $("#upcoming-events");
  upcomingList.replaceChildren(...upcoming);
  upcomingList.hidden = !upcoming.length;
  $("#upcoming-events-empty").hidden = Boolean(upcoming.length);
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
  renderReminders();
  renderCalendar();
  renderDetails();
}
const eventEditor = connectEventEditor(store, { onChange: render, announce: notice });
function showEvent(id) {
  eventEditor.open({ id, date: selected });
}
function composeHolidayFromLink() {
  const params = new URLSearchParams(location.search),
    slug = params.get("prideti"),
    date = params.get("data");
  if (!slug || !date) return;
  const article = editorialArticles.find((item) => item.slug === slug),
    dateShape = /^20\d{2}-\d{2}-\d{2}$/.test(date),
    dateYear = dateShape ? Number(date.slice(0, 4)) : 0,
    mapped = article && dateShape && [2027, 2028, 2029, 2030].includes(dateYear)
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
  eventEditor.open({
    date,
    title: article.title,
    description: article.category + ". Daugiau: https://kalendorius365.lt/sventes/" + slug + "/",
    allDay: true,
  });
}
$("#add-event").addEventListener("click", () => showEvent());
if (location.hash === "#add-event") requestAnimationFrame(() => showEvent());
document.addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b) return;
  if (b.dataset.noteEdit) { openDayNote(b.dataset.noteEdit); return; }
  if (b.dataset.date && b.closest("#month-holidays")) {
    if (selectDate(b.dataset.date)) $("#selected-title").focus();
  } else if (b.dataset.date) selectDate(b.dataset.date);
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
  refreshDayNote(noteDate, $("#daily-note").value);
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
$("#plan-next-workday").onclick = (event) => {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const date = event.currentTarget.dataset.date;
  if (selectDate(date)) $("#calendar").querySelector(`button[data-date="${date}"]`)?.focus();
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
$("#jump-month").onchange = (event) => {
  const month = Number(selected.slice(5, 7));
  const target = event.target;
  if (!selectDate(cal.shiftMonth(selected, Number(target.value) - month), "month"))
    target.value = view === "month" ? month : "";
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
const layerArt = ["personal", "work", "study", "health", "family", "birthday", "other"];
[
  { name: "Lietuvos šventės", index: -1 },
  ...data.categories.map((name, index) => ({ name, index })),
].forEach(({ name, index }) => {
  const label = el("label", undefined, "check"),
    c = el("input");
  c.type = "checkbox";
  c.checked = index < 0 ? showHolidays : visible[index];
  const art = index < 0 ? "holidays" : layerArt[index];
  const glyph = el("img", undefined, "layer-icon");
  glyph.src = "/assets/visuals/planner-icons.svg#" + art;
  glyph.alt = "";
  glyph.width = glyph.height = 37;
  glyph.decoding = "async";
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
const clockFormatters = new Map(),
  clockWeekdayFormatter = new Intl.DateTimeFormat("lt-LT", {
    timeZone: cal.TZ,
    weekday: "long",
  }),
  clockZoneFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: cal.TZ,
    timeZoneName: "short",
  });
let clockTimer = 0,
  lastClockDate = "",
  lastClockCity = "",
  lastClockMinute = "";
const clockElement = $("#clock"),
  clockDateElement = $("#clock-date"),
  clockWeekdayElement = $("#clock-weekday"),
  clockZoneElement = $("#clock-zone");
function tick() {
  clearTimeout(clockTimer);
  if (document.visibilityState !== "visible") return;
  const now = new Date();
  const seconds = $("#seconds").checked, hour12 = $("#hour12").checked,
    clockKey = `${seconds}:${hour12}`;
  if (!clockFormatters.has(clockKey)) clockFormatters.set(clockKey, new Intl.DateTimeFormat("lt-LT", {
    timeZone: cal.TZ, hour: "2-digit", minute: "2-digit",
    second: seconds ? "2-digit" : undefined, hour12,
  }));
  clockElement.textContent = clockFormatters.get(clockKey).format(now);
  clockElement.dataset.hour12 = hour12;
  const cityId = window.k365WeatherCity || DEFAULT_WEATHER_CITY;
  const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
  const updateMinute = minuteKey !== lastClockMinute,
    updateCity = cityId !== lastClockCity,
    currentDate = updateMinute || updateCity ? cal.today(now) : lastClockDate;
  if (updateMinute) lastClockMinute = minuteKey;
  if (currentDate !== lastClockDate || updateCity) {
    lastClockDate = currentDate;
    lastClockCity = cityId;
    clockDateElement.textContent = cal.formatDate(currentDate);
    clockDateElement.dateTime = currentDate;
    clockWeekdayElement.textContent = clockWeekdayFormatter.format(now);
    const cityName = WEATHER_CITY_BY_ID.get(cityId)?.name || "Vilnius";
    clockElement.setAttribute("aria-label", `Dabartinis ${cityName} laikas`);
  }
  if (updateMinute || updateCity) {
    const cityName = WEATHER_CITY_BY_ID.get(cityId)?.name || "Vilnius";
    clockZoneElement.textContent = cityName + " · " +
      clockZoneFormatter.formatToParts(now).find((part) => part.type === "timeZoneName").value;
  }
  const interval = seconds ? 1000 : 60_000;
  clockTimer = setTimeout(tick, interval - (now.getTime() % interval) + 5);
  if (lastToday !== currentDate) {
    lastToday = currentDate;
    renderCalendar();
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
$("#export-ics").onclick = () => {
  try { download("kalendorius365-ivykiai.ics", exportICS(store.data.events), "text/calendar;charset=utf-8"); }
  catch (error) { notice(error.message); }
};
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
const weatherCity = $("#weather-city");
let cityRequest = 0;
weatherCity.value = hasSavedCity ? savedCity : DEFAULT_WEATHER_CITY;
const syncWeatherCityPicker = enhanceWeatherCityPicker(weatherCity);
function applyWeatherCity(city) {
  window.k365WeatherCity = WEATHER_CITY_BY_ID.has(city)
    ? city
    : DEFAULT_WEATHER_CITY;
  weatherCity.value = window.k365WeatherCity;
  const place = WEATHER_CITY_BY_ID.get(weatherCity.value);
  const forecast = $("#home-city-forecast");
  forecast.href = `/orai/${place.id}/`;
  forecast.querySelector(".climate-link__label").textContent = `Orų prognozė · ${place.name}`;
  syncWeatherCityPicker?.();
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
    const detectedCity = WEATHER_CITY_BY_ID.has(result.city) ? result.city : DEFAULT_WEATHER_CITY;
    if (detectedCity !== window.k365WeatherCity) applyWeatherCity(detectedCity);
  } catch {
    if (requestId === cityRequest && window.k365WeatherCity !== DEFAULT_WEATHER_CITY)
      applyWeatherCity(DEFAULT_WEATHER_CITY);
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
composeHolidayFromLink();
tick();
const dashboard = $(".dashboard");
const calendarFilters = $(".calendar-filters");
const dayDetails = $("#day-details");
const compactCalendar = matchMedia("(max-width: 760px)");

function openLinkedDayDetails() {
  const target = document.getElementById(location.hash.slice(1));
  if (target && dayDetails.contains(target)) dayDetails.open = true;
}

function fitCalendarFilters() {
  calendarFilters.open = !compactCalendar.matches;
  dayDetails.open = !compactCalendar.matches || Boolean(cal.dateFromSearch(location.search));
  openLinkedDayDetails();
}

fitCalendarFilters();
compactCalendar.addEventListener("change", fitCalendarFilters);
window.addEventListener("hashchange", openLinkedDayDetails);
dashboard.removeAttribute("inert");
dashboard.setAttribute("aria-busy", "false");
$("#calendar-app-status").hidden = true;
setInterval(tick, 1000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") tick();
  else clearTimeout(clockTimer);
});
