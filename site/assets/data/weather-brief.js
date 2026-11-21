const hour = 3600000;
const zone = "Europe/Vilnius";
const date = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
const clock = new Intl.DateTimeFormat("lt-LT", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const offsetClock = new Intl.DateTimeFormat("lt-LT", { timeZone: zone, hour: "2-digit", minute: "2-digit", timeZoneName: "shortOffset" });
const numbers = new Intl.NumberFormat("lt-LT", { useGrouping: false, maximumFractionDigits: 1 });
export const formatWeatherTime = time => date.format(time) + " " + clock.format(time);
export const weatherNumber = value => numbers.format(value);
export const escapeWeatherText = text => String(text).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

export function currentReading(forecast, now) {
  const recent = row => Number.isFinite(row?.temp) && Number.isFinite(row.datetimeEpoch)
    && row.datetimeEpoch * 1000 <= now + (row.source === "obs" ? 300000 : hour) && row.datetimeEpoch * 1000 >= now - 1.5 * hour;
  if (recent(forecast?.current)) return forecast.current;
  let closest;
  for (const day of forecast?.days || []) {
    for (const slot of day.hours || []) {
      if (recent(slot) && (!closest || Math.abs(slot.datetimeEpoch * 1000 - now) < Math.abs(closest.datetimeEpoch * 1000 - now))) closest = slot;
    }
  }
  return closest;
}

export function dayAt(forecast, now) {
  return forecast?.days?.find(day => day.datetime === date.format(now));
}

export function readingSource(row) {
  return { obs: "Rodmenys", comb: "Jungtiniai duomenys", fcst: "Modelio laikas" }[row?.source] || "Duomenų laikas";
}

export function readingLight(current, forecast) {
  if (current?.icon?.endsWith("-night")) return "night";
  if (!Number.isFinite(current?.datetimeEpoch)) return "day";
  const instant = current.datetimeEpoch * 1000;
  const day = dayAt(forecast, instant);
  const dawn = day?.sunrise?.slice(0, 5);
  const dusk = day?.sunset?.slice(0, 5);
  const time = clock.format(instant);
  return dawn && dusk && (time < dawn || time >= dusk) ? "night" : "day";
}

export function dayBrief(forecast, now) {
  const today = dayAt(forecast, now);
  if (!Number.isFinite(today?.tempmin) || !Number.isFinite(today.tempmax) || today.tempmin > today.tempmax) return;
  const partial = forecast.source === "MET Norway" || forecast.source === "LHMT / Meteo LT";
  return {
    title: "Šiandienos temperatūra",
    temperatures: [weatherNumber(today.tempmin) + " °C", weatherNumber(today.tempmax) + " °C"],
    detail: partial ? "Pagal pateiktas šios dienos valandas" : "",
    time: Date.parse(forecast.updatedAt || forecast.fetchedAt),
    timeLabel: forecast.updatedAt ? "Modelis atnaujintas" : "Prognozė gauta",
  };
}

export function rainBrief(outlook, now) {
  const start = Math.floor(now / hour) * hour;
  const byTime = new Map((outlook?.slots || []).filter(s => Number.isFinite(s.mm) && s.mm >= 0).map(s => [s.time, s]));
  const slots = Array.from({ length: 12 }, (_, i) => byTime.get(start + i * hour));
  const known = slots.filter(Boolean);
  if (!known.length) return;
  const first = slots.findIndex(s => s?.mm > 0);
  const title = "Krituliai per 12 val.";
  const time = Date.parse(outlook.updatedAt);
  if (first === -1) return { title, value: known.length === 12 ? "Kritulių nenumatoma" : "0 mm žinomomis valandomis",
    detail: known.length === 12 ? "0 mm per visą laikotarpį" : "Duomenys pateikti " + known.length + " iš 12 val.", time, timeLabel: "Modelis" };
  let end = first + 1;
  while (end < slots.length && slots[end]?.mm > 0) end++;
  const types = new Set(slots.slice(first, end).map(s => {
    if (s.symbol?.includes("sleet")) return "Šlapdriba";
    if (s.symbol?.includes("snow")) return "Sniegas";
    if (s.symbol?.includes("rain")) return "Lietus";
    return "Krituliai";
  }));
  const from = start + first * hour, until = start + end * hour;
  const labels = Array.from({length: 13}, (_, i) => clock.format(start + i * hour));
  const format = t => labels.indexOf(clock.format(t)) !== labels.lastIndexOf(clock.format(t)) ? offsetClock.format(t) : clock.format(t);
  const window = format(from) + "–" + format(until);
  const amount = slots.slice(first, end).reduce((mm, s) => mm + s.mm, 0);
  const duration = (end - first) + " val. · " + weatherNumber(amount) + " mm";
  return { title, value: (types.size === 1 ? [...types][0] : "Krituliai") + " " + window,
    detail: duration + (end === slots.length ? " · iki prognozės lango pabaigos" : "") + (known.length < 12 ? " · daliniai duomenys" : ""), time, timeLabel: "Modelis" };
}

// The provider identifies the two branches by section as well as code. Via Lietuva's
// 2023-640291 procurement identifies Jakų žiedinė sankryža at A1 km 304.76.
const jakaiBranches = new Map([
  ["0001090007", { section: "A01_304.760_07 (Jakų sankr.)", direction: "Vilniaus kryptis" }],
  ["0001090002", { section: "A01_304.760_02 (Jakų sankr.)", direction: "Klaipėdos kryptis" }],
]);

export function roadStationLabel(station) {
  const code = String(station.road ?? "").trim();
  const technical = /^\d{5,}$/u.test(code);
  const officialName = String(station.name).trim();
  const suffix = officialName.match(/^(.+?)\s+(\S+)\s+(\d+(?:[.,]\d+)?)(?:\s+km\.?)?$/iu);
  const samePosition = Number.isFinite(station.kilometer) && suffix &&
    weatherNumber(Number(suffix[3].replace(",", "."))) === weatherNumber(station.kilometer);
  const shortened = suffix && suffix[2] === code && (technical || samePosition) ? suffix[1] : officialName;
  const branch = jakaiBranches.get(code);
  if (branch && branch.section === String(station.section ?? "").trim()) {
    const ordinal = shortened.match(/[\p{L}\s]([12])$/u)?.[1];
    return {
      name: `Jakų žiedinė sankryža · ${branch.direction}`,
      connection: "A1 jungtis",
      point: ordinal ? `${ordinal}-oji stotelė` : "",
      kilometer: null,
    };
  }
  const name = technical ? shortened.replace(/(\p{L})(\d+)$/u, "$1 $2") : shortened;
  return {
    name, route: technical ? "" : code,
    officialName: technical ? undefined : officialName,
    kilometer: technical ? null : station.kilometer,
  };
}

export function roadBrief(roads, now) {
  const valid = roads?.stations?.filter(s => Number.isFinite(s.distance) && Number.isFinite(s.measured) && s.name
    && s.measured * 1000 <= now + 300000 && s.measured * 1000 >= now - 6 * hour) || [];
  const fresh = valid.filter(s => now - s.measured * 1000 <= 1.5 * hour);
  const [station] = (fresh.length ? fresh : valid).sort((a, b) => a.distance - b.distance);
  if (!station) return;
  const { name, officialName, connection, point } = roadStationLabel(station);
  const details = [officialName || name];
  if (connection) details.push(connection);
  if (point) details.push(point);
  details.push(weatherNumber(station.distance) + " km nuo vietovės");
  if (Number.isFinite(station.surfaceTemp)) details.push("dangos t. " + weatherNumber(station.surfaceTemp) + " °C");
  return { title: "Kelio stotelė", value: station.surface || "Danga nenurodyta",
    detail: details.join(" · "), time: station.measured * 1000,
    timeLabel: now - station.measured * 1000 > 1.5 * hour ? "Ankstesnis matavimas" : "Matuota" };
}

export function briefContents(item, fallback, previous = false) {
  const esc = escapeWeatherText;
  if (!item) return '<strong>' + esc(fallback) + '</strong><small>Duomenų šiuo metu nėra</small>';
  const stamp = Number.isFinite(item.time) ? '<time datetime="' + new Date(item.time).toISOString() + '">' +
    (previous ? "Ankstesni duomenys · " : "") + esc(item.timeLabel) + ' ' + esc(formatWeatherTime(item.time)) + '</time>' : previous ? '<small>Ankstesni duomenys</small>' : '';
  const values = item.temperatures ? `<span class="wx-brief-range">
    <span><small>Žemiausia</small><strong>${esc(item.temperatures[0])}</strong></span>
    <span><small>Aukščiausia</small><strong>${esc(item.temperatures[1])}</strong></span>
  </span>` : '<strong>' + esc(item.value) + '</strong>';
  return '<span>' + esc(item.title) + '</span>' + values +
    (item.detail ? '<small>' + esc(item.detail) + '</small>' : '') + stamp;
}

const categories = {
  sun: "Giedra", moon: "Giedra", part: "Mažai debesuota", "part-night": "Mažai debesuota",
  cloud: "Debesuota", rain: "Lietus", snow: "Sniegas", sleet: "Šlapdriba",
  fog: "Rūkas", thunder: "Perkūnija", wind: "Vėjuota",
};
export const condition = (icon = "") => {
  if (icon.includes("thunder")) return "thunder";
  if (icon.includes("sleet") || icon.includes("freezing") || (icon.includes("rain") && icon.includes("snow"))) return "sleet";
  if (icon.includes("snow")) return "snow";
  if (icon.includes("rain") || icon.includes("showers")) return "rain";
  if (icon.includes("fog")) return "fog";
  if (icon === "clear-night") return "moon";
  if (icon === "clear-day") return "sun";
  if (icon === "partly-cloudy-night") return "part-night";
  if (icon.includes("partly")) return "part";
  return icon === "wind" ? "wind" : "cloud";
};
export const label = icon => icon ? categories[condition(icon)] : "Sąlygos nenurodytos";
