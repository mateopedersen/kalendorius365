import { solarPositionAt } from "../phase-5-6-8-core.js";

const W = 1200;
const HORIZON = 354;
const HEIGHT = 500;
const SUN_RADIUS = 14;
const RISE_SET_ALTITUDE = -0.833;
const altitudeScale = 4.65;
const xForAzimuth = azimuth => 48 + (azimuth - 22) * (W - 96) / 316;
const clamp = value => Math.max(0, Math.min(1, value));

const EAST_SKY = [
  [-6, "#182944", "#79616c", "#f0a484"],
  [0, "#304e76", "#f1a673", "#ffba63"],
  [9, "#436f9b", "#ffd4a5", "#ffe0a0"],
  [30, "#276ba5", "#bcdae0", "#fff0c9"],
];
const WEST_SKY = [
  [-6, "#222642", "#804b62", "#e29283"],
  [0, "#3c4773", "#f0a072", "#ffa95e"],
  [9, "#53759b", "#ffcc92", "#ffe2a3"],
  [30, "#276ba5", "#bcdae0", "#fff0c9"],
];
const FOREST = new Set(["trakai", "moletai", "visaginas", "utena", "ignalina", "zarasai", "dusetos", "dukstas", "vievis", "veisiejai", "simnas", "telsiai", "birstonas"]);
const COAST = new Set(["klaipeda", "palanga", "neringa", "silute"]);
const ELEVATED = new Set(["vilnius", "kaunas", "alytus", "jonava", "druskininkai", "varena", "anyksciai", "jurbarkas", "vilkija"]);

export function svg(tag, attrs = {}, parent) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  parent?.append(node);
  return node;
}

function mix(a, b, amount) {
  const channels = [1, 3, 5].map(i => {
    const x = Number.parseInt(a.slice(i, i + 2), 16);
    const y = Number.parseInt(b.slice(i, i + 2), 16);
    return Math.round(x + (y - x) * amount).toString(16).padStart(2, "0");
  });
  return "#" + channels.join("");
}

function sampleSky(samples, altitude) {
  const ceiling = samples.findIndex(sample => sample[0] > altitude);
  if (ceiling === 0) return samples[0].slice(1);
  if (ceiling < 0) return samples.at(-1).slice(1);
  const [a, ...start] = samples[ceiling - 1];
  const [b, ...end] = samples[ceiling];
  const fraction = clamp((altitude - a) / (b - a));
  return start.map((color, index) => mix(color, end[index], fraction));
}

function stop(parent, offset, color, opacity = 1) {
  return svg("stop", { offset, "stop-color": color, "stop-opacity": opacity }, parent);
}

function terrainFor(id) {
  if (COAST.has(id)) return "coast";
  if (FOREST.has(id)) return "lake";
  if (ELEVATED.has(id)) return "river";
  return "plain";
}

function seededRandom(id) {
  let state = [...id].reduce((hash, letter) => Math.imul(hash, 31) + letter.charCodeAt(0), 173);
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function drawTrees(group, random, terrain) {
  for (let i = 0; i < 78; i++) {
    const x = random() * W;
    const edge = Math.abs(x - W / 2) / (W / 2);
    if ((terrain === "coast" && edge < .68) || (terrain === "river" && edge < .32)) continue;
    const base = HORIZON + 20 + Math.pow(edge, 2) * 24 + random() * 8;
    const height = 7 + random() * (12 + edge * 22);
    const width = height * (.16 + random() * .14);
    svg("path", {
      d: `M${x} ${base-height}q${-width*.33} ${height*.34} ${-width*.75} ${height*.5}l${width*.23} 0q${-width*.13} ${height*.2} ${-width*.55} ${height*.41}l${width*.77} 0v${height*.15}h${width*.45}v${-height*.15}h${width*.82}q${-width*.44} ${-height*.2} ${-width*.57} ${-height*.41}h${width*.28}q${-width*.52} ${-height*.2} ${-width*.65} ${-height*.5}Z`,
      opacity: .58 + random() * .42,
    }, group);
  }
}

export function buildSolarScene(host, date, city, times) {
  const drawing = svg("svg", { viewBox: `0 0 ${W} ${HEIGHT}`, "aria-hidden": "true", focusable: "false" });
  host.replaceChildren(drawing);
  const defs = svg("defs", {}, drawing);
  const sky = svg("linearGradient", { id: "sun-sky", x2: 0, y2: 1 }, defs);
  const high = stop(sky, 0, "#192944");
  const mid = stop(sky, .63, "#7b6b80");
  const low = stop(sky, 1, "#e6ac84");
  const lens = svg("radialGradient", { id: "sun-aureole", cx: .5, cy: .5, r: .5 }, defs);
  const lensInner = stop(lens, 0, "#ffdb91", .82);
  const lensMiddle = stop(lens, .33, "#ff9f63", .33);
  stop(lens, 1, "#ffd2a0", 0);
  const diskGradient = svg("radialGradient", { id: "sun-photosphere", cx: .43, cy: .34, r: .68 }, defs);
  stop(diskGradient, 0, "#fffdf0");
  stop(diskGradient, .7, "#fff0b5");
  const limb = stop(diskGradient, 1, "#ffac5b");
  const groundGradient = svg("linearGradient", { id: "sun-ground", x2: 0, y2: 1 }, defs);
  const waterline = stop(groundGradient, 0, "#836f66");
  const deep = stop(groundGradient, 1, "#1e4241");
  const haze = svg("linearGradient", { id: "sun-low-haze", x2: 0, y2: 1 }, defs);
  stop(haze, 0, "#ffebc7", 0);
  stop(haze, .72, "#ffebc7", .48);
  stop(haze, 1, "#ffebc7", 0);
  const cloud = svg("linearGradient", { id: "sun-cloud", x2: 0, y2: 1 }, defs);
  stop(cloud, 0, "#fcf2da", .10);
  const cloudEdge = stop(cloud, .7, "#f9bb9b", .58);
  stop(cloud, 1, "#ffe8b9", 0);
  const skyMask = svg("clipPath", { id: "sun-visible-sky" }, defs);
  svg("rect", { width: W, height: HORIZON }, skyMask);
  const reflection = svg("radialGradient", { id: "sun-surface-glint" }, defs);
  stop(reflection, 0, "#ffe397", .65);
  stop(reflection, .5, "#ffd68a", .25);
  stop(reflection, 1, "#ffd68a", 0);
  const bank = svg("linearGradient", { id: "sun-bank", x2: 0, y2: 1 }, defs);
  const bankEdge = stop(bank, 0, "#354844");
  const bankBase = stop(bank, 1, "#152528");

  svg("rect", { width: W, height: HORIZON, fill: "url(#sun-sky)" }, drawing);
  const random = seededRandom(city.id);
  const stars = svg("g", { fill: "#ffefd9" }, drawing);
  for (let i = 0; i < 26; i++) {
    svg("circle", { cx: random() * W, cy: 12 + random() * 148, r: .6 + random() * 1.25, opacity: .45 + random() * .42 }, stars);
  }
  const glow = svg("ellipse", { rx: 268, ry: 150, fill: "url(#sun-aureole)" }, drawing);
  svg("rect", { x: 0, y: 280, width: W, height: 90, fill: "url(#sun-low-haze)", opacity: .53 }, drawing);
  const clouds = svg("g", { fill: "url(#sun-cloud)" }, drawing);
  for (let i = 0; i < 11; i++) {
    const x = random() * 1210 - 160;
    const y = 49 + random() * 218;
    const width = 105 + random() * 350;
    svg("path", {
      d: `M${x} ${y}q${width*.15} -7 ${width*.35} -5t${width*.65} 0q${-width*.2} 12 ${-width*.55} 9t${-width*.45} -4Z`,
      opacity: .21 + random() * .53,
    }, clouds);
  }
  const wisps = svg("g", { fill: "none", stroke: "#fff3cb", "stroke-linecap": "round" }, drawing);
  for (let i = 0; i < 14; i++) {
    const x = random() * (W + 100) - 85;
    const y = 166 + random() * 175;
    const width = 39 + random() * 215;
    svg("path", {
      d: `M${x} ${y}q${width * .38} ${-2 - random() * 5} ${width} -2`,
      "stroke-width": .55 + random() * 1.45,
      opacity: .08 + random() * .22,
    }, wisps);
  }
  const diskLayer = svg("g", { "clip-path": "url(#sun-visible-sky)" }, drawing);
  const disk = svg("circle", { r: SUN_RADIUS, fill: "url(#sun-photosphere)" }, diskLayer);

  const terrain = terrainFor(city.id);
  host.dataset.terrain = terrain;
  svg("rect", { y: HORIZON, width: W, height: HEIGHT - HORIZON, fill: "url(#sun-ground)" }, drawing);
  const surfaceGlow = svg("ellipse", { cy: 376, rx: 121, ry: 56, fill: "url(#sun-surface-glint)" }, drawing);
  const ripples = svg("g", { stroke: "#ffe6b5", "stroke-width": 1, "stroke-linecap": "round" }, drawing);
  for (let index = 0; index < 66; index++) {
    const x = random() * W;
    const y = HORIZON + 5 + random() * 113;
    const width = 5 + random() * (13 + (y - HORIZON) * .48);
    svg("path", { d: `M${x} ${y}h${width}`, opacity: .09 + random() * .19 }, ripples);
  }

  const land = svg("g", {}, drawing);
  const back = svg("path", { d: terrain === "coast" ? "M0 359Q81 345 162 359l58 16H0Zm1200 2q-88-17-159 1l-102 19h261Z" :
    "M0 361Q110 344 210 354T430 357q104-5 204 0t194-1q201-17 372 4v33H0Z" }, land);
  const wood = svg("g", {}, land);
  drawTrees(wood, random, terrain);
  svg("path", { fill: "url(#sun-bank)", d: terrain === "coast" ?
    "M0 414q124-20 235 28 90 37 160 58H0Zm1200-10q-128 0-207 40-61 26-152 56h359Z" :
    terrain === "river" ? "M0 380q120-21 260-4 165 25 197 55 49 27 114 69H0Zm1200-14q-147-14-271 2-104 23-150 38-75 32-69 64l51 30h439Z" :
    "M0 427q100-32 223-2 61 13 120 27 74 7 129 48H0Zm1200-22q-118-24-201 11-94 35-169 23-42 6-112 61h482Z" }, land);
  const grass = svg("g", { fill: "none", "stroke-linecap": "round" }, land);
  for (let i = 0; i < 65; i++) {
    const x = i % 2 ? random() * 145 : W - random() * 155;
    const y = 483 + random() * 22;
    const h = 6 + random() * 27;
    const sway = (random() - .5) * 17;
    svg("path", { d: `M${x} ${y}q${sway*.21} ${-h*.7} ${sway} ${-h}`, "stroke-width": .7 + random() * 1.2, opacity: .38 + random() * .36 }, grass);
  }
  const horizon = svg("path", { d: `M32 ${HORIZON}H1168`, stroke: "#fff6cc", "stroke-opacity": .61, "stroke-width": .8, "stroke-dasharray": "2 6" }, drawing);
  const position = instant => {
    const { altitude, azimuth } = solarPositionAt(date, instant, city);
    return { x: xForAzimuth(azimuth), y: HORIZON + SUN_RADIUS - (altitude - RISE_SET_ALTITUDE) * altitudeScale, altitude, azimuth };
  };
  function sample(from, to) {
    return Array.from({ length: 97 }, (_, i) => {
      const { x, y } = position(from + (to - from) * i / 96);
      return `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ");
  }
  const trajectory = svg("g", { "pointer-events": "none" }, drawing);
  const path = sample(times.civilStart, times.civilEnd);
  svg("path", { d: path, stroke: "#142b3c", "stroke-width": 2.3, opacity: .47, fill: "none" }, trajectory);
  svg("path", { d: path, stroke: "#fff5d3", "stroke-width": 1.3, "stroke-dasharray": "3 7", opacity: .84, fill: "none" }, trajectory);
  for (const event of ["sunrise", "noon", "sunset"]) {
    const point = position(times[event]);
    svg("circle", { cx: point.x, cy: event === "noon" ? point.y : HORIZON, r: 4, fill: "#ffe6a1", stroke: "#423f3c", "stroke-width": 1 }, trajectory);
  }
  drawing.append(diskLayer);
  const compass = svg("g", { fill: "#fff7dd", "font-weight": 700, "font-size": 17, "text-anchor": "middle" }, drawing);
  for (const [degrees, label] of [[90, "R"], [180, "P"], [270, "V"]]) {
    const x = xForAzimuth(degrees);
    svg("path", { d: `M${x} 461v8`, stroke: "#fff7dd", opacity: .65 }, compass);
    svg("text", { x, y: 489 }, compass).textContent = label;
  }

  return {
    trajectory(visible) {
      trajectory.toggleAttribute("hidden", !visible);
      trajectory.style.display = visible ? "" : "none";
      horizon.style.display = visible ? "" : "none";
    },
    update(instant) {
      const point = position(instant);
      const morningColors = sampleSky(EAST_SKY, point.altitude);
      const eveningColors = sampleSky(WEST_SKY, point.altitude);
      const afternoon = clamp((point.azimuth - 142) / 76);
      const [top, bottom, warm] = morningColors.map((color, index) => mix(color, eveningColors[index], afternoon));
      const daylight = clamp((point.altitude + 6) / 32);
      const lowLight = clamp((14 - point.altitude) / 18);
      high.setAttribute("stop-color", top);
      low.setAttribute("stop-color", bottom);
      mid.setAttribute("stop-color", mix(top, bottom, .58));
      lensInner.setAttribute("stop-color", warm);
      lensMiddle.setAttribute("stop-color", warm);
      limb.setAttribute("stop-color", mix("#ff9a43", "#ffe9ac", daylight));
      cloudEdge.setAttribute("stop-color", mix(warm, "#f4f3eb", daylight));
      wisps.setAttribute("opacity", .9 - daylight * .35);
      glow.setAttribute("cx", point.x);
      glow.setAttribute("cy", Math.min(HORIZON + 15, point.y));
      glow.setAttribute("opacity", .18 + lowLight * .82);
      stars.setAttribute("opacity", clamp((-point.altitude - 1) / 5) * .66);
      disk.setAttribute("cx", point.x);
      disk.setAttribute("cy", point.y);
      waterline.setAttribute("stop-color", terrain === "plain" ? mix("#695448", "#969d72", daylight) : mix("#423f4e", bottom, .50 + daylight * .18));
      deep.setAttribute("stop-color", mix("#152928", terrain === "plain" ? "#4f6650" : "#385c59", daylight));
      back.setAttribute("fill", mix("#282e42", "#688778", daylight));
      wood.setAttribute("fill", mix("#1b3338", "#406859", daylight));
      bankEdge.setAttribute("stop-color", mix("#30393b", "#51765d", daylight));
      bankBase.setAttribute("stop-color", mix("#152528", "#294b3b", daylight));
      grass.setAttribute("stroke", mix("#768369", "#a5b892", daylight));
      surfaceGlow.setAttribute("cx", point.x);
      surfaceGlow.setAttribute("opacity", (terrain === "plain" ? .3 : .8) * lowLight);
      ripples.setAttribute("opacity", terrain === "plain" ? .28 : .73);
      return point;
    },
  };
}
