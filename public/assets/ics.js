import { addDays, wallTime, zonedInstant } from "/assets/releases/e4d0b4c1c5ab76e39d0c/calendar.js";
import { validate, empty } from "/assets/releases/e4d0b4c1c5ab76e39d0c/storage.js";
const escape = (s) =>
  String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const unescape = (s) =>
  s.replace(/\\([nN,;\\])/g, (_, c) => (/[nN]/.test(c) ? "\n" : c));
const compact = (s) => s.replace(/[-:]/g, "") + (s.includes("T") ? "00" : "");
function fold(line) {
  const chars = [...line];
  let rows = [],
    row = "",
    size = 0;
  for (const c of chars) {
    const n = new TextEncoder().encode(c).length;
    if (size + n > 74) {
      rows.push(row);
      row = " ";
      size = 1;
    }
    row += c;
    size += n;
  }
  rows.push(row);
  return rows.join("\r\n");
}
export function exportICS(events) {
  let lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kalendorius365//LT Calendar//LT",
    "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Vilnius",
    "BEGIN:DAYLIGHT",
    "DTSTART:19960331T030000",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0300",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "DTSTART:19961027T040000",
    "TZOFFSETFROM:+0300",
    "TZOFFSETTO:+0200",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + escape(e.id) + "@kalendorius365.lt",
      "DTSTAMP:" +
        new Date()
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}/, ""),
      "SUMMARY:" + escape(e.title),
      "DESCRIPTION:" + escape(e.description),
      "CATEGORIES:" + e.category,
      "X-K365-IMPORTANT:" + (e.important ? "TRUE" : "FALSE"),
    );
    if (e.allDay)
      lines.push(
        "DTSTART;VALUE=DATE:" + compact(e.start),
        "DTEND;VALUE=DATE:" + compact(addDays(e.end, 1)),
      );
    else
      lines.push(
        "DTSTART;TZID=Europe/Vilnius:" + compact(e.start),
        "DTEND;TZID=Europe/Vilnius:" + compact(e.end),
      );
    if (e.repeat !== "none") {
      let r = "RRULE:FREQ=" + e.repeat.toUpperCase();
      if (e.until)
        r +=
          ";UNTIL=" +
          (e.allDay
            ? compact(e.until)
            : new Date(zonedInstant(e.until + "T23:59"))
                .toISOString()
                .replace(/[-:]/g, "")
                .replace(/\.\d{3}/, ""));
      lines.push(r);
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
function valueDate(key, value) {
  if (/VALUE=DATE(?:;|$)/.test(key)) {
    if (!/^\d{8}$/.test(value)) throw Error("Nepalaikoma data");
    return {
      allDay: true,
      value:
        value.slice(0, 4) + "-" + value.slice(4, 6) + "-" + value.slice(6, 8),
    };
  }
  if (!/^\d{8}T\d{6}Z?$/.test(value) || value.slice(13, 15) !== "00")
    throw Error("Palaikomas minutės tikslumas");
  let s =
    value.slice(0, 4) +
    "-" +
    value.slice(4, 6) +
    "-" +
    value.slice(6, 8) +
    "T" +
    value.slice(9, 11) +
    ":" +
    value.slice(11, 13);
  if (value.endsWith("Z"))
    return { allDay: false, value: wallTime(Date.parse(s + "Z")) };
  if (!key.includes("TZID=Europe/Vilnius"))
    throw Error("Palaikoma Europe/Vilnius laiko juosta arba UTC");
  return { allDay: false, value: s };
}
export function importICS(raw) {
  if (raw.length > 2e6) throw Error("ICS failas per didelis");
  const unfolded = raw.replace(/\r?\n[ \t]/g, "");
  if (!unfolded.includes("BEGIN:VCALENDAR"))
    throw Error("Tai nėra ICS kalendorius");
  const blocks = unfolded.match(/BEGIN:VEVENT\r?\n[\s\S]*?END:VEVENT/g) || [];
  if (blocks.length > 1000)
    throw Error("Vienu kartu galima importuoti iki 1000 įvykių");
  const imported = [],
    rejected = [];
  for (const block of blocks) {
    try {
      const props = block
        .split(/\r?\n/)
        .slice(1, -1)
        .map((line) => {
          const pos = line.indexOf(":");
          return [line.slice(0, pos), line.slice(pos + 1)];
        });
      if (
        props.some(([k]) =>
          /^(EXDATE|RDATE|RECURRENCE-ID|DURATION|ATTENDEE|ORGANIZER|STATUS)/.test(
            k,
          ),
        ) ||
        block.includes("BEGIN:VALARM")
      )
        throw Error("Sudėtingos išimtys, kvietimai ir priminimai nepalaikomi");
      const get = (name) => props.find(([k]) => k.split(";")[0] === name);
      for (const name of ["DTSTART", "DTEND", "RRULE", "SUMMARY"])
        if (props.filter(([k]) => k.split(";")[0] === name).length > 1)
          throw Error("Pasikartojanti ICS savybė");
      const start = get("DTSTART"),
        end = get("DTEND");
      if (!start || !get("SUMMARY"))
        throw Error("Trūksta pradžios arba pavadinimo");
      let a = valueDate(...start),
        b = end ? valueDate(...end) : a;
      if (a.allDay !== b.allDay) throw Error("Nesuderintos datos");
      const e = {
        id: crypto.randomUUID(),
        title: unescape(get("SUMMARY")[1]),
        description: unescape(get("DESCRIPTION")?.[1] || ""),
        start: a.value,
        end: end && a.allDay ? addDays(b.value, -1) : b.value,
        allDay: a.allDay,
        category: /^[0-6]$/.test(get("CATEGORIES")?.[1] || "")
          ? +get("CATEGORIES")[1]
          : 0,
        important: get("X-K365-IMPORTANT")?.[1] === "TRUE",
        repeat: "none",
        until: "",
      };
      const r = get("RRULE");
      if (r) {
        const parts = Object.fromEntries(
          r[1].split(";").map((p) => p.split("=")),
        );
        if (Object.keys(parts).some((k) => !["FREQ", "UNTIL"].includes(k)))
          throw Error(
            "Palaikomi tik paprasti kasdieniai, savaitiniai, mėnesiniai ir metiniai kartojimai",
          );
        e.repeat = parts.FREQ.toLowerCase();
        if (parts.UNTIL) {
          const u = parts.UNTIL;
          e.until = /^\d{8}$/.test(u)
            ? valueDate("UNTIL;VALUE=DATE", u).value
            : valueDate("UNTIL", u).value.slice(0, 10);
        }
      }
      const x = empty();
      x.events = [e];
      validate(x);
      imported.push(e);
    } catch (error) {
      rejected.push(error.message);
    }
  }
  return { imported, rejected };
}
