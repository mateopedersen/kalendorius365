import { byMunicipality, municipalities, weatherPlaces } from "./weather-places.mjs";
import { cityImages } from "./weather-data.mjs";

export const weatherSite = "https://kalendorius365.lt";
const h = text => String(text).replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const urlFor = place => `/orai/${place.slug}/`;
const link = (place, name = place.name) => `<a href="${urlFor(place)}">${h(name)}</a>`;
const actionEnd = icon => `<span class="wx-action__end"><svg class="wx-action-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><use href="/assets/visuals/weather-atlas-icons.svg#action-${icon}"></use></svg></span>`;
const actionLink = (href, label, icon = "chevron") =>
  `<a class="wx-action" href="${h(href)}"><span class="wx-action__label">${h(label)}</span>${actionEnd(icon)}</a>`;
const collator = new Intl.Collator("lt");
const coordinate = new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 4 });
const distanceNumber = new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 1 });
const districtList = [...municipalities.values()].sort((a, b) => collator.compare(a.name, b.name));
const countyName = name => name.replace(/ apskr\.$/, " apskritis");
const countyId = name => name.split(" ")[0].toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
const districtName = name => name.replace(/ m\. sav\.$/, " miesto savivaldybė")
  .replace(/ r\. sav\.$/, " rajono savivaldybė").replace(/ sav\.$/, " savivaldybė");
const byCounty = Map.groupBy(districtList, place => countyName(place.county));
const citiesByCounty = Map.groupBy(
  [...weatherPlaces.values()].filter(place => place.solar).sort((a, b) => collator.compare(a.name, b.name)),
  place => countyName(municipalities.get(place.district).county),
);
const placeTemplate = /<template id="wx-place-template">([\s\S]*?)<\/template>/;
const forecastCities = [...citiesByCounty.values()].flat();
const directoryRoutes = new Set(["miestai", "savivaldybes"]);
const weatherIllustration = {
  src: "/assets/visuals/weather-skies/overcast.webp",
  alt: "Tamsių debesų iliustracija",
  width: 512,
  height: 512,
};
const citiesByDistrict = Map.groupBy(forecastCities, place => place.district);
const locationGroups = Map.groupBy([...weatherPlaces.values()].filter(place => !place.municipality),
  place => `${place.district}:${place.name}`);
const settlementTypes = {
  "k.": ["kaimas", "kaimo", "kaime"],
  "mstl.": ["miestelis", "miestelio", "miestelyje"],
  "vs.": ["viensėdis", "viensėdžio", "viensėdyje"],
  "st.": ["stotis", "stoties", "stotyje"],
};

const settlements = [...weatherPlaces.values()].filter(place => !place.municipality);
const latitudeBands = Map.groupBy(settlements, place => Math.floor(place.latitude * 5));
const radar = "https://www.meteo.lt/dabar/radarai/";
const warnings = "https://www.meteo.lt/prognozes/pavojingi-reiskiniai/";
const climateReference = "https://www.meteo.lt/klimatas/lietuvos-klimatas/";
const trafficMap = "https://eismoinfo.lt/";
const airMap = "https://airindex.eea.europa.eu/AQI/";
const pollenMap = "https://pasyfo.eu/ziedadulkiu-prognozes";

const cityGuides = {
  kaunas: {
    title: "Išėjimui į Nemuno salą",
    text: "Planuodami pasivaikščiojimą Nemuno saloje, valandinėje lentelėje palyginkite kritulius tuo metu, kai ketinate išeiti, ir valandą, kai grįšite. Jei liksite iki vakaro, pravers ir Kauno saulėlydžio laikas.",
    link: "„Mokslo sala“ Nemuno saloje",
    url: "https://www.kaunas.lt/2024/12/09/kaunas-ispakuoja-isankstines-dovanas-mokslo-sala-duris-atvers-jau-si-penktadieni/",
  },
  vilnius: {
    title: "Pasivaikščiojimas Neries pakrante",
    text: "Jei einate Neries krantine link Vingio parko, pasitikrinkite kelių valandų kritulių tikimybę ir juntamąją temperatūrą. Valandinė lentelė pravers renkantis, kada pradėti ilgesnį pasivaikščiojimą.",
    link: "Vingio parkas",
    url: "https://www.govilnius.lt/aplankykite/lankytinos-vietos/vingio-parkas",
  },
  klaipeda: {
    title: "Prieš persikeliant į Smiltynę",
    text: "Planuojant pasivaikščiojimą Smiltynėje, šalia temperatūros patikrinkite ir vėjo gūsius bei matomumą. Prieš vykdami į perkėlą patikrinkite ir tos dienos keltų tvarkaraštį.",
    link: "Klaipėdos pėsčiųjų maršrutas į Smiltynę",
    url: "https://klaipedatravel.lt/wp-content/uploads/2019/05/Pesciomis-po-Klaipeda-LT.pdf",
  },
  siauliai: {
    title: "Pasivaikščiojimas prie Talkšos",
    text: "Renkantis laiką Talkšos ekologiniam takui, palyginkite kelių valandų kritulius ir vėjo gūsius, ypač jeigu dalį kelio eisite palei atvirą ežero pakrantę.",
    link: "Talkšos ekologinis takas",
    url: "https://www.visitsiauliai.lt/lankytinos-vietos/talksos-ekologinis-takas/",
  },
};

function bracket(html, marker, content) {
  return html.replace(new RegExp(`<!--wx-${marker}-->[\\s\\S]*?<!--/wx-${marker}-->`), () => content);
}

function placeNames(place) {
  if (place.municipality) {
    const name = districtName(place.name);
    return { name, genitive: name.replace(/savivaldybė$/, "savivaldybės"), where: name.replace(/savivaldybė$/, "savivaldybėje") };
  }
  if (place.locative) return { name: place.name, genitive: place.genitive, where: place.locative };
  const label = place.name.replace(/ glž\. st\.$/, " st.");
  const cut = label.lastIndexOf(" ");
  const endings = settlementTypes[label.slice(cut + 1)];
  if (!endings) return { name: place.name };
  const base = label.slice(0, cut);
  return { name: `${base} ${endings[0]}`, genitive: `${base} ${endings[1]}`, where: `${base} ${endings[2]}` };
}

function locationDetails(place, municipality) {
  const group = locationGroups.get(`${place.district}:${place.name}`) || [];
  if (group.length < 2) return { qualifier: place.locative || place.municipality ? "" : municipality.name.replace(/ sav\.$/, "") };
  const point = `${coordinate.format(place.latitude)}° š. pl., ${coordinate.format(place.longitude)}° r. ilg.`;
  const collocated = group.some(other => other !== place && other.latitude === place.latitude && other.longitude === place.longitude);
  const ward = place.ward && group.every(other => other === place || other.ward !== place.ward) ? place.ward : "";
  return { qualifier: ward || (collocated ? `${point}, AR ${place.slug.split("-").at(-1)}` : point), homonym: true };
}

function decoratePage(html, title, description, href, trail, place) {
  const fullTitle = h(title + " | Kalendorius365");
  const canonical = weatherSite + href;
  const image = cityImages[place?.slug] ?? weatherIllustration;
  const imageUrl = weatherSite + image.src;
  const imageProperties = {
    "og:image": imageUrl, "og:image:secure_url": imageUrl, "og:image:type": "image/webp",
    "og:image:width": image.width, "og:image:height": image.height, "og:image:alt": image.alt,
    "twitter:image": imageUrl, "twitter:image:alt": image.alt,
  };
  const crumbs = [["Pradžia", "/"], ["Orai Lietuvoje", "/orai/"], ...trail];
  const breadcrumb = crumbs.map(([name, path], index) => index === crumbs.length - 1 ?
    `<span aria-current="page">${h(name)}</span>` : `<a href="${path}">${h(name)}</a>`).join('<span aria-hidden="true">/</span>');
  return html.replace(/<title>[^<]*<\/title>/, () => `<title>${fullTitle}</title>`)
    .replace(/(<meta (?:name="description"|property="og:description"|name="twitter:description") content=")[^"]*/g, (_, head) => head + h(description))
    .replace(/(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*/g, (_, head) => head + fullTitle)
    .replace(/(<meta property="og:url" content="|<link rel="canonical" href=")[^"]*/g, (_, head) => head + canonical)
    .replace(/(<meta (?:name|property)="((?:og|twitter):image[^"]*)" content=")[^"]*/g,
      (original, head, property) => Object.hasOwn(imageProperties, property) ? head + h(imageProperties[property]) : original)
    .replace(/(<nav class="breadcrumbs"[^>]*>)[\s\S]*?<\/nav>/, (_, open) => open + breadcrumb + "</nav>")
    .replace(/(<script type="application\/ld\+json">)([\s\S]*?)<\/script>/g, (whole, open, body) => {
      const schema = JSON.parse(body);
      if (schema["@type"] === "BreadcrumbList") {
        schema.itemListElement = crumbs.map(([name, path], index) => ({
          "@type": "ListItem", position: index + 1, name, item: weatherSite + path,
        }));
      } else if (schema["@type"] === "WebPage" && schema.url === weatherSite + "/orai/") {
        Object.assign(schema, { "@id": canonical + "#webpage", url: canonical, name: title, description });
        if (place) schema.about = {
          "@type": "Place", name: placeNames(place).name,
          geo: { "@type": "GeoCoordinates", latitude: place.latitude, longitude: place.longitude },
          containedInPlace: { "@type": "Place", name: countyName(municipalities.get(place.district).county) },
        };
      } else {
        return whole;
      }
      return open + JSON.stringify(schema).replaceAll("<", "\\u003c") + "</script>";
    });
}

function distanceFrom(place) {
  const longitudeScale = Math.cos(place.latitude * Math.PI / 180);
  return candidate => Math.hypot(candidate.latitude - place.latitude,
    (candidate.longitude - place.longitude) * longitudeScale) * 111.2;
}

function nearbyPlaces(place) {
  const distance = distanceFrom(place);
  const closest = candidates => candidates.filter(candidate => candidate !== place).map(candidate => ({
    candidate,
    km: distance(candidate),
  })).sort((a, b) => a.km - b.km).slice(0, 8);
  const band = Math.floor(place.latitude * 5);
  const nearby = closest([band - 1, band, band + 1].flatMap(key => latitudeBands.get(key) ?? []));
  return nearby.length === 8 && nearby.at(-1).km < 22.24 ? nearby : closest(settlements);
}

function solarCity(place) {
  if (place.solar) return place;
  const distance = distanceFrom(place);
  const candidates = citiesByDistrict.get(place.district) || forecastCities;
  return candidates.reduce((closest, candidate) => distance(candidate) < distance(closest) ? candidate : closest);
}

function launchLinks(href, names) {
  const periods = [
    [1, "Šiandien", "Orų rodmenys ir valandinė prognozė", "clock"],
    [15, `${names.genitive ? names.genitive + " " : ""}15 dienų orų prognozė`, "Dienos ir nakties temperatūra, krituliai ir gūsiai", "date-range"],
    [90, "90 dienų klimato apžvalga", "Nuo 16-os dienos · istoriniai klimato duomenys", "seasons"],
  ];
  return `<nav class="wx-guide-periods" aria-label="Prognozės laikotarpiai">${periods.map(([days, label, note, icon]) =>
    `<a class="wx-action wx-action--illustrated" data-period-shortcut="${days}" href="${href}?dienos=${days}#oru-prognoze"><img src="/assets/visuals/shell/${icon}.svg" width="32" height="32" alt="" aria-hidden="true" loading="lazy"><span class="wx-action__label"><strong>${h(label)}</strong><small>${note}</small></span>${actionEnd("down")}</a>`).join("")}</nav>`;
}

function weatherGuideDetails(names) {
  const location = names.where ? ` ${names.where}` : ` vietovėje „${names.name}“`;
  return `<section class="wx-guide-details" id="prognozes-ir-rodmenys" aria-labelledby="wx-guide-details-title">
    <h3 id="wx-guide-details-title">Orų prognozės ir rodmenys${h(location)}</h3>
    <div class="wx-guide-details__grid">
      <article>
        <h4>Kada lis ir kaip keisis vėjas?</h4>
        <p><a href="#oru-prognoze">Orų prognozėje</a> pasirinkite 1, 3, 5, 7, 10 arba 15 dienų laikotarpį. Kai pateikiami valandiniai duomenys, palyginkite temperatūrą, pojūtį, drėgnį ir vėjo greitį. <a href="#krituliu-prognoze">12 valandų kritulių juosta</a> parodo galimo lietaus ar sniego laiką. <a href="#oru-rodikliai">Orų rodiklių skiltyje</a> rasite slėgį, matomumą, UV indeksą ir dienos trukmę.</p>
      </article>
      <article>
        <h4>Kaip planuoti iki 90 dienų į priekį?</h4>
        <p>30, 45 ir 90 dienų rodiniuose pirmiausia pateikiama iki 15 dienų prognozė. Nuo 16-os dienos rinkitės mėnesį ir peržiūrėkite istorinius aukščiausios ir žemiausios paros temperatūros bei kritulių vidurkius. Jie padeda įvertinti, kokios sąlygos tuo metų laiku įprastos.</p>
      </article>
      <article>
        <h4>Oro kokybė ir žiedadulkės lauke</h4>
        <p><a href="#oro-kokybe">Vietovės oro kokybės ir žiedadulkių kortelėse</a> palyginkite teršalų ir augalų žiedadulkių koncentraciją. Platesnį vaizdą rasite <a href="${airMap}">Europos oro kokybės indekso žemėlapyje</a> ir <a href="${pollenMap}">PASYFO žiedadulkių prognozėse Lietuvai</a>.</p>
      </article>
      <article>
        <h4>Ką patikrinti prieš savaitgalio kelionę?</h4>
        <p><a href="#savaitgalio-orai">Savaitgalio prognozėje</a> palyginkite temperatūrą, kritulius ir gūsius. <a href="#orai-keliuose">Artimiausių kelių stotelių rodmenyse</a> patikrinkite dangos būklę ir matomumą. Visą maršrutą galite peržiūrėti <a href="${trafficMap}">„Via Lietuva“ eismo žemėlapyje</a>.</p>
      </article>
    </div>
  </section>`;
}

function localGuide(place, names, href, nearest) {
  const city = cityGuides[place.slug];
  const title = place.municipality ? "Pasirinkite kelionės vietą" : city?.title || "Orai netoliese";
  const description = place.municipality ?
    "Peržiūrėkite konkretaus miesto, miestelio ar kaimo orus savivaldybėje." :
    city?.text || "Palyginkite kritulius ir vėją išvykimo bei atvykimo vietose tą pačią valandą.";
  const local = city ? actionLink(city.url, city.link, "external") :
    !place.municipality && nearest ? actionLink(urlFor(nearest), placeNames(nearest).name) : "";
  const directoryLabel = place.municipality ? "Vietovės savivaldybėje" : "Daugiau vietovių";
  return `<div class="wx-local-guide">
    <article class="wx-guide-forecast">
      <h3>Pasirinkite laikotarpį</h3>
      ${launchLinks(href, names)}
    </article>
    <article class="wx-guide-outing">
      <div class="wx-guide-outing__body">
        <h3>${h(title)}</h3>
        <p>${h(description)}</p>
        <div class="wx-guide-outing__links">${local}${actionLink("#vietoves", directoryLabel, "down")}</div>
      </div>
    </article>
  </div>${weatherGuideDetails(names)}`;
}

function localDirectory(place, municipality, nearby) {
  const title = place.municipality ? `Orų prognozės vietovėse · ${districtName(place.name)}` : "Artimiausių vietovių prognozės";
  const districtLink = place.municipality ? actionLink("/orai/savivaldybes/", "Visos savivaldybės") : actionLink(urlFor(municipality), districtName(municipality.name));
  const links = place.municipality ? municipalityDirectory(place) :
    nearby.map(({ candidate, km }) => {
      const distance = km < 0.1 ? "<0,1 km" : distanceNumber.format(km) + " km";
      return `<a href="${urlFor(candidate)}">${h(placeNames(candidate).name)} <small>${h(distance)}</small></a>`;
    }).join("");
  const listings = place.municipality ? links : `<nav class="wx-place-links" aria-label="${h(title)}">${links}</nav>`;
  return `<div class="wx-section__head"><h2 id="wx-directory-title">${h(title)}</h2>${districtLink}</div>${listings}`;
}

function referenceLinks(entries) {
  return `<nav class="wx-reference-links" aria-label="Susiję įrankiai ir šaltiniai">${entries.map(([href, label, note, icon, tone]) => {
    const direction = href.startsWith("https:") ? "external" : href.startsWith("#") ? "down" : "chevron";
    return `<a class="wx-action wx-action--tool" data-tone="${tone}" href="${h(href)}">
      <span class="wx-tool-art"><img src="/assets/visuals/${icon}.svg" width="36" height="36" alt="" aria-hidden="true" loading="lazy" decoding="async"></span>
      <span class="wx-action__label"><strong>${h(label)}</strong><small>${h(note)}</small></span>
      ${actionEnd(direction)}
    </a>`;
  }).join("")}</nav>`;
}

function localReferences(place, municipality) {
  const { latitude, longitude } = place;
  const point = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=13/${latitude}/${longitude}`;
  const sun = solarCity(place);
  const county = countyName(municipality.county);
  return referenceLinks([
    [`/saule/${sun.solar}/`, `Saulėtekis ir saulėlydis ${sun.locative}`,
      sun === place ? "Saulės laikai ir dienos trukmė" : `Palyginimui · ${sun.name}`, "shell/sunrise", "amber"],
    [`/orai/miestai/#${countyId(county)}`, `${county.split(" ")[0]} apskrities miestų orai`,
      "Prognozės kelionės pradžiai ir tikslui", "shell/location", "green"],
    ["/ilgieji-savaitgaliai/", "Ilgųjų savaitgalių kalendorius", "Datos išvykai planuoti", "shell/long-weekend", "green"],
    [point, "Prognozės vieta žemėlapyje", "Atskaitos taškas „OpenStreetMap“", "shell/location", "blue"],
    [warnings, "LHMT perspėjimai", "Pavojingi orų reiškiniai", "shell/shield", "amber"],
    [climateReference, "Lietuvos klimatas", "LHMT klimato apžvalga", "shell/astronomy", "green"],
  ]);
}

function municipalityDirectory(place) {
  const sections = [
    ["Miestai ir miesteliai", candidate => candidate.solar || candidate.name.endsWith(" mstl.")],
    ["Kaimai", candidate => candidate.name.endsWith(" k.")],
    ["Viensėdžiai ir kitos vietovės", candidate => !candidate.solar && !/ (?:k|mstl)\.$/.test(candidate.name)],
  ];
  const candidates = byMunicipality.get(place.district);
  return sections.map(([label, belongs]) => {
    const entries = candidates.filter(belongs);
    if (!entries.length) return "";
    return `<details class="wx-settlement-group"${entries.length <= 24 ? " open" : ""}><summary>${label}<span>${entries.length}</span></summary><nav class="wx-place-links" aria-label="${label}">${entries.map(candidate => link(candidate, placeNames(candidate).name)).join("")}</nav></details>`;
  }).join("");
}

function renderDirectory(html, route) {
  const cities = route === "miestai";
  const heading = cities ? "Lietuvos miestų orai" : "Orai pagal Lietuvos savivaldybes";
  const description = cities ?
    "Lietuvos miestai pagal apskritis. Miesto puslapyje rasite šiandienos ir valandinius orus, prognozę iki 15 dienų, oro kokybės ir žiedadulkių rodiklius." :
    "Visos 60 Lietuvos savivaldybių pagal apskritis. Pasirinkite miestą, miestelį, kaimą ar viensėdį ir peržiūrėkite vietos temperatūrą, kritulius, vėją bei drėgnį.";
  const counties = [...(cities ? citiesByCounty : byCounty)].sort(([a], [b]) => collator.compare(a, b));
  const sections = counties.map(([county, places]) => {
    const related = cities ? "savivaldybes" : "miestai";
    return `<section class="wx-section" id="${countyId(county)}"><div class="wx-section__head"><h2>${h(county)}</h2>${actionLink(`/orai/${related}/#${countyId(county)}`, cities ? "Šios apskrities savivaldybės" : "Šios apskrities miestų orai")}</div><nav class="wx-area-grid" aria-label="${h(county)}">${places.map(place => link(place, cities ? place.name : districtName(place.name))).join("")}</nav></section>`;
  }).join("");
  const directoryLink = cities ? actionLink("/orai/savivaldybes/", "Savivaldybės, miesteliai ir kaimai") :
    actionLink("/orai/miestai/", "Visi Lietuvos miestai");
  const sources = referenceLinks([
    ["/orai/#wx-search-input", "Vietovės paieška", "Miestai, miesteliai ir kaimai", "shell/search-glass", "green"],
    [radar, "Kritulių radaras", "LHMT radarų žemėlapis", "weather-radar", "blue"],
    ["/oru-saltiniai/#duomenys", "Duomenys ir licencijos", "Orų ir vietovių šaltiniai", "shell/civic-directory", "amber"],
  ]);
  const content = `<div class="weather-atlas wx-all"><header class="wx-hero wx-hero--directory"><div class="wx-hero__intro"><a class="wx-parent" href="/orai/">Orai Lietuvoje</a><h1 id="wx-place-title">${heading}</h1><p>${description}</p><nav class="wx-jump" aria-label="Vietovių pasirinkimas">${directoryLink}</nav></div></header>${sections}<section class="wx-section" aria-labelledby="wx-directory-sources"><h2 id="wx-directory-sources">Orų ir vietovių šaltiniai</h2>${sources}</section></div>`;
  const href = `/orai/${route}/`;
  return decoratePage(bracket(html.replace(placeTemplate, ""), "hub", content),
    heading, description, href, [[cities ? "Miestai" : "Savivaldybės", href]]);
}

export function hasWeatherRoute(route) {
  return directoryRoutes.has(route) || weatherPlaces.has(route);
}

export function renderWeatherPage(html, route) {
  if (!hasWeatherRoute(route)) return null;
  if (!html.includes("<!--wx-hub-->") || !html.includes("<!--/wx-hub-->"))
    throw Error("Weather page shell is missing");
  if (directoryRoutes.has(route)) return renderDirectory(html, route);
  const template = html.match(placeTemplate);
  if (!template?.[1].includes("<!--wx-place-title--><!--/wx-place-title-->")) throw Error("Weather location template is missing");
  html = bracket(html.replace(placeTemplate, ""), "hub", template[1]);
  const place = weatherPlaces.get(route);
  const municipality = municipalities.get(place.district);
  const names = placeNames(place);
  const details = locationDetails(place, municipality);
  const nearby = nearbyPlaces(place);
  const where = names.where ? " " + names.where : " · " + names.name;
  const heading = `Orai${where}`;
  const href = urlFor(place);
  const title = details.qualifier ? `${names.genitive || names.name} orai šiandien ir 15 dienų (${details.qualifier})` :
    `${heading} šiandien ir 15 dienų prognozė`;
  const description = details.qualifier ?
    `Orai${where} (${details.homonym ? municipality.name + ", " : ""}${details.qualifier}). Valandinė temperatūra, krituliai, drėgnis ir vėjas. Prognozė iki 15 dienų, oro kokybė ir žiedadulkės.` :
    `Orai${where} šiandien, rytoj ir savaitgalį. Prognozė iki 15 dienų, valandiniai krituliai, vėjas ir drėgnis, oro kokybė bei žiedadulkės.`;
  const trail = [["Savivaldybės", "/orai/savivaldybes/"]];
  if (!place.municipality) trail.push([districtName(municipality.name), urlFor(municipality)]);
  trail.push([names.name, href]);
  html = decoratePage(html, title, description, href, trail, place);
  html = html.replace('data-weather-place="vilnius"', () => `data-weather-place="${place.slug}"`);
  html = bracket(html, "place-title", `<h1 id="wx-place-title">${h(heading)}</h1>`);
  const context = place.municipality ? `<a href="/orai/savivaldybes/#${countyId(municipality.county)}">${h(countyName(municipality.county))}</a>` :
    [place.ward && h(place.ward), link(municipality, districtName(municipality.name))].filter(Boolean).join(" · ");
  const closest = nearby.find(({ candidate }) => candidate.name !== place.name)?.candidate;
  const homonymNote = details.homonym && closest ?
    `<p class="wx-coordinates">Šio atskaitos taško kaimynystėje yra ${link(closest, placeNames(closest).name)}.</p>` : "";
  const intro = place.municipality ?
    "Savivaldybės prognozė skaičiuojama pagal vieną atskaitos tašką." :
    "Valandinėje prognozėje matysite, kada numatomi krituliai ir kaip keisis temperatūra bei vėjas.";
  html = bracket(html, "intro", `<p>${h(intro)}</p><p class="wx-location-context">${context}</p>${homonymNote}`);
  html = bracket(html, "weekend", `<h2 id="wx-weekend-title">Savaitgalio orai${h(where)}</h2>`);
  html = bracket(html, "environment", `<h2 id="wx-environment-title">Oro kokybė ir žiedadulkės${h(where)}</h2>`);
  const weekendIntro = names.where ? `Planuojate savaitgalį ${names.where}?` : `Savaitgalio prognozė vietovei „${names.name}“.`;
  html = bracket(html, "weekend-intro", `<p id="wx-weekend-summary" class="wx-weekend__summary" data-location="${h(where)}" aria-live="polite">${h(weekendIntro)} Palyginkite šeštadienio ir sekmadienio temperatūrą, kritulius bei vėjo gūsius.</p>`);
  html = bracket(html, "forecast", `<h2 id="wx-forecast-title" tabindex="-1">Orų prognozė${h(where)}</h2>`);
  html = bracket(html, "road", `<h2 id="wx-roads-title">Orai keliuose${h(where)}</h2>`);
  html = bracket(html, "directory", localDirectory(place, municipality, nearby));
  html = bracket(html, "guide", localGuide(place, names, href, closest));
  return bracket(html, "references", localReferences(place, municipality));
}
