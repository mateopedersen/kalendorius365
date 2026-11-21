import { isDaysOffQuery, loadSearchIndex, normalizeSearchText, searchPages } from "./search-engine.js";
import { findWeatherPlaces, loadWeatherSearch, weatherQuery } from "./weather-search.js";

const collator = new Intl.Collator("lt", { numeric: true });
const weatherHome = "/orai/";
const compare = (a, b) => a.score === b.score
  ? collator.compare(a.title, b.title) || collator.compare(a.url, b.url)
  : b.score - a.score;
const browseCache = new WeakMap();

function sortedBrowse(items) {
  let sorted = browseCache.get(items);
  if (!sorted) {
    sorted = [...items].sort((a, b) => collator.compare(a.title, b.title) || collator.compare(a.url, b.url));
    browseCache.set(items, sorted);
  }
  return sorted;
}

export async function loadSearchCatalogue(category = "all", query = "") {
  const words = normalizeSearchText(String(query ?? "").slice(0, 256)).split(" ");
  const includesWeather = category === "weather" || (category === "all" && !isDaysOffQuery(words));
  const [pages, weather] = await Promise.all([
    loadSearchIndex(),
    includesWeather ? loadWeatherSearch().catch(error => {
      if (category === "weather") throw error;
      return null;
    }) : null,
  ]);
  return { pages, weather, weatherUnavailable: includesWeather && !weather };
}

export function searchCatalogue({ pages, weather }, query, { category = "all" } = {}) {
  const normalized = normalizeSearchText(String(query ?? "").slice(0, 256));
  const weatherOnly = category === "weather";
  const includesWeather = category === "all" || weatherOnly;
  if (!normalized) {
    if (String(query ?? "").trim()) return [];
    const staticItems = sortedBrowse(pages).filter(item => category === "all" || item.category === category);
    return includesWeather && weather ? [...staticItems, ...sortedBrowse(weather.browse)] : staticItems;
  }
  if (!includesWeather) return searchPages(pages, query, { category });

  const intent = weatherQuery(query);
  const matches = findWeatherPlaces(weather, intent, weatherOnly);
  const hub = pages.find(item => item.url === weatherHome);
  if (intent.directory && intent.directory !== "country" && weather &&
    (weatherOnly || intent.explicit || intent.directory === "municipalities")) {
    const directory = intent.directory === "municipalities" ? weather.directory[1] : weather.directory[0];
    return [directory, ...(hub ? [hub] : [])];
  }
  if (matches.length && (intent.explicit || weatherOnly)) return matches;
  if (hub && (intent.forecast || (!intent.location && intent.explicit && intent.section?.anchor !== "savaitgalio-orai"))) {
    return [{ ...hub, score: 180 }, ...(weather?.directory || [])];
  }

  const staticMatches = searchPages(pages, query, { category });
  return matches.length ? [...staticMatches, ...matches].sort(compare) : staticMatches;
}
