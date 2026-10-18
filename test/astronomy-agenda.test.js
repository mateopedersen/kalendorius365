import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAstronomyICS, composeAstronomyEvents, eventLocalParts } from "../site/assets/astronomy-agenda-core.js";
import { importICS } from "../site/assets/ics.js";

const seasons = JSON.parse(readFileSync(new URL("../site/assets/data/astronomy/seasons-utc.json", import.meta.url), "utf8"));
const phases = JSON.parse(readFileSync(new URL("../site/assets/data/astronomy/moon-phases-utc.json", import.meta.url), "utf8"));
const page = readFileSync(new URL("../site/astronominis-kalendorius/index.html", import.meta.url), "utf8");
const ui = readFileSync(new URL("../site/assets/astronomy-agenda.js", import.meta.url), "utf8");
const core = readFileSync(new URL("../site/assets/astronomy-agenda-core.js", import.meta.url), "utf8");

test("agenda combines only sourced seasonal moments and main phases in the selected years", () => {
  const events = composeAstronomyEvents(seasons, phases);
  assert(events.length > 150);
  assert.deepEqual(events, [...events].sort((a, b) => a.instant - b.instant));
  for (const year of [2027, 2028, 2029]) {
    const current = events.filter((event) => Number(eventLocalParts(event.instant).year) === year);
    assert.equal(current.filter((event) => event.kind === "season").length, 4);
    assert(current.some((event) => event.kind === "moon" && event.phase === "full"));
  }
  assert.equal(events.some((event) => Number(eventLocalParts(event.instant).year) === 2030), false);
});

test("month filtering follows Europe/Vilnius local date across a UTC month boundary", () => {
  const parts = eventLocalParts(Date.parse("2027-03-31T22:30:00Z"));
  assert.deepEqual(parts, { year: "2027", month: "04", day: "01" });
});

test("astronomy ICS preserves the exact UTC instant and can be reopened by the site importer", () => {
  const event = composeAstronomyEvents(seasons, phases).find((item) => item.id === "season-2027-spring-equinox");
  const ics = buildAstronomyICS([event], Date.UTC(2026, 9, 18));
  assert.match(ics, /DTSTART:20270320T202500Z\r\n/);
  assert.match(ics, /UID:season-2027-spring-equinox@kalendorius365\.lt\r\n/);
  assert.doesNotMatch(ics, /DTEND:/);
  const reopened = importICS(ics);
  assert.deepEqual(reopened.rejected, []);
  assert.equal(reopened.imported.length, 1);
  assert.equal(Date.parse(reopened.imported[0].start + "+02:00"), event.instant);
  for (const line of ics.split("\r\n")) assert(Buffer.byteLength(line, "utf8") <= 75, `ICS line exceeds 75 octets: ${line}`);
});

test("long Lithuanian ICS labels fold on UTF-8 character boundaries", () => {
  const event = {
    id: "moon-sample-2027", kind: "moon", title: "Žėrinčio Mėnulio fazė, išsami apžvalga ".repeat(5),
    instant: Date.parse("2027-05-01T12:00:00Z"),
  };
  const ics = buildAstronomyICS([event], Date.UTC(2026, 9, 18));
  for (const line of ics.split("\r\n")) assert(Buffer.byteLength(line, "utf8") <= 75, `ICS line exceeds 75 octets: ${line}`);
  assert(ics.includes("Žėrinčio Mėnulio fazė\\, išsami apžvalga"));
});

test("astronomy page provides scoped filters, exact-source time and a filtered calendar export", () => {
  assert.match(page, /astronomy_agenda: true/);
  for (const id of ["astro-year", "astro-month", "astro-kind", "astro-event-list", "astro-download-ics"]) assert.match(page, new RegExp(`id="${id}"`));
  assert.match(ui, /seasons-utc\.json/);
  assert.match(ui, /moon-phases-utc\.json/);
  assert.match(core, /Europe\/Vilnius/);
  assert.match(ui, /buildAstronomyICS\(filtered\)/);
});
