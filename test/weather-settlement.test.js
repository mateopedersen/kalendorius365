import test from "node:test";
import assert from "node:assert/strict";
import { weatherPlaces } from "../lib/weather-places.mjs";
import data from "../lib/weather-settlement-data.mjs";
import { latestStationObservation, readStationObservation, settlementHeight, stationFor } from "../lib/weather-settlement.mjs";

const abaku = weatherPlaces.get("abaku-10001");
const station = stationFor(abaku);
const now = Date.parse("2026-11-21T17:45:00Z");

function payload(observations) {
  return { station: { code: station.code, coordinates: { latitude: station.latitude, longitude: station.longitude } }, observations };
}

test("every small settlement has a bounded surface profile and an official nearest station", () => {
  let count = 0;
  for (const place of weatherPlaces.values()) {
    if (place.municipality || place.solar) {
      assert.equal(settlementHeight(place), undefined);
      assert.equal(stationFor(place), null);
      continue;
    }
    count++;
    const [center, low, high] = settlementHeight(place);
    assert.ok(low <= center && center <= high, place.slug);
    const nearest = stationFor(place);
    assert.ok(nearest.km >= 0 && nearest.km < 70 && Object.hasOwn(data.stations, nearest.code), place.slug);
  }
  assert.equal(Object.keys(data.heights).length, count);
  assert.notDeepEqual(settlementHeight(abaku), settlementHeight(weatherPlaces.get("kartenos-17359")));
  assert.equal(station.code, "kretingos-ams");
});

test("station observations ignore stale, future and foreign data without dropping a measured zero", () => {
  const response = payload([
    { observationTimeUtc: "2026-11-21 15:00:00", airTemperature: 3.1 },
    { observationTimeUtc: "2026-11-21 17:00:00", airTemperature: 4.1, precipitation: 0, windSpeed: null, relativeHumidity: 900 },
    { observationTimeUtc: "2026-11-21 18:00:00", airTemperature: 2 },
  ]);
  const expected = { time: Date.parse("2026-11-21T17:00:00Z"), airTemperature: 4.1, precipitation: 0 };
  assert.deepEqual(latestStationObservation(response, station, now), expected);
  assert.equal(latestStationObservation(response, station, now + 4 * 3600_000), null);
  assert.equal(latestStationObservation({ ...response, station: { ...response.station, code: "other-ams" } }, station, now), null);
});

test("villages sharing a station share its pending request and cache", async () => {
  const entries = new Map();
  const jobs = [];
  const context = { request: new Request("https://example.test/orai/abaku-10001/"), waitUntil: promise => jobs.push(promise) };
  const cache = {
    match: async key => entries.get(key.url)?.clone(),
    put: async (key, response) => { entries.set(key.url, response); },
  };
  let calls = 0;
  const http = async () => {
    calls++;
    return Response.json(payload([{ observationTimeUtc: "2026-11-21 17:00:00", airTemperature: 4.1 }]));
  };
  const a = readStationObservation(context, station, now, cache, http);
  const b = readStationObservation(context, station, now, cache, http);
  assert.deepEqual(await a, await b);
  await Promise.all(jobs);
  await readStationObservation(context, station, now, cache, http);
  assert.equal(calls, 1);
});
