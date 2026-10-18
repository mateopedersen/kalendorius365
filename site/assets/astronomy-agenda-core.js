export const VILNIUS_ZONE = "Europe/Vilnius";

const seasonLabels = [
  { id: "spring-equinox", name: "Pavasario lygiadienis" },
  { id: "summer-solstice", name: "Vasaros saulėgrįža" },
  { id: "autumn-equinox", name: "Rudens lygiadienis" },
  { id: "winter-solstice", name: "Žiemos saulėgrįža" },
];
const moonLabels = {
  new: "Jaunatis",
  first: "Priešpilnis · pirmasis ketvirtis",
  full: "Pilnatis",
  last: "Delčia · paskutinis ketvirtis",
};

export function eventLocalParts(instant, timeZone = VILNIUS_ZONE) {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new RangeError("Netinkamas astronominio įvykio laikas.");
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function composeAstronomyEvents(seasons, moonPhases, allowedYears = [2027, 2028, 2029]) {
  const years = new Set(allowedYears);
  const events = [];
  for (const yearData of seasons.events || []) {
    if (!years.has(yearData.year)) continue;
    for (const [index, utc] of (yearData.utc || []).entries()) {
      const instant = Date.parse(utc), label = seasonLabels[index];
      if (!Number.isFinite(instant) || !label) continue;
      events.push({ id: `season-${yearData.year}-${label.id}`, kind: "season", title: label.name, utc, instant });
    }
  }
  for (const event of moonPhases.events || []) {
    const instant = Date.parse(event.utc);
    if (!Number.isFinite(instant) || !moonLabels[event.phase]) continue;
    const parts = eventLocalParts(instant);
    if (!years.has(Number(parts.year))) continue;
    const key = event.utc.replace(/[^0-9]/g, "").slice(0, 12);
    events.push({ id: `moon-${event.phase}-${key}`, kind: "moon", phase: event.phase, title: moonLabels[event.phase], utc: event.utc, instant });
  }
  return events.sort((a, b) => a.instant - b.instant);
}

const escapeIcs = (value) => String(value)
  .replace(/\\/g, "\\\\")
  .replace(/\r?\n/g, "\\n")
  .replace(/;/g, "\\;")
  .replace(/,/g, "\\,");

function foldLine(line) {
  const rows = [];
  let row = "", bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > 75) { rows.push(row); row = " "; bytes = 1; }
    row += char;
    bytes += size;
  }
  rows.push(row);
  return rows.join("\r\n");
}

const utcStamp = (value) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Export exact astronomical instants as zero-duration UTC events. */
export function buildAstronomyICS(events, now = Date.now()) {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kalendorius365//Astronominiai momentai//LT", "CALSCALE:GREGORIAN",
  ];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@kalendorius365.lt`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART:${utcStamp(event.instant)}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `DESCRIPTION:${escapeIcs(`Astronominis momentas. Vietos data ir laikas rodomi pagal Europe/Vilnius. Tai nėra konkrečios vietos stebimumo prognozė. Šaltinis: U.S. Naval Observatory.`)}`,
      `CATEGORIES:${event.kind === "season" ? "SEASONS" : "MOONPHASE"}`,
      `URL:https://kalendorius365.lt/${event.kind === "season" ? "metu-laikai" : "menulio-fazes"}/`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
