import test from "node:test";
import assert from "node:assert/strict";
import { solarFor } from "../site/assets/phase-5-6-8-core.js";
import { daylightOutlook, daylightMarkup, withLocalSun } from "../shared/daylight-outlook.js";

const hour = 3600000;
const base = Date.parse("2026-11-21T06:00:00Z"); // 08:00 in Vilnius
const solar = { days: [{ datetime: "2026-11-21", sunrise: "08:00:51", sunset: "16:00:30" },
  { datetime: "2026-11-22", sunrise: "08:02:12", sunset: "15:59:59" }] };
const series = (rows, updated = base) => ({ updatedAt: new Date(updated).toISOString(),
  slots: rows.map(([offset, mm]) => ({ time: base + offset * hour, mm })) });

test("outdoor plan uses the least wet daylight pair and the earliest tie, retaining zero rainfall", () => {
  const data = series([[0,0],[1,0.4],[2,0.2],[3,0],[4,0],[5,0]]);
  const best = daylightOutlook(solar, data, base);
  assert.deepEqual([best.start, best.end, best.mm, best.day], ["11:00","13:00",0,"2026-11-21"]);
  assert.match(daylightMarkup(solar, data, base), /href="\/mano-diena\/\?data=2026-11-21"/);
});

test("an interval must be wholly in the future, within daylight and both readings must exist", () => {
  assert.equal(daylightOutlook(solar, series([[0,0],[1,0]]), base), null);
  assert.equal(daylightOutlook(solar, series([[1,0],[2,0]]), base + hour + 1000), null);
  assert.equal(daylightOutlook(solar, series([[1,0],[2,null],[3,0],[4,-1]]), base), null);
  assert.equal(daylightOutlook(solar, series([[7,0],[8,0]]), base), null);
  const next = daylightOutlook(solar, series([[25,0.2],[26,0.1]]), base);
  assert.deepEqual([next.day,next.start,next.end,next.mm], ["2026-11-22","09:00","11:00",0.3]);
});

test("old models and incomplete solar inputs cannot produce an outdoor recommendation", () => {
  for (const updated of [base-25*hour,base+hour]) assert.equal(daylightMarkup(solar, series([[1,0],[2,0]],updated),base),"");
  assert.equal(daylightMarkup({days:[]},series([[1,0],[2,0]]),base),"");
  assert.equal(daylightMarkup(solar,{slots:null},base),"");
});

test("precipitation-only feeds use the registered point for sunrise and sunset", () => {
  const dates = withLocalSun({days: []}, {lat: 54.9, lon: 23.9}, solarFor, base);
  const result = daylightOutlook(dates, series([[2,0],[3,0]]), base);
  assert.deepEqual([result.day, result.start, result.end], ["2026-11-21", "10:00", "12:00"]);
  assert.equal(daylightMarkup(dates,{slots:[]},base),"");
});

test("a late evening before the spring clock change includes the following civil day", () => {
  const now = Date.parse("2027-03-27T21:30:00Z");
  const forecast = withLocalSun(null, {lat: 54.9, lon: 23.9}, solarFor, now);
  assert.deepEqual(forecast.days.map(d => d.datetime), ["2027-03-27", "2027-03-28", "2027-03-29"]);
});
