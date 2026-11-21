import { weatherPlaces } from "../../lib/weather-places.mjs";
import { getPrecipitationOutlook } from "../../lib/precipitation-outlook.mjs";
import { getAirConditions } from "../../lib/air-conditions.mjs";
import { getOpenForecast, weatherDate } from "../../lib/weather-forecast.mjs";

const inFlight = new Map();
const outlooks = { krituliai: getPrecipitationOutlook, aplinka: getAirConditions };

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const place = weatherPlaces.get(url.searchParams.get("vieta"));
  const segment = url.searchParams.get("dalis") || "forecast";
  if (!place || !(segment === "forecast" || Object.hasOwn(outlooks, segment)))
    return Response.json({ error: "Vietovė arba laikotarpis nerastas." }, { status: 404 });

  const requestedAt = new Date();
  const cacheUrl = new URL("/api/oru-prognoze", url);
  cacheUrl.search = new URLSearchParams({
    rinkinys: segment === "aplinka" ? "cams-v1" : "atviri-v2", vieta: place.slug, dalis: segment,
    diena: segment === "aplinka" ? requestedAt.toISOString().slice(0, 13) : weatherDate(requestedAt), taskas: `${place.latitude},${place.longitude}`,
  });
  const key = new Request(cacheUrl);
  const cache = globalThis.caches?.default;
  const cached = await cache?.match(key).catch(() => null);
  if (cached) return cached;
  let job = inFlight.get(key.url);
  if (!job) {
    const upstream = Object.hasOwn(outlooks, segment) ?
      outlooks[segment](place, requestedAt) : getOpenForecast(place, requestedAt);
    job = upstream.finally(() => inFlight.delete(key.url));
    inFlight.set(key.url, job);
  }
  try {
    const data = await job;
    const ttl = data.cacheSeconds ?? (segment === "forecast" ? (data.source === "LHMT / Meteo LT" ? 300 : 1200) : 21600);
    const cacheable = data.complete !== false;
    const response = Response.json(data, {
      headers: { "Cache-Control": cacheable ? `public, max-age=${ttl}` : "no-store", "X-Content-Type-Options": "nosniff" },
    });
    if (cache && cacheable) {
      const writing = cache.put(key, response.clone()).catch(() => {});
      if (context.waitUntil) context.waitUntil(writing);
      else await writing;
    }
    return response;
  } catch {
    return Response.json({ error: "Orų duomenys šiuo metu nepasiekiami." }, {
      status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "300" },
    });
  }
}
