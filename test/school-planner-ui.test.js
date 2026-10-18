import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../site/pamoku-tvarkarastis/index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../site/assets/design-system.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../site/assets/phase-5-6-8.js", import.meta.url), "utf8");

test("school planner offers week/day views and labeled narrow-screen lesson cards", () => {
  assert.match(page, /id="school-view"/);
  assert.match(page, /id="school-view-day"/);
  assert.match(page, /id="school-conflicts"/);
  assert.match(page, /id="homework-subject-filter"/);
  assert.match(styles, /@media\(max-width:720px\)[\s\S]*\.school-table tr\{display:grid/);
  assert.match(styles, /\.school-table td::before\{content:attr\(data-label\)/);
  assert.match(script, /visibleLessons\(state\.lessons, \{ days: state\.days, view, day: viewDay \}\)/);
  assert.match(script, /subjectFilter\.replaceChildren/);
});
