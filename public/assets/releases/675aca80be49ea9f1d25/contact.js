export const CONTACT_EMAIL = "kalendorius365@gmail.com";
export const CONTACT_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLScGI5U9JY8NdRizTYWlvi19OG5xLGF40R9kTyNgyJb13zV7zg/viewform";
export const CONTACT_TOPICS = Object.freeze({
  calendar: "Kalendoriai ir atsisiuntimai",
  date_error: "Klaida kalendoriuje ar datoje",
  technical: "Techninė problema",
  namedays: "Vardadieniai ir šventės",
  collaboration: "Bendradarbiavimas",
  other: "Kitas klausimas",
});
const PAGE_HOSTS = new Set(["kalendorius365.lt", "www.kalendorius365.lt"]);

export function safeSourcePage(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) return "";
  try {
    const url = new URL(value.trim(), "https://kalendorius365.lt/kontaktai/");
    if (!["http:", "https:"].includes(url.protocol) || !PAGE_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || url.port) return "";
    url.protocol = "https:";
    url.hostname = "kalendorius365.lt";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch { return ""; }
}

// The two entry identifiers come from Google Forms' own “Pre-fill form” link.
// Never put a visitor's email, name or message into the page's query string.
export function buildContactFormUrl({ topic = "", pageUrl = "", embedded = false } = {}) {
  const url = new URL(CONTACT_FORM_URL);
  url.searchParams.set("hl", "lt");
  if (embedded) url.searchParams.set("embedded", "true");
  if (Object.hasOwn(CONTACT_TOPICS, topic)) url.searchParams.set("entry.122884581", CONTACT_TOPICS[topic]);
  const source = safeSourcePage(pageUrl);
  if (source) url.searchParams.set("entry.1784264088", source);
  if (url.searchParams.has("entry.122884581") || source) url.searchParams.set("usp", "pp_url");
  return url.href;
}

function initializeContactPage() {
  const frame = document.querySelector("[data-contact-frame]");
  if (!frame) return;
  const params = new URLSearchParams(window.location.search);
  const topic = params.get("tema") || "";
  const pageUrl = safeSourcePage(params.get("puslapis"));
  // Keep the static iframe untouched when no prefill is needed, avoiding a reload.
  if (Object.hasOwn(CONTACT_TOPICS, topic) || pageUrl) frame.src = buildContactFormUrl({ topic, pageUrl, embedded: true });
  document.querySelectorAll("[data-open-contact-form]").forEach((link) => {
    link.href = buildContactFormUrl({ topic, pageUrl });
  });
  document.querySelectorAll("[data-topic]").forEach((link) => {
    link.href = buildContactFormUrl({ topic: link.dataset.topic, pageUrl });
  });
  const sourceNote = document.querySelector("[data-contact-source]");
  const sourceLink = document.querySelector("[data-contact-source-link]");
  if (pageUrl && sourceNote && sourceLink) {
    sourceLink.textContent = pageUrl;
    sourceLink.href = pageUrl;
    sourceNote.hidden = false;
  }
  const copyButton = document.querySelector("[data-copy-email]");
  const copyStatus = document.querySelector("[data-copy-status]");
  copyButton?.addEventListener("click", async () => {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(CONTACT_EMAIL); copied = true; }
    } catch { copied = false; }
    if (!copied) {
      const temporary = document.createElement("textarea");
      temporary.value = CONTACT_EMAIL;
      temporary.setAttribute("readonly", "");
      temporary.style.position = "fixed";
      temporary.style.insetInlineStart = "-9999px";
      document.body.append(temporary);
      temporary.select();
      try { copied = document.execCommand("copy"); } catch { copied = false; }
      temporary.remove();
    }
    if (copyStatus) copyStatus.textContent = copied ? "El. pašto adresas nukopijuotas." : "Nepavyko nukopijuoti. Pažymėkite adresą ir kopijuokite ranka.";
  });
}
if (typeof document !== "undefined") initializeContactPage();
