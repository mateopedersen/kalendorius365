// Run using a separately installed geotiff@3.0.5 decoder, cached tiles and the
// official https://api.meteo.lt/v1/stations response. The site build uses the
// checked-in output and does not download rasters or require this dependency.
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, rename, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const [decoder, tiles, stationPath] = process.argv.slice(2);
if (!decoder || !tiles || !stationPath)
  throw Error("Usage: node scripts/weather/settlement_context.mjs <geotiff/dist-module/geotiff.js> <tile directory> <LHMT stations JSON>");
const { fromFile } = await import(pathToFileURL(resolve(decoder)));
const run = promisify(execFile);
const fileHash = bytes => createHash("sha256").update(bytes).digest("hex");
const root = new URL("../../", import.meta.url);
const registry = JSON.parse(await readFile(new URL("site/assets/data/weather-places.json", root), "utf8"));
const coordinateKey = (lat, lon) => `${Math.round(lat * 1e6)}:${Math.round(lon * 1e6)}`;
const points = new Map(registry.places.filter(row => !row[6])
  .map(([, , , lat, lon]) => [coordinateKey(lat, lon), [lat, lon]]));
const offsets = [];
for (let east = -1000; east <= 1000; east += 250) {
  for (let north = -1000; north <= 1000; north += 250) {
    if (Math.hypot(east, north) <= 1000 && (east || north)) offsets.push([east, north]);
  }
}

function samplePoints(lat, lon) {
  const metresEast = 111195 * Math.cos(lat * Math.PI / 180);
  return [[lat, lon], ...offsets.map(([e, n]) => [lat + n / 111195, lon + e / metresEast])];
}

const tileId = (lat, lon) => `Copernicus_DSM_COG_30_N${String(lat).padStart(2, "0")}_00_E${String(lon).padStart(3, "0")}_00_DEM`;

function gridCell(lat, lon) {
  // These Lithuanian GLO-90 tiles contain 1200 latitude and 800 longitude
  // posts per degree. PixelIsPoint tiepoints are the actual sample locations.
  const north = Math.round(lat * 1200);
  const east = Math.round(lon * 800);
  const southEdge = Math.ceil(north / 1200) - 1;
  const westEdge = Math.floor(east / 800);
  return [tileId(southEdge, westEdge), (southEdge + 1) * 1200 - north, east - westEdge * 800, southEdge, westEdge];
}

const rasters = new Map();
async function readTile(id, south, west) {
  const path = resolve(tiles, id + ".tif");
  if (!await stat(path).catch(() => null)) {
    try {
      await run("curl", ["-fsSL", "--retry", "2", "--max-time", "45",
        `https://copernicus-dem-90m.s3.eu-central-1.amazonaws.com/${id}/${id}.tif`, "-o", path + ".download"]);
      await rename(path + ".download", path);
    } finally {
      await rm(path + ".download", { force: true });
    }
  }
  const tiff = await fromFile(path);
  try {
    const image = await tiff.getImage();
    const geo = image.getGeoKeys();
    const [x, y] = image.getOrigin();
    const [dx, dy] = image.getResolution();
    if (x !== west || y !== south + 1 || image.getWidth() !== 800 || image.getHeight() !== 1200 ||
        geo.GeographicTypeGeoKey !== 4326 || geo.GTRasterTypeGeoKey !== 2 ||
        Math.abs(dx - 1 / 800) > 1e-10 || Math.abs(dy + 1 / 1200) > 1e-10)
      throw Error(`Unexpected GLO-90 grid: ${id}`);
    const [values] = await image.readRasters({ samples: [0] });
    return { values, hash: fileHash(await readFile(path)), noData: image.getGDALNoData() };
  } finally {
    await tiff.close();
  }
}

await mkdir(tiles, { recursive: true });
const hashes = {};
const heights = {};
for (const [key, [lat, lon]] of points) {
  const values = [];
  for (const [sampleLat, sampleLon] of samplePoints(lat, lon)) {
    const [tile, row, col, south, west] = gridCell(sampleLat, sampleLon);
    if (!rasters.has(tile)) {
      rasters.set(tile, await readTile(tile, south, west));
      hashes[tile] = rasters.get(tile).hash;
    }
    const data = rasters.get(tile);
    const value = data.values[row * 800 + col];
    if (!Number.isFinite(value) || value === data.noData || value < -50 || value > 500)
      throw Error(`Invalid elevation at ${sampleLat}, ${sampleLon} (${tile})`);
    values.push(value);
  }
  heights[key] = [values[0], Math.min(...values), Math.max(...values)].map(Math.round);
}

const catalogue = await readFile(stationPath);
const stations = {};
for (const { code, name, coordinates: { latitude, longitude } } of JSON.parse(catalogue)) {
  if (!/^[a-z0-9-]+$/.test(code) || Object.hasOwn(stations, code) || !name.trim() ||
      !(latitude >= 53.8 && latitude <= 56.5 && longitude >= 20.8 && longitude <= 26.9))
    throw Error(`Unexpected LHMT station: ${code}`);
  stations[code] = [name, latitude, longitude];
}
if (Object.keys(stations).length === 0) throw Error("Empty LHMT station list");

const data = { heights, stations, terrainTiles: hashes, stationCatalogueSha256: fileHash(catalogue), registrySnapshot: registry.snapshot };
await writeFile(new URL("lib/weather-settlement-data.mjs", root),
  `// Generated by scripts/weather/settlement_context.mjs from Copernicus GLO-90 and LHMT.\nexport default ${JSON.stringify(data)};\n`);
console.log(`${points.size} reference points, ${rasters.size} GLO-90 tiles, ${Object.keys(stations).length} LHMT stations`);
