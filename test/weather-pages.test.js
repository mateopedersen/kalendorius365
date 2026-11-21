import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderWeatherPage } from "../lib/weather-pages.mjs";
import { byMunicipality, municipalities, weatherPlaces } from "../lib/weather-places.mjs";
import { onRequestGet, onRequestHead } from "../functions/orai/[[route]].js";

const home = "https://kalendorius365.lt/orai/";
const metadata = `<title>Orai Lietuvoje</title>
<meta name="description" content="Lietuvos orai">
<meta name="robots" content="noindex, follow">
<meta property="og:title" content="Orai Lietuvoje">
<meta property="og:url" content="${home}">
<meta property="og:image" content="${home}placeholder.webp">
<meta property="og:image:alt" content="Pavyzdys">
<meta property="og:image:width" content="1200">
<meta name="twitter:title" content="Orai Lietuvoje">
<meta name="twitter:image:alt" content="Pavyzdys">
<link rel="canonical" href="${home}">
<script type="application/ld+json">{"@type":"WebPage","url":"${home}"}</script>
<script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[]}</script>`;
const source = readFileSync(new URL("../site/orai/index.html", import.meta.url), "utf8").split("\n---\n")[1];
const shell = metadata + '<main><nav class="breadcrumbs"></nav>' + source + "</main>";
const description = html => html.match(/<meta name="description" content="([^"]+)"/)[1];

test("weather page copy, social metadata and breadcrumbs describe the same city route", () => {
  const result = renderWeatherPage(shell, "kaunas");
  assert.match(result, /<h1 id="wx-place-title">Orai Kaune<\/h1>/);
  assert.match(result, /Kauno 15 dienų orų prognozė/);
  assert.match(result, /Nemuno salą/);
  assert.match(result, /name="twitter:title" content="Orai Kaune šiandien/);
  assert.match(result, /href="https:\/\/kalendorius365\.lt\/orai\/kaunas\/"\s*>/);
  assert.match(result, /\?dienos=15#oru-prognoze/);
  assert.match(result, /name="robots" content="noindex, follow"/);
  assert.match(result, /og:image" content="https:\/\/kalendorius365\.lt\/assets\/visuals\/weather-city-kaunas\.webp"/);
  assert.match(result, /twitter:image:alt" content="Kauno pilies bokštas/);
  assert.equal([...result.matchAll(/<h1\b/g)].length, 1);
  const schema = [...result.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1]));
  assert.equal(schema[0].url, home + "kaunas/");
  assert.equal(schema[0].about.name, "Kaunas");
  assert.equal(schema[1].itemListElement.at(-1).item, schema[0].url);
});

test("weather HTTP routes preserve the canonical URL, preview robots and temporary error status", async () => {
  const context = (path, asset) => ({
    request: new Request(home + path),
    env: { ASSETS: { fetch: asset } },
    next: () => new Response("Not found", { status: 404 }),
  });
  const neverFetch = () => assert.fail("An unknown URL or slash redirect should not load the template");
  const missing = await onRequestGet(context("nezinoma-vietove/", neverFetch));
  assert.equal(missing.status, 404);
  const redirect = await onRequestGet(context("kaunas?dienos=15", neverFetch));
  assert.equal(redirect.status, 308);
  assert.equal(new URL(redirect.headers.get("location"), home).href, home + "kaunas/?dienos=15");

  const asset = () => new Response(shell, { headers: { ETag: "old", "Content-Length": "1" } });
  const page = await onRequestGet(context("kaunas/?dienos=15", asset));
  const head = await onRequestHead(context("kaunas/", asset));
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("x-robots-tag"), "noindex");
  assert.equal(page.headers.get("etag"), null);
  assert.equal(head.headers.get("content-length"), null);
  assert.equal(await head.text(), "");
  assert.match(await page.text(), /rel="canonical" href="https:\/\/kalendorius365\.lt\/orai\/kaunas\/"/);

  const temporary = await onRequestGet(context("kaunas/", () => new Response(null, { status: 404 })));
  assert.equal(temporary.status, 503);
  assert.equal(temporary.headers.get("cache-control"), "no-store");
  assert.match(await temporary.text(), /Orų puslapis laikinai nepasiekiamas/);
});

test("same-name villages in the same district get a location-specific description", () => {
  const first = renderWeatherPage(shell, "adomaiciu-10032");
  const second = renderWeatherPage(shell, "adomaiciu-10033");
  for (const html of [first, second]) {
    assert.match(html, /Adomaičių kaime/);
    assert.match(html, /Vilniaus rajono savivaldybė/);
    assert.match(html, /kaimynystėje yra/);
  }
  assert.notEqual(description(first), description(second));
});

test("municipalities link to their places, and unrecognized weather routes are absent", () => {
  const result = renderWeatherPage(shell, "savivaldybes/kauno-m");
  assert.match(result, /Kauno miesto savivaldybėje/);
  assert.match(result, /href="\/orai\/kaunas\/">Kaunas/);
  const districts = renderWeatherPage(shell, "savivaldybes");
  assert.match(districts, /Orai pagal Lietuvos savivaldybes/);
  assert.match(districts, /id="kauno"/);
  assert.match(districts, /href="\/orai\/miestai\/"/);
  const cities = renderWeatherPage(shell, "miestai");
  assert.match(cities, /Lietuvos miestų orai/);
  assert.match(cities, /href="\/orai\/kaunas\/"/);
  assert.doesNotMatch(cities, /wx-place-template|data-weather-hub/);
  assert.equal(renderWeatherPage(shell, "sakiniu-nera"), null);
});

test("the municipality directory links every registered locality in HTML", () => {
  const directory = renderWeatherPage(shell, "savivaldybes");
  const reached = new Set();
  for (const [district, municipality] of municipalities) {
    assert.ok(directory.includes(`href="/orai/${municipality.slug}/"`), municipality.slug);
    reached.add(municipality.slug);
    const page = renderWeatherPage(shell, municipality.slug);
    const links = new Set([...page.matchAll(/href="\/orai\/([^"?#]+)\/"/g)].map(([, slug]) => slug));
    for (const place of byMunicipality.get(district)) {
      assert.ok(links.has(place.slug), place.slug);
      reached.add(place.slug);
    }
  }
  assert.equal(reached.size, weatherPlaces.size);
});

test("city and village pages provide weekend, nearby and coordinate-specific links", () => {
  const city = renderWeatherPage(shell, "kaunas");
  assert.match(city, /id="wx-weekend-title">Savaitgalio orai Kaune/);
  assert.match(city, /id="wx-weekend-summary"[^>]*>Planuojate savaitgalį Kaune\?/);
  assert.match(description(city), /savaitgalį/);
  assert.match(city, /href="#savaitgalio-orai"/);
  assert.match(city, /href="\/saule\/kaunas\/"/);
  assert.match(city, /aria-labelledby="wx-directory-title"[\s\S]*?aria-label="Artimiausių vietovių prognozės"><a href="\/orai\//);
  assert.match(city, /href="https:\/\/www\.meteo\.lt\/prognozes\/pavojingi-reiskiniai\/"/);

  const village = renderWeatherPage(shell, "zalgirio-31593");
  assert.match(village, /id="wx-weekend-summary"[^>]*>Planuojate savaitgalį Žalgirio kaime\?/);
  for (const page of [city, village]) {
    assert.match(page, /href="https:\/\/www\.openstreetmap\.org\/\?mlat=[0-9.]+&amp;mlon=[0-9.]+#map=13\//);
    assert.match(page, /\?dienos=90#oru-prognoze/);
  }
  const mapLink = page => page.match(/href="(https:\/\/www\.openstreetmap\.org[^"]+)"/)[1];
  assert.notEqual(mapLink(city), mapLink(village));
});

test("the local guide describes the available weather views and links to their sections", () => {
  for (const route of ["panevezys", "zalgirio-31593", "savivaldybes/kauno-m"]) {
    const page = renderWeatherPage(shell, route);
    const guide = page.match(/<section class="wx-guide-details"[^>]*>([\s\S]*?)<\/section>/)?.[1] || "";
    assert.match(guide, /1, 3, 5, 7, 10 arba 15 dienų/);
    assert.match(guide, /30, 45 ir 90 dienų[\s\S]*Nuo 16-os dienos[\s\S]*istorinius/);
    assert.match(guide, /drėgnį ir vėjo greitį/);
    for (const id of ["oru-prognoze", "krituliu-prognoze", "oru-rodikliai", "oro-kokybe", "savaitgalio-orai", "orai-keliuose"]) {
      assert.ok(guide.includes(`href="#${id}"`) && page.includes(`id="${id}"`), `${route}: ${id}`);
    }
  }
});
