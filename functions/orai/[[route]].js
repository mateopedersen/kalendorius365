import { hasWeatherRoute, renderWeatherPage, weatherSite } from "../../lib/weather-pages.mjs";

function unavailable() {
  const html = '<!doctype html><html lang="lt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Orų puslapis laikinai nepasiekiamas</title></head><body><main><h1>Orų puslapis laikinai nepasiekiamas</h1><p>Bandykite dar kartą po kelių minučių arba atverkite <a href="/orai/">orų žinyną</a>.</p></main></body></html>';
  return new Response(html, {
    status: 503, headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-store", "Retry-After": "120" },
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const route = url.pathname.slice("/orai/".length).replace(/\/$/, "");
  if (!hasWeatherRoute(route)) return context.next();
  if (!url.pathname.endsWith("/")) {
    return new Response(null, { status: 308, headers: { Location: url.pathname + "/" + url.search } });
  }
  try {
    const shell = await context.env.ASSETS.fetch(new URL("/orai/", url));
    if (!shell.ok) return unavailable();
    const html = renderWeatherPage(await shell.text(), route);
    if (!html.includes(`<link rel="canonical" href="${weatherSite}${url.pathname}">`)) return unavailable();
    const headers = new Headers(shell.headers);
    for (const name of ["content-length", "content-encoding", "etag", "last-modified"]) headers.delete(name);
    headers.set("Content-Type", "text/html; charset=UTF-8");
    headers.set("Cache-Control", "public, no-cache, max-age=0, must-revalidate");
    if (html.includes('<meta name="robots" content="noindex')) headers.set("X-Robots-Tag", "noindex");
    return new Response(html, { headers });
  } catch (error) {
    console.error("Weather page rendering failed", error);
    return unavailable();
  }
}

export async function onRequestHead(context) {
  const result = await onRequestGet(context);
  return new Response(null, { status: result.status, headers: result.headers });
}
