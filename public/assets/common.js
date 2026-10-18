export function notice(message) {
  const el = document.querySelector("#notice");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(el.timer);
  el.timer = setTimeout(() => (el.hidden = true), 10000);
}

const horoscopeUpdates = document.querySelectorAll("time[data-horoscope-updated]");
if (horoscopeUpdates.length) {
    // This label needs two formatters, not the calendar calculation module.
    const currentDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Vilnius", year: "numeric", month: "2-digit", day: "2-digit",
    });
    const displayDate = new Intl.DateTimeFormat("lt-LT", {
      timeZone: "UTC", year: "numeric", month: "long", day: "numeric",
    });
    const refreshUpdateLabels = () => {
      const parts = Object.fromEntries(currentDay.formatToParts(new Date()).map(({type,value}) => [type,value]));
      const currentDate = `${parts.year}-${parts.month}-${parts.day}`;
      for (const label of horoscopeUpdates) {
        label.textContent = label.dateTime === currentDate
          ? "Šiandien atnaujinta"
          : `Atnaujinta: ${displayDate.format(new Date(`${label.dateTime}T00:00:00Z`))}`;
      }
    };
    refreshUpdateLabels();
    setInterval(refreshUpdateLabels, 60_000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshUpdateLabels();
    });
}

// Fetch an internal page only after a clear navigation intent. This keeps
// idle/mobile connections free while making the next click reuse the response.
const prefetchedPages = new Set();
const prefetchPage = (anchor) => {
  const connection = navigator.connection;
  if (
    prefetchedPages.size >= 2 ||
    connection?.saveData ||
    /^(slow-2g|2g)$/.test(connection?.effectiveType || "") ||
    !anchor ||
    anchor.hasAttribute("download") ||
    anchor.target === "_blank"
  )
    return;
  const url = new URL(anchor.href, location.href);
  if (
    url.origin !== location.origin ||
    url.pathname === location.pathname ||
    url.search ||
    url.hash ||
    /\.(?:pdf|webp|png|jpe?g|svg|ics|json|xml)$/i.test(url.pathname) ||
    prefetchedPages.has(url.pathname)
  )
    return;

  const hint = document.createElement("link");
  hint.rel = "prefetch";
  hint.as = "document";
  hint.href = url.pathname;
  hint.fetchPriority = "low";
  document.head.append(hint);
  prefetchedPages.add(url.pathname);
};
let pendingPrefetch;
const schedulePrefetch = (anchor, delay) => {
  clearTimeout(pendingPrefetch);
  pendingPrefetch = setTimeout(() => prefetchPage(anchor), delay);
};
document.addEventListener(
  "pointerover",
  (event) => {
    if (event.pointerType === "touch") return;
    const anchor = event.target.closest?.("a[href]");
    if (anchor) schedulePrefetch(anchor, 120);
  },
  true,
);
document.addEventListener(
  "pointerout",
  (event) => {
    const anchor = event.target.closest?.("a[href]");
    if (anchor && !anchor.contains(event.relatedTarget)) clearTimeout(pendingPrefetch);
  },
  true,
);
document.addEventListener("pointerdown", () => clearTimeout(pendingPrefetch), true);
document.addEventListener(
  "focusin",
  (event) => {
    const anchor = event.target.closest?.("a[href]");
    if (anchor) schedulePrefetch(anchor, 0);
  },
  true,
);

for (const button of document.querySelectorAll("[data-print]"))
  button.addEventListener("click", () => window.print());
const siteSearch = document.querySelector("#site-search");
const siteSearchResults = document.querySelector("#site-search-results");
const headerSearch = document.querySelector(".header-search");
const siteSearchStatus = document.querySelector("#site-search-status") || document.createElement("div");
const mobileSearch = window.matchMedia("(max-width: 760px)");
const searchToggle = document.createElement("button");
const searchClose = document.createElement("button");
const searchPanel = document.createElement("div");
const allSearchResults = document.createElement("a");
let searchEnginePromise;
let activeSearchOption = -1;
let searchRequest = 0;
function closeNavigation() {
  const toggle = document.querySelector("#nav-toggle");
  toggle?.setAttribute("aria-expanded", "false");
  toggle?.setAttribute("aria-label", "Atverti meniu");
  document.querySelector("#primary-nav")?.classList.remove("nav-open");
}
function updateSearchGeometry() {
  if (!siteSearch || !siteSearchResults || !headerSearch) return;
  let enoughSpace = true;
  if (mobileSearch.matches) {
    const viewport = window.visualViewport;
    const height = viewport?.height ?? window.innerHeight;
    const bottom = (viewport?.offsetTop ?? 0) + height;
    const available = bottom - headerSearch.getBoundingClientRect().bottom - 18;
    const limit = Math.max(0, Math.floor(Math.min(320, height * .45, available)));
    headerSearch.style.setProperty("--search-results-height", `${limit}px`);
    enoughSpace = limit >= 96;
  }
  const visible = headerSearch.classList.contains("search-open") &&
    Boolean(siteSearch.value.trim()) && siteSearchResults.childElementCount > 0 && enoughSpace;
  searchPanel.hidden = !visible;
  siteSearchResults.hidden = !visible;
  siteSearch.setAttribute("aria-expanded", String(visible));
}
function setSearchOpen(open, focus = false, returnFocus = false) {
  if (!siteSearch || !siteSearchResults || !headerSearch) return;
  headerSearch.classList.toggle("search-open", open);
  document.documentElement.classList.toggle("search-active", open && mobileSearch.matches);
  searchToggle.setAttribute("aria-expanded", String(open));
  searchToggle.setAttribute("aria-label", open ? "Užverti paiešką" : "Atverti paiešką");
  if (open && mobileSearch.matches) closeNavigation();
  if (open && focus) siteSearch.focus({ preventScroll: true });
  if (!open) {
    searchRequest++;
    searchPanel.setAttribute("hidden", "");
    siteSearchResults.setAttribute("hidden", "");
    siteSearch.setAttribute("aria-expanded", "false");
    siteSearch.removeAttribute("aria-activedescendant");
    activeSearchOption = -1;
    if (mobileSearch.matches && document.activeElement === siteSearch) siteSearch.blur();
    if (returnFocus && mobileSearch.matches) searchToggle.focus({ preventScroll: true });
  }
  if (open) updateSearchGeometry();
}
if (siteSearch && siteSearchResults && headerSearch) {
  searchToggle.type = "button";
  searchToggle.className = "header-search-toggle icon-button";
  searchToggle.setAttribute("aria-label", "Atverti paiešką");
  searchToggle.setAttribute("aria-controls", "site-search");
  searchToggle.setAttribute("aria-expanded", "false");
  searchToggle.innerHTML = headerSearch.querySelector(".icon")?.outerHTML || "⌕";
  headerSearch.before(searchToggle);
  searchClose.type = "button";
  searchClose.className = "header-search-close icon-button";
  searchClose.setAttribute("aria-label", "Užverti paiešką");
  searchClose.textContent = "×";
  const submit = headerSearch.querySelector('[type="submit"]');
  submit?.classList.remove("visually-hidden");
  submit?.classList.add("header-search-submit");
  if (submit) submit.textContent = "Ieškoti";
  headerSearch.append(searchClose);
  searchPanel.className = "header-search-panel";
  searchPanel.hidden = true;
  allSearchResults.className = "header-search-all";
  searchPanel.append(siteSearchResults, allSearchResults);
  headerSearch.append(searchPanel);
  headerSearch.closest(".site-header")?.classList.add("search-ready");
  siteSearch.setAttribute("role", "combobox");
  siteSearch.setAttribute("aria-autocomplete", "list");
  siteSearch.setAttribute("aria-haspopup", "listbox");
  siteSearch.setAttribute("aria-expanded", "false");
  siteSearch.setAttribute("aria-controls", "site-search-results");
  siteSearch.setAttribute("autocomplete", "off");
  siteSearchResults.setAttribute("role", "listbox");
  siteSearchResults.setAttribute("aria-label", "Paieškos rezultatai");
  siteSearchStatus.id = "site-search-status";
  siteSearchStatus.className = "visually-hidden";
  siteSearchStatus.setAttribute("role", "status");
  siteSearchStatus.setAttribute("aria-live", "polite");
  siteSearchStatus.setAttribute("aria-atomic", "true");
  headerSearch.append(siteSearchStatus);

  searchToggle.addEventListener("click", () => {
    const open = !headerSearch.classList.contains("search-open");
    setSearchOpen(open, open);
  });
  searchClose.addEventListener("click", () => setSearchOpen(false, false, true));
  siteSearch.addEventListener("focus", () => {
    setSearchOpen(true);
    if (siteSearch.value.trim()) renderSearchResults();
  });
  headerSearch.addEventListener("focusout", (event) => {
    // Safari may blur the input before firing a tapped result's click event.
    // A null destination is handled by the outside-click listener instead.
    if (event.relatedTarget && !headerSearch.contains(event.relatedTarget) && event.relatedTarget !== searchToggle)
      setSearchOpen(false);
  });
  headerSearch.addEventListener("submit", () => setSearchOpen(false));

  async function renderSearchResults() {
    const request = ++searchRequest;
    const query = siteSearch.value.trim();
    siteSearchResults.replaceChildren();
    siteSearchStatus.textContent = "";
    activeSearchOption = -1;
    siteSearch.removeAttribute("aria-activedescendant");
    if (!query) {
      updateSearchGeometry();
      return;
    }

    siteSearchStatus.textContent = "Ieškoma visuose puslapiuose…";
    const loading = document.createElement("p");
    loading.className = "header-search-empty";
    loading.textContent = "Ieškoma…";
    siteSearchResults.append(loading);
    allSearchResults.href = `/paieska/?q=${encodeURIComponent(query)}`;
    allSearchResults.textContent = "Visi rezultatai →";
    updateSearchGeometry();
    try {
      searchEnginePromise ||= import("./search-engine.js?v=cd07f2e424fb");
      const { loadSearchIndex, searchPages, normalizeSearchText } = await searchEnginePromise;
      const index = await loadSearchIndex();
      if (request !== searchRequest ||
          normalizeSearchText(siteSearch.value.trim()) !== normalizeSearchText(query)) return;
      const matches = searchPages(index, query);
      const items = matches.slice(0, mobileSearch.matches ? 4 : 7);
      siteSearchResults.replaceChildren();
      for (const [index, item] of items.entries()) {
        const link = document.createElement("a");
        link.href = item.url;
        link.id = `site-search-option-${index}`;
        link.setAttribute("role", "option");
        link.setAttribute("aria-selected", "false");
        link.dataset.searchResult = "true";
        const title = document.createElement("strong");
        title.textContent = item.title;
        link.append(title);
        if (item.description) {
          const detail = document.createElement("small");
          detail.textContent = item.description;
          link.append(detail);
        }
        siteSearchResults.append(link);
      }
      allSearchResults.textContent = matches.length
        ? `Visi rezultatai (${matches.length}) →`
        : "Atverti paieškos puslapį →";

      siteSearchStatus.textContent = matches.length
        ? `Rasta rezultatų: ${matches.length}. Rodyklėmis pasirinkite, Enter atverkite visą sąrašą.`
        : "Rezultatų nerasta. Bandykite trumpesnį žodį arba atverkite visų puslapių paiešką.";
      if (!items.length) {
        const message = document.createElement("p");
        message.className = "header-search-empty";
        message.textContent = "Rezultatų nėra. Bandykite kitą žodį arba datą.";
        siteSearchResults.prepend(message);
      }
      updateSearchGeometry();
    } catch {
      if (request !== searchRequest) return;
      searchEnginePromise = undefined;
      siteSearchResults.replaceChildren();
      const message = document.createElement("p");
      message.className = "header-search-empty";
      message.textContent = "Paieška nepasiekiama. Bandykite dar kartą arba atverkite puslapių sąrašą.";
      siteSearchResults.append(message);
      siteSearchStatus.textContent = message.textContent;
      updateSearchGeometry();
    }
  }
  siteSearch.addEventListener("input", () => {
    setSearchOpen(true);
    return renderSearchResults();
  });
  window.addEventListener("resize", updateSearchGeometry);
  window.visualViewport?.addEventListener("resize", updateSearchGeometry);
  window.visualViewport?.addEventListener("scroll", updateSearchGeometry);
  mobileSearch.addEventListener("change", () => setSearchOpen(false));

  siteSearch.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setSearchOpen(false, false, true);
      return;
    }
    const options = siteSearchResults.hidden ? [] :
      [...siteSearchResults.querySelectorAll('[role="option"]')];
    if (!options.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      activeSearchOption = (activeSearchOption + step + options.length) % options.length;
      for (const [index, option] of options.entries()) {
        const active = index === activeSearchOption;
        option.setAttribute("aria-selected", String(active));
        if (active) {
          siteSearch.setAttribute("aria-activedescendant", option.id);
          option.scrollIntoView({ block: "nearest" });
        }
      }
    } else if (event.key === "Enter" && activeSearchOption >= 0) {
      event.preventDefault();
      options[activeSearchOption]?.click();
    }
  });
}
document.addEventListener("click", (event) => {
  if (!event.target.closest(".header-search, .header-search-toggle")) setSearchOpen(false);
});
document.querySelector("#nav-toggle")?.addEventListener("click", (e) => {
  const b = e.currentTarget,
    open = b.getAttribute("aria-expanded") !== "true";
  const nav = document.querySelector("#primary-nav");
  setSearchOpen(false);
  b.setAttribute("aria-expanded", String(open));
  b.setAttribute("aria-label", open ? "Užverti meniu" : "Atverti meniu");
  nav.classList.toggle("nav-open", open);
  if (open) nav.querySelector("a[href]")?.focus({ preventScroll: true });
  else b.focus({ preventScroll: true });
});

try {
  const preferences =
    JSON.parse(localStorage.getItem("kalendorius365:v1") || "{}").preferences ||
    {};
  document.documentElement.classList.toggle(
    "large-text",
    preferences["large-text"] === true,
  );
  document.documentElement.classList.toggle(
    "high-contrast",
    preferences["high-contrast"] === true,
  );
} catch {}

// Keep active navigation truthful on both desktop and the mobile dock.
const pathname = location.pathname;
for (const link of document.querySelectorAll(".mobile-dock a")) {
  if (link.getAttribute("href") === pathname)
    link.setAttribute("aria-current", "page");
}
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  setSearchOpen(false);
  const toggle = document.querySelector("#nav-toggle");
  if (toggle?.getAttribute("aria-expanded") === "true") toggle.click();
});
