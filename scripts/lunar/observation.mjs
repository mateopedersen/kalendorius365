import { Astronomy } from '../../site/assets/lunar/astronomy-engine.js';
import { lunarState, noonInVilnius, ZONE } from '../../site/assets/lunar/lunar-engine.js';
import { WEATHER_CITY_BY_ID } from '../../shared/weather-cities.js';

const cities = ['vilnius', 'klaipeda'];
const observers = new Map(cities.map(city => {
  const { latitude, longitude } = WEATHER_CITY_BY_ID.get(city);
  return [city, new Astronomy.Observer(latitude, longitude, 0)];
}));
const localHour = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE, hour: '2-digit', hourCycle: 'h23',
});

function geometricAltitude(body, time, observer) {
  const equator = Astronomy.Equator(body, time, observer, true, true);
  return Astronomy.Horizon(time, observer, equator.ra, equator.dec).altitude;
}

const years = process.argv.slice(2).map(Number);
const report = {};
for (const year of years) {
  const end = Date.UTC(year + 1, 0, 1);
  for (let utc = Date.UTC(year, 0, 1); utc < end; utc += 86_400_000) {
    const date = new Date(utc).toISOString().slice(0, 10);
    const time = new Date(+noonInVilnius(date) + 11 * 3_600_000);
    if (localHour.format(time) !== '23') throw new Error(`Vilnius 23:00 conversion failed for ${date}`);
    const { elongation, illumination } = lunarState(time);
    report[date] = { elongation, illumination };
    for (const [city, observer] of observers) {
      const sun = geometricAltitude(Astronomy.Body.Sun, time, observer);
      const moon = geometricAltitude(Astronomy.Body.Moon, time, observer);
      report[date][city] = { sun, moon };
    }
  }
}
process.stdout.write(JSON.stringify(report));
