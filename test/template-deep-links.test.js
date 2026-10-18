import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schoolTemplates = readFileSync(new URL("../site/pamoku-tvarkarascio-sablonai/index.html", import.meta.url), "utf8");
const shiftTemplates = readFileSync(new URL("../site/darbo-grafiko-sablonai/index.html", import.meta.url), "utf8");
const planner = readFileSync(new URL("../site/assets/phase-5-6-8.js", import.meta.url), "utf8");

test("school template cards open their matching editor section and preserve an existing draft", () => {
  assert.match(schoolTemplates, /\?template=week-grid#school-planner/);
  assert.match(schoolTemplates, /\?template=lesson-homework#homework-form/);
  assert.match(planner, /requestedTemplate === "week-grid"/);
  assert.match(planner, /requestedTemplate === "lesson-homework"/);
  assert.match(planner, /hasSavedDraft \? "Atidarytas šablonas\. Esamas tvarkaraštis ir užduotys išsaugoti/);
});

test("shift template cards configure the existing cycle or dated monthly view", () => {
  assert.match(shiftTemplates, /\?template=cycle#shift-planner/);
  assert.match(shiftTemplates, /\?template=month#shift-planner/);
  assert.match(planner, /requestedTemplate === "cycle"/);
  assert.match(planner, /requestedTemplate === "month"/);
  assert.match(planner, /hasSavedDraft \? `Atidarytas šablonas\. Esamas ciklas ir datos išsaugoti/);
});
