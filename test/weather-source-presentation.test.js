import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  WEATHER_CITIES,
  WEATHER_CITY_IDS,
} from "../site/assets/data/weather-cities.js";
import { WEATHER_CITY_BACKGROUNDS } from "../site/assets/data/weather-backgrounds.js";
import { renderWeatherPage } from "../lib/weather-pages.mjs";

const homepage = readFileSync(new URL("../site/_includes/planner-workspace.html", import.meta.url), "utf8");
const sourcesPage = readFileSync(
  new URL("../site/oru-saltiniai/index.html", import.meta.url),
  "utf8",
);
const providerSources = readFileSync(
  new URL("../site/_includes/weather-data-sources.html", import.meta.url),
  "utf8",
);

test("weather card stays concise and links to the complete source register", () => {
  assert.match(homepage, /class="weather-attribution"/);
  assert.match(homepage, /LHMT \/ Meteo LT/);
  assert.match(homepage, /href="\/oru-saltiniai\/"/);
  assert.doesNotMatch(homepage, /weather-credit|sky-caption|CC BY-SA 4\.0/);
  assert.match(providerSources, /Duomenys naudojami pagal/);
  assert.match(sourcesPage, /Nuotraukos sumažintos ir apkirptos/);
});

test("weather location pages link to the provider and methodology register", () => {
  const template = readFileSync(new URL("../site/orai/index.html", import.meta.url), "utf8");
  for (const route of ["panevezys", "zalgirio-31593", "savivaldybes/kauno-m"]) {
    const page = renderWeatherPage(template, route);
    assert.match(page, /href="\/oru-saltiniai\/#duomenys">Duomenys ir licencijos/);
    assert.doesNotMatch(page, /wx-rain-time|wx-readings-source|wx-climate-source|Duomenys ·|CC BY|thredds\.silam/);
    assert.equal([...page.matchAll(/id="wx-visual-crossing-credit"/g)].length, 1);
  }
  for (const id of ["duomenys", "lhmt", "visual-crossing", "met-norway", "silam", "keliai", "vietoves"]) {
    assert.ok(providerSources.includes(`id="${id}"`), id);
  }
  const licensePage = readFileSync(new URL("../site/nuotrauku-licencijos/index.html", import.meta.url), "utf8");
  assert.match(sourcesPage, /include weather-data-sources\.html/);
  assert.match(licensePage, /include weather-data-sources\.html/);
  assert.match(sourcesPage, /id="metodika"/);
  assert.match(sourcesPage, /visam vienos valandos intervalui/);
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
