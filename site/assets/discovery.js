import { solarFor } from "./phase-5-6-8-core.js";
import { foldIcsLine, recommendExtendedWeekend, thirdFridayOfMay } from "./discovery-core.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const cleanText = (value) => value.replace(/\s+/g, " ").trim();
const normalize = (value) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("lt");
const utcDate = (value) => new Date(value + "T00:00:00Z");
const formatDate = (value, options = { day: "numeric", month: "long", year: "numeric" }) =>
  new Intl.DateTimeFormat("lt-LT", { ...options, timeZone: "UTC" }).format(utcDate(value));
const formatDateRange = (start, end) => {
  const endOptions = { day: "numeric", month: "long" };
  if (start.slice(0, 4) !== end.slice(0, 4)) endOptions.year = "numeric";
  return formatDate(start) + " – " + formatDate(end, endOptions);
};
const escapeIcs = (value) => cleanText(value).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const downloadText = (filename, contents, type) => {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function setupCommemorations() {
  const root = $("#commemoration-list");
  if (!root) return;
  const search = $("#commemoration-search");
  const year = $("#commemoration-year");
  const category = $("#commemoration-category");
  const status = $("#commemoration-status");
  const exportButton = $("#commemoration-export");
  const cards = $$("[data-commemoration]", root);
  const months = $$("[data-commemoration-month]", root);
  const eventDate = (card) => card.dataset.floating === "third-friday-may"
    ? thirdFridayOfMay(Number(year.value))
    : year.value + "-" + card.dataset.monthDay;

  function render() {
    let count = 0;
    for (const card of cards) {
      const date = eventDate(card);
      const dateNode = $("[data-event-date]", card);
      if (dateNode) {
        dateNode.dateTime = date;
        dateNode.textContent = formatDate(date);
      }
      const matchesSearch = !search.value.trim() || normalize(card.textContent).includes(normalize(search.value.trim()));
      const matchesCategory = category.value === "all" || card.dataset.category === category.value;
      card.hidden = !(matchesSearch && matchesCategory);
      if (!card.hidden) count += 1;
    }
    for (const month of months) month.hidden = !$$("[data-commemoration]:not([hidden])", month).length;
    status.textContent = count
      ? "Rodoma " + count + " iš " + cards.length + " dienų · " + year.value + " m."
      : "Pagal šiuos filtrus dienų nerasta. Pakeiskite paiešką arba pasirinkite kitą temą.";
    exportButton.disabled = count === 0;
  }

  search.addEventListener("input", render);
  year.addEventListener("change", render);
  category.addEventListener("change", render);
  $("#commemoration-clear")?.addEventListener("click", () => {
    search.value = "";
    category.value = "all";
    render();
    search.focus();
  });
  exportButton.addEventListener("click", () => {
    const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const events = cards.filter((card) => !card.hidden).map((card) => {
      const date = eventDate(card);
      const nextDate = new Date(utcDate(date).getTime() + 86400000).toISOString().slice(0, 10);
      const title = cleanText($("h3", card)?.textContent || "Atmintina diena");
      const description = cleanText($("p:not(.muted)", card)?.textContent || "");
      return [
        "BEGIN:VEVENT",
        "UID:" + date.replace(/-/g, "") + "-" + normalize(title).replace(/[^a-z0-9]+/g, "-") + "@kalendorius365.lt",
        "DTSTAMP:" + now,
        "DTSTART;VALUE=DATE:" + date.replace(/-/g, ""),
        "DTEND;VALUE=DATE:" + nextDate.replace(/-/g, ""),
        "SUMMARY:" + escapeIcs(title),
        "DESCRIPTION:" + escapeIcs(description),
        "END:VEVENT",
      ].join("\r\n");
    });
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kalendorius365//LT", "CALSCALE:GREGORIAN", ...events.flatMap((event) => event.split("\r\n")), "END:VCALENDAR"];
    downloadText("atmintinos-dienos-" + year.value + ".ics", lines.map(foldIcsLine).join("\r\n") + "\r\n", "text/calendar;charset=utf-8");
  });
  render();
}

const clockParts = new Intl.DateTimeFormat("lt-LT", {
  timeZone: "Europe/Vilnius", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const clock = (instant) => clockParts.format(new Date(instant));
const minutesOfDay = (instant) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Vilnius", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(instant)).filter((item) => item.type !== "literal").map((item) => [item.type, item.value]));
  return Number(parts.hour) * 60 + Number(parts.minute);
};
const durationLabel = (minutes) => Math.floor(minutes / 60) + " val. " + String(minutes % 60).padStart(2, "0") + " min.";

function setupDaylight() {
  const form = $("#daylight-form");
  if (!form) return;
  const input = $("#daylight-date");
  const status = $("#daylight-status");
  const cityControls = $("#daylight-cities");
  const rows = $("#daylight-rows");
  const chart = $("#daylight-chart");
  const summary = $("#daylight-summary");
  const csvButton = $("#daylight-export");
  const compareAll = $("#daylight-all-cities");
  const dateFromUrl = new URLSearchParams(location.search).get("date");
  if (dateFromUrl && /^\d{4}-\d\d-\d\d$/.test(dateFromUrl) && dateFromUrl >= input.min && dateFromUrl <= input.max) input.value = dateFromUrl;
  let cities = [];
  let results = [];

  async function loadCities() {
    const response = await fetch("/assets/data/astronomy/cities.json");
    if (!response.ok) throw new Error("Miesto duomenų nepavyko gauti.");
    cities = (await response.json()).cities;
    cityControls.replaceChildren();
    for (const city of cities) {
      const label = document.createElement("label");
      label.className = "city-choice";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = city.id;
      checkbox.checked = true;
      const name = document.createElement("span");
      name.textContent = city.name;
      label.append(checkbox, name);
      cityControls.append(label);
    }
  }

  function paintChart(items) {
    chart.replaceChildren();
    const axis = document.createElement("div");
    axis.className = "daylight-axis";
    axis.setAttribute("aria-hidden", "true");
    for (const hour of ["00", "06", "12", "18", "24"]) {
      const tick = document.createElement("span");
      tick.textContent = hour;
      axis.append(tick);
    }
    chart.append(axis);
    for (const item of items) {
      const line = document.createElement("div");
      line.className = "daylight-line";
      const name = document.createElement("span");
      name.className = "daylight-city";
      name.textContent = item.city.name;
      const track = document.createElement("div");
      track.className = "daylight-track";
      track.setAttribute("role", "img");
      track.setAttribute("aria-label", item.city.name + ": saulė teka " + clock(item.result.sunrise) + ", leidžiasi " + clock(item.result.sunset));
      const bar = document.createElement("span");
      bar.className = "daylight-bar";
      bar.style.left = (minutesOfDay(item.result.sunrise) / 1440 * 100) + "%";
      bar.style.width = (item.result.dayMinutes / 1440 * 100) + "%";
      track.append(bar);
      const rise = document.createElement("span");
      rise.className = "daylight-time daylight-time--rise";
      rise.textContent = clock(item.result.sunrise);
      const set = document.createElement("span");
      set.className = "daylight-time daylight-time--set";
      set.textContent = clock(item.result.sunset);
      track.append(rise, set);
      line.append(name, track);
      chart.append(line);
    }
  }

  async function render(event) {
    event?.preventDefault();
    if (!form.reportValidity()) return;
    try {
      if (!cities.length) await loadCities();
      const selected = new Set($$("#daylight-cities input:checked").map((checkbox) => checkbox.value));
      const chosen = cities.filter((city) => selected.has(city.id));
      if (chosen.length < 2) {
        results = [];
        rows.replaceChildren();
        chart.replaceChildren();
        summary.textContent = "";
        csvButton.disabled = true;
        status.textContent = "Palyginimui pasirinkite bent du miestus.";
        return;
      }
      results = chosen.map((city) => ({ city, result: solarFor(input.value, { lat: city.latitude, lon: city.longitude }) }));
      rows.replaceChildren();
      for (const item of results) {
        const duration = durationLabel(item.result.dayMinutes);
        const row = document.createElement("tr");
        for (const text of [item.city.name, clock(item.result.sunrise), clock(item.result.noon), clock(item.result.sunset), duration]) {
          const cell = document.createElement("td");
          cell.textContent = text;
          row.append(cell);
        }
        const cell = document.createElement("td");
        const meter = document.createElement("meter");
        meter.min = 0;
        meter.max = 1440;
        meter.value = item.result.dayMinutes;
        meter.textContent = duration;
        meter.setAttribute("aria-label", item.city.name + ": " + duration);
        cell.append(meter);
        row.append(cell);
        rows.append(row);
      }
      paintChart(results);
      const sorted = [...results].sort((a, b) => b.result.dayMinutes - a.result.dayMinutes);
      const difference = sorted[0].result.dayMinutes - sorted.at(-1).result.dayMinutes;
      summary.textContent = sorted[0].city.name + " turi ilgiausią šviesų laiką (" + durationLabel(sorted[0].result.dayMinutes) + "), " +
        sorted.at(-1).city.name + " – trumpiausią (" + durationLabel(sorted.at(-1).result.dayMinutes) +
        "). Skirtumas tarp pasirinktų miestų: " + durationLabel(difference) + " Saulės vidurdienis – aukščiausias jos taškas danguje.";
      status.textContent = formatDate(input.value, { day: "numeric", month: "long", year: "numeric" }) +
        " · Lietuvos laiku · lyginami miestai: " + chosen.length;
      csvButton.disabled = results.length === 0;
      const url = new URL(location.href);
      url.searchParams.set("date", input.value);
      history.replaceState({}, "", url);
    } catch {
      status.textContent = "Duomenų nepavyko įkelti. Patikrinkite ryšį ir bandykite dar kartą.";
    }
  }

  form.addEventListener("submit", render);
  cityControls.addEventListener("change", (event) => {
    if (event.target.matches("input")) render();
  });
  compareAll.addEventListener("click", () => {
    $$("#daylight-cities input").forEach((checkbox) => { checkbox.checked = true; });
    render();
  });
  $$(".daylight-preset").forEach((button) => button.addEventListener("click", () => {
    input.value = input.value.slice(0, 4) + "-" + button.dataset.monthDay;
    render();
  }));
  csvButton.addEventListener("click", () => {
    if (!results.length) return;
    const lines = [
      ["Data", "Miestas", "Saulėtekis (Europe/Vilnius)", "Saulės vidurdienis", "Saulėlydis", "Dienos šviesa (min.)"],
      ...results.map(({ city, result }) => [input.value, city.name, clock(result.sunrise), clock(result.noon), clock(result.sunset), result.dayMinutes]),
    ].map((line) => line.map((value) => '"' + String(value).replace(/"/g, '""') + '"').join(";"));
    downloadText("dienos-sviesa-" + input.value + ".csv", "\uFEFF" + lines.join("\r\n"), "text/csv;charset=utf-8");
  });
  render();
}

function setupWeekendPlanner() {
  const planner = $("#weekend-planner");
  if (!planner) return;
  const budget = $("#weekend-leave-budget");
  const output = $("#weekend-recommendations");
  const sections = $$("[data-weekend-section]");
  const yearButtons = $$("[data-weekend-year]");
  let selectedYear = "2027";

  function render() {
    const leaveDays = Number(budget.value);
    output.replaceChildren();
    const section = sections.find((item) => item.dataset.weekendSection === selectedYear);
    const events = $$("[data-weekend]", section);
    for (const event of events) {
      const recommendation = recommendExtendedWeekend(event.dataset.start, event.dataset.end, leaveDays);
      const card = document.createElement("article");
      card.className = "weekend-recommendation";
      const heading = document.createElement("h3");
      heading.textContent = formatDateRange(recommendation.start, recommendation.end);
      const details = document.createElement("p");
      const leaveLabel = recommendation.leaveDays === 1 ? "atostogų diena" :
        recommendation.leaveDays > 1 && recommendation.leaveDays < 10 ? "atostogų dienos" : "atostogų dienų";
      const restLabel = recommendation.daysOff === 1 ? "poilsio diena" :
        recommendation.daysOff < 10 ? "poilsio dienos" : "poilsio dienų";
      const leavePlan = recommendation.leaveDates.length
        ? " · Atostogos: " + recommendation.leaveDates.map((date) => formatDate(date)).join(", ")
        : "";
      details.textContent = recommendation.daysOff + " iš eilės " + restLabel + " · " + recommendation.leaveDays + " " + leaveLabel + leavePlan;
      const context = document.createElement("p");
      context.className = "muted";
      context.textContent = cleanText($("h3", event)?.textContent || "") + " · " + cleanText($("p:not(.muted)", event)?.textContent || "");
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "button button--subtle";
      copy.textContent = "Kopijuoti datų planą";
      copy.addEventListener("click", async () => {
        const text = heading.textContent + " · " + details.textContent;
        try {
          await navigator.clipboard.writeText(text);
          copy.textContent = "Nukopijuota";
        } catch {
          copy.textContent = "Pažymėkite datas: " + recommendation.start + " – " + recommendation.end;
        }
      });
      card.append(heading, details, context, copy);
      output.append(card);
    }
  }

  for (const section of sections) section.hidden = section.dataset.weekendSection !== selectedYear;
  for (const button of yearButtons) button.addEventListener("click", () => {
    selectedYear = button.dataset.weekendYear;
    for (const item of yearButtons) item.setAttribute("aria-pressed", String(item === button));
    for (const section of sections) section.hidden = section.dataset.weekendSection !== selectedYear;
    render();
  });
  budget.addEventListener("change", render);
  render();
}

function setupDiscovery() {
  setupCommemorations();
  setupDaylight();
  setupWeekendPlanner();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupDiscovery, { once: true });
else setupDiscovery();
