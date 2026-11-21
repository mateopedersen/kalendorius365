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

test("weather HTTP routes preserve the canonical URL, preview robots and temporary error status", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, {status: 503}));
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

test("local guides link to one methodology instead of repeating the same explanations", () => {
  for (const route of ["panevezys", "zalgirio-31593", "savivaldybes/kauno-m"]) {
    const page = renderWeatherPage(shell, route);
    assert.match(page, /id="prognozes-ir-rodmenys"[^>]*><a href="\/oru-saltiniai\/#metodika"/);
    assert.doesNotMatch(page, /Kaip planuoti iki 90 dienų į priekį/);
    assert.ok(page.includes('href="#oro-kokybe"') && page.includes('id="oro-kokybe"'));
  }
});

test("initial HTML exposes dated local readings and usable daily values with JavaScript disabled", () => {
  const now = Date.parse("2026-11-21T16:10:00Z");
  const at = Math.floor(now / 3600000) * 3600000;
  const readings = {
    forecast: {previous: true, value: {
      current: {temp: 3, feelslike: -1, icon: "cloudy", source: "obs", datetimeEpoch: at / 1000},
      source: "Visual Crossing Weather", fetchedAt: new Date(now).toISOString(),
      days: [{datetime: "2026-11-21", tempmin: 1, tempmax: 5, sunrise: "08:00", sunset: "16:00"}],
    }},
    rain: {previous: false, value: {updatedAt: new Date(at).toISOString(), slots: [{time: at, mm: 0.2, symbol: "snow"}]}},
    road: {previous: false, value: {stations: [{name: "A & B", surface: "Šlapia", distance: 4.5, measured: at / 1000}]}},
  };
  const page = renderWeatherPage(shell, "kaunas", readings, now);
  assert.match(page, /id="wx-live-reading"[^>]*data-initial="\d+"[^>]*>3 °C/);
  assert.match(page, /Ankstesni duomenys · Rodmenys 2026-11-21 18:00/);
  assert.match(page, /data-light="night"/);
  assert.match(page, /<time datetime="2026-11-21">[^<]+<\/time>/);
  assert.match(page, /<dt>Aukščiausia<\/dt><dd>5 °C<\/dd>/);
  assert.match(page, /<dt>Žemiausia<\/dt><dd>1 °C<\/dd>/);
  assert.match(page, /id="wx-rain-summary"[^>]*>Sniegas 18:00–19:00/);
  assert.match(page, /id="wx-road-status"[^>]*>Šlapia · A &amp; B · 4,5 km nuo vietovės · Matuota 2026-11-21 18:00/);
  assert.doesNotMatch(page, /Įkeliama valandinė kritulių prognozė|Ieškoma artimiausių stotelių/);
});

test("an all-provider outage still gives a dated astronomical result for the exact registered point", () => {
  const now = Date.parse("2026-06-03T21:05:00Z");
  const solar = page => page.match(/id="wx-calculated-sun"[\s\S]*?<\/article>/)?.[0];
  const kaunas = renderWeatherPage(shell, "kaunas", {}, now);
  const variants = ["vilnius", "savivaldybes/kauno-r", "zalgirio-31593"].map(route => renderWeatherPage(shell, route, {}, now));
  for (const page of [kaunas, ...variants]) {
    assert.doesNotMatch(page, /Įkeliama…|Įkeliama savaitgalio prognozė|Įkeliami orų rodikliai|Ieškoma artimiausių stotelių/);
    assert.match(solar(page), /data-date="2026-06-04"/);
    assert.match(solar(page), /Saulėtekis<\/dt><dd>\d{2}:\d{2}/);
    assert.match(solar(page), /Saulėlydis<\/dt><dd>\d{2}:\d{2}/);
    assert.match(page, /Dabartinės temperatūros nėra/);
    assert.match(page, /https:\/\/airindex.eea.europa.eu\/AQI\//);
    assert.match(page, /https:\/\/pasyfo.eu\/ziedadulkiu-prognozes/);
  }
  assert.notEqual(solar(kaunas), solar(variants[0]));
  assert.notEqual(solar(variants[1]), solar(variants[2]));
});

test("forecast periods and month switches are navigable HTML, including the year boundary", () => {
  const now = Date.parse("2026-11-21T10:00:00Z");
  const dateAfter = n => new Date(now + n * 86400000).toISOString().slice(0, 10);
  const rows = Array.from({length: 90}, (_, i) => ({
    datetime: dateAfter(i), tempmin: 1, tempmax: 4, icon: "rain", precip: .2, windgust: 18,
    normal: {tempmin: [-5, 2, 11], tempmax: [1, 7, 12]},
  }));
  const readings = {forecast: {value: {source: "Visual Crossing Weather", days: rows.slice(0,15)}},
    climate: {value: {days: rows.slice(15)}}};
  const long = renderWeatherPage(shell, "kaunas", readings, now, {period: 90, month: "2027-01"});
  assert.match(long, /href="\?dienos=90#oru-prognoze" data-days="90" aria-current="page"/);
  assert.match(long, /href="\?dienos=90&amp;menuo=2027-01#wx-climate-title" aria-current="page"/);
  const climate = long.match(/class="wx-climate"[^>]*>[\s\S]*?<\/section>/)[0];
  assert.equal([...climate.matchAll(/class="wx-day"/g)].length,31);
  assert.match(climate, /datetime="2027-01-31"/);
  assert.doesNotMatch(climate, /datetime="2026-12-|datetime="2027-02-/);
  assert.match(climate, /<dt>Žemiausia<\/dt><dd>2 °C/);
  assert.match(climate, /www.visualcrossing.com\/weather-api/);
  const forecast = long.match(/id="wx-days"[^>]*>[\s\S]*?class="wx-provider-credit"/)[0];
  assert.equal([...forecast.matchAll(/class="wx-day"/g)].length,15);
  assert.match(forecast, /<dt>Vėjo gūsiai<\/dt><dd>5 m\/s/);
  assert.doesNotMatch(long, /"tempmax"\s*:|\/api\/oru-prognoze\?/);
  const short = renderWeatherPage(shell, "kaunas", readings, now, {period: 1});
  assert.equal([...short.matchAll(/class="wx-day"/g)].length,1);
  assert.doesNotMatch(short, /id="wx-climate-days"/);
});
