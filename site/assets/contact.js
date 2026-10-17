export const CONTACT_EMAIL = "kalendorius365@gmail.com";
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
    if (!["http:", "https:"].includes(url.protocol) || !PAGE_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password) return "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch { return ""; }
}

const singleLine = (value, max) => String(value ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);

export function buildMailtoDraft({ name = "", email = "", topic = "other", pageUrl = "", message = "" } = {}) {
  const key = Object.hasOwn(CONTACT_TOPICS, topic) ? topic : "other";
  const safeName = singleLine(name, 120);
  const safeEmail = singleLine(email, 254);
  const safePage = safeSourcePage(pageUrl);
  const safeMessage = String(message ?? "").trim().slice(0, 3000);
  const subject = `Kalendorius365 — ${CONTACT_TOPICS[key]}`;
  const body = [
    "Žinutė Kalendorius365", "",
    `Vardas: ${safeName || "Nenurodytas"}`,
    `El. paštas: ${safeEmail || "Nenurodytas"}`,
    `Tema: ${CONTACT_TOPICS[key]}`,
    `Puslapis: ${safePage || "Nenurodytas"}`, "",
    "Žinutė:", safeMessage,
  ].join("\n");
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function validationMessage(field) {
  const value = field.value.trim();
  if (field.required && !value) {
    if (field.name === "email") return "Įveskite savo el. pašto adresą.";
    if (field.name === "topic") return "Pasirinkite žinutės temą.";
    if (field.name === "message") return "Parašykite žinutę.";
  }
  if (field.name === "email" && value && field.validity.typeMismatch) return "Įveskite galiojantį el. pašto adresą.";
  if (field.name === "pageUrl" && value && !safeSourcePage(value)) return "Įrašykite galiojantį kalendorius365.lt puslapio adresą su http:// arba https://.";
  if (field.name === "message" && value && !value.replace(/\s/g, "")) return "Parašykite žinutę, ne vien tarpo simbolius.";
  if (field.maxLength > 0 && field.value.length > field.maxLength) return `Sutrumpinkite tekstą iki ${field.maxLength} simbolių.`;
  return "";
}

function initializeContactPage() {
  const form = document.querySelector("[data-contact-form]");
  const fieldset = form?.querySelector("[data-contact-fields]");
  if (!form || !fieldset) return;
  const submit = form.querySelector("[data-contact-submit]");
  const status = form.querySelector("[data-contact-status]");
  const summary = form.querySelector("[data-error-summary]");
  const copyButton = document.querySelector("[data-copy-email]");
  const copyStatus = document.querySelector("[data-copy-status]");
  const fields = [...form.querySelectorAll("input, select, textarea")];

  const updateField = (field, show = false) => {
    const message = validationMessage(field);
    field.setCustomValidity(message);
    if (message && show) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
    const ids = field.getAttribute("aria-describedby")?.split(" ") ?? [];
    const error = document.getElementById(ids[ids.length - 1]);
    if (error) { error.textContent = message; error.hidden = !(message && show); }
    return !message;
  };
  const firstInvalid = () => fields.find((field) => !updateField(field, true));

  fields.forEach((field) => {
    field.addEventListener("input", () => updateField(field, field.dataset.touched === "true"));
    field.addEventListener("change", () => updateField(field, field.dataset.touched === "true"));
    field.addEventListener("blur", () => { field.dataset.touched = "true"; updateField(field, true); });
  });
  form.addEventListener("invalid", (event) => {
    if (!fields.includes(event.target)) return;
    event.target.dataset.touched = "true";
    updateField(event.target, true);
    if (summary) { summary.textContent = "Patikrinkite pažymėtus laukus ir pataisykite juos prieš tęsdami."; summary.hidden = false; }
  }, true);

  const params = new URLSearchParams(window.location.search);
  const topic = params.get("tema");
  if (topic && Object.hasOwn(CONTACT_TOPICS, topic)) {
    const select = form.querySelector('[name="topic"]');
    if (select) select.value = topic;
  }
  const source = safeSourcePage(params.get("puslapis"));
  const pageField = form.querySelector('[name="pageUrl"]');
  if (pageField && source) pageField.value = source;

  document.querySelectorAll("[data-topic]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const key = link.dataset.topic;
      const select = form.querySelector('[name="topic"]');
      if (!select || !Object.hasOwn(CONTACT_TOPICS, key)) return;
      event.preventDefault();
      select.value = key;
      select.dataset.touched = "true";
      updateField(select);
      select.focus({ preventScroll: true });
      form.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      if (status) status.textContent = `Tema pasirinkta: ${CONTACT_TOPICS[key]}.`;
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!submit || submit.disabled) return;
    if (summary) summary.hidden = true;
    const invalid = firstInvalid();
    if (invalid) {
      if (summary) { summary.textContent = "Patikrinkite pažymėtus laukus ir pataisykite juos prieš tęsdami."; summary.hidden = false; }
      invalid.focus();
      invalid.reportValidity();
      return;
    }
    const value = (name) => form.querySelector(`[name="${name}"]`)?.value ?? "";
    const href = buildMailtoDraft({ name:value("name"), email:value("email"), topic:value("topic"), pageUrl:value("pageUrl"), message:value("message") });
    if (status) status.textContent = "El. laiško juodraštis parengtas. Peržiūrėkite jį savo el. pašto programoje ir išsiųskite ten; svetainė žinutės automatiškai neišsiuntė.";
    submit.disabled = true;
    window.location.href = href;
    window.setTimeout(() => { submit.disabled = false; }, 1800);
  });

  copyButton?.addEventListener("click", async () => {
    let copied = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(CONTACT_EMAIL); copied = true; } } catch { copied = false; }
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

  fields.forEach((field) => updateField(field));
  fieldset.disabled = false;
  if (submit) submit.disabled = false;
}
if (typeof document !== "undefined") initializeContactPage();
