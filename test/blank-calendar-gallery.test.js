import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(
  new URL("../site/tuscias-kalendorius/index.html", import.meta.url),
  "utf8",
);

test("blank calendar gallery groups variants and keeps all twenty distinct templates", () => {
  const cards = [...html.matchAll(/<article class="design-card blank-design-card"([^>]*)>/g)];
  assert.equal(cards.length, 20);
  const ids = cards.map(([, attributes]) => attributes.match(/data-design="([^"]+)"/)?.[1]);
  assert.equal(new Set(ids).size, 20);
  assert.deepEqual(ids.sort(), Array.from({ length: 20 }, (_, index) => String(index + 1).padStart(2, "0")).sort());
  assert.equal((html.match(/class="blank-category"/g) || []).length, 6);
  assert.equal((html.match(/data-blank-rows/g) || []).length, 6);
  assert.equal((html.match(/class="blank-row-choice"/g) || []).length, 6);
  assert.match(html, /value="tuscias-01-5-eilutes"/);
  assert.match(html, /value="tuscias-01-6-eilutes"/);
});

test("blank calendar images have distinct descriptive Lithuanian alt text and category filters", () => {
  const alts = [...html.matchAll(/<img[^>]+alt="([^"]+)"/g)].map(([, alt]) => alt);
  assert.ok(alts.length >= 21);
  assert.ok(alts.every((alt) => alt.trim() === alt && alt.includes("Kalendorius365")));
  assert.ok(new Set(alts).size >= 20);
  for (const category of ["month", "week", "day", "family", "school", "shift"])
    assert.match(html, new RegExp(`data-design-filter="${category}"`));
  assert.match(html, /title: "Tušti kalendoriai spausdinimui: nemokami PDF ir WebP"/);
  assert.match(html, /description: "Atsisiųskite 20 nedatuotų mėnesio, savaitės, dienos, šeimos, mokyklos ir pamainų planuoklių/);
  assert.match(html, /<h1>Tušti kalendoriai ir planuokliai spausdinimui<\/h1>/);
});
