import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const include = readFileSync(new URL("../site/_includes/planner-studio.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../site/assets/planner-studio.css", import.meta.url), "utf8");
const script = readFileSync(new URL("../site/assets/planner-studio.js", import.meta.url), "utf8");

test("planner studio print isolates its live sheet from the downloadable gallery previews", () => {
  assert.match(include, /data-print-root="planner-studio"/);
  assert.match(styles, /:has\(\[data-print-root="planner-studio"\]\).*\[data-print-root\]:not\(\[data-print-root="planner-studio"\]\)\{display:none!important\}/);
  assert.match(script, /window\.print\(\)/);
});

test("family layouts reorder shared activities, and print settings use validated paper sizes", () => {
  assert.match(script, /state\.layout === "shared"/);
  assert.match(script, /state\.layout === "people"/);
  assert.match(script, /Array\.isArray\(task\.person\) \? " · " \+ task\.person\.map/);
  assert.match(include, /Bendra kelių žmonių veikla plane rodoma vieną kartą/);
  assert.match(include, /spausdinkite A3 gulsčiai/);
  assert.match(script, /@page\{size:" \+ state\.paper \+ " " \+ state\.orientation/);
  assert.match(include, /Juodraštis automatiškai saugomas tik šiame įrenginyje/);
});
