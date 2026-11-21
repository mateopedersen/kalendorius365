const hourMs = 3_600_000;
const bands = {
  pm25: [5, 15, 50, 90, 140], pm10: [15, 45, 120, 195, 270],
  no2: [10, 25, 60, 100, 150], o3: [60, 100, 120, 160, 180], so2: [20, 40, 125, 190, 275],
};
const fields = new Map();
for (const [key, layer] of Object.entries({
  pm25: "pm2p5", pm10: "pm10", no2: "no2", o3: "o3", so2: "so2",
  alder: "pol_alder", birch: "pol_birch", grass: "pol_grass", mugwort: "pol_mugwort", olive: "pol_olive", ragweed: "pol_ragw",
})) {
  const air = Object.hasOwn(bands, key);
  fields.set("composition_europe_" + layer + "_forecast_surface", { key, kind: air ? "air" : "pollen", unit: air ? "µg/m3" : "grains/m3" });
}

function airLevel(values) {
  if (Object.keys(bands).some(key => !Number.isFinite(values[key]))) return null;
  return Math.max(...Object.entries(bands).map(([key, limits]) =>
    limits.filter(limit => Math.round(values[key]) > limit).length));
}

export async function getAirConditions(location, at = new Date(), http = fetch) {
  const { latitude, longitude } = location;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < 30 || latitude >= 72 || longitude < -25 || longitude >= 45 || !Number.isFinite(+at)) {
    throw new Error("Invalid CAMS forecast point or time");
  }
  // CAMS European cells have centres at x.05, x.15, etc. Identical cell/hour URLs share the edge cache.
  const lat = (Math.floor(latitude * 10) + 0.5) / 10;
  const lon = (Math.floor(longitude * 10) + 0.5) / 10;
  const layers = [...fields.keys()].join(",");
  const hour = Math.floor(+at / hourMs) * hourMs;
  const cacheSeconds = Math.min(1800, Math.max(1, Math.ceil((hour + hourMs - at) / 1000)));
  const url = new URL("https://eccharts.ecmwf.int/wms/");
  url.search = new URLSearchParams({
    token: "public", service: "WMS", version: "1.3.0", request: "GetFeatureInfo",
    layers, query_layers: layers, styles: "", crs: "EPSG:4326",
    bbox: [lat - 0.02, lon - 0.02, lat + 0.02, lon + 0.02].map(n => n.toFixed(2)).join(","),
    width: "101", height: "101", i: "50", j: "50", format: "image/png", info_format: "application/json",
    dim_originating_centre: "85_2", dim_level: "key_0", dim_type: "fc", dim_stream: "oper",
    time: new Date(hour).toISOString().replace(".000Z", "Z"),
  });
  const response = await http(url, {
    signal: AbortSignal.timeout(9500),
    cf: { cacheEverything: true, cacheTtlByStatus: { "200": 300, "400-599": 0 } },
  });
  if (!response.ok) throw new Error("CAMS upstream HTTP " + response.status);
  const result = { air: {}, pollen: {} };
  // The WMS can return a 200 XML ServiceException for unavailable hours.
  const body = await response.json();
  if (!Array.isArray(body?.Probes)) throw new Error("Unexpected CAMS point format");
  for (const probe of body.Probes) {
    const field = fields.get(probe?.Name);
    const unit = probe?.Value?.Unit;
    if (!field || typeof unit !== "string" || unit.replace("μ", "µ") !== field.unit) continue;
    const gridLat = probe["Grid point latitude"];
    const gridLon = probe["Grid point longitude"];
    if (!Number.isFinite(gridLat) || !Number.isFinite(gridLon) ||
        Math.abs(gridLat - lat) >= 0.001 || Math.abs(gridLon - lon) >= 0.001) continue;
    const value = probe.Value.Data;
    // GRIB missing-value sentinels (typically 1e20 or larger) are not physical concentrations.
    if (Number.isFinite(value) && value >= 0 && value < 1e10) result[field.kind][field.key] = value;
  }
  const airCount = Object.keys(result.air).length;
  const pollenCount = Object.keys(result.pollen).length;
  if (!airCount && !pollenCount) throw new Error("No CAMS concentrations for the requested grid cell and hour");
  return {
    source: "CAMS", grid: { latitude: lat, longitude: lon }, fetchedAt: at.toISOString(),
    air: airCount ? [{ time: hour, values: result.air, level: airLevel(result.air) }] : [],
    pollen: pollenCount ? [{ time: hour, values: result.pollen }] : [],
    cacheSeconds: airCount + pollenCount === fields.size ? cacheSeconds : Math.min(cacheSeconds, 300),
  };
}
