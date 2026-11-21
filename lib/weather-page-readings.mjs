// Retain compact, independent last-good readings. A slow road feed must never hide a forecast.
import { onRequestGet as forecastApi } from "../functions/api/oru-prognoze.js";
import { onRequestGet as roadApi } from "../functions/api/keliu-orai.js";

import { weatherDate } from "./weather-forecast.mjs";
import { getDisplayClimate, getDisplayForecast } from "./weather-display-forecast.mjs";
import { climateSpan } from "./weather-view.mjs";

const hour = 3600000;
const running = new Map();
const segments = ["forecast", "rain", "road"];

function compact(kind, payload, now) {
  if (kind === "climate") return { source: payload.source, fetchedAt: payload.fetchedAt, days: payload.days };
  if (kind === "road") return { stations: payload.stations.slice(0, 5) };
  if (kind === "rain") return { updatedAt: payload.updatedAt, slots: payload.slots.map(({ time, mm, symbol }) => ({ time, mm, symbol })) };
  return {
    source: payload.source, fetchedAt: payload.fetchedAt, updatedAt: payload.updatedAt, current: payload.current,
    days: payload.days.slice(0, 15).map(({ datetime, tempmin, tempmax, precip, windgust, icon, source, sunrise, sunset, hours }) => ({
      datetime, tempmin, tempmax, precip, windgust, icon, source, sunrise, sunset,
      hours: (hours || []).filter(slot => Math.abs(slot.datetimeEpoch * 1000 - now) <= 8 * hour)
        .map(({ datetimeEpoch, source, icon, temp, feelslike }) => ({ datetimeEpoch, source, icon, temp, feelslike })),
    })),
  };
}

async function refreshSegment(context, place, kind, store, now, remember, span) {
  const origin = new URL(context.request.url).origin;
  const url = new URL(kind === "road" ? "/api/keliu-orai" : "/api/oru-prognoze", origin);
  url.searchParams.set("vieta", place.slug);
  if (kind === "rain") url.searchParams.set("dalis", "krituliai");
  const range = kind === "climate" ? "/" + span.start + "/" + span.end : "";
  const key = new Request(origin + "/__weather-html/v2/" + encodeURIComponent(place.slug) +
    "/" + place.latitude + "/" + place.longitude + range + "/" + kind);
  const cache = await store;
  const saved = await cache?.match(key).then(r => r?.json()).catch(() => null);
  if (saved?.value && saved.savedAt <= now && saved.savedAt > now - 6 * hour) {
    const sameDay = kind !== "forecast" || weatherDate(new Date(saved.savedAt)) === weatherDate(new Date(now));
    if (saved.expires > now && sameDay) return { value: saved.value, previous: false };
    remember({ value: saved.value, previous: true });
  }
  let job = running.get(key.url);
  if (!job) {
    job = (async () => {
      const at = new Date(now);
      let payload;
      let seconds;
      if (kind === "forecast") {
        payload = await getDisplayForecast(place, at).catch(() => null);
      } else if (kind === "climate") {
        payload = await getDisplayClimate(place, span.start, span.end, at);
      }
      if (payload) {
        seconds = payload.cacheSeconds;
      } else {
        const api = kind === "road" ? roadApi : forecastApi;
        const res = await api({request: new Request(url), waitUntil: promise => context.waitUntil?.(promise)});
        if (!res.ok) return null;
        payload = await res.json();
        seconds = Number(res.headers.get("Cache-Control")?.match(/max-age=(\d+)/)?.[1]) || 60;
      }
      const value = compact(kind, payload, now);
      const maxAge = kind === "climate" ? 21600 : kind === "forecast" ? 1200 : 300;
      const entry = { savedAt: now, expires: now + Math.min(seconds, maxAge) * 1000, value };
      if (cache) {
        const write = cache.put(key, Response.json(entry, { headers: { "Cache-Control": "public, max-age=21600" } })).catch(() => {});
        context.waitUntil?.(write);
      }
      return { value, previous: false };
    })().catch(() => null).finally(() => running.delete(key.url));
    running.set(key.url, job);
  }
  return job;
}

async function readSegment(context, place, kind, cache, now, deadline, span) {
  let prior = null;
  const job = refreshSegment(context, place, kind, cache, now, saved => { prior = saved; }, span).catch(() => null);
  context.waitUntil?.(job);
  let timer;
  try {
    const limit = new Promise(resolve => { timer = setTimeout(resolve, Math.max(0, deadline - Date.now()), null); });
    return await Promise.race([job, limit]) || prior;
  } finally {
    clearTimeout(timer);
  }
}

export async function pageReadings(context, place, {
  cache, budget = 2200, now = Date.now(), view = { period: 5, month: null },
} = {}) {
  // Cloudflare's named cache isolates private snapshots from public HTTP cache lookups.
  const store = cache ?? globalThis.caches?.open?.("weather-html-v2").catch(() => null);
  const span = climateSpan(now, view);
  const requested = span ? [...segments, "climate"] : segments;
  const results = await Promise.all(requested.map(kind => readSegment(context, place, kind, store, now, now + budget, span)));
  return Object.fromEntries(requested.map((kind, i) => [kind, results[i]]));
}
