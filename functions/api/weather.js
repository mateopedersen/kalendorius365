const cities = {
  vilnius: "vilniaus-ams",
  kaunas: "kauno-ams",
  klaipeda: "klaipedos-ams",
  siauliai: "siauliu-ams",
  panevezys: "panevezio-ams",
};
export async function onRequestGet({ request }) {
  const city = new URL(request.url).searchParams.get("city") || "vilnius";
  if (!Object.hasOwn(cities, city))
    return new Response("Neteisingas miestas", { status: 400 });
  const cache = globalThis.caches?.default,
    key = new Request(new URL("/api/weather?city=" + city, request.url));
  const cached = await cache?.match(key);
  if (cached) return cached;
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 8000);
  try {
    const results = await Promise.allSettled(
      [
        fetch(
          `https://api.meteo.lt/v1/stations/${cities[city]}/observations/latest`,
          { signal: controller.signal },
        ),
        fetch(`https://api.meteo.lt/v1/places/${city}/forecasts/long-term`, {
          signal: controller.signal,
        }),
      ].map(async (p) => {
        const r = await p;
        if (!r.ok) throw Error("Upstream unavailable");
        return r.json();
      }),
    );
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
    return Response.json({ error: "Duomenys nepasiekiami" }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
