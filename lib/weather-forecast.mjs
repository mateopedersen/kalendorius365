import { WEATHER_CITY_BY_ID } from "../shared/weather-cities.js";
import { readMetLocation } from "./precipitation-outlook.mjs";

export const numeric = ("temp tempmin tempmax feelslike feelslikemin feelslikemax dew humidity precip precipprob snow snowdepth " +
  "windspeed windgust winddir pressure cloudcover visibility uvindex moonphase").split(" ");
const localDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vilnius", year: "numeric", month: "2-digit", day: "2-digit" });
export const localHour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Vilnius", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function weatherDate(date = new Date(), offset = 0) {
  const day = new Date(localDay.format(date) + "T00:00:00Z");
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}

export function reading(value) {
  const result = {};
  for (const key of numeric) if (Number.isFinite(value[key])) result[key] = value[key];
  for (const key of ["datetime", "icon", "source", "sunrise", "sunset"])
    if (typeof value[key] === "string") result[key] = value[key];
  if (Number.isFinite(value.datetimeEpoch)) result.datetimeEpoch = value.datetimeEpoch;
  return result;
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

// The public browser endpoint exposes only providers whose data we can redistribute.
export async function getOpenForecast(place, date = new Date(), http = fetch) {
  try {
    return await requestMetForecast(place, date, http);
  } catch {
    return requestLHMT(place, weatherDate(date), http);
  }
}
