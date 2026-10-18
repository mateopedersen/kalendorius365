import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as c from "../site/assets/calendar.js";
import { Store, validate, empty } from "../site/assets/storage.js";
import { exportICS, importICS } from "../site/assets/ics.js";
const data = JSON.parse(
    readFileSync(new URL("../data/calendar.json", import.meta.url)),
  ),
  years = JSON.parse(
    readFileSync(new URL("../site/assets/data/years.json", import.meta.url)),
  );
const isoWeekPages = [2027, 2028, 2029].map((year) => readFileSync(new URL(`../site/savaites/${year}/index.html`, import.meta.url), "utf8"));
const pageGenerator = readFileSync(new URL("../scripts/pages.rb", import.meta.url), "utf8");
const toolsScript = readFileSync(new URL("../site/assets/tools.js", import.meta.url), "utf8");
const yearDirectoryPage = readFileSync(new URL("../site/metai/index.html", import.meta.url), "utf8");
const yearDirectoryScript = readFileSync(new URL("../site/assets/year-directory.js", import.meta.url), "utf8");
test("Lithuanian counted nouns use singular, paucal and genitive plural forms", () => {
  const forms = ["darbo diena", "darbo dienos", "darbo dienų"];
  for (const [number, expected] of [[0,"0 darbo dienų"],[1,"1 darbo diena"],[2,"2 darbo dienos"],[5,"5 darbo dienos"],[10,"10 darbo dienų"],[11,"11 darbo dienų"],[19,"19 darbo dienų"],[21,"21 darbo diena"],[22,"22 darbo dienos"],[25,"25 darbo dienos"],[30,"30 darbo dienų"]]) {
    assert.equal(c.countNoun(number, ...forms), expected);
  }
  assert.equal(c.countForm(1, "diena", "dienos", "dienų"), "diena");
  assert.equal(c.countForm(30, "diena", "dienos", "dienų"), "dienų");
});
test("every one of 1096 target dates agrees with Ruby Gregorian/ISO data", () => {
  let count = 0;
  for (const y of years)
    for (const m of y.months) {
      assert.equal(c.monthLength(y.year, m.month), m.length);
      const grid = c.monthGrid(y.year, m.month);
      assert.equal(c.weekday(grid[0]), 0);
      for (const d of m.days) {
        count++;
        assert.equal(c.weekday(d.date) + 1, d.weekday);
        assert.deepEqual(c.isoWeek(d.date), {
          year: d.isoYear,
          week: d.isoWeek,
        });
        assert.equal(grid[m.offset + d.day - 1], d.date);
      }
      assert.deepEqual(c.holidays(y.year, data), y.holidays);
    }
  assert.equal(count, 1096);
});
test("leap years, 6-row months, navigation and ISO boundaries", () => {
  assert.equal(c.monthLength(2027, 2), 28);
  assert.equal(c.monthLength(2028, 2), 29);
  assert.equal(c.monthLength(1900, 2), 28);
  assert.equal(c.monthLength(2000, 2), 29);
  assert.equal(c.shiftMonth("2028-01-31", 1), "2028-02-29");
  assert.equal(c.shiftMonth("2027-12-31", 1), "2028-01-31");
  assert.equal(c.weekday("2027-08-01"), 6);
  assert.deepEqual(c.isoWeek("2027-01-01"), { year: 2026, week: 53 });
  assert.deepEqual(c.isoWeek("2028-01-01"), { year: 2027, week: 52 });
  assert.throws(() => c.parse("2027-02-29"));
});
test("calendar-month durations handle month ends, leap days and full years", () => {
  assert.deepEqual(c.calendarDuration("2028-01-31", "2028-03-01"), { years: 0, months: 1, days: 1 });
  assert.deepEqual(c.calendarDuration("2028-02-29", "2029-02-28"), { years: 1, months: 0, days: 0 });
  assert.deepEqual(c.calendarDuration("2027-12-31", "2028-01-01"), { years: 0, months: 0, days: 1 });
  assert.throws(() => c.calendarDuration("2028-03-01", "2028-02-29"));
});
test("ISO week identifiers resolve to validated Monday–Sunday date ranges", () => {
  assert.deepEqual(c.isoWeekRange(2026, 53), { year: 2026, week: 53, start: "2026-12-28", end: "2027-01-03" });
  assert.deepEqual(c.isoWeekRange(2027, 1), { year: 2027, week: 1, start: "2027-01-04", end: "2027-01-10" });
  assert.deepEqual(c.isoWeekRange(2028, 1), { year: 2028, week: 1, start: "2028-01-03", end: "2028-01-09" });
  for (const range of [c.isoWeekRange(2026, 53), c.isoWeekRange(2027, 1), c.isoWeekRange(2028, 1)]) {
    assert.deepEqual(c.isoWeek(range.start), { year: range.year, week: range.week });
    assert.deepEqual(c.isoWeek(range.end), { year: range.year, week: range.week });
  }
  assert.throws(() => c.isoWeekRange(2027, 53), /savaitės nėra/);
  assert.throws(() => c.isoWeekRange(2027, 0), /ISO metus/);
  for (const [index, year] of [2027, 2028, 2029].entries()) {
    assert.match(isoWeekPages[index], /id="iso-week-range"/);
    assert.match(isoWeekPages[index], /id="iso-week-copy"/);
    assert.match(isoWeekPages[index], new RegExp(`id="iso-week-year"[^>]+value="${year}"`));
  }
  assert.match(pageGenerator, /id="iso-week-range"/);
  assert.match(toolsScript, /cal\.isoWeekRange\(Number\(\$\("#iso-week-year"\)\.value\), Number\(\$\("#iso-week-number"\)\.value\)\)/);
});
test("year directory facts and two-year comparison use the shared calendar engine", () => {
  for (const [year, days, start, end] of [[2027,365,"penktadienis","penktadienis"],[2028,366,"šeštadienis","sekmadienis"],[2029,365,"pirmadienis","pirmadienis"]]) {
    assert.match(yearDirectoryPage, new RegExp(`<strong data-year-days>${days} dienos</strong>`));
    assert.match(yearDirectoryPage, new RegExp(`/${year}/`));
    assert.match(yearDirectoryPage, new RegExp(`data-year-card="${year}"`));
    assert.ok(c.formatDate(`${year}-01-01`, { weekday: "long" }).includes(start));
    assert.ok(c.formatDate(`${year}-12-31`, { weekday: "long" }).includes(end));
  }
  assert.match(yearDirectoryPage, /id="year-comparison-form"/);
  assert.match(yearDirectoryScript, /yearFacts\(year\)/);
  assert.match(yearDirectoryScript, /renderYearPrintAssets/);
  assert.match(toolsScript, /cal\.workStats\(start, end, data\)/);
  assert.equal(c.workStats("2027-01-01", "2027-12-31", data).days, 252);
  assert.equal(c.workStats("2027-01-01", "2027-12-31", data).hours, 2009);
});
test("movable and statutory holidays; no substitute Mondays", () => {
  assert.equal(c.easter(2027), "2027-03-28");
  assert.equal(c.easter(2028), "2028-04-16");
  assert.equal(c.easter(2029), "2029-04-01");
  for (const y of [2027, 2028, 2029]) {
    const hs = c.holidays(y, data);
    assert.equal(hs.length, 16);
    assert(hs.every((h) => h.classification === "statutory"));
    assert.equal(
      hs.find((h) => h.id === "easter-monday").date,
      c.addDays(c.easter(y), 1),
    );
    assert.equal(c.weekday(hs.find((h) => h.id === "mothers").date), 6);
    assert.equal(c.weekday(hs.find((h) => h.id === "fathers").date), 6);
  }
  assert(!c.holidays(2028, data).some((h) => h.date === "2028-01-03"));
});
test("working-day offsets skip weekends and Lithuanian public holidays", () => {
  assert.equal(c.addWorkdays("2027-02-12", 2, data), "2027-02-17");
  assert.equal(c.addWorkdays("2027-02-17", -1, data), "2027-02-15");
  assert.equal(c.addWorkdays("2027-06-23", 1, data), "2027-06-25");
  assert.equal(c.addWorkdays("2027-06-24", 0, data), "2027-06-24");
  assert.throws(() => c.addWorkdays("2027-01-01", 1.5, data));
  assert.throws(() => c.addWorkdays("2027-01-01", 36601, data));
});
test("public holiday lookup reuses immutable years and retains classifications", () => {
  const commemorations = [{ id: "example", title: "Atmintina diena", month: 2, day: 16 }];
  const lookup = c.createCalendarEntries(data, commemorations), original = lookup(2028);
  assert.equal(lookup(2028), original);
  assert.deepEqual(original, [...c.holidays(2028, data), {
    id: "example", name: "Atmintina diena", date: "2028-02-16", classification: "commemoration",
  }]);
  assert.ok(Object.isFrozen(original) && original.every(Object.isFrozen));
  assert.throws(() => original.push({}));
  assert.throws(() => { original[0].date = "2028-12-31"; });
  for (let year = 2030; year < 2046; year++) lookup(year);
  assert.notEqual(lookup(2028), original);
  assert.deepEqual(lookup(2028), original);
  assert.notEqual(c.createCalendarEntries(data, commemorations)(2028), original);
});
test("all monthly workdays and preholiday hours match Ruby; target includes Jan 1 next year", () => {
  for (const y of years)
    for (const six of [false, true])
      for (const m of y[six ? "work6" : "work5"]) {
        const a = `${y.year}-${String(m.month).padStart(2, "0")}-01`,
          b = `${a.slice(0, 8)}${c.monthLength(y.year, m.month)}`;
        const s = c.workStats(a, b, data, six);
        assert.equal(s.days, m.days);
        assert.equal(s.hours, m.hours);
        assert.equal(s.weekends, m.weekends);
        assert.equal(s.publicDays, m.holidays);
        assert.deepEqual(s.shortened, m.shortened);
      }
  assert(
    c
      .workStats("2027-12-31", "2027-12-31", data)
      .shortened.includes("2027-12-31"),
  );
});
test("Vilnius date rollover, DST gaps and repeated hour", () => {
  assert.equal(c.today(new Date("2027-01-01T22:30:00Z")), "2027-01-02");
  assert.equal(c.today(new Date("2027-07-01T21:30:00Z")), "2027-07-02");
  assert.equal(
    new Date(c.zonedInstant("2027-03-27T09:00")).toISOString(),
    "2027-03-27T07:00:00.000Z",
  );
  assert.equal(
    new Date(c.zonedInstant("2027-03-29T09:00")).toISOString(),
    "2027-03-29T06:00:00.000Z",
  );
  assert.throws(() => c.zonedInstant("2027-03-28T03:30"));
  assert.equal(
    new Date(c.zonedInstant("2027-10-31T03:30")).toISOString(),
    "2027-10-31T00:30:00.000Z",
  );
  assert.equal(c.difference("2027-03-27", "2027-03-29"), 2);
});
test("reused date formatters preserve Lithuanian options and every supplied instant", () => {
  const settings = [
    {}, { weekday: "long" }, { month: "short", year: undefined },
    { weekday: "long", year: undefined, month: undefined, day: undefined },
    { timeZone: "Europe/Vilnius", month: "2-digit", day: "2-digit" },
  ];
  for (const date of ["1900-01-01", "2000-02-29", "2027-03-28", "2027-10-31", "2100-12-31"])
    for (const options of settings) {
      const expected = new Intl.DateTimeFormat("lt-LT", {
        timeZone: "UTC", year: "numeric", month: "long", day: "numeric", ...options,
      }).format(c.parse(date));
      assert.equal(c.formatDate(date, options), expected);
      assert.equal(c.formatDate(date, Object.fromEntries(Object.entries(options).reverse())), expected);
    }
  for (const instant of ["2027-03-27T21:59:59Z", "2027-03-27T22:00:00Z", "2027-03-28T21:00:00Z", "2027-10-30T20:59:59Z", "2027-10-30T21:00:00Z", "2027-10-31T22:00:00Z"]) {
    const now = new Date(instant), parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: c.TZ, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now), values = Object.fromEntries(parts.map(p => [p.type, p.value]));
    assert.equal(c.today(now), `${values.year}-${values.month}-${values.day}`);
  }
  assert.throws(() => c.formatDate("2027-02-29"));
  assert.throws(() => c.formatDate("2027-01-01", { timeZone: "invalid" }));
  assert.throws(() => c.formatDate("2027-01-01", { weekday: null, year: undefined, month: undefined, day: undefined }));
});
const event = () => ({
  id: "test",
  title: "Šeimos įvykis, šiandien",
  description: "ĄČĘĖĮŠŲŪŽ\nAprašymas; ir \\",
  start: "2027-03-10T09:00",
  end: "2027-03-10T10:00",
  allDay: false,
  category: 4,
  important: true,
  repeat: "weekly",
  until: "2027-05-01",
});
test("storage CRUD, corruption/quota protection and validation", () => {
  let value;
  const memory = { getItem: () => value, setItem: (k, v) => (value = v) };
  const s = new Store(memory);
  s.update((d) => {
    d.events.push(event());
    d.tasks.push({
      id: "t",
      date: "2027-03-10",
      title: "Užduotis",
      done: false,
    });
    d.notes["2027-03-10"] = "Privatu";
  });
  assert.equal(new Store(memory).data.notes["2027-03-10"], "Privatu");
  s.update((d) => (d.tasks[0].done = true));
  assert(new Store(memory).data.tasks[0].done);
  const invalid = empty();
  invalid.events = [{ ...event(), start: "2027-02-30T10:00" }];
  assert.throws(() => validate(invalid));
  assert.throws(() => s.restore("{bad"));
  assert.equal(s.data.events.length, 1);
  const blocked = new Store({
    getItem: () => "{bad",
    setItem: () => {
      throw Error();
    },
  });
  assert(blocked.locked);
  assert.throws(() => blocked.update((d) => (d.events = [])));
  const full = new Store({
    getItem: () => null,
    setItem: () => {
      throw Error("Quota");
    },
  });
  assert.throws(() => full.update((d) => (d.notes.x = "x")));
  assert.equal(full.data.events.length, 0);
});
test("ICS UTF-8 folding, escaping and round trip with timezone recurrence", () => {
  let e = event();
  e.title += "ą".repeat(100);
  const raw = exportICS([e]);
  for (const l of raw.split("\r\n")) assert(Buffer.byteLength(l) <= 75);
  const r = importICS(raw);
  assert.equal(r.rejected.length, 0);
  assert.equal(r.imported.length, 1);
  const copy = { ...r.imported[0], id: e.id };
  assert.deepEqual(copy, e);
  const a = {
    ...event(),
    allDay: true,
    start: "2028-02-29",
    end: "2028-02-29",
    repeat: "yearly",
    until: "",
  };
  assert.equal(importICS(exportICS([a])).imported[0].end, "2028-02-29");
  const bad = raw.replace("FREQ=WEEKLY", "FREQ=WEEKLY;BYDAY=MO,TU");
  assert.equal(importICS(bad).rejected.length, 1);
});
test("recurrence handles nonexistent month days and leap days", () => {
  const e = {
    ...event(),
    start: "2028-02-29",
    end: "2028-02-29",
    allDay: true,
    repeat: "yearly",
    until: "",
  };
  assert(!c.occursOn(e, "2029-02-28"));
  assert(c.occursOn(e, "2032-02-29"));
  const m = { ...e, start: "2027-01-31", end: "2027-01-31", repeat: "monthly" };
  assert(!c.occursOn(m, "2027-02-28"));
  assert(c.occursOn(m, "2027-03-31"));
});

test("real elapsed duration follows DST and all-day multi-day ranges remain intact", () => {
  const e = {
    ...event(),
    start: "2027-03-28T02:30",
    end: "2027-03-28T04:00",
    repeat: "none",
  };
  assert.equal(c.durationMinutes(e), 30);
  const all = {
    ...event(),
    allDay: true,
    start: "2027-03-10",
    end: "2027-03-12",
    repeat: "none",
  };
  assert.equal(c.durationMinutes(all), 4320);
  assert.deepEqual(c.occurrence(all, "2027-03-11"), all);
});
test('JSON backup restores valid data and rejects incompatible preferences',()=>{let raw;const storage={getItem:()=>raw,setItem:(k,v)=>raw=v};const s=new Store(storage);s.update(d=>d.notes['2028-02-29']='Atsarginis užrašas');const backup=JSON.stringify(s.data);s.update(d=>d.notes['2028-02-29']='Pakeista');s.restore(backup);assert.equal(new Store(storage).data.notes['2028-02-29'],'Atsarginis užrašas');const invalid=empty();invalid.preferences.visible=[true];assert.throws(()=>validate(invalid));const corrupt=new Store({getItem:()=>'{corrupt original',setItem:()=>{throw Error('blocked')}});assert.equal(corrupt.raw,'{corrupt original');assert(corrupt.locked);});
test("personal-data deletion clears private records but preserves preferences", () => {
  let raw;
  const storage = { getItem: () => raw, setItem: (_key, value) => (raw = value) };
  const store = new Store(storage);
  store.update((data) => {
    data.events.push(event());
    data.tasks.push({ id: "task", date: "2027-03-10", title: "Užduotis", done: false });
    data.notes["2027-03-10"] = "Privatu";
    data.preferences.city = "vilnius";
    data.preferences["large-text"] = true;
  });
  assert.equal(store.clearPersonalData(), true);
  const restored = new Store(storage).data;
  assert.deepEqual(restored.events, []);
  assert.deepEqual(restored.tasks, []);
  assert.deepEqual(restored.notes, {});
  assert.equal(restored.preferences.city, "vilnius");
  assert.equal(restored.preferences["large-text"], true);
});
test("personal-data deletion removes unreadable data when overwrite fails", () => {
  let raw = "{corrupt private data";
  const storage = {
    getItem: () => raw,
    setItem: () => { throw Error("blocked"); },
    removeItem: () => { raw = null; },
  };
  const store = new Store(storage);
  assert(store.locked);
  assert.equal(store.clearPersonalData(), false);
  assert.equal(raw, null);
  assert.equal(store.locked, false);
  assert.deepEqual(store.data.events, []);
});
