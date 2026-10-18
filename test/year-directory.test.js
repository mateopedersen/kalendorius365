import test from "node:test";
import assert from "node:assert/strict";
import { monthGrid, yearFacts, yearPrintAssets } from "../site/assets/year-directory-core.js";
import { existsSync, readFileSync } from "node:fs";

const page = readFileSync(new URL("../site/metai/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../site/assets/year-directory.js", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../site/assets/data/manifest.json", import.meta.url), "utf8"));

test("month preview uses Gregorian dates and Monday-first weekday columns", () => {
  assert.deepEqual(monthGrid(2027, 1), {
    year: 2027, month: 1, days: 31, mondayOffset: 4, rowCount: 5,
    cells: [null, null, null, null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
  });
  assert.equal(monthGrid(2028, 2).days, 29);
  assert.equal(monthGrid(2100, 2).days, 28);
  assert.equal(monthGrid(2029, 1).mondayOffset, 0);
  assert.equal(monthGrid(2027, 2).rowCount, 4);
});

test("year summary distinguishes Gregorian leap-century rules", () => {
  assert.equal(yearFacts(2000).leap, true);
  assert.equal(yearFacts(2028).days, 366);
  assert.equal(yearFacts(1900).leap, false);
  assert.equal(yearFacts(2100).days, 365);
  assert.throws(() => monthGrid(2027, 13), /galiojančius/);
});

test("year directory connects all three date-correct month previews to their month pages", () => {
  for (const year of [2027, 2028, 2029]) {
    assert.match(page, new RegExp(`data-year-card="${year}"`));
    assert.match(page, new RegExp(`data-year-preview="${year}"`));
  }
  assert.match(page, /id="year-preview-month"/);
  assert.match(script, /monthGrid\(year, month\)/);
  assert.match(script, /\$\{year\}\/\$\{monthSlugs\[month - 1\]\}/);
});

test("year cards derive current status, calendar facts and verified PDF/WebP choices from live data", () => {
  for (const year of [2027, 2028, 2029]) {
    assert.match(page, new RegExp(`data-year-downloads="${year}"`));
    const assets = yearPrintAssets(manifest, year);
    assert.equal(assets.length, 10);
    for (const asset of assets) {
      assert.equal(asset.verification.status, "passed");
      assert.match(asset.pdf, new RegExp(`^/downloads/metiniai/${year}/.*\\.pdf$`));
      assert.match(asset.webp, new RegExp(`^/downloads/metiniai/${year}/.*\\.webp$`));
      assert(existsSync(new URL(`../public${asset.pdf}`, import.meta.url)), `${year} PDF ${asset.name} exists`);
      assert(existsSync(new URL(`../public${asset.webp}`, import.meta.url)), `${year} WebP ${asset.name} exists`);
    }
  }
  assert.match(script, /yearFacts\(year\)/);
  assert.match(script, /today\(\)\.slice\(0, 4\)/);
  assert.match(script, /renderYearPrintAssets\(year, yearPrintAssets\(manifest, year\)\)/);
  assert.match(page, /data-year-days/);
});
