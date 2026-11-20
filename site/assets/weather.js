import { icon as uiIcon } from "./icons.js";
import { TZ, today } from "./calendar.js";
import { WEATHER_CITY_BY_ID } from "./data/weather-cities.js";
import { updateWeatherBackground } from "./data/weather-city-photo.js";
export { updateWeatherBackground } from "./data/weather-city-photo.js";
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
function weatherSceneType(code) {
  if (code === "clear") return "clear";
  if (code === "fog") return "fog";
  if (code === "partly-cloudy" || code === "cloudy-with-sunny-intervals") return "partly";
  if (code.includes("snow") || code === "hail") return "snow";
  if (code.includes("sleet")) return "sleet";
  if (code.includes("thunder")) return "storm";
  if (code.includes("rain")) return "rain";
  return "cloud";
}
const pending = new Map();
const weatherCache = new Map();
const weatherCacheAge = 3 * 60 * 1000;
const weatherCacheKey = (city) => "kalendorius365:weather:v1:" + city;
let latestRender = 0;
const observationFormatter = new Intl.DateTimeFormat("lt-LT", {
  timeZone: TZ,
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const degrees = (value) => String(Math.round(value)).replace(/^-/, "−");
const temperature = (value) => degrees(value) + "\u00a0°C";

function addReading(list, label, value, symbol) {
  const item = document.createElement("div");
  const term = document.createElement("dt");
  const reading = document.createElement("dd");
  if (symbol) term.append(uiIcon(symbol));
  term.append(label);
  reading.textContent = value;
  item.append(term, reading);
  list.append(item);
}

function weatherTimestamp(value) {
  return typeof value === "string" ? Date.parse(value.replace(" ", "T") + "Z") : NaN;
}

function cachedWeather(city) {
  let entry = weatherCache.get(city);
  if (!entry) {
    try { entry = JSON.parse(sessionStorage.getItem(weatherCacheKey(city))); }
    catch { return null; }
  }
  if (entry?.data && Date.now() < entry.expiresAt) {
    weatherCache.set(city, entry);
    return entry.data;
  }
  if (entry) {
    try { sessionStorage.removeItem(weatherCacheKey(city)); } catch {}
  }
  weatherCache.delete(city);
  return null;
}

export async function loadWeather(city) {
  const cached = cachedWeather(city);
  if (cached) return cached;
  if (pending.has(city)) return pending.get(city);
  const job = (async () => {
    try {
      const r = await fetch("/api/weather?city=" + city, {
        signal: AbortSignal.timeout(5500),
      });
      if (!r.ok) throw Error("unavailable");
      const data = await r.json();
      if (!data?.stale && (data?.observation?.observations?.length || data?.forecast?.forecastTimestamps?.length)) {
        const entry = { data, expiresAt: Date.now() + (data.partial ? 60000 : weatherCacheAge) };
        weatherCache.set(city, entry);
        try { sessionStorage.setItem(weatherCacheKey(city), JSON.stringify(entry)); } catch {}
      }
      return data;
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
  const readings = target.querySelector(".weather-readings");
  const hero = target.querySelector("#weather-temp");
  const value = hero.querySelector(".weather-temperature");
  const status = hero.querySelector(".weather-loading");
  const showStatus = (state, message) => {
    hero.dataset.state = state;
    delete hero.dataset.weather;
    value.hidden = true;
    status.textContent = message;
    status.hidden = false;
    readings.replaceChildren();
  };
  const cached = cachedWeather(city);
  const request = cached ? null : loadWeather(city);
  updateWeatherBackground(city);
  if (!cached) {
    const name = WEATHER_CITY_BY_ID.get(city)?.name;
    target.setAttribute("aria-busy", "true");
    showStatus("loading", name ? `Įkeliami orai · ${name}` : "Įkeliami orai…");
  }
  const data = cached ?? await request;
  if (renderId !== latestRender) return;
  target.removeAttribute("aria-busy");
  if (!data) {
    showStatus("unavailable", "Orų duomenys šiuo metu nepasiekiami.");
    return;
  }
  const observations = data.observation?.observations || [],
    obs = [...observations]
      .reverse()
      .find((o) => Number.isFinite(o.airTemperature));
  const now = Date.now();
  const forecasts = (data.forecast?.forecastTimestamps || []).map((reading) => ({
    reading, timestamp: weatherTimestamp(reading.forecastTimeUtc),
  })).filter(({reading, timestamp}) => Number.isFinite(reading.airTemperature) && Number.isFinite(timestamp));
  const forecast = forecasts
    .filter(({timestamp}) => Math.abs(timestamp - now) < 3 * 3600000)
    .sort((a, b) => Math.abs(a.timestamp - now) - Math.abs(b.timestamp - now))[0]?.reading;
  const current = obs || forecast;
  if (!current) {
    showStatus("unavailable", "Naujausių matavimų nėra.");
    return;
  }
  const stamp = current.observationTimeUtc || current.forecastTimeUtc;
  const observationTime = new Date(weatherTimestamp(stamp));
  const code = current.conditionCode || "";
  hero.dataset.weather = weatherSceneType(code);
  hero.dataset.state = "ready";
  value.querySelector(".weather-temperature__value").textContent = degrees(current.airTemperature);
  value.hidden = false;
  status.hidden = true;
  const content = document.createDocumentFragment();
  const description = document.createElement("p");
  description.className = "weather-description";
  description.textContent = names[current.conditionCode] || "Sąlygos nenurodytos";
  content.append(description);
  if (Number.isFinite(current.feelsLikeTemperature)) {
    const feels = document.createElement("dl");
    feels.className = "weather-feels";
    addReading(feels, "Jaučiama", temperature(current.feelsLikeTemperature));
    content.append(feels);
  }
  if (Number.isFinite(observationTime.getTime())) {
    const meta = document.createElement("p");
    meta.className = "weather-time";
    const label = document.createElement("span");
    label.textContent = obs ? "Stebėta" : "Prognozės laikas";
    const time = document.createElement("time");
    time.dateTime = observationTime.toISOString();
    time.textContent = observationFormatter.format(observationTime);
    meta.append(label, " ", time);
    content.append(meta);
  }
  if (data.stale || now - observationTime.getTime() > 3 * 3600000) {
    const stale = document.createElement("small");
    stale.className = "weather-stale";
    stale.textContent = "Pasenę duomenys";
    content.append(stale);
  }
  const measurements = document.createElement("dl");
  measurements.className = "weather-measures";
  for (const [key, name, unit, symbol] of [
    ["windSpeed", "Vėjas", "m/s", "wind"],
    ["relativeHumidity", "Drėgmė", "%", "drop"],
  ]) {
    if (!Number.isFinite(current[key])) continue;
    addReading(measurements, name, `${Math.round(current[key])}\u00a0${unit}`, symbol);
  }
  if (measurements.childElementCount) content.append(measurements);
  const currentDay = today();
  const day = forecasts
    .filter(({timestamp}) => Math.abs(timestamp - now) < 26 * 3600000 && today(new Date(timestamp)) === currentDay)
    .map(({reading}) => reading.airTemperature);
  if (day.length) {
    const forecast = document.createElement("div");
    forecast.className = "weather-forecast";
    const title = document.createElement("p");
    title.className = "weather-forecast__title";
    title.textContent = "Šiandienos prognozė";
    const range = document.createElement("dl");
    range.className = "weather-forecast__range";
    addReading(range, "Žemiausia", temperature(Math.min(...day)));
    addReading(range, "Aukščiausia", temperature(Math.max(...day)));
    forecast.append(title, range);
    content.append(forecast);
  }
  readings.replaceChildren(content);
}

function searchKey(text) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("lt-LT");
}

export function enhanceWeatherCityPicker(select) {
  const picker = select.parentElement;
  const button = picker.querySelector(".weather-city-picker__button");
  const value = button.querySelector("#weather-city-value");
  const popup = picker.querySelector(".weather-city-popup");
  const list = popup.querySelector('[role="listbox"]');
  if (typeof popup.showPopover !== "function") return;

  const options = Array.from(select.options, (city, index) => {
    const option = document.createElement("li");
    option.id = `weather-city-option-${city.value}`;
    option.role = "option";
    option.dataset.index = index;
    option.textContent = city.label;
    list.append(option);
    return option;
  });
  const names = Array.from(select.options, (city) => searchKey(city.label));
  const isOpen = () => popup.matches(":popover-open");
  let active = 0;
  let warmTimer;
  let warming = false;

  function warmOption(index, delay = 150) {
    clearTimeout(warmTimer);
    warmTimer = setTimeout(async () => {
      if (warming || !isOpen()) return;
      warming = true;
      try {
        await loadWeather(select.options[index].value);
      } finally {
        warming = false;
      }
    }, delay);
  }

  function syncSelection() {
    value.textContent = select.selectedOptions[0]?.label ?? "";
    options.forEach((option, index) => {
      option.setAttribute("aria-selected", String(index === select.selectedIndex));
    });
  }

  function moveTo(index) {
    options[active].classList.remove("is-active");
    active = Math.min(options.length - 1, Math.max(0, index));
    const option = options[active];
    option.classList.add("is-active");
    button.setAttribute("aria-activedescendant", option.id);
    const listBox = list.getBoundingClientRect();
    const optionBox = option.getBoundingClientRect();
    if (optionBox.top < listBox.top) list.scrollTop += optionBox.top - listBox.top;
    else if (optionBox.bottom > listBox.bottom) list.scrollTop += optionBox.bottom - listBox.bottom;
    if (active !== select.selectedIndex) warmOption(active);
  }

  function positionPopup() {
    if (!isOpen()) return;
    const box = button.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    if (box.bottom <= 0 || box.top >= viewportHeight) {
      popup.hidePopover();
      return;
    }
    const edge = 10;
    const gap = 6;
    const width = Math.min(Math.max(box.width, 220), viewportWidth - 2 * edge);
    const below = viewportHeight - box.bottom - gap - edge;
    const above = box.top - gap - edge;
    const opensAbove = below < 300 && above > below;
    popup.style.width = `${width}px`;
    popup.style.left = `${Math.max(edge, Math.min(box.left, viewportWidth - width - edge))}px`;
    popup.style.maxHeight = `${Math.max(0, Math.min(348, opensAbove ? above : below))}px`;
    popup.style.top = `${opensAbove ? box.top - gap - popup.offsetHeight : box.bottom + gap}px`;
  }

  function openList() {
    button.focus({ preventScroll: true });
    popup.showPopover();
    button.setAttribute("aria-expanded", "true");
    positionPopup();
    moveTo(select.selectedIndex);
  }

  function choose(index) {
    select.selectedIndex = index;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    popup.hidePopover();
    button.focus({ preventScroll: true });
  }

  popup.addEventListener("toggle", () => {
    button.setAttribute("aria-expanded", String(isOpen()));
    if (!isOpen()) {
      clearTimeout(warmTimer);
      button.removeAttribute("aria-activedescendant");
    }
  });
  button.addEventListener("click", () => {
    if (isOpen()) popup.hidePopover();
    else openList();
  });
  list.addEventListener("click", (event) => {
    const option = event.target.closest('[role="option"]');
    if (option) choose(Number(option.dataset.index));
  });
  list.addEventListener("pointerover", (event) => {
    const option = event.target.closest('[role="option"]');
    if (event.pointerType === "mouse" && option) warmOption(Number(option.dataset.index));
  });
  list.addEventListener("pointerleave", () => clearTimeout(warmTimer));
  list.addEventListener("pointerdown", (event) => {
    const option = event.target.closest('[role="option"]');
    if (option) warmOption(Number(option.dataset.index), 0);
  });
  document.addEventListener("pointerdown", (event) => {
    if (isOpen() && !picker.contains(event.target)) popup.hidePopover();
  });
  button.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      if (isOpen()) popup.hidePopover();
      return;
    }
    if (event.key === "Escape" && isOpen()) {
      event.preventDefault();
      popup.hidePopover();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      if (isOpen()) {
        event.preventDefault();
        choose(active);
      }
      return;
    }
    const navigation = {
      ArrowUp: active - 1,
      ArrowDown: active + 1,
      Home: 0,
      End: options.length - 1,
    };
    if (Object.hasOwn(navigation, event.key)) {
      event.preventDefault();
      const wasOpen = isOpen();
      if (!wasOpen) openList();
      if (wasOpen || event.key === "Home" || event.key === "End") {
        moveTo(navigation[event.key]);
      }
      return;
    }
    if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const letter = searchKey(event.key);
      const next = names.findIndex((name, index) => index > active && name.startsWith(letter));
      const index = next === -1 ? names.findIndex((name) => name.startsWith(letter)) : next;
      if (index === -1) return;
      event.preventDefault();
      if (!isOpen()) openList();
      moveTo(index);
    }
  });
  window.addEventListener("resize", positionPopup, { passive: true });
  window.addEventListener("scroll", positionPopup, { passive: true });

  syncSelection();
  popup.hidden = false;
  button.hidden = false;
  select.hidden = true;
  return syncSelection;
}
