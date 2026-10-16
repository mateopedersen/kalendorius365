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
}
applyTheme(matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
document.querySelector("#theme")?.addEventListener("click", () => {
  const mode =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(mode);
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
document.querySelector("#site-search")?.addEventListener("input", async (e) => {
  const q = searchText(e.target.value.trim()),
    host = document.querySelector("#site-search-results");
  host.replaceChildren();
  host.hidden = !q;
  if (!q) return;
  try {
    searchIndex ||= await fetch("/assets/data/search.json").then((r) =>
      r.json(),
    );
    if (searchText(e.target.value.trim()) !== q) return;
    host.replaceChildren();
    const items = searchIndex
      .filter((x) =>
        q
          .split(/\s+/)
          .every((word) => searchText(x.title + " " + x.url).includes(word)),
      )
      .slice(0, 10);
    for (const x of items) {
      const a = document.createElement("a");
      a.href = x.url;
      a.textContent = x.title;
      host.append(a);
    }
    if (!items.length) {
      const s = document.createElement("small");
      s.textContent = "Rezultatų nerasta.";
      host.append(s);
    }
  } catch {
    host.textContent = "Paieška nepasiekiama. Naudokite meniu nuorodas.";
  }
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".header-search"))
    document.querySelector("#site-search-results")?.setAttribute("hidden", "");
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
  const search = document.querySelector("#site-search-results");
  if (search) search.hidden = true;
  const toggle = document.querySelector("#nav-toggle");
  if (toggle?.getAttribute("aria-expanded") === "true") toggle.click();
});
