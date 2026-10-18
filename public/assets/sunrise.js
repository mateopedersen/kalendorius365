import { solarFor, solarPositionAt } from "/assets/releases/675aca80be49ea9f1d25/phase-5-6-8-core.js";
import { today, TZ } from "/assets/releases/675aca80be49ea9f1d25/calendar.js";

const $ = (selector, root = document) => root.querySelector(selector);
const DAY = 86400000;
const pad = (value) => String(value).padStart(2, "0");
const parts = (date) => ({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)) });
const addDays = (date, amount) => {
  const { year, month, day } = parts(date);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
};
const dayLabel = new Intl.DateTimeFormat("lt-LT", { timeZone: "UTC", weekday: "long", year: "numeric", month: "long", day: "numeric" });
const displayDate = (date) => dayLabel.format(new Date(`${date}T12:00:00Z`));
const clock = (instant) => new Intl.DateTimeFormat("lt-LT", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(instant));
const minutesLabel = (minutes) => `${Math.floor(minutes / 60)} val. ${pad(minutes % 60)} min.`;
const svgNS = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}, parent) => {
  const node = document.createElementNS(svgNS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  parent?.append(node);
  return node;
};
const html = (tag, content, attrs = {}) => {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
};
const solarCities = fetch("/assets/releases/675aca80be49ea9f1d25/data/astronomy/cities.json").then((response) => {
  if (!response.ok) throw Error("Miestų koordinačių nepavyko įkelti.");
  return response.json();
}).catch(() => ({ cities: [] }));

function setupSun() {
  const root = $("#sun-tool");
  if (!root) return;
  const dateInput = $("#sun-date"), cityInput = $("#sun-city"), slider = $("#sun-scrubber"), play = $("#sun-play");
  if (!dateInput.value) dateInput.value = today();
  let cancelPlayback = () => {};
  let renderSequence = 0;
  const palettes = {
    dawn: { top: "#263b60", bottom: "#e3a889", glow: "#ffcf96" },
    morning: { top: "#5293b8", bottom: "#f4d8a3", glow: "#fff0af" },
    day: { top: "#398dbb", bottom: "#d8f0e4", glow: "#fff6bd" },
    golden: { top: "#4f638d", bottom: "#efaa72", glow: "#ffde91" },
    dusk: { top: "#302c55", bottom: "#d97970", glow: "#ffbf83" },
  };
  const phaseLabel = { dawn: "Aušros prieblanda", morning: "Rytas", day: "Dienos šviesa", golden: "Prieš saulėlydį", dusk: "Vakaro prieblanda" };
  const compass = (degrees) => ["šiaurės", "šiaurės rytų", "rytų", "pietryčių", "pietų", "pietvakarių", "vakarų", "šiaurės vakarų"][Math.round(degrees / 45) % 8];
  const yearIsLeap = (year) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

  const buildScene = (date, city, times) => {
    const host = $("#sun-scene");
    host.replaceChildren();
    const drawing = svg("svg", { viewBox: "0 0 960 330", role: "presentation", "aria-hidden": "true", focusable: "false" });
    host.append(drawing);
    const defs = svg("defs", {}, drawing);
    const sky = svg("linearGradient", { id: "sun-sky", x1: "0", y1: "0", x2: "0", y2: "1" }, defs);
    const skyTop = svg("stop", { id: "sun-sky-top", offset: "0%", "stop-color": palettes.dawn.top }, sky);
    const skyBottom = svg("stop", { id: "sun-sky-bottom", offset: "80%", "stop-color": palettes.dawn.bottom }, sky);
    const haze = svg("linearGradient", { id: "sun-horizon", x1: "0", y1: "0", x2: "0", y2: "1" }, defs);
    svg("stop", { offset: "0%", "stop-color": "#fff5d5", "stop-opacity": .6 }, haze);
    svg("stop", { offset: "100%", "stop-color": "#fff5d5", "stop-opacity": 0 }, haze);
    const glow = svg("radialGradient", { id: "sun-glow", gradientUnits: "userSpaceOnUse", cx: 480, cy: 200, r: 160 }, defs);
    const glowCore = svg("stop", { id: "sun-glow-core", offset: "0%", "stop-color": palettes.dawn.glow, "stop-opacity": .78 }, glow);
    svg("stop", { offset: "100%", "stop-color": palettes.dawn.glow, "stop-opacity": 0 }, glow);
    const sunFill = svg("radialGradient", { id: "sun-disc", cx: "38%", cy: "32%", r: "75%" }, defs);
    svg("stop", { offset: "0%", "stop-color": "#fffbe0" }, sunFill);
    svg("stop", { offset: "58%", "stop-color": "#ffe089" }, sunFill);
    svg("stop", { offset: "100%", "stop-color": "#f5a932" }, sunFill);
    svg("rect", { x: 0, y: 0, width: 960, height: 330, fill: "url(#sun-sky)" }, drawing);
    const horizonGlow = svg("ellipse", { cx: 480, cy: 258, rx: 475, ry: 75, fill: "url(#sun-horizon)" }, drawing);
    for (let i = 0; i < 8; i++) {
      const x = 77 + i * 113, y = 28 + (i % 3) * 18;
      svg("circle", { cx: x, cy: y, r: i % 2 ? 1.2 : 1.8, fill: "#fff4ca", opacity: .55 }, drawing);
    }

    const position = (instant) => {
      const { altitude, azimuth } = solarPositionAt(date, instant, city);
      return { x: Math.max(48, Math.min(912, 480 + (azimuth - 180) * 2.5)), y: 258 - altitude * 2.55, altitude, azimuth };
    };
    const sample = (from, to, steps) => Array.from({ length: steps + 1 }, (_, index) => position(from + (to - from) * index / steps));
    const line = (points) => points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
    svg("path", { d: line(sample(times.civilStart, times.civilEnd, 72)), fill: "none", stroke: "#fff9de", "stroke-width": 2.2, "stroke-dasharray": "5 8", "stroke-linecap": "round", opacity: .7 }, drawing);
    svg("path", { d: line(sample(times.sunrise, times.sunset, 58)), fill: "none", stroke: "#fff4b2", "stroke-width": 4, "stroke-linecap": "round", opacity: .95 }, drawing);

    svg("path", { d: "M0 253 C125 238 195 260 300 250 S485 242 590 253 S830 240 960 250 L960 330 L0 330 Z", fill: "#496b63", opacity: .72 }, drawing);
    svg("path", { d: "M0 263 C95 251 203 271 318 261 S520 253 647 264 S833 254 960 263 L960 330 L0 330 Z", fill: "#294e42" }, drawing);
    for (let i = 0; i < 25; i++) {
      const x = 12 + i * 40, y = 260 + (i % 3) * 3, height = 14 + (i * 13 % 24), width = 7 + (i * 7 % 7);
      svg("path", { d: `M${x} ${y} l${-width} ${height * .48} h${width * .55} l${-width * .35} ${height * .34} h${width * 1.5} l${-width * .35} ${-height * .34} h${width * .55} Z`, fill: i % 2 ? "#173e36" : "#1e473c", opacity: .95 }, drawing);
    }
    svg("path", { d: "M0 285 C156 274 263 295 412 282 S674 279 790 289 S907 282 960 286 L960 330 L0 330 Z", fill: "#153b40", opacity: .95 }, drawing);
    for (let i = 0; i < 24; i++) {
      const x = i * 43 + 8, y = 290 + (i % 4) * 6;
      svg("path", { d: `M${x} ${y} q16 2 32 0`, fill: "none", stroke: i % 2 ? "#84b8ac" : "#d9bd7e", "stroke-width": 1, opacity: .24 }, drawing);
    }
    svg("path", { d: "M0 258 Q480 253 960 258", fill: "none", stroke: "#d9e5d4", "stroke-width": 1.4, opacity: .76 }, drawing);

    const marker = (instant, label, color, anchor) => {
      const point = position(instant), group = svg("g", {}, drawing), labelY = Math.max(32, point.y - 35), labelX = point.x + (anchor === "start" ? 8 : anchor === "end" ? -8 : 0);
      svg("line", { x1: point.x, y1: point.y - 7, x2: point.x, y2: labelY + 8, stroke: color, "stroke-width": 1.3, opacity: .78 }, group);
      svg("circle", { cx: point.x, cy: point.y, r: 4.2, fill: color, stroke: "#fff", "stroke-width": 2 }, group);
      svg("text", { x: labelX, y: labelY, "text-anchor": anchor, "font-size": 13, "font-weight": 800, fill: "#fffdf0", stroke: "#24445a", "stroke-width": 3, "paint-order": "stroke" }, group).textContent = `${label} · ${clock(instant)}`;
    };
    marker(times.sunrise, "Saulėtekis", "#ffd278", "start");
    marker(times.noon, "Vidurdienis", "#fff3b1", "middle");
    marker(times.sunset, "Saulėlydis", "#ffb17d", "end");
    const liveGlow = svg("circle", { cx: 480, cy: 200, r: 82, fill: "url(#sun-glow)" }, drawing);
    const disk = svg("circle", { cx: 480, cy: 200, r: 17, fill: "url(#sun-disc)", stroke: "#fff5c4", "stroke-width": 1.5 }, drawing);
    svg("circle", { cx: 475, cy: 195, r: 4, fill: "#fff", "fill-opacity": .7 }, drawing);
    svg("path", { d: "M20 310 Q480 301 940 310", fill: "none", stroke: "#8fc2b3", "stroke-width": 1, opacity: .22 }, drawing);

    const getPhase = (instant) => instant < times.sunrise ? "dawn" : instant < times.sunrise + 3600000 ? "morning" : instant < times.sunset - 3600000 ? "day" : instant < times.sunset ? "golden" : "dusk";
    return (instant) => {
      const point = position(instant), phase = getPhase(instant), colors = palettes[phase];
      disk.setAttribute("cx", point.x.toFixed(2)); disk.setAttribute("cy", point.y.toFixed(2));
      liveGlow.setAttribute("cx", point.x.toFixed(2)); liveGlow.setAttribute("cy", point.y.toFixed(2));
      horizonGlow.setAttribute("cx", point.x.toFixed(2));
      skyTop.setAttribute("stop-color", colors.top); skyBottom.setAttribute("stop-color", colors.bottom); glowCore.setAttribute("stop-color", colors.glow);
      glow.setAttribute("cx", point.x.toFixed(2)); glow.setAttribute("cy", point.y.toFixed(2));
      host.dataset.phase = phase;
      const altitude = point.altitude.toFixed(1).replace(".", ",");
      host.setAttribute("aria-label", `${city.name}, ${displayDate(date)}. ${phaseLabel[phase]}, ${clock(instant)} Lietuvos laiku. Saulės aukštis ${altitude} laipsnio, kryptis ${compass(point.azimuth)}.`);
      $("#sun-sim-time").textContent = clock(instant); $("#sun-sim-output").textContent = clock(instant); $("#sun-sim-phase").textContent = phaseLabel[phase];
      $("#sun-sim-detail").textContent = `Saulės aukštis ${altitude}° · kryptis ${compass(point.azimuth)} · ${displayDate(date)}.`;
      $("#sun-scene-caption").textContent = `${city.name} · ${displayDate(date)} · vaizdas keičiasi slenkant nuo aušros iki vakaro.`;
      slider.setAttribute("aria-valuetext", `${clock(instant)} Lietuvos laiku · ${phaseLabel[phase]} · Saulės aukštis ${altitude} laipsnio`);
    };
  };

  const render = async () => {
    cancelPlayback();
    const sequence = ++renderSequence;
    try {
      const date = dateInput.value, { year, month, day } = parts(date), cityData = await solarCities;
      if (sequence !== renderSequence) return;
      if (!/^\d{4}-\d\d-\d\d$/.test(date) || year < 2000 || year > 2100) throw Error("Pasirinkite datą nuo 2000 iki 2100 metų.");
      if (new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== date) throw Error("Pasirinkite galiojančią kalendorinę datą.");
      const cityRecord = cityData.cities.find((item) => item.id === cityInput.value);
      if (!cityRecord) throw Error("Pasirinkite vieną iš palaikomų Lietuvos miestų.");
      const city = { name: cityRecord.name, lat: cityRecord.latitude, lon: cityRecord.longitude };
      const times = solarFor(date, city);
      if ([times.sunrise, times.sunset, times.noon, times.civilStart, times.civilEnd].some((instant) => !Number.isFinite(instant))) throw Error("Pasirinktos dienos Saulės laikų apskaičiuoti nepavyko.");
      const yesterday = solarFor(addDays(date, -1), city), tomorrow = solarFor(addDays(date, 1), city);
      const todayDelta = times.dayMinutes - yesterday.dayMinutes, tomorrowDelta = tomorrow.dayMinutes - times.dayMinutes;
      const todayChange = todayDelta === 0 ? "beveik nepasikeitė" : `${Math.abs(todayDelta)} min. ${todayDelta > 0 ? "ilgesnis" : "trumpesnis"}`;
      const tomorrowChange = tomorrowDelta === 0 ? "beveik nepasikeis" : `${Math.abs(tomorrowDelta)} min. ${tomorrowDelta > 0 ? "ilgės" : "trumpės"}`;
      $("#sun-day-change").textContent = todayDelta === 0 ? "Beveik tiek pat šviesos kaip ankstesnę dieną" : `Palyginti su ankstesne diena: ${Math.abs(todayDelta)} min. ${todayDelta > 0 ? "daugiau" : "mažiau"} šviesos`;
      $("#sun-summary").textContent = `${displayDate(date)} · ${city.name}, Lietuvos laiku (${TZ}). Saulėtekis ${clock(times.sunrise)}, Saulės vidurdienis ${clock(times.noon)}, saulėlydis ${clock(times.sunset)}. Dienos šviesa ${minutesLabel(times.dayMinutes)}.`;
      $("#sunrise-time").textContent = clock(times.sunrise); $("#sunset-time").textContent = clock(times.sunset); $("#sun-noon").textContent = clock(times.noon); $("#sun-day-length").textContent = minutesLabel(times.dayMinutes);
      $("#sunrise-date").textContent = `${city.name} · ${displayDate(date)}`; $("#sunset-date").textContent = `${city.name} · ${displayDate(date)}`;
      $("#sun-delta-copy").textContent = `Palyginti su ankstesne diena, šviesus paros metas ${todayChange}; kitą dieną jis ${tomorrowChange}.`;
      const momentLabels = { civilStart: "Aušra", sunrise: "Saulėtekis", noon: "Vidurdienis", sunset: "Saulėlydis", civilEnd: "Vakaras" };
      for (const [key, id] of [["civilStart", "#sun-civil-start"], ["sunrise", "#sun-rise-time"], ["noon", "#sun-noon-time"], ["sunset", "#sun-set-time"], ["civilEnd", "#sun-civil-end"]]) {
        const node = $(id); node.textContent = clock(times[key]);
        const button = root.querySelector(`[data-sun-moment="${key}"]`); button.setAttribute("aria-label", `${momentLabels[key]}, ${clock(times[key])} Lietuvos laiku`); button.querySelector("time").dateTime = new Date(times[key]).toISOString();
        button.onclick = () => { slider.value = String(Math.round((times[key] - times.civilStart) / (times.civilEnd - times.civilStart) * 1000)); slider.dispatchEvent(new Event("input")); };
      }
      const setInstant = buildScene(date, city, times), updateFromSlider = () => setInstant(times.civilStart + (times.civilEnd - times.civilStart) * Number(slider.value) / 1000);
      slider.value = "0"; slider.oninput = updateFromSlider; updateFromSlider();
      play.onclick = () => {
        if (play.getAttribute("aria-pressed") === "true") { cancelPlayback(); return; }
        if (Number(slider.value) >= 1000) slider.value = "0";
        const start = performance.now(), initial = Number(slider.value), fullTripMs = 16000;
        play.setAttribute("aria-pressed", "true"); play.querySelector("span").textContent = "Sustabdyti animaciją";
        play.querySelector("svg path").setAttribute("d", "M7 5h4v14H7zm7 0h4v14h-4z");
        let frame = 0;
        const finish = () => {
          cancelAnimationFrame(frame); play.setAttribute("aria-pressed", "false");
          play.querySelector("span").textContent = "Paleisti animaciją"; play.querySelector("svg path").setAttribute("d", "M8 5.5v13l10-6.5z");
          cancelPlayback = () => {};
        };
        cancelPlayback = finish;
        const animate = (now) => {
          const progress = Math.min(1, (now - start) / fullTripMs);
          slider.value = String(Math.round(initial + (1000 - initial) * progress)); updateFromSlider();
          if (progress >= 1) finish(); else frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
      };
      $("#sun-table-caption").textContent = `${city.name} · ${new Intl.DateTimeFormat("lt-LT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))} · vietos laikas`;
      const monthLength = new Date(Date.UTC(year, month, 0)).getUTCDate(), monthData = [], rows = [];
      for (let number = 1; number <= monthLength; number++) {
        const stamp = `${year}-${pad(month)}-${pad(number)}`, result = solarFor(stamp, city), row = html("tr"); monthData.push({ date: stamp, ...result });
        for (const text of [displayDate(stamp), clock(result.sunrise), clock(result.noon), clock(result.sunset), minutesLabel(result.dayMinutes), `${clock(result.civilStart)} – ${clock(result.civilEnd)}`]) row.append(html("td", text));
        rows.push(row);
      }
      $("#sun-rows").replaceChildren(...rows);
      drawMonthChart(date, city, monthData);

      const yearLength = yearIsLeap(year) ? 366 : 365, yearData = [];
      for (let number = 1; number <= yearLength; number++) {
        const stamp = new Date(Date.UTC(year, 0, number)).toISOString().slice(0, 10); yearData.push({ date: stamp, ...solarFor(stamp, city) });
      }
      drawYearChart(year, date, city, yearData);
      const yearRows = [];
      for (let number = 1; number <= 12; number++) {
        const days = yearData.filter((entry) => Number(entry.date.slice(5, 7)) === number);
        const shortest = days.reduce((a, b) => a.dayMinutes <= b.dayMinutes ? a : b), longest = days.reduce((a, b) => a.dayMinutes >= b.dayMinutes ? a : b);
        const average = Math.round(days.reduce((sum, entry) => sum + entry.dayMinutes, 0) / days.length), row = html("tr");
        row.append(html("th", new Intl.DateTimeFormat("lt-LT", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, number - 1, 1))), { scope: "row" }));
        row.append(html("td", minutesLabel(average)), html("td", `${displayDate(shortest.date)} · ${minutesLabel(shortest.dayMinutes)}`), html("td", `${displayDate(longest.date)} · ${minutesLabel(longest.dayMinutes)}`)); yearRows.push(row);
      }
      $("#sun-year-caption").textContent = `${city.name} · ${year} m. · dienos šviesos mėnesio vidurkis, trumpiausia ir ilgiausia diena`;
      $("#sun-year-rows").replaceChildren(...yearRows);
    } catch (error) {
      if (sequence !== renderSequence) return;
      $("#sun-summary").textContent = error.message; $("#sun-scene").setAttribute("aria-label", error.message);
    }
  };

  dateInput.addEventListener("change", render); cityInput.addEventListener("change", render);
  $("#sun-today").addEventListener("click", () => { dateInput.value = today(); render(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) cancelPlayback(); });
  render();
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

solarCities.then(setupSun);
