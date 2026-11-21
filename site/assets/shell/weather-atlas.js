import { solarFor } from "../phase-5-6-8-core.js";
import { daylightMarkup, withLocalSun } from "../data/daylight-outlook.js";
import { briefContents, condition, currentReading, dayAt, dayBrief, label, rainBrief, readingLight, readingSource, roadBrief, roadStationLabel } from "../data/weather-brief.js";
let searchCatalogue;
const atlas = document.querySelector(".weather-atlas[data-weather-place]");
if (atlas) setup(atlas);
const hub = document.querySelector(".weather-atlas[data-weather-hub]");
if (hub) {
  hub.querySelectorAll(".wx-search").forEach(enableSearch);
  enableCounties(hub);
}

function enableCounties(hub) {
  const options = [...hub.querySelectorAll("[data-wx-county]")];
  for (const option of options) {
    const panel = document.getElementById(option.dataset.wxCounty);
    if (!panel) continue;
    option.addEventListener("click", event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const previous = hub.querySelector("[data-wx-county][aria-current]");
      if (previous !== option) {
        previous?.removeAttribute("aria-current");
        if (previous) document.getElementById(previous.dataset.wxCounty).hidden = true;
        option.setAttribute("aria-current", "true");
        panel.hidden = false;
      }
      if (matchMedia("(max-width: 760px)").matches || event.detail === 0) {
        panel.querySelector("h3").focus({ preventScroll: true });
        panel.scrollIntoView({ block: "nearest" });
      }
    });
  }
}

function setup(root) {
  const node = id => root.querySelector("#wx-" + id);
  const slug = root.dataset.weatherPlace;
  const requestCache = new Map();
  const retryAfter = new Map();
  const units = new Intl.NumberFormat("lt-LT", { useGrouping: false, maximumFractionDigits: 1 });
  const dayText = new Intl.DateTimeFormat("lt-LT", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const weekday = new Intl.DateTimeFormat("lt-LT", { weekday: "long", timeZone: "UTC" });
  const weekendDateText = new Intl.DateTimeFormat("lt-LT", { month: "long", day: "numeric", timeZone: "UTC" });
  const stampText = new Intl.DateTimeFormat("lt-LT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Vilnius" });
  const hourText = new Intl.DateTimeFormat("lt-LT", { timeZone: "Europe/Vilnius", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const forecastSources = new Map([
    ["MET Norway", "/oru-saltiniai/#met-norway"],
    ["LHMT / Meteo LT", "/oru-saltiniai/#lhmt"],
  ]);
  const localDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vilnius", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const period = Number(root.querySelector(".wx-periods [aria-current=page]")?.dataset.days) || 5;
  const weekendButtons = [...root.querySelectorAll("[data-weekend]")];
  const weekendSummary = node("weekend-summary");
  const weekendIntro = weekendSummary?.textContent;
  const initialWeekend = node("weekend-status").textContent;
  const calculatedSun = node("calculated-sun");
  const periodShortcuts = root.querySelectorAll("[data-period-shortcut]");
  let forecast;
  let weekend = 0;
  let forecastUnavailable = false;

  const html = (tag, text, className) => {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = text;
    if (className) result.className = className;
    return result;
  };

  const measure = (value, unit = "") => Number.isFinite(value) ? units.format(value) + (unit ? " " + unit : "") : "–";
  const wind = value => Number.isFinite(value) ? measure(value / 3.6, "m/s") : "–";
  const formatDay = value => dayText.format(new Date(value + "T12:00:00Z"));
  function weatherIcon(code) {
    return weatherSymbol("wx-sky-" + condition(code), "wx-condition-icon", "");
  }

  function weatherSymbol(id, className, source = "/assets/visuals/weather-atlas-icons.svg", viewBox = "0 0 64 64") {
    const namespace = "http://www.w3.org/2000/svg";
    const icon = document.createElementNS(namespace, "svg");
    icon.setAttribute("class", className);
    icon.setAttribute("viewBox", viewBox);
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("focusable", "false");
    const use = document.createElementNS(namespace, "use");
    use.setAttribute("href", source + "#" + id);
    icon.append(use);
    return icon;
  }

  const currentDate = () => localDay.format(new Date());
  const requestKey = (endpoint, segment = "") => `${endpoint}/${segment}/${currentDate()}`;

  function request(endpoint, segment, retry = false) {
    const key = requestKey(endpoint, segment);
    const cached = requestCache.get(key);
    if (cached && (cached.expires === Infinity || (!retry && cached.expires > Date.now()))) return cached.promise;
    const query = new URLSearchParams({ vieta: slug });
    if (segment) query.set("dalis", segment);
    const entry = { expires: Infinity };
    const timeout = endpoint === "oru-prognoze" && !segment ? 22_000 : 13_000;
    entry.promise = fetch("/api/" + endpoint + "?" + query, { cache: "no-cache", signal: AbortSignal.timeout(timeout) })
      .then(async response => {
        if (!response.ok) {
          const seconds = Number(response.headers.get("Retry-After")) || 180;
          retryAfter.set(key, Date.now() + seconds * 1000);
          throw Error("Duomenys nepasiekiami");
        }
        const data = await response.json();
        const cacheSeconds = Number(response.headers.get("Cache-Control")?.match(/\bmax-age=(\d+)/)?.[1]);
        const defaultSeconds = data.cacheSeconds ?? (segment ? 21600 : endpoint === "keliu-orai" ? 180 : 1200);
        entry.expires = Date.now() + 1000 * Math.max(30, Number.isFinite(cacheSeconds) ? cacheSeconds : defaultSeconds);
        retryAfter.delete(key);
        return data;
      }).catch(error => {
        requestCache.delete(key);
        if (!retryAfter.has(key)) retryAfter.set(key, Date.now() + 180_000);
        throw error;
      });
    requestCache.set(key, entry);
    return entry.promise;
  }

  function refreshDue(endpoint, segment = "") {
    const key = requestKey(endpoint, segment);
    return (requestCache.get(key)?.expires || 0) <= Date.now() && (retryAfter.get(key) || 0) <= Date.now();
  }

  function metric(name, value) {
    const item = html("div");
    item.append(html("dt", name), html("dd", value));
    return item;
  }

  function writeMetrics(current, today) {
    const bearing = current.windspeed !== 0 && Number.isFinite(current.winddir) ? (current.winddir % 360 + 360) % 360 : null;
    const directions = ["šiaurės", "šiaurės rytų", "rytų", "pietryčių", "pietų", "pietvakarių", "vakarų", "šiaurės vakarų"];
    const from = bearing === null ? "" : "Iš " + directions[Math.round(bearing / 45) % directions.length];
    const sunrise = today.sunrise?.slice(0, 5);
    const sunset = today.sunset?.slice(0, 5);
    const minutes = clock => {
      if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clock)) return NaN;
      const [hour, minute] = clock.split(":").map(Number);
      return hour * 60 + minute;
    };
    const daylight = minutes(sunset) - minutes(sunrise);
    const panels = [
      ["wind", "Vėjas", [["Greitis", wind(current.windspeed)], ["Gūsiai", wind(current.windgust)], ["Kryptis", from]]],
      ["pressure", "Oro slėgis", [["Slėgis", measure(current.pressure, "hPa")]]],
      ["moisture", "Oro drėgnis", [["Santykinis drėgnis", measure(current.humidity, "%")], ["Rasos taškas", measure(current.dew, "°C")]]],
      ["sky", "Dangaus sąlygos", [["Debesuotumas", measure(current.cloudcover, "%")], ["Matomumas", measure(current.visibility, "km")], ["UV indeksas", measure(current.uvindex)]]],
      ["rain", "Krituliai šiandien", [["Tikimybė", measure(today.precipprob, "%")], ["Paros kiekis", measure(today.precip, "mm")]]],
      ["daylight", "Dienos šviesa", [
        ["Saulėtekis", Number.isFinite(minutes(sunrise)) ? sunrise : ""],
        ["Saulėlydis", Number.isFinite(minutes(sunset)) ? sunset : ""],
        ["Dienos trukmė", daylight > 0 ? Math.floor(daylight / 60) + " val. " + daylight % 60 + " min." : ""],
      ]],
    ];
    const cards = [];
    for (const [kind, label, rows] of panels) {
      const values = rows.filter(([, value]) => value && value !== "–");
      if (!values.length) continue;
      const card = html("article", undefined, "wx-instrument");
      card.dataset.instrument = kind;
      const title = html("h3", label);
      const visual = html("div", undefined, "wx-instrument__visual");
      visual.setAttribute("aria-hidden", "true");
      visual.append(weatherSymbol("wx-inst-" + kind, "wx-instrument__art", "", "0 0 148 108"));
      if (kind === "wind" && bearing !== null) {
        const compass = html("div", undefined, "wx-instrument__compass");
        compass.style.setProperty("--bearing", bearing + "deg");
        for (const label of ["Š", "R", "P", "V"]) compass.append(html("span", label));
        visual.append(compass);
      }
      const reading = html("dl", undefined, "wx-instrument__readings");
      reading.append(...values.map(([name, value]) => metric(name, value)));
      card.append(title, visual, reading);
      cards.push(card);
    }
    if (!(daylight > 0) && calculatedSun?.dataset.date === currentDate()) cards.push(calculatedSun);
    node("metrics").replaceChildren(...cards);
    const status = node("readings-status");
    status.hidden = cards.length > 0;
    status.textContent = cards.length ? "" : "Šiuo metu orų rodiklių nėra.";
  }

  function writeCurrent(previous = false) {
    const current = currentReading(forecast, Date.now()) || {};
    const today = dayAt(forecast, Date.now()) || {};
    const currentTime = Number.isFinite(current.datetimeEpoch) ? new Date(current.datetimeEpoch * 1000) : null;
    const timestamp = currentTime && stampText.format(currentTime);
    const timeLabel = (previous ? "Ankstesni duomenys · " : "") + readingSource(current) + " ";
    const initial = Number(node("live-reading").dataset.initial) > Date.now();
    if (!initial) {
      node("live-reading").classList.add("wx-live__reading");
      node("live-reading").removeAttribute("data-initial");
      node("live-reading").textContent = Number.isFinite(current.temp) ? measure(current.temp, "°C") : "Dabartinės temperatūros nėra";
      node("live-detail").textContent = [label(current.icon), Number.isFinite(current.feelslike) ? "Pojūtis " + measure(current.feelslike, "°C") : ""].filter(Boolean).join(" · ");
      node("live-detail").hidden = false;
      node("timestamp").textContent = timestamp ? timeLabel + timestamp + " · " + forecast.source : "";
      node("timestamp").hidden = !timestamp;
      const scene = root.querySelector(".wx-live");
      scene.dataset.sky = condition(current.icon);
      scene.dataset.light = readingLight(current, forecast);
      node("live-icon").replaceChildren(...(current.icon ? [weatherIcon(current.icon)] : []));
      node("live-icon").hidden = !current.icon;
    }
    if (!hasPageDays()) node("brief-day").innerHTML = briefContents(dayBrief(forecast, Date.now()), "Šiandienos temperatūra", previous);
    writeProviderCredit();
    writeMetrics(current, today);
    if (rainData) updateDaylight();
  }

  function updateDaylight() {
    const panel = node("daylight");
    const point = {lat: Number(root.dataset.latitude), lon: Number(root.dataset.longitude)};
    const solarDays = withLocalSun(forecast, point, solarFor);
    const markup = daylightMarkup(solarDays, rainData);
    if (markup || !(Number(panel.dataset.initial) > Date.now())) panel.innerHTML = markup;
  }

  function writeProviderCredit() {
    const source = forecast?.source;
    const link = node("forecast-source");
    const url = forecastSources.get(source);
    link.hidden = !url;
    if (url) {
      link.href = url;
      link.textContent = "Valandiniai orai · " + source;
    }
  }

  function drawChart(days) {
    const chart = node("chart");
    chart.replaceChildren();
    chart.hidden = true;
    const values = days.flatMap(day => [day.tempmin, day.tempmax]).filter(Number.isFinite);
    node("chart-details").hidden = days.length < 2 || !values.length;
    if (node("chart-details").hidden) return;
    const min = Math.min(...values) - 2;
    const max = Math.max(...values) + 2;
    const y = value => (131 - (value - min) / (max - min) * 97).toFixed(1);
    const x = index => (50 + index / (days.length - 1) * 490).toFixed(1);
    const svg = (tag, attrs, text) => {
      const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
      for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
      if (text !== undefined) element.textContent = text;
      return element;
    };
    const element = svg("svg", { viewBox: "0 0 560 174", role: "img", "aria-label": "Minimali ir maksimali temperatūra pagal dienas" });
    for (const value of [Math.round(min), Math.round((min + max) / 2), Math.round(max)]) {
      element.append(svg("line", { x1: 50, x2: 540, y1: y(value), y2: y(value), class: "wx-chart-grid" }));
      element.append(svg("text", { x: 40, y: Number(y(value)) + 5, "text-anchor": "end" }, value + "°"));
    }
    for (const [field, style] of [["tempmin", "min"], ["tempmax", "max"]]) {
      const points = days.flatMap((day, index) => Number.isFinite(day[field]) ? [x(index) + "," + y(day[field])] : []);
      element.append(svg("polyline", { points: points.join(" "), class: "wx-chart-" + style }));
    }
    for (const index of new Set([0, Math.floor(days.length / 2), days.length - 1])) {
      const anchor = index === 0 ? "start" : index === days.length - 1 ? "end" : "middle";
      element.append(svg("text", { x: x(index), y: 162, "text-anchor": anchor }, formatDay(days[index].datetime)));
    }
    const legend = html("p", undefined, "wx-chart-legend");
    legend.append(html("span", "Aukščiausia", "wx-chart-legend__max"), html("span", "Žemiausia", "wx-chart-legend__min"));
    chart.append(legend, element);
    chart.hidden = false;
  }

  function localDate(offset = 0, origin = localDay.format(new Date())) {
    const date = new Date(origin + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + offset);
    return date;
  }

  function rangeDates(today, start, end) {
    return Array.from({ length: end - start + 1 }, (_, index) =>
      localDate(start + index, today).toISOString().slice(0, 10));
  }

  function dayName(date) {
    const name = weekday.format(new Date(date + "T12:00:00Z"));
    return name[0].toLocaleUpperCase("lt") + name.slice(1);
  }

  function openHourly(day) {

    const select = node("hour-day");
    if (![...select.options].some(option => option.value === day.datetime)) return;
    select.value = day.datetime;
    select.onchange();
    select.scrollIntoView({ block: "center", behavior: "instant" });
    select.focus({ preventScroll: true });
  }

  function dayPanel(day, heading, kind = "forecast") {
    const weekendDay = kind === "weekend";
    const card = html("article", undefined, weekendDay ? "wx-weekend__day" : "wx-day");
    const scene = html("div", undefined, "wx-card-sky");
    scene.dataset.sky = day.icon ? condition(day.icon) : "unknown";
    const date = new Date(day.datetime + "T12:00:00Z");
    const when = html("time", weekendDateText.format(date));
    when.dateTime = day.datetime;
    const title = html("div", undefined, "wx-card-title");
    title.append(html("h3", heading), when);
    const conditionRow = html("div", undefined, "wx-card-condition");
    if (day.icon) conditionRow.append(weatherIcon(day.icon));
    conditionRow.append(html("span", label(day.icon)));
    scene.append(title, conditionRow);
    const content = html("div", undefined, "wx-card-body");
    const temps = html("dl", undefined, "wx-card-temps");
    temps.append(metric("Aukščiausia", measure(day.tempmax, "°C")), metric("Žemiausia", measure(day.tempmin, "°C")));
    const hours = day.hours || [];
    const metrics = html("dl", undefined, "wx-card-metrics wx-weekend__metrics");
    metrics.append(metric("Krituliai", measure(day.precip, "mm")));
    const gust = day.windgust ?? Math.max(...hours.map(hour => hour.windgust).filter(Number.isFinite));
    metrics.append(metric("Vėjo gūsiai", wind(gust)));
    content.append(temps, metrics);
    if (hours.length) {
      const more = html("button", undefined, "wx-action wx-day__hours");
      more.type = "button";
      more.setAttribute("aria-label", (weekendDay ? "Valandinė savaitgalio prognozė, " : "Valandinė prognozė, ") + formatDay(day.datetime));
      const end = html("span", undefined, "wx-action__end");
      end.append(weatherSymbol("action-down", "wx-action-icon", undefined, "0 0 24 24"));
      more.append(html("span", "Pagal valandas", "wx-action__label"), end);
      more.addEventListener("click", () => openHourly(day));
      content.append(more);
    }
    card.append(scene, content);
    return card;
  }

  const weekendConditions = {
    sun: "bus giedra", moon: "bus giedra", part: "bus mažai debesuota", "part-night": "bus mažai debesuota",
    cloud: "bus debesuota", rain: "numatomas lietus", snow: "numatomas sniegas", sleet: "numatoma šlapdriba",
    fog: "galimas rūkas", thunder: "galima perkūnija", wind: "bus vėjuota",
  };
  function updateWeekendSummary(days, dates) {
    if (!weekendSummary) return;
    const [saturday, sunday] = days;
    const phrases = days.map(day => {
      if (day?.icon) return weekendConditions[condition(day.icon)];
      return Number.isFinite(day?.tempmax) ? "temperatūra sieks iki " + measure(day.tempmax, "°C") : "";
    });
    if (!phrases.some(Boolean)) {
      if (weekendSummary.textContent !== weekendIntro) weekendSummary.textContent = weekendIntro;
      return;
    }
    const [start, end] = dates.map(date => new Date(date + "T12:00:00Z"));
    const interval = weekendDateText.formatRange(start, end).replace(/\s*d\.$/, "") + "\u00a0d.";
    const title = (weekend ? "Kitas savaitgalis" : "Artimiausias savaitgalis") + weekendSummary.dataset.location + " · " + interval;
    const [onSaturday, onSunday] = phrases;
    const outlook = onSaturday && onSaturday === onSunday ? "Abiem dienomis " + onSaturday :
      [onSaturday && "Šeštadienį " + onSaturday, onSunday && "sekmadienį " + onSunday].filter(Boolean).join(", o ");
    let plan = "Žemiau rasite kiekvienos dienos rodmenis.";
    if (Number.isFinite(saturday?.precip) && Number.isFinite(sunday?.precip) && saturday.precip !== sunday.precip) {
      const drier = saturday.precip < sunday.precip ? "šeštadienį" : "sekmadienį";
      plan = "Mažiau kritulių numatoma " + drier + ".";
    } else if (days.every(day => day?.hours?.length)) {
      plan = "Išvykai pasirinkite tinkamą laiką pagal valandinę prognozę.";
    }
    const copy = outlook.charAt(0).toLocaleUpperCase("lt") + outlook.slice(1) + ". " + plan;
    if (weekendSummary.textContent !== title + " " + copy) {
      weekendSummary.replaceChildren(html("strong", title), " " + copy);
    }
  }

  function renderWeekend() {
    for (const button of weekendButtons) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.weekend) === weekend));
    }
    const status = node("weekend-status");
    if (!forecast && !weekend && status.dataset.initialDate === currentDate()) {
      status.hidden = false;
      status.textContent = initialWeekend;
      weekendSummary.textContent = weekendIntro;
      node("weekend-days").replaceChildren();
      return;
    }
    const first = (6 - localDate().getUTCDay()) + 7 * weekend;
    const dates = [first, first + 1].map(offset => localDate(offset).toISOString().slice(0, 10));
    const days = dates.map(date => forecast?.days.find(day => day.datetime === date));
    updateWeekendSummary(days, dates);
    node("weekend-status").textContent = forecastUnavailable ?
      (days.some(Boolean) ? "Rodoma paskutinė gauta savaitgalio prognozė." : "Savaitgalio prognozė šiuo metu nepasiekiama.") :
      !forecast ? "Įkeliama savaitgalio prognozė…" :
      days.every(Boolean) ? "" : "Kai kurioms dienoms šaltinis dar nepateikia prognozės.";
    if (days.some(Boolean)) {
      const status = node("weekend-status");
      status.textContent = [status.textContent, forecast?.source].filter(Boolean).join(" · ");
    }
    node("weekend-status").hidden = !node("weekend-status").textContent;
    const cards = dates.map((date, index) => {
      const heading = index ? "Sekmadienis" : "Šeštadienis";
      if (days[index]) return dayPanel(days[index], heading, "weekend");
      const card = html("article", undefined, "wx-weekend__empty");
      card.append(html("h3", heading), html("time", weekendDateText.format(new Date(date + "T12:00:00Z"))),
        html("p", !forecast && !forecastUnavailable ? "Laukiama duomenų…" : "Prognozė dar nepateikta.", "wx-message"));
      card.querySelector("time").dateTime = date;
      return card;
    });
    node("weekend-days").replaceChildren(...cards);
  }

  function showDays(days, today) {
    const tomorrow = localDate(1, today).toISOString().slice(0, 10);
    const list = days.map(day => {
      const heading = day.datetime === today ? "Šiandien" : day.datetime === tomorrow ? "Rytoj" : dayName(day.datetime);
      return dayPanel(day, heading);
    });
    forecastCards.replaceChildren(...list);
  }

  const forecastCards = node("days");
  const hasPageDays = () => forecastCards.dataset.date === currentDate() && Number(forecastCards.dataset.count) > 0;
  forecastCards.addEventListener("click", event => {
    const button = event.target.closest("button[data-hour-date]");
    const day = button && forecast?.days.find(d => d.datetime === button.dataset.hourDate && d.hours?.length);
    if (day) openHourly(day);
  });

  function showHours(container, rows, headers, road = false) {
    const table = html("table");
    const header = table.createTHead().insertRow();
    for (const title of headers) {
      const cell = html("th", title);
      cell.scope = "col";
      header.append(cell);
    }
    const body = table.createTBody();
    for (const hour of rows) {
      const tr = body.insertRow();
      const time = html("th", hour.datetime?.slice(0, 5) || "–");
      time.scope = "row";
      const values = road ? [measure(hour.temp, "°C"), measure(hour.precip, "mm"), wind(hour.windgust), measure(hour.visibility, "km")] :
        [label(hour.icon), measure(hour.temp, "°C"), measure(hour.feelslike, "°C"), measure(hour.precip, "mm"), wind(hour.windspeed), measure(hour.humidity, "%")];
      tr.append(time, ...values.map(value => html("td", value)));
    }
    container.replaceChildren(table);
  }

  const rail = node("next-hours");
  const railButtons = [...root.querySelectorAll("[data-hour-scroll]")];
  let chosenHour, chosenDate;
  function updateRailControls() {
    for (const button of railButtons) {
      button.disabled = Number(button.dataset.hourScroll) < 0 ? rail.scrollLeft < 2 :
        rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2;
    }
  }
  for (const button of railButtons) {
    button.addEventListener("click", () => rail.scrollBy({ left: Number(button.dataset.hourScroll) * rail.clientWidth * .8 }));
  }
  rail.addEventListener("scroll", updateRailControls, { passive: true });
  new ResizeObserver(updateRailControls).observe(rail);

  function showTimeline(day) {
    const hours = day.hours;
    const hourKey = hour => hour.datetimeEpoch ?? hour.datetime;
    let index = chosenDate === day.datetime ? hours.findIndex(hour => hourKey(hour) === chosenHour) : -1;
    if (index < 0 && day.datetime === localDay.format(new Date())) {
      index = hours.findIndex(hour => hour.datetimeEpoch >= Date.now() / 1000 - 1800);
      if (index < 0) index = hours.length - 1;
    }
    if (index < 0) index = 0;
    const select = (position, reveal = false) => {
      const hour = hours[position];
      chosenDate = day.datetime;
      chosenHour = hourKey(hour);
      for (const [i, tile] of [...rail.children].entries()) tile.setAttribute("aria-pressed", String(i === position));
      const headline = html("div", undefined, "wx-hourly__condition");
      const time = html("strong", hour.datetime.slice(0, 5) + " · " + label(hour.icon));
      if (hour.icon) headline.append(weatherIcon(hour.icon));
      headline.append(time);
      const measures = html("dl", undefined, "wx-hourly__metrics");
      measures.append(metric("Temperatūra", measure(hour.temp, "°C")), metric("Pojūtis", measure(hour.feelslike, "°C")),
        metric("Krituliai", measure(hour.precip, "mm")), metric("Vėjas", wind(hour.windspeed)), metric("Drėgmė", measure(hour.humidity, "%")));
      node("hour-reading").replaceChildren(headline, measures);
      if (reveal && rail.clientWidth) {
        const tile = rail.children[position];
        const inset = parseFloat(getComputedStyle(rail).paddingInlineStart);
        rail.scrollLeft += tile.getBoundingClientRect().left - rail.getBoundingClientRect().left - inset;
      }
      updateRailControls();
    };
    rail.replaceChildren(...hours.map((hour, i) => {
      const clock = hour.datetime.slice(0, 5);
      const tile = html("button", undefined, "wx-next__hour");
      tile.type = "button";
      tile.setAttribute("aria-label", [clock, label(hour.icon), measure(hour.temp, "°C")].join(", "));
      tile.append(html("time", clock));
      if (hour.icon) tile.append(weatherIcon(hour.icon));
      tile.append(html("strong", measure(hour.temp, "°")));
      tile.addEventListener("click", () => select(i));
      return tile;
    }));
    select(index, true);
  }

  function showHourly(days) {
    const selector = node("hour-day");
    const previous = selector.value;
    const dates = days.filter(day => day.hours?.length);
    selector.replaceChildren(...dates.map(day => {
      const entry = html("option", formatDay(day.datetime));
      entry.value = day.datetime;
      return entry;
    }));
    if (dates.some(day => day.datetime === previous)) selector.value = previous;
    selector.onchange = () => {
      const current = dates.find(day => day.datetime === selector.value);
      showTimeline(current);
      showHours(node("hours"), current.hours, ["Laikas", "Sąlygos", "Temperatūra", "Pojūtis", "Krituliai", "Vėjas", "Drėgmė"]);
    };
    selector.closest("section").hidden = !dates.length;
    if (dates.length) selector.onchange();
  }

  function showRoadHours() {
    const now = Date.now() / 1000;
    const hours = forecast.days.flatMap(day => day.hours || []).filter(hour => hour.datetimeEpoch >= now - 1800).slice(0, 12);
    const region = node("road-hours");
    region.closest("section").hidden = !hours.length;
    if (hours.length) showHours(region, hours, ["Laikas", "Oras", "Krituliai", "Vėjo gūsiai", "Matomumas"], true);
  }

  let rainData, rainHour, selectedRainTime;
  let rainRefreshFailed = false;
  const hourMs = 3_600_000;
  function precipitationType(symbol = "") {
    if (symbol.includes("sleet")) return "Šlapdriba";
    if (symbol.includes("snow")) return "Sniegas";
    if (symbol.includes("rain")) return "Lietus";
    return "Krituliai";
  }
  function renderRain() {
    if (!rainData) return;
    updateDaylight();
    const brief = rainBrief(rainData, Date.now());
    node("brief-rain").innerHTML = briefContents(brief, "Krituliai per 12 val.", rainRefreshFailed);
    rainHour = Math.floor(Date.now() / hourMs) * hourMs;
    const slots = Array.from({ length: 12 }, (_, i) => {
      const time = rainHour + i * hourMs;
      return rainData.slots.find(slot => slot.time === time) || { time, mm: null };
    });
    const known = slots.filter(slot => Number.isFinite(slot.mm));
    const wet = known.filter(slot => slot.mm > 0);
    const total = known.reduce((sum, slot) => sum + slot.mm, 0);
    const labels = slots.map(slot => hourText.format(slot.time));
    const localClock = time => {
      const clock = hourText.format(time);
      if (labels.indexOf(clock) === labels.lastIndexOf(clock)) return clock;
      return new Intl.DateTimeFormat("lt", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vilnius", timeZoneName: "shortOffset" }).format(time);
    };
    const periodText = (start, end) => localClock(start) + "–" + localClock(end);
    let headline = known.length === 12 ? "Prognozuojamas kritulių kiekis – 0 mm." : known.length ? "Žinomomis valandomis prognozuojama 0 mm. Likusių valandų duomenų nėra." : "Šiam laikotarpiui kritulių prognozė dar nepateikta.";
    let summary = "";
    let shortcut = known.length === 12 ? "12 val. prognozė · 0 mm" : "Kritulių prognozė";
    if (wet.length) {
      const first = slots.indexOf(wet[0]);
      let end = first + 1;
      while (end < slots.length && slots[end].mm > 0) end++;
      const kinds = new Set(slots.slice(first, end).map(slot => precipitationType(slot.symbol)));
      const type = kinds.size === 1 ? [...kinds][0] : "Krituliai";
      const when = periodText(slots[first].time, slots[end - 1].time + hourMs);
      const outlook = { Lietus: "numatomas lietus", Sniegas: "numatomas sniegas", Šlapdriba: "numatoma šlapdriba", Krituliai: "numatomi krituliai" };
      headline = when + " val. " + outlook[type] + ".";
      shortcut = type + " · " + when;
      summary = `Valandų su krituliais: ${wet.length} iš ${known.length}. Bendras prognozuojamas kiekis – ${measure(total, "mm")}.`;
    }
    if (wet.length > 1) {
      const peak = wet.reduce((largest, slot) => slot.mm > largest.mm ? slot : largest);
      summary += " Didžiausias valandinis kiekis · " + measure(peak.mm, "mm") + " (" + periodText(peak.time, peak.time + hourMs) + ").";
    }
    if (known.length < 12 && known.length) summary += ` Turimi ${known.length} iš 12 valandų duomenys.`;
    node("rain-summary").replaceChildren(html("strong", headline), summary.trim());
    node("rain-shortcut").querySelector(".wx-action__label").textContent = shortcut;
    const container = node("rain-bars");
    const choose = slot => {
      selectedRainTime = slot.time;
      for (const button of container.children) button.setAttribute("aria-pressed", String(Number(button.value) === slot.time));
      const text = !Number.isFinite(slot.mm) ? "Duomenų nėra" : slot.mm > 0 ? precipitationType(slot.symbol) : "Modelio prognozuojamas kiekis";
      const detail = node("rain-detail");
      detail.textContent = [periodText(slot.time, slot.time + hourMs), text, Number.isFinite(slot.mm) ? measure(slot.mm, "mm") : "",
        Number.isFinite(slot.chance) ? "Kritulių tikimybė " + measure(slot.chance, "%") : "",
        Number.isFinite(slot.min) && Number.isFinite(slot.max) && slot.max > slot.min ? "Tikėtinas kiekis " + measure(slot.min) + "–" + measure(slot.max, "mm") : "",
        slot.thunder > 0 ? "Perkūnijos tikimybė " + measure(slot.thunder, "%") : ""].filter(Boolean).join(" · ");
      detail.hidden = false;
    };
    container.replaceChildren(...slots.map(slot => {
      const available = Number.isFinite(slot.mm);
      const type = slot.mm > 0 ? precipitationType(slot.symbol) : "";
      const amount = available ? measure(slot.mm, "mm") : "–";
      const button = html("button", undefined, "wx-rain-slot");
      button.type = "button";
      button.value = slot.time;
      button.setAttribute("aria-label", [localClock(slot.time), type, available ? amount : "Duomenų nėra"].filter(Boolean).join(" · "));
      button.dataset.wet = String(Boolean(type));
      button.dataset.known = String(available);
      const mark = html("span", undefined, "wx-rain-mark");
      mark.setAttribute("aria-hidden", "true");
      if (type) {
        // Fixed amounts keep the marks comparable when the forecast updates.
        const count = 1 + Number(slot.mm >= 1) + Number(slot.mm >= 3);
        const symbol = type === "Sniegas" ? "precipitation-flake" : "precipitation-drop";
        for (let i = 0; i < count; i++) mark.append(weatherSymbol(symbol, "wx-rain-glyph"));
        if (type === "Šlapdriba") mark.append(weatherSymbol("precipitation-flake", "wx-rain-sleet"));
      } else if (!available) {
        mark.textContent = "?";
      }
      button.append(html("strong", hourText.format(slot.time)), mark, html("small", amount));
      button.addEventListener("click", () => choose(slot));
      return button;
    }));
    choose(slots.find(slot => slot.time === selectedRainTime) || wet[0] || slots[0]);
    const status = node("rain-status");
    status.hidden = !rainRefreshFailed;
    status.textContent = rainRefreshFailed ? "Nepavyko atnaujinti. Rodoma paskutinė gauta prognozė." : "";
  }

  async function loadRain() {
    const date = currentDate();
    try {
      const data = await request("oru-prognoze", "krituliai");
      if (date !== currentDate()) return;
      if (!Array.isArray(data.slots)) throw Error("No hourly periods");
      rainData = data;
      rainRefreshFailed = false;
    } catch {
      if (date !== currentDate()) return;
      rainRefreshFailed = true;
      if (!rainData) {
        const summary = node("rain-summary");
        if (Number(summary.dataset.initial) > Date.now()) {
          node("rain-status").textContent = "Nepavyko atnaujinti. Rodoma paskutinė gauta prognozė.";
          node("rain-status").hidden = false;
        } else {
          summary.textContent = "Valandiniai kritulių duomenys šiuo metu nepasiekiami. Kritulių judėjimą galite patikrinti radare.";
          node("brief-rain").innerHTML = briefContents(null, "Krituliai per 12 val.");
          node("rain-status").hidden = true;
        }
      }
    }
    renderRain();
  }

  const environment = root.querySelector("#oro-kokybe");
  let environmentActive = false;
  let environmentData, environmentHour;
  const airBands = ["Gera", "Patenkinama", "Vidutinė", "Prasta", "Labai prasta", "Ypač prasta"];
  const exposureFields = {
    air: { pm25: "Kietosios dalelės (KD₂,₅)", pm10: "Kietosios dalelės (KD₁₀)", no2: "Azoto dioksidas (NO₂)", o3: "Ozonas (O₃)", so2: "Sieros dioksidas (SO₂)" },
    pollen: { alder: "Alksnis", birch: "Beržas", grass: "Migliniai", mugwort: "Kietis", ragweed: "Ambrozija", olive: "Alyvmedis" },
  };

  function renderEnvironment() {
    if (!environmentData) return;
    environmentHour = Math.floor(Date.now() / hourMs) * hourMs;
    for (const kind of ["air", "pollen"]) {
      const current = environmentData[kind].find(row => row.time === environmentHour);
      const lead = node(kind + "-level");
      const band = kind === "air" && Number.isInteger(current?.level) && airBands[current.level];
      const entries = Object.entries(exposureFields[kind]);
      const unit = kind === "air" ? "µg/m³" : "žiedad./m³";
      const valueText = value => value > 0 && value < .1 ? "<0,1 " + unit : measure(value, unit);
      const count = entries.filter(([key]) => Number.isFinite(current?.values?.[key])).length;
      if (!count) lead.textContent = "Šiai valandai duomenų nėra";
      else if (kind === "air") lead.textContent = band || "Vertinimui trūksta teršalų duomenų";
      else if (count < entries.length) lead.textContent = "Augalų grupės · " + count + " iš " + entries.length;
      else {
        const peak = Math.max(...entries.map(([key]) => current.values[key]));
        lead.textContent = peak < .1 ? "Visos grupės · " + valueText(peak) : "Didžiausia koncentracija · " + valueText(peak);
      }
      lead.dataset.level = band ? current.level : "";
      const timestamp = node(kind + "-time");
      timestamp.hidden = !count;
      if (count) {
        timestamp.dateTime = new Date(current.time).toISOString();
        timestamp.textContent = "Prognozės valanda Lietuvoje · " + stampText.format(current.time);
      }
      node(kind + "-values").replaceChildren(...(count ? entries.map(([key, label]) => {
        const value = current.values[key];
        return metric(label, Number.isFinite(value) ? valueText(value) : "Duomenų nėra");
      }) : []));
      node(kind + "-details").hidden = !count;
    }
  }

  async function loadEnvironment() {
    const date = currentDate();
    const status = node("environment-status");
    try {
      const data = await request("oru-prognoze", "aplinka");
      if (date !== currentDate()) return;
      if (data.source !== "CAMS" || !Array.isArray(data.air) || !Array.isArray(data.pollen)) {
        throw new Error("Missing CAMS forecast");
      }
      environmentData = data;
      status.textContent = "";
    } catch {
      if (date !== currentDate()) return;
      if (!environmentData) {
        for (const kind of ["air", "pollen"]) node(kind + "-level").textContent = "Duomenys nepasiekiami";
      }
      status.textContent = "Nepavyko gauti naujausių CAMS duomenų.";
    }
    status.hidden = !status.textContent;
    renderEnvironment();
  }

  if (environment) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      environmentActive = true;
      void loadEnvironment();
    }, { rootMargin: "280px" });
    observer.observe(environment);
  }

  function setForecastPeriod() {
    for (const link of periodShortcuts) {
      if (Number(link.dataset.periodShortcut) === period) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
    const today = currentDate();
    const openDays = (forecast?.days || []).filter(day => day.datetime >= today);
    const cap = Math.min(15, period);
    const end = rangeDates(today, 0, cap - 1).at(-1);
    const dates = openDays.filter(day => day.datetime <= end);
    if (!hasPageDays() && forecast) {
      showDays(dates, today);
      const status = node("forecast-status");
      status.textContent = dates.length < cap ? `Prognozė pateikta ${dates.length} iš ${cap} dienų.` : "";
      status.hidden = !status.textContent;
    }
    for (const button of forecastCards.querySelectorAll("[data-hour-date]")) {
      button.hidden = !openDays.some(day => day.datetime === button.dataset.hourDate && day.hours?.length);
    }
    drawChart(dates);
    showHourly(openDays);
    node("hourly-link").hidden = !openDays.some(day => day.hours?.length);
    node("climate-link").hidden = period <= 15;
    if (period > 15) node("climate-link").querySelector(".wx-action__label").textContent = `16–${period} d. klimato orientyrai`;
    node("days-link").hidden = period <= 15;
  }

  async function loadForecast(background = false) {
    const date = currentDate();
    const retry = root.querySelector('[data-wx-retry="forecast"]');
    retry.hidden = true;
    if (!forecast && !background && !node("live-reading").hasAttribute("data-initial")) {
      node("live-reading").textContent = "Įkeliami naujausi duomenys…";
      if (!hasPageDays()) node("forecast-status").textContent = "Įkeliama prognozė…";
    }
    try {
      const data = await request("oru-prognoze");
      if (date !== currentDate()) return;
      forecast = data;
      forecastUnavailable = false;
      writeCurrent();
      renderWeekend();
      setForecastPeriod();
      showRoadHours();
    } catch {
      if (date !== currentDate()) return;
      forecastUnavailable = true;
      renderWeekend();
      const reading = node("live-reading");
      if (forecast) {
        writeCurrent(true);
      } else if (!(Number(reading.dataset.initial) > Date.now())) {
        reading.textContent = "Orų duomenys šiuo metu nepasiekiami.";
        node("timestamp").hidden = true;
        node("live-detail").hidden = true;
        node("live-icon").hidden = true;
      } else if (!node("timestamp").textContent.includes("Nepavyko atnaujinti")) {
        node("timestamp").hidden = false;
        node("timestamp").textContent += " · Nepavyko atnaujinti";
      }
      if (!forecast && !hasPageDays()) node("brief-day").innerHTML = briefContents(null, "Šiandienos temperatūra");
      if (!forecast) {
        const dayStillCurrent = calculatedSun?.dataset.date === date;
        if (calculatedSun) calculatedSun.hidden = !dayStillCurrent;
        if (!(Number(reading.dataset.initial) > Date.now())) node("readings-status").textContent = dayStillCurrent ?
          "Saulės laikas apskaičiuotas pagal vietovės koordinates." : "Orų rodiklių šiuo metu nepavyksta įkelti.";
      }
      if (!hasPageDays()) node("forecast-status").textContent = forecast ?
        "Rodoma paskutinė gauta prognozė. Atnaujinti šiuo metu nepavyko." : "Prognozės šiuo metu nepavyksta įkelti.";
      setForecastPeriod();
      retry.hidden = false;
    }
  }

  function roadStationCard(station) {
    const card = html("article", undefined, "wx-station");
    const { name: stationName, route, officialName, kilometer, connection, point } = roadStationLabel(station);
    const heading = html("header", undefined, "wx-station__heading");
    if (route) heading.append(html("span", route, "wx-station__route"));
    const place = html("div", undefined, "wx-station__place");
    const name = html("h3", stationName);
    if (officialName && stationName !== officialName) name.title = officialName;
    const position = [connection, point, route && Number.isFinite(kilometer) ? units.format(kilometer) + "\u00a0km" : "",
      Number.isFinite(station.distance) ? "už\u00a0" + units.format(station.distance) + "\u00a0km" : ""].filter(Boolean);
    place.append(name);
    if (position.length) place.append(html("p", position.join(" · "), "wx-station__meta"));
    heading.append(place);

    const surface = typeof station.surface === "string" ? station.surface.trim() : "";
    const surfaceKey = surface.toLocaleLowerCase("lt");
    const surfaceBadge = html("p", surface || "Būklė nežinoma", "wx-station__surface");
    surfaceBadge.dataset.tone = { sausa: "dry", drėgna: "damp", šlapia: "wet", slidi: "caution", apledėjusi: "caution" }[surfaceKey] || "neutral";
    const readings = html("dl", undefined, "wx-station__readings");
    readings.append(metric("Dangos temp.", measure(station.surfaceTemp, "°C")),
      metric("Oro temp.", measure(station.air, "°C")),
      metric("Vėjo gūsiai", measure(station.gust, "m/s")),
      metric("Matomumas", measure(station.visibility, "m")));

    const instant = new Date(station.measured * 1000);
    const time = html("time");
    time.dateTime = instant.toISOString();
    time.append(html("strong", hourText.format(instant)), " ", html("span", localDay.format(instant)));
    const stamp = html("p", undefined, "wx-station__time");
    stamp.append(html("span", station.stale ? "Senesnis matavimas" : "Matuota"), time);
    if (station.stale) stamp.classList.add("wx-station__time--stale");
    card.append(heading, surfaceBadge, readings, stamp);

    const warnings = [...new Set(station.warnings)].filter(warning => {
      const condition = warning.trim().match(/^kelio dangos būklė\s*:\s*(.+?)\.?$/iu)?.[1];
      return !surface || condition?.toLocaleLowerCase("lt") !== surfaceKey;
    });
    if (warnings.length) {
      const list = html("ul", undefined, "wx-station__warnings");
      list.append(...warnings.map(warning => html("li", warning)));
      card.append(list);
    }
    return card;
  }

  let lastStations;
  async function loadRoads(background = false) {
    const date = currentDate();
    const status = node("road-status");
    const retry = root.querySelector('[data-wx-retry="roads"]');
    const cards = node("stations");
    if (!background && !cards.childElementCount && !status.dataset.initial) {
      status.hidden = false;
      status.textContent = "Ieškoma artimiausių stotelių…";
    }
    retry.hidden = true;
    try {
      const { stations, radiusKm } = await request("keliu-orai");
      if (date !== currentDate()) return;
      lastStations = stations;
      status.removeAttribute("data-initial");
      node("brief-road").innerHTML = briefContents(roadBrief({ stations }, Date.now()), "Kelio stotelė");
      status.textContent = stations.length ? "" : `Per ${radiusKm} km nėra naujų stotelių matavimų.`;
      status.hidden = stations.length > 0;
      cards.replaceChildren(...stations.map(roadStationCard));
    } catch {
      if (date !== currentDate()) return;
      status.hidden = false;
      if (lastStations) {
        const now = Date.now();
        const stations = lastStations.filter(s => now - s.measured * 1000 <= 21600000)
          .map(s => ({ ...s, stale: now - s.measured * 1000 > 5400000 }));
        cards.replaceChildren(...stations.map(roadStationCard));
        node("brief-road").innerHTML = briefContents(roadBrief({ stations }, now), "Kelio stotelė", true);
      }
      if (Number(status.dataset.initial) > Date.now()) {
        if (!status.textContent.includes("Nepavyko atnaujinti")) status.append(" · Nepavyko atnaujinti");
      } else {
        if (!cards.childElementCount) node("brief-road").innerHTML = briefContents(null, "Kelio stotelė");
        status.textContent = cards.childElementCount ?
          "Rodomi paskutiniai gauti stotelių duomenys. Atnaujinti šiuo metu nepavyko." :
          "Stotelių duomenys šiuo metu nepasiekiami. Naujausią informaciją rasite oficialiame eismo žemėlapyje.";
      }
      retry.hidden = false;
    }
  }

  for (const button of weekendButtons) {
    button.addEventListener("click", () => {
      weekend = Number(button.dataset.weekend);
      renderWeekend();
    });
  }
  root.querySelector('[data-wx-retry="forecast"]').addEventListener("click", () => { void loadForecast(); });
  root.querySelector('[data-wx-retry="roads"]').addEventListener("click", () => { void loadRoads(); });
  enableSearch(root.querySelector(".wx-search"));
  setForecastPeriod();
  renderWeekend();
  void loadForecast();
  void loadRoads();
  void loadRain();
  function refreshReadings() {
    if (document.hidden) return;
    if (refreshDue("oru-prognoze", "krituliai")) void loadRain();
    else if (rainData && rainHour !== Math.floor(Date.now() / hourMs) * hourMs) renderRain();
    if (environmentActive && refreshDue("oru-prognoze", "aplinka")) void loadEnvironment();
    else if (environmentData && environmentHour !== Math.floor(Date.now() / hourMs) * hourMs) renderEnvironment();
    if (refreshDue("oru-prognoze")) void loadForecast(true);
    if (refreshDue("keliu-orai")) void loadRoads(true);
  }
  setInterval(refreshReadings, 30_000);
  document.addEventListener("visibilitychange", refreshReadings);
}

function enableSearch(form) {
  const input = form.querySelector("input");
  const list = form.querySelector("ul");
  const state = form.querySelector("[role=status]");
  let generation = 0;
  let selected = 0;
  const fold = value => value.toLocaleLowerCase("lt-LT").normalize("NFD").replace(/\p{M}+/gu, "").replace(/[^a-z0-9]+/g, " ").trim();

  function load() {
    searchCatalogue ??= fetch(new URL("../data/weather-places.json", import.meta.url), { signal: AbortSignal.timeout(12000) })
      .then(response => {
        if (!response.ok) throw Error("Žinynas nepasiekiamas");
        return response.json();
      }).then(data => {
        const grouped = Map.groupBy(data.places, ([, name, district]) => district + ":" + name);
        const coordinate = new Intl.NumberFormat("lt-LT", { useGrouping: false, maximumFractionDigits: 4 });
        return [
        ...Object.values(data.municipalities).map(([slug, name, county]) => ({
          slug: "savivaldybes/" + slug, name, district: county, keys: [fold(name)], rank: 1,
        })),
          ...data.places.map(([slug, name, district, latitude, longitude, locative, solar, genitive, wardCode]) => {
            const peers = grouped.get(district + ":" + name);
            const districtName = data.municipalities[district][1];
            const wardName = data.wards?.[wardCode]?.[0];
            const base = fold(name.replace(/ (k\.|mstl\.|vs\.|glž\. st\.|st\.)$/, ""));
            const point = peers.length > 1 ? ` · ${coordinate.format(latitude)}° š. pl., ${coordinate.format(longitude)}° r. ilg.` : "";
            const register = peers.some(other => other[0] !== slug && other[3] === latitude && other[4] === longitude)
              ? " · AR " + slug.split("-").at(-1) : "";
            return {
              slug, name, district: [districtName, wardName].filter(Boolean).join(" · ") + point + register,
              keys: [base, fold(name), fold(locative), fold(genitive || ""), fold(slug),
                fold(name + " " + districtName), base + " " + fold(districtName),
                wardName && fold(name + " " + wardName), wardName && (base + " " + fold(wardName))].filter(Boolean),
              rank: solar ? 0 : 2,
            };
          }),
        ];
      }).catch(error => { searchCatalogue = undefined; throw error; });
    return searchCatalogue;
  }

  function matches(entry, term) {
    if (entry.keys.includes(term)) return entry.rank;
    if (entry.keys.some(key => key.startsWith(term))) return 3 + entry.rank;
    if (entry.keys.some(key => key.includes(term))) return 6 + entry.rank;
    return Infinity;
  }

  async function search() {
    const ticket = ++generation;
    const query = fold(input.value).replace(/\b(?:1|3|5|7|10|15|30|45|90)\s+(?:d|dienu|dienoms)\b/g, "")
      .replace(/\b(orai|oru|siandien|rytoj|weather|prognoze)\b/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
    list.hidden = true;
    list.replaceChildren();
    state.hidden = true;
    if (query.length < 2) return [];
    try {
      const all = await load();
      if (ticket !== generation) return [];
      const ranked = all.map(place => [place, matches(place, query)])
        .filter(([, score]) => Number.isFinite(score)).sort((a, b) => a[1] - b[1]);
      const best = (ranked[0]?.[1] < 3 ? ranked.filter(([, score]) => score < 3) : ranked)
        .slice(0, 12).map(([place]) => place);
      selected = 0;
      list.hidden = !best.length;
      state.hidden = Boolean(best.length);
      state.textContent = "Vietovė nerasta. Įveskite pirmąsias pavadinimo raides arba pasirinkite savivaldybę.";
      for (const place of best) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        const caption = document.createElement("small");
        a.href = "/orai/" + place.slug + "/";
        a.append(document.createTextNode(place.name));
        caption.textContent = place.district;
        a.append(caption);
        li.append(a);
        list.append(li);
      }
      return best;
    } catch {
      if (ticket !== generation) return [];
      state.hidden = false;
      state.textContent = "Vietovių žinynas šiuo metu nepasiekiamas.";
      return [];
    }
  }

  input.addEventListener("input", () => { void search(); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const existing = list.querySelectorAll("a");
    if (!list.hidden && existing.length === 1) location.assign(existing[0].href);
    else if (!list.hidden && existing.length > 1) existing[selected].focus();
    else {
      const results = await search();
      if (results.length === 1) location.assign("/orai/" + results[0].slug + "/");
      else list.querySelector("a")?.focus();
    }
  });
  form.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      list.hidden = true;
      input.focus();
    }
    if (list.hidden || !["ArrowDown", "ArrowUp"].includes(event.key)) return;
    const links = [...list.querySelectorAll("a")];
    if (!links.length) return;
    event.preventDefault();
    const current = links.indexOf(document.activeElement);
    selected = current < 0 ? (event.key === "ArrowDown" ? 0 : links.length - 1) :
      (current + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
    links[selected].focus();
  });
  document.addEventListener("pointerdown", event => {
    if (!form.contains(event.target)) list.hidden = true;
  });
  const initial = new URL(location.href).searchParams.get("vieta");
  if (initial && input.id === "wx-search-input") {
    input.value = initial.slice(0, 100);
    void search();
  }
}
