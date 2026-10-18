import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../site/darbo-dienos/2027/index.html", import.meta.url), "utf8");
const template = readFileSync(new URL("../site/_layouts/default.html", import.meta.url), "utf8");

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
  assert.match(page, /^workdays: true$/m);
  assert.match(template, /page\.workdays %\} class="tool-workdays"/);
});

test("published workday pages activate their scoped responsive styles", () => {
  const designSystem = readFileSync(new URL("../public/assets/design-system.css", import.meta.url), "utf8");
  for (const year of [2027, 2028, 2029]) {
    const built = readFileSync(new URL(`../public/darbo-dienos/${year}/index.html`, import.meta.url), "utf8");
    assert.match(built, /<body class="tool-workdays">/, `${year} should enable the page-specific style scope`);
  }
  assert.match(designSystem, /body\.tool-workdays \.workyear-month-grid\{display:grid/, "month cards should use the responsive grid layout");
  assert.match(designSystem, /body\.tool-workdays \.workyear-hero__art img\{[^}]*width:min\(100%,410px\)/, "hero illustration should stay within its layout bounds");
});
