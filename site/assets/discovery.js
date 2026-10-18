import { holidays as statutoryHolidays, today as currentVilniusDate } from "./calendar.js";
import { solarFor } from "./phase-5-6-8-core.js";
import { foldIcsLine, recommendAnnualWeekendPlan, shiftIsoDate, thirdFridayOfMay } from "./discovery-core.js";

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
const countWord = (count, one, few, many) => {
  const lastTwo = count % 100;
  const lastDigit = count % 10;
  const form = lastTwo >= 11 && lastTwo <= 19 ? many : lastDigit === 1 ? one : lastDigit >= 2 && lastDigit <= 9 ? few : many;
  return count + " " + form;
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
  const favoritesOnly = $("#commemoration-favorites-only");
  const nextTitle = $("#commemoration-next-title");
  const nextDate = $("#commemoration-next-date");
  const nextLink = $("#commemoration-next-link");
  const nextCount = $("#commemoration-next-count");
  const nextLabel = $("#commemoration-next-label");
  const cards = $$("[data-commemoration]", root);
  const months = $$("[data-commemoration-month]", root);
  const favoriteKey = "kalendorius365:commemoration-favorites:v1";
  let favorites = new Set();
  try { favorites = new Set(JSON.parse(localStorage.getItem(favoriteKey) || "[]")); } catch { favorites = new Set(); }
  const favoriteId = (card) => $("h3 a", card)?.getAttribute("href") || card.dataset.monthDay || card.dataset.floating;
  for (const card of cards) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "commemoration-favorite";
    button.addEventListener("click", () => {
      const id = favoriteId(card);
      favorites.has(id) ? favorites.delete(id) : favorites.add(id);
      try { localStorage.setItem(favoriteKey, JSON.stringify([...favorites])); } catch { /* Saving is optional on restricted browsers. */ }
      render();
    });
    card.prepend(button);
  }
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
        dateNode.textContent = formatDate(date) + " · " + dateWeekday(date);
      }
      const searchable = [$("h3", card)?.textContent, $("p:not(.muted)", card)?.textContent, $(".commemoration-tag", card)?.textContent].filter(Boolean).join(" ");
      const matchesSearch = !search.value.trim() || normalize(searchable).includes(normalize(search.value.trim()));
      const matchesCategory = category.value === "all" || card.dataset.category === category.value;
      const matchesFavorite = !favoritesOnly.checked || favorites.has(favoriteId(card));
      card.hidden = !(matchesSearch && matchesCategory && matchesFavorite);
      const favoriteButton = $(".commemoration-favorite", card);
      const isFavorite = favorites.has(favoriteId(card));
      favoriteButton.textContent = isFavorite ? "★" : "☆";
      favoriteButton.setAttribute("aria-pressed", String(isFavorite));
      favoriteButton.setAttribute("aria-label", (isFavorite ? "Pašalinti iš išsaugotų: " : "Išsaugoti datą: ") + cleanText($("h3", card)?.textContent || "Atmintina diena"));
      favoriteButton.title = isFavorite ? "Pašalinti iš išsaugotų" : "Išsaugoti datą";
      if (!card.hidden) count += 1;
    }
    for (const month of months) month.hidden = !$$("[data-commemoration]:not([hidden])", month).length;
    const visible = cards.filter((card) => !card.hidden).map((card) => ({ card, date: eventDate(card) })).sort((a, b) => a.date.localeCompare(b.date));
    const today = currentVilniusDate();
    const upcoming = visible.filter((item) => item.date >= today);
    const next = upcoming[0] || visible[0];
    if (next) {
      nextTitle.textContent = cleanText($("h3", next.card)?.textContent || "Atmintina diena");
      nextDate.textContent = formatDate(next.date) + " · " + dateWeekday(next.date);
      nextLink.href = $("h3 a", next.card)?.getAttribute("href") || "/sventes/";
      if (upcoming.length) {
        nextCount.textContent = String(Math.max(0, Math.ceil((utcDate(next.date) - utcDate(today)) / 86400000)));
        nextLabel.textContent = "dienų liko";
      } else {
        nextCount.textContent = "—";
        nextLabel.textContent = "artimiausia šiame filtre";
      }
    } else {
      nextTitle.textContent = "Pagal šiuos filtrus dienų nerasta";
      nextDate.textContent = "Išsaugokite datą arba pakeiskite filtrus, kad pamatytumėte artimiausią progą.";
      nextLink.href = "/sventes/";
      nextCount.textContent = "—";
      nextLabel.textContent = "";
    }
    status.textContent = count
      ? "Rodoma " + count + " iš " + cards.length + " dienų · " + year.value + " m." + (favoritesOnly.checked ? " · tik išsaugotos" : "")
      : "Pagal šiuos filtrus dienų nerasta. Pakeiskite paiešką arba pasirinkite kitą temą.";
    exportButton.disabled = count === 0;
  }

  search.addEventListener("input", render);
  year.addEventListener("change", render);
  category.addEventListener("change", render);
  favoritesOnly.addEventListener("change", render);
  $("#commemoration-clear")?.addEventListener("click", () => {
    search.value = "";
    category.value = "all";
    favoritesOnly.checked = false;
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
const minutesLabel = (minutes) => (minutes > 0 ? "+" : minutes < 0 ? "−" : "±") + Math.abs(minutes) + " min.";
const dateWeekday = (value) => new Intl.DateTimeFormat("lt-LT", { weekday: "long", timeZone: "UTC" }).format(utcDate(value));

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
  const focusCity = $("#daylight-focus-city");
  const yearChart = $("#daylight-year-chart");
  const yearSummary = $("#daylight-year-summary");
  const previousDay = $("#daylight-previous-day");
  const nextDay = $("#daylight-next-day");
  const copyLink = $("#daylight-copy-link");
  const dateFromUrl = new URLSearchParams(location.search).get("date");
  if (dateFromUrl && /^\d{4}-\d\d-\d\d$/.test(dateFromUrl) && dateFromUrl >= input.min && dateFromUrl <= input.max) input.value = dateFromUrl;
  let cities = [];
  let results = [];
  function updateDateStepButtons() {
    previousDay.disabled = !input.value || input.value <= input.min;
    nextDay.disabled = !input.value || input.value >= input.max;
  }

  async function loadCities() {
    const response = await fetch("/assets/data/astronomy/cities.json");
    if (!response.ok) throw new Error("Miesto duomenų nepavyko gauti.");
    cities = (await response.json()).cities;
    focusCity.replaceChildren();
    for (const city of cities) {
      const option = document.createElement("option");
      option.value = city.id;
      option.textContent = city.name;
      option.selected = city.id === "vilnius";
      focusCity.append(option);
    }
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

  function renderYearCurve() {
    if (!cities.length || !yearChart) return;
    const city = cities.find((item) => item.id === focusCity.value) || cities[0];
    const year = input.value.slice(0, 4);
    const data = Array.from({ length: 12 }, (_, index) => {
      const date = year + "-" + String(index + 1).padStart(2, "0") + "-21";
      const result = solarFor(date, { lat: city.latitude, lon: city.longitude });
      return { date, month: index, minutes: result.dayMinutes };
    });
    const x0 = 72;
    const x1 = 778;
    const y0 = 35;
    const y1 = 228;
    const minMinutes = 360;
    const maxMinutes = 1080;
    const point = (item) => ({
      x: x0 + (x1 - x0) * item.month / 11,
      y: y1 - (item.minutes - minMinutes) / (maxMinutes - minMinutes) * (y1 - y0),
    });
    const svgNs = "http://www.w3.org/2000/svg";
    const el = (name, attrs = {}, text) => {
      const node = document.createElementNS(svgNs, name);
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
      if (text !== undefined) node.textContent = text;
      return node;
    };
    yearChart.replaceChildren();
    yearChart.setAttribute("aria-label", city.name + " apytikslė dienos šviesos trukmė per " + year + " metus. Mėnesio taškai atveria dienos palyginimą.");
    yearChart.append(el("title", { id: "daylight-year-svg-title" }, city.name + " dienos šviesa " + year + " metais"));
    yearChart.append(el("desc", { id: "daylight-year-svg-desc" }, "Mėnesinė dienos trukmės kreivė, skaičiuojama kiekvieno mėnesio 21 dienai."));
    const defs = el("defs");
    const gradient = el("linearGradient", { id: "daylight-area", x1: "0", x2: "0", y1: "0", y2: "1" });
    gradient.append(el("stop", { offset: "0%", "stop-color": "#eab14f", "stop-opacity": ".32" }));
    gradient.append(el("stop", { offset: "100%", "stop-color": "#eab14f", "stop-opacity": ".02" }));
    defs.append(gradient);
    yearChart.append(defs);
    for (const minutes of [360, 540, 720, 900, 1080]) {
      const y = y1 - (minutes - minMinutes) / (maxMinutes - minMinutes) * (y1 - y0);
      yearChart.append(el("path", { d: "M" + x0 + " " + y + "H" + x1, class: "daylight-year-gridline" }));
      yearChart.append(el("text", { x: 4, y: y + 4, class: "daylight-year-axis-label" }, String(Math.floor(minutes / 60)).padStart(2, "0") + ":00"));
    }
    const points = data.map(point);
    let linePath = "M" + points[0].x.toFixed(1) + " " + points[0].y.toFixed(1);
    for (let index = 0; index < points.length - 1; index += 1) {
      const previous = points[Math.max(0, index - 1)];
      const current = points[index];
      const next = points[index + 1];
      const following = points[Math.min(points.length - 1, index + 2)];
      const controlOne = { x: current.x + (next.x - previous.x) / 6, y: current.y + (next.y - previous.y) / 6 };
      const controlTwo = { x: next.x - (following.x - current.x) / 6, y: next.y - (following.y - current.y) / 6 };
      linePath += " C" + controlOne.x.toFixed(1) + " " + controlOne.y.toFixed(1) + " " +
        controlTwo.x.toFixed(1) + " " + controlTwo.y.toFixed(1) + " " + next.x.toFixed(1) + " " + next.y.toFixed(1);
    }
    const areaPath = linePath + " L" + x1 + " " + y1 + " L" + x0 + " " + y1 + " Z";
    yearChart.append(el("path", { d: areaPath, class: "daylight-year-area" }));
    yearChart.append(el("path", { d: linePath, class: "daylight-year-line" }));
    for (const item of data) {
      const position = point(item);
      const monthName = new Intl.DateTimeFormat("lt-LT", { month: "short", timeZone: "UTC" }).format(utcDate(item.date));
      yearChart.append(el("text", { x: position.x, y: 259, class: "daylight-year-month", "text-anchor": "middle" }, monthName.replace(/\.$/, "")));
      const marker = el("circle", {
        cx: position.x,
        cy: position.y,
        r: item.month === 5 || item.month === 11 ? 7 : 4,
        class: item.month === 5 || item.month === 11 ? "daylight-year-point daylight-year-point--turn" : "daylight-year-point",
        role: "button",
        tabindex: "0",
        "aria-label": "Palyginti " + formatDate(item.date),
      });
      const chooseDate = () => {
        input.value = item.date;
        render();
      };
      marker.addEventListener("click", chooseDate);
      marker.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          chooseDate();
        }
      });
      yearChart.append(marker);
      yearChart.append(el("circle", { cx: position.x, cy: position.y, r: 1.8, class: "daylight-year-point-core" }));
    }
    const longest = [...data].sort((a, b) => b.minutes - a.minutes)[0];
    const shortest = [...data].sort((a, b) => a.minutes - b.minutes)[0];
    const longestMonth = new Intl.DateTimeFormat("lt-LT", { month: "long", timeZone: "UTC" }).format(utcDate(longest.date));
    const shortestMonth = new Intl.DateTimeFormat("lt-LT", { month: "long", timeZone: "UTC" }).format(utcDate(shortest.date));
    yearSummary.textContent = city.name + " ilgiausia iš šių pasirinktų dienų – " + longestMonth + " (" + durationLabel(longest.minutes) + "), trumpiausia – " + shortestMonth + " (" + durationLabel(shortest.minutes) + "). Tarp jų susidaro " + durationLabel(longest.minutes - shortest.minutes) + " skirtumas.";
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
      rise.style.left = (minutesOfDay(item.result.sunrise) / 1440 * 100) + "%";
      const set = document.createElement("span");
      set.className = "daylight-time daylight-time--set";
      set.textContent = clock(item.result.sunset);
      set.style.left = (minutesOfDay(item.result.sunset) / 1440 * 100) + "%";
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
        renderYearCurve();
        return;
      }
      results = chosen.map((city) => ({ city, result: solarFor(input.value, { lat: city.latitude, lon: city.longitude }) }));
      const referenceCity = cities.find((city) => city.id === "vilnius") || cities[0];
      const referenceMinutes = solarFor(input.value, { lat: referenceCity.latitude, lon: referenceCity.longitude }).dayMinutes;
      rows.replaceChildren();
      for (const item of results) {
        const duration = durationLabel(item.result.dayMinutes);
        const row = document.createElement("tr");
        for (const text of [item.city.name, clock(item.result.sunrise), clock(item.result.noon), clock(item.result.sunset), duration, minutesLabel(item.result.dayMinutes - referenceMinutes)]) {
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
      renderYearCurve();
      updateDateStepButtons();
      const url = new URL(location.href);
      url.searchParams.set("date", input.value);
      history.replaceState({}, "", url);
    } catch {
      status.textContent = "Duomenų nepavyko įkelti. Patikrinkite ryšį ir bandykite dar kartą.";
    }
  }

  form.addEventListener("submit", render);
  previousDay.addEventListener("click", () => { if (input.value > input.min) { input.value = shiftIsoDate(input.value, -1); render(); } });
  nextDay.addEventListener("click", () => { if (input.value < input.max) { input.value = shiftIsoDate(input.value, 1); render(); } });
  input.addEventListener("input", updateDateStepButtons);
  copyLink.addEventListener("click", async () => {
    const url = new URL(location.href);
    url.searchParams.set("date", input.value);
    try {
      await navigator.clipboard.writeText(url.href);
      copyLink.textContent = "Nuoroda nukopijuota";
      window.setTimeout(() => { copyLink.textContent = "Kopijuoti šios datos nuorodą"; }, 2200);
    } catch {
      status.textContent = "Pasirinktos datos nuoroda: " + url.href;
    }
  });
  focusCity.addEventListener("change", renderYearCurve);
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
      ["Data", "Miestas", "Saulėtekis (Europe/Vilnius)", "Saulės vidurdienis", "Saulėlydis", "Dienos šviesa (min.)", "Skirtumas nuo Vilniaus (min.)"],
      ...results.map(({ city, result }) => {
        const reference = cities.find((item) => item.id === "vilnius") || cities[0];
        const referenceMinutes = solarFor(input.value, { lat: reference.latitude, lon: reference.longitude }).dayMinutes;
        return [input.value, city.name, clock(result.sunrise), clock(result.noon), clock(result.sunset), result.dayMinutes, result.dayMinutes - referenceMinutes];
      }),
    ].map((line) => line.map((value) => '"' + String(value).replace(/"/g, '""') + '"').join(";"));
    downloadText("dienos-sviesa-" + input.value + ".csv", "\uFEFF" + lines.join("\r\n"), "text/csv;charset=utf-8");
  });
  updateDateStepButtons();
  render();
}

function setupWeekendPlanner() {
  const planner = $("#weekend-planner");
  if (!planner) return;
  const budget = $("#weekend-leave-budget");
  const output = $("#weekend-recommendations");
  const total = $("#weekend-plan-total");
  const caption = $("#weekend-plan-caption");
  const exportButton = $("#weekend-plan-export");
  const sections = $$("[data-weekend-section]");
  const yearButtons = $$("[data-weekend-year]");
  let selectedYear = "2027";
  let currentPlan = null;
  let holidayDates = null;

  function render() {
    if (!holidayDates) return;
    const leaveDays = Number(budget.value);
    output.replaceChildren();
    const section = sections.find((item) => item.dataset.weekendSection === selectedYear);
    const events = $$("[data-weekend]", section).map((event) => ({
      start: event.dataset.start,
      end: event.dataset.end,
      name: cleanText($("h3", event)?.textContent || "Ilgasis savaitgalis"),
      reason: cleanText($("p:not(.muted)", event)?.textContent || ""),
      monthLink: $("a", event)?.href || "",
      baseDays: Math.round((utcDate(event.dataset.end) - utcDate(event.dataset.start)) / 86400000) + 1,
    }));
    currentPlan = recommendAnnualWeekendPlan(events, leaveDays, selectedYear, { holidayDates });
    exportButton.disabled = currentPlan.recommendations.length === 0;
    total.textContent = currentPlan.extraDays
      ? "+" + countWord(currentPlan.extraDays, "papildoma poilsio diena", "papildomos poilsio dienos", "papildomų poilsio dienų")
      : "Papildomų dienų dar nepridėta";
    caption.textContent = currentPlan.recommendations.length
      ? "Išnaudojama " + countWord(currentPlan.leaveDays, "atostogų diena", "atostogų dienos", "atostogų dienų") + ". Suplanuoti poilsio laikotarpiai nesidubliuoja."
      : "Padidinkite limitą, kad suplanuotumėte papildomą laiką aplink savaitgalius ir šventes.";
    for (const recommendation of currentPlan.recommendations) {
      const card = document.createElement("article");
      card.className = "weekend-recommendation";
      const heading = document.createElement("h3");
      heading.textContent = formatDateRange(recommendation.start, recommendation.end);
      const details = document.createElement("p");
      const leaveLabel = countWord(recommendation.leaveDays, "atostogų diena", "atostogų dienos", "atostogų dienų");
      const restLabel = countWord(recommendation.daysOff, "poilsio diena", "poilsio dienos", "poilsio dienų");
      const leavePlan = recommendation.leaveDates.length
        ? " · Atostogos: " + recommendation.leaveDates.map((date) => formatDate(date)).join(", ")
        : "";
      details.textContent = restLabel + " iš eilės · " + leaveLabel + leavePlan;
      const context = document.createElement("p");
      context.className = "muted";
      context.textContent = recommendation.reason + " · +" + countWord(recommendation.extraDays, "papildoma diena", "papildomos dienos", "papildomų dienų") + " virš jau laisvo laikotarpio.";
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "button button--subtle";
      copy.textContent = "Kopijuoti datų planą";
      copy.addEventListener("click", async () => {
        const text = recommendation.name + " · " + heading.textContent + " · " + details.textContent;
        try {
          await navigator.clipboard.writeText(text);
          copy.textContent = "Nukopijuota";
        } catch {
          copy.textContent = "Pažymėkite datas: " + recommendation.start + " – " + recommendation.end;
        }
      });
      const calendarLink = document.createElement("a");
      calendarLink.href = recommendation.monthLink;
      calendarLink.textContent = "Atverti mėnesio kalendorių →";
      card.append(heading, details, context, copy, calendarLink);
      output.append(card);
    }
    if (!currentPlan.recommendations.length) {
      const empty = document.createElement("p");
      empty.className = "weekend-plan-empty";
      empty.textContent = leaveDays ? "Šiais metais papildomų darbo dienų pasirinktu limitu nepridėsite. Išsaugokite atostogas kitam laikotarpiui." : "Pasirinkite atostogų limitą, kad matytumėte, kaip pratęsti poilsį.";
      output.append(empty);
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
  exportButton.addEventListener("click", () => {
    if (!currentPlan?.recommendations.length) return;
    const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const events = currentPlan.recommendations.flatMap((item) => {
      const endExclusive = shiftIsoDate(item.end, 1);
      return [
        "BEGIN:VEVENT",
        "UID:" + item.start.replace(/-/g, "") + "-" + normalize(item.name).replace(/[^a-z0-9]+/g, "-") + "@kalendorius365.lt",
        "DTSTAMP:" + now,
        "DTSTART;VALUE=DATE:" + item.start.replace(/-/g, ""),
        "DTEND;VALUE=DATE:" + endExclusive.replace(/-/g, ""),
        "SUMMARY:" + escapeIcs("Poilsio planas · " + item.daysOff + " poilsio dienos"),
        "DESCRIPTION:" + escapeIcs(item.name + ". Atostogų dienos: " + item.leaveDates.map(formatDate).join(", ")),
        "END:VEVENT",
      ];
    });
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kalendorius365//LT", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"];
    downloadText("ilgieji-savaitgaliai-" + selectedYear + ".ics", lines.map(foldIcsLine).join("\r\n") + "\r\n", "text/calendar;charset=utf-8");
  });
  const setReady = ready => {
    budget.disabled = !ready;
    for (const button of yearButtons) button.disabled = !ready;
    if (!ready) exportButton.disabled = true;
  };
  async function loadHolidays() {
    setReady(false);
    caption.textContent = "Ruošiamas poilsio planas…";
    $("#weekend-plan-retry")?.remove();
    try {
      const response = await fetch("/assets/data/calendar.json");
      if (!response.ok) throw new Error("Švenčių duomenų nepavyko gauti.");
      const data = await response.json();
      if (!Array.isArray(data.holidays)) throw new Error("Švenčių duomenys netinkami.");
      const years = new Set(yearButtons.flatMap(button => {
        const year = Number(button.dataset.weekendYear);
        return [year - 1, year, year + 1];
      }));
      holidayDates = new Set([...years].flatMap(year => statutoryHolidays(year, data).map(day => day.date)));
      setReady(true);
      render();
    } catch {
      caption.textContent = "Švenčių duomenų nepavyko įkelti. Bandykite dar kartą.";
      const retry = document.createElement("button");
      retry.id = "weekend-plan-retry";
      retry.type = "button";
      retry.className = "button button--subtle";
      retry.textContent = "Bandyti dar kartą";
      retry.addEventListener("click", loadHolidays);
      caption.after(retry);
    }
  }
  loadHolidays();
}

function setupDiscovery() {
  setupCommemorations();
  setupDaylight();
  setupWeekendPlanner();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupDiscovery, { once: true });
else setupDiscovery();
