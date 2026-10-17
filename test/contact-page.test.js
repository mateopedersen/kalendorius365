import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildMailtoDraft, CONTACT_EMAIL, safeSourcePage } from "../site/assets/contact.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("contact page contains its metadata, the required inbox, and working destinations", () => {
  const page = read("../site/kontaktai/index.html");
  assert.match(page, /schema_type: ContactPage/);
  assert.match(page, /title: "Kontaktai – susisiekite su mumis"/);
  assert.match(page, /mailto:kalendorius365@gmail\.com/);
  for (const href of ["/menesiai/", "/sventes/", "/irankiai/", "/apie/"]) assert.ok(page.includes(`href="${href}"`));
  for (const topic of ["calendar", "date_error", "technical", "namedays", "collaboration", "other"]) assert.ok(page.includes(`data-topic="${topic}"`));
});

test("mailto draft encodes Lithuanian, treats content as plain text, and fixes the subject topic", () => {
  const href = buildMailtoDraft({
    name: "Ieva\nBcc: attacker@example.com",
    email: "ieva@example.com",
    topic: "date_error",
    pageUrl: "https://kalendorius365.lt/sventes/velykos/?q=private#data",
    message: "Data netiksli — patikrinkite, prašau.\nAntroji eilutė <script>alert(1)</script>",
  });
  const parsed = new URL(href);
  assert.equal(parsed.protocol, "mailto:");
  assert.equal(parsed.pathname, CONTACT_EMAIL);
  assert.equal(parsed.searchParams.get("subject"), "Kalendorius365 — Klaida kalendoriuje ar datoje");
  const body = parsed.searchParams.get("body");
  assert.match(body, /Vardas: Ieva Bcc: attacker@example\.com/);
  assert.match(body, /Puslapis: https:\/\/kalendorius365\.lt\/sventes\/velykos\//);
  assert.match(body, /Data netiksli — patikrinkite, prašau\./);
  assert.match(body, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(body, /\nBcc:/);
});

test("source page parameter accepts only canonical HTTP(S) pages and drops query data", () => {
  assert.equal(safeSourcePage("https://kalendorius365.lt/sventes/?q=private#id"), "https://kalendorius365.lt/sventes/");
  assert.equal(safeSourcePage("/apie/"), "https://kalendorius365.lt/apie/");
  assert.equal(safeSourcePage("javascript:alert(1)"), "");
  assert.equal(safeSourcePage("https://attacker.example/path"), "");
  assert.equal(safeSourcePage("https://user:pass@kalendorius365.lt/"), "");
  assert.equal(safeSourcePage("https://kalendorius365.lt/" + "a".repeat(2050)), "");
});

test("privacy wording matches the mail-draft flow and updated Gmail contact", () => {
  const privacy = read("../site/privatumas/index.html");
  assert.match(privacy, /Kontaktų puslapio forma parengia laiško juodraštį/);
  assert.match(privacy, /kalendorius365@gmail\.com/);
  assert.match(privacy, /Google/);
});
