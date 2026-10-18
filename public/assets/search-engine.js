const STOP_WORDS = new Set([
  "ar", "bei", "d", "del", "iki", "ir", "is", "ka", "kai", "kad", "koks",
  "kur", "kurie", "m", "o", "per", "su", "tai", "to", "uz", "yra",
]);

const INTENT_GROUPS = [
  ["calendar", "calendars", "kalendorius", "kalendoriai", "kalendoriaus", "kalendoriu", "kalendoriuje", "takvim", "takvimas", "takvimler"],
  ["holiday", "holidays", "svente", "sventes", "sventine", "sventiniu", "nedarbo", "atmintina", "atmintinos", "bayram", "bayramlar"],
  ["atostogos", "atostogu", "atostoga", "poilsis", "ilgieji", "savaitgaliai", "vacation", "leave", "tatil", "izin"],
  ["darbo", "darbas", "darbu", "diena", "dienos", "dienu", "workday", "workdays", "working", "darbo-laikas", "is-gunu", "is-gunleri"],
  ["mokykla", "mokyklos", "mokiniu", "pamoka", "pamokos", "pamoku", "school", "lesson", "lessons", "ders", "programi"],
  ["saule", "saules", "sauletekis", "saulelydis", "sunrise", "sunset", "sun", "solar", "daylight", "sviesa", "gunes"],
  ["menulis", "menulio", "menulio-faze", "faze", "fazes", "jaunatis", "pilnatis", "moon", "lunar", "phases", "ay"],
  ["horoskopas", "horoskopai", "zodiakas", "zodiako", "astrologija", "horoscope", "zodiac", "ascendentas", "ascendenta", "ascendant", "burc", "burclar", "yukselen"],
  ["vardadienis", "vardadieniai", "vardadienio", "vardadieniu", "varduves", "nameday", "namedays"],
  ["irankis", "irankiai", "skaiciuokle", "skaiciuokles", "planuoklis", "planuokliai", "calculator", "planner", "tool", "tools"],
  ["oras", "orai", "temperatura", "weather", "forecast", "prognoze"],
  ["pamainos", "pamainu", "grafikas", "grafiku", "shift", "shifts", "schedule", "tvarkarastis", "tvarkarascio"],
  ["ivykis", "ivykiai", "renginys", "renginiai", "pastaba", "pastabos", "uzduotis", "uzduotys", "event", "events", "planas", "planai"],
];

const synonymGroups = new Map();
for (const group of INTENT_GROUPS) {
  const normalized = group.map(normalizeSearchText);
  for (const term of normalized) synonymGroups.set(term, normalized);
}

let loadedIndex;
let preparedIndex;

export function normalizeSearchText(value = "") {
  return String(value)
    .toLocaleLowerCase("lt-LT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/&/g, " ir ")
    .replace(/[’'`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function words(value) {
  return normalizeSearchText(value).match(/[\p{L}\p{N}]+/gu) || [];
}

export function loadSearchIndex() {
  const indexUrl = new URL("./data/search.json", import.meta.url);
  const version = new URL(import.meta.url).searchParams.get("v");
  if (version) indexUrl.searchParams.set("v", version);
  loadedIndex ||= fetch(indexUrl, { credentials: "same-origin" }).then((response) => {
    if (!response.ok) throw new Error("Nepavyko įkelti paieškos rodyklės");
    return response.json();
  }).catch((error) => {
    loadedIndex = undefined;
    throw error;
  });
  return loadedIndex;
}

function prepare(index) {
  if (preparedIndex?.source === index) return preparedIndex;
  const docs = index.map((item) => {
    const fields = {
      title: normalizeSearchText(item.title),
      url: normalizeSearchText(item.url),
      keywords: normalizeSearchText(item.keywords),
      headings: normalizeSearchText(item.headings),
      description: normalizeSearchText(item.description),
      content: normalizeSearchText(item.content),
    };
    const tokens = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, new Set(words(value))]));
    return { item, fields, tokens };
  });
  preparedIndex = { source: index, docs };
  return preparedIndex;
}

function commonPrefixLength(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function editDistanceAtMostOne(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (i < a.length || j < b.length ? 1 : 0) <= 1;
}

function tokenSimilarity(query, candidate) {
  if (query === candidate) return 1;
  if (query.length < 4 || candidate.length < 4) return 0;
  if (query.startsWith(candidate) || candidate.startsWith(query))
    return 0.78 + 0.2 * Math.min(query.length, candidate.length) / Math.max(query.length, candidate.length);
  const prefix = commonPrefixLength(query, candidate);
  if (prefix >= 5 && prefix / Math.min(query.length, candidate.length) >= 0.62)
    return 0.73 * prefix / Math.max(query.length, candidate.length);
  if (query.length >= 5 && candidate.length >= 5 && editDistanceAtMostOne(query, candidate)) return 0.64;
  return 0;
}

const FIELD_WEIGHT = { title: 13, keywords: 8, url: 6, headings: 5.5, description: 4, content: 1.7 };

function bestFieldMatch(queryWord, doc, groupWords) {
  const fieldScores = {};
  for (const [field, weight] of Object.entries(FIELD_WEIGHT)) {
    const tokens = doc.tokens[field];
    let fieldBest = 0;
    for (const term of groupWords) {
      const exact = tokens.has(term) ? 1 : 0;
      if (exact > fieldBest) fieldBest = exact;
      if (fieldBest === 1) break;
      for (const candidate of tokens) {
        const similarity = tokenSimilarity(term, candidate);
        if (similarity > fieldBest) fieldBest = similarity;
        if (fieldBest >= 0.99) break;
      }
      if (fieldBest >= 0.99) break;
    }
    fieldScores[field] = fieldBest * weight;
  }
  const best = Math.max(...Object.values(fieldScores));
  const secondary = Object.entries(fieldScores).reduce((sum, [field, value]) => {
    if (value === best) return sum;
    const multiplier = field === "title" ? 0.46 : field === "url" ? 0.54 : field === "headings" ? 0.34 : field === "keywords" ? 0.16 : 0.1;
    return sum + value * multiplier;
  }, 0);
  return best + secondary;
}

export function searchPages(index, query, { category = "all", limit = Infinity } = {}) {
  const normalizedQuery = normalizeSearchText(query);
  const rawWords = words(query);
  const queryWords = rawWords.length > 1 ? rawWords.filter((word) => !STOP_WORDS.has(word)) : rawWords;
  if (!queryWords.length) return [];

  const { docs } = prepare(index);
  const year = queryWords.find((word) => /^20\d{2}$/.test(word));
  const calendarIntent = queryWords.some((word) => synonymGroups.get(word)?.includes("kalendorius") || ["calendar", "calendars", "kalendorius", "kalendoriai"].includes(word));
  const lunarIntent = queryWords.some((word) => synonymGroups.get(word)?.includes("moon"));
  const lunarOverviewIntent = lunarIntent && queryWords.every((word) =>
    word === year || synonymGroups.get(word)?.includes("moon") || synonymGroups.get(word)?.includes("kalendorius"));
  const scored = [];
  for (const doc of docs) {
    if (category !== "all" && doc.item.category !== category) continue;
    const matched = [];
    let score = 0;
    for (const queryWord of queryWords) {
      const group = synonymGroups.get(queryWord) || [queryWord];
      const direct = bestFieldMatch(queryWord, doc, [queryWord]);
      const synonym = group.length > 1 ? bestFieldMatch(queryWord, doc, group) * 0.62 : 0;
      const termScore = Math.max(direct, synonym);
      if (termScore > 0) {
        matched.push(queryWord);
        score += termScore;
      }
    }
    const coverage = matched.length / queryWords.length;
    if (!matched.length || coverage < (queryWords.length > 2 ? 0.5 : 1 / queryWords.length)) continue;

    const phraseWeights = [
      ["title", 28], ["keywords", 18], ["headings", 14], ["description", 9], ["content", 3], ["url", 8],
    ];
    for (const [field, weight] of phraseWeights) {
      if (doc.fields[field].includes(normalizedQuery)) score += weight;
    }
    if (year && queryWords.length === 1 && doc.item.url === `/${year}/`) score += 60;
    if (calendarIntent && year && !lunarIntent) {
      if (doc.item.url === `/${year}/`) score += 45;
      else if (doc.item.url.startsWith(`/${year}/`) && doc.item.category === "calendar") score += 7;
    }
    if (lunarOverviewIntent && year && doc.item.url === `/menulio-kalendorius/${year}/`) score += 45;
    if (lunarOverviewIntent && calendarIntent && !year && doc.item.url === '/menulio-kalendorius/') score += 40;
    const nameDayOverview = queryWords.some(word => synonymGroups.get(word)?.includes('nameday')) && queryWords.every(word => synonymGroups.get(word)?.includes('nameday') || ['siandien','rytoj','paieska','vardai','kalendorius'].includes(word));
    if (nameDayOverview && doc.item.url === '/vardadieniai/') score += 45;
    if (coverage === 1 && queryWords.length > 1) score += 12;
    score *= coverage ** 1.4;
    if (score < 4) continue;
    scored.push({ ...doc.item, score, matchedTerms: matched.length, totalTerms: queryWords.length });
  }

  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "lt"));
  return Number.isFinite(limit) ? scored.slice(0, Math.max(0, limit)) : scored;
}
