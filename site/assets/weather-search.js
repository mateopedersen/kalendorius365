const collator = new Intl.Collator("lt", { numeric: true });
const weatherWords = /\b(?:oras|orai|oru|oro|orus|orams|temperatur\w*|prognoz\w*|weather|forecast|hava durumu|hava durumu tahmini)\b/g;
const sectionTerms = [
  [/\b(?:orai keliuose|keliuose|keliu bukle|kelio danga|road weather|road conditions|yol durumu)\b/g, "orai-keliuose", "Orai keliuose"],
  [/\b(?:oro kokyb\w*|alergij\w*|ziedadulk\w*|air quality|pollen|hava kalitesi|polen|alerji)\b/g, "oro-kokybe", "Oro kokybė ir žiedadulkės"],
  [/\b(?:savaitgali\w*|weekend|hafta sonu)\b/g, "savaitgalio-orai", "Savaitgalio orai"],
  [/\b(?:valandin\w*|pagal valandas|hourly|saatlik)\b/g, "wx-hours-title", "Valandinė prognozė"],
  [/\b(?:krituliai|krituliu|krituliams|lietus|lietaus|lietumi|lis|sniegas|sniego|sniega|sniegu|snigs|sninga|rain|snow|yagmur|kar)\b/g, "krituliu-prognoze", "Kritulių prognozė"],
  [/\b(?:vejo gus\w*|vejas|vejo|dregm\w*|matomum\w*|humidity|wind|ruzgar|nem)\b/g, "oru-rodikliai", "Orų rodikliai"],
];
const periodPattern = /\b(1|3|5|7|10|15|30|45|90)\s*(?:d|diena|dienos|dienu|dienoms|day|days|gun|gunluk)\b/;
const locationQuestion = /\b(?:kokie|koks|kokia|kokios|kiek|kada|kur|ar|bus|cia|in|for|today|tomorrow|siandien|rytoj|bugun|yarin|the|will|be|how|what|is|it|ir|dabar)\b/g;
const localityType = / (?:k\.|vs\.|mstl\.|(?:glž\. )?st\.)$/;
const regionalCentres = new Set(["alytus", "kaunas", "klaipeda", "marijampole", "panevezys", "siauliai", "taurage", "telsiai", "utena", "vilnius"]);
const regionTerms = /\b(?:r|m|raj|rajonas|rajono|rajone|sav|savivaldybe|savivaldybes|savivaldybeje|apskr|apskritis|apskrities|apskrityje|sen|seniunija|seniunijos|seniunijoje|k|kaimas|kaimo|kaime|miestas|miesto|mieste|mstl|miestelis|miestelio|miestelyje)\b/g;
const fold = (value = "") => value.toLowerCase().normalize("NFD").replace(/\p{M}+/gu, "").replace(/ı/g, "i")
  .replace(/[^a-z0-9]+/g, " ").trim();
const stripRegions = value => value.replace(regionTerms, " ").replace(/\s+/g, " ").trim();
const stem = value => value.split(" ").map(word =>
  word.length >= 5 ? word.replace(/(.{4})(?:iuose|uose|yse|ose|ese|yje|oje|eje|iu|ai|is|as|us|ys|os|es|u|a|e|o|i|s)$/, "$1") : word
).join(" ");

function withinOneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let pos = 0;
  while (pos < a.length && a[pos] === b[pos]) pos++;
  const tailA = a.slice(pos), tailB = b.slice(pos);
  if (a.length !== b.length) return a.length > b.length ? tailA.slice(1) === tailB : tailB.slice(1) === tailA;
  return tailA.slice(1) === tailB.slice(1)
    || (tailA[0] === tailB[1] && tailA[1] === tailB[0] && tailA.slice(2) === tailB.slice(2));
}

export function prepareWeatherSearch(registry) {
  if (!Array.isArray(registry?.places) || !registry.municipalities || !registry.wards)
    throw new Error("Vietovių rodyklė netinkama");
  const directory = [
    { title: "Lietuvos miestų orai", url: "/orai/miestai/", description: "Miestų orų prognozės.", category: "weather" },
    { title: "Savivaldybių orai", url: "/orai/savivaldybes/", description: "Naršykite orus pagal apskritį ir savivaldybę.", category: "weather" },
  ];
  const aliases = new Map();
  const stems = new Map();
  const browse = [...directory];
  const regions = new Map();
  const add = (map, key, entry) => {
    if (!key) return;
    const items = map.get(key);
    if (items) items.push(entry);
    else map.set(key, [entry]);
  };
  function addEntry(entry, keys, context, priority, scope) {
    const indexed = { entry, context, priority, scope };
    for (const key of new Set(keys.filter(Boolean))) add(aliases, key, indexed);
    for (const key of new Set(keys.filter(key => key && !/\d/.test(key)).map(stem))) add(stems, key, indexed);
    browse.push(entry);
  }

  for (const [id, [slug, name, county]] of Object.entries(registry.municipalities)) {
    const district = fold(name);
    const region = stripRegions(district);
    const context = stem(region + " " + stripRegions(fold(county)));
    regions.set(Number(id), { name, context });
    addEntry({ title: `Orai · ${name}`, placeName: name, url: `/orai/savivaldybes/${slug}/`, description: county, category: "weather" },
      [district, region, fold(slug)], context.split(" "), 2,
      district.endsWith(" r sav") ? "district" : district.endsWith(" m sav") ? "city" : "municipality");
  }
  const wards = Object.fromEntries(Object.entries(registry.wards).map(([id, [name]]) => [id, [name, stem(stripRegions(fold(name)))]]));
  const duplicateCounts = new Map();
  for (const [, name, district, , , , , , ward] of registry.places) {
    const key = `${name}:${district}:${ward}`;
    duplicateCounts.set(key, (duplicateCounts.get(key) || 0) + 1);
  }
  for (const [slug, name, district, latitude, longitude, locative, solar, genitive, ward] of registry.places) {
    const region = regions.get(district);
    if (!region || !/^[a-z0-9-]+$/.test(slug)) throw new Error("Netinkamas vietovės įrašas");
    const [wardName, wardKey] = wards[ward] || [];
    const key = `${name}:${district}:${ward}`;
    const location = [region.name, wardName].filter(Boolean);
    if (duplicateCounts.get(key) > 1) location.push(`${latitude}°, ${longitude}° · AR ${slug.split("-").at(-1)}`);
    const named = name.replace(localityType, "");
    const context = [region.context, wardKey].filter(Boolean).join(" ").split(" ");
    addEntry({ title: `Orai · ${name}`, placeName: name, url: `/orai/${slug}/`, description: location.join(" · "), category: "weather" },
      [fold(named), fold(name), fold(locative), fold(genitive), fold(slug)], context,
      regionalCentres.has(slug) ? 7 : solar ? 4 : 1);
  }
  return { aliases, stems, keys: [...aliases.keys()].sort(), browse, directory };
}

export function weatherQuery(value) {
  let location = fold(String(value ?? "").slice(0, 256).replace(/['’](?:da|de|ta|te)\b/gi, ""));
  const period = location.match(periodPattern)?.[1];
  if (period) location = location.replace(periodPattern, " ");
  let section;
  for (const [pattern, anchor, label] of sectionTerms) {
    const previous = location;
    location = location.replace(pattern, " ");
    if (location !== previous) section ||= { anchor, label };
  }
  const before = location;
  location = location.replace(weatherWords, " ");
  const forecast = location !== before;
  const explicit = Boolean(period || section || forecast);
  const municipality = /\b(?:r|raj|rajon\w*|sav|savivaldyb\w*)\b/.test(location);
  const scope = /\b(?:r|raj|rajon\w*)\b/.test(location) ? "district" : /\bm sav\b/.test(location) ? "city" : null;
  const rawLocation = location.replace(locationQuestion, " ").replace(/\s+/g, " ").trim();
  const directory = /^(?:lietuvos )?(?:miestai|miestu)$/.test(rawLocation) ? "cities"
    : /^(?:lietuvos )?savivaldyb(?:es|iu)$/.test(rawLocation) ? "municipalities"
    : /^(?:lietuva|lietuvoje|lietuvos)$/.test(rawLocation) ? "country" : null;
  return { location: stripRegions(rawLocation), rawLocation, explicit, forecast, municipality, scope, directory, period, section };
}

function prefixStart(keys, query) {
  let low = 0;
  let high = keys.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (keys[middle] < query) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function findWeatherPlaces(index, intent, weatherOnly = false) {
  const { location, rawLocation } = intent;
  if (!index || rawLocation.length < 2 || intent.directory) return [];
  const candidates = new Map();
  function offer(items, quality, context = []) {
    for (const item of items || []) {
      if (!context.every(word => item.context.includes(word))) continue;
      const scopeBonus = intent.scope && item.scope === intent.scope ? 24 : intent.municipality && item.scope ? 12 : 0;
      const score = quality + item.priority + scopeBonus;
      if (score > (candidates.get(item) || 0)) candidates.set(item, score);
    }
  }
  offer(index.aliases.get(rawLocation), 152);
  if (rawLocation !== location) offer(index.aliases.get(location), 150);
  const terms = rawLocation.split(" ").slice(0, 12);
  if (terms.length > 1) {
    for (let start = 0; start < terms.length; start++) {
      for (let end = start + 1; end <= terms.length; end++) {
        if (start === 0 && end === terms.length) continue;
        const name = terms.slice(start, end).join(" ");
        const context = stem(stripRegions([...terms.slice(0, start), ...terms.slice(end)].join(" "))).split(" ").filter(Boolean);
        offer(index.aliases.get(name), 139, context);
        offer(index.stems.get(stem(name)), 119, context);
      }
    }
  }
  if (!candidates.size && location.length >= 2) {
    offer(index.stems.get(stem(location)), 116);
    for (let i = prefixStart(index.keys, location); index.keys[i]?.startsWith(location); i++) {
      offer(index.aliases.get(index.keys[i]), intent.explicit || weatherOnly ? 103 : 26);
    }
  }
  if (!candidates.size && (intent.explicit || weatherOnly) && location.length >= 4) {
    for (const key of index.keys) {
      if (!/\d/.test(key) && withinOneEdit(location, key)) offer(index.aliases.get(key), 80);
    }
  }
  return [...candidates].map(([{ entry, scope }, score]) => {
    if ((!intent.period && !intent.section) || scope) return { ...entry, score };
    const { period, section } = intent;
    const url = entry.url + (period ? `?dienos=${period}` : "") + (section ? "#" + section.anchor : "");
    const label = [section?.label, period && `${period} d.`].filter(Boolean).join(" · ");
    return { ...entry, title: `${label} · ${entry.placeName}`, url, score };
  }).sort((a, b) => b.score - a.score || collator.compare(a.title, b.title) || collator.compare(a.url, b.url));
}

let loaded;
export function loadWeatherSearch() {
  loaded ||= fetch(new URL("./data/weather-places.json", import.meta.url), {
    credentials: "same-origin", cache: "default", signal: AbortSignal.timeout(8000),
  }).then(response => {
    if (!response.ok) throw new Error("Nepavyko įkelti vietovių rodyklės");
    return response.json();
  }).then(prepareWeatherSearch).catch(error => {
    loaded = undefined;
    throw error;
  });
  return loaded;
}
