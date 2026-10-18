import { loadSearchIndex, searchPages } from "/assets/releases/675aca80be49ea9f1d25/search-engine.js";

const form = document.querySelector("#site-search-page-form");
const input = document.querySelector("#site-search-page-query");
const category = document.querySelector("#site-search-category");
const resultList = document.querySelector("#site-search-page-results");
const resultHeading = document.querySelector("#site-search-page-heading");
const status = document.querySelector("#site-search-page-status");
const pagination = document.querySelector("#site-search-pagination");
const clearButton = document.querySelector("#site-search-clear");
const pageSize = 18;
let index;
let currentPage = 1;
let pendingRender;
let loadingPromise;
input.maxLength = 256;
const retryButton = document.createElement("button");
retryButton.type = "button";
retryButton.textContent = "Bandyti dar kartą";
retryButton.hidden = true;
retryButton.addEventListener("click", () => renderWhenReady());
status.after(retryButton);

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
  const lastTwo = count % 100, last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 19) return "rezultatų";
  if (last === 1) return "rezultatas";
  return last >= 2 && last <= 9 ? "rezultatai" : "rezultatų";
}

function readUrl() {
  const params = new URLSearchParams(location.search);
  input.value = (params.get("q") || "").slice(0, 256);
  const selected = params.get("skiltis") || "all";
  category.value = [...category.options].some(option => option.value === selected) ? selected : "all";
  const requestedPage = Number(params.get("puslapis"));
  currentPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
}

function updateUrl(mode = "replace") {
  const next = new URL(location.href);
  const query = input.value.trim();
  if (query) next.searchParams.set("q", query); else next.searchParams.delete("q");
  if (category.value !== "all") next.searchParams.set("skiltis", category.value); else next.searchParams.delete("skiltis");
  if (currentPage > 1) next.searchParams.set("puslapis", currentPage); else next.searchParams.delete("puslapis");
  const path = `${next.pathname}${next.search}${next.hash}`;
  if (path !== `${location.pathname}${location.search}${location.hash}`)
    history[mode === "push" ? "pushState" : "replaceState"]({}, "", path);
}

function browsePages() {
  return index.filter(item => category.value === "all" || item.category === category.value)
    .sort((a, b) => a.title.localeCompare(b.title, "lt"));
}

function renderPagination(totalPages) {
  pagination.replaceChildren();
  if (totalPages <= 1) return;
  const previous = document.createElement("button");
  previous.type = "button"; previous.textContent = "← Ankstesnis"; previous.disabled = currentPage === 1;
  previous.addEventListener("click", () => { currentPage--; render({ historyMode: "push", focusResults: true }); });
  const pageNumber = document.createElement("span");
  pageNumber.textContent = `${currentPage} / ${totalPages}`;
  pageNumber.setAttribute("aria-current", "page");
  const next = document.createElement("button");
  next.type = "button"; next.textContent = "Kitas →"; next.disabled = currentPage === totalPages;
  next.addEventListener("click", () => { currentPage++; render({ historyMode: "push", focusResults: true }); });
  pagination.append(previous, pageNumber, next);
}

function render({ historyMode = "replace", focusResults = false, preserveUrl = false } = {}) {
  if (!index) return;
  const query = input.value.trim();
  const allResults = query ? searchPages(index, query, { category: category.value }) : browsePages();
  const totalPages = Math.max(1, Math.ceil(allResults.length / pageSize));
  currentPage = Math.max(1, Math.min(currentPage, totalPages));
  if (!preserveUrl) updateUrl(historyMode);
  const start = (currentPage - 1) * pageSize;
  const visible = allResults.slice(start, start + pageSize);
  resultList.replaceChildren();
  resultHeading.textContent = query ? `„${query}“ paieškos rezultatai` : "Visi svetainės puslapiai";
  status.textContent = allResults.length
    ? `Rasta ${allResults.length} ${resultCountLabel(allResults.length)}. Rodoma ${start + 1}–${start + visible.length}.`
    : "Rezultatų nerasta. Pabandykite trumpesnį žodį, kitą rašybą arba pasirinkite kitą skiltį.";
  for (const item of visible) {
    const li = document.createElement("li"); li.className = "search-page-result";
    const link = document.createElement("a"); link.href = item.url;
    const label = document.createElement("span"); label.className = "search-page-result__category";
    label.textContent = categoryLabels[item.category] || "Svetainės skiltis";
    const title = document.createElement("h3"); title.textContent = item.title;
    const description = document.createElement("p"); description.textContent = item.description || item.headings || "Atverti svetainės puslapį.";
    const url = document.createElement("span"); url.className = "search-page-result__url"; url.textContent = item.url;
    link.append(label, title, description, url); li.append(link); resultList.append(li);
  }
  renderPagination(totalPages);
  if (focusResults) resultList.focus({ preventScroll: true });
}

async function ensureIndex() {
  if (index) return true;
  if (loadingPromise) return loadingPromise;
  retryButton.hidden = true;
  status.textContent = "Įkeliama paieškos rodyklė…";
  resultList.setAttribute("aria-busy", "true");
  loadingPromise = loadSearchIndex().then(data => {
    index = data;
    return true;
  }).catch(() => {
    status.textContent = "Paieškos rodyklės įkelti nepavyko. Bandykite dar kartą arba naudokitės svetainės meniu.";
    retryButton.hidden = false;
    return false;
  }).finally(() => {
    loadingPromise = undefined;
    resultList.setAttribute("aria-busy", "false");
  });
  return loadingPromise;
}

async function renderWhenReady(options = {}) {
  if (await ensureIndex()) render(options);
}

function scheduleRender() {
  clearTimeout(pendingRender);
  currentPage = 1;
  pendingRender = setTimeout(() => renderWhenReady(), 100);
}

form.addEventListener("submit", event => {
  event.preventDefault(); clearTimeout(pendingRender); currentPage = 1;
  renderWhenReady({ historyMode: "push", focusResults: true });
});
input.addEventListener("input", scheduleRender);
category.addEventListener("change", () => { clearTimeout(pendingRender); currentPage = 1; renderWhenReady({ historyMode: "push" }); });
clearButton.addEventListener("click", () => {
  clearTimeout(pendingRender); input.value = ""; category.value = "all"; currentPage = 1; input.focus();
  renderWhenReady({ historyMode: "push" });
});
document.querySelectorAll("[data-search-query]").forEach(button => {
  button.addEventListener("click", () => {
    clearTimeout(pendingRender); input.value = (button.dataset.searchQuery || "").slice(0, 256);
    category.value = "all"; currentPage = 1; input.focus(); renderWhenReady({ historyMode: "push" });
  });
});
window.addEventListener("popstate", () => {
  clearTimeout(pendingRender); readUrl(); renderWhenReady({ preserveUrl: true });
});
readUrl();
await renderWhenReady();
