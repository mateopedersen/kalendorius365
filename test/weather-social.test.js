import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import test from "node:test";

import { assetRoot, imageRoot, directories, openAtlas, renderWeatherPng, weatherSocial } from "../lib/weather-social.mjs";
import { weatherPlaces } from "../lib/weather-places.mjs";
import { onRequestGet, onRequestHead } from "../functions/oru-vaizdai/v1/[[route]].js";

const origin = "https://kalendorius365.lt";
function asset(path) {
  return readFileSync(new URL("../site" + path, import.meta.url));
}

test("each canonical weather route has its own image and the image sitemap publishes that exact mapping", () => {
  const xml = readFileSync(new URL("../public/sitemap-orai.xml", import.meta.url), "utf8");
  const entries = new Map([...xml.matchAll(/<url><loc>([^<]+)<\/loc>(.*?)<\/url>/g)].map(([, url, images]) => [
    url, [...images.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map(match => match[1]),
  ]));
  const routes = [...Object.keys(directories), ...weatherPlaces.keys()];
  const images = new Set();
  assert.equal(entries.size, routes.length);
  for (const route of routes) {
    const image = weatherSocial(route);
    assert.ok(image.alt.includes(image.place?.name ?? directories[route]) || image.photo, route);
    assert.ok(!images.has(image.src), route);
    images.add(image.src);
    const urls = [origin + image.src];
    if (image.photo) {
      assert.equal(asset(image.src).subarray(0,3).toString("hex"), "ffd8ff");
      urls.push(origin + image.photo.src);
    } else assert.equal(image.src, imageRoot + route + ".png");
    assert.deepEqual(entries.get(origin + "/orai/" + route + "/"), urls, route);
  }
});

test("a village image is a readable 1200 × 630 PNG, specific to its coordinates", async () => {
  const atlas = await openAtlas(new Response(asset(assetRoot + "atlas-v1.bin")), new Response(asset(assetRoot + "atlas-v1.json")));
  const first = weatherSocial("adomaiciu-10032");
  const second = weatherSocial("adomaiciu-10033");
  const a = Buffer.from(await (await renderWeatherPng(first, atlas)).arrayBuffer());
  const b = Buffer.from(await (await renderWeatherPng(second, atlas)).arrayBuffer());
  assert.equal(a.subarray(0,8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(a.readUInt32BE(16), 1200);
  assert.equal(a.readUInt32BE(20), 630);
  assert.notDeepEqual(a, b);
  let offset = 8;
  while (a.subarray(offset + 4, offset + 8).toString() !== "IDAT") offset += a.readUInt32BE(offset) + 12;
  const pixels = inflateSync(a.subarray(offset + 8, offset + 8 + a.readUInt32BE(offset)));
  const { latitude, longitude } = first.place;
  const x = Math.round(773 + (longitude - 20.6) * 62);
  const y = Math.round(148 + (56.55 - latitude) * 108);
  assert.equal(pixels[y * 1201 + x + 1], 8, "registered coordinate is at the center of the marker");
});

test("image endpoint serves public binary and HEAD responses, excludes previews and rejects unknown routes", async () => {
  const context = url => ({
    request: new Request(url),
    env: { ASSETS: { fetch: async url => new Response(asset(url.pathname)) } },
  });
  const show = await onRequestGet(context(origin + imageRoot + "kernaves-17745.png"));
  assert.equal(show.status, 200);
  assert.equal(show.headers.get("Content-Type"), "image/png");
  assert.equal(show.headers.get("X-Robots-Tag"), null);
  assert.ok((await show.arrayBuffer()).byteLength > 1000);
  const head = await onRequestHead(context(origin + imageRoot + "kernaves-17745.png"));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  const preview = await onRequestGet(context("https://preview.pages.dev" + imageRoot + "kernaves-17745.png"));
  assert.equal(preview.headers.get("X-Robots-Tag"), "noindex");
  assert.equal((await onRequestGet(context(origin + imageRoot + "does-not-exist.png"))).status, 404);
});
