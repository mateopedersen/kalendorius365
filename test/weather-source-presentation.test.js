import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  WEATHER_CITIES,
  WEATHER_CITY_IDS,
} from "../site/assets/data/weather-cities.js";
import { WEATHER_CITY_BACKGROUNDS } from "../site/assets/data/weather-backgrounds.js";

const homepage = readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
const sourcesPage = readFileSync(
  new URL("../site/oru-saltiniai/index.html", import.meta.url),
  "utf8",
);

test("weather card stays concise and links to the complete source register", () => {
  assert.match(homepage, /class="weather-attribution"/);
  assert.match(homepage, /LHMT \/ Meteo LT/);
  assert.match(homepage, /href="\/oru-saltiniai\/"/);
  assert.doesNotMatch(homepage, /weather-credit|sky-caption|CC BY-SA 4\.0/);
  assert.match(sourcesPage, /Duomenys naudojami pagal/);
  assert.match(sourcesPage, /Nuotraukos sumažintos ir apkirptos/);
});

test("source register covers every selectable city and each photo license", () => {
  assert.equal(
    [...sourcesPage.matchAll(/data-weather-source="[a-z]+"/g)].length,
    WEATHER_CITY_IDS.size,
  );

  for (const city of WEATHER_CITIES) {
    const background = WEATHER_CITY_BACKGROUNDS[city.id];
    assert.ok(
      sourcesPage.includes(`data-weather-source="${city.id}"`),
      `${city.name}: source entry exists`,
    );
    assert.ok(sourcesPage.includes(`<h3>${city.name}</h3>`), `${city.name}: label`);

    if (background.source) {
      assert.ok(sourcesPage.includes(`href="${background.source}"`), `${city.name}: image source`);
      assert.ok(sourcesPage.includes(background.author), `${city.name}: photographer credit`);
      assert.ok(sourcesPage.includes(background.license), `${city.name}: license label`);
      if (background.licenseUrl)
        assert.ok(sourcesPage.includes(`href="${background.licenseUrl}"`), `${city.name}: license link`);
    } else {
      assert.match(sourcesPage, /Vilnius[\s\S]*Kalendorius365 orų kortelės iliustracija/);
    }
  }
});
