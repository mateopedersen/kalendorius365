import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildContactFormUrl, CONTACT_FORM_URL, CONTACT_TOPICS, safeSourcePage } from "../site/assets/contact.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("contact URLs always use the published form and allow only the six real topics", () => {
  for (const [topic, label] of Object.entries(CONTACT_TOPICS)) {
    const url = new URL(buildContactFormUrl({ topic, embedded: true }));
    assert.equal(url.origin + url.pathname, CONTACT_FORM_URL);
    assert.equal(url.searchParams.get("entry.122884581"), label);
    assert.equal(url.searchParams.get("embedded"), "true");
  }
  for (const topic of ["__proto__", "constructor", "attacker@example.com", "<script>", ""]) {
    const url = new URL(buildContactFormUrl({ topic }));
    assert.equal(url.searchParams.has("entry.122884581"), false);
    assert.equal(url.origin + url.pathname, CONTACT_FORM_URL);
  }
});

test("source prefill strips private query data, normalizes the host and rejects unsafe URLs", () => {
  assert.equal(safeSourcePage("http://www.kalendorius365.lt/sventes/?q=private#id"), "https://kalendorius365.lt/sventes/");
  assert.equal(safeSourcePage("/apie/"), "https://kalendorius365.lt/apie/");
  for (const value of ["javascript:alert(1)", "https://attacker.example/path", "https://kalendorius365.lt:444/path", "https://user:pass@kalendorius365.lt/", "https://kalendorius365.lt/" + "a".repeat(2050)]) {
    assert.equal(safeSourcePage(value), "");
  }
  const url = new URL(buildContactFormUrl({ topic: "date_error", pageUrl: "https://kalendorius365.lt/apie/?q=private#id", name: "private", email: "private@example.com", message: "private message" }));
  assert.equal(url.searchParams.get("entry.1784264088"), "https://kalendorius365.lt/apie/");
  assert.doesNotMatch(url.href, /private/);
});

test("the rendered integration has a titled Google frame and a direct non-JavaScript fallback", () => {
  const page = read("../site/kontaktai/index.html");
  assert.match(page, /schema_type: ContactPage/);
  assert.match(page, /title="Kalendorius365 kontaktinė forma"/);
  assert.match(page, /referrerpolicy="no-referrer"/);
  assert.ok(page.includes(CONTACT_FORM_URL + "?embedded=true&amp;hl=lt"));
  assert.match(page, /mailto:kalendorius365@gmail\.com/);
  assert.doesNotMatch(page, /data-contact-submit|data-contact-form|laiško juodrašt/);
  assert.match(read("../scripts/build.rb"), /frame-src https:\/\/docs\.google\.com;/);
});

test("privacy source describes Forms storage, Gmail notifications and restricted response access", () => {
  for (const path of ["../site/_includes/privacy-policy-lt.html", "../site/privatumas/index.html"]) {
    const privacy = read(path);
    assert.match(privacy, /Formos atsakymai saugomi „Google Forms“/);
    assert.match(privacy, /pranešimai apie naujus atsakymus siunčiami/);
    assert.match(privacy, /Formos atsakymų suvestinė lankytojams neskelbiama/);
    assert.doesNotMatch(privacy, /forma parengia laiško juodraštį/);
  }
});
