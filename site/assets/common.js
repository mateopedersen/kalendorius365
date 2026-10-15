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
try {
  applyTheme(
    localStorage.getItem("k365:theme") ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  );
} catch {}
document.querySelector("#theme")?.addEventListener("click", () => {
  const mode =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(mode);
  try {
    localStorage.setItem("k365:theme", mode);
  } catch {}
});
for (const button of document.querySelectorAll("[data-print]"))
  button.addEventListener("click", () => window.print());
let searchIndex;
document.querySelector("#site-search")?.addEventListener("input", async (e) => {
  const q = e.target.value.trim().toLocaleLowerCase("lt-LT"),
    host = document.querySelector("#site-search-results");
  host.replaceChildren();
  host.hidden = !q;
  if (!q) return;
  try {
    searchIndex ||= await fetch("/assets/data/search.json").then((r) =>
      r.json(),
    );
    const items = searchIndex
      .filter((x) => x.title.toLocaleLowerCase("lt-LT").includes(q))
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
  b.setAttribute("aria-expanded", String(open));
  b.setAttribute("aria-label", open ? "Užverti meniu" : "Atverti meniu");
  document.querySelector("#primary-nav").classList.toggle("nav-open", open);
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
