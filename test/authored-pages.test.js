import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const authoredRoutes = [
  "astronominis-kalendorius",
  "darbo-grafiko-sablonai",
  "dienos-planuoklis",
  "irankiai",
  "menesiai",
  "metai",
  "pamainu-grafikas",
  "pamoku-tvarkarascio-sablonai",
  "pamoku-tvarkarastis",
  "savaites/2027",
  "savaites/2028",
  "savaites/2029",
  "savaitiniai-planuokliai",
  "seimos-kalendorius",
  "vardadieniai",
];
const generator = readFileSync(new URL("../scripts/pages.rb", import.meta.url), "utf8");

test("the release generator preserves authored interactive tool pages", () => {
  assert.match(generator, /return if preserve_authored_source\?\(target\)/);
  for (const route of authoredRoutes) {
    const page = readFileSync(new URL(`../site/${route}/index.html`, import.meta.url), "utf8");
    const frontMatter = page.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(frontMatter, `${route} must keep valid front matter`);
    assert.match(frontMatter[1], /^preserve_source: true$/m, `${route} must opt out of generated replacement`);
  }
});

test("year and weekly planner pages connect the next useful planning step", () => {
  const links = [
    ["metai", ["/sventes/", "/tuscias-kalendorius/"]],
    ["savaites/2027", ["/2027/", "/savaitiniai-planuokliai/", "/tuscias-kalendorius/"]],
    ["savaites/2028", ["/2028/", "/savaitiniai-planuokliai/", "/tuscias-kalendorius/"]],
    ["savaites/2029", ["/2029/", "/savaitiniai-planuokliai/", "/tuscias-kalendorius/"]],
    ["savaitiniai-planuokliai", ["/seimos-kalendorius/", "/tuscias-kalendorius/"]],
  ];
  for (const [route, targets] of links) {
    const page = readFileSync(new URL(`../site/${route}/index.html`, import.meta.url), "utf8");
    for (const target of targets) assert.ok(page.includes(`href="${target}"`), `${route} should link to ${target}`);
  }
});
