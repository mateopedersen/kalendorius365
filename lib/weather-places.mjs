import registry from "../site/assets/data/weather-places.json" with { type: "json" };

export const weatherPlaces = new Map();
export const municipalities = new Map();
export const byMunicipality = new Map();
export const registrySnapshot = registry.snapshot;

for (const [id, [slug, name, county, latitude, longitude]] of Object.entries(registry.municipalities)) {
  const place = { slug: "savivaldybes/" + slug, name, county, latitude, longitude, district: Number(id), municipality: true };
  municipalities.set(Number(id), place);
  weatherPlaces.set(place.slug, place);
  byMunicipality.set(Number(id), []);
}
for (const [slug, name, district, latitude, longitude, locative, solar, genitive, ward] of registry.places) {
  const place = { slug, name, district, latitude, longitude, locative, solar, genitive,
    ward: registry.wards[ward]?.[0] };
  weatherPlaces.set(slug, place);
  byMunicipality.get(district).push(place);
}
