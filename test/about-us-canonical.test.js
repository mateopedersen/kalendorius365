import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const readJson = (path) => JSON.parse(read(path));

function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(path) : entry.isFile() && entry.name.endsWith(".html") ? [path] : [];
  });
}

test("the about-us canonical page preserves the old source, privacy and editorial details", () => {
  assert.equal(existsSync(new URL("../site/apie/index.html", import.meta.url)), false);
  const page = read("../site/apie-mus/index.html");
  for (const required of [
    "about_us: true", "USNO", "CC BY-SA 4.0", "oficialus valstybinis registras",
    "saugomi jūsų naršyklėje", "dirbtinio intelekto priemones", "gimtakalbio redaktoriaus peržiūra neatlikta",
    "Lietuvos laiko", "/privatumas/", "/kontaktai/?tema=date_error"
  ]) assert.ok(page.includes(required), `missing merged about detail: ${required}`);
});

test("the about page presents the full product range and all illustrated zodiac links", () => {
  const page = read("../site/apie-mus/index.html");
  for (const required of [
    "kalendoriai, horoskopai ir įrankiai", "about-zodiac-title", "about-calendars-title",
    "about-tools-title", "/tuscias-kalendorius/", "/kurti-kalendoriu/", "/pamoku-tvarkarastis/",
    "/pamainu-grafikas/", "/datos-skaiciuokle/", "/ilgieji-savaitgaliai/"
  ]) assert.ok(page.includes(required), `missing featured product: ${required}`);

  const signs = ["avinas", "jautis", "dvyniai", "vezys", "liutas", "mergele", "svarstykles", "skorpionas", "saulys", "oziaragis", "vandenis", "zuvys"];
  for (const sign of signs) {
    assert.ok(page.includes(`href=\"/horoskopai/${sign}/\"`), `missing horoscope route for ${sign}`);
    assert.ok(page.includes(`src=\"/assets/visuals/zodiac/${sign}.svg\"`), `missing original artwork for ${sign}`);
    assert.ok(existsSync(new URL(`../site/assets/visuals/zodiac/${sign}.svg`, import.meta.url)), `missing illustration asset for ${sign}`);
  }
  assert.ok(page.includes("zodiakas-1200x630.png"), "missing zodiac hero artwork");
});

test("removed about route redirects permanently and is absent from discovery metadata", () => {
  const redirects = read("../public/_redirects").split(/\r?\n/);
  assert.ok(redirects.includes("/apie/ /apie-mus/ 301"));
  assert.ok(redirects.includes("/apie /apie-mus/ 301"));
  const sitemap = read("../public/sitemap.xml");
  assert.match(sitemap, /https:\/\/kalendorius365\.lt\/apie-mus\//);
  assert.doesNotMatch(sitemap, /https:\/\/kalendorius365\.lt\/apie\//);
  for (const relative of ["../site/assets/data/search.json", "../public/assets/data/search.json"]) {
    const pages = readJson(relative);
    assert.ok(pages.some((page) => page.url === "/apie-mus/"));
    assert.ok(pages.every((page) => page.url !== "/apie/"));
  }
  assert.match(read("../site/llms.txt"), /https:\/\/kalendorius365\.lt\/apie-mus\//);
  assert.doesNotMatch(read("../site/llms.txt"), /https:\/\/kalendorius365\.lt\/apie\//);
});

test("every generated page footer points to the canonical about page only", () => {
  const files = htmlFiles(new URL("../public", import.meta.url).pathname);
  const pages = files.filter((path) => path.endsWith("/index.html"));
  assert.ok(pages.length >= 180, `expected the full generated site, got ${pages.length} pages`);
  for (const path of pages) {
    const html = readFileSync(path, "utf8");
    const footer = html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)?.[0];
    assert.ok(footer, `missing shared footer in ${path}`);
    assert.match(footer, /href="\/apie-mus\/"/);
    assert.doesNotMatch(footer, /href="\/apie\/"/);
  }
});
