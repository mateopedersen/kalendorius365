import { normalizeSearchText } from "../search-engine.js";

const directory = document.querySelector("[data-holiday-directory]");
if (directory) {
  const controls = directory.querySelector("[data-lh-controls]");
  const query = directory.querySelector("#lh-query");
  const year = directory.querySelector("#lh-year");
  const filters = [...controls.querySelectorAll("[data-lh-filter]")];
  const grid = directory.querySelector(".lh-guide-grid");
  const records = [...grid.querySelectorAll("[data-lh-guide]")].map((element) => ({
    element,
    date: element.querySelector(".lh-guide__date"),
    yearLink: element.querySelector("[data-lh-year-link]"),
    description: normalizeSearchText(element.querySelector("h3").textContent + " " + element.querySelector("p").textContent),
  }));
  const count = directory.querySelector("[data-lh-count]");
  const empty = directory.querySelector("[data-lh-empty]");
  let category = "all";

  function update() {
    const terms = normalizeSearchText(query.value).split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const record of records) {
      const { element, date, description, yearLink } = record;
      date.textContent = date.getAttribute("data-date-" + year.value);
      if (yearLink) {
        const parameter = year.selectedIndex === 0 ? "" : "?metai=" + year.value;
        yearLink.href = yearLink.pathname + parameter;
      }
      const searchable = description + " " + normalizeSearchText(date.textContent);
      const matches = (category === "all" || element.dataset.lhGuide === category) &&
        terms.every((term) => searchable.includes(term));
      element.hidden = !matches;
      if (matches) visible += 1;
    }
    count.textContent = "Rodoma " + visible + " iš " + records.length + " dienų";
    empty.hidden = visible !== 0;
  }

  for (const filter of filters) {
    filter.addEventListener("click", () => {
      category = filter.dataset.lhFilter;
      for (const button of filters) button.setAttribute("aria-pressed", String(button === filter));
      update();
    });
  }
  query.addEventListener("input", update);
  year.addEventListener("change", () => {
    const field = "data-start-" + year.value;
    records.sort((a, b) => a.date.getAttribute(field).localeCompare(b.date.getAttribute(field)));
    grid.append(...records.map(({ element }) => element));
    update();
  });
  update();
  controls.hidden = false;
}
