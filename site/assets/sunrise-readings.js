import { solarFor } from "./phase-5-6-8-core.js";
import { TZ } from "./calendar.js";

const dateLabel = new Intl.DateTimeFormat("lt-LT", {
  timeZone: "UTC", year: "numeric", month: "long", day: "numeric",
});
const timeLabel = new Intl.DateTimeFormat("lt-LT", {
  timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export const sunDateLabel = date => dateLabel.format(new Date(`${date}T12:00:00Z`));
export const sunClock = instant => timeLabel.format(instant);
export const daylightLabel = minutes => `${Math.floor(minutes / 60)} val. ${String(minutes % 60).padStart(2, "0")} min.`;

export function dateAfter(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function solarWeek(date, city, first = solarFor(date, city)) {
  const lastDate = "2100-12-31";
  const rows = [];
  for (let offset = 0; offset < 7; offset++) {
    const day = dateAfter(date, offset);
    if (day > lastDate) break;
    const times = offset === 0 ? first : solarFor(day, city);
    rows.push({
      date: day,
      label: sunDateLabel(day),
      sunrise: sunClock(times.sunrise),
      sunset: sunClock(times.sunset),
      noon: sunClock(times.noon),
      sunriseAt: new Date(times.sunrise).toISOString(),
      sunsetAt: new Date(times.sunset).toISOString(),
      daylight: daylightLabel(times.dayMinutes),
    });
  }
  return rows;
}
