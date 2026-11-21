import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet } from "../functions/api/oru-prognoze.js";
import { pageReadings } from "../lib/weather-page-readings.mjs";
import { weatherPlaces } from "../lib/weather-places.mjs";
import { weatherDate } from "../lib/weather-forecast.mjs";
import { weatherView } from "../lib/weather-view.mjs";

test("the browser forecast cannot read display-only snapshots or retrieve old climate downloads", async t => {
  const place = weatherPlaces.get("vilnius");
  const publicKeys = [];
  const before = globalThis.caches;
  t.after(() => { if (before) globalThis.caches = before; else delete globalThis.caches; });
  globalThis.caches = {default: {
    async match(key) {
      publicKeys.push(new URL(key.url));
      // Simulate an old public item which still exists in the edge cache.
      if (!new URL(key.url).searchParams.has("rinkinys")) return Response.json({source: "Visual Crossing Weather"});
    },
    async put() {},
  }, async open() { throw Error("Public endpoints must never open the private cache"); }};
  const called = [];
  t.mock.method(globalThis, "fetch", async request => {
    const url = new URL(request);
    called.push(url.hostname);
    assert.equal(url.hostname, "api.met.no");
    return Response.json({
      geometry: {coordinates: [place.longitude, place.latitude]},
      properties: {timeseries: [{time: new Date().toISOString(), data: {instant: {details: {air_temperature: 2}}}}]},
    });
  });
  const get = segment => onRequestGet({request: new Request("https://preview.example/api/oru-prognoze?vieta=vilnius&dalis=" + segment)});
  for (const segment of ["16-30", "31-45", "46-90"]) assert.equal((await get(segment)).status, 404);
  assert.equal(publicKeys.length, 0);
  const publicForecast = await get("forecast");
  assert.equal(publicForecast.status, 200);
  assert.equal((await publicForecast.json()).source, "MET Norway");
  assert.deepEqual(called, ["api.met.no"]);
  assert.equal(publicKeys[0].searchParams.get("rinkinys"), "atviri-v2");

  // A saved CAMS entry can be used without requesting any air provider.
  globalThis.caches.default.match = async key => {
    const params = new URL(key.url).searchParams;
    assert.equal(params.get("rinkinys"), "cams-v1");
    assert.match(params.get("diena"), /^\d{4}-\d{2}-\d{2}T\d{2}$/);
    return Response.json({source: "CAMS"});
  };
  assert.equal((await (await get("aplinka")).json()).source, "CAMS");
});

test("private HTML data retains 15 forecast dates and fetches just the selected climate month once", async t => {
  const now = new Date("2026-11-21T13:00:00Z");
  const place = weatherPlaces.get("vilnius");
  const context = {request: new Request("https://preview.example/orai/vilnius/")};
  const upstream = [], entries = new Map();
  const before = globalThis.caches;
  t.after(() => { if (before) globalThis.caches = before; else delete globalThis.caches; });
  globalThis.caches = {async open(name) {
    assert.equal(name, "weather-html-v2");
    return {match: key => Promise.resolve(entries.get(key.url)?.clone()), put: async (key, value) => { entries.set(key.url, value); }};
  }};
  t.mock.method(globalThis, "fetch", async request => {
    const url = new URL(request);
    if (!url.hostname.includes("visualcrossing")) return new Response(null, {status: 503});
    const [start, end] = url.pathname.split("/").slice(-2);
    upstream.push([start, end]);
    const mode = url.searchParams.get("include") === "days" ? "stats" : "fcst";
    const days = Array.from({length: 1 + (Date.parse(end) - Date.parse(start)) / 86400000}, (_, i) => ({
      datetime: weatherDate(new Date(start + "T12:00:00Z"), i), source: mode,
      tempmin: -3, tempmax: 1, icon: "sleet", precip: 0.3, windgust: 23,
    }));
    return Response.json({latitude: place.latitude, longitude: place.longitude, timezone: "Europe/Vilnius", days});
  });
  const view = weatherView(new URLSearchParams("dienos=90&menuo=2027-01"), now);
  const read = () => pageReadings(context, place, {now: +now, view, budget: 500});
  for (const result of await Promise.all([read(), read()])) {
    assert.equal(result.forecast.value.days.length, 15);
    assert.equal(result.forecast.value.days.at(-1).windgust, 23);
    assert.equal(result.climate.value.days.length, 31);
    assert.equal(result.climate.value.days.at(-1).datetime, "2027-01-31");
  }
  await read();
  assert.deepEqual(upstream.sort(), [["2026-11-21", "2026-12-05"], ["2027-01-01", "2027-01-31"]]);
  assert.equal(entries.size, 2);
  for (const key of entries.keys()) assert.match(key, /\/__weather-html\/v2\//);
});

test("HEAD checks serve page status and robots without contacting a weather provider", async t => {
  const { onRequestHead } = await import("../functions/orai/[[route]].js");
  const { readFileSync } = await import("node:fs");
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => { requests++; return new Response(null, {status: 503}); });
  const hub = 'https://kalendorius365.lt/orai/';
  const shell = '<meta name="robots" content="noindex, follow"><link rel="canonical" href="' + hub + '">' +
    readFileSync(new URL("../site/orai/index.html", import.meta.url), "utf8");
  const res = await onRequestHead({
    request: new Request(hub + "vilnius/?dienos=90", {method: "HEAD"}),
    env: {ASSETS: {fetch: () => new Response(shell)}},
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("X-Robots-Tag"), "noindex");
  assert.equal(await res.text(), "");
  assert.equal(requests, 0);
});
