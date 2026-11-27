import assert from "node:assert/strict";
import { closeSync, openSync, readFileSync, writeSync } from "node:fs";
import { hasWeatherRoute, renderWeatherPage, weatherSite } from "../../lib/weather-pages.mjs";
import { weatherPlaces } from "../../lib/weather-places.mjs";

const [report] = process.argv.slice(2);
if (!report) throw new Error("Usage: node scripts/weather/audit_pages.mjs <output.jsonl>");

const publicFile = path => readFileSync(new URL(`../../public/${path}`, import.meta.url), "utf8");
const base = `${weatherSite}/orai/`;
const sitemap = publicFile("sitemap-orai.xml");
const urls = [...sitemap.matchAll(/<url><loc>([^<]*)<\/loc>(.*?)<\/url>/g)].map(([, url, images]) => ({ url, images }));
const expected = new Set(["miestai", "savivaldybes", ...weatherPlaces.keys()]);
const shell = publicFile("orai/index.html");
const now = Date.parse("2027-07-15T09:00:00Z");
const families = { directory: 0, municipality: 0, city: 0, settlement: 0 };
const errors = [];

assert.equal(urls.length, expected.size, "Use a complete release build with an indexable weather sitemap.");
const output = openSync(report, "w");
try {
  for (const { url, images } of urls) {
    const route = url.slice(base.length, -1);
    try {
      assert.equal(url, `${base}${route}/`);
      assert(expected.delete(route) && hasWeatherRoute(route), `Unknown or duplicate route: ${route}`);
      const html = renderWeatherPage(shell, route, {}, now);
      assert(html.includes(`<link rel="canonical" href="${url}">`), "Canonical link differs");
      assert.match(html, /<meta name="robots" content="index, follow, max-image-preview:large">/);
      assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
      assert.doesNotMatch(html, /id="wx-place-template"|data-advertising-slot/);
      const image = html.match(/<meta property="og:image" content="([^"<>]+)">/)?.[1];
      assert(image?.startsWith(weatherSite) && images.includes(`<image:loc>${image}</image:loc>`), "OG image missing from sitemap");
      const place = weatherPlaces.get(route);
      const row = { url, image, family: !place ? "directory" : place.municipality ? "municipality" : place.solar ? "city" : "settlement" };
      if (place) {
        assert(html.includes(`data-latitude="${place.latitude}" data-longitude="${place.longitude}"`), "Coordinates differ");
        const panel = html.match(/id="klimato-normos"[\s\S]*?<\/section>/)?.[0];
        assert(panel, "Climate normals missing in the HTML without live feeds");
        assert.equal([...panel.matchAll(/<th scope="row">/g)].length, 13);
        assert.match(panel, /Liepa · vidutinė temperatūra<\/dt><dd>[^<]+ °C/);
        assert.match(panel, /Liepa · krituliai per mėnesį<\/dt><dd>[^<]+ mm/);
        assert(panel.includes('/oru-saltiniai/#stociu-klimato-normos'), "Climate station attribution missing");
        row.point = [place.latitude, place.longitude];
        row.climateStation = panel.match(/<p><strong>([^<]+)<\/strong>/)?.[1];
        assert(row.climateStation, "Historical station is unidentified");
        const outdoor = html.match(/id="dienos-sviesa-ir-vanduo"[\s\S]*?<\/section>/)?.[0];
        assert(outdoor, "Seasonal daylight comparison is missing");
        assert.deepEqual([...outdoor.matchAll(/<time datetime="(\d{4}-\d{2}-\d{2})">/g)].map(match => match[1]),
          ["2027-03-20", "2027-06-21", "2027-09-22", "2027-12-21"]);
        row.waterStation = outdoor.match(/data-hydro-station="([a-z0-9-]+)"/)?.[1] ?? null;
      }
      writeSync(output, JSON.stringify(row) + "\n");
      families[row.family]++;
    } catch (error) {
      const failure = { url, error: error.message.slice(0, 400) };
      writeSync(output, JSON.stringify(failure) + "\n");
      errors.push(failure);
    }
  }
} finally {
  closeSync(output);
}

assert.equal(expected.size, 0, "Some registry routes were absent from the sitemap");
console.log(JSON.stringify({ checked: urls.length, passed: urls.length - errors.length, failures: errors.length, families }));
assert.equal(errors.length, 0, JSON.stringify(errors.slice(0, 5)));
