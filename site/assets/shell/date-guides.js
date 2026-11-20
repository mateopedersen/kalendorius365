import { addDays, difference, formatDate, isoWeek, isoWeekRange, today, upcomingCalendarEntries, zonedInstant } from "../calendar.js";

const countdown = document.querySelector("[data-countdown]");
if (countdown) {
  const form = countdown.querySelector("form");
  const preset = form.elements.preset;
  const report = countdown.querySelector("[data-countdown-result]");
  const title = countdown.querySelector("[data-countdown-name]");
  const detailLink = countdown.querySelector("[data-countdown-link]");
  const values = [...countdown.querySelectorAll("[data-countdown-unit]")];
  const entries = new Map();
  let timer;
  if (!form.elements.date.value) form.elements.date.value = addDays(today(), 1);

  function start(entry) {
    clearInterval(timer);
    try {
      const name = form.elements.event.value.trim();
      const date = form.elements.date.value;
      const time = form.elements.time.value;
      const finish = zonedInstant(date + "T" + time);
      title.textContent = name || "Kiek laiko liko?";
      report.textContent = formatDate(date, { weekday: "long" }) + " · " + time;
      detailLink.hidden = !entry;
      if (entry) detailLink.href = entry.href;

      function update() {
        const remaining = Math.max(0, Math.ceil((finish - Date.now()) / 1000));
        const parts = [Math.floor(remaining / 86400), Math.floor(remaining / 3600) % 24, Math.floor(remaining / 60) % 60, remaining % 60];
        values.forEach((item, index) => { item.textContent = String(parts[index]).padStart(2, "0"); });
        if (!remaining) {
          report.textContent = name ? `„${name}“ laikas jau atėjo.` : "Pasirinktas laikas jau atėjo.";
          clearInterval(timer);
        }
        return remaining > 0;
      }
      if (update()) timer = setInterval(update, 1000);
    } catch (error) {
      detailLink.hidden = true;
      report.textContent = error.message;
      values.forEach((item) => { item.textContent = "·"; });
    }
  }

  preset.addEventListener("change", () => {
    const entry = entries.get(preset.value);
    if (!entry) {
      form.elements.event.focus();
      return;
    }
    form.elements.event.value = entry.name;
    form.elements.date.value = entry.date;
    form.elements.time.value = "00:00";
    start(entry);
  });
  for (const field of [form.elements.date, form.elements.event]) {
    field.addEventListener("input", () => { preset.value = ""; });
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    start(entries.get(preset.value));
  });

  (async () => {
    const response = await fetch("/assets/data/calendar.json");
    if (!response.ok) throw Error();
    const calendar = await response.json();
    const read = (selector) => [...countdown.querySelector(selector).content.children];
    const commemorations = read("[data-countdown-commemorations]").map((node) => ({
      ...node.dataset, title: node.textContent.trim(),
    }));
    const now = Date.now();
    const date = today(new Date(now));
    const firstDate = now === zonedInstant(date + "T00:00")
      ? date : addDays(date, 1);
    const upcoming = upcomingCalendarEntries(firstDate, calendar, commemorations);
    const groups = [
      ["Lietuvos šventės", upcoming.filter(({ classification }) => classification === "statutory")
        .map((entry) => ({ ...entry, href: "/sventes/" }))],
      ["Atmintinos dienos", upcoming.filter(({ classification }) => classification === "commemoration")
        .map((entry) => ({ ...entry, href: `/sventes/${entry.id}/` }))],
      ["Renginiai su paskelbta data", read("[data-countdown-festivals]")
        .filter((node) => node.dataset.date >= firstDate)
        .map((node) => ({ ...node.dataset, name: node.textContent.trim(), href: `/renginiai/${node.dataset.id}/` }))
        .sort((a, b) => a.date.localeCompare(b.date))],
    ];
    for (const [label, items] of groups) {
      if (!items.length) continue;
      const group = document.createElement("optgroup");
      group.label = label;
      for (const entry of items) {
        entries.set(entry.id, entry);
        group.append(new Option(`${entry.name} · ${entry.date}`, entry.id));
      }
      preset.append(group);
    }
  })().catch(() => {
    countdown.querySelector("#countdown-presets-help").textContent =
      "Švenčių sąrašo įkelti nepavyko. Datą ir laiką galite įvesti patys.";
  });
}

const weekGuide = document.querySelector("[data-week-guide]");
if (weekGuide) {
  const byDate = weekGuide.querySelector("[data-week-date]");
  const byWeek = weekGuide.querySelector("[data-week-number]");
  const caption = weekGuide.querySelector("[data-week-caption]");
  const dates = weekGuide.querySelector("[data-week-range]");
  const days = weekGuide.querySelector("[data-week-days]");
  const status = weekGuide.querySelector("[data-week-status]");
  const navigation = [...weekGuide.querySelectorAll("[data-week-step]")];
  let selectedDate;

  function showDate(date) {
    const { year, week } = isoWeek(date);
    const range = isoWeekRange(year, week);
    selectedDate = date;
    byDate.elements.date.value = date;
    byWeek.elements.year.value = year;
    byWeek.elements.week.value = week;
    caption.textContent = `${year} m. ${week} savaitė`;
    dates.textContent = `${range.start} – ${range.end}`;
    days.replaceChildren(...Array.from({ length: 7 }, (_, index) => {
      const day = addDays(range.start, index);
      const item = document.createElement("li");
      const time = document.createElement("time");
      const number = document.createElement("strong");
      item.classList.toggle("week-tool__selected-day", day === date);
      time.dateTime = day;
      time.textContent = formatDate(day, { weekday: "short", day: undefined, month: undefined, year: undefined });
      number.textContent = Number(day.slice(-2));
      time.append(number);
      time.setAttribute("aria-label", formatDate(day, { weekday: "long" }));
      item.append(time);
      return item;
    }));
    status.textContent = `${formatDate(date)} priklauso ${year} m. ${week} savaitei.`;
    for (const button of navigation) {
      const target = addDays(date, Number(button.dataset.weekStep) * 7);
      button.disabled = target < byDate.elements.date.min || target > byDate.elements.date.max;
    }
  }

  byDate.addEventListener("submit", (event) => {
    event.preventDefault();
    showDate(byDate.elements.date.value);
  });
  byWeek.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const week = isoWeekRange(byWeek.elements.year.valueAsNumber, byWeek.elements.week.valueAsNumber);
      showDate(week.start);
    } catch (error) {
      status.textContent = error.message;
    }
  });
  weekGuide.querySelector("[data-current-week]").addEventListener("click", () => showDate(today()));
  for (const button of navigation) {
    button.addEventListener("click", () => showDate(addDays(selectedDate, Number(button.dataset.weekStep) * 7)));
  }
  showDate(byDate.elements.date.value || today());
}

const yearDay = document.querySelector("[data-year-day]");
if (yearDay) {
  const field = yearDay.elements.date;
  const title = yearDay.querySelector("[data-result-title]");
  const value = yearDay.querySelector("[data-result-value]");
  const remaining = yearDay.querySelector("[data-year-days-left]");
  const weekNumber = yearDay.querySelector("[data-year-week]");
  const progress = yearDay.querySelector("[data-year-progress]");

  function render() {
    if (!field.validity.valid || !field.value) return;
    const year = field.value.slice(0, 4);
    const elapsed = difference(year + "-01-01", field.value) + 1;
    const left = difference(field.value, year + "-12-31");
    const week = isoWeek(field.value);

    title.textContent = formatDate(field.value);
    value.textContent = `${elapsed}-oji metų diena`;
    remaining.textContent = left;
    weekNumber.textContent = `${week.year}-W${String(week.week).padStart(2, "0")}`;
    progress.style.width = `${elapsed / (elapsed + left) * 100}%`;
  }

  if (!field.value) field.value = today();
  yearDay.addEventListener("submit", (event) => { event.preventDefault(); render(); });
  field.addEventListener("change", render);
  for (const button of yearDay.querySelectorAll("[data-day-date]")) {
    button.addEventListener("click", () => {
      const current = today();
      const year = field.validity.valid && field.value ? field.value.slice(0, 4) : current.slice(0, 4);
      field.value = button.dataset.dayDate === "today" ? current : year + "-" + button.dataset.dayDate;
      render();
    });
  }
  render();
}

function isGregorianLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

const leap = document.querySelector("[data-leap-year]");
if (leap) {
  const field = leap.elements.year;
  const title = leap.querySelector("[data-result-title]");
  const value = leap.querySelector("[data-result-value]");
  const february = leap.querySelector("[data-february-days]");
  const nextLeap = leap.querySelector("[data-next-leap]");

  function render() {
    if (!field.validity.valid || !field.value) return;
    const year = field.valueAsNumber;
    const isLeap = isGregorianLeapYear(year);
    let next = year + 1;
    while (!isGregorianLeapYear(next)) next += 1;

    title.textContent = `${year} m. ${isLeap ? "yra keliamieji" : "yra nekeliamieji"}`;
    value.textContent = `${isLeap ? 366 : 365} dienos`;
    february.textContent = isLeap ? "29" : "28";
    nextLeap.textContent = `${next} m.`;
  }

  if (!field.value) field.value = today().slice(0, 4);
  leap.addEventListener("submit", (event) => { event.preventDefault(); render(); });
  field.addEventListener("change", render);
  for (const button of leap.querySelectorAll("[data-use-year]")) {
    button.addEventListener("click", () => {
      field.value = button.dataset.useYear;
      render();
    });
  }
  render();
}
