import data from "./weather-settlement-data.mjs";

const coordinatesKey = ({ latitude, longitude }) => `${Math.round(latitude * 1e6)}:${Math.round(longitude * 1e6)}`;
const stations = Object.entries(data.stations).map(([code, [name, latitude, longitude]]) =>
  ({ code, name, latitude, longitude }));
const inFlight = new Map();
const observationInterval = 3 * 3600 * 1000;
const fields = {
  airTemperature: [-70, 60],
  relativeHumidity: [0, 100],
  windSpeed: [0, 100],
  precipitation: [0, 200],
};
const radians = degrees => degrees * Math.PI / 180;
const compass = ["į šiaurę", "į šiaurės rytus", "į rytus", "į pietryčius",
  "į pietus", "į pietvakarius", "į vakarus", "į šiaurės vakarus"];

export function settlementHeight(place) {
  return !place.municipality && !place.solar ? data.heights[coordinatesKey(place)] : undefined;
}

function distanceAndBearing(place, station) {
  const lat1 = radians(place.latitude);
  const lat2 = radians(station.latitude);
  const dLon = radians(station.longitude - place.longitude);
  const arc = Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const km = 12742 * Math.asin(Math.sqrt(arc));
  const bearing = Math.atan2(Math.sin(dLon) * Math.cos(lat2),
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon));
  return { km, direction: km >= 0.1 ? compass[(Math.round(bearing * 4 / Math.PI) + 8) % 8] : "" };
}

export function stationFor(place) {
  if (place.municipality || place.solar) return null;
  return stations.reduce((closest, station) => {
    const position = distanceAndBearing(place, station);
    return !closest || position.km < closest.km ? { ...station, ...position } : closest;
  }, null);
}

export const stationSource = station => `https://api.meteo.lt/v1/stations/${station.code}/observations/latest`;

export function latestStationObservation(payload, station, now) {
  const point = payload?.station?.coordinates;
  if (payload?.station?.code !== station.code || !Number.isFinite(point?.latitude) ||
      !Number.isFinite(point?.longitude) || distanceAndBearing(station, point).km > 0.1 ||
      !Array.isArray(payload.observations)) return null;
  let latest = null;
  for (const row of payload.observations) {
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row?.observationTimeUtc)) continue;
    const date = row.observationTimeUtc.replace(" ", "T") + ".000Z";
    const time = Date.parse(date);
    if (!Number.isFinite(time) || new Date(time).toISOString() !== date || time > now ||
        now - time > observationInterval || (latest && time <= latest.time)) continue;
    const values = Object.fromEntries(Object.entries(fields).flatMap(([name, [min, max]]) => {
      const value = row[name];
      return Number.isFinite(value) && value >= min && value <= max ? [[name, value]] : [];
    }));
    if (Object.keys(values).length) latest = { time, ...values };
  }
  return latest;
}

export async function readStationObservation(context, station, now, cache, http = fetch) {
  const url = stationSource(station);
  const key = new Request(new URL(`/__weather-station/v1/${station.code}`, context.request.url));
  const storage = await cache;
  const hit = await storage?.match(key).then(response => response?.json()).catch(() => null);
  if (hit?.time <= now && now - hit.time <= observationInterval) return hit;
  let job = inFlight.get(key.url);
  if (!job) {
    job = (async () => {
      const response = await http(url, { signal: AbortSignal.timeout(2500) });
      if (!response.ok) return null;
      const observation = latestStationObservation(await response.json(), station, now);
      if (observation && storage) {
        const seconds = Math.min(300, Math.floor((observation.time + observationInterval - now) / 1000));
        if (seconds > 0) {
          const write = storage.put(key, Response.json(observation, { headers: { "Cache-Control": `public, max-age=${seconds}` } })).catch(() => {});
          context.waitUntil?.(write);
        }
      }
      return observation;
    })().finally(() => inFlight.delete(key.url));
    inFlight.set(key.url, job);
  }
  return job;
}
