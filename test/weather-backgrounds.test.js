import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { WEATHER_CITY_IDS } from "../site/assets/data/weather-cities.js";
import { WEATHER_CITY_BACKGROUNDS } from "../site/assets/data/weather-backgrounds.js";

test("every selectable weather city has a local visual", () => {
  assert.deepEqual(
    Object.keys(WEATHER_CITY_BACKGROUNDS).sort(),
    [...WEATHER_CITY_IDS].sort(),
  );

  for (const city of WEATHER_CITY_IDS) {
    const background = WEATHER_CITY_BACKGROUNDS[city];
    assert.ok(background.image.startsWith("/assets/visuals/"), `${city}: local image`);
    const assetPath = new URL(`../site${background.image}`, import.meta.url);
    assert.ok(existsSync(assetPath), `${city}: image file exists`);
    const bytes = readFileSync(assetPath);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF", `${city}: RIFF container`);
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP", `${city}: WebP image`);
    assert.ok(bytes.length < 230_000, `${city}: image remains lightweight`);

    if (city === "vilnius") continue;
    assert.ok(background.author, `${city}: author credit`);
    assert.ok(background.source.startsWith("https://commons.wikimedia.org/wiki/File:"), `${city}: source page`);
    assert.ok(background.license, `${city}: license label`);
    if (background.license !== "Viešasis domenas")
      assert.ok(background.licenseUrl.startsWith("https://creativecommons.org/"), `${city}: license link`);
  }
});
