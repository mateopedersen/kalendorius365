import { normalizeToolSearchText } from "../tool-directory-core.js";

const printFinder = document.querySelector("[data-print-finder]");
if (printFinder) {
  const find = (name) => printFinder.querySelector(`[data-print-${name}]`);
  const year = find("year");
  const period = find("period");
  const design = find("design");
  const status = find("status");
  const result = find("result");
  const catalogLink = find("collection");
  const editorLink = find("editor");
  const image = find("image");
  let catalog;
  let loading = true;
  let choices = [];

  function updateFiles() {
    const choice = choices[design.selectedIndex];
    if (!choice) return;
    const name = `${year.value} m. · ${period.selectedOptions[0].text} · ${choice.name}`;
    find("name").textContent = choice.name;
    find("paper").textContent = `${choice.paper} · ${choice.landscape ? "Gulsčias" : "Stačias"}`;
    image.alt = name;
    image.src = choice.preview;
    find("preview").href = choice.webp;
    find("pdf").href = choice.pdf;
    find("webp").href = choice.webp;
    find("open").href = choice.pdf;
  }

  function updatePeriod() {
    const month = period.selectedOptions[0].dataset.monthSlug;
    const screenOnly = year.value === "2030";
    const fragment = screenOnly ? "" : month ? "#perziura" : "#metiniai-sablonai";
    catalogLink.href = `/${year.value}/${month ? month + "/" : ""}${fragment}`;
    catalogLink.textContent = screenOnly ? "Peržiūrėti kalendorių" : "Peržiūrėti visus maketus";
    editorLink.href = `/kurti-kalendoriu/?metai=${year.value}&menuo=${period.value}`;

    const selectedDesign = design.value;
    choices = catalog?.[`${year.value}/${period.value}`] ?? [];
    design.replaceChildren(...choices.map((item) => new Option(`${item.design}. ${item.name}`, item.design)));
    if (choices.some((item) => item.design === selectedDesign)) design.value = selectedDesign;
    const hasFiles = choices.length > 0;
    find("design-field").hidden = !hasFiles;
    result.hidden = !hasFiles;
    editorLink.hidden = hasFiles || loading;

    if (hasFiles) {
      status.textContent = `Galite rinktis iš ${choices.length} paruoštų maketų.`;
      updateFiles();
    } else if (loading) {
      status.textContent = "Įkeliami maketai…";
    } else if (catalog) {
      status.textContent = "Šio laikotarpio kalendorių galite susikurti ir atsisiųsti pasirinkę maketą kūrimo įrankyje.";
    } else {
      status.textContent = "Maketų sąrašo įkelti nepavyko. Kalendorių galite atverti atskirame puslapyje.";
    }
  }

  year.addEventListener("change", updatePeriod);
  period.addEventListener("change", updatePeriod);
  design.addEventListener("change", updateFiles);
  updatePeriod();
  printFinder.hidden = false;
  fetch("/assets/data/print-catalog.json")
    .then((response) => {
      if (!response.ok) throw new Error("Maketų sąrašas nepasiekiamas.");
      return response.json();
    })
    .then((inventory) => { catalog = inventory; })
    .catch(() => { /* The calendar and editor links remain available. */ })
    .finally(() => { loading = false; updatePeriod(); });
}

const eventFinder = document.querySelector("[data-event-finder]");
if (eventFinder) {
  const form = eventFinder.querySelector("form");
  const status = eventFinder.querySelector("[data-event-status]");
  const reset = eventFinder.querySelector("[data-event-reset]");
  const groups = [...document.querySelectorAll("[data-event-group]")].map((section) => ({
    section,
    shortcut: document.querySelector(`.local-event-nav a[href="#${section.id}"]`),
    cards: [...section.querySelectorAll("[data-event-city]")].map((card) => ({
      card,
      search: normalizeToolSearchText(card.querySelector("h3").textContent),
    })),
  }));
  const total = groups.reduce((size, group) => size + group.cards.length, 0);

  function filterEvents() {
    const terms = normalizeToolSearchText(form.elements.query.value).split(/\s+/).filter(Boolean);
    const city = form.elements.city.value;
    const dateStatus = form.elements.status.value;
    let visible = 0;
    for (const { section, shortcut, cards } of groups) {
      let matching = 0;
      for (const { card, search } of cards) {
        const match = (!dateStatus || section.dataset.eventGroup === dateStatus) &&
          (!city || card.dataset.eventCity === city) && terms.every((term) => search.includes(term));
        card.hidden = !match;
        if (match) matching++;
      }
      section.hidden = matching === 0;
      if (shortcut) shortcut.hidden = section.hidden;
      visible += matching;
    }
    status.textContent = visible ? `Rodoma ${visible} iš ${total} renginių.` : "Renginių nerasta. Pakeiskite paiešką arba išvalykite filtrus.";
    reset.hidden = !form.elements.query.value && !city && !dateStatus;
  }

  form.addEventListener("input", filterEvents);
  form.addEventListener("change", filterEvents);
  form.addEventListener("submit", (event) => { event.preventDefault(); filterEvents(); });
  reset.addEventListener("click", () => { form.reset(); filterEvents(); form.elements.query.focus(); });
  filterEvents();
  eventFinder.hidden = false;
}
