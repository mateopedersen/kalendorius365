export function notice(message) {
  const el = document.querySelector("#notice");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(el.timer);
  el.timer = setTimeout(() => (el.hidden = true), 10000);
}
function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
  document
    .querySelector("#theme")
    ?.setAttribute(
      "aria-label",
      mode === "dark" ? "Įjungti šviesią temą" : "Įjungti tamsią temą",
    );
  document.querySelector("#theme")?.setAttribute("aria-pressed", String(mode === "dark"));
}
applyTheme(
  document.documentElement.dataset.theme ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
);
document.querySelector("#theme")?.addEventListener("click", () => {
  const mode =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(mode);
  try {
    const key = "kalendorius365:v1";
    const data = JSON.parse(localStorage.getItem(key) || "{}");
    data.schema = 1;
    data.events ||= [];
    data.tasks ||= [];
    data.notes ||= {};
    data.preferences ||= {};
    data.preferences.theme = mode;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
});

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
let searchIndex;
const searchText = (value) =>
  value
    .toLocaleLowerCase("lt-LT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const siteSearch = document.querySelector("#site-search");
const siteSearchResults = document.querySelector("#site-search-results");
const headerSearch = document.querySelector(".header-search");
const siteSearchStatus = document.querySelector("#site-search-status") || document.createElement("div");
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
let activeSearchOption = -1;
const setSearchOpen = (open, focus = false) => {
  headerSearch?.classList.toggle("search-open", open);
  if (open && focus) siteSearch?.focus({ preventScroll: true });
  if (!open) {
    siteSearchResults?.setAttribute("hidden", "");
    siteSearch?.setAttribute("aria-expanded", "false");
    siteSearch?.removeAttribute("aria-activedescendant");
    if (document.activeElement === siteSearch) siteSearch.blur();
  }
};
siteSearch.addEventListener("focus", () => {
  if (matchMedia("(max-width: 760px)").matches)
    headerSearch.classList.add("search-open");
});
siteSearch?.addEventListener("input", async (e) => {
  const q = searchText(e.target.value.trim());
  siteSearchResults.replaceChildren();
  siteSearchStatus.textContent = "";
  activeSearchOption = -1;
  siteSearch.removeAttribute("aria-activedescendant");
  siteSearch.setAttribute("aria-expanded", String(Boolean(q)));
  siteSearchResults.hidden = !q;
  if (!q) return;
  siteSearchStatus.textContent = "Ieškoma svetainėje…";
  try {
    searchIndex ||= await fetch("/assets/data/search.json").then((response) => {
      if (!response.ok) throw Error("Nepavyko įkelti paieškos rodyklės");
      return response.json();
    });
    if (searchText(siteSearch.value.trim()) !== q) return;
    const words = q.split(/\s+/);
    const items = searchIndex
      .map((item) => {
        const title = searchText(item.title);
        const haystack = searchText(
          `${item.title} ${item.url} ${item.description || ""} ${item.keywords || ""}`,
        );
        if (!words.every((word) => haystack.includes(word))) return null;
        const score =
          (title === q ? 1000 : 0) +
          (title.startsWith(q) ? 160 : 0) +
          (title.includes(q) ? 80 : 0) +
          (item.action ? 40 : 0);
        return { ...item, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "lt"))
      .slice(0, 10);
    siteSearchResults.replaceChildren();
    for (const [index, item] of items.entries()) {
      const link = document.createElement("a");
      link.href = item.url;
      link.id = `site-search-option-${index}`;
      link.setAttribute("role", "option");
      link.setAttribute("aria-selected", "false");
      link.append(document.createElement("strong"));
      link.firstElementChild.textContent = item.title;
      if (item.description) {
        const detail = document.createElement("small");
        detail.textContent = item.description;
        link.append(detail);
      }
      siteSearchResults.append(link);
    }
    if (items.length) siteSearchStatus.textContent = `Rasta rezultatų: ${items.length}. Rodyklėmis pasirinkite, Enter atverkite.`;
    else {
      const message = document.createElement("p");
      message.className = "header-search-empty";
      message.textContent = "Rezultatų nerasta. Bandykite kitą žodį arba datą.";
      siteSearchResults.append(message);
      siteSearchStatus.textContent = "Rezultatų nerasta.";
    }
  } catch {
    siteSearchResults.replaceChildren();
    const message = document.createElement("p");
    message.className = "header-search-empty";
    message.textContent = "Paieška nepasiekiama. Naudokite meniu nuorodas.";
    siteSearchResults.append(message);
    siteSearchStatus.textContent = message.textContent;
  }
});
siteSearch?.addEventListener("keydown", (event) => {
  const options = [...(siteSearchResults?.querySelectorAll('[role="option"]') || [])];
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
  } else if (event.key === "Escape") {
    setSearchOpen(false);
  }
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".header-search"))
    setSearchOpen(false);
});
document.querySelector("#nav-toggle")?.addEventListener("click", (e) => {
  const b = e.currentTarget,
    open = b.getAttribute("aria-expanded") !== "true";
  const nav = document.querySelector("#primary-nav");
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
