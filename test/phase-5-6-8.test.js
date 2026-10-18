import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildShiftIcs, buildShiftPlan, lessonConflicts, lessonFieldError, lunarIllumination, solarFor, solarPositionAt, visibleLessons, zonedCandidates, resolveWall } from "../site/assets/phase-5-6-8-core.js";

const day = { name: "Dieninė", start: "07:00", end: "19:00", break: 30, color: "#006a44" };
const night = { name: "Naktinė", start: "23:00", end: "07:00", break: 0, color: "#315bd6" };
const plan = (patch = {}) => buildShiftPlan({
  anchor: "2027-01-01", from: "2027-01-01", to: "2027-01-08", cycleText: "D,D,P,P",
  definitions: { D: day }, holidayDates: [], ...patch,
});
const shiftPage = readFileSync(new URL("../site/pamainu-grafikas/index.html", import.meta.url), "utf8");
const shiftUI = readFileSync(new URL("../site/assets/phase-5-6-8.js", import.meta.url), "utf8");
const shiftStyles = readFileSync(new URL("../site/assets/shift-exceptions.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../site/_layouts/default.html", import.meta.url), "utf8");

test("lesson names and room text are independent from clock validation", () => {
  assert.equal(lessonFieldError("subject", "Matematika"), "");
  assert.equal(lessonFieldError("subject", "ĄČĘĖĮŠŲŪŽ"), "");
  assert.equal(lessonFieldError("room", "A-12"), "");
  assert.equal(lessonFieldError("teacher", "V. Ą"), "");
  assert.equal(lessonFieldError("start", "10:00", "", "10:45"), "");
  assert.equal(lessonFieldError("end", "10:45", "10:00", ""), "");
  assert.match(lessonFieldError("end", "09:00", "10:00", ""), /vėlesnė/);
  assert.match(lessonFieldError("start", "25:00", "", ""), /galiojantį laiką/);
});

test("school lesson conflicts are same-day, and day view filters without deleting schedule data", () => {
  const lessons = [
    { day: 0, number: 1, start: "10:00", end: "10:45" },
    { day: 0, number: 2, start: "10:40", end: "11:20" },
    { day: 0, number: 3, start: "11:20", end: "12:00" },
    { day: 1, number: 1, start: "10:15", end: "10:55" },
    { day: 5, number: 1, start: "10:00", end: "10:45" },
  ];
  assert.deepEqual(lessonConflicts(lessons).map(({ day, first, second }) => [day, first.number, second.number]), [[0, 1, 2]]);
  assert.deepEqual(visibleLessons(lessons, { days: 5, view: "day", day: 0 }).map(({ number }) => number), [1, 2, 3]);
  assert.deepEqual(visibleLessons(lessons, { days: 5, view: "week" }), lessons.slice(0, 4));
  assert.equal(lessons.length, 5, "view selection must leave stored lesson records intact");
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

test("one-day shift exceptions override only their own date and preserve the cycle", () => {
  const base = plan({ to: "2027-01-04", cycleText: "D,D,P,P", definitions: { D: day, N: night } });
  const changed = plan({ to: "2027-01-04", cycleText: "D,D,P,P", definitions: { D: day, N: night }, exceptions: [
    { date: "2027-01-03", reason: "shift", code: "N" },
    { date: "2027-01-02", reason: "leave", code: "P" },
  ] });
  assert.deepEqual(base.visible.map((shift) => [shift.date, shift.code]), [["2027-01-01", "D"], ["2027-01-02", "D"]]);
  assert.deepEqual(changed.visible.map((shift) => [shift.date, shift.code]), [["2027-01-01", "D"], ["2027-01-03", "N"]]);
  assert.equal(changed.visible.find((shift) => shift.date === "2027-01-03").exception, "shift");
  assert.deepEqual(changed.exceptions.map(({ date, reason, code }) => [date, reason, code]), [
    ["2027-01-02", "leave", "P"], ["2027-01-03", "shift", "N"],
  ]);
});

test("one-day exceptions reject duplicate dates, invalid reasons and out-of-range dates", () => {
  const duplicate = [{ date: "2027-01-02", reason: "rest", code: "P" }, { date: "2027-01-02", reason: "sick", code: "P" }];
  assert.throws(() => plan({ exceptions: duplicate }), /tik vieną/);
  assert.throws(() => plan({ exceptions: [{ date: "2027-01-02", reason: "holiday", code: "P" }] }), /rūšį/);
  assert.throws(() => plan({ exceptions: [{ date: "2027-01-09", reason: "rest", code: "P" }] }), /rodomame laikotarpyje/);
  assert.throws(() => plan({ exceptions: [{ date: "2027-01-02", reason: "shift", code: "P" }] }), /pamainos žymą/);
  assert.throws(() => plan({ exceptions: [{ date: "2027-01-02", reason: "leave", code: "D" }] }), /darbo žyma turi būti P/);
});

test("shift exceptions are editable, visible in both calendar views and scoped to the planner route", () => {
  for (const id of ["shift-exception-date", "shift-exception-reason", "shift-exception-code", "shift-exception-add", "shift-exception-list"]) assert.match(shiftPage, new RegExp(`id="${id}"`));
  assert.match(layout, /page\.phase_module == "shift".*shift-exceptions\.css/);
  assert.match(shiftUI, /Pakeista pamaina/);
  assert.match(shiftUI, /už rodomo laikotarpio, dabar netaikoma/);
  assert.match(shiftUI, /buildShiftPlan\(\{ anchor: d\["shift-anchor"\]/);
  assert.match(shiftStyles, /@media\(max-width:620px\)/);
  assert.match(shiftStyles, /@media print/);
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

test("USNO sunrise and sunset agree with 20 independently requested API examples within one UTC minute", () => {
  const references = [
    ["Vilnius", 54.68916, 25.27980, "2028-01-01", "06:42", "14:03"],
    ["Vilnius", 54.68916, 25.27980, "2028-03-20", "04:20", "16:33"],
    ["Vilnius", 54.68916, 25.27980, "2028-06-21", "01:42", "19:00"],
    ["Vilnius", 54.68916, 25.27980, "2028-10-29", "05:16", "14:48"],
    ["Kaunas", 54.90156, 23.90909, "2028-01-01", "06:49", "14:07"],
    ["Kaunas", 54.90156, 23.90909, "2028-03-20", "04:26", "16:39"],
    ["Kaunas", 54.90156, 23.90909, "2028-06-21", "01:46", "19:07"],
    ["Kaunas", 54.90156, 23.90909, "2028-10-29", "05:22", "14:53"],
    ["Klaipėda", 55.70680, 21.13912, "2028-01-01", "07:05", "14:13"],
    ["Klaipėda", 55.70680, 21.13912, "2028-03-20", "04:37", "16:50"],
    ["Klaipėda", 55.70680, 21.13912, "2028-06-21", "01:51", "19:24"],
    ["Klaipėda", 55.70680, 21.13912, "2028-10-29", "05:36", "15:01"],
    ["Šiauliai", 55.93333, 23.31667, "2028-01-01", "06:58", "14:03"],
    ["Šiauliai", 55.93333, 23.31667, "2028-03-20", "04:28", "16:41"],
    ["Šiauliai", 55.93333, 23.31667, "2028-06-21", "01:41", "19:17"],
    ["Šiauliai", 55.93333, 23.31667, "2028-10-29", "05:28", "14:52"],
    ["Panevėžys", 55.73186, 24.35983, "2028-01-01", "06:52", "14:00"],
    ["Panevėžys", 55.73186, 24.35983, "2028-03-20", "04:24", "16:37"],
    ["Panevėžys", 55.73186, 24.35983, "2028-06-21", "01:38", "19:11"],
    ["Panevėžys", 55.73186, 24.35983, "2028-10-29", "05:23", "14:49"],
  ];
  for (const [name, lat, lon, date, rise, set] of references) {
    const result = solarFor(date, { lat, lon });
    const actual = [result.sunrise, result.sunset].map((value) => new Date(value).toISOString().slice(11, 16));
    for (let i = 0; i < 2; i++) {
      const a = actual[i].split(":").reduce((n, x) => n * 60 + Number(x), 0);
      const b = [rise, set][i].split(":").reduce((n, x) => n * 60 + Number(x), 0);
      assert(Math.abs(a - b) <= 1, `${name} ${date}: ${actual[i]} differs from USNO ${[rise, set][i]}`);
    }
  }
  assert.throws(() => solarFor("2027-02-29", { lat: 54.68916, lon: 25.27980 }), /data/);
});

test("solar illustration coordinates follow the calculated seasonal path over Lithuania", () => {
  const vilnius = { lat: 54.68916, lon: 25.27980 };
  const summer = solarFor("2028-06-21", vilnius);
  const winter = solarFor("2028-12-21", vilnius);
  const summerNoon = solarPositionAt("2028-06-21", summer.noon, vilnius);
  const winterNoon = solarPositionAt("2028-12-21", winter.noon, vilnius);
  const summerRise = solarPositionAt("2028-06-21", summer.sunrise, vilnius);
  const summerSet = solarPositionAt("2028-06-21", summer.sunset, vilnius);

  assert(Math.abs(summerNoon.azimuth - 180) < 1, "summer solar transit should be due south");
  assert(summerNoon.altitude > 58 && summerNoon.altitude < 60, "summer midday altitude follows Vilnius latitude and solar declination");
  assert(winterNoon.altitude > 10 && winterNoon.altitude < 14, "winter midday remains low above the southern horizon");
  assert(Math.abs(summerRise.altitude + 0.833) < 0.05, "rise uses the conventional apparent horizon");
  assert(Math.abs(summerSet.altitude + 0.833) < 0.05, "set uses the conventional apparent horizon");
  assert(summerRise.azimuth < 55 && summerSet.azimuth > 305, "summer path rises northeast and sets northwest");
  assert.throws(() => solarPositionAt("2028-06-20", summer.noon, vilnius), /datos UTC momento/);
});

test("lunar illumination approximation stays bounded and reaches phase extrema", () => {
  const newMoon = Date.UTC(2028, 0, 1), nextMoon = newMoon + 29.53059 * 86400000;
  assert.equal(lunarIllumination(newMoon, [newMoon, nextMoon]), 0);
  assert.equal(lunarIllumination((newMoon + nextMoon) / 2, [newMoon, nextMoon]), 100);
  assert.equal(lunarIllumination(newMoon - 1, [newMoon, nextMoon]), null);
});
