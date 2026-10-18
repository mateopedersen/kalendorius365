import { loadSearchIndex, searchPages } from "./search-engine.js?v=18ae1e634221";

const form = document.querySelector("#site-search-page-form");
const input = document.querySelector("#site-search-page-query");
const category = document.querySelector("#site-search-category");
const resultList = document.querySelector("#site-search-page-results");
const resultHeading = document.querySelector("#site-search-page-heading");
const status = document.querySelector("#site-search-page-status");
const pagination = document.querySelector("#site-search-pagination");
const clearButton = document.querySelector("#site-search-clear");
const pageSize = 18;
const params = new URLSearchParams(location.search);
let index = [];
let currentPage = 1;
let pendingRender;

const categoryLabels = {
  calendar: "Kalendoriai",
  holiday: "Šventės",
  horoscope: "Horoskopai",
  astronomy: "Astronomija",
  planning: "Planavimas ir darbo laikas",
  school: "Mokykla",
  tools: "Įrankiai",
  privacy: "Svetainės informacija",
  home: "Pagrindinis puslapis",
};

function resultCountLabel(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 19) return "rezultatų";
  if (last === 1) return "rezultatas";
  if (last >= 2 && last <= 9) return "rezultatai";
  return "rezultatų";
}

input.value = params.get("q") || "";
category.value = params.get("skiltis") || "all";

function updateUrl() {
  const next = new URL(location.href);
  const query = input.value.trim();
  if (query) next.searchParams.set("q", query);
  else next.searchParams.delete("q");
  if (category.value !== "all") next.searchParams.set("skiltis", category.value);
  else next.searchParams.delete("skiltis");
  history.replaceState({}, "", `${next.pathname}${next.search}${next.hash}`);
}

function browsePages() {
  return index
    .filter((item) => category.value === "all" || item.category === category.value)
    .sort((a, b) => a.title.localeCompare(b.title, "lt"));
}

function renderPagination(totalPages) {
  pagination.replaceChildren();
  if (totalPages <= 1) return;
  const previous = document.createElement("button");
  previous.type = "button";
  previous.textContent = "← Ankstesnis";
  previous.disabled = currentPage === 1;
  previous.addEventListener("click", () => { currentPage--; render(); });
  const pageNumber = document.createElement("span");
  pageNumber.textContent = `${currentPage} / ${totalPages}`;
  pageNumber.setAttribute("aria-current", "page");
  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "Kitas →";
  next.disabled = currentPage === totalPages;
  next.addEventListener("click", () => { currentPage++; render(); });
  pagination.append(previous, pageNumber, next);
}

function render() {
  const query = input.value.trim();
  updateUrl();
  const allResults = query
    ? searchPages(index, query, { category: category.value })
    : browsePages();
  const totalPages = Math.max(1, Math.ceil(allResults.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * pageSize;
  const visible = allResults.slice(start, start + pageSize);
  resultList.replaceChildren();
  resultHeading.textContent = query ? `„${query}“ paieškos rezultatai` : "Visi svetainės puslapiai";
  status.textContent = allResults.length
    ? `Rasta ${allResults.length} ${resultCountLabel(allResults.length)}. Rodoma ${start + 1}–${start + visible.length}.`
    : "Rezultatų nerasta. Pabandykite trumpesnį žodį, kitą rašybą arba pasirinkite kitą skiltį.";
  for (const item of visible) {
    const li = document.createElement("li");
    li.className = "search-page-result";
    const link = document.createElement("a");
    link.href = item.url;
    const label = document.createElement("span");
    label.className = "search-page-result__category";
    label.textContent = categoryLabels[item.category] || "Svetainės skiltis";
    const title = document.createElement("h3");
    title.textContent = item.title;
    const description = document.createElement("p");
    description.textContent = item.description || item.headings || "Atverti svetainės puslapį.";
    const url = document.createElement("span");
    url.className = "search-page-result__url";
    url.textContent = item.url;
    link.append(label, title, description, url);
    li.append(link);
    resultList.append(li);
  }
  renderPagination(totalPages);
}

function scheduleRender() {
  clearTimeout(pendingRender);
  currentPage = 1;
  pendingRender = setTimeout(render, 80);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  render();
  resultList.focus({ preventScroll: true });
});
input.addEventListener("input", scheduleRender);
category.addEventListener("change", scheduleRender);
clearButton.addEventListener("click", () => {
  input.value = "";
  category.value = "all";
  currentPage = 1;
  input.focus();
  render();
});
document.querySelectorAll("[data-search-query]").forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.dataset.searchQuery || "";
    category.value = "all";
    currentPage = 1;
    render();
    input.focus();
  });
});

try {
  index = await loadSearchIndex();
  render();
  if (input.value) input.focus({ preventScroll: true });
} catch {
  status.textContent = "Paieškos rodyklės įkelti nepavyko. Atnaujinkite puslapį arba naudokitės meniu.";
}
