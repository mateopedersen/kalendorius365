import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../site/darbo-dienos/2027/index.html", import.meta.url), "utf8");
const publicPages = [2027, 2028, 2029].map((year) =>
  readFileSync(new URL(`../public/darbo-dienos/${year}/index.html`, import.meta.url), "utf8"),
);

test("2027 workday page renders the annual planner and accessible date checker", () => {
  assert.match(page, /<h2 id="workyear-hero-title">Metų ritmas, vienu žvilgsniu<\/h2>/);
  assert.equal((page.match(/class="workyear-month"/g) || []).length, 12);
  assert.match(page, /data-days-five="20" data-days-six="25"/);
  assert.match(page, /id="work-schedule"/);
  assert.match(page, /id="work-csv"/);
  assert.match(page, /data-work-table="5"/);
  assert.match(page, /data-work-table="6" hidden/);
  assert.match(page, /id="workday-check-date" type="date" min="2027-01-01" max="2027-12-31"/);
  assert.match(page, /id="workday-check-result"[^>]*role="status" aria-live="polite"/);
  assert.equal((page.match(/data-work-eves="[56]"/g) || []).length, 2);
  assert.match(page, /\/assets\/visuals\/workday-year\.svg/);
});

test("annual workday pages activate their responsive layout styles", () => {
  for (const output of publicPages) assert.match(output, /<body class="tool-workdays">/);
});
