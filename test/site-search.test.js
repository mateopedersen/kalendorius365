import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../site/_layouts/default.html", import.meta.url), "utf8");
const homepage = readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
const sourceIndex = JSON.parse(
  readFileSync(new URL("../site/assets/data/search.json", import.meta.url), "utf8"),
);
const builtIndex = JSON.parse(
  readFileSync(new URL("../public/assets/data/search.json", import.meta.url), "utf8"),
);

test("global search covers pages and direct homepage functions in the built output", () => {
  assert.ok(sourceIndex.length > 100, "the index should include the full site, not just navigation links");
  assert.equal(JSON.stringify(builtIndex), JSON.stringify(sourceIndex));
  for (const path of ["/2027/", "/2028/", "/2029/geguze/", "/sventes/velykos/", "/saule/", "/horoskopai/"]) {
    assert.ok(sourceIndex.some((item) => item.url === path), `missing page ${path}`);
  }
  for (const [title, fragment] of [
    ["Pridėti įvykį į kalendorių", "add-event"],
    ["Dienos užrašai", "daily-note"],
    ["Užduočių sąrašas", "task-title"],
    ["Pasirinkti orų miestą", "weather-city"],
    ["Kalendoriaus sluoksniai ir kategorijos", "layers"],
    ["Keisti šviesią arba tamsią temą", "theme"],
  ]) {
    assert.ok(sourceIndex.some((item) => item.title === title && item.url === `/#${fragment}`));
    assert.match(fragment === "theme" ? html : homepage, new RegExp(`id="${fragment}"`));
  }
});

test("site search exposes an accessible combobox and keyboard-selectable results", () => {
  const script = readFileSync(new URL("../site/assets/common.js", import.meta.url), "utf8");
  assert.match(html, /id="site-search"/);
  assert.match(script, /setAttribute\("role", "combobox"\)/);
  assert.match(script, /setAttribute\("aria-controls", "site-search-results"\)/);
  assert.match(script, /setAttribute\("role", "listbox"\)/);
  assert.match(script, /event\.key === "ArrowDown"/);
  assert.match(script, /event\.key === "ArrowUp"/);
  assert.match(script, /aria-activedescendant/);
  assert.match(
    readFileSync(new URL("../site/assets/design-system.css", import.meta.url), "utf8"),
    /\.site-header \.header-search > \.icon\s*\{[^}]*pointer-events:\s*none/s,
    "the mobile search icon must not intercept taps intended for its input",
  );
});
