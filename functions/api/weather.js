import { WEATHER_CITY_BY_ID } from "../../shared/weather-cities.js";

export async function onRequestGet({ request }) {
  const city = new URL(request.url).searchParams.get("city") || "vilnius";
  const place = WEATHER_CITY_BY_ID.get(city);
  if (!place)
    return new Response("Neteisingas miestas", { status: 400 });
  const cache = globalThis.caches?.default,
    key = new Request(new URL("/api/weather?city=" + city, request.url));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  let graceTimer;
  try {
    const cached = await cache?.match(key);
    if (cached) return cached;
    const readJson = async (url) => {
      const r = await fetch(url, { signal: controller.signal });
      if (!r.ok) throw Error("Upstream unavailable");
      return r.json();
    };
    const sources = [
      ["forecast", `https://api.meteo.lt/v1/places/${city}/forecasts/long-term`],
    ];
    if (place.station)
      sources.push(["observation", `https://api.meteo.lt/v1/stations/${place.station}/observations/latest`]);
    const readings = { observation: null, forecast: null };
    const first = Promise.withResolvers();
    let remaining = sources.length;
    const all = Promise.all(sources.map(async ([kind, url]) => {
      try {
        readings[kind] = await readJson(url);
        if (readings[kind]) first.resolve();
      } catch {
        // A city can still be served from its other source.
      } finally {
        remaining -= 1;
      }
    }));
    await Promise.race([all, first.promise]);
    if (remaining)
      await Promise.race([all, new Promise(resolve => { graceTimer = setTimeout(resolve, 450); })]);
    const { observation, forecast } = readings;
    const partial = remaining > 0;
    if (!observation && !forecast)
      return Response.json(
        { error: "Duomenys nepasiekiami" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    const response = Response.json(
      {
        observation,
        forecast,
        ...(partial ? { partial: true } : {}),
        fetchedAt: new Date().toISOString(),
        source: "LHMT / Meteo LT",
        license: "CC BY-SA 4.0",
      },
      {
        headers: {
          "Cache-Control": partial ? "public, max-age=60" : "public, max-age=1200",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
    await cache?.put(key, response.clone());
    return response;
  } catch {
    return Response.json(
      { error: "Duomenys nepasiekiami" },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } finally {
    clearTimeout(timer);
    clearTimeout(graceTimer);
    controller.abort();
  }
}
