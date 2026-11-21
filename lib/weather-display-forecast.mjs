// Server-rendered presentation data. Do not route these results to a public JSON endpoint.
import { localHour, numeric, reading, weatherDate } from "./weather-forecast.mjs";

const crossing = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/";
const isoDay = /^\d{4}-\d{2}-\d{2}$/;
const climateFields = ["tempmax", "tempmin", "precip", "humidity"];

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

// These methods are used only to make the human-readable HTML forecast.
export function getDisplayForecast(place, date = new Date(), http = fetch) {
  return requestVisual(place, weatherDate(date), weatherDate(date, 14), false, http, date);
}

export function getDisplayClimate(place, start, end, date = new Date(), http = fetch) {
  return requestVisual(place, start, end, true, http, date);
}
