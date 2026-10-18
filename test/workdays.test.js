import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const generator = readFileSync(new URL("../scripts/pages.rb", import.meta.url), "utf8");
const script = readFileSync(new URL("../site/assets/tools.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../site/assets/workdays.css", import.meta.url), "utf8");

test("each generated workday year presents both weekly schedules side by side", () => {
  assert.match(generator, /workday-compare__grid/);
  assert.match(generator, /data-work-compare="5"/);
  assert.match(generator, /data-work-compare="6"/);
  assert.match(generator, /data-work-days/);
  assert.match(generator, /data-work-hours/);
});

test("comparison totals come from the same generated tables used by CSV and selected view", () => {
  assert.match(script, /\[data-work-table="\$\{schedule\}"\] tfoot tr/);
  assert.match(script, /workday-compare-delta/);
  assert.match(script, /data-work-table/);
  assert.match(styles, /@media\(max-width:560px\)/);
});
