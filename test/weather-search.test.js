import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findWeatherPlaces, prepareWeatherSearch, weatherQuery } from "../site/assets/weather-search.js";
import { loadSearchCatalogue, searchCatalogue } from "../site/assets/search-catalogue.js";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const pages = JSON.parse(read("../site/assets/data/search.json"));
const registry = JSON.parse(read("../site/assets/data/weather-places.json"));
const weather = prepareWeatherSearch(registry);
const catalogue = { pages, weather };

test("the combined directory covers each canonical sitemap URL exactly once", () => {
  const sitemaps = ["../public/sitemap.xml", "../public/sitemap-orai.xml"];
  const expected = new Set(sitemaps.flatMap(path =>
    [...read(path).matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => new URL(url).pathname)
  ));
  const results = searchCatalogue(catalogue, "");
  const urls = new Set(results.map(entry => entry.url));
  assert.equal(urls.size, results.length);
  assert.deepEqual([...expected].filter(url => !urls.has(url)), []);
  assert.equal(weather.browse.length, registry.places.length + Object.keys(registry.municipalities).length + 2);
});

test("all registry place names and identifiers resolve to their actual forecast routes", () => {
  const missing = registry.places.filter(([slug, name]) => [slug, name].some(query =>
    !findWeatherPlaces(weather, weatherQuery(`orai ${query}`)).some(entry => entry.url === `/orai/${slug}/`)));
  assert.deepEqual(missing.map(([slug]) => slug), []);
});

test("days-off queries open annual pages and respect the requested year", () => {
  const years = [2027, 2028, 2029, 2030];
  const links = years.map(year => `/nedarbo-dienos/${year}/`);
  for (const query of ["Nedarbo Dienos", "LAISVOS DIENOS", "laisvų dienų kalendorius"]) {
    assert.deepEqual(searchCatalogue(catalogue, query).map(entry => entry.url), links, query);
  }
  for (const year of years) {
    const query = `laisvadieniai ${year}`;
    assert.deepEqual(searchCatalogue(catalogue, query, { category: "holiday" }).map(entry => entry.url),
      [`/nedarbo-dienos/${year}/`]);
  }
});

test("one search handles cities, villages, same-name places, forecast periods and detail sections", () => {
  for (const [query, expected] of [
    ["Orai Kaune", "/orai/kaunas/"],
    ["Trakai", "/orai/trakai/"],
    ["Orai Vil", "/orai/vilnius/"],
    ["orai Vilnuis", "/orai/vilnius/"],
    ["Kaunas'ta hava durumu", "/orai/kaunas/"],
    ["30 dienų Kauno orai", "/orai/kaunas/?dienos=30"],
    ["valandiniai orai Vilniuje", "/orai/vilnius/#wx-hours-title"],
    ["oro kokybė Panevėžyje", "/orai/panevezys/#oro-kokybe"],
    ["kelių būklė Kaune", "/orai/kaunas/#orai-keliuose"],
    ["Ar lis Dusmenyse?", "/orai/dusmenu-13942/#krituliu-prognoze"],
    ["orai Dusmenėlių Trakų r.", "/orai/dusmeneliu-13941/"],
    ["Orų prognozė Kauno rajone", "/orai/savivaldybes/kauno-r/"],
    ["savivaldybės", "/orai/savivaldybes/"],
    ["orai", "/orai/"],
  ]) {
    assert.equal(searchCatalogue(catalogue, query)[0]?.url, expected, query);
  }
  const duplicates = searchCatalogue(catalogue, "orai Dusmenėlių");
  assert.equal(duplicates.length, 2);
  assert.equal(new Set(duplicates.map(entry => entry.description)).size, 2);
  assert.ok(searchCatalogue(catalogue, "Vil", { category: "weather" }).every(result => result.category === "weather"));
  assert.equal(searchCatalogue(catalogue, "saulėlydis Kaune")[0]?.url, "/saule/kaunas/");
  assert.equal(searchCatalogue(catalogue, "ilgieji savaitgaliai")[0]?.url, "/ilgieji-savaitgaliai/");
  assert.deepEqual(searchCatalogue(catalogue, "zxqzvjk"), []);
});

test("days off load independently and a weather catalogue failure can be retried", async () => {
  const originalFetch = globalThis.fetch;
  let locationLoads = 0;
  globalThis.fetch = async url => {
    if (url.pathname.endsWith("/search.json")) return Response.json(pages);
    if (++locationLoads === 1) return new Response(null, { status: 503 });
    return Response.json(registry);
  };
  try {
    const daysOff = await loadSearchCatalogue("all", "Nedarbo Dienos");
    assert.equal(locationLoads, 0);
    assert.equal(searchCatalogue(daysOff, "Nedarbo Dienos").length, 4);
    const partial = await loadSearchCatalogue("all", "Orai Kaune");
    assert.equal(partial.weatherUnavailable, true);
    assert.equal(searchCatalogue(partial, "Velykos")[0].url, "/sventes/velykos/");
    const retried = await loadSearchCatalogue("weather", "Orai Kaune");
    assert.equal(searchCatalogue(retried, "Orai Kaune")[0].url, "/orai/kaunas/");
    assert.equal(locationLoads, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
