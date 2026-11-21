export const roadSource = "https://eismoinfo.lt/weather-conditions-service/";

function numeric(value) {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function nearbyRoadReadings(rows, place, now = Date.now()) {
  const radians = Math.PI / 180;
  const placeLatitude = place.latitude * radians;
  const unique = new Map();
  for (const row of rows) {
    const latitude = numeric(row.lat);
    const longitude = numeric(row.lng);
    const measured = numeric(row.surinkimo_data_unix);
    if (!row.id || !row.irenginys || latitude === null || longitude === null || measured === null) continue;
    const age = now - measured * 1000;
    if (age < -300_000 || age > 6 * 3600_000) continue;
    const chord = Math.sin((latitude - place.latitude) * radians / 2) ** 2 +
      Math.cos(placeLatitude) * Math.cos(latitude * radians) * Math.sin((longitude - place.longitude) * radians / 2) ** 2;
    const distance = 12742 * Math.asin(Math.sqrt(chord));
    if (distance > 45 || unique.get(row.id)?.measured >= measured) continue;
    unique.set(row.id, {
      name: row.irenginys, road: row.numeris, section: row.pavadinimas,
      kilometer: numeric(row.kilometras), distance,
      measured, stale: age > 90 * 60_000,
      surface: row.kelio_danga || null, surfaceTemp: numeric(row.dangos_temperatura),
      air: numeric(row.oro_temperatura), visibility: numeric(row.matomumas),
      wind: numeric(row.vejo_greitis_vidut), gust: numeric(row.vejo_greitis_maks),
      precipitation: row.krituliu_tipas || null,
      warnings: (Array.isArray(row.perspejimai) ? row.perspejimai : [])
        .filter(item => item?.kodas !== "NMS" && typeof item?.pavadinimas === "string")
        .map(item => item.pavadinimas),
    });
  }
  return [...unique.values()].sort((a, b) => Number(a.stale) - Number(b.stale) || a.distance - b.distance).slice(0, 5)
    .map(station => ({ ...station, distance: Math.round(station.distance * 10) / 10 }));
}
