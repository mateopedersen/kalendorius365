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

export function initializeContactPage(doc = document, search = window.location.search) {
  const frame = doc.querySelector("[data-contact-frame]");
  if (!frame) return;
  const params = new URLSearchParams(search);
  const pageUrl = safeSourcePage(params.get("puslapis"));
  const launch = doc.querySelector("[data-contact-launch]");
  const launchLabel = doc.querySelector("[data-contact-launch-label]");
  const loading = doc.querySelector("[data-contact-loading]");
  const topics = doc.querySelector("[data-contact-topics]");
  const topicStatus = doc.querySelector("[data-contact-topic-status]");
  const topicLinks = [...doc.querySelectorAll("[data-topic]")];
  const externalLinks = doc.querySelectorAll("[data-open-contact-form]");
  let waiting = false;
  let slowLoadTimer;

  function selectTopic(topic) {
    const label = Object.hasOwn(CONTACT_TOPICS, topic) ? CONTACT_TOPICS[topic] : "";
    frame.dataset.src = buildContactFormUrl({ topic, pageUrl, embedded: true });
    const externalUrl = buildContactFormUrl({ topic, pageUrl });
    externalLinks.forEach(link => { link.href = externalUrl; });
    topicLinks.forEach(link => {
      if (link.dataset.topic === topic) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
    if (topicStatus) {
      topicStatus.hidden = !label;
      topicStatus.textContent = label ? `Pasirinkta tema – ${label}` : "";
    }
  }

  topicLinks.forEach(link => {
    link.href = buildContactFormUrl({ topic: link.dataset.topic, pageUrl });
    link.addEventListener("click", event => {
      if (!launch || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      selectTopic(link.dataset.topic);
    });
  });
  selectTopic(params.get("tema") || "");

  // Keep the frame alive when it is collapsed so a partly written message survives.
  if (launch) {
    launch.hidden = false;
    launch.addEventListener("click", () => {
      const opening = frame.hidden;
      frame.hidden = !opening;
      launch.setAttribute("aria-expanded", String(opening));
      if (launchLabel) launchLabel.textContent = opening ? "Suskleisti formą" : "Atverti kontaktų formą";
      if (opening && !frame.getAttribute("src")) {
        if (topics) topics.hidden = true;
        waiting = true;
        frame.setAttribute("aria-busy", "true");
        frame.addEventListener("load", () => {
          clearTimeout(slowLoadTimer);
          waiting = false;
          if (loading) loading.hidden = true;
          frame.setAttribute("aria-busy", "false");
        }, { once: true });
        frame.src = frame.dataset.src;
        if (loading) {
          slowLoadTimer = setTimeout(() => {
            loading.textContent = "Forma atveriama ilgiau nei įprastai. Galite ją atidaryti naujame skirtuke arba rašyti el. paštu.";
          }, 8000);
        }
      }
      if (loading) loading.hidden = !opening || !waiting;
    });
  }
  const sourceNote = doc.querySelector("[data-contact-source]");
  const sourceLink = doc.querySelector("[data-contact-source-link]");
  if (pageUrl && sourceNote && sourceLink) {
    sourceLink.textContent = pageUrl;
    sourceLink.href = pageUrl;
    sourceNote.hidden = false;
  }
  const copyButton = doc.querySelector("[data-copy-email]");
  const copyStatus = doc.querySelector("[data-copy-status]");
  if (copyButton) copyButton.hidden = false;
  copyButton?.addEventListener("click", async () => {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(CONTACT_EMAIL); copied = true; }
    } catch { copied = false; }
    if (!copied) {
      const temporary = doc.createElement("textarea");
      temporary.value = CONTACT_EMAIL;
      temporary.setAttribute("readonly", "");
      temporary.style.position = "fixed";
      temporary.style.insetInlineStart = "-9999px";
      doc.body.append(temporary);
      temporary.select();
      try { copied = doc.execCommand("copy"); } catch { copied = false; }
      temporary.remove();
    }
    if (copyStatus) copyStatus.textContent = copied ? "El. pašto adresas nukopijuotas." : "Nepavyko nukopijuoti. Pažymėkite adresą ir kopijuokite ranka.";
  });
}
if (typeof document !== "undefined") initializeContactPage();
