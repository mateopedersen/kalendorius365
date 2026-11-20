import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { filterToolInventory, normalizeToolSearchText } from "../site/assets/tool-directory-core.js";

const inventory = readFileSync(new URL("../site/_data/tool_directory.yml", import.meta.url), "utf8");
const directory = readFileSync(new URL("../site/irankiai/index.html", import.meta.url), "utf8");
const generatedDirectory = readFileSync(new URL("../public/irankiai/index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../site/assets/design-system.css", import.meta.url), "utf8");
const generator = readFileSync(new URL("../scripts/pages.rb", import.meta.url), "utf8");

test("directory inventory contains each tool once and keeps seasons as a separate link", () => {
  const routes = [...inventory.matchAll(/^\s+- route: (\/[^\s]+)\r?$/gm)].map((match) => match[1]);
  assert.ok(routes.includes("/mano-diena/"));
  assert.ok(routes.includes("/atgalinis-skaiciavimas/"));
  assert.ok(routes.includes("/pdf-kalendoriai/"));
  assert.equal(new Set(routes).size, routes.length);
  for (const route of routes) assert.ok(route.endsWith("/"), route);
  assert.ok(!routes.includes("/metu-laikai/"));
  assert.match(directory, /site\.data\.tool_directory\.categories/);
  assert.match(directory, /data-tool-card/);
  assert.match(directory, /href="\/metu-laikai\/"/);
});

test("all tool and category illustrations are explicit and have distinct SVG content", () => {
  const artworks = [...inventory.matchAll(/^\s*art: ([a-z0-9-]+)\r?$/gm)].map((match) => match[1]);
  const entries = [...inventory.matchAll(/^\s*- (?:id|route): /gm)].length;
  assert.equal(artworks.length, entries);
  assert.equal(new Set(artworks).size, entries);

  const checksums = new Set();
  for (const art of artworks) {
    const file = readFileSync(new URL(`../site/assets/visuals/shell/${art}.svg`, import.meta.url));
    assert.match(file.toString(), /^<svg\b/, art);
    const checksum = createHash("sha256").update(file).digest("hex");
    assert.ok(!checksums.has(checksum), `${art} reuses the same drawing as another entry`);
    checksums.add(checksum);
  }
});

test("release HTML keeps all inventory routes and the separate seasons link", () => {
  const routes = [...inventory.matchAll(/^\s+- route: (\/[^\s]+)\r?$/gm)].map((match) => match[1]);
  for (const route of routes) {
    assert.ok(generatedDirectory.includes(`href=\"${route}\"`), `generated page omitted ${route}`);
    assert.ok(existsSync(new URL(`../public${route}index.html`, import.meta.url)), `generated target is missing: ${route}`);
  }
  assert.equal((generatedDirectory.match(/data-tool-card/g) || []).length, routes.length);
  assert.ok(generatedDirectory.includes('href="/metu-laikai/"'));
  assert.ok(existsSync(new URL("../public/metu-laikai/index.html", import.meta.url)));
  assert.match(generatedDirectory, /data-tool-filter="templates"/);
  assert.match(generatedDirectory, /\/assets\/releases\/[0-9a-f]{20}\/tool-directory\.js/);
  assert.match(directory, /tool_directory: true/);
  assert.doesNotMatch(generator, /page\('irankiai'/);
});

test("tool search folds Lithuanian marks, allows synonyms and combines category with query", () => {
  const tools = [
    { category: "work", search: "Atostogų planuoklis ilgas savaitgalis poilsis vacation" },
    { category: "dates", search: "Datos skaičiuoklė darbo dienos terminas" },
    { category: "astronomy", search: "Mėnulio fazės jaunatis pilnatis" },
  ];
  assert.equal(normalizeToolSearchText("MĖNULIO fazės"), "menulio fazes");
  assert.deepEqual(filterToolInventory(tools, { query: "atostogu savaitgalis", category: "work" }), [tools[0]]);
  assert.deepEqual(filterToolInventory(tools, { query: "vacation", category: "dates" }), []);
  assert.deepEqual(filterToolInventory(tools, { query: "menulio jaunatis" }), [tools[2]]);
  assert.deepEqual(filterToolInventory(tools, { query: "", category: "all" }), tools);
});

test("the directory exposes accessible combined filters, examples, types and actual output labels", () => {
  assert.match(directory, /role="group" aria-label="Filtruoti įrankius pagal paskirtį"/);
  assert.match(directory, /aria-live="polite"/);
  assert.match(directory, /bendroje paieškoje/i);
  assert.match(directory, /item\.example/);
  assert.match(directory, /item\.kind/);
  assert.match(directory, /item\.outputs/);
  assert.match(styles, /\.tool-directory-card\[hidden\].*display:none!important/);
});
