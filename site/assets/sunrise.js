import { solarFor, solarPositionAt } from "./phase-5-6-8-core.js";
import { buildSolarScene, svg } from "./shell/sunrise-scene.js";
import { today } from "./calendar.js";
import { dateAfter, daylightLabel as minutesLabel, solarWeek, sunClock as clock } from "./sunrise-readings.js";

const $ = (selector, root = document) => root.querySelector(selector);
const DAY = 86400000;
const pad = (value) => String(value).padStart(2, "0");
const parts = (date) => ({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)) });
const dayLabel = new Intl.DateTimeFormat("lt-LT", { timeZone: "UTC", weekday: "long", year: "numeric", month: "long", day: "numeric" });
const displayDate = (date) => dayLabel.format(new Date(`${date}T12:00:00Z`));
const degrees = new Intl.NumberFormat("lt-LT", { useGrouping: false, maximumFractionDigits: 1 });
const angleLabel = value => degrees.format(Math.abs(value) < .05 ? 0 : value) + "°";
const directions = ["šiaurė", "šiaurės rytai", "rytai", "pietryčiai", "pietūs", "pietvakariai", "vakarai", "šiaurės vakarai"];
const compass = value => directions[Math.round(value / 45) % 8];
const html = (tag, content, attrs = {}) => {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
};
const moments = {
  civilStart: "Aušra", sunrise: "Saulėtekis", noon: "Saulės vidurdienis",
  sunset: "Saulėlydis", civilEnd: "Civilinės prieblandos pabaiga",
};
const phaseLabel = { dawn: "Aušros prieblanda", morning: "Rytas", day: "Dienos šviesa", golden: "Prieš saulėlydį", dusk: "Vakaro prieblanda" };

function phaseFor(instant, times) {
  if (instant < times.sunrise) return phaseLabel.dawn;
  if (instant < times.sunrise + 3600000) return phaseLabel.morning;
  if (instant < times.sunset - 3600000) return phaseLabel.day;
  return instant < times.sunset ? phaseLabel.golden : phaseLabel.dusk;
}

function setupSun() {
  const root = $("#sun-tool");
  if (!root) return;
  const dateInput = $("#sun-date"), cityInput = $("#sun-city"), slider = $("#sun-scrubber");
  const weatherLink = $("[data-sun-weather-link]");
  const weatherSlugs = weatherLink ? JSON.parse(weatherLink.dataset.sunWeatherLink) : {};
  const play = $("#sun-play"), trajectory = $("#sun-trajectory"), host = $("#sun-scene");
  const errorBox = $("#sun-error"), eventButtons = [...root.querySelectorAll("[data-sun-moment]")];
  const display = {
    time: $("#sun-sim-time"), output: $("#sun-sim-output"), phase: $("#sun-sim-phase"),
    altitude: $("#sun-altitude"), azimuth: $("#sun-azimuth"), caption: $("#sun-scene-caption"),
  };
  const todayButton = $("#sun-today");
  for (const control of [dateInput, cityInput, todayButton]) control.disabled = false;
  const options = new Map([...cityInput.options].map(option => [option.value, option]));
  const cityPath = () => location.pathname.match(/^\/saule\/([a-z]+)\/?$/)?.[1];
  function readLocation() {
    const query = new URLSearchParams(location.search);
    const preferredCity = cityPath() || query.get("miestas");
    cityInput.value = options.has(preferredCity) ? preferredCity : "vilnius";
    dateInput.value = query.get("data") || today();
    if (!dateInput.value || !dateInput.validity.valid) dateInput.value = today();
  }
  readLocation();
  let frame = null;
  let yearCache;
  let scene;

  function stopPlayback() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    play.setAttribute("aria-pressed", "false");
    play.querySelector("span").textContent = "Paleisti animaciją";
    play.querySelector("path").setAttribute("d", "M8 5.5v13l10-6.5z");
  }

  function render(change) {
    stopPlayback();
    try {
      const date = dateInput.value, { year, month } = parts(date);
      if (!dateInput.validity.valid || !date) throw Error("Pasirinkite galiojančią datą nuo 2000 iki 2100 metų.");
      const option = cityInput.selectedOptions[0];
      const city = { id: option.value, name: option.textContent, lat: Number(option.dataset.lat), lon: Number(option.dataset.lon), place: option.dataset.locative };
      if (weatherLink) {
        const slug = weatherSlugs[city.id] || city.id;
        weatherLink.href = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? `/orai/${slug}/` : '/orai/';
        weatherLink.textContent = `Orai ${city.place}`;
      }
      const times = solarFor(date, city);
      if (Object.keys(moments).some(key => !Number.isFinite(times[key]))) throw Error("Nurodytai vietai ir datai Saulės laikų apskaičiuoti nepavyko.");
      const priorDelta = times.dayMinutes - solarFor(dateAfter(date, -1), city).dayMinutes;
      const tomorrowDelta = solarFor(dateAfter(date, 1), city).dayMinutes - times.dayMinutes;
      const todayChange = priorDelta === 0 ? "beveik nepasikeitė" : `${Math.abs(priorDelta)} min. ${priorDelta > 0 ? "ilgesnis" : "trumpesnis"}`;
      const tomorrowChange = tomorrowDelta === 0 ? "beveik nepasikeis" : `${Math.abs(tomorrowDelta)} min. ${tomorrowDelta > 0 ? "ilgės" : "trumpės"}`;
      $("#sun-day-change").textContent = `Palyginti su ankstesne diena, šviesus paros metas ${todayChange}; kitą dieną jis ${tomorrowChange}.`;
      const citySpecific = change === "city" || Boolean(cityPath()) || city.id !== "vilnius";
      const title = citySpecific ? `Saulėtekis ir saulėlydis ${city.place}` : "Saulėtekis ir saulėlydis";
      $("#sun-page-title").textContent = title;
      if (change === "city" || change === "history") {
        document.title = `${citySpecific ? title : "Saulėtekis, saulėlydis ir Saulės kelias Lietuvoje"} | Kalendorius365`;
      }
      renderAnswer(city.place, solarWeek(date, city, times), date === today());
      $("#sun-summary").textContent = `${city.name}, ${displayDate(date)}. Saulėtekis ${clock(times.sunrise)}, saulėlydis ${clock(times.sunset)}. Dienos trukmė ${minutesLabel(times.dayMinutes)}.`;
      $("#sunrise-time").textContent = clock(times.sunrise);
      $("#sunset-time").textContent = clock(times.sunset);
      $("#sun-noon").textContent = clock(times.noon);
      $("#sun-day-length").textContent = minutesLabel(times.dayMinutes);
      display.caption.textContent = `${city.name} · ${displayDate(date)} · Lietuvos laiku`;

      const rise = solarPositionAt(date, times.sunrise, city), set = solarPositionAt(date, times.sunset, city);
      $("#sunrise-date").textContent = `${angleLabel(rise.azimuth)} · ${compass(rise.azimuth)}`;
      $("#sunset-date").textContent = `${angleLabel(set.azimuth)} · ${compass(set.azimuth)}`;
      $("#sun-noon-alt").textContent = angleLabel(solarPositionAt(date, times.noon, city).altitude) + " virš horizonto";

      scene = buildSolarScene(host, date, city, times);
      scene.trajectory(trajectory.getAttribute("aria-pressed") === "true");
      const span = times.civilEnd - times.civilStart;
      const sliderValue = instant => Math.round((instant - times.civilStart) / span * 1000);
      function setInstant(instant, marker) {
        const point = scene.update(instant);
        const time = clock(instant);
        const phase = moments[marker] || phaseFor(instant, times);
        display.time.textContent = time;
        display.output.textContent = time;
        display.phase.textContent = phase;
        display.altitude.textContent = angleLabel(point.altitude);
        display.azimuth.textContent = `${angleLabel(point.azimuth)} · ${compass(point.azimuth)}`;
        host.dataset.phase = marker || phase;
        host.setAttribute("aria-label", `${city.name}, ${time}. ${phase}. Saulės aukštis ${angleLabel(point.altitude)}, kryptis ${compass(point.azimuth)}.`);
        slider.setAttribute("aria-valuetext", `${time} Lietuvos laiku, ${phase}, Saulės aukštis ${angleLabel(point.altitude)}`);
        for (const button of eventButtons) button.setAttribute("aria-pressed", String(button.dataset.sunMoment === marker));
      }
      const renderSlider = () => setInstant(times.civilStart + span * Number(slider.value) / 1000);
      slider.oninput = () => { stopPlayback(); renderSlider(); };
      for (const button of eventButtons) {
        const event = button.dataset.sunMoment;
        const eventTime = button.querySelector("time");
        eventTime.textContent = clock(times[event]);
        eventTime.dateTime = new Date(times[event]).toISOString();
        button.onclick = () => {
          stopPlayback();
          slider.value = String(sliderValue(times[event]));
          setInstant(times[event], event);
        };
      }
      const initialTime = Math.min(times.sunrise + 32 * 60000, times.noon);
      slider.value = String(sliderValue(initialTime));
      setInstant(initialTime);

      play.onclick = () => {
        if (frame !== null) { stopPlayback(); return; }
        if (Number(slider.value) >= 1000) slider.value = "0";
        const initial = Number(slider.value), start = performance.now();
        play.setAttribute("aria-pressed", "true");
        play.querySelector("span").textContent = "Sustabdyti animaciją";
        play.querySelector("path").setAttribute("d", "M7 5h4v14H7zm7 0h4v14h-4z");
        const animate = now => {
          const progress = Math.min(1, (now - start) / 14500);
          slider.value = String(Math.round(initial + (1000 - initial) * progress));
          renderSlider();
          if (progress === 1) stopPlayback();
          else frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
      };

      const key = `${city.id}/${year}`;
      if (yearCache?.key !== key) {
        const yearLength = Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1);
        const entries = Array.from({ length: yearLength / DAY }, (_, index) => {
          const stamp = new Date(Date.UTC(year, 0, index + 1)).toISOString().slice(0, 10);
          return { date: stamp, ...solarFor(stamp, city) };
        });
        yearCache = { key, entries };
      }
      const monthData = yearCache.entries.filter(item => Number(item.date.slice(5, 7)) === month);
      const monthName = new Intl.DateTimeFormat("lt-LT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
      $("#sun-table-caption").textContent = `${city.name} · ${monthName} · Lietuvos laiku`;
      const monthRows = monthData.map(item => {
        const row = html("tr");
        if (item.date === date) row.className = "sun-selected-day";
        row.append(html("th", displayDate(item.date), { scope: "row" }));
        for (const value of [clock(item.sunrise), clock(item.noon), clock(item.sunset), minutesLabel(item.dayMinutes), `${clock(item.civilStart)}–${clock(item.civilEnd)}`]) {
          row.append(html("td", value));
        }
        return row;
      });
      $("#sun-rows").replaceChildren(...monthRows);
      drawMonthChart(date, city, monthData);
      drawYearChart(year, date, city, yearCache.entries);
      const yearRows = Array.from({ length: 12 }, (_, index) => {
        const days = yearCache.entries.filter(item => Number(item.date.slice(5, 7)) === index + 1);
        const shortest = days.reduce((a, b) => a.dayMinutes <= b.dayMinutes ? a : b);
        const longest = days.reduce((a, b) => a.dayMinutes >= b.dayMinutes ? a : b);
        const mean = Math.round(days.reduce((sum, item) => sum + item.dayMinutes, 0) / days.length);
        const row = html("tr");
        const monthLabel = new Intl.DateTimeFormat("lt-LT", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, index, 1)));
        row.append(html("th", monthLabel, { scope: "row" }), html("td", minutesLabel(mean)),
          html("td", `${displayDate(shortest.date)} · ${minutesLabel(shortest.dayMinutes)}`),
          html("td", `${displayDate(longest.date)} · ${minutesLabel(longest.dayMinutes)}`));
        return row;
      });
      $("#sun-year-caption").textContent = `${city.name} · ${year} m. · dienos trukmės suvestinė`;
      $("#sun-year-rows").replaceChildren(...yearRows);
      for (const control of [play, slider, trajectory, ...eventButtons]) control.disabled = false;
      for (const panel of root.querySelectorAll("[data-sun-interactive]")) panel.hidden = false;
      errorBox.hidden = true;

      if (change === "city" || change === "date") {
        const url = new URL(location.href);
        if (change === "city" || cityPath()) {
          url.pathname = `/saule/${city.id}/`;
          url.searchParams.delete("miestas");
        }
        if (date === today()) url.searchParams.delete("data");
        else url.searchParams.set("data", date);
        if (url.href !== location.href) {
          if (change === "city") history.pushState(history.state, "", url);
          else history.replaceState(history.state, "", url);
        }
      }
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      for (const control of [play, slider, trajectory, ...eventButtons]) control.disabled = true;
    }
  }

  dateInput.addEventListener("change", () => render("date"));
  cityInput.addEventListener("change", () => render("city"));
  todayButton.addEventListener("click", () => { dateInput.value = today(); render("date"); });
  window.addEventListener("popstate", () => {
    readLocation();
    render("history");
  });
  trajectory.addEventListener("click", () => {
    const visible = trajectory.getAttribute("aria-pressed") !== "true";
    trajectory.setAttribute("aria-pressed", String(visible));
    scene?.trajectory(visible);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopPlayback(); });
  render();
}

function renderAnswer(place, { rows, comparison }, isToday) {
  const first = rows[0];
  $("#sun-answer-title").textContent = `Kada teka ir leidžiasi Saulė ${place}?`;
  $("#sun-answer-city").textContent = place;
  $("#sun-answer-today").hidden = !isToday;
  $("#sun-answer-today-comma").hidden = !isToday;
  for (const [id, label, datetime] of [
    ["sun-answer-date", first.label, first.date],
    ["sun-answer-rise", first.sunrise, first.sunriseAt],
    ["sun-answer-set", first.sunset, first.sunsetAt],
    ["sun-answer-dawn", first.civilStart, first.civilStartAt],
    ["sun-answer-dusk", first.civilEnd, first.civilEndAt],
  ]) {
    const time = $(`#${id}`);
    time.textContent = label;
    time.dateTime = datetime;
  }
  $("#sun-answer-daylight").textContent = first.daylight;
  $("#sun-week-change").textContent = comparison;
  $("#sun-week-change").hidden = !comparison;
  $("#sun-week-caption").textContent = `Saulės laikai ${place} · Lietuvos laiku`;
  $("#sun-week-rows").replaceChildren(...rows.map(row => {
    const tr = html("tr");
    const date = html("th", undefined, { scope: "row" });
    date.append(html("time", row.label, { datetime: row.date }));
    const rise = html("td"), set = html("td");
    rise.append(html("time", row.sunrise, { datetime: row.sunriseAt }));
    set.append(html("time", row.sunset, { datetime: row.sunsetAt }));
    tr.append(date, rise, set, html("td", row.daylight));
    return tr;
  }));
}

function drawMonthChart(date, city, entries) {
  const { year, month, day } = parts(date), minimum = Math.min(...entries.map((item) => item.dayMinutes)), maximum = Math.max(...entries.map((item) => item.dayMinutes));
  const low = minimum - 20, high = maximum + 20, x = (index) => 72 + index * 850 / Math.max(1, entries.length - 1), y = (minutes) => 205 - (minutes - low) / (high - low) * 138;
  const chart = svg("svg", { viewBox: "0 0 980 250", role: "img", "aria-label": `${city.name}, ${new Intl.DateTimeFormat("lt-LT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}: dienos šviesa svyruoja nuo ${minutesLabel(minimum)} iki ${minutesLabel(maximum)}.` });
  const defs = svg("defs", {}, chart), gradient = svg("linearGradient", { id: "sun-month-area", x1: "0", y1: "0", x2: "0", y2: "1" }, defs);
  svg("stop", { offset: "0%", "stop-color": "#eab543", "stop-opacity": .34 }, gradient); svg("stop", { offset: "100%", "stop-color": "#eab543", "stop-opacity": .015 }, gradient);
  for (let line = 0; line < 3; line++) svg("line", { x1: 68, y1: 68 + line * 62, x2: 930, y2: 68 + line * 62, stroke: "#718096", opacity: .18 }, chart);
  const line = entries.map((entry, index) => `${index ? "L" : "M"}${x(index).toFixed(2)} ${y(entry.dayMinutes).toFixed(2)}`).join(" ");
  svg("path", { d: `${line} L ${x(entries.length - 1)} 212 L ${x(0)} 212 Z`, fill: "url(#sun-month-area)" }, chart);
  svg("path", { d: line, fill: "none", stroke: "#b87a12", "stroke-width": 4, "stroke-linecap": "round", "stroke-linejoin": "round" }, chart);
  const selectedIndex = day - 1;
  svg("line", { x1: x(selectedIndex), y1: 44, x2: x(selectedIndex), y2: 213, stroke: "#b87a12", "stroke-width": 1.4, "stroke-dasharray": "4 5", opacity: .65 }, chart);
  entries.forEach((entry, index) => {
    const group = svg("g", {}, chart), point = svg("circle", { cx: x(index), cy: y(entry.dayMinutes), r: index === selectedIndex ? 7 : 3.2, fill: index === selectedIndex ? "#006a44" : "#fff", stroke: index === selectedIndex ? "#fff" : "#b87a12", "stroke-width": index === selectedIndex ? 2.5 : 2 }, group);
    svg("title", {}, group).textContent = `${displayDate(entry.date)} · ${minutesLabel(entry.dayMinutes)}`; point.setAttribute("aria-hidden", "true");
  });
  entries.forEach((_, index) => { const number = index + 1; if (number === 1 || number % 5 === 0 || number === entries.length) svg("text", { x: x(index), y: 238, "text-anchor": "middle", "font-size": 13, fill: "#69768c", "font-weight": 700 }, chart).textContent = String(number); });
  svg("text", { x: 15, y: 74, "font-size": 12, fill: "#69768c" }, chart).textContent = minutesLabel(Math.round(high));
  svg("text", { x: 15, y: 205, "font-size": 12, fill: "#69768c" }, chart).textContent = minutesLabel(Math.round(low));
  $("#sun-chart").replaceChildren(chart);
  $("#sun-chart-caption").textContent = `${city.name} · ${new Intl.DateTimeFormat("lt-LT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)))}. Taškai žymi apskaičiuotą dienos šviesą; ašies skalė pritaikyta mėnesio pokyčiui.`;
}

function drawYearChart(year, date, city, entries) {
  const yearSvg = svg("svg", { viewBox: "0 0 980 250", role: "img", "aria-label": `${city.name}, ${year} m. dienos šviesos kaita; pasirinkta ${displayDate(date)}.` });
  const defs = svg("defs", {}, yearSvg), gradient = svg("linearGradient", { id: "sun-year-area", x1: "0", y1: "0", x2: "0", y2: "1" }, defs);
  svg("stop", { offset: "0%", "stop-color": "#15976f", "stop-opacity": .29 }, gradient); svg("stop", { offset: "100%", "stop-color": "#15976f", "stop-opacity": .015 }, gradient);
  const x = (index) => 74 + index * 850 / (entries.length - 1), y = (minutes) => 205 - minutes / 1440 * 145;
  for (const hours of [0, 6, 12, 18, 24]) {
    const lineY = 205 - hours * 60 / 1440 * 145;
    svg("line", { x1: 68, y1: lineY, x2: 930, y2: lineY, stroke: "#718096", opacity: .17 }, yearSvg);
    if (hours % 12 === 0) svg("text", { x: 18, y: lineY + 4, "font-size": 12, fill: "#69768c" }, yearSvg).textContent = `${hours} val.`;
  }
  const line = entries.map((entry, index) => `${index ? "L" : "M"}${x(index).toFixed(2)} ${y(entry.dayMinutes).toFixed(2)}`).join(" ");
  svg("path", { d: `${line} L 924 212 L 74 212 Z`, fill: "url(#sun-year-area)" }, yearSvg);
  svg("path", { d: line, fill: "none", stroke: "#087959", "stroke-width": 3.2, "stroke-linejoin": "round", "stroke-linecap": "round" }, yearSvg);
  for (let month = 1; month <= 12; month++) {
    const index = Math.round((Date.UTC(year, month - 1, 1) - Date.UTC(year, 0, 1)) / DAY), xAt = x(index);
    if (month > 1) svg("line", { x1: xAt, y1: 49, x2: xAt, y2: 212, stroke: "#718096", opacity: .22, "stroke-dasharray": "3 5" }, yearSvg);
    svg("text", { x: xAt, y: 238, "text-anchor": "middle", "font-size": 12, fill: "#69768c", "font-weight": 700 }, yearSvg).textContent = pad(month);
  }
  const { month, day } = parts(date), dayIndex = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / DAY), selectedX = x(dayIndex), selectedY = y(entries[dayIndex].dayMinutes);
  svg("line", { x1: selectedX, y1: 48, x2: selectedX, y2: 212, stroke: "#b87a12", "stroke-width": 1.3, "stroke-dasharray": "4 5", opacity: .8 }, yearSvg);
  svg("circle", { cx: selectedX, cy: selectedY, r: 6, fill: "#eab543", stroke: "#fff", "stroke-width": 2 }, yearSvg);
  $("#sun-year-chart").replaceChildren(yearSvg);
  $("#sun-year-chart-caption").textContent = `${city.name} · ${year} m. · sezoninė dienos šviesos kaita; vertikalioji skalė nuo 0 iki 24 val.`;
}

setupSun();
