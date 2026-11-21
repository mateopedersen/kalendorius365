import assert from "node:assert/strict";
import test from "node:test";
import { climateWindows, getWeatherForecast, weatherDate } from "../lib/weather-forecast.mjs";

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
  const result = await getWeatherForecast(place, "forecast", at, async url => {
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

test("a wrong-location primary response falls back to the village point without inventing wind or hourly coverage", async () => {
  const result = await getWeatherForecast(place, "forecast", at, async url => {
    if (url.hostname.includes("visualcrossing")) return Response.json({ latitude: 54.7, longitude: 25.3, timezone: "Europe/Vilnius" });
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
  for (const [segment, [first, last]] of Object.entries(climateWindows)) {
    const days = Array.from({ length: last - first + 1 }, (_, index) => ({
      datetime: weatherDate(date, first + index), source: "stats", tempmin: -4, tempmax: 2, precip: 0,
    }));
    const getForecast = payload => getWeatherForecast(place, segment, date, async url => {
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
