import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/weather.js";
const request = (city) => ({
  request: new Request("https://kalendorius365.lt/api/weather?city=" + city),
});
test("weather rejects unapproved upstream destinations", async () => {
  const r = await onRequestGet(request("https://other.invalid"));
  assert.equal(r.status, 400);
});
test("weather source attribution, partial failure and cache contract", async () => {
  const original = globalThis.fetch;
  try {
    const urls = [];
    globalThis.fetch = async (url) => {
      urls.push(url);
      return url.includes("/stations/")
        ? Response.json({
            observations: [
              { airTemperature: 5, observationTimeUtc: "2027-01-01 12:00:00" },
            ],
          })
        : new Response("", { status: 503 });
    };
    const r = await onRequestGet(request("vilnius"));
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "public, max-age=1200");
    const json = await r.json();
    assert.equal(json.observation.observations[0].airTemperature, 5);
    assert.equal(json.forecast, null);
    assert.equal(json.license, "CC BY-SA 4.0");
    assert.equal(json.source, "LHMT / Meteo LT");
    assert(urls.every((u) => u.startsWith("https://api.meteo.lt/v1/")));
  } finally {
    globalThis.fetch = original;
  }
});
test("weather total failure returns unavailable, never invented data", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw Error("offline");
    };
    const r = await onRequestGet(request("kaunas"));
    assert.equal(r.status, 503);
    const json = await r.json();
    assert(!("temperature" in json));
    assert.equal(r.headers.get("cache-control"), "no-store");
  } finally {
    globalThis.fetch = original;
  }
});
