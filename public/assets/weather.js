import { icon as uiIcon } from "/assets/releases/5838c74c429cb383b9d2/icons.js";
import { TZ, today } from "/assets/releases/5838c74c429cb383b9d2/calendar.js";
import { WEATHER_CITY_BY_ID } from "/assets/releases/5838c74c429cb383b9d2/data/weather-cities.js";
const names = {
  clear: "Giedra",
  "partly-cloudy": "Mažai debesuota",
  "cloudy-with-sunny-intervals": "Debesuota su pragiedruliais",
  cloudy: "Debesuota",
  "light-rain": "Silpnas lietus",
  rain: "Lietus",
  "heavy-rain": "Smarkus lietus",
  thunder: "Perkūnija",
  "isolated-thunderstorms": "Vietomis perkūnija",
  thunderstorms: "Perkūnija",
  "heavy-rain-with-thunderstorms": "Smarkus lietus su perkūnija",
  "light-sleet": "Silpna šlapdriba",
  sleet: "Šlapdriba",
  "freezing-rain": "Lijundra",
  hail: "Kruša",
  "light-snow": "Silpnas sniegas",
  snow: "Sniegas",
  "heavy-snow": "Smarkus sniegas",
  fog: "Rūkas",
  "variable-cloudiness": "Nepastovus debesuotumas",
  "rain-showers": "Trumpalaikis lietus",
  "rain-at-times": "Protarpiais lietus",
};
const pending = new Map();
let latestRender = 0;
export async function loadWeather(city) {
  if (pending.has(city)) return pending.get(city);
  const job = (async () => {
    try {
      const r = await fetch("/api/weather?city=" + city, {
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw Error("unavailable");
      return await r.json();
    } catch {
      return null;
    } finally {
      pending.delete(city);
    }
  })();
  pending.set(city, job);
  return job;
}
export async function renderWeather(city) {
  const renderId = ++latestRender;
  const target = document.querySelector("#weather-content");
  target.textContent = "Įkeliami orai…";
  const data = await loadWeather(city);
  if (renderId !== latestRender) return;
  target.replaceChildren();
  if (!data) {
    target.textContent =
      "Orų duomenys šiuo metu nepasiekiami. Bandykite vėliau.";
    return;
  }
  const observations = data.observation?.observations || [],
    obs = [...observations]
      .reverse()
      .find((o) => Number.isFinite(o.airTemperature));
  const forecasts = data.forecast?.forecastTimestamps || [],
    now = Date.now();
  const forecast = forecasts
    .filter(
      (f) =>
        Math.abs(Date.parse(f.forecastTimeUtc.replace(" ", "T") + "Z") - now) <
        3 * 3600000,
    )
    .sort(
      (a, b) =>
        Math.abs(Date.parse(a.forecastTimeUtc + "Z") - now) -
        Math.abs(Date.parse(b.forecastTimeUtc + "Z") - now),
    )[0];
  const current = obs || forecast;
  if (!current) {
    target.textContent = "Naujausių matavimų nėra.";
    return;
  }
  const stamp = current.observationTimeUtc || current.forecastTimeUtc,
    age = now - Date.parse(stamp.replace(" ", "T") + "Z");
  const temp = document.createElement("div");
  temp.id = "weather-temp";
  const code = current.conditionCode || "";
  const condition =
    code === "clear" || code.includes("sunny") || code === "partly-cloudy"
      ? "sun"
      : code.includes("snow")
        ? "snow"
        : code.includes("rain") ||
            code.includes("sleet") ||
            code.includes("thunder")
          ? "rain"
          : code === "fog"
            ? "fog"
            : "cloud";
  document.querySelector(".climate-card").dataset.weather = condition;
  const illustration = document.createElement("img");
  illustration.src = "/assets/visuals/weather-" + condition + ".svg";
  illustration.width = 84;
  illustration.height = 75;
  illustration.alt = "";
  const value = document.createElement("strong");
  value.textContent = Math.round(current.airTemperature) + "°C";
  temp.append(illustration, value);
  target.append(temp);
  const description = document.createElement("p");
  description.className = "weather-description";
  description.textContent =
    (names[current.conditionCode] || "Sąlygos nenurodytos") +
    (Number.isFinite(current.feelsLikeTemperature)
      ? ` · Jaučiama ${Math.round(current.feelsLikeTemperature)}°`
      : "");
  target.append(description);
  const label = document.createElement("small");
  label.textContent =
    (obs ? "Stebėjimas" : "Prognozė") +
    " · " +
    new Intl.DateTimeFormat("lt-LT", {
      timeZone: TZ,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(stamp.replace(" ", "T") + "Z")) +
    (data.stale || age > 3 * 3600000 ? " · Pasenę duomenys" : "");
  label.className = "weather-time";
  target.append(label);
  const measurements = document.createElement("div");
  measurements.className = "weather-measures";
  for (const [key, name, unit, symbol] of [
    ["windSpeed", "Vėjas", "m/s", "wind"],
    ["relativeHumidity", "Drėgmė", "%", "drop"],
  ]) {
    if (!Number.isFinite(current[key])) continue;
    const item = document.createElement("span");
    item.append(uiIcon(symbol));
    const text = document.createElement("span");
    text.textContent = name + " " + Math.round(current[key]) + " " + unit;
    item.append(text);
    measurements.append(item);
  }
  if (measurements.childElementCount) target.append(measurements);
  const day = forecasts
    .filter(
      (f) =>
        today(new Date(f.forecastTimeUtc.replace(" ", "T") + "Z")) === today(),
    )
    .map((f) => f.airTemperature)
    .filter(Number.isFinite);
  if (day.length) {
    const p = document.createElement("p");
    p.className = "weather-description";
    p.textContent = `Šiandienos prognozė: ${Math.round(Math.min(...day))}…${Math.round(Math.max(...day))} °C`;
    target.append(p);
  }
  document.querySelector(".sky-caption").textContent =
    (WEATHER_CITY_BY_ID.get(city)?.name || city) + " · iliustracija";
}
