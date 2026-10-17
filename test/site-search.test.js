import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { searchPages } from "../site/assets/search-engine.js";

const html = readFileSync(new URL("../site/_layouts/default.html", import.meta.url), "utf8");
const homepage = readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
const searchPage = readFileSync(new URL("../site/paieska/index.html", import.meta.url), "utf8");
const sourceIndex = JSON.parse(
  readFileSync(new URL("../site/assets/data/search.json", import.meta.url), "utf8"),
);
const builtIndex = JSON.parse(
  readFileSync(new URL("../public/assets/data/search.json", import.meta.url), "utf8"),
);

test("global search covers pages and direct homepage functions in the built output", () => {
  assert.ok(sourceIndex.length > 100, "the index should include the full site, not just navigation links");
  assert.equal(JSON.stringify(builtIndex), JSON.stringify(sourceIndex));
  const pageRoutes = [];
  const siteRoot = fileURLToPath(new URL("../site/", import.meta.url));
  const walk = (directory, relative = "") => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith("_") || entry.name === "assets") continue;
        walk(join(directory, entry.name), relative ? `${relative}/${entry.name}` : entry.name);
      } else if (entry.isFile() && entry.name === "index.html") {
        pageRoutes.push(relative ? `/${relative}/` : "/");
      }
    }
  };
  walk(siteRoot);
  const contentRoutes = sourceIndex.filter((item) => !item.action).map((item) => item.url);
  assert.equal(new Set(contentRoutes).size, contentRoutes.length, "content pages must not be duplicated");
  assert.deepEqual([...contentRoutes].sort(), [...pageRoutes].sort(), "every canonical HTML page should be searchable");
  assert.ok(sourceIndex.every((item) => item.description && item.category));
  assert.ok(sourceIndex.filter((item) => !item.action).every((item) => item.headings && item.content));
  for (const path of ["/2027/", "/2028/", "/2029/geguze/", "/sventes/velykos/", "/saule/", "/horoskopai/"]) {
    assert.ok(sourceIndex.some((item) => item.url === path), `missing page ${path}`);
  }
  for (const [title, fragment] of [
    ["Pridėti įvykį į kalendorių", "add-event"],
    ["Dienos užrašai", "daily-note"],
    ["Užduočių sąrašas", "task-title"],
    ["Pasirinkti orų miestą", "weather-city"],
    ["Kalendoriaus sluoksniai ir kategorijos", "layers"],
  ]) {
    assert.ok(sourceIndex.some((item) => item.title === title && item.url === `/#${fragment}`));
    assert.match(homepage, new RegExp(`id="${fragment}"`));
  }
  assert.ok(!sourceIndex.some((item) => item.url === "/#theme"), "removed appearance controls must not remain in search");
});

test("site search exposes an accessible combobox and keyboard-selectable results", () => {
  const script = readFileSync(new URL("../site/assets/common.js", import.meta.url), "utf8");
  assert.match(html, /<form class="header-search" role="search" action="\/paieska\/" method="get">/);
  assert.match(html, /id="site-search" name="q"/);
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
  assert.match(searchPage, /id="site-search-page-query" name="q"/);
  assert.match(searchPage, /id="site-search-pagination"/);
  assert.match(readFileSync(new URL("../site/assets/search-page.js", import.meta.url), "utf8"), /pageSize = 18/);
});

test("search ranks page content, Lithuanian forms, misspellings, aliases and deep links", () => {
  const cases = [
    ["zodiakas", "/zodiakas/"],
    ["burc hesapla", "/zodiakas/"],
    ["ženklų palyginimas", "/zodiakas/"],
    ["2029 geguze", "/2029/geguze/"],
    ["May 2029", "/2029/geguze/"],
    ["2029", "/2029/"],
    ["kalendorius 2029", "/2029/"],
    ["2029 moon calendar", "/menulio-kalendorius/2029/"],
    ["kalėdų tradicijos", "/sventes/kaledos/"],
    ["sauletekiz", "/saule/"],
    ["atostogų planavimas", "/atostogu-planavimas/"],
    ["ascendentas dvyniai", "/horoskopai/dvyniai/"],
    ["Gemini rising", "/horoskopai/dvyniai/"],
    ["terazi burcu", "/horoskopai/svarstykles/"],
    ["moon phases", "/menulio-fazes/"],
    ["weather Vilnius", "/#weather-city"],
    ["gimtadienio priminimas", "/#add-event"],
  ];
  for (const [query, expected] of cases) {
    const results = searchPages(sourceIndex, query);
    assert.equal(results[0]?.url, expected, `unexpected first result for ${query}`);
  }
  assert.ok(searchPages(sourceIndex, "Lietuvos šventės", { category: "holiday" }).length > 0);
  assert.ok(searchPages(sourceIndex, "kalendorius 2029").length > 10, "full result sets should remain available for pagination");
});
