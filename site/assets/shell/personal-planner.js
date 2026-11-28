import { connectPlannerReminders } from "./planner-reminders.js";
import * as calendar from "../calendar.js";
import { exportICS, importICS } from "../ics.js";
import { icon } from "../icons.js";
import { download, KEY, Store } from "../storage.js";
import { connectEventEditor } from "./event-editor.js";

const minDate = "1900-01-01";
const maxDate = "2100-12-31";
const priorities = {
  high: { label: "Aukštas", order: 0 },
  normal: { label: "Įprastas", order: 1 },
  low: { label: "Žemas", order: 2 },
};
const jsonType = "application/json";
const calendarType = "text/calendar;charset=utf-8";

function dateInRange(value) {
  if (!value || value < minDate || value > maxDate) return false;
  try { calendar.parse(value); return true; } catch { return false; }
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function time(date, short = false) {
  const node = element("time", short ? calendar.formatDate(date, { year: undefined }) : calendar.formatDate(date));
  node.dateTime = date;
  return node;
}

function actionButton(label, action, id, symbol) {
  const button = element("button", symbol ? undefined : label, symbol ? "personal-icon-button" : "personal-button");
  button.type = "button";
  button.dataset.personalAction = action;
  if (id) button.dataset.id = id;
  if (symbol) {
    button.setAttribute("aria-label", label);
    button.title = label;
    button.append(icon(symbol));
  }
  return button;
}

function eventsOn(events, date) {
  return events.filter((event) => calendar.occursOn(event, date)).map((event) => calendar.occurrence(event, date))
    .filter((event) => {
      if (event.allDay || event.repeat === "none") return true;
      try { calendar.zonedInstant(event.start); calendar.zonedInstant(event.end); return true; }
      catch { return false; }
    })
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
}

function eventTime(event, date) {
  if (event.allDay) return "Visa diena";
  const starting = event.start.slice(0, 10) === date;
  const ending = event.end.slice(0, 10) === date;
  if (starting && ending) return event.start.slice(11) + "–" + event.end.slice(11);
  if (starting) return "Nuo " + event.start.slice(11);
  return ending ? "Iki " + event.end.slice(11) : "Tęsiasi";
}

function weekEvents(plan) {
  const entries = new Map();
  for (const day of plan) {
    for (const event of day.events) {
      if (event.repeat === "none") entries.set(event.id, event);
      else {
        const id = event.id + "-" + day.date;
        entries.set(id, { ...event, id, repeat: "none", until: "" });
      }
    }
  }
  return [...entries.values()];
}

function allDayRecord(id, title, start, end, category, description) {
  return { id, title, start, end, category, description, allDay: true, important: false, repeat: "none", until: "" };
}

function connectPlanner(root) {
  const $ = (selector) => root.querySelector(selector);
  const $$ = (selector) => [...root.querySelectorAll(selector)];
  const data = JSON.parse(document.getElementById("personal-planner-data").textContent);
  const store = new Store();
  const renderReminders = connectPlannerReminders(store);
  const dateInput = $("#personal-date");
  const note = $("#daily-note");
  const noteStatus = $("[data-personal-note-status]");
  const agenda = $("[data-personal-agenda]");
  const weekDays = $("[data-personal-days]");
  const taskForm = $("[data-personal-task-form]");
  const taskStatus = $("[data-personal-task-status]");
  const taskList = $("[data-personal-tasks]");
  const transferStatus = $("[data-personal-transfer-status]");
  const settings = () => store.data.preferences.personalPlanner || {};
  const calendarEntries = calendar.createCalendarEntries(data, data.commemorations);
  const commemorationSlugs = new Map(data.commemorations.map(({ id, slug }) => [id, slug]));
  let selected = calendar.dateFromSearch(location.search) || (dateInRange(settings().date) ? settings().date : calendar.today());
  let filter = "open";
  let editingTask;
  let removedTask;
  let noteDirty = false;
  let noteTimer;
  let plan = [];

  function announce(message, target = transferStatus) {
    target.textContent = message;
  }

  function change(update, target = transferStatus) {
    try { store.update(update); return true; }
    catch (error) { announce(error.message, target); return false; }
  }

  function setPreference(key, value) {
    return change((next) => {
      next.preferences.personalPlanner = { ...next.preferences.personalPlanner, [key]: value };
    });
  }

  function loadNote() {
    note.value = store.data.notes[selected] || "";
    $("[data-personal-note-date]").replaceChildren(time(selected));
    noteStatus.textContent = note.value ? "Užrašas išsaugotas šioje naršyklėje." : "Išsaugoma automatiškai šioje naršyklėje.";
  }

  function saveNote() {
    clearTimeout(noteTimer);
    if (!noteDirty) return true;
    const value = note.value;
    if (!change((next) => {
      if (value) next.notes[selected] = value;
      else delete next.notes[selected];
    }, noteStatus)) {
      noteStatus.textContent = "Užrašo išsaugoti nepavyko. Nukopijuokite tekstą ir bandykite dar kartą.";
      return false;
    }
    noteDirty = false;
    noteStatus.textContent = "Užrašas išsaugotas šioje naršyklėje.";
    return true;
  }

  function selectDate(date, focusDay = false) {
    if (!dateInRange(date) || !saveNote()) {
      dateInput.value = selected;
      return;
    }
    selected = date;
    if (!store.locked) setPreference("date", date);
    const url = new URL(location.href);
    url.searchParams.set("data", date);
    history.replaceState(null, "", url);
    loadNote();
    if (!editingTask) taskForm.elements.date.value = date;
    render();
    if (focusDay) weekDays.querySelector('[data-date="' + date + '"]')?.focus({ preventScroll: true });
  }

  function makeWeek() {
    const monday = calendar.addDays(selected, -calendar.weekday(selected));
    return Array.from({ length: 7 }, (_, index) => {
      const date = calendar.addDays(monday, index);
      return {
        date,
        holidays: calendarEntries(Number(date.slice(0, 4))).filter((entry) => entry.date === date),
        events: eventsOn(store.data.events, date),
        tasks: store.data.tasks.filter((task) => task.date === date),
      };
    });
  }

  function renderWeek() {
    plan = makeWeek();
    const week = calendar.isoWeek(selected);
    const weekRange = $("[data-personal-week-range]");
    $("[data-personal-week-number]").textContent = week.year + " m. · " + week.week + " savaitė";
    const sameYear = plan[0].date.slice(0, 4) === plan[6].date.slice(0, 4);
    weekRange.replaceChildren(time(plan[0].date, sameYear), " – ", time(plan[6].date, sameYear));
    dateInput.value = selected;
    $("[data-personal-action=previous-week]").disabled = !dateInRange(calendar.addDays(selected, -7));
    $("[data-personal-action=next-week]").disabled = !dateInRange(calendar.addDays(selected, 7));
    const counts = [
      ["events", weekEvents(plan).length],
      ["open", plan.reduce((total, day) => total + day.tasks.filter((t) => !t.done).length, 0)],
      ["done", plan.reduce((total, day) => total + day.tasks.filter((t) => t.done).length, 0)],
    ];
    for (const [name, count] of counts) $('[data-personal-count="' + name + '"]').textContent = count;
    const current = calendar.today();
    weekDays.replaceChildren(...plan.map((day, index) => {
      const button = actionButton("", "day");
      button.dataset.date = day.date;
      button.setAttribute("aria-pressed", String(day.date === selected));
      button.disabled = !dateInRange(day.date);
      if (day.date === current) button.setAttribute("aria-current", "date");
      const count = calendar.countNoun(day.events.length, "įvykis", "įvykiai", "įvykių");
      const open = day.tasks.filter((task) => !task.done).length;
      const taskCount = calendar.countNoun(open, "neatlikta užduotis", "neatliktos užduotys", "neatliktų užduočių");
      button.setAttribute("aria-label", [calendar.formatDate(day.date, { weekday: "long" }), count, taskCount, ...day.holidays.map((holiday) => holiday.name)].join(", "));
      button.append(element("span", data.weekdays[index]), element("strong", Number(day.date.slice(8))), element("small", count));
      if (day.holidays.length) button.classList.add("has-holiday");
      return button;
    }));
    const active = plan.find((day) => day.date === selected);
    $("[data-personal-agenda-heading]").textContent = calendar.formatDate(selected, { weekday: "long", year: undefined });
    const entries = active.holidays.map((holiday) => {
      const row = element("li", undefined, "personal-agenda__holiday");
      const link = element("a", holiday.name);
      const slug = commemorationSlugs.get(holiday.id);
      link.href = slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? `/sventes/${slug}/` : "/sventes/";
      row.append(icon("holiday-flag"), link, element("small", holiday.classification === "statutory" ? "Šventinė diena" : "Atmintina diena"));
      return row;
    });
    for (const event of active.events) {
      const row = element("li", undefined, "personal-agenda__event");
      const edit = actionButton("", "edit-event", event.id);
      edit.setAttribute("aria-label", "Redaguoti įvykį " + event.title);
      edit.append(element("strong", event.title), element("small", data.categories[event.category] + (event.repeat === "none" ? "" : " · Kartojasi")));
      row.append(element("span", eventTime(event, selected), "personal-agenda__time"), edit);
      entries.push(row);
    }
    if (!active.events.length) entries.push(element("li", "Šiai dienai dar nėra asmeninių įvykių.", "personal-empty"));
    agenda.replaceChildren(...entries);
    const year = Number(selected.slice(0, 4));
    const slug = data.months[Number(selected.slice(5, 7)) - 1][0];
    const inCatalogue = year >= 2027 && year <= 2030 && /^[a-z]+$/.test(slug);
    $("#current-download").href = inCatalogue ? `/${year}/${encodeURIComponent(slug)}/` : "/menesiai/";
  }

  function resetTask() {
    editingTask = undefined;
    taskForm.reset();
    taskForm.elements.date.value = selected;
    $("[data-personal-task-submit]").textContent = "Pridėti užduotį";
    $("[data-personal-action=cancel-task]").hidden = true;
  }

  function renderTasks() {
    for (const button of $$("[data-personal-filter]")) button.setAttribute("aria-pressed", String(button.dataset.personalFilter === filter));
    const tasks = store.data.tasks.filter((task) => {
      if (filter === "done") return task.done;
      return !task.done && (filter !== "week" || (task.date >= plan[0].date && task.date <= plan[6].date));
    }).sort((a, b) => a.date.localeCompare(b.date) || priorities[a.priority || "normal"].order - priorities[b.priority || "normal"].order);
    const today = calendar.today();
    taskList.replaceChildren(...tasks.map((task) => {
      const row = element("li", undefined, "personal-task");
      const toggle = element("input");
      toggle.type = "checkbox";
      toggle.checked = task.done;
      toggle.dataset.taskToggle = task.id;
      toggle.setAttribute("aria-label", (task.done ? "Pažymėti kaip neatliktą: " : "Pažymėti kaip atliktą: ") + task.title);
      const copy = element("div", undefined, "personal-task__copy");
      const detail = element("div", undefined, "personal-task__detail");
      const priority = element("span", priorities[task.priority || "normal"].label, "personal-priority");
      priority.dataset.level = task.priority || "normal";
      detail.append(time(task.date, true), priority);
      if (!task.done && task.date < today) detail.append(element("span", "Terminas praėjo", "personal-overdue"));
      copy.append(element("strong", task.title), detail);
      const actions = element("div", undefined, "personal-task__actions");
      actions.append(
        actionButton("Planuoti laiką užduočiai " + task.title, "schedule-task", task.id, "calendar"),
        actionButton("Redaguoti užduotį " + task.title, "edit-task", task.id, "edit"),
        actionButton("Pašalinti užduotį " + task.title, "remove-task", task.id, "close"),
      );
      row.classList.toggle("is-done", task.done);
      row.append(toggle, copy, actions);
      return row;
    }));
    if (!tasks.length) {
      const message = { open: "Neatliktų užduočių nėra.", week: "Šią savaitę neatliktų užduočių nėra.", done: "Atliktos užduotys bus rodomos čia." };
      taskList.append(element("li", message[filter], "personal-empty"));
    }
    $("[data-personal-action=undo-task]").hidden = !removedTask;
  }

  function renderContext() {
    const topics = settings().topics ?? ["school", "admissions", "payments"];
    for (const input of $$("[data-personal-topic]")) {
      input.checked = Array.isArray(topics) && topics.includes(input.value);
      $('[data-personal-topic-panel="' + input.value + '"]').hidden = !input.checked;
    }
    for (const select of $$("[data-personal-preference]")) {
      const saved = settings()[select.dataset.personalPreference];
      select.value = [...select.options].some((entry) => entry.value === saved) ? saved : select.options[0].value;
    }
    $("[data-personal-school-dates]").replaceChildren(...schoolPeriods().map((period) => {
      const row = element("li");
      row.append(element("strong", period.name + " atostogos"), time(period.start, true), " – ", time(period.end, true));
      return row;
    }));
    const admission = selectedAdmission();
    $("[data-personal-admissions-info]").textContent = admission.info;
    const admissionLink = $("[data-personal-admissions-link]");
    let admissionUrl;
    try { admissionUrl = new URL(admission.url); } catch { /* The source link stays disabled. */ }
    if (admissionUrl?.origin === 'https://lamabpo.lt' || admissionUrl?.origin === 'https://www.mokausi.lt') {
      admissionLink.href = admissionUrl.href;
    } else {
      admissionLink.removeAttribute('href');
    }
    const payment = selectedPayment();
    const paymentDate = $("[data-personal-payment-date]");
    paymentDate.replaceChildren(time(payment.date));
    if (payment.note) paymentDate.append(" ", payment.note);
  }

  function schoolPeriods() {
    const grade = $("[data-personal-preference=grade]").value;
    const program = grade === "secondary" ? "Vidurinis ugdymas" : "Pradinis ir pagrindinis ugdymas";
    return data.school.periods.filter((period) => period.stage === "Visi mokiniai" || period.stage === program);
  }

  function selectedAdmission() {
    const id = $("[data-personal-preference=admissions]").value;
    return data.published.admissions.find((entry) => entry.id === id);
  }

  function selectedPayment() {
    const id = $("[data-personal-preference=payment]").value;
    return data.published.payments.find((entry) => entry.id === id);
  }

  function addPublishedEvents(events, status) {
    let added = 0;
    if (!change((next) => {
      for (const event of events) {
        if (next.events.some((existing) => existing.id === event.id)) continue;
        next.events.push(event);
        added += 1;
      }
    }, status)) return;
    announce(added ? "Į kalendorių pridėta: " + added + "." : "Šie įrašai jau yra kalendoriuje.", status);
    render();
  }

  function render() {
    renderReminders();
    renderWeek();
    renderTasks();
  }

  const editor = connectEventEditor(store, {
    onChange: render,
    announce: (message) => announce(message, $("[data-personal-agenda-status]")),
  });

  function openEditor(draft) {
    try { if (!store.locked) store.refresh(); } catch (error) { announce(error.message); }
    editor.open({ date: selected, ...draft });
  }

  function renderPrint() {
    renderWeek();
    const header = element("header");
    header.append(element("h1", "Savaitės planas"), element("p", $("[data-personal-week-number]").textContent));
    $("[data-personal-print]").replaceChildren(header, ...plan.map((day) => {
      const section = element("section");
      section.append(element("h2", calendar.formatDate(day.date, { weekday: "long" })));
      const rows = [
        ...day.holidays.map((holiday) => holiday.name),
        ...day.events.map((event) => eventTime(event, day.date) + " · " + event.title),
        ...day.tasks.map((task) => (task.done ? "✓ " : "□ ") + task.title),
      ];
      if (rows.length) {
        const list = element("ul");
        list.append(...rows.map((row) => element("li", row)));
        section.append(list);
      }
      if (store.data.notes[day.date]) section.append(element("p", store.data.notes[day.date], "personal-print__note"));
      if (!rows.length && !store.data.notes[day.date]) section.append(element("p", "Įrašų nėra."));
      return section;
    }));
  }

  function refreshBeforeExport() {
    if (!saveNote()) throw new Error("Pirmiausia išsaugokite dienos užrašą.");
    store.refresh();
  }

  function resetAfterReplace() {
    clearTimeout(noteTimer);
    noteDirty = false;
    removedTask = undefined;
    resetTask();
    loadNote();
    renderContext();
    render();
  }

  const icsInput = document.getElementById("ics-file");
  const jsonInput = document.getElementById("json-file");
  const restoreDialog = document.getElementById("restore-dialog");
  const deleteDialog = document.getElementById("delete-data-dialog");
  restoreDialog.querySelector("form").addEventListener("submit", (event) => {
    if (event.submitter?.value !== "restore") return;
    event.preventDefault();
    restoreDialog.close();
    jsonInput.click();
  });
  deleteDialog.querySelector("form").addEventListener("submit", (event) => {
    if (event.submitter?.value !== "delete") return;
    event.preventDefault();
    try {
      if (!store.locked) store.refresh();
      store.clearPersonalData();
      deleteDialog.close();
      resetAfterReplace();
      announce("Asmeniniai įrašai ištrinti iš šios naršyklės.");
    } catch (error) { deleteDialog.close(); announce(error.message); }
  });

  async function readFile(input, limit, apply) {
    const file = input.files[0];
    if (!file) return;
    try {
      if (file.size > limit) throw new Error("Failas per didelis.");
      await apply(await file.text());
    } catch (error) { announce(error.message); }
    finally { input.value = ""; }
  }
  jsonInput.addEventListener("change", () => readFile(jsonInput, 4e6, (raw) => {
    try { store.restore(raw); }
    catch (error) {
      if (error instanceof SyntaxError) throw new Error("Nepavyko perskaityti JSON kopijos.");
      throw error;
    }
    resetAfterReplace();
    announce("Atsarginė kopija atkurta.");
  }));
  icsInput.addEventListener("change", () => readFile(icsInput, 2e6, (raw) => {
    const result = importICS(raw);
    if (result.imported.length && !change((next) => next.events.push(...result.imported))) return;
    render();
    announce("Importuota: " + result.imported.length + ". Praleista: " + result.rejected.length + ". " + (result.rejected[0] || ""));
  }));

  const actions = {
    day: (button) => selectDate(button.dataset.date, true),
    "previous-week": () => selectDate(calendar.addDays(selected, -7)),
    "next-week": () => selectDate(calendar.addDays(selected, 7)),
    today: () => selectDate(calendar.today()),
    "add-event": () => openEditor(),
    "edit-event": (button) => openEditor({ id: button.dataset.id }),
    "save-note": () => { if (saveNote()) noteStatus.textContent = "Užrašas išsaugotas šioje naršyklėje."; },
    "cancel-task": () => { resetTask(); taskForm.elements.title.focus(); },
    "edit-task": (button) => {
      const task = store.data.tasks.find((entry) => entry.id === button.dataset.id);
      if (!task) return;
      editingTask = task.id;
      taskForm.elements.title.value = task.title;
      taskForm.elements.date.value = task.date;
      taskForm.elements.priority.value = task.priority || "normal";
      $("[data-personal-task-submit]").textContent = "Išsaugoti pakeitimus";
      $("[data-personal-action=cancel-task]").hidden = false;
      taskForm.elements.title.focus();
    },
    "schedule-task": async (button) => {
      const task = store.data.tasks.find((entry) => entry.id === button.dataset.id);
      if (!task) return;
      let id = "task-" + task.id;
      if (id.length > 100) {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(task.id));
        id = "task-" + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      }
      openEditor({ id, draftId: id, date: task.date, title: task.title.slice(0, 200) });
    },
    "remove-task": (button) => {
      const id = button.dataset.id;
      let task;
      if (!change((next) => {
        task = next.tasks.find((entry) => entry.id === id);
        next.tasks = next.tasks.filter((entry) => entry.id !== id);
      }, taskStatus) || !task) return;
      removedTask = task;
      if (editingTask === id) resetTask();
      render();
      announce("Užduotis pašalinta.", taskStatus);
      $("[data-personal-action=undo-task]").focus();
    },
    "undo-task": () => {
      if (!removedTask || !change((next) => {
        if (!next.tasks.some((task) => task.id === removedTask.id)) next.tasks.push(removedTask);
      }, taskStatus)) return;
      removedTask = undefined;
      render();
      announce("Užduotis atkurta.", taskStatus);
      $('[data-personal-filter="' + filter + '"]').focus();
    },
    "week-ics": () => {
      refreshBeforeExport();
      const week = makeWeek();
      download("kalendorius365-savaite-" + week[0].date + ".ics", exportICS(weekEvents(week)), calendarType);
      announce("Savaitės įvykių failas paruoštas.");
    },
    print: () => { refreshBeforeExport(); renderPrint(); window.print(); },
    backup: () => {
      if (store.locked && store.raw) {
        download("kalendorius365-neperskaityti-duomenys.json", store.raw, jsonType);
        return;
      }
      refreshBeforeExport();
      download("kalendorius365-kopija.json", JSON.stringify(store.data, null, 2), jsonType);
      announce("Atsarginė kopija paruošta.");
    },
    "import-ics": () => icsInput.click(),
    restore: () => restoreDialog.showModal(),
    "delete-data": () => deleteDialog.showModal(),
    "add-school": () => addPublishedEvents(schoolPeriods().map((period) =>
      allDayRecord("school-" + period.start, period.name + " atostogos", period.start, period.end, 2, "ŠMSM datos: " + data.school.source),
    ), $("[data-personal-school-status]")),
    "admissions-event": () => {
      const admission = selectedAdmission();
      openEditor({ title: admission.title, description: "Oficialūs terminai: " + admission.url, category: 2, allDay: true });
    },
    "add-payment": () => {
      const payment = selectedPayment();
      const description = [payment.note, "Paskelbtas „Sodros“ grafikas: " + data.published.payment_source].filter(Boolean).join("\n");
      addPublishedEvents([
        allDayRecord("sodra-" + payment.id + "-" + payment.date, payment.label, payment.date, payment.date, 6, description),
      ], $("[data-personal-payment-status]"));
    },
    "payment-event": () => openEditor({
      title: "Išmokos mokėjimo data",
      description: "Pasitikrinkite asmeninėje „Sodros“ paskyroje: https://gyventojai.sodra.lt/",
      category: 6,
      allDay: true,
    }),
  };

  root.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.personalFilter) {
      filter = button.dataset.personalFilter;
      renderTasks();
      return;
    }
    try { await actions[button.dataset.personalAction]?.(button); }
    catch (error) { announce(error.message); }
  });

  root.addEventListener("change", (event) => {
    const input = event.target;
    if (input.dataset.taskToggle) {
      const id = input.dataset.taskToggle;
      if (change((next) => {
        const task = next.tasks.find((entry) => entry.id === id);
        if (task) task.done = input.checked;
      }, taskStatus)) announce(input.checked ? "Užduotis atlikta." : "Užduotis pažymėta kaip neatlikta.", taskStatus);
      render();
      ($$("[data-task-toggle]").find((toggle) => toggle.dataset.taskToggle === id) || $('[data-personal-filter="' + filter + '"]')).focus();
    }
    if (input.hasAttribute("data-personal-topic")) {
      setPreference("topics", $$("[data-personal-topic]:checked").map((topic) => topic.value));
      renderContext();
    }
    if (input.dataset.personalPreference) {
      setPreference(input.dataset.personalPreference, input.value);
      renderContext();
    }
  });
  weekDays.addEventListener("keydown", (event) => {
    const day = event.target.closest("[data-date]");
    if (!day || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    selectDate(calendar.addDays(day.dataset.date, event.key === "ArrowLeft" ? -1 : 1), true);
  });
  dateInput.addEventListener("change", () => { if (dateInput.validity.valid) selectDate(dateInput.value); });
  taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = taskForm.elements;
    const title = fields.title.value.trim();
    if (!title || !dateInRange(fields.date.value)) return announce("Įrašykite užduotį ir pasirinkite galiojančią datą.", taskStatus);
    const values = { title, date: fields.date.value, priority: fields.priority.value };
    if (!change((next) => {
      const task = next.tasks.find((entry) => entry.id === editingTask);
      if (editingTask && !task) throw new Error("Ši užduotis jau pašalinta.");
      if (task) Object.assign(task, values);
      else next.tasks.push({ ...values, id: crypto.randomUUID(), done: false });
    }, taskStatus)) return;
    announce(editingTask ? "Užduotis atnaujinta." : "Užduotis pridėta.", taskStatus);
    resetTask();
    render();
    fields.title.focus();
  });
  note.addEventListener("input", () => {
    noteDirty = true;
    noteStatus.textContent = "Išsaugoma…";
    clearTimeout(noteTimer);
    noteTimer = setTimeout(saveNote, 300);
  });
  note.addEventListener("blur", saveNote);
  window.addEventListener("beforeunload", (event) => {
    if (!saveNote()) { event.preventDefault(); event.returnValue = ""; }
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) saveNote(); });
  window.addEventListener("beforeprint", () => { if (saveNote()) renderPrint(); });
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY && event.key !== null) return;
    try {
      store.refresh();
      if (!noteDirty) loadNote();
      renderContext();
      render();
    } catch (error) { announce(error.message); }
  });

  loadNote();
  resetTask();
  renderContext();
  render();
  if (store.error) announce(store.error);
  $("[data-personal-startup]").hidden = true;
  $("[data-personal-hero-actions]").inert = false;
  const workspace = $("[data-personal-workspace]");
  workspace.inert = false;
  workspace.setAttribute("aria-busy", "false");
  if (location.hash === "#add-event") openEditor();
}

const root = document.querySelector("[data-personal-planner]");
if (root) {
  try { connectPlanner(root); }
  catch (error) {
    root.querySelector("[data-personal-startup]").textContent = "Savaitės plano įkelti nepavyko. Atnaujinkite puslapį.";
    console.error(error);
  }
}
