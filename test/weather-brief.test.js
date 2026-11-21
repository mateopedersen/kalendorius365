import assert from "node:assert/strict";
import test from "node:test";
import { briefContents, currentReading, dayBrief, rainBrief, readingLight, roadBrief, roadStationLabel } from "../shared/weather-brief.js";
import { pageReadings } from "../lib/weather-page-readings.mjs";
import { weatherPlaces } from "../lib/weather-places.mjs";

const hour = 3600000;
const noon = Date.parse("2026-06-03T09:00:00Z");
const context = { request: new Request("https://preview.example/orai/kaunas/") };
const place = weatherPlaces.get("kaunas");
const cacheWith = get => ({ match: async key => {
  const saved = get(key.url.split("/").pop());
  return saved && Response.json(saved);
} });

test("local midnight selects today's forecast; observed readings cannot come from a future forecast hour", () => {
  const now = Date.parse("2026-06-03T21:05:00Z");
  const slot = { source: "fcst", datetimeEpoch: now / 1000 - 300, temp: 8, icon: "cloudy" };
  const days = [
    { datetime: "2026-06-03", tempmin: 11, tempmax: 22 },
    { datetime: "2026-06-04", tempmin: 5, tempmax: 13, sunrise: "05:01:00", sunset: "22:06:00", hours: [slot] },
  ];
  const forecast = { current: {source: "obs", temp: 42, datetimeEpoch: now / 1000 + 2800}, days, source: "MET Norway" };
  assert.deepEqual(currentReading(forecast, now), slot);
  assert.equal(readingLight(slot, forecast), "night");
  assert.deepEqual(dayBrief(forecast, now).temperatures, ["5 °C", "13 °C"]);
  assert.match(briefContents(dayBrief(forecast, now)), /Žemiausia<\/small><strong>5 °C/);
  assert.match(briefContents(dayBrief(forecast, now)), /Aukščiausia<\/small><strong>13 °C/);
  assert.match(dayBrief(forecast, now).detail, /pateiktas/);
  assert.equal(dayBrief(forecast, now + 24 * hour), undefined);
  assert.equal(currentReading(forecast, now + 8 * hour), undefined);
});

test("missing rain slots never imply a completely dry interval, and only contiguous wet slots count", () => {
  const slot = (i, mm, symbol) => ({ time: noon + i * hour, mm, symbol });
  const dry = Array.from({ length: 12 }, (_, i) => slot(i, 0));
  assert.equal(rainBrief({slots: []}, noon), undefined);
  assert.match(rainBrief({slots: dry}, noon).value, /nenumatoma/);
  assert.match(rainBrief({slots: [dry[0], slot(1, null)]}, noon).detail, /1 iš 12/);
  const wet = rainBrief({ slots: [slot(0, 0.1, "rain"), slot(1, 0.2, "snow"), slot(3, 6, "rain")] }, noon + 42 * 60000);
  assert.equal(wet.value, "Krituliai 12:00–14:00");
  assert.equal(wet.detail, "2 val. · 0,3 mm · daliniai duomenys");
  assert.match(rainBrief({slots: [slot(11, 1, "sleet")]}, noon).detail, /lango pabaigos/);
  assert.match(briefContents(wet, "", true), /Ankstesni duomenys/);
});

test("the repeated local hour during the autumn clock change has unambiguous offsets", () => {
  const now = Date.parse("2026-10-25T00:30:00Z");
  const item = rainBrief({ slots: [{time: Date.parse("2026-10-25T00:00:00Z"), mm: 1, symbol: "rain"}] }, now);
  assert.match(item.value, /03:00.*\+3.*03:00.*\+2/);
  assert.match(item.detail, /^1 val/);
});

test("the nearest fresh station is preferred and expired or future measurements are suppressed", () => {
  const station = (name, distance, age) => ({name, distance, measured: (noon - age * hour) / 1000, surface: "Sausa", surfaceTemp: 0});
  const stations = [station("Near", 1, 2), station("Far", 8, 0.5), station("A & B", 5, 0.8), station("Future", 0, -1)];
  const fresh = roadBrief({stations}, noon);
  assert.equal(fresh.timeLabel, "Matuota");
  assert.match(briefContents(fresh), /A &amp; B · 5 km/);
  assert.match(roadBrief({stations: [stations[0]]}, noon).timeLabel, /Ankstesnis/);
  assert.equal(roadBrief({stations: [station("Expired", 1, 6.01), stations[3]]}, noon), undefined);
});

test("verified Jakai branches show the junction, direction and station rather than a technical code", () => {
  const ramp = { name: "Jakai į Vilnių2 0001090007 0,04", road: "0001090007", kilometer: 0.04,
    section: "A01_304.760_07 (Jakų sankr.)", distance: 3.4, measured: noon / 1000 };
  assert.deepEqual(roadStationLabel(ramp), {
    name: "Jakų žiedinė sankryža · Vilniaus kryptis", connection: "A1 jungtis", point: "2-oji stotelė", kilometer: null,
  });
  assert.equal(roadBrief({ stations: [ramp] }, noon).detail,
    "Jakų žiedinė sankryža · Vilniaus kryptis · A1 jungtis · 2-oji stotelė · 3,4 km nuo vietovės");
  const klaipeda = {name: "Jakai į Klaipėdą 1", road: "0001090002", section: "A01_304.760_02 (Jakų sankr.)"};
  assert.deepEqual(roadStationLabel(klaipeda), {
    name: "Jakų žiedinė sankryža · Klaipėdos kryptis", connection: "A1 jungtis", point: "1-oji stotelė", kilometer: null,
  });
  const unidentified = roadStationLabel({ ...ramp, section: "Kita sankryža" });
  assert.equal(unidentified.route, "");
  assert.equal(unidentified.name, "Jakai į Vilnių 2");
  assert.deepEqual(roadStationLabel({ name: "Klaipėda A1 303,6", road: "A1", kilometer: 303.6 }),
    { name: "Klaipėda", route: "A1", officialName: "Klaipėda A1 303,6", kilometer: 303.6 });
  assert.equal(roadStationLabel({ name: "Stotelė", road: "1234" }).route, "1234");
});

test("a stalled snapshot cache cannot block the HTML response past its reading budget", async () => {
  const cache = {match: () => new Promise(() => {})};
  const timeout = AbortSignal.timeout(1500);
  const result = await Promise.race([
    pageReadings(context, place, {cache, budget: 15}),
    new Promise((_, reject) => timeout.addEventListener("abort", () => reject(Error("read timed out")))),
  ]);
  assert.deepEqual(result, {forecast: null, rain: null, road: null});
});

test("snapshot fallback handles freshness, expiry, and provider outages independently", async t => {
  const now = Date.now();
  t.mock.method(globalThis, "fetch", async () => new Response(null, {status: 503}));
  const cache = cacheWith(kind => ({
    forecast: {savedAt: now, expires: now + 10000, value: {current: {}, days: []}},
    rain: {savedAt: now - hour, expires: now - 1, value: {slots: []}},
    road: {savedAt: now - 7 * hour, expires: now - 1, value: {stations: []}},
  })[kind]);
  const result = await pageReadings(context, place, {cache});
  assert.equal(result.forecast.previous, false);
  assert.equal(result.rain.previous, true);
  assert.equal(result.road, null);
});

test("brief cache refreshes yesterday's forecast at Vilnius midnight even inside the TTL", async t => {
  const now = Date.parse("2026-06-03T21:00:30Z");
  t.mock.timers.enable({apis: ["Date"], now});
  t.mock.method(globalThis, "fetch", async () => new Response(null, {status: 503}));
  const cache = cacheWith(kind => ({savedAt: now - 60000, expires: now + 60000, value: {kind}}));
  const result = await pageReadings(context, place, {cache});
  assert.equal(result.forecast.previous, true);
  assert.equal(result.rain.previous, false);
  assert.equal(result.road.previous, false);
});
