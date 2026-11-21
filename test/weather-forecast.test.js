import assert from "node:assert/strict";
import test from "node:test";
import { getOpenForecast, weatherDate } from "../lib/weather-forecast.mjs";
import { getDisplayClimate, getDisplayForecast } from "../lib/weather-display-forecast.mjs";
import { weatherView, climateSpan } from "../lib/weather-view.mjs";
import { onRequestGet as forecastApi } from "../functions/api/oru-prognoze.js";

const place = { latitude: 55.3738, longitude: 25.4381 };
const day = "2026-10-25";
const at = new Date(day + "T10:33:00Z");
const epoch = utc => Date.parse(utc) / 1000;

test("checks the provider point and uses Vilnius time through the repeated autumn hour", async () => {
  const slots = [
    { datetimeEpoch: epoch(day + "T01:00:00Z"), temp: 8, source: "fcst" },
    { datetimeEpoch: epoch(day + "T00:00:00Z"), temp: 7, source: "fcst" },
    { datetimeEpoch: epoch(day + "T01:00:00Z"), temp: 8, source: "fcst" },
    { datetimeEpoch: epoch(day + "T23:00:00Z"), temp: 100, source: "fcst" },
  ];
  const result = await getDisplayForecast(place, at, async url => {
    assert.match(url.pathname, /55\.3738,25\.4381/);
    assert.equal(url.searchParams.get("timezone"), "Europe/Vilnius");
    return Response.json({
      ...place, timezone: "Europe/Vilnius",
      currentConditions: { datetimeEpoch: epoch(day + "T06:00:00Z"), temp: 100 },
      days: [{ datetime: day, tempmin: 7, tempmax: 9, source: "fcst", hours: slots }],
    });
  });
  assert.equal(result.current, null);
  assert.equal(result.complete, false);
  assert.equal(result.cacheSeconds, 300);
  assert.deepEqual(result.days[0].hours.map(hour => [hour.datetime, hour.temp]), [["03:00", 7], ["03:00", 8]]);
});

test("the open forecast uses the village point without requesting a display-only provider or inventing wind or hourly coverage", async () => {
  const result = await getOpenForecast(place, at, async url => {
    assert.equal(url.hostname, "api.met.no");
    assert.equal(url.search, "?lat=55.3738&lon=25.4381");
    const slot = { instant: { details: { air_temperature: 8, wind_speed: null } } };
    return Response.json({
      geometry: { coordinates: [place.longitude, place.latitude, 77] },
      properties: { timeseries: [
        { time: day + "T10:00:00Z", data: { ...slot, next_1_hours: { details: { precipitation_amount: 0 } } } },
        { time: "2026-10-26T10:00:00Z", data: { ...slot, next_6_hours: { details: { precipitation_amount: 5 } } } },
      ] },
    });
  });
  assert.equal(result.source, "MET Norway");
  assert.equal(result.days[0].hours[0].precip, 0);
  assert.equal(result.days[0].hours[0].windspeed, undefined);
  assert.equal(result.days[0].precip, undefined);
  assert.deepEqual(result.days[1].hours, []);
});

test("climate periods cover each Vilnius calendar day and mark gaps as partial", async () => {
  const date = new Date("2026-12-31T22:05:00Z");
  for (const [first, last] of [[15, 30], [31, 58], [59, 61]]) {
    const days = Array.from({ length: last - first + 1 }, (_, index) => ({
      datetime: weatherDate(date, first + index), source: "stats", tempmin: -4, tempmax: 2, precip: 0,
    }));
    const getForecast = payload => getDisplayClimate(place, days[0].datetime, days.at(-1).datetime, date, async url => {
      assert.ok(url.pathname.endsWith(`/${days[0].datetime}/${days.at(-1).datetime}`));
      return Response.json({ ...place, timezone: "Europe/Vilnius", days: payload });
    });
    const complete = await getForecast([...days].reverse());
    assert.equal(complete.complete, true);
    assert.deepEqual(complete.days.map(day => day.datetime), days.map(day => day.datetime));
    assert.equal(complete.days[0].precip, 0);

    const partial = await getForecast(days.map((day, index) => index === 1 ? { ...day, source: "fcst" } : day));
    assert.equal(partial.complete, false);
    assert.equal(partial.cacheSeconds, 300);
    assert.equal(partial.days.some(day => day.datetime === days[1].datetime), false);
  }
});

test("long outlooks accept a single valid month within the requested Vilnius-local horizon", () => {
  const at = new Date("2026-12-31T22:05:00Z");
  const select = query => weatherView(new URLSearchParams(query), at);
  assert.deepEqual(select("dienos=30&menuo=2027-02"), { period: 30, month: "2027-01" });
  assert.deepEqual(select("dienos=45&menuo=2027-99"), { period: 45, month: "2027-01" });
  assert.deepEqual(select("dienos=90&menuo=2027-03"), { period: 90, month: "2027-03" });
  assert.deepEqual(climateSpan(at, select("dienos=90&menuo=2027-02")), { start: "2027-02-01", end: "2027-02-28" });
  assert.deepEqual(climateSpan(at, select("dienos=45&menuo=2027-02")), { start: "2027-02-01", end: "2027-02-14" });
  assert.deepEqual(climateSpan(at, select("dienos=30")), { start: "2027-01-16", end: "2027-01-30" });
  assert.deepEqual(select("dienos=90000"), { period: 5, month: null });
});

test("legacy climate data URLs are unavailable even with an old cache key", async t => {
  t.mock.method(globalThis, "fetch", () => { throw Error("No upstream call expected"); });
  for (const segment of ["16-30", "31-45", "46-90", "climate", "stats"]) {
    const result = await forecastApi({ request: new Request("https://kalendorius365.lt/api/oru-prognoze?vieta=vilnius&dalis=" + segment + "&diena=2026-11-20&taskas=54.68,25.27") });
    assert.equal(result.status, 404);
    assert.ok((await result.json()).error);
  }
});
