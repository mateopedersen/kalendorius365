import { filterToolInventory } from "./tool-directory-core.js";

const form = document.querySelector("#tool-directory-search");
if (form) {
  const cards = [...document.querySelectorAll("[data-tool-card]")];
  const groups = [...document.querySelectorAll("[data-tool-group]")];
  const buttons = [...document.querySelectorAll("[data-tool-filter]")];
  const query = document.querySelector("#tool-query");
  const count = document.querySelector("#tool-directory-count");
  const empty = document.querySelector("#tool-directory-empty");
  const clear = () => {
    query.value = "";
    for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.toolFilter === "all"));
    update();
    query.focus();
  };
  const update = () => {
    const category = buttons.find((button) => button.getAttribute("aria-pressed") === "true")?.dataset.toolFilter || "all";
    const inventory = cards.map((card) => ({ card, category: card.dataset.toolCategory, search: card.dataset.toolSearch }));
    const visible = new Set(filterToolInventory(inventory, { query: query.value, category }).map((item) => item.card));
    let shown = 0;
    for (const card of cards) {
      const isVisible = visible.has(card);
      card.hidden = !isVisible;
      if (isVisible) shown++;
    }
    for (const group of groups) group.hidden = !group.querySelector("[data-tool-card]:not([hidden])");
    const word = shown % 10 === 1 && shown % 100 !== 11 ? "įrankis" : shown % 10 >= 2 && (shown % 100 < 10 || shown % 100 >= 20) ? "įrankiai" : "įrankių";
    count.textContent = shown ? `Rasta ${shown} ${word} iš ${cards.length}.` : `Pagal šiuos filtrus įrankių nerasta iš ${cards.length}.`;
    empty.hidden = shown !== 0;
  };
  form.addEventListener("submit", (event) => event.preventDefault());
  query.addEventListener("input", update);
  for (const button of buttons) button.addEventListener("click", () => {
    for (const other of buttons) other.setAttribute("aria-pressed", String(other === button));
    update();
  });
  document.querySelector("#tool-clear").addEventListener("click", clear);
  document.querySelector("[data-clear-tools]").addEventListener("click", clear);
  update();
}
