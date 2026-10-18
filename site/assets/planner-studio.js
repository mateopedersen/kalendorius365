import { DAYS, dailySlotIndex, dailySlots, defaultStudioState, validateStudioState, weekDates } from "./planner-studio-core.js";

const THEMES = { forest: ["#08714c", "#e7f4ec"], blue: ["#28689a", "#eaf3fb"], amber: ["#9b6810", "#fbf2db"], mono: ["#353a37", "#f2f3f2"] };
const $ = (root, selector) => root.querySelector(selector);
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const localDate = (date) => date ? new Intl.DateTimeFormat("lt-LT", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z")) : "";
function setup(root) {
  const kind = root.dataset.kind;
  const form = $(root, "[data-studio-form]");
  const itemList = $(root, "[data-studio-items]");
  const status = $(root, "[data-studio-status]");
  const savedStatus = $(root, "[data-studio-save]");
  const key = "k365:planner-studio:" + kind + ":v1";
  const editingKey = key + ":editing";
  const names = kind === "family" ? ["Aš", "Šeima", "Vaikai", "Bendra"] : [];
  let previousWeekStart = Number($(root, '[data-studio-field="weekStart"]')?.value || 1);

  function personPicker(selectedValue) {
    const details = element("details", undefined, "planner-studio__people-picker"); details.dataset.taskPerson = "";
    const summary = element("summary");
    const shared = element("input"); shared.type = "checkbox"; shared.value = "shared"; shared.dataset.personOption = "";
    const sharedLabel = element("label", "Visai šeimai"); sharedLabel.prepend(shared);
    const chosen = Array.isArray(selectedValue) ? new Set(selectedValue.map(String)) : selectedValue === "shared" || selectedValue === undefined ? new Set() : new Set([String(selectedValue)]);
    shared.checked = selectedValue === "shared" || selectedValue === undefined;
    details.append(summary, sharedLabel);
    names.forEach((name, index) => {
      const input = element("input"); input.type = "checkbox"; input.value = String(index); input.dataset.personOption = ""; input.checked = chosen.has(String(index));
      const label = element("label", name || "Žmogus " + (index + 1)); label.prepend(input); details.append(label);
    });
    const refresh = () => {
      const active = Array.from(details.querySelectorAll('[data-person-option]:checked'), (input) => input.value);
      summary.textContent = shared.checked ? "Kam: visai šeimai" : active.length ? "Kam: " + active.map((index) => names[Number(index)] || ("Žmogus " + (Number(index) + 1))).join(", ") : "Kam: pasirinkite dalyvius";
    };
    shared.addEventListener("change", () => {
      if (shared.checked) details.querySelectorAll('[data-person-option]:not([value="shared"])').forEach((input) => { input.checked = false; });
      refresh(); update();
    });
    details.querySelectorAll('[data-person-option]:not([value="shared"])').forEach((input) => input.addEventListener("change", () => {
      if (input.checked) shared.checked = false;
      if (!details.querySelector('[data-person-option]:not([value="shared"]):checked')) shared.checked = true;
      refresh(); update();
    }));
    refresh();
    return details;
  }

  function readPerson(row) {
    const picker = row.querySelector("[data-task-person]");
    if (!picker || picker.querySelector('[data-person-option][value="shared"]')?.checked) return "shared";
    return Array.from(picker.querySelectorAll('[data-person-option]:checked'), (input) => Number(input.value));
  }

  function createTask(task = {}) {
    const row = element("div", undefined, "planner-studio__task");
    if (kind === "daily") {
      const timeLabel = element("label", "Nuo"), start = element("input");
      start.type = "time"; start.step = "900"; start.dataset.taskTime = ""; start.value = task.time || ""; timeLabel.append(start);
      const endLabel = element("label", "Iki"), end = element("input");
      end.type = "time"; end.step = "900"; end.dataset.taskEnd = ""; end.value = task.end || ""; endLabel.append(end);
      const nextLabel = element("label", "Pabaiga kitą dieną"), next = element("input");
      next.type = "checkbox"; next.dataset.taskNext = ""; next.checked = task.endNextDay === true; nextLabel.append(next);
      row.append(timeLabel, endLabel, nextLabel);
    } else {
      const dayLabel = element("label", "Diena"), day = element("select");
      day.dataset.taskDay = "";
      const count = Number($(root, '[data-studio-field="dayCount"]').value);
      const weekStart = Number($(root, '[data-studio-field="weekStart"]').value);
      for (let index = 0; index < count; index++) {
        const dayIndex = (weekStart + index) % 7;
        const option = element("option", DAYS[dayIndex]); option.value = String(index); option.selected = Number(task.day || 0) === index; day.append(option);
      }
      dayLabel.append(day);
      const timeLabel = element("label", "Laikas (nebūtina)"), time = element("input");
      time.type = "time"; time.dataset.taskTime = ""; time.value = task.time || ""; timeLabel.append(time);
      row.append(dayLabel, timeLabel);
      if (kind === "family") {
        const personField = element("fieldset", undefined, "planner-studio__task-people");
        personField.append(element("legend", "Dalyviai"), personPicker(task.person)); row.append(personField);
      }
    }
    const textLabel = element("label", "Veikla"), text = element("input");
    text.type = "text"; text.maxLength = 120; text.placeholder = "Ką norite nuveikti?"; text.dataset.taskText = ""; text.value = task.text || ""; textLabel.append(text);
    const remove = element("button", "Pašalinti", "planner-studio__remove");
    remove.type = "button"; remove.dataset.taskRemove = ""; remove.setAttribute("aria-label", "Pašalinti veiklą");
    row.append(textLabel, remove);
    row.addEventListener("input", update); row.addEventListener("change", update);
    remove.addEventListener("click", () => { row.remove(); update(); });
    itemList.append(row);
    return row;
  }

  function renderPeople(people = names) {
    const container = $(root, "[data-studio-people]");
    if (!container) return;
    const count = Number($(root, '[data-studio-field="peopleCount"]').value);
    names.splice(0, names.length, ...Array.from({ length: count }, (_, index) => String(people[index] ?? ("Žmogus " + (index + 1))).slice(0, 30)));
    container.replaceChildren();
    names.forEach((name, index) => {
      const label = element("label", "Žmogus " + (index + 1)), input = element("input");
      input.type = "text"; input.maxLength = 30; input.value = name; input.dataset.personName = String(index);
      input.addEventListener("input", () => {
        names[index] = input.value.slice(0, 30);
        for (const picker of itemList.querySelectorAll("[data-task-person]")) {
          const row = picker.closest(".planner-studio__task"), selected = readPerson(row);
          picker.replaceWith(personPicker(selected));
        }
        update();
      });
      label.append(input); container.append(label);
    });
    for (const picker of itemList.querySelectorAll("[data-task-person]")) {
      const value = readPerson(picker.closest(".planner-studio__task"));
      picker.replaceWith(personPicker(value));
    }
  }

  function readRaw() {
    const value = (name) => $(root, '[data-studio-field="' + name + '"]');
    const tasks = Array.from(itemList.querySelectorAll(".planner-studio__task"), (row) => ({
      text: row.querySelector("[data-task-text]").value.trim(),
      day: Number(row.querySelector("[data-task-day]")?.value || 0),
      time: row.querySelector("[data-task-time]")?.value || "",
      end: row.querySelector("[data-task-end]")?.value || "",
      endNextDay: row.querySelector("[data-task-next]")?.checked || false,
      person: readPerson(row),
    })).filter((task) => task.text);
    return {
      schema: 1, kind, title: value("title").value.trim(), date: value("date").value,
      weekStart: kind === "daily" ? 1 : Number(value("weekStart").value),
      dayCount: kind === "daily" ? 1 : Number(value("dayCount").value),
      start: kind === "daily" ? value("start").value : "08:00",
      end: kind === "daily" ? value("end").value : "20:00",
      endNextDay: kind === "daily" ? value("endNextDay").checked : false,
      step: kind === "daily" ? Number(value("step").value) : 30,
      peopleCount: kind === "family" ? Number(value("peopleCount").value) : 1,
      people: kind === "family" ? [...names] : ["Bendra"],
      theme: value("theme").value, layout: value("layout").value,
      priorities: [value("priority0").value, value("priority1").value, value("priority2").value],
      tasks, notes: value("notes").value, lowInk: value("lowInk").checked,
      paper: value("paper").value, orientation: value("orientation").value,
    };
  }

  function collect() {
    return validateStudioState(readRaw(), kind);
  }

  function restorePartial(raw) {
    const defaults = defaultStudioState(kind);
    const source = raw && typeof raw === "object" && raw.kind === kind ? raw : {};
    const validTime = (value) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    const validDate = (value) => {
      if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value)) return "";
      try { weekDates(value, 1, 1); return value; } catch { return ""; }
    };
    const peopleCount = kind === "family" && Number.isInteger(Number(source.peopleCount)) ? Math.min(8, Math.max(1, Number(source.peopleCount))) : defaults.peopleCount;
    const dayCount = kind === "daily" ? 1 : [5, 6, 7].includes(Number(source.dayCount)) ? Number(source.dayCount) : defaults.dayCount;
    const state = {
      ...defaults,
      title: typeof source.title === "string" ? source.title.slice(0, 80) : defaults.title,
      date: validDate(source.date),
      weekStart: [0, 1].includes(Number(source.weekStart)) ? Number(source.weekStart) : defaults.weekStart,
      dayCount,
      start: validTime(source.start) ? source.start : defaults.start,
      end: validTime(source.end) ? source.end : defaults.end,
      endNextDay: source.endNextDay === true,
      step: [15, 30, 60].includes(Number(source.step)) ? Number(source.step) : defaults.step,
      peopleCount,
      people: Array.from({ length: peopleCount }, (_, index) => typeof source.people?.[index] === "string" ? source.people[index].slice(0, 30) : defaults.people[index] || ("Žmogus " + (index + 1))),
      theme: ["forest", "blue", "amber", "mono"].includes(source.theme) ? source.theme : defaults.theme,
      layout: (kind === "family" ? ["people", "shared"] : ["time", "priority"]).includes(source.layout) ? source.layout : defaults.layout,
      priorities: Array.isArray(source.priorities) ? Array.from({ length: 3 }, (_, index) => typeof source.priorities[index] === "string" ? source.priorities[index].slice(0, 90) : "") : defaults.priorities,
      tasks: Array.isArray(source.tasks) ? source.tasks.slice(0, 40).filter((task) => task && typeof task === "object" && typeof task.text === "string").map((task) => ({
        text: task.text.slice(0, 120), day: Math.min(dayCount - 1, Math.max(0, Number.isInteger(Number(task.day)) ? Number(task.day) : 0)),
        time: validTime(task.time) ? task.time : "", end: validTime(task.end) ? task.end : "",
        endNextDay: task.endNextDay === true,
        person: kind === "family" && Array.isArray(task.person)
          ? [...new Set(task.person.map(Number).filter((index) => Number.isInteger(index) && index >= 0 && index < peopleCount))]
          : kind === "family" && task.person !== "shared" && Number.isInteger(Number(task.person)) && Number(task.person) >= 0 && Number(task.person) < peopleCount ? Number(task.person) : "shared",
      })) : [],
      notes: typeof source.notes === "string" ? source.notes.slice(0, 1200) : defaults.notes,
      lowInk: source.lowInk === true,
      paper: ["A4", "A3", "A5"].includes(source.paper) ? source.paper : defaults.paper,
      orientation: ["portrait", "landscape"].includes(source.orientation) ? source.orientation : defaults.orientation,
    };
    for (const name of ["title", "date", "weekStart", "dayCount", "start", "end", "endNextDay", "step", "peopleCount", "theme", "layout", "notes", "lowInk", "paper", "orientation"]) setValue(name, state[name]);
    state.priorities.forEach((value, index) => setValue("priority" + index, value));
    renderPeople(state.people);
    itemList.replaceChildren(); state.tasks.forEach((task) => createTask(task));
    try { render(validateStudioState(state, kind)); }
    catch { render(defaults); }
  }

  function setValue(name, value) {
    const node = $(root, '[data-studio-field="' + name + '"]');
    if (node) {
      if (node.type === "checkbox") node.checked = value === true;
      else node.value = value ?? "";
    }
  }

  function cell(tasks, label = (task) => (task.time ? task.time + " · " : "") + task.text) {
    const td = element("td");
    tasks.forEach((task) => td.append(element("div", label(task))));
    if (!tasks.length) td.classList.add("is-blank");
    return td;
  }

  function render(state) {
    const colors = THEMES[state.theme] || THEMES.forest;
    const sheet = $(root, "[data-studio-sheet]");
    sheet.style.setProperty("--studio-accent", colors[0]);
    sheet.style.setProperty("--studio-soft", state.lowInk ? "#fff" : colors[1]);
    sheet.classList.toggle("is-low-ink", state.lowInk);
    $(root, "[data-studio-title]").textContent = state.title || (kind === "family" ? "Mūsų savaitė" : kind === "daily" ? "Mano diena" : "Savaitės planas");
    let range = "";
    if (state.date) {
      if (kind === "daily") range = localDate(state.date);
      else { const dates = weekDates(state.date, state.weekStart, state.dayCount); range = localDate(dates[0]) + " – " + localDate(dates.at(-1)); }
    } else range = kind === "daily" ? "Nedatuota diena" : "Nedatuota savaitė";
    if (kind === "daily" && state.endNextDay) range += " · pabaiga kitą dieną";
    $(root, "[data-studio-dates]").textContent = range;
    const target = $(root, "[data-studio-preview]");
    target.replaceChildren();
    if (state.layout === "priority") {
      const section = element("section", undefined, "planner-sheet__priorities");
      section.append(element("h4", "Trys svarbiausi darbai"));
      const list = element("ol");
      state.priorities.forEach((text) => { const item = element("li", text || ""); if (!text) item.classList.add("is-blank"); list.append(item); });
      section.append(list); target.append(section);
    }
    if (kind === "daily") {
      const schedule = element("div", undefined, "planner-sheet__daily");
      schedule.append(element("h4", "Dienos laiko juosta · " + state.start + "–" + state.end + " · " + state.step + " min."));
      const list = element("ol", undefined, "planner-sheet__time-list");
      const slots = dailySlots(state.start, state.end, state.step, state.endNextDay);
      const positionedTasks = state.tasks.map((task) => ({ task, slot: dailySlotIndex(task, state.start, state.end, state.step, state.endNextDay) }));
      const placed = new Set();
      slots.forEach(({ label, dayOffset }, slotIndex) => {
        const row = element("li"), time = element("time", label + (dayOffset ? " +" : ""));
        row.append(time);
        const tasks = positionedTasks.filter((item) => item.slot === slotIndex).map((item) => item.task);
        tasks.forEach((task) => placed.add(task));
        const content = element("span", tasks.map((task) => (task.time === label ? "" : task.time + " · ") + task.text + (task.end ? " · iki " + task.end + (task.endNextDay ? " (kitą dieną)" : "") : "")).join("; "));
        if (!content.textContent) content.classList.add("is-blank");
        row.append(content); list.append(row);
      });
      schedule.append(list);
      const untimed = state.tasks.filter((task) => !task.time);
      if (untimed.length) schedule.append(element("p", "Lankstūs darbai: " + untimed.map((task) => task.text).join(" · "), "planner-sheet__untimed"));
      const outside = state.tasks.filter((task) => task.time && !placed.has(task));
      if (outside.length) {
        const extra = element("section", undefined, "planner-sheet__outside");
        extra.append(element("h4", "Už pasirinkto laiko ribų"));
        const extraList = element("ul");
        outside.forEach((task) => extraList.append(element("li", task.time + " · " + task.text + (task.end ? " · iki " + task.end : ""))));
        extra.append(extraList); schedule.append(extra);
      }
      target.append(schedule);
    } else if (kind === "family") {
      const dates = state.date ? weekDates(state.date, state.weekStart, state.dayCount) : [];
      const table = element("table", undefined, "planner-sheet__family");
      const head = element("thead"), headRow = element("tr");
      headRow.append(element("th", "Diena"));
      const columns = [
        ...(state.layout === "shared" ? [{ person: "shared", name: "Bendra" }] : []),
        ...names.map((name, index) => ({ person: index, name: name || ("Žmogus " + (index + 1)) })),
        ...(state.layout === "people" ? [{ person: "shared", name: "Bendra" }] : []),
      ];
      columns.forEach(({ name }) => headRow.append(element("th", name)));
      head.append(headRow); table.append(head);
      const body = element("tbody");
      for (let day = 0; day < state.dayCount; day++) {
        const row = element("tr"), dayIndex = (state.weekStart + day) % 7;
        row.append(element("th", DAYS[dayIndex] + (dates[day] ? " · " + localDate(dates[day]) : "")));
        columns.forEach(({ person }) => {
          const tasks = state.tasks.filter((task) => task.day === day && (person === "shared" ? task.person === "shared" || Array.isArray(task.person) : !Array.isArray(task.person) && Number(task.person) === person));
          row.append(cell(tasks, (task) => (task.time ? task.time + " · " : "") + task.text + (Array.isArray(task.person) ? " · " + task.person.map((index) => names[index] || ("Žmogus " + (index + 1))).join(", ") : "")));
        });
        body.append(row);
      }
      table.append(body); target.append(table);
    } else {
      const dates = state.date ? weekDates(state.date, state.weekStart, state.dayCount) : [];
      const grid = element("div", undefined, "planner-sheet__days");
      for (let day = 0; day < state.dayCount; day++) {
        const dayIndex = (state.weekStart + day) % 7;
        const card = element("section", undefined, "planner-sheet__day");
        card.append(element("h4", DAYS[dayIndex]), element("time", dates[day] ? localDate(dates[day]) : "Data nepasirinkta"));
        const list = element("ul"), tasks = state.tasks.filter((task) => task.day === day);
        for (const task of tasks) list.append(element("li", (task.time ? task.time + " · " : "") + task.text));
        for (let blank = tasks.length; blank < 3; blank++) list.append(element("li", "", "is-blank"));
        card.append(list); grid.append(card);
      }
      target.append(grid);
    }
    if (state.notes) {
      const notes = element("section", undefined, "planner-sheet__notes");
      notes.append(element("h4", "Pastabos"), element("p", state.notes)); target.append(notes);
    }
    let pageStyle = document.getElementById("planner-studio-page-size");
    if (!pageStyle) { pageStyle = element("style"); pageStyle.id = "planner-studio-page-size"; document.head.append(pageStyle); }
    pageStyle.textContent = "@media print{@page{size:" + state.paper + " " + state.orientation + ";margin:8mm}}";
  }

  function applyState(value, announce = false) {
    const state = validateStudioState(value, kind);
    for (const name of ["title","date","weekStart","dayCount","start","end","endNextDay","step","peopleCount","theme","layout","notes","lowInk","paper","orientation"]) if (state[name] !== undefined) setValue(name, state[name]);
    for (const name of ["priority0","priority1","priority2"]) setValue(name, state.priorities[Number(name.slice(-1))] || "");
    renderPeople(state.people);
    itemList.replaceChildren();
    state.tasks.forEach((task) => createTask(task));
    render(state);
    previousWeekStart = state.weekStart;
    if (announce) status.textContent = "Juodraštis atkurtas šiame įrenginyje.";
  }

  let saveTimer;
  function update() {
    try {
      const state = collect();
      render(state);
      savedStatus.textContent = "Išsaugoma…";
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try {
          localStorage.setItem(key, JSON.stringify(state));
          localStorage.removeItem(editingKey);
          savedStatus.textContent = "Išsaugota šiame įrenginyje";
          status.textContent = "Peržiūra atnaujinta; juodraštis saugomas šiame įrenginyje.";
          status.setAttribute("role", "status");
        } catch {
          savedStatus.textContent = "Nepavyko išsaugoti";
          status.textContent = "Juodraščio išsaugoti nepavyko. Atsisiųskite JSON kopiją prieš uždarydami puslapį.";
          status.setAttribute("role", "alert");
        }
      }, 350);
    } catch (error) {
      status.textContent = error.message || "Patikrinkite įvestus duomenis.";
      status.setAttribute("role", "alert");
      try {
        localStorage.setItem(editingKey, JSON.stringify(readRaw()));
        savedStatus.textContent = "Netinkami įvesties pakeitimai išsaugoti atkūrimui";
      } catch {
        savedStatus.textContent = "Juodraščio atkūrimo kopijos išsaugoti nepavyko";
      }
    }
  }

  function sample() {
    const state = defaultStudioState(kind);
    state.date = "2027-01-04";
    state.title = kind === "daily" ? "Pirmadienio planas" : kind === "family" ? "Mūsų savaitė" : "Savaitė su aiškia kryptimi";
    state.priorities = ["Svarbiausias darbas", "Trumpas pasivaikščiojimas", "Pasiruošti rytojui"];
    state.notes = "Palikti laiko poilsiui ir netikėtumams.";
    state.tasks = kind === "daily"
      ? [{ time: "09:00", end: "10:00", text: "Savaitės planavimas" }, { time: "13:30", end: "14:00", text: "Pietūs ir pertrauka" }, { text: "Užrašyti kitos dienos mintis" }]
      : kind === "family"
        ? [{ day: 0, person: 0, text: "Mokykla" }, { day: 1, person: 1, text: "Maisto pirkimas" }, { day: 4, person: "shared", text: "Bendra vakarienė" }]
        : [{ day: 0, time: "09:00", text: "Savaitės planavimas" }, { day: 2, time: "14:00", text: "Susitikimas" }, { day: 5, text: "Poilsis" }];
    applyState(state); update(); status.textContent = "Pavyzdys įkeltas. Pakeiskite jį savo planais.";
  }

  form.addEventListener("submit", (event) => event.preventDefault());
  form.addEventListener("input", update);
  form.addEventListener("change", (event) => {
    if (kind === "family" && event.target.matches('[data-studio-field="peopleCount"]')) {
      const assigned = Array.from(itemList.querySelectorAll(".planner-studio__task"))
        .filter((row) => row.querySelector("[data-task-text]").value.trim())
        .flatMap((row) => {
          const person = readPerson(row);
          return person === "shared" ? [] : (Array.isArray(person) ? person : [person]).map((index) => Number(index) + 1);
        });
      const requiredCount = Math.max(1, ...assigned);
      if (Number(event.target.value) < requiredCount) {
        event.target.value = String(requiredCount);
        status.textContent = "Žmonių skaičiaus nemažinome: plane yra veiklų, priskirtų pašalinamam stulpeliui.";
      }
      renderPeople(names);
    }
    if (kind !== "daily" && event.target.matches('[data-studio-field="dayCount"], [data-studio-field="weekStart"]')) {
      const dayCountField = $(root, '[data-studio-field="dayCount"]');
      if (event.target.matches('[data-studio-field="dayCount"]')) {
        const taskDays = Array.from(itemList.querySelectorAll(".planner-studio__task"))
          .filter((row) => row.querySelector("[data-task-text]").value.trim())
          .map((row) => Number(row.querySelector("[data-task-day]")?.value || 0) + 1);
        const requiredCount = Math.max(5, ...taskDays);
        if (Number(event.target.value) < requiredCount) {
          event.target.value = String(requiredCount);
          status.textContent = "Dienų skaičiaus nemažinome: plane yra veiklų vėlesnėmis savaitės dienomis.";
        }
      } else {
        const nextWeekStart = Number(event.target.value);
        const count = Number(dayCountField.value);
        const rows = Array.from(itemList.querySelectorAll(".planner-studio__task"));
        const movedDays = rows.map((row) => {
          const oldDay = Number(row.querySelector("[data-task-day]")?.value || 0);
          const weekday = (previousWeekStart + oldDay) % 7;
          return (weekday - nextWeekStart + 7) % 7;
        });
        if (movedDays.some((day) => day >= count)) {
          dayCountField.value = "7";
          status.textContent = "Rodome visas 7 dienas, kad pakeitus savaitės pradžią nė viena veikla nedingtų.";
        }
        rows.forEach((row, index) => {
          const task = { day: movedDays[index], time: row.querySelector("[data-task-time]")?.value || "", text: row.querySelector("[data-task-text]")?.value || "", person: readPerson(row) };
          row.replaceWith(createTask(task));
        });
        previousWeekStart = nextWeekStart;
      }
      for (const row of itemList.querySelectorAll(".planner-studio__task")) {
        const task = { day: row.querySelector("[data-task-day]")?.value || 0, time: row.querySelector("[data-task-time]")?.value || "", text: row.querySelector("[data-task-text]")?.value || "", person: readPerson(row) };
        const replacement = createTask(task); row.replaceWith(replacement);
      }
    }
    update();
  });
  $(root, "[data-studio-add]").addEventListener("click", () => {
    if (itemList.children.length >= 40) { status.textContent = "Viename plane galima turėti iki 40 veiklų."; return; }
    createTask().querySelector("[data-task-text]").focus(); update();
  });
  $(root, "[data-studio-sample]").addEventListener("click", sample);
  $(root, "[data-studio-print]").addEventListener("click", () => {
    try { update(); validateStudioState(collect(), kind); window.print(); }
    catch (error) { status.textContent = error.message; status.setAttribute("role", "alert"); }
  });
  $(root, "[data-studio-clear]").addEventListener("click", () => {
    if (!window.confirm("Išvalyti šio planuoklio juodraštį šiame įrenginyje?")) return;
    applyState(defaultStudioState(kind));
    try { localStorage.removeItem(key); localStorage.removeItem(editingKey); savedStatus.textContent = "Juodraštis išvalytas"; status.textContent = "Juodraštis išvalytas."; }
    catch { status.textContent = "Juodraščio išvalyti nepavyko."; status.setAttribute("role", "alert"); }
  });
  $(root, "[data-studio-export]").addEventListener("click", () => {
    try {
      let draft;
      try { draft = collect(); }
      catch { draft = { ...readRaw(), incomplete: true }; }
      const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob); link.download = "planuoklis-" + kind + ".json"; link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      status.textContent = "Juodraščio kopija paruošta atsisiųsti.";
    } catch (error) { status.textContent = error.message; status.setAttribute("role", "alert"); }
  });
  const fileInput = $(root, "[data-studio-import]");
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      if (file.size > 100000) throw new TypeError("Juodraščio failas per didelis (daugiausia 100 KB).");
      const imported = JSON.parse(await file.text());
      if (imported?.incomplete === true && imported.kind === kind) {
        restorePartial(imported); localStorage.setItem(editingKey, JSON.stringify(imported)); update();
        savedStatus.textContent = "Atkurtas juodraštis; patikrinkite pažymėtą lauką";
      } else {
        const state = validateStudioState(imported, kind);
        applyState(state); localStorage.setItem(key, JSON.stringify(state)); localStorage.removeItem(editingKey);
        savedStatus.textContent = "Juodraštis atkurtas"; status.textContent = "Juodraštis atkurtas ir išsaugotas šiame įrenginyje.";
      }
    } catch (error) { status.textContent = error.message || "Juodraščio nepavyko atkurti."; status.setAttribute("role", "alert"); }
    finally { fileInput.value = ""; }
  });
  let state = defaultStudioState(kind);
  try {
    const raw = localStorage.getItem(key);
    if (raw) state = validateStudioState(JSON.parse(raw), kind);
  } catch { status.textContent = "Ankstesnis juodraštis neatpažintas; pradėkite naują planą arba atkurkite JSON kopiją."; status.setAttribute("role", "alert"); }
  let pending = null;
  try { pending = JSON.parse(localStorage.getItem(editingKey) || "null"); } catch { /* keep the last valid local draft */ }
  if (pending?.kind === kind) {
    restorePartial(pending); update();
    status.textContent = "Atkurtas ir taisomas juodraštis. Pataisykite įvestį; ankstesnė teisinga kopija lieka išsaugota.";
    status.setAttribute("role", "alert");
    savedStatus.textContent = "Neužbaigtas juodraštis atkurtas šiame įrenginyje";
  } else {
    if (kind === "family") names.splice(0, names.length, ...state.people);
    applyState(state);
    savedStatus.textContent = state.tasks.length || state.title || state.notes ? "Atkurtas juodraštis šiame įrenginyje" : "Juodraštis dar neišsaugotas";
  }
}

for (const root of document.querySelectorAll("[data-planner-studio]")) setup(root);
