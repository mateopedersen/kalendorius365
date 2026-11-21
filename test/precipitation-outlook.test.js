import assert from "node:assert/strict";
import test from "node:test";
import { getPrecipitationOutlook } from "../lib/precipitation-outlook.mjs";

const place = { latitude: 55.7332, longitude: 24.3571 };
const geometry = { type: "Point", coordinates: [place.longitude, place.latitude] };
const at = new Date("2026-11-21T10:38:00Z");
const base = Date.parse("2026-11-21T10:00:00Z");
const row = (hour, amount) => ({
  time: new Date(base + hour * 3600000).toISOString(),
  data: { next_1_hours: { details: { precipitation_amount: amount, probability_of_precipitation: 42 },
    summary: { symbol_code: "lightsleet" } } },
});
test("MET Norway preserves dry hours, precipitation type and gaps at local coordinates", async () => {
  const data = await getPrecipitationOutlook(place, at, async (url, options) => {
    assert.equal(url.search, "?lat=55.7332&lon=24.3571");
    assert.match(options.headers["User-Agent"], /kalendorius365.lt/);
    return Response.json({ geometry, properties: { meta: { updated_at: at.toISOString() },
      timeseries: [row(-1, .1), row(0, 0), row(1, null), row(2, .4), row(36, 1)] } },
    { headers: { Expires: "Sat, 21 Nov 2026 11:08:00 GMT" } });
  });
  assert.equal(data.cacheSeconds, 1800);
  assert.deepEqual(data.slots.map(slot => [slot.time, slot.mm, slot.symbol, slot.chance]),
    [[base,0,"lightsleet",42],[base+7200000,.4,"lightsleet",42]]);
});
test("missing near-term coverage never becomes a dry forecast", async () => {
  const response = () => Response.json({ geometry, properties: { meta: {}, timeseries: [row(-1, 0), row(12, 0)] } });
  await assert.rejects(getPrecipitationOutlook(place, at, response), /No near-term/);
});
test("only valid provider ranges and thunder probabilities reach the outlook", async () => {
  const first = row(0, .3);
  const next = row(1, 0);
  Object.assign(first.data.next_1_hours.details, { precipitation_amount_min: 0, precipitation_amount_max: 1.7, probability_of_thunder: 27 });
  Object.assign(next.data.next_1_hours.details, { precipitation_amount_min: 2, precipitation_amount_max: 1, probability_of_thunder: 110 });
  const response = () => Response.json({ geometry, properties: { meta: {}, timeseries: [first, next] } });
  const { slots } = await getPrecipitationOutlook(place, at, response);
  assert.deepEqual(slots.map(({ min, max, thunder }) => [min, max, thunder]), [[0, 1.7, 27], [undefined, undefined, undefined]]);
});
