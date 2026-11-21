const hour = 3_600_000;

export async function readMetLocation(place, at, http) {
  const url = new URL("https://api.met.no/weatherapi/locationforecast/2.0/complete");
  url.searchParams.set("lat", String(place.latitude));
  url.searchParams.set("lon", String(place.longitude));
  const response = await http(url, {
    headers: { "User-Agent": "Kalendorius365/1.0 (https://kalendorius365.lt/kontaktai/)", Accept: "application/json" },
    signal: AbortSignal.timeout(6500),
  });
  if (!response.ok) throw Error("MET Norway unavailable");
  const { geometry, properties } = await response.json();
  const [longitude, latitude] = geometry?.coordinates ?? [];
  if (latitude !== place.latitude || longitude !== place.longitude || !Array.isArray(properties?.timeseries))
    throw Error("Unexpected MET Norway forecast location");
  const expiry = Date.parse(response.headers.get("Expires"));
  return {
    series: properties.timeseries, updatedAt: properties.meta?.updated_at,
    cacheSeconds: Number.isFinite(expiry) ? Math.max(60, Math.ceil((expiry - at.getTime()) / 1000)) : 1800,
  };
}

export async function getPrecipitationOutlook(place, at = new Date(), http = fetch) {
  const data = await readMetLocation(place, at, http);
  const first = Math.floor(at.getTime() / hour) * hour;
  const slots = [];
  for (const entry of data.series) {
    const time = Date.parse(entry.time);
    if (!Number.isFinite(time) || time < first || time >= first + 36 * hour) continue;
    const period = entry.data?.next_1_hours;
    const mm = period?.details?.precipitation_amount;
    if (!Number.isFinite(mm) || mm < 0) continue;
    const slot = { time, mm, symbol: period.summary?.symbol_code || "" };
    const chance = period.details.probability_of_precipitation;
    if (Number.isFinite(chance) && chance >= 0 && chance <= 100) slot.chance = chance;
    const { precipitation_amount_min: min, precipitation_amount_max: max, probability_of_thunder: thunder } = period.details;
    if (Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max >= min) {
      slot.min = min;
      slot.max = max;
    }
    if (Number.isFinite(thunder) && thunder >= 0 && thunder <= 100) slot.thunder = thunder;
    slots.push(slot);
  }
  if (!slots.some(slot => slot.time < first + 12 * hour)) throw Error("No near-term precipitation forecast");
  return {
    source: "MET Norway", updatedAt: data.updatedAt, slots, cacheSeconds: data.cacheSeconds,
  };
}
