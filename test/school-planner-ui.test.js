import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../site/pamoku-tvarkarastis/index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../site/assets/shell/school-planner.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../site/assets/phase-5-6-8.js", import.meta.url), "utf8");

test("school planner offers week/day views and labeled narrow-screen lesson cards", () => {
  assert.match(page, /data-school-day="week"/);
  assert.match(page, /data-school-day="5"/);
  assert.match(page, /id="school-conflicts"/);
  assert.match(page, /id="homework-subject-filter"/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.school-table tr \{\s*display: grid/);
  assert.match(styles, /\.school-table td::before \{\s*content: attr\(data-label\)/);
  assert.match(script, /visibleLessons\(state\.lessons, \{ days: state\.days, view, day: viewDay \}\)/);
  assert.match(script, /subjectFilter\.replaceChildren/);
});
