import { WEATHER_CITY_BY_ID } from "../../shared/weather-cities.js";

export async function onRequestGet({ request }) {
  const city = new URL(request.url).searchParams.get("city") || "vilnius";
  const place = WEATHER_CITY_BY_ID.get(city);
  if (!place)
    return new Response("Neteisingas miestas", { status: 400 });
  const cache = globalThis.caches?.default,
    key = new Request(new URL("/api/weather?city=" + city, request.url));
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 8000);
  try {
    const cached = await cache?.match(key);
    if (cached) return cached;
    const readJson = async (url) => {
      const r = await fetch(url, { signal: controller.signal });
      if (!r.ok) throw Error("Upstream unavailable");
      return r.json();
    };
    const results = await Promise.allSettled([
      place.station
        ? readJson(
            `https://api.meteo.lt/v1/stations/${place.station}/observations/latest`,
          )
        : Promise.resolve(null),
      readJson(`https://api.meteo.lt/v1/places/${city}/forecasts/long-term`),
    ]);
    const [observation, forecast] = results.map((r) =>
      r.status === "fulfilled" ? r.value : null,
    );
    if (!observation && !forecast)
      return Response.json(
        { error: "Duomenys nepasiekiami" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    const response = Response.json(
      {
        observation,
        forecast,
        fetchedAt: new Date().toISOString(),
        source: "LHMT / Meteo LT",
        license: "CC BY-SA 4.0",
      },
      {
        headers: {
          "Cache-Control": "public, max-age=1200",
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
  }
}
