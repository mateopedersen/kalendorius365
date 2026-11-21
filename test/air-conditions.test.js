import assert from "node:assert/strict";
import test from "node:test";
import { getAirConditions } from "../lib/air-conditions.mjs";

const place = { latitude: 55.7304, longitude: 24.3506 };
const now = new Date("2026-11-21T11:34:00Z");
const hour = "2026-11-21T11:00:00Z";
const air = 'cnc_PM2_5[unit="kg/m3"],cnc_PM10[unit="kg/m3"],cnc_NO2_gas[unit="mole/m3"],cnc_O3_gas[unit="mole/m3"],cnc_SO2_gas[unit="mole/m3"]';
const pollen = 'cnc_POLLEN_BIRCH_m22[unit="number/m3"],cnc_POLLEN_GRASS_m32[unit="number/m3"]';
const csv = (header, values, grid = "55.75,24.35") => new Response(
  `time,latitude[unit="degrees_north"],longitude[unit="degrees_east"],${header}\r\n${hour},${grid},${values}\r\n`);

test("uses the place's coordinates, converts pollutant units and selects the worst EEA band", async () => {
  const data = await getAirConditions(place, now, async url => {
    const query = url.searchParams;
    assert.equal(url.hostname, "thredds.silam.fmi.fi");
    assert.equal(query.get("latitude"), "55.7304");
    assert.equal(query.get("longitude"), "24.3506");
    assert.equal(query.get("time_start"), "2026-11-21T10:00:00.000Z");
    const variables = query.get("var");
    if (variables === "POLI") {
      assert.equal(query.has("vertCoord"), false);
      return csv('POLI[unit=""]', 2);
    }
    assert.equal(query.get("vertCoord"), "12.5");
    if (variables.startsWith("cnc_PM")) return csv(air, "1e-9,3e-9,2e-6,1e-6,0");
    return csv(pollen, "10,0");
  });
  assert.deepEqual(data.air[0], {
    time: Date.parse(hour), level: 3, values: { pm25: 1, pm10: 3, no2: 92.011, o3: 48, so2: 0 },
  });
  assert.deepEqual(data.pollen[0], { time: Date.parse(hour), values: { birch: 10, grass: 0 }, level: 2 });
});

test("keeps valid partial readings and skips missing values, unknown units and invalid indices", async () => {
  const data = await getAirConditions(place, now, async url => {
    const variables = url.searchParams.get("var");
    if (variables === "POLI") return csv('POLI[unit=""]', 0);
    if (variables.startsWith("cnc_PM")) return csv(air.replace('cnc_PM10[unit="kg/m3"]','cnc_PM10[unit="other"]'), "0,1e-5,,1e-6,-9.9999898E14");
    return csv(pollen, "3,");
  });
  assert.deepEqual(data.air[0].values, { pm25: 0, o3: 48 });
  assert.equal(data.air[0].level, null);
  assert.deepEqual(data.pollen[0].values, { birch: 3 });
  assert.equal(data.pollen[0].level, null);
  assert.equal(data.cacheSeconds, 300);
});

test("an upstream failure leaves the other model available and a total outage fails the request", async () => {
  const outage = () => new Response(null, { status: 503 });
  const data = await getAirConditions(place, now, async url =>
    url.searchParams.get("var") === "POLI" ? csv('POLI[unit=""]', 1) : outage());
  assert.deepEqual(data.air, []);
  assert.equal(data.pollen[0].level, 1);
  await assert.rejects(getAirConditions(place, now, outage), /No SILAM forecast/);
});

test("retries only a transiently unavailable model series", async () => {
  let airAttempts = 0;
  let pollenAttempts = 0;
  const data = await getAirConditions(place, now, async url => {
    if (url.searchParams.get("var").startsWith("cnc_PM")) {
      airAttempts += 1;
      if (airAttempts === 1) return new Response(null, { status: 503 });
      return csv(air, "1e-9,3e-9,0,1e-6,0");
    }
    pollenAttempts += 1;
    return new Response(null, { status: 404 });
  });
  assert.equal(airAttempts, 2);
  assert.equal(pollenAttempts, 2);
  assert.equal(data.air.length, 1);
});

test("a response from a distant model cell does not become local air or allergy data", async () => {
  await assert.rejects(getAirConditions(place, now, async () => csv('POLI[unit=""]', 1, "54.7,25.3")),
    /No SILAM forecast/);
});
