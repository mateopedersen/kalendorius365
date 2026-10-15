import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildDays,
  evaluateRange,
  generateCandidates,
  optimizeMultiple,
  parseDateList,
  rankCandidates,
  validateDateInputs,
} from "../site/assets/leave-planner.js";

const data = JSON.parse(readFileSync(new URL("../data/calendar.json", import.meta.url)));

test("ISO date lists are strict, unique, year-scoped, and accept common separators", () => {
  assert.deepEqual(parseDateList("2027-01-02, 2027-05-03;\n2027-12-31", { year: 2027 }), [
    "2027-01-02",
    "2027-05-03",
    "2027-12-31",
  ]);
  assert.throws(() => parseDateList("2027-02-29", { year: 2027 }));
  assert.throws(() => parseDateList("2027-01-02,2027-01-02", { year: 2027 }), /kelis kartus/);
  assert.throws(() => parseDateList("2028-01-02", { year: 2027 }), /2027/);
});

test("New Year holiday and weekend days make a three-day break without leave", () => {
  const { days } = validateDateInputs(2027, data, {});
  const candidate = generateCandidates(days, { minDays: 3, maxDays: 3 })
    .find((item) => item.start === "2027-01-01");
  assert(candidate);
  assert.equal(candidate.end, "2027-01-03");
  assert.equal(candidate.daysOff, 3);
  assert.equal(candidate.leaveDays, 0);
  assert.equal(candidate.holidayDays, 1);
  assert.equal(rankCandidates([candidate], { budget: 0, mode: "efficiency" })[0], candidate);
});

test("six-day and custom schedules count only scheduled non-holiday workdays", () => {
  const five = buildDays("2027-01-01", "2027-01-03", data, { workdays: [0, 1, 2, 3, 4] });
  const six = buildDays("2027-01-01", "2027-01-03", data, { workdays: [0, 1, 2, 3, 4, 5] });
  assert.equal(five.filter((day) => day.eligible).length, 0);
  assert.equal(six.filter((day) => day.eligible).length, 1);
  const custom = buildDays("2027-01-04", "2027-01-10", data, { workdays: [1, 3] });
  assert.equal(custom.filter((day) => day.eligible).length, 2);
  assert.equal(custom.find((day) => day.date === "2027-01-05").eligible, true);
  assert.equal(custom.find((day) => day.date === "2027-01-06").eligible, false);
});

test("a Saturday statutory holiday does not become a substitute Monday", () => {
  const may = buildDays("2027-05-01", "2027-05-03", data);
  assert.equal(may.find((day) => day.date === "2027-05-01").holiday?.id, "labour");
  assert.equal(may.find((day) => day.date === "2027-05-03").holiday, null);
  assert.equal(may.find((day) => day.date === "2027-05-03").eligible, true);
});

test("booked leave, blackout dates, rest dates, and schedule mismatches are explicit", () => {
  assert.throws(
    () => validateDateInputs(2027, data, { bookedText: "2027-01-02" }),
    /įprastai dirbama diena/,
  );
  assert.throws(
    () => validateDateInputs(2027, data, { bookedText: "2027-05-03", blackoutText: "2027-05-03" }),
    /užblokuotos atostogos/,
  );
  const parsed = validateDateInputs(2027, data, {
    bookedText: "2027-05-03",
    blackoutText: "2027-06-01",
    customRestText: "2027-06-02",
  });
  const aday = parsed.days.find((day) => day.date === "2027-05-03");
  assert.equal(aday.booked, true);
  assert.equal(aday.eligible, false);
  assert.equal(parsed.days.find((day) => day.date === "2027-06-01").blackout, true);
  assert.equal(parsed.days.find((day) => day.date === "2027-06-02").restDay, true);
});

test("manual evaluation uses both adjacent calendar years across New Year", () => {
  const result = evaluateRange("2027-12-31", "2028-01-03", data);
  assert.equal(result.daysOff, 4);
  assert.equal(result.holidayDays, 1);
  assert.equal(result.additionalLeaveDays, 2);
  assert.deepEqual(result.holidayNames.map((item) => item.date), ["2028-01-01"]);
});

test("2028 leap day is a real date and remains a scheduled workday", () => {
  const days = buildDays("2028-02-28", "2028-03-01", data);
  assert.deepEqual(days.map((day) => day.date), ["2028-02-28", "2028-02-29", "2028-03-01"]);
  assert.equal(days.find((day) => day.date === "2028-02-29").eligible, true);
});

test("multiple-period optimizer stays within budget and agrees with exhaustive search on a short horizon", () => {
  const days = buildDays("2027-01-01", "2027-01-14", data);
  const candidates = generateCandidates(days, { minDays: 2, maxDays: 5 });
  const budget = 4;
  const maxPeriods = 2;
  const actual = optimizeMultiple(days, candidates, { budget, maxPeriods });
  assert(actual.leaveDays <= budget);
  assert(actual.periods.length <= maxPeriods);

  const nextIndex = (endIndex) => {
    let index = endIndex + 1;
    while (index < days.length && !days[index].resumesWork) index++;
    return index < days.length ? index + 1 : days.length;
  };
  const better = (a, b) => {
    if (a.daysOff !== b.daysOff) return a.daysOff > b.daysOff ? a : b;
    if (a.leaveDays !== b.leaveDays) return a.leaveDays < b.leaveDays ? a : b;
    if (a.periods.length !== b.periods.length) return a.periods.length < b.periods.length ? a : b;
    const aa = a.periods.map((period) => period.start).join("|");
    const bb = b.periods.map((period) => period.start).join("|");
    return aa <= bb ? a : b;
  };
  let best = { daysOff: 0, leaveDays: 0, periods: [] };
  const walk = (from, left, selected) => {
    const score = {
      daysOff: selected.reduce((sum, period) => sum + period.daysOff, 0),
      leaveDays: selected.reduce((sum, period) => sum + period.leaveDays, 0),
      periods: selected,
    };
    best = better(best, score);
    if (selected.length === maxPeriods) return;
    for (const candidate of candidates) {
      if (candidate.startIndex < from || candidate.leaveDays > left) continue;
      walk(nextIndex(candidate.endIndex), left - candidate.leaveDays, [...selected, candidate]);
    }
  };
  walk(0, budget, []);
  assert.deepEqual(actual, best);
});

test("invalid ranges and empty custom work schedules fail clearly", () => {
  assert.throws(() => buildDays("2027-02-30", "2027-03-01", data));
  assert.throws(() => evaluateRange("2027-06-01", "2027-05-31", data));
  assert.throws(() => buildDays("2027-06-01", "2027-06-03", data, { workdays: [] }), /bent vieną/);
});
