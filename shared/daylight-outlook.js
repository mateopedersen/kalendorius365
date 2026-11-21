// Compare complete two-hour intervals only. Both hours use the same precipitation
// model and the sunrise/sunset times belong to this forecast point and civil day.
const hour = 3600000;
const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vilnius", year: "numeric", month: "2-digit", day: "2-digit" });
const localClock = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Vilnius", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const displayDate = new Intl.DateTimeFormat("lt-LT", { timeZone: "Europe/Vilnius", month: "long", day: "numeric" });
const amount = new Intl.NumberFormat("lt-LT", { useGrouping: false, maximumFractionDigits: 2 });
const solarTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Vilnius", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const solarClock = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

function seconds(clock) {
  const [h, m, s = 0] = clock.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

// Where a forecast omits solar times, calculate them for the registered point.
export function withLocalSun(forecast, point, solarFor, now = Date.now()) {
  if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lon)) return forecast;
  const start = Date.parse(localDate.format(now) + "T12:00:00Z");
  const days = [0, 1, 2].map(offset => {
    const datetime = new Date(start + offset * 24 * hour).toISOString().slice(0, 10);
    const day = forecast?.days?.find(row => row.datetime === datetime);
    if (solarClock.test(day?.sunrise) && solarClock.test(day?.sunset)) return day;
    const sun = solarFor(datetime, point);
    return Number.isFinite(sun.sunrise) && Number.isFinite(sun.sunset) ?
      {datetime, sunrise: solarTime.format(sun.sunrise), sunset: solarTime.format(sun.sunset)} : {datetime};
  });
  return {days};
}

export function daylightOutlook(forecast, outlook, now = Date.now()) {
  if (!Array.isArray(forecast?.days) || !Array.isArray(outlook?.slots) || !Number.isFinite(Date.parse(outlook.updatedAt))) return null;
  const issue = Date.parse(outlook.updatedAt);
  if (issue > now + 300000 || issue < now - 24 * hour) return null;
  const first = Math.ceil(now / hour) * hour;
  const days = new Map(forecast.days.map(day => [day.datetime, day]));
  const slots = new Map(outlook.slots.filter(slot => Number.isFinite(slot.mm) && slot.mm >= 0).map(slot => [slot.time, slot.mm]));
  let best;
  for (let t = first; t + 2 * hour <= now + 36 * hour; t += hour) {
    if (!slots.has(t) || !slots.has(t + hour)) continue;
    const day = days.get(localDate.format(t));
    if (!day || day.datetime !== localDate.format(t + 2 * hour) || !solarClock.test(day.sunrise) || !solarClock.test(day.sunset)) continue;
    const rise = seconds(day.sunrise), set = seconds(day.sunset);
    const start = localClock.format(t), end = localClock.format(t + 2 * hour);
    const startSec = seconds(start), endSec = seconds(end);
    if (startSec < rise || endSec > set || endSec - startSec !== 7200) continue;
    const mm = Math.round((slots.get(t) + slots.get(t + hour)) * 1000) / 1000;
    if (!best || mm < best.mm) best = { t, day: day.datetime, rise: day.sunrise.slice(0, 5), set: day.sunset.slice(0, 5),
      start, end, mm, x: 100 * (startSec - rise) / (set - rise), width: 100 * (endSec - startSec) / (set - rise) };
  }
  return best || null;
}

export function daylightMarkup(forecast, outlook, now = Date.now()) {
  const best = daylightOutlook(forecast, outlook, now);
  if (!best) return "";
  const timing = best.start + "–" + best.end;
  return `<div class="wx-daylight-copy"><h3>Mažiausiai kritulių šviesiu metu</h3>
    <p><strong>${displayDate.format(best.t)} · ${timing}</strong></p>
    <p>Per šias dvi valandas prognozuojama ${amount.format(best.mm)} mm kritulių. Palyginti šviesaus meto tarpai per artimiausias 36 valandas.</p>
    <a href="/mano-diena/?data=${best.day}">Atverti dienos planą</a></div>
    <div class="wx-daylight-track"><span>Dienos šviesa</span>
      <svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 9 Q50 -6 100 9" fill="none" stroke="#b78937" stroke-width="0.7" vector-effect="non-scaling-stroke"/>
      <rect y="8" width="100" height="3" fill="#d7d8be" rx="1"/><rect x="${best.x.toFixed(2)}" y="7" width="${best.width.toFixed(2)}" height="5" fill="#246653" rx="1.3"/></svg>
      <div><span>Saulėtekis ${best.rise}</span><span>Saulėlydis ${best.set}</span></div></div>`;
}
