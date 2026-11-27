import { readFileSync } from "node:fs";
import { today } from "../site/assets/calendar.js";
import { solarFor } from "../site/assets/phase-5-6-8-core.js";
import { daylightLabel, solarWeek, sunClock, sunDateLabel } from "../site/assets/sunrise-readings.js";

const source = new URL("../data/astronomy/sun-cities.json", import.meta.url);
const { cities } = JSON.parse(readFileSync(source, "utf8"));
const date = process.env.K365_BUILD_DATE ?? today();
const year = date.slice(0, 4);
const dates = [year + "-06-21", year + "-12-21"];
const readings = Object.fromEntries(cities.map(city => {
  const point = { lat: city.latitude, lon: city.longitude };
  const seasons = dates.map(day => {
    const { sunrise, sunset, dayMinutes } = solarFor(day, point);
    return { day, label: sunDateLabel(day), rise: sunClock(sunrise), set: sunClock(sunset),
      duration: daylightLabel(dayMinutes), minutes: dayMinutes };
  });
  const difference = seasons[0].minutes - seasons[1].minutes;
  return [city.id, { ...solarWeek(date, point), seasons, seasonalDifference: daylightLabel(difference) }];
}));
process.stdout.write(JSON.stringify(readings));
