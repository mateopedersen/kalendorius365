import { WEATHER_CITY_BY_ID } from "../shared/weather-cities.js";
import { readMetLocation } from "./precipitation-outlook.mjs";

const crossing = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/";
const numeric = ("temp tempmin tempmax feelslike feelslikemin feelslikemax dew humidity precip precipprob snow snowdepth " +
  "windspeed windgust winddir pressure cloudcover visibility uvindex moonphase").split(" ");
const localDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vilnius", year: "numeric", month: "2-digit", day: "2-digit" });
const localHour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Vilnius", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const isoDay = /^\d{4}-\d{2}-\d{2}$/;
const climateFields = ["tempmax", "tempmin", "precip", "humidity"];

export function weatherDate(date = new Date(), offset = 0) {
  const day = new Date(localDay.format(date) + "T00:00:00Z");
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}

function reading(value) {
  const result = {};
  for (const key of numeric) if (Number.isFinite(value[key])) result[key] = value[key];
  for (const key of ["datetime", "icon", "source", "sunrise", "sunset"])
    if (typeof value[key] === "string") result[key] = value[key];
  if (Number.isFinite(value.datetimeEpoch)) result.datetimeEpoch = value.datetimeEpoch;
  return result;
}

async function requestVisual(place, start, end, stats, http, at) {
  const address = `${place.latitude},${place.longitude}`;
  const url = new URL(`${crossing}${address}/${start}/${end}`);
  url.searchParams.set("unitGroup", "metric");
  url.searchParams.set("timezone", "Europe/Vilnius");
  url.searchParams.set("include", stats ? "days" : "days,current,hours");
  url.searchParams.set("elements", stats ? ["datetime", "source", ...climateFields].join(",") :
    ["datetime", "datetimeEpoch", "source", "icon", "sunrise", "sunset", ...numeric].join(","));
  const response = await http(url, { signal: AbortSignal.timeout(6500), headers: { "Accept-Encoding": "gzip", Accept: "application/json" } });
  if (!response.ok) throw Error("Visual Crossing is unavailable");
  const payload = await response.json();
  if (payload.latitude !== place.latitude || payload.longitude !== place.longitude || payload.timezone !== "Europe/Vilnius")
    throw Error("Unexpected Visual Crossing forecast location");
  const daysByDate = new Map();
  for (const day of payload.days ?? []) {
    if (!isoDay.test(day.datetime) || day.datetime < start || day.datetime > end ||
        !Number.isFinite(day.tempmin) || !Number.isFinite(day.tempmax) || day.tempmin > day.tempmax ||
        !(stats ? day.source === "stats" : ["fcst", "comb", "obs"].includes(day.source))) continue;
    daysByDate.set(day.datetime, day);
  }
  const days = [...daysByDate.values()].sort((a, b) => a.datetime.localeCompare(b.datetime));
  if (!days.length || (!stats && days[0].datetime !== start)) throw Error("Missing weather period");
  const complete = days.length === 1 + (Date.parse(end) - Date.parse(start)) / 86_400_000;

  if (stats) {
    return {
      source: "Visual Crossing Weather", fetchedAt: at.toISOString(),
      complete, cacheSeconds: complete ? 21600 : 300,
      days: days.map(day => ({
        ...reading(day),
        normal: Object.fromEntries(climateFields.flatMap(field => {
          const values = day.normal?.[field];
          return Array.isArray(values) && values.length === 3 && values.every(Number.isFinite) ? [[field, values]] : [];
        })),
      })),
    };
  }
  const current = payload.currentConditions;
  const currentAge = current && +at / 1000 - current.datetimeEpoch;
  return {
    source: "Visual Crossing Weather",
    fetchedAt: at.toISOString(),
    complete, cacheSeconds: complete ? 1200 : 300,
    current: Number.isFinite(currentAge) && currentAge >= -3600 && currentAge <= 5400 ? reading(current) : null,
    days: days.map(day => {
      const hours = new Map();
      for (const slot of day.hours ?? []) {
        if (Number.isFinite(slot.datetimeEpoch) && weatherDate(new Date(slot.datetimeEpoch * 1000)) === day.datetime &&
            Number.isFinite(slot.temp)) hours.set(slot.datetimeEpoch, reading({
          ...slot, datetime: localHour.format(new Date(slot.datetimeEpoch * 1000)),
        }));
      }
      return { ...reading(day), hours: [...hours.values()].sort((a, b) => a.datetimeEpoch - b.datetimeEpoch) };
    }),
  };
}

function metIcon(symbol = "") {
  const [condition, light] = symbol.split("_");
  if (condition === "clearsky" || condition === "fair") return "clear-" + (light === "night" ? "night" : "day");
  if (condition === "partlycloudy") return "partly-cloudy-" + (light === "night" ? "night" : "day");
  if (condition.includes("thunder")) return "thunder-rain";
  return ["sleet", "snow", "rain", "cloudy", "fog"].find(type => condition.includes(type));
}

const kmPerHour = value => Number.isFinite(value) ? value * 3.6 : undefined;

function sumMetPrecipitation(hours, day) {
  if (!hours.length || hours[0].datetime !== "00:00") return undefined;
  const end = new Date((hours.at(-1).datetimeEpoch + 3600) * 1000);
  if (localHour.format(end) !== "00:00" || weatherDate(end) <= day) return undefined;
  if (hours.some((hour, i) => !Number.isFinite(hour.precip) || hour.precip < 0 ||
      (i > 0 && hour.datetimeEpoch - hours[i - 1].datetimeEpoch !== 3600))) return undefined;
  return hours.reduce((total, hour) => total + hour.precip, 0);
}

async function requestMetForecast(place, at, http) {
  const { series, updatedAt, cacheSeconds } = await readMetLocation(place, at, http);
  const today = weatherDate(at);
  const last = weatherDate(at, 9);
  const groups = new Map();
  for (const entry of series) {
    const instant = new Date(entry.time);
    const details = entry.data?.instant?.details;
    if (!Number.isFinite(+instant) || !Number.isFinite(details?.air_temperature)) continue;
    const date = weatherDate(instant);
    if (date < today || date > last) continue;
    const oneHour = entry.data.next_1_hours;
    const sixHours = entry.data.next_6_hours;
    const period = oneHour ?? sixHours;
    const icon = metIcon(period?.summary?.symbol_code);
    const slot = reading({
      datetime: localHour.format(instant), datetimeEpoch: +instant / 1000, source: "fcst", icon,
      temp: details.air_temperature, feelslike: details.apparent_air_temperature, humidity: details.relative_humidity,
      dew: details.dew_point_temperature, pressure: details.air_pressure_at_sea_level, cloudcover: details.cloud_area_fraction,
      winddir: details.wind_from_direction, windspeed: kmPerHour(details.wind_speed), windgust: kmPerHour(details.wind_speed_of_gust),
      precip: oneHour?.details?.precipitation_amount, precipprob: oneHour?.details?.probability_of_precipitation,
    });
    if (!groups.has(date)) groups.set(date, new Map());
    groups.get(date).set(slot.datetimeEpoch, { slot, hourly: Boolean(oneHour) });
  }
  const days = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([datetime, entries]) => {
    const samples = [...entries.values()].sort((a, b) => a.slot.datetimeEpoch - b.slot.datetimeEpoch);
    const hours = samples.filter(({ hourly }) => hourly).map(({ slot }) => slot);
    const temperatures = samples.map(({ slot }) => slot.temp);
    const gusts = samples.map(({ slot }) => slot.windgust).filter(Number.isFinite);
    return {
      datetime, source: "fcst", hours, tempmin: Math.min(...temperatures), tempmax: Math.max(...temperatures),
      precip: sumMetPrecipitation(hours, datetime),
      icon: samples.find(({ slot }) => slot.datetime >= "12:00" && slot.icon)?.slot.icon ?? samples.find(({ slot }) => slot.icon)?.slot.icon,
      windgust: gusts.length ? Math.max(...gusts) : undefined,
    };
  });
  if (!days.length || days[0].datetime !== today) throw Error("Missing current MET Norway forecast");
  return { source: "MET Norway", fetchedAt: at.toISOString(), updatedAt, cacheSeconds, current: null, days };
}

const meteoIcon = {
  clear: "clear-day", "partly-cloudy": "partly-cloudy-day", "variable-cloudiness": "partly-cloudy-day",
  cloudy: "cloudy", fog: "fog", "light-rain": "rain", rain: "rain", "heavy-rain": "rain",
  "light-snow": "snow", snow: "snow", "heavy-snow": "snow", "snow-showers": "snow",
  "light-sleet": "sleet", sleet: "sleet", "freezing-rain": "sleet", "freezing-drizzle": "sleet",
  "isolated-thunderstorms": "thunder-rain", thunderstorms: "thunder-rain", "heavy-thunderstorms": "thunder-rain",
};

async function requestLHMT(place, today, http) {
  if (!WEATHER_CITY_BY_ID.has(place.solar)) throw Error("No LHMT place match");
  const response = await http(`https://api.meteo.lt/v1/places/${place.solar}/forecasts/long-term`, {
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw Error("LHMT is unavailable");
  const { place: upstream, forecastTimestamps = [] } = await response.json();
  if (upstream?.countryCode !== "LT" || upstream.code !== place.solar || upstream.name !== place.name)
    throw Error("Unexpected LHMT forecast location");
  const grouped = new Map();
  for (const slot of forecastTimestamps) {
    const instant = new Date(String(slot.forecastTimeUtc).replace(" ", "T") + "Z");
    if (!Number.isFinite(+instant) || !Number.isFinite(slot.airTemperature)) continue;
    const day = weatherDate(instant);
    if (day < today) continue;
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day).push(reading({
      datetime: localHour.format(instant), datetimeEpoch: +instant / 1000,
      temp: slot.airTemperature, feelslike: slot.feelsLikeTemperature, humidity: slot.relativeHumidity,
      pressure: slot.seaLevelPressure, winddir: slot.windDirection, precip: slot.totalPrecipitation,
      windspeed: kmPerHour(slot.windSpeed), windgust: kmPerHour(slot.windGust), cloudcover: slot.cloudCover,
      icon: meteoIcon[slot.conditionCode], source: "fcst",
    }));
  }
  const days = [...grouped].map(([datetime, hours]) => ({
    datetime, hours, source: "fcst",
    tempmin: Math.min(...hours.map(hour => hour.temp)), tempmax: Math.max(...hours.map(hour => hour.temp)),
    icon: hours[Math.floor(hours.length / 2)].icon,
  }));
  if (!days.length || days[0].datetime !== today) throw Error("Empty LHMT period");
  return { source: "LHMT / Meteo LT", current: null, fetchedAt: new Date().toISOString(), days };
}

export const climateWindows = Object.freeze({
  "16-30": [15, 29], "31-45": [30, 44], "46-90": [45, 89],
});

export async function getWeatherForecast(place, segment, date = new Date(), http = fetch) {
  if (segment !== "forecast") {
    const [first, last] = climateWindows[segment];
    return requestVisual(place, weatherDate(date, first), weatherDate(date, last), true, http, date);
  }
  try {
    return await requestVisual(place, weatherDate(date), weatherDate(date, 14), false, http, date);
  } catch {
    try {
      return await requestMetForecast(place, date, http);
    } catch {
      return requestLHMT(place, weatherDate(date), http);
    }
  }
}
