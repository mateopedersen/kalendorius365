import { weatherPlaces } from "../../lib/weather-places.mjs";
import { nearbyRoadReadings, roadSource } from "../../lib/road-weather.mjs";

let pending;
let recent;
const ttl = 300_000;

async function readStations(context, requestUrl) {
  if (recent && recent.expires > Date.now()) return recent.rows;
  const cache = globalThis.caches?.default;
  const key = new Request(new URL("/api/keliu-orai?vidinis=stotys-v1", requestUrl));
  const cached = await cache?.match(key).catch(() => null);
  if (cached) return cached.json();
  if (!pending) pending = (async () => {
    const response = await fetch(roadSource, {
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5500),
    });
    if (!response.ok) throw Error("Road weather unavailable");
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.some(row => row.lat && row.lng && row.surinkimo_data_unix))
      throw Error("Unexpected road station data");
    recent = { rows, expires: Date.now() + ttl };
    if (cache) {
      const write = cache.put(key, Response.json(rows, { headers: { "Cache-Control": "public, max-age=300" } })).catch(() => {});
      if (context.waitUntil) context.waitUntil(write);
      else await write;
    }
    return rows;
  })().finally(() => { pending = null; });
  return pending;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const place = weatherPlaces.get(url.searchParams.get("vieta"));
  if (!place) return Response.json({ error: "Vietovė nerasta." }, { status: 404 });
  try {
    const rows = await readStations(context, url);
    return Response.json({ stations: nearbyRoadReadings(rows, place), source: "Via Lietuva", radiusKm: 45 }, {
      headers: { "Cache-Control": "public, max-age=180" },
    });
  } catch {
    return Response.json({ error: "Stotelių duomenys šiuo metu nepasiekiami." }, {
      status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "300" },
    });
  }
}
