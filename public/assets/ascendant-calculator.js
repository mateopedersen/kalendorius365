import { BIRTH_CITIES } from "/assets/data/birth-cities.js?v=463499b6dac4";

const SIGNS = [
  { key: "avinas", name: "Avinas", theme: "#b34235", reading: "Astrologinėje simbolikoje siejamas su tiesiu, iniciatyviu įspūdžiu ir veržliu įsitraukimu." },
  { key: "jautis", name: "Jautis", theme: "#527a59", reading: "Simboliškai siejamas su ramiu, pastoviu bendravimo tonu ir dėmesiu patogumui." },
  { key: "dvyniai", name: "Dvyniai", theme: "#58799d", reading: "Dažnai apibūdinamas kaip smalsus, judrus ir klausimų kupinas bendravimo būdas." },
  { key: "vezys", name: "Vėžys", theme: "#3e7187", reading: "Simboliškai siejamas su jautrumu aplinkai, rūpestingumu ir saugumo poreikiu." },
  { key: "liutas", name: "Liūtas", theme: "#b34235", reading: "Astrologinėje simbolikoje siejamas su šiltu, kūrybišku ir pastebimu prisistatymu." },
  { key: "mergele", name: "Mergelė", theme: "#527a59", reading: "Dažnai apibūdinamas kaip pastabus, santūrus ir praktiškas pirmasis įspūdis." },
  { key: "svarstykles", name: "Svarstyklės", theme: "#58799d", reading: "Simboliškai siejamos su diplomatišku bendravimu, bendradarbiavimu ir harmonijos paieška." },
  { key: "skorpionas", name: "Skorpionas", theme: "#3e7187", reading: "Astrologinėje simbolikoje siejamas su susitelkimu, įžvalgumu ir santūriu prisistatymu." },
  { key: "saulys", name: "Šaulys", theme: "#b34235", reading: "Dažnai apibūdinamas kaip atviras, tiesus ir plačiu požiūriu į situacijas." },
  { key: "oziaragis", name: "Ožiaragis", theme: "#527a59", reading: "Simboliškai siejamas su santūrumu, atsakomybe ir nuosekliu bendravimo būdu." },
  { key: "vandenis", name: "Vandenis", theme: "#58799d", reading: "Astrologinėje simbolikoje siejamas su originaliu, savarankišku ir idėjomis grįstu įspūdžiu." },
  { key: "zuvys", name: "Žuvys", theme: "#3e7187", reading: "Dažnai apibūdinamas kaip empatiškas, vaizduotę įtraukiantis ir švelnus bendravimo tonas." },
];

const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;
const radians = (degrees) => (degrees * Math.PI) / 180;
const degrees = (radiansValue) => (radiansValue * 180) / Math.PI;

function dateParts(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error("Patikrinkite gimimo datą.");
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) {
    throw new Error("Įveskite galiojančią datą nuo 1900 metų.");
  }
  return { year, month, day };
}

function zonedParts(instant, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-GB-u-ca-iso8601-nu-latn", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function offsetAt(instant, timeZone) {
  const local = zonedParts(instant, timeZone);
  const displayedAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  return displayedAsUtc - Math.floor(instant / 1000) * 1000;
}

function sameWallTime(parts, expected) {
  return parts.year === expected.year && parts.month === expected.month && parts.day === expected.day &&
    parts.hour === expected.hour && parts.minute === expected.minute && parts.second === 0;
}

function localTimeToUtc(date, time, timeZone) {
  const parts = dateParts(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!timeMatch) throw new Error("Įveskite gimimo laiką valandomis ir minutėmis.");
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour > 23 || minute > 59) throw new Error("Patikrinkite gimimo laiką.");
  const expected = { ...parts, hour, minute, second: 0 };
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute);
  const offsets = new Set([-36, -12, 0, 12, 36].map((hours) => offsetAt(localAsUtc + hours * 3600000, timeZone)));
  const matches = [...offsets]
    .map((offset) => localAsUtc - offset)
    .filter((instant) => sameWallTime(zonedParts(instant, timeZone), expected))
    .sort((a, b) => a - b);
  if (!matches.length) throw new Error("Šiuo vietos laiku laikrodis galėjo būti persuktas. Pasirinkite kitą gimimo laiką arba patikrinkite jo įrašą.");
  return { instant: matches[0], repeated: matches.length > 1 };
}

function julianDay(instant) {
  return instant / 86400000 + 2440587.5;
}

function ascendantLongitude(instant, latitude, longitude) {
  const jd = julianDay(instant);
  const centuries = (jd - 2451545.0) / 36525;
  const days = jd - 2451545.0;
  const gmstDegrees = mod(
    280.46061837 + 360.98564736629 * days + 0.000387933 * centuries ** 2 - centuries ** 3 / 38710000,
    360,
  );
  const theta = radians(mod(gmstDegrees + longitude, 360));
  const phi = radians(latitude);
  const obliquityArcseconds = 21.448 - 46.815 * centuries - 0.00059 * centuries ** 2 + 0.001813 * centuries ** 3;
  const epsilon = radians(23 + 26 / 60 + obliquityArcseconds / 3600);

  // The ascending intersection of the local horizon and the ecliptic.
  // Cross the ecliptic normal with the local zenith, then orient eastward.
  const normal = [0, -Math.sin(epsilon), Math.cos(epsilon)];
  const zenith = [Math.cos(phi) * Math.cos(theta), Math.cos(phi) * Math.sin(theta), Math.sin(phi)];
  let vector = [
    normal[1] * zenith[2] - normal[2] * zenith[1],
    normal[2] * zenith[0] - normal[0] * zenith[2],
    normal[0] * zenith[1] - normal[1] * zenith[0],
  ];
  const east = [-Math.sin(theta), Math.cos(theta), 0];
  if (vector[0] * east[0] + vector[1] * east[1] + vector[2] * east[2] < 0) vector = vector.map((part) => -part);
  const eclipticY = [0, Math.cos(epsilon), Math.sin(epsilon)];
  const x = vector[0];
  const y = vector[0] * eclipticY[0] + vector[1] * eclipticY[1] + vector[2] * eclipticY[2];
  return mod(degrees(Math.atan2(y, x)), 360);
}

function resultParts(longitude) {
  const totalMinutes = Math.round(mod(longitude, 360) * 60) % (360 * 60);
  const signIndex = Math.floor(totalMinutes / 1800);
  const withinSign = totalMinutes % 1800;
  return { sign: SIGNS[signIndex], degree: Math.floor(withinSign / 60), minute: withinSign % 60 };
}

function normalizeCity(value) {
  return String(value || "").trim().normalize("NFC").toLocaleLowerCase("lt-LT");
}

function addSvgSign(target, signKey) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "zodiac-mark");
  svg.setAttribute("viewBox", "0 0 96 96");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `/assets/visuals/zodiac-signs.svg#zodiac-${signKey}`);
  svg.append(use);
  target.append(svg);
}

const form = document.querySelector("#ascendant-form");
if (form) {
  const cityInput = form.querySelector("#birth-city");
  const cityList = form.querySelector("#birth-city-options");
  const result = document.querySelector("#ascendant-result");
  const dateInput = form.querySelector("#birth-date");
  const now = new Date();
  dateInput.max = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const cityByName = new Map(BIRTH_CITIES.map((city) => [normalizeCity(city.name), city]));
  const fragment = document.createDocumentFragment();
  for (const city of BIRTH_CITIES) {
    const option = document.createElement("option");
    option.value = city.name;
    option.label = city.country;
    fragment.append(option);
  }
  cityList.append(fragment);

  form.addEventListener("input", () => {
    result.hidden = true;
    result.replaceChildren();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    result.hidden = false;
    result.replaceChildren();
    result.classList.remove("ascendant-result--error");
    try {
      const city = cityByName.get(normalizeCity(cityInput.value));
      if (!city) throw new Error("Pasirinkite miestą iš pateikto sąrašo arba artimiausią miestą.");
      const { instant, repeated } = localTimeToUtc(form.elements["birth-date"].value, form.elements["birth-time"].value, city.zone);
      const ascendant = resultParts(ascendantLongitude(instant, city.lat, city.lon));
      result.style.setProperty("--ascendant-sign-accent", ascendant.sign.theme);
      const emblem = document.createElement("span");
      emblem.className = "ascendant-result__emblem";
      addSvgSign(emblem, ascendant.sign.key);
      const copy = document.createElement("div");
      copy.className = "ascendant-result__copy";
      const eyebrow = document.createElement("span");
      eyebrow.className = "ascendant-result__eyebrow";
      eyebrow.textContent = "Jūsų kylantis ženklas";
      const title = document.createElement("strong");
      title.className = "ascendant-result__title";
      title.textContent = ascendant.sign.name;
      const detail = document.createElement("span");
      detail.className = "ascendant-result__detail";
      detail.textContent = `${ascendant.degree}° ${String(ascendant.minute).padStart(2, "0")}′ · ${city.name}, ${city.country}`;
      const reading = document.createElement("p");
      reading.className = "ascendant-result__reading";
      reading.textContent = ascendant.sign.reading;
      copy.append(eyebrow, title, detail, reading);
      result.append(emblem, copy);
      if (repeated) {
        const caveat = document.createElement("p");
        caveat.className = "ascendant-result__caveat";
        caveat.textContent = "Šis vietos laikas pasikartojo dėl sezoninio laiko keitimo; naudotas pirmasis jo pasikartojimas.";
        result.append(caveat);
      }
    } catch (error) {
      result.classList.add("ascendant-result--error");
      result.textContent = error instanceof Error ? error.message : "Nepavyko apskaičiuoti. Patikrinkite įvestus duomenis.";
    }
  });
}

export { ascendantLongitude, localTimeToUtc, resultParts };
