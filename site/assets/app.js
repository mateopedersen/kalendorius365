import * as cal from "./calendar.js";
import { Store, download } from "./storage.js";
import { exportICS, importICS } from "./ics.js";
import { notice } from "./common.js";
import { renderWeather } from "./weather.js";
const $ = (s) => document.querySelector(s),
  el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
const data = await fetch("/assets/data/calendar.json")
  .then((r) => {
    if (!r.ok) throw Error("Nepavyko įkelti kalendoriaus");
    return r.json();
  })
  .catch((e) => {
    notice(e.message);
    throw e;
  });
const store = new Store();
if (store.error) notice(store.error);
let selected = cal.today(),
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
let lastToday = selected,
  noteDate = selected,
  noteDirty = false;
const hs = (y) => cal.holidays(y, data),
  dayHolidays = (s) =>
    showHolidays ? hs(+s.slice(0, 4)).filter((h) => h.date === s) : [];
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
function saveNote(silent = false) {
  const text = $("#daily-note").value;
  if (text === (store.data.notes[noteDate] || "")) return true;
  if (
    !transact((d) => {
      if (text) d.notes[noteDate] = text;
      else delete d.notes[noteDate];
    })
  )
    return false;
  noteDirty = false;
  $("#note-status").textContent = "Išsaugota šioje naršyklėje";
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
      if (holiday.length) b.classList.add("holiday");
      b.append(el("span", +s.slice(8), "day-number"));
      if (!isMini) {
        for (const h of holiday)
          b.append(el("span", "◆ " + h.name, "holiday-label"));
        for (const e of items.slice(0, 2))
          b.append(
            el("span", (e.important ? "! " : "") + e.title, "event-chip"),
          );
        if (items.length > 2) b.append(el("small", "+" + (items.length - 2)));
      }
      td.append(b);
    }
  }
  return table;
}
function item(e, date) {
  const entry = el("div", undefined, "agenda-entry"),
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
  const edit = el("button", "Keisti");
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
    for (const h of dayHolidays(s))
      wrap.append(el("p", "◆ " + h.name, "danger"));
    const es = events(s);
    if (!es.length && count < 8)
      wrap.append(el("p", "Įvykių nėra.", "empty-state"));
    for (const e of es) wrap.append(item(e, s));
  }
  return wrap;
}
function renderCalendar() {
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
  const monthH = hs(y).filter((h) => h.date.slice(0, 7) === first.slice(0, 7));
  $("#stats").replaceChildren(
    ...[
      [cal.isoWeek(cal.today()).week, "Dabartinė ISO savaitė"],
      [
        remaining.days,
        display.slice(0, 7) === cal.today().slice(0, 7)
          ? "Liko darbo dienų"
          : "Darbo dienos mėnesį",
      ],
      [monthH.length, "Šventinės dienos"],
      [
        cal.difference(cal.today(), `${+cal.today().slice(0, 4) + 1}-01-01`),
        "Iki Naujųjų metų",
      ],
    ].map(([n, label]) => {
      const e = el("div", undefined, "stat");
      e.append(el("b", n), el("span", label));
      return e;
    }),
  );
  const list = el("ul");
  for (const h of monthH)
    list.append(el("li", `${cal.formatDate(h.date)} — ${h.name}`));
  $("#month-holidays").replaceChildren(
    monthH.length
      ? list
      : el("p", "Šį mėnesį įstatyme nustatytų šventinių dienų nėra.", "muted"),
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
    ...dayHolidays(selected).map((h) =>
      el("p", "◆ " + h.name, "source-note danger"),
    ),
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
  $("#note-status").textContent = "Saugoma tik šioje naršyklėje.";
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
  $("#tasks").replaceChildren(
    ...ts.map((t) => {
      const row = el("div", undefined, "task-entry" + (t.done ? " done" : "")),
        label = el("label", undefined, "check"),
        c = el("input");
      c.type = "checkbox";
      c.checked = t.done;
      c.dataset.taskToggle = t.id;
      label.append(c, document.createTextNode(t.title));
      const edit = el("button", "Keisti");
      edit.dataset.taskEdit = t.id;
      edit.setAttribute("aria-label", "Redaguoti užduotį " + t.title);
      const del = el("button", "×");
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
$("#event-form").elements.allDay.addEventListener("change", updateEventTimeFields);
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
  $("#note-status").textContent = "Neišsaugoti pakeitimai";
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
  { name: "◆ Lietuvos šventės", index: -1 },
  ...data.categories.map((name, index) => ({ name, index })),
].forEach(({ name, index }) => {
  const label = el("label", undefined, "check"),
    c = el("input");
  c.type = "checkbox";
  c.checked = index < 0 ? showHolidays : visible[index];
  label.append(
    c,
    el("span", undefined, "dot cat" + Math.max(0, index)),
    document.createTextNode(name),
  );
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
  $("#clock-zone").textContent =
    "Vilnius · " +
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
    items = [...hs(year), ...hs(year + 1)]
      .filter((h) => h.date >= now)
      .slice(0, 4);
  $("#upcoming-holidays").replaceChildren(
    ...items.map((h) => {
      const li = el("li"),
        date = el("span", h.date.slice(5).replace("-", "."), "holiday-date"),
        text = el("div"),
        a = el("button", h.name);
      a.dataset.date = h.date;
      a.className = "holiday-select";
      text.append(
        a,
        el(
          "small",
          (cal.difference(now, h.date) === 0
            ? "Šiandien"
            : `Liko ${cal.difference(now, h.date)} d.`) + " · Šventinė diena",
        ),
      );
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
weatherCity.value = store.data.preferences.city || "vilnius";
weatherCity.onchange = () => {
  pref("city", weatherCity.value);
  renderWeather(weatherCity.value);
};
renderWeather(weatherCity.value);
setInterval(() => {
  if (document.visibilityState === "visible") renderWeather(weatherCity.value);
}, 1200000);
render();
renderHolidayList();
tick();
setInterval(tick, 1000);
