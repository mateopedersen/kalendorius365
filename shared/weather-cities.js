export const WEATHER_CITIES = [
  { id: "vilnius", name: "Vilnius", latitude: 54.68916, longitude: 25.2798, station: "vilniaus-ams" },
  { id: "kaunas", name: "Kaunas", latitude: 54.90156, longitude: 23.90909, station: "kauno-ams" },
  { id: "klaipeda", name: "Klaipėda", latitude: 55.7068, longitude: 21.13912, station: "klaipedos-ams" },
  { id: "siauliai", name: "Šiauliai", latitude: 55.93333, longitude: 23.31667, station: "siauliu-ams" },
  { id: "panevezys", name: "Panevėžys", latitude: 55.73186, longitude: 24.35983, station: "panevezio-ams" },
  { id: "alytus", name: "Alytus", latitude: 54.39574, longitude: 24.03885 },
  { id: "marijampole", name: "Marijampolė", latitude: 54.55787, longitude: 23.35004 },
  { id: "mazeikiai", name: "Mažeikiai", latitude: 56.31667, longitude: 22.33333 },
  { id: "jonava", name: "Jonava", latitude: 55.08014, longitude: 24.27544 },
  { id: "utena", name: "Utena", latitude: 55.4978, longitude: 25.60462 },
  { id: "kedainiai", name: "Kėdainiai", latitude: 55.28721, longitude: 23.97269 },
  { id: "telsiai", name: "Telšiai", latitude: 55.98139, longitude: 22.24722 },
  { id: "ukmerge", name: "Ukmergė", latitude: 55.25, longitude: 24.75 },
  { id: "taurage", name: "Tauragė", latitude: 55.25222, longitude: 22.28972 },
  { id: "visaginas", name: "Visaginas", latitude: 55.596775, longitude: 26.439842 },
];

export const WEATHER_CITY_IDS = new Set(WEATHER_CITIES.map(({ id }) => id));
export const WEATHER_CITY_BY_ID = new Map(WEATHER_CITIES.map((city) => [city.id, city]));
export const DEFAULT_WEATHER_CITY = "vilnius";

const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z]/g, "");

function nearestCity(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < 53.8 || lat > 56.6 || lon < 20.7 || lon > 27.1) return null;
  let nearest = null;
  let distance = Infinity;
  for (const city of WEATHER_CITIES) {
    const radians = Math.PI / 180;
    const dLat = (city.latitude - lat) * radians;
    const dLon = (city.longitude - lon) * radians;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat * radians) *
        Math.cos(city.latitude * radians) *
        Math.sin(dLon / 2) ** 2;
    const next = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (next < distance) {
      nearest = city;
      distance = next;
    }
  }
  return nearest;
}

export function cityForRequest(cf = {}) {
  if (String(cf.country || "").toUpperCase() !== "LT")
    return DEFAULT_WEATHER_CITY;
  const cityName = normalize(cf.city);
  const match = WEATHER_CITIES.find((city) => normalize(city.name) === cityName);
  if (match) return match.id;
  return nearestCity(cf.latitude, cf.longitude)?.id || DEFAULT_WEATHER_CITY;
}
