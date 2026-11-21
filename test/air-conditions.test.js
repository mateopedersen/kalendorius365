import assert from "node:assert/strict";
import test from "node:test";
import { getAirConditions } from "../lib/air-conditions.mjs";

const place = { latitude: 55.7304, longitude: 24.3506 };
const now = new Date("2026-11-21T11:34:00Z");
const hour = "2026-11-21T11:00:00Z";
const all = { pm2p5: 3.1, pm10: 8.6, no2: 92.011, o3: 48, so2: 0,
  pol_birch: 0.002, pol_grass: 1, pol_olive: 0, pol_ragw: 0, pol_mugwort: 2, pol_alder: 0 };
function probe(key, value, overrides = {}) {
  return {
    Name: "composition_europe_" + key + "_forecast_surface",
    "Grid point latitude": 55.75, "Grid point longitude": 24.35,
    Value: { Data: value, Unit: key.startsWith("pol_") ? "grains/m3" : "µg/m3" }, ...overrides,
  };
}
const reply = probes => Response.json({ Probes: probes });
const full = () => reply(Object.entries(all).map(([key, value]) => probe(key, value)));

test("one public request for the exact hour, surface ensemble and closest 0.1° cell returns all 11 concentrations", async () => {
  let calls = 0;
  const data = await getAirConditions(place, now, async (url, init) => {
    calls++;
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(url.hostname, "eccharts.ecmwf.int");
    const q = url.searchParams;
    assert.deepEqual(["token", "request", "time", "dim_originating_centre", "dim_level", "dim_type", "dim_stream"].map(k => q.get(k)),
      ["public", "GetFeatureInfo", hour, "85_2", "key_0", "fc", "oper"]);
    assert.equal(q.get("bbox"), "55.73,24.33,55.77,24.37");
    assert.equal(q.get("layers"), q.get("query_layers"));
    assert.equal(new Set(q.get("layers").split(",")).size, 11);
    assert.equal(q.get("info_format"), "application/json");
    return full();
  });
  assert.equal(calls, 1);
  assert.equal(data.source, "CAMS");
  assert.deepEqual(data.grid, { latitude: 55.75, longitude: 24.35 });
  assert.deepEqual(data.air[0], { time: Date.parse(hour), level: 3, values: { pm25: 3.1, pm10: 8.6, no2: 92.011, o3: 48, so2: 0 } });
  assert.deepEqual(data.pollen[0], { time: Date.parse(hour), values: { birch: 0.002, grass: 1, olive: 0, ragweed: 0, mugwort: 2, alder: 0 } });
  assert.equal(data.cacheSeconds, 1560);
});

test("all EEA cutoffs use the five current hourly pollutant bands in µg/m³", async () => {
  const limits = { pm2p5: [5,15,50,90,140], pm10: [15,45,120,195,270],
    no2: [10,25,60,100,150], o3: [60,100,120,160,180], so2: [20,40,125,190,275] };
  for (const [key, edges] of Object.entries(limits)) {
    for (const [level, edge] of edges.entries()) {
      for (const [value, expected] of [[edge + .49, level], [edge + .5, level + 1]]) {
        const rows = Object.keys(limits).map(k => probe(k, k === key ? value : 0));
        assert.equal((await getAirConditions(place, now, () => reply(rows))).air[0].level, expected, key + " " + value);
      }
    }
  }
});

test("missing, invalid, mismatched-grid and incorrect-unit data never become a healthy zero or an allergy index", async () => {
  const data = await getAirConditions(place, now, () => reply([
    probe("pm2p5", 0), probe("pm10", null), probe("no2", "5"), probe("so2", 1e20),
    probe("o3", 32, { Value: { Data: 32, Unit: "kg/m3" } }),
    probe("pol_birch", 1e-8), probe("pol_mugwort", -1), probe("pol_grass", 3, { "Grid point latitude": 54.65 }),
    probe("pol_unknown", 20), probe("poli", 3), probe("pol_olive", 3, { Value: { Data: 3, Unit: {} } }),
  ]));
  assert.deepEqual(data.air[0], { time: Date.parse(hour), level: null, values: { pm25: 0 } });
  assert.deepEqual(data.pollen[0], { time: Date.parse(hour), values: { birch: 1e-8 } });
  assert.equal(data.cacheSeconds, 300);
  const airOnly = await getAirConditions(place, now, () => reply([probe("pm2p5", 1)]));
  assert.deepEqual(airOnly.pollen, []);
});

test("duplicate villages in a model cell share an upstream URL and cached data expires by the next hour", async () => {
  const urls = [];
  const http = url => { urls.push(url.href); return full(); };
  await getAirConditions(place, now, http);
  await getAirConditions({ latitude: 55.71, longitude: 24.39 }, now, http);
  assert.equal(urls[0], urls[1]);
  assert.equal((await getAirConditions(place, new Date("2026-11-21T11:59:57Z"), http)).cacheSeconds, 3);
  await getAirConditions(place, new Date("2026-11-21T12:00:00Z"), http);
  assert.notEqual(urls[2], urls[3]);
});

test("unavailable hours, odd payloads, quota errors and timeouts never produce current concentrations or add requests", async t => {
  for (const upstream of [
    () => new Response(null, { status: 429 }), () => new Response(null, { status: 503 }),
    () => new Response('<ServiceException code="InvalidDimensionValue"/>'), () => Response.json({}),
    () => reply([]), () => reply([probe("pm2p5", 0, { "Grid point longitude": 21.35 })]),
    () => { throw new DOMException("The operation timed out", "TimeoutError"); },
  ]) {
    let calls = 0;
    await assert.rejects(getAirConditions(place, now, () => { calls++; return upstream(); }));
    assert.equal(calls, 1);
  }
  await t.test("the upstream deadline also aborts a slow response body", async () => {
    const controller = new AbortController();
    const deadline = t.mock.method(AbortSignal, "timeout", ms => {
      assert.ok(ms > 0 && ms < 13_000);
      queueMicrotask(() => controller.abort(new DOMException("Timed out", "TimeoutError")));
      return controller.signal;
    });
    const slow = (_url, init) => ({
      ok: true, json: () => new Promise((_, reject) => {
        if (init.signal.aborted) reject(init.signal.reason);
        else init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
      }),
    });
    await assert.rejects(getAirConditions(place, now, slow), { name: "TimeoutError" });
    assert.equal(deadline.mock.callCount(), 1);
  });
});
