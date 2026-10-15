import test from "node:test";
import assert from "node:assert/strict";
import { buildShiftIcs, buildShiftPlan, lunarIllumination, solarFor, zonedCandidates, resolveWall } from "../site/assets/phase-5-6-8-core.js";

const day = { name: "Dieninė", start: "07:00", end: "19:00", break: 30, color: "#006a44" };
const night = { name: "Naktinė", start: "23:00", end: "07:00", break: 0, color: "#315bd6" };
const plan = (patch = {}) => buildShiftPlan({
  anchor: "2027-01-01", from: "2027-01-01", to: "2027-01-08", cycleText: "D,D,P,P",
  definitions: { D: day }, holidayDates: [], ...patch,
});

test("shift cycles handle year boundaries, leap day, breaks and exact holiday-date intersections", () => {
  const result = plan({ anchor: "2027-12-31", from: "2027-12-31", to: "2028-01-01", cycleText: "N,P",
    definitions: { N: night }, holidayDates: ["2028-01-01"] });
  assert.equal(result.visible.length, 1);
  assert.equal(result.visible[0].date, "2027-12-31");
  assert.equal(result.visible[0].endDate, "2028-01-01");
  assert.equal(result.visible[0].elapsed, 8);
  assert.deepEqual(result.visible[0].holidayDates, ["2028-01-01"]);
  const leap = plan({ anchor: "2028-02-29", from: "2028-02-29", to: "2028-03-01", cycleText: "D,P",
    definitions: { D: day }, holidayDates: [] });
  assert.equal(leap.visible[0].date, "2028-02-29");
  assert.equal(leap.visible[0].worked, 11.5);
});

test("shift cycle input validates format, length, definitions, and non-rest days", () => {
  assert.throws(() => plan({ cycleText: "P,P", definitions: {} }), /trumpos žymos/);
  assert.throws(() => plan({ cycleText: "D,XXX", definitions: { D: day } }), /trūksta/);
  assert.throws(() => plan({ cycleText: "D", definitions: { D: { ...day, start: "25:00" } } }), /aprašas/);
  assert.throws(() => plan({ from: "2027-01-09", to: "2027-01-08" }), /Laikotarpis/);
  assert.throws(() => plan({ from: "2027-02-29" }), /Patikrinkite datą/);
  assert.throws(() => plan({ cycleText: "D,N", definitions: { D: day, N: { ...day, color: day.color } } }), /skirtingą spalvą/);
});

test("daily and rolling seven-day rest reminders use elapsed shift duration", () => {
  const regular = plan({ to: "2027-01-14" });
  assert.deepEqual(regular.weeklyWarnings, []);
  const continuous = plan({ to: "2027-01-14", cycleText: "D", definitions: { D: { ...day, end: "20:00", break: 0 } } });
  assert(continuous.weeklyWarnings.length > 0);
  assert(continuous.visible.some((s) => s.requiredRest === 24));
  assert(continuous.visible.some((s) => s.rest < s.requiredRest));
});

test("Europe/Vilnius nonexistent and repeated wall times require explicit handling", () => {
  assert.equal(zonedCandidates("2027-03-28T03:30").length, 0);
  assert.throws(() => resolveWall("2027-03-28T03:30"), /nėra dėl laiko juostos/);
  const repeated = zonedCandidates("2027-10-31T03:30");
  assert.equal(repeated.length, 2);
  assert.equal(repeated[1] - repeated[0], 3600000);
  assert.throws(() => resolveWall("2027-10-31T03:30", "ask"), /pasikartoja/);
  assert.equal(resolveWall("2027-10-31T03:30", "later") - resolveWall("2027-10-31T03:30", "earlier"), 3600000);
  for (const [spring, autumn] of [["2028-03-26", "2028-10-29"], ["2029-03-25", "2029-10-28"]]) {
    assert.equal(zonedCandidates(`${spring}T03:30`).length, 0, `${spring} spring clock gap`);
    assert.equal(zonedCandidates(`${autumn}T03:30`).length, 2, `${autumn} autumn repeated hour`);
  }
  const autumnNight = buildShiftPlan({ anchor: "2027-10-30", from: "2027-10-30", to: "2027-10-30", cycleText: "N",
    definitions: { N: night }, foldPolicy: "earlier" });
  assert.equal(autumnNight.visible[0].elapsed, 9, "overnight shift includes the repeated autumn hour");
  const springNight = buildShiftPlan({ anchor: "2027-03-27", from: "2027-03-27", to: "2027-03-27", cycleText: "N",
    definitions: { N: night }, foldPolicy: "earlier" });
  assert.equal(springNight.visible[0].elapsed, 7, "overnight shift excludes the skipped spring hour");
  const shifted = buildShiftPlan({ anchor: "2027-10-31", from: "2027-10-31", to: "2027-10-31", cycleText: "D",
    definitions: { D: { ...day, start: "03:30", end: "11:00", break: 0 } }, foldPolicy: "later" });
  assert.equal(shifted.visible.length, 1);
});

test("shift ICS uses elapsed UTC times, escapes text and folds within RFC 5545 byte limits", () => {
  const definition = { ...night, name: `${"ą".repeat(33)},;\\\n` };
  const shift = buildShiftPlan({ anchor: "2027-10-30", from: "2027-10-30", to: "2027-10-30", cycleText: "N",
    definitions: { N: definition }, foldPolicy: "earlier" }).visible;
  const ics = buildShiftIcs(shift, { N: definition }, Date.UTC(2027, 0, 1));
  assert.match(ics, /DTSTART:20271030T200000Z/);
  assert.match(ics, /DTEND:20271031T050000Z/);
  assert(ics.replace(/\r\n /g, "").includes(`SUMMARY:${"ą".repeat(33)}\\,\\;\\\\\\n`));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert(ics.endsWith("END:VCALENDAR\r\n"));
  for (const line of ics.split("\r\n")) assert(Buffer.byteLength(line, "utf8") <= 75, `ICS line exceeds 75 octets: ${line}`);
});

test("NOAA solar results agree with independently tabulated USNO examples within two UTC minutes", () => {
  const vilnius = { lat: 54.68916, lon: 25.27980 };
  const references = [
    ["2028-01-01", "06:42", "14:03"],
    ["2028-03-20", "04:20", "16:33"],
    ["2028-06-21", "01:42", "19:00"],
    ["2028-10-29", "05:16", "14:48"],
  ];
  for (const [date, rise, set] of references) {
    const result = solarFor(date, vilnius);
    const actual = [result.sunrise, result.sunset].map((value) => new Date(value).toISOString().slice(11, 16));
    for (let i = 0; i < 2; i++) {
      const a = actual[i].split(":").reduce((n, x) => n * 60 + Number(x), 0);
      const b = [rise, set][i].split(":").reduce((n, x) => n * 60 + Number(x), 0);
      assert(Math.abs(a - b) <= 2, `${date}: ${actual[i]} differs from reference ${[rise,set][i]}`);
    }
  }
  assert.throws(() => solarFor("2027-02-29", vilnius), /data/);
});

test("lunar illumination approximation stays bounded and reaches phase extrema", () => {
  const newMoon = Date.UTC(2028, 0, 1), nextMoon = newMoon + 29.53059 * 86400000;
  assert.equal(lunarIllumination(newMoon, [newMoon, nextMoon]), 0);
  assert.equal(lunarIllumination((newMoon + nextMoon) / 2, [newMoon, nextMoon]), 100);
  assert.equal(lunarIllumination(newMoon - 1, [newMoon, nextMoon]), null);
});
