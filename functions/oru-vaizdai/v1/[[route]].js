import { assetRoot, imageRoot, openAtlas, renderWeatherPng, weatherSocial } from "../../../lib/weather-social.mjs";

let atlas;
async function loadAtlas(assets, origin) {
  if (atlas) return atlas;
  const [background, type] = await Promise.all(["atlas-v1.bin", "atlas-v1.json"].map(name =>
    assets.fetch(new URL(assetRoot + name, origin))));
  if (!background.ok || !type.ok) throw new Error("Missing weather image template");
  const loaded = await openAtlas(background, type);
  atlas ??= loaded;
  return atlas;
}

async function serve(context, head = false) {
  const url = new URL(context.request.url);
  const path = url.pathname.slice(imageRoot.length);
  const route = path.endsWith(".png") ? path.slice(0, -4) : "";
  const image = weatherSocial(route);
  if (!image || image.src !== url.pathname) return new Response(null, { status: 404 });
  const headers = new Headers({
    "Content-Type": "image/png",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=86400",
  });
  const publicSite = url.hostname === "kalendorius365.lt";
  if (!publicSite) headers.set("X-Robots-Tag", "noindex");
  if (head) return new Response(null, { headers });
  url.search = "";
  const cache = publicSite ? globalThis.caches?.default : null;
  try {
    const hit = await cache?.match(url.href);
    if (hit) return hit;
    const result = await renderWeatherPng(image, await loadAtlas(context.env.ASSETS, url.origin));
    const response = new Response(result, { headers });
    if (cache) context.waitUntil(cache.put(url.href, response.clone()).catch(() => {}));
    return response;
  } catch (error) {
    console.error("Weather image rendering failed", error);
    return new Response(null, { status: 503, headers: { "Retry-After": "120" } });
  }
}

export function onRequestGet(context) { return serve(context); }
export function onRequestHead(context) { return serve(context, true); }
