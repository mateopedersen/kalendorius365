import { condition, escapeWeatherText as escape, label, weatherNumber } from "../shared/weather-brief.js";

const periods = [1, 3, 5, 7, 10, 15, 30, 45, 90];
const weekday = new Intl.DateTimeFormat("lt-LT", { weekday: "long", timeZone: "UTC" });
const dateLabel = new Intl.DateTimeFormat("lt-LT", { day: "numeric", month: "long", timeZone: "UTC" });
const monthLabel = new Intl.DateTimeFormat("lt-LT", { month: "long", year: "numeric", timeZone: "UTC" });
const atNoon = iso => new Date(iso + "T12:00:00Z");
const dateAfter = (start, offset) => new Date(+atNoon(start) + offset * 86400000).toISOString().slice(0, 10);
const datesFrom = (start, offset, count) => Array.from({length: count}, (_, i) => dateAfter(start, i + offset));
const measure = (n, unit) => Number.isFinite(n) ? weatherNumber(n) + " " + unit : "–";
const metric = (title, value) => `<div><dt>${title}</dt><dd>${value}</dd></div>`;
const todayOrDay = (date, today) => {
  if (date === today) return "Šiandien";
  if (date === dateAfter(today, 1)) return "Rytoj";
  const day = weekday.format(atNoon(date));
  return day[0].toLocaleUpperCase("lt") + day.slice(1);
};

function dayCard(date, today, day, climate) {
  const heading = todayOrDay(date, today);
  const sky = climate ? "climate" : day?.icon ? condition(day.icon) : "unknown";
  const kind = climate ? "Istoriniai vidurkiai" : day ? label(day.icon) : "Prognozės duomenų nėra";
  const icon = climate ? '<img class="wx-climate-icon" src="/assets/visuals/shell/seasons.svg" width="29" height="29" alt="">' :
    day?.icon ? `<svg class="wx-condition-icon" viewBox="0 0 64 64" aria-hidden="true"><use href="#wx-sky-${sky}"></use></svg>` : "";
  const header = `<div class="wx-card-sky" data-sky="${sky}"><div class="wx-card-title"><h3>${escape(heading)}</h3><time datetime="${date}">${escape(dateLabel.format(atNoon(date)))}</time></div>
    <div class="wx-card-condition">${icon}<span>${escape(kind)}</span></div></div>`;
  if (!day) return `<article class="wx-day wx-day--missing">${header}<div class="wx-card-body"><p class="wx-message">${climate ? "Šios dienos klimato duomenų nėra." : "Šios dienos rodiklių dar nėra."}</p></div></article>`;
  const value = field => climate ? day.normal?.[field]?.[1] ?? day[field] : day[field];
  const gust = value("windgust");
  const details = climate ? metric("Drėgnis", measure(value("humidity"), "%")) : metric("Vėjo gūsiai", measure(Number.isFinite(gust) ? gust / 3.6 : undefined, "m/s"));
  const hourly = climate ? "" : `<button type="button" class="wx-action wx-day__hours" data-hour-date="${date}" aria-label="Valandinė prognozė, ${escape(dateLabel.format(atNoon(date)))}" hidden>Pagal valandas</button>`;
  return `<article class="wx-day">${header}<div class="wx-card-body"><dl class="wx-card-temps">${metric("Aukščiausia", measure(value("tempmax"), "°C"))}${metric("Žemiausia", measure(value("tempmin"), "°C"))}</dl>
    <dl class="wx-card-metrics">${metric("Krituliai", measure(value("precip"), "mm"))}${details}</dl>${hourly}</div></article>`;
}

export function forecastDisplay(today, view, readings) {
  const period = periods.includes(view?.period) ? view.period : 5;
  const forecast = readings.forecast?.value;
  const rows = new Map((forecast?.days || []).map(day => [day.datetime, day]));
  const dates = datesFrom(today, 0, Math.min(15, period));
  const count = dates.filter(date => rows.has(date)).length;
  const links = periods.map(n => `<a href="?dienos=${n}#oru-prognoze" data-days="${n}"${period === n ? ' aria-current="page"' : ""}>${n} d.</a>`).join("");
  const cards = count ? dates.map(date => dayCard(date, today, rows.get(date), false)).join("") : "";
  const available = count === dates.length ? "" : count ? `Pateikta ${count} iš ${dates.length} dienų prognozė.` : "Dienos prognozė šiuo metu nepasiekiama.";
  const status = [available, count && readings.forecast?.previous ? "Rodoma ankstesnė prognozė." : ""].filter(Boolean).join(" ");
  let climate = "";
  if (period > 15) {
    const byMonth = Map.groupBy(datesFrom(today, 15, period - 15), date => date.slice(0, 7));
    const month = byMonth.has(view?.month) ? view.month : byMonth.keys().next().value;
    const displayed = byMonth.get(month);
    const data = new Map((readings.climate?.value?.days || []).map(day => [day.datetime, day]));
    const received = displayed.filter(date => data.has(date)).length;
    const months = [...byMonth.keys()].map(m => `<a href="?dienos=${period}&amp;menuo=${m}#wx-climate-title"${m === month ? ' aria-current="page"' : ""}>${escape(monthLabel.format(atNoon(m + "-01")))}</a>`).join("");
    const unavailable = !received ? `<p>Šio mėnesio klimato duomenys šiuo metu nepasiekiami. <a href="?dienos=${period}&amp;menuo=${month}#wx-climate-title">Tikrinti dar kartą</a></p>` : received < displayed.length ? `<p>Šio mėnesio duomenys pateikti ${received} iš ${displayed.length} pasirinktų dienų.</p>` : "";
    const source = received ? '<a href="https://www.visualcrossing.com/weather-api/">Visual Crossing Weather</a> · ' : "";
    climate = `<section class="wx-climate" aria-labelledby="wx-climate-title"><h3 id="wx-climate-title">Klimato orientyrai · 16–${period} dienos</h3>
      <p>Pagal ankstesnių metų tos datos orus. Tai klimato vidurkiai, o ne konkrečios dienos prognozė.</p>
      <nav class="wx-climate__months" aria-label="Klimato apžvalgos mėnuo">${months}</nav>${unavailable}
      <div id="wx-climate-days" class="wx-days wx-days--extended">${received ? displayed.map(date => dayCard(date, today, data.get(date), true)).join("") : ""}</div>
      <p>${source}<a href="/oru-saltiniai/#metodika">Kaip skaičiuojami klimato orientyrai</a></p></section>`;
  }
  return { links, cards, count, status, climate, period, dates };
}
