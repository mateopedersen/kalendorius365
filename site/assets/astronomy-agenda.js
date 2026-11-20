import './calendar-downloads.js';
import { buildAstronomyICS, composeAstronomyEvents, eventLocalParts, VILNIUS_ZONE } from "./astronomy-agenda-core.js";
import { countNoun } from "./calendar.js";

const $ = (selector) => document.querySelector(selector);
const year = $("#astro-year");
const month = $("#astro-month");
const kind = $("#astro-kind");
const reset = $("#astro-reset");
const count = $("#astro-agenda-count");
const feature = $("#astro-featured");
const list = $("#astro-event-list");
const downloadButton = $("#astro-download-ics");
const message = $("#astro-agenda-message");
const controls = [year, month, kind];
const filterKeys = ["metai", "menuo", "rusis"];
const eventArt = "/assets/visuals/astronomy/events.svg";
const svgNamespace = "http://www.w3.org/2000/svg";
const months = new Map([...month.options].slice(1).map(option => [
  Number(option.value), { name: option.textContent, slug: option.dataset.slug },
]));
const localDate = new Intl.DateTimeFormat("lt-LT", {
  dateStyle: "full", timeStyle: "short", timeZone: VILNIUS_ZONE, hourCycle: "h23",
});
const utcDate = new Intl.DateTimeFormat("lt-LT", {
  dateStyle: "medium", timeStyle: "short", timeZone: "UTC", hourCycle: "h23",
});
const notes = {
  new: "Mėnulis danguje yra arti Saulės krypties. Jo apšviestą pusę iš Žemės matome menkai.",
  first: "Pirmojo ketvirčio metu apšviesta pusė matomo disko. Po šios fazės apšviesta dalis auga.",
  full: "Mėnulis yra priešingoje dangaus pusėje nei Saulė. Matome beveik visą apšviestą diską.",
  last: "Per paskutinį ketvirtį apšviesta pusė matomo disko. Iki jaunaties ji toliau mažėja.",
  "spring-equinox": "Saulė kerta dangaus pusiaują judėdama į šiaurę. Lietuvoje dienos šviesos daugėja.",
  "summer-solstice": "Saulės regimasis kelias virš Lietuvos horizonto pasiekia aukščiausią metinę padėtį.",
  "autumn-equinox": "Saulė kerta dangaus pusiaują judėdama į pietus. Lietuvoje dienos šviesos mažėja.",
  "winter-solstice": "Saulės regimasis kelias virš Lietuvos horizonto pasiekia žemiausią metinę padėtį.",
};
const seasonPages = {
  "spring-equinox": "/pavasario-lygiadienis/",
  "summer-solstice": "/vasaros-saulegriza/",
  "autumn-equinox": "/rudens-lygiadienis/",
  "winter-solstice": "/ziemos-saulegriza/",
};

function create(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function icon(type) {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("class", "astro-phase-icon");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const use = document.createElementNS(svgNamespace, "use");
  use.setAttribute("href", `${eventArt}#${type}`);
  svg.append(use);
  return svg;
}

function eventCard(event, featured = false) {
  const item = create(featured ? "div" : "li", undefined, featured ? "astro-featured-card" : "astro-event-card");
  const date = new Date(event.instant);
  const type = event.phase || event.type;
  const labels = months.get(event.month);
  const meta = create("div", undefined, "astro-event-meta");
  const art = create("div", undefined, "astro-event-art");
  art.append(icon(type));
  meta.append(art, create("span", event.kind === "season" ? "Metų laikai" : "Mėnulio fazė", "astro-event-kind"));
  const heading = create(featured ? "h3" : "h4", event.title);
  const local = create("time", localDate.format(date), "astro-event-local");
  local.dateTime = event.utc;
  const utc = create("time", `${utcDate.format(date)} UTC`, "astro-event-utc");
  utc.dateTime = event.utc;

  const copy = create("div", undefined, "astro-event-copy");
  copy.append(heading, local, utc);
  if (featured) copy.append(create("p", notes[type], "astro-event-description"));
  const link = create("a", event.kind === "moon" ? "Mėnesio Mėnulio kalendorius" : "Apie šį metų laikų įvykį", "astro-event-link");
  link.href = event.kind === "moon" ? `/menulio-kalendorius/${event.year}/${labels.slug}/` : seasonPages[type];
  copy.append(link);
  item.append(meta, copy);
  return item;
}

function renderGroups(filtered, openMonth) {
  const groups = new Map();
  for (const event of filtered) {
    if (!groups.has(event.month)) groups.set(event.month, []);
    groups.get(event.month).push(event);
  }
  list.replaceChildren(...[...groups].map(([number, events]) => {
    const group = create("li", undefined, "astro-month-group");
    const monthDetails = create("details");
    monthDetails.open = number === openMonth;
    const summary = create("summary");
    const name = months.get(number).name;
    summary.append(
      create("span", name, "astro-month-name"),
      create("span", countNoun(events.length, "įvykis", "įvykiai", "įvykių"), "astro-month-count"),
    );
    const items = create("ol", undefined, "astro-month-events");
    items.setAttribute("aria-label", `${name}. Įvykiai`);
    items.append(...events.map((event) => eventCard(event)));
    monthDetails.append(summary, items);
    group.append(monthDetails);
    return group;
  }));
}

function showFeature(title, text) {
  feature.replaceChildren(create("p", title, "astro-feature-label"));
  if (text) feature.append(create("p", text, "astro-feature-message"));
}

function render(events) {
  const selectedYear = Number(year.value);
  const selectedMonth = Number(month.value);
  const filtered = events.filter((event) =>
    event.year === selectedYear &&
    (!selectedMonth || event.month === selectedMonth) &&
    (kind.value === "all" || event.kind === kind.value),
  );
  const period = selectedMonth ? `${months.get(selectedMonth).name} ${selectedYear}` : `${selectedYear} m.`;
  count.textContent = `${period} · ${countNoun(filtered.length, "įvykis", "įvykiai", "įvykių")}`;
  reset.hidden = month.value === "all" && kind.value === "all";
  downloadButton.disabled = filtered.length === 0;
  if (!filtered.length) {
    list.replaceChildren();
    showFeature("Šiam laikotarpiui įvykių nėra", "Pasirinkite kitą mėnesį arba išvalykite filtrus.");
    message.textContent = "Nėra įvykių, kuriuos būtų galima atsisiųsti.";
    downloadButton.onclick = null;
    return;
  }

  const now = Date.now();
  const upcoming = filtered.find((event) => event.instant >= now);
  const highlighted = upcoming || filtered[0];
  showFeature(upcoming ? "Artimiausias įvykis pasirinktame laikotarpyje" : "Pirmasis įvykis pasirinktame laikotarpyje");
  feature.append(eventCard(highlighted, true));
  renderGroups(filtered, highlighted.month);
  message.textContent = "Į failą įtraukiami visi filtrus atitinkantys įvykiai.";
  downloadButton.onclick = () => {
    try {
      const suffix = selectedMonth ? String(selectedMonth).padStart(2, "0") : "visi-men";
      globalThis.Calendar365Downloads.save(
        buildAstronomyICS(filtered), `astronominiai-ivykiai-${selectedYear}-${suffix}.ics`, "text/calendar;charset=utf-8",
      );
      message.textContent = "ICS failas paruoštas. Pradėtas atsisiuntimas.";
    } catch {
      message.textContent = "ICS failo paruošti nepavyko.";
    }
  };
}

function syncUrl() {
  const url = new URL(location.href);
  controls.forEach((control, index) => {
    if (control.value === "all") url.searchParams.delete(filterKeys[index]);
    else url.searchParams.set(filterKeys[index], control.value);
  });
  history.replaceState(history.state, "", url);
}

async function loadData(path) {
  const response = await fetch(path);
  if (!response.ok) throw Error("Astronominių duomenų nepavyko įkelti.");
  return response.json();
}

async function start() {
  count.textContent = "Įvykiai įkeliami…";
  showFeature("Pasirinkto laikotarpio įvykis", "Datos ir laikai įkeliami…");
  try {
    const [seasons, phases] = await Promise.all([
      loadData("/assets/data/astronomy/seasons-extended-utc.json"),
      loadData("/assets/data/astronomy/moon-phases-extended-utc.json"),
    ]);
    const events = composeAstronomyEvents(seasons, phases, [...year.options].map(option => Number(option.value)))
      .map((event) => {
        const parts = eventLocalParts(event.instant);
        return { ...event, year: Number(parts.year), month: Number(parts.month) };
      });
    const query = new URLSearchParams(location.search);
    controls.forEach((control, index) => {
      const selected = query.get(filterKeys[index]);
      if ([...control.options].some(option => option.value === selected)) control.value = selected;
      control.disabled = false;
      control.addEventListener("change", () => {
        syncUrl();
        render(events);
      });
    });
    reset.addEventListener("click", () => {
      month.value = "all";
      kind.value = "all";
      syncUrl();
      render(events);
      month.focus();
    });
    render(events);
  } catch {
    count.textContent = "Astronominių įvykių nepavyko įkelti.";
    message.textContent = "Duomenims nepasiekiant, ICS failas nesukurtas.";
    showFeature("Nepavyko įkelti įvykių", "Metų laikų lentelė ir šaltiniai pateikti žemiau.");
    const retry = create("button", "Bandyti dar kartą", "astro-action astro-action--gold");
    retry.type = "button";
    retry.addEventListener("click", start, { once: true });
    feature.append(retry);
  }
}

start();
