import { monthGrid, yearFacts, yearPrintAssets } from "./year-directory-core.js";
import { countNoun, today } from "./calendar.js";

const monthNames = ["sausis", "vasaris", "kovas", "balandis", "gegužė", "birželis", "liepa", "rugpjūtis", "rugsėjis", "spalis", "lapkritis", "gruodis"];
const monthSlugs = ["sausis", "vasaris", "kovas", "balandis", "geguze", "birzelis", "liepa", "rugpjutis", "rugsejis", "spalis", "lapkritis", "gruodis"];
const weekdayNames = ["Pr", "An", "Tr", "Kt", "Pn", "Št", "Sk"];
const fullWeekdayNames = ["sekmadienį", "pirmadienį", "antradienį", "trečiadienį", "ketvirtadienį", "penktadienį", "šeštadienį"];
const selector = document.querySelector("#year-preview-month");
if (selector) {
  const status = document.querySelector("#year-preview-status");
  const formatMonth = (year, month) => new Intl.DateTimeFormat("lt-LT", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));

  function render(year, month) {
    const grid = monthGrid(year, month), host = document.querySelector(`[data-year-preview="${year}"]`);
    if (!host) return;
    const table = document.createElement("table");
    table.className = "year-mini-calendar";
    table.setAttribute("aria-label", `${year} m. ${formatMonth(year, month)}`);
    const caption = document.createElement("caption");
    caption.textContent = `${formatMonth(year, month)} · ${grid.days} d.`;
    const head = document.createElement("thead"), headRow = document.createElement("tr");
    for (let day = 0; day < 7; day++) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = weekdayNames[day];
      if (day >= 5) th.className = "is-weekend";
      headRow.append(th);
    }
    head.append(headRow);
    const body = document.createElement("tbody");
    for (let row = 0; row < grid.rowCount; row++) {
      const tr = document.createElement("tr");
      for (let col = 0; col < 7; col++) {
        const td = document.createElement("td"), day = grid.cells[row * 7 + col];
        if (day === null) td.setAttribute("aria-hidden", "true");
        else {
          const time = document.createElement("time");
          time.dateTime = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          time.textContent = String(day);
          td.append(time);
          if (col >= 5) { td.className = "is-weekend"; td.setAttribute("aria-label", `${time.dateTime}, savaitgalis`); }
        }
        tr.append(td);
      }
      body.append(tr);
    }
    table.append(caption, head, body);
    host.replaceChildren(table);
    const link = document.querySelector(`[data-year-card="${year}"] .year-month-link`);
    if (link) link.href = `/${year}/${monthSlugs[month - 1]}/`;
  }

  function renderYearFacts(year) {
    const card = document.querySelector(`[data-year-card="${year}"]`);
    if (!card) return;
    const facts = yearFacts(year), currentYear = Number(today().slice(0, 4));
    const label = card.querySelector("[data-year-label]");
    const detail = card.querySelector("[data-year-fact]");
    const days = card.querySelector("[data-year-days]");
    if (label) {
      label.textContent = year === currentYear ? "Šie metai" : year > currentYear ? "Ateinantys metai" : "Praėję metai";
      label.classList.toggle("year-tag--leap", facts.leap);
    }
    if (days) days.textContent = countNoun(facts.days, "diena", "dienos", "dienų");
    if (detail) detail.textContent = `${facts.leap ? "Keliamieji metai · vasaris turi 29 dienas" : "Įprasti metai"} · prasideda ${fullWeekdayNames[facts.firstDay]}, baigiasi ${fullWeekdayNames[facts.lastDay]}`;
  }

  function renderYearPrintAssets(year, assets) {
    const host = document.querySelector(`[data-year-downloads="${year}"]`);
    if (!host || !assets.length) return;
    const details = document.createElement("details"), summary = document.createElement("summary"), list = document.createElement("ul");
    details.className = "year-print-details";
    summary.textContent = `${countNoun(assets.length, "paruoštas metinis maketas", "paruošti metiniai maketai", "paruoštų metinių maketų")} · PDF ir WebP`;
    list.className = "year-print-list";
    for (const asset of assets) {
      const item = document.createElement("li"), title = document.createElement("span"), actions = document.createElement("span");
      title.className = "year-print-list__title";
      title.textContent = `${asset.name} · ${asset.paper || "A3"} · ${asset.landscape ? "horizontalus" : "vertikalus"}`;
      actions.className = "year-print-list__actions";
      for (const [label, href] of [["PDF", asset.pdf], ["WebP", asset.webp]]) {
        const link = document.createElement("a");
        link.href = href;
        link.textContent = label;
        link.setAttribute("aria-label", `${year} m. ${asset.name} · atsisiųsti ${label}`);
        link.setAttribute("download", "");
        actions.append(link);
      }
      item.append(title, actions);
      list.append(item);
    }
    details.append(summary, list);
    host.replaceChildren(details);
  }

  const update = () => {
    const month = Number(selector.value);
    for (const year of [2027, 2028, 2029]) { render(year, month); renderYearFacts(year); }
    status.textContent = `${monthNames[month - 1][0].toLocaleUpperCase("lt-LT")}${monthNames[month - 1].slice(1)} peržiūra: palyginami 2027, 2028 ir 2029 metai. Spustelėkite kortelės mygtuką, kad atvertumėte tą mėnesį.`;
  };
  selector.addEventListener("change", update);
  update();
  fetch("/assets/data/manifest.json").then((response) => {
    if (!response.ok) throw Error("Metinių failų sąrašas nepasiekiamas.");
    return response.json();
  }).then((manifest) => {
    for (const year of [2027, 2028, 2029]) renderYearPrintAssets(year, yearPrintAssets(manifest, year));
  }).catch(() => { /* Server-rendered year links remain available if inventory loading fails. */ });
}
