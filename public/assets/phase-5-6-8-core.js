export const ZONE = "Europe/Vilnius";
const DAY_MS = 86400000;
const partsAt = (instant, zone) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
  timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).formatToParts(new Date(instant)).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));

/** All UTC instants that round-trip to an IANA local wall time. */
export function zonedCandidates(local, zone = ZONE) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(local)) throw Error("Patikrinkite datą ir laiką.");
  const [ymd, hm] = local.split("T"), [year, month, day] = ymd.split("-").map(Number), [hour, minute] = hm.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || new Date(target).toISOString().slice(0, 10) !== ymd) throw Error("Patikrinkite datą ir laiką.");
  const matches = new Set(), offsets = new Set();
  // Sample offsets around the wall time, then round-trip each candidate. This is
  // faster than formatting every 30-minute instant while still detecting DST folds.
  for (let probe = target - 36 * 3600000; probe <= target + 36 * 3600000; probe += 3 * 3600000) {
    const p = partsAt(probe, zone);
    const representedAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    offsets.add(representedAsUtc - probe);
  }
  for (const offset of offsets) {
    const candidate = target - offset, c = partsAt(candidate, zone);
    if (`${c.year}-${c.month}-${c.day}T${c.hour}:${c.minute}` === local) matches.add(candidate);
  }
  return [...matches].sort((a, b) => a - b);
}
export function resolveWall(local, foldPolicy = "earlier", zone = ZONE) {
  const candidates = zonedCandidates(local, zone);
  if (!candidates.length) throw Error(`${local.replace("T", " ")} vietos laiko nėra dėl laiko juostos pokyčio. Pasirinkite kitą laiką.`);
  if (candidates.length > 1 && foldPolicy === "ask") throw Error(`${local.replace("T", " ")} pasikartoja dėl vasaros laiko. Pasirinkite ankstesnį arba vėlesnį momentą.`);
  return candidates[foldPolicy === "later" ? candidates.length - 1 : 0];
}

const dateParts = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value)) throw Error("Patikrinkite datą.");
  const [year, month, day] = value.split("-").map(Number);
  const instant = Date.UTC(year, month - 1, day);
  if (new Date(instant).toISOString().slice(0, 10) !== value) throw Error("Patikrinkite datą.");
  return { year, month, day, instant };
};
const shiftDate = (date, amount) => new Date(dateParts(date).instant + amount * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((dateParts(b).instant - dateParts(a).instant) / DAY_MS);
const validClock = (value) => typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

/** Build a validated, DST-aware local shift cycle. holidayDates is a verified date list. */
export function buildShiftPlan({ anchor, from, to, cycleText, definitions, foldPolicy = "ask", holidayDates = [], zone = ZONE }) {
  dateParts(anchor); dateParts(from); dateParts(to);
  const span = daysBetween(from, to);
  if (span < 0 || span > 369) throw Error("Laikotarpis turi būti nuo 1 iki 370 kalendorinių dienų.");
  if (Math.abs(daysBetween(anchor, from)) > 10000) throw Error("Ciklo pradžia per toli nuo peržiūros laikotarpio.");
  const cycle = typeof cycleText === "string" ? cycleText.split(",").map((x) => x.trim().toUpperCase()) : [];
  if (!cycle.length || cycle.length > 31 || cycle.some((x) => !/^[A-Z0-9]{1,4}$/.test(x)) || !cycle.some((x) => x !== "P"))
    throw Error("Cikle naudokite iki 31 trumpos žymos; poilsio dienai naudokite P.");
  if (!definitions || typeof definitions !== "object" || Array.isArray(definitions) || Object.keys(definitions).length > 8)
    throw Error("Nurodykite iki 8 skirtingų pamainų aprašų.");
  for (const [code, def] of Object.entries(definitions)) {
    if (!/^[A-Z0-9]{1,4}$/.test(code) || code === "P" || !def || typeof def !== "object" ||
      typeof def.name !== "string" || !def.name.trim() || def.name.length > 40 ||
      !validClock(def.start) || !validClock(def.end) || !Number.isInteger(def.break) || def.break < 0 || def.break > 720 ||
      !/^#[0-9a-fA-F]{6}$/.test(def.color) || (def.note !== undefined && (typeof def.note !== "string" || def.note.length > 160)) ||
      (def.location !== undefined && (typeof def.location !== "string" || def.location.length > 60))) throw Error(`Netinkamas pamainos aprašas „${code}“.`);
  }
  if (new Set(Object.values(definitions).map((def) => def.color.toLowerCase())).size !== Object.keys(definitions).length)
    throw Error("Kiekvienai pamainai pasirinkite skirtingą spalvą; žyma lieka ir spalvota, ir tekstinė.");
  const missing = [...new Set(cycle.filter((code) => code !== "P" && !definitions[code]))];
  if (missing.length) throw Error(`Cikle trūksta šių pamainų aprašų: ${missing.join(", ")}.`);
  const holidays = new Set(holidayDates);
  const buffer = cycle.length + 8;
  const shifts = [];
  for (let date = shiftDate(from, -buffer); date <= shiftDate(to, buffer); date = shiftDate(date, 1)) {
    const offset = daysBetween(anchor, date);
    const code = cycle[((offset % cycle.length) + cycle.length) % cycle.length];
    if (code === "P") continue;
    const def = definitions[code], endDate = def.end <= def.start ? shiftDate(date, 1) : date;
    const startUtc = resolveWall(`${date}T${def.start}`, foldPolicy, zone);
    const endUtc = resolveWall(`${endDate}T${def.end}`, foldPolicy, zone);
    const elapsed = (endUtc - startUtc) / 3600000;
    if (elapsed <= 0 || elapsed > 24) throw Error(`${date} pamainos faktinė trukmė turi būti nuo 0 iki 24 valandų.`);
    if (def.break > elapsed * 60) throw Error("Pertrauka negali būti ilgesnė už pamainą.");
    const holidayTouched = [];
    for (let day = date; day <= endDate; day = shiftDate(day, 1)) {
      const dayStart = resolveWall(`${day}T00:00`, "earlier", zone), nextDay = shiftDate(day, 1);
      const dayEnd = resolveWall(`${nextDay}T00:00`, "later", zone);
      if (startUtc < dayEnd && endUtc > dayStart && holidays.has(day)) holidayTouched.push(day);
    }
    shifts.push({ date, code, symbol: code, name: def.name, color: def.color, note: def.note || "", location: def.location || "", startTime: def.start, endTime: def.end, endDate,
      startUtc, endUtc, elapsed, worked: elapsed - def.break / 60, holidayDates: holidayTouched });
  }
  for (let i = 0; i < shifts.length; i++) {
    shifts[i].rest = i + 1 < shifts.length ? (shifts[i + 1].startUtc - shifts[i].endUtc) / 3600000 : null;
    shifts[i].requiredRest = shifts[i].elapsed > 12 ? 24 : 11;
  }
  // Check each seven-consecutive-local-calendar-day window, allowing for long cycle gaps.
  const weeklyWarnings = [];
  if (shifts.length) for (let date = from; date <= to; date = shiftDate(date, 1)) {
    const start = resolveWall(`${date}T00:00`, "earlier", zone), end = resolveWall(`${shiftDate(date, 7)}T00:00`, "later", zone);
    let covered = false;
    for (let i = 0; i < shifts.length - 1; i++) {
      const gapStart = shifts[i].endUtc, gapEnd = shifts[i + 1].startUtc;
      if (Math.min(gapEnd, end) - Math.max(gapStart, start) >= 35 * 3600000) { covered = true; break; }
    }
    if (!covered) weeklyWarnings.push(date);
  }
  return { all: shifts, visible: shifts.filter((s) => s.date >= from && s.date <= to), weeklyWarnings };
}

/** RFC 5545 calendar export. Lines stay within 75 UTF-8 octets, including fold-space. */
export function buildShiftIcs(shifts, definitions, stampNow = Date.now()) {
  if (!Array.isArray(shifts) || !shifts.length || !definitions || typeof definitions !== "object" || !Number.isFinite(stampNow))
    throw Error("Pirmiausia apskaičiuokite grafiką ir patikrinkite pamainų aprašus.");
  const esc = (value) => String(value).replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
  const fold = (line) => {
    let out = "", bytes = 0;
    for (const char of line) {
      const size = new TextEncoder().encode(char).length;
      if (bytes + size > 74) { out += "\r\n "; bytes = 1; }
      out += char; bytes += size;
    }
    return out;
  };
  const stamp = (instant) => {
    if (!Number.isFinite(instant)) throw Error("Pamainos UTC laikas neteisingas.");
    return new Date(instant).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  };
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kalendorius365//Pamainu grafikas//LT", "CALSCALE:GREGORIAN"];
  for (const shift of shifts) {
    const definition = definitions[shift.code];
    if (!definition || typeof definition.name !== "string") throw Error(`Trūksta pamainos aprašo „${shift.code}“.`);
    lines.push("BEGIN:VEVENT", `UID:${shift.date}-${shift.code}-${shift.startTime.replace(":", "")}@kalendorius365.lt`,
      `DTSTAMP:${stamp(stampNow)}`, `DTSTART:${stamp(shift.startUtc)}`, `DTEND:${stamp(shift.endUtc)}`,
      `SUMMARY:${esc(definition.name)}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

function solarElements(instant) {
  // USNO's compact solar-coordinate algorithm: apparent ecliptic longitude,
  // right ascension, declination and equation of time from Julian date.
  const julianDays = instant / DAY_MS + 2440587.5 - 2451545.0;
  const rad = (value) => value * Math.PI / 180;
  const wrap = (value) => ((value % 360) + 360) % 360;
  const anomaly = rad(wrap(357.529 + 0.98560028 * julianDays));
  const meanLongitude = wrap(280.459 + 0.98564736 * julianDays);
  const apparentLongitude = rad(wrap(meanLongitude + 1.915 * Math.sin(anomaly) + 0.020 * Math.sin(2 * anomaly)));
  const obliquity = rad(23.439 - 0.00000036 * julianDays);
  const rightAscension = wrap(Math.atan2(Math.cos(obliquity) * Math.sin(apparentLongitude), Math.cos(apparentLongitude)) * 180 / Math.PI);
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(apparentLongitude));
  const equationDegrees = ((meanLongitude - rightAscension + 540) % 360) - 180;
  return { equation: equationDegrees * 4, declination };
}

function solarDate(date, city) {
  if (!/^\d{4}-\d\d-\d\d$/.test(date) || !city || !Number.isFinite(city.lat) || !Number.isFinite(city.lon) || Math.abs(city.lat)>90 || Math.abs(city.lon)>180) throw Error("Neteisinga data arba miesto koordinatės.");
  const [year, month, day] = date.split("-").map(Number), midnight = Date.UTC(year, month - 1, day);
  if (new Date(midnight).toISOString().slice(0, 10) !== date) throw Error("Neteisinga data.");
  const doy = Math.floor((midnight - Date.UTC(year, 0, 0)) / DAY_MS), leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0), yearLength = leap ? 366 : 365;
  return { year, doy, yearLength, midnight };
}

/** Solar altitude and azimuth at a UTC instant, using the same USNO elements as rise/set. */
export function solarPositionAt(date, instant, city) {
  const { midnight } = solarDate(date, city);
  if (!Number.isFinite(instant) || new Date(instant).toISOString().slice(0, 10) !== date) throw Error("Saulės padėčiai reikia pasirinktos datos UTC momento.");
  const rad = (n) => n * Math.PI / 180;
  const { equation, declination } = solarElements(instant);
  const trueSolarTime = ((instant - midnight) / 60000 + equation + 4 * city.lon + 1440) % 1440;
  const hourAngle = rad(trueSolarTime / 4 - 180), latitude = rad(city.lat);
  const sineAltitude = Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sineAltitude))) * 180 / Math.PI;
  const azimuth = (Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(latitude) - Math.tan(declination) * Math.cos(latitude)) * 180 / Math.PI + 180 + 360) % 360;
  return { altitude, azimuth };
}

/** USNO approximate solar coordinates iterated at each event's UTC instant. */
export function solarFor(date, city) {
  const { midnight } = solarDate(date, city);
  const rad = (n) => n * Math.PI / 180;
  const elements = (utcMinutes) => solarElements(midnight + utcMinutes * 60000);
  const hourAngle = (zenith, declination) => {
    const cosine = Math.cos(rad(zenith)) / (Math.cos(rad(city.lat)) * Math.cos(declination)) - Math.tan(rad(city.lat)) * Math.tan(declination);
    if (cosine > 1) return null; if (cosine < -1) return 180;
    return Math.acos(cosine) * 180 / Math.PI;
  };
  const solve = (zenith, direction) => {
    let minute = 720 - 4 * city.lon;
    for (let i = 0; i < 8; i++) {
      const { equation, declination } = elements(minute);
      const angle = hourAngle(zenith, declination);
      if (angle === null || angle === 180) return null;
      const next = 720 - 4 * city.lon - equation + direction * 4 * angle;
      if (Math.abs(next - minute) < 0.01) { minute = next; break; }
      minute = next;
    }
    return midnight + minute * 60000;
  };
  let noonMinutes = 720 - 4 * city.lon;
  for (let i = 0; i < 8; i++) {
    const next = 720 - 4 * city.lon - elements(noonMinutes).equation;
    if (Math.abs(next - noonMinutes) < 0.01) { noonMinutes = next; break; }
    noonMinutes = next;
  }
  const rise = solve(90.833, -1), set = solve(90.833, 1), civilStart = solve(96, -1), civilEnd = solve(96, 1), event = (minute) => midnight + minute * 60000;
  return {
    sunrise: rise,
    sunset: set,
    noon: event(noonMinutes),
    dayMinutes: rise === null ? 0 : set === null ? 1440 : Math.round((set - rise) / 60000),
    civilStart,
    civilEnd,
  };
}

export function lunarIllumination(instant, newMoonInstants) {
  const previous = [...newMoonInstants].reverse().find((n) => n <= instant), next = newMoonInstants.find((n) => n > instant);
  if (previous === undefined || next === undefined || next <= previous) return null;
  const angle = 2 * Math.PI * (instant - previous) / (next - previous);
  return Math.round(100 * (1 - Math.cos(angle)) / 2);
}
