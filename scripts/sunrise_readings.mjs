import { readFileSync } from "node:fs";
import { today } from "../site/assets/calendar.js";
import { solarWeek } from "../site/assets/sunrise-readings.js";

const source = new URL("../data/astronomy/sun-cities.json", import.meta.url);
const { cities } = JSON.parse(readFileSync(source, "utf8"));
const date = process.env.K365_BUILD_DATE ?? today();
const readings = Object.fromEntries(cities.map(city => [
  city.id,
  solarWeek(date, { lat: city.latitude, lon: city.longitude }),
]));
process.stdout.write(JSON.stringify(readings));
