const hourMs = 3_600_000;
const thredds = "https://thredds.silam.fmi.fi/thredds/ncss/grid/";
const airDataset = "silam_europe_v6_1";
const pollenDataset = "silam_europe_pollen_v6_1";
const pollutants = {
  pm25: ["cnc_PM2_5", "kg/m3", 1e9, [5, 15, 50, 90, 140]],
  pm10: ["cnc_PM10", "kg/m3", 1e9, [15, 45, 120, 195, 270]],
  no2: ["cnc_NO2_gas", "mole/m3", 46.0055e6, [10, 25, 60, 100, 150]],
  o3: ["cnc_O3_gas", "mole/m3", 48e6, [60, 100, 120, 160, 180]],
  so2: ["cnc_SO2_gas", "mole/m3", 64.066e6, [20, 40, 125, 190, 275]],
};
const species = Object.fromEntries(Object.entries({
  alder: "cnc_POLLEN_ALDER_m22", birch: "cnc_POLLEN_BIRCH_m22", grass: "cnc_POLLEN_GRASS_m32",
  hazel: "cnc_POLLEN_HAZEL_m23", mugwort: "cnc_POLLEN_MUGWORT_m18", ragweed: "cnc_POLLEN_RAGWEED_m18", olive: "cnc_POLLEN_OLIVE_m20",
}).map(([key, name]) => [key, [name, "number/m3", 1]]));
const pollenIndex = { level: ["POLI", "", 1] };

async function pointSeries(dataset, fields, location, start, end, http, surface = true) {
  const url = new URL(`${dataset}/${dataset}_best.ncd`, thredds);
  url.search = new URLSearchParams({
    latitude: String(location.latitude), longitude: String(location.longitude),
    var: Object.values(fields).map(([field]) => field).join(","),
    time_start: new Date(start).toISOString(), time_end: new Date(end).toISOString(),
    accept: "csv",
  });
  if (surface) url.searchParams.set("vertCoord", "12.5");
  const read = async timeout => {
    const response = await http(url, { signal: AbortSignal.timeout(timeout) });
    if (response.status >= 500) throw new Error("SILAM point forecasts unavailable");
    return response.ok ? response.text() : "";
  };
  const csv = await read(7500).catch(() => read(3500));
  if (!csv) throw new Error("SILAM point forecasts unavailable");
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const columns = header.split(",");
  const timeColumn = columns.indexOf("time");
  const latColumn = columns.indexOf('latitude[unit="degrees_north"]');
  const lonColumn = columns.indexOf('longitude[unit="degrees_east"]');
  const availableFields = Object.entries(fields).map(([key, [field, units, factor]]) =>
    [key, columns.indexOf(`${field}[unit="${units}"]`), factor]).filter(([, index]) => index >= 0);
  if (timeColumn < 0 || latColumn < 0 || lonColumn < 0 || !availableFields.length)
    throw new Error("Unsupported SILAM point format");
  const rows = new Map();
  for (const line of lines) {
    const cells = line.split(",");
    const time = Date.parse(cells[timeColumn]);
    if (!Number.isFinite(time) || time < start || time > end) continue;
    const latitude = Number(cells[latColumn]);
    const longitude = Number(cells[lonColumn]);
    const delta = Math.hypot(latitude - location.latitude,
      (longitude - location.longitude) * Math.cos(location.latitude * Math.PI / 180));
    // Both 0.1° model grids return the nearest cell, including the rotated pollen grid.
    if (!Number.isFinite(delta) || delta > 0.08) continue;
    const values = {};
    for (const [key, index, factor] of availableFields) {
      const cell = cells[index]?.trim();
      if (!cell) continue;
      const value = Number(cell) * factor;
      if (Number.isFinite(value) && value >= 0) values[key] = value;
    }
    if (Object.keys(values).length) rows.set(time, values);
  }
  return rows;
}

function airLevel(values) {
  // The EEA index uses the worst band across the five hourly pollutant concentrations (µg/m³).
  if (Object.keys(pollutants).some(key => !Number.isFinite(values[key]))) return null;
  return Math.max(...Object.entries(pollutants).map(([key, [, , , limits]]) =>
    limits.filter(limit => Math.round(values[key]) > limit).length));
}

export async function getAirConditions(location, at = new Date(), http = fetch) {
  const hour = Math.floor(+at / hourMs) * hourMs;
  const start = hour - hourMs;
  const end = hour + 47 * hourMs;
  const [airResult, speciesResult, pollenResult] = await Promise.allSettled([
    pointSeries(airDataset, pollutants, location, start, end, http),
    pointSeries(pollenDataset, species, location, start, end, http),
    pointSeries(pollenDataset, pollenIndex, location, start, end, http, false),
  ]);
  const airRows = airResult.value ?? new Map();
  const speciesRows = speciesResult.value ?? new Map();
  const indexRows = pollenResult.value ?? new Map();
  const air = [...airRows].sort(([a], [b]) => a - b)
    .map(([time, values]) => ({ time, values, level: airLevel(values) }));
  const pollen = [...new Set([...speciesRows.keys(), ...indexRows.keys()])].sort((a, b) => a - b).flatMap(time => {
    const values = speciesRows.get(time) ?? {};
    const level = indexRows.get(time)?.level;
    const validIndex = Number.isInteger(level) && level >= 1 && level <= 5;
    return validIndex || Object.keys(values).length ? [{ time, values, level: validIndex ? level : null }] : [];
  });
  if (!air.length && !pollen.length) throw new Error("No SILAM forecast for the requested period");
  const complete = air.some(row => row.time === hour && row.level !== null) &&
    pollen.some(row => row.time === hour && row.level !== null && Object.keys(row.values).length === Object.keys(species).length);
  return {
    air, pollen, fetchedAt: at.toISOString(),
    cacheSeconds: complete ? 1800 : 300,
  };
}
