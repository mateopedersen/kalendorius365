import { initial, clone, uid, MONTHS, DAYS, TEMPLATES, PALETTES, months, monthKey, effective, template, validate, validateEvent, vacation, suggestions, today } from "./model.js";
import { scenes, svg, escape as e } from "./scene.js";
import { upload, originals, forget, source, photoURLs, palette, dpi, byteTotal } from "./photos.js";
import * as storage from "./storage.js";
import * as output from "./export.js";
const root = document.querySelector("#calendar-editor");
let state = initial(), data, editorial, pages = [], index = 0, scope = "all", selectedPhoto = null, zoom = 1, undo = [], redo = [], rangeBefore = null, revision = 0, saveTimer, previewTimer, busy = false, cancelled = false, tab = "settings", previewVersion = 0;
const photoCache = /* @__PURE__ */ new Map();
let statusText = "Pakeitimai išsaugomi šiame įrenginyje.", statusError = false;
const categoryNames = { birthday: "Gimtadienis", family: "Šeima", work: "Darbas", school: "Mokykla", vacation: "Atostogos", other: "Kita" };
const colorNames = { background: "Lapo fonas", title: "Antraštė", day: "Dienų skaičiai", weekday: "Savaitės dienos", weekend: "Savaitgaliai", holiday: "Šventės", personal: "Asmeniniai ženklai", grid: "Tinklelis" };
const q = (s) => root.querySelector(s), qa = (s) => [...root.querySelectorAll(s)];
const key = () => months(state)[Math.min(index, months(state).length - 1)] ? monthKey(...months(state)[Math.min(index, months(state).length - 1)]) : monthKey(state.period.year, state.period.month);
function currentKey() {
  return pages[index]?.key && pages[index].key !== "annual" ? pages[index].key : key();
}
function status(message, error = false) {
  statusText = message;
  statusError = error;
  let n = q("#ce-status");
  if (n) {
    n.textContent = message;
    n.dataset.error = String(error);
  }
  if (error) console.error(message);
}
function history(previous) {
  undo.push(clone(previous));
  if (undo.length > 40) undo.shift();
  redo = [];
  if(q('[data-action="undo"]')){q('[data-action="undo"]').disabled=false;q('[data-action="redo"]').disabled=true;}
}
function change(fn, rerender = true) {
  if (busy) return;
  let before = clone(state);
  try {
    fn(state);
    validate(state);
    scenes(state,data,editorial);
    history(before);
    dirty();
    if (rerender) render();
    else schedulePreview();
  } catch (error) {
    state = before;
    status(error.message, true);
  }
}
function dirty() {
  let retained=()=>new Set([state,...undo,...redo].flatMap(s=>s.photos.map(p=>p.id)));
  let ids=retained();while(undo.length>1&&[...ids].reduce((n,id)=>n+(originals.get(id)?.size||0),0)>160*1024*1024){undo.shift();ids=retained();}
  for(let id of originals.keys())if(!ids.has(id))forget(id);
  revision++;
  status("Yra neišsaugotų pakeitimų…");
  clearTimeout(saveTimer);
  let r = revision;
  saveTimer = setTimeout(async () => {
    try {
      await storage.save(clone(state));
      if (r === revision) status("Išsaugota šiame įrenginyje · " + (/* @__PURE__ */ new Date()).toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" }));
    } catch (error) {
      status("Nepavyko išsaugoti. Atsisiųskite projekto kopiją: " + error.message, true);
    }
  }, 650);
}
const options = (pairs, value) => pairs.map(([v, label]) => `<option value="${e(v)}"${String(v) === String(value) ? " selected" : ""}>${e(label)}</option>`).join("");
function field(label, path, value, type = "text", attrs = "") {
  return `<label>${label}<input data-path="${path}" type="${type}" value="${e(value)}" ${attrs}></label>`;
}
function select(label, path, value, pairs) {
  return `<label>${label}<select data-path="${path}">${options(pairs, value)}</select></label>`;
}
function check(label, path, value) {
  return `<label class="check"><input type="checkbox" data-path="${path}"${value ? " checked" : ""}>${label}</label>`;
}
function range(label, path, value, min, max, step = 1) {
  return `<label>${label} <span class="muted" data-value-for="${path}">${value}</span><input type="range" data-path="${path}" value="${value}" min="${min}" max="${max}" step="${step}"></label>`;
}
function section(title, body, open = false) {
  return `<details${open ? " open" : ""}><summary>${title}</summary><div class="ce-fields">${body}</div></details>`;
}
function render() {
  pages = scenes(state, data, editorial);
  index = Math.min(index, pages.length - 1);
  let opened = qa(".ce-controls details[open]").map((d) => d.querySelector("summary").textContent), focused = document.activeElement?.getAttribute("data-path");
  let k = currentKey(), s = effective(state, scope === "month" ? k : ""), p = state.period;
  root.dataset.tab = tab;
  root.setAttribute("aria-busy", String(busy));
  root.innerHTML = `<div class="ce-topbar"><label><span class="visually-hidden">Projekto pavadinimas</span><input class="ce-project-name" data-path="name" value="${e(state.name)}" maxlength="100" aria-label="Projekto pavadinimas"></label><div class="ce-actions"><button data-action="undo" ${!undo.length ? "disabled" : ""} aria-label="Atšaukti pakeitimą">↶ Atšaukti</button><button data-action="redo" ${!redo.length ? "disabled" : ""} aria-label="Pakartoti pakeitimą">↷ Pakartoti</button><button data-action="projects">Juodraščiai</button><button data-action="project">Išsaugoti projektą</button><button data-action="import">Atverti projektą</button><button data-action="reset">Iš naujo</button></div></div>
<div class="ce-mobile-tabs" role="tablist" aria-label="Kūrėjo rodinys"><button data-action="tab-settings" role="tab" aria-selected="${tab === "settings"}">Nustatymai</button><button data-action="tab-preview" role="tab" aria-selected="${tab === "preview"}">Peržiūra</button></div>
<div class="ce-workspace"><aside class="ce-controls" aria-label="Kalendoriaus nustatymai">
${section("01 · Laikotarpis ir lapas", `${select("Kalendoriaus tipas", "period.mode", p.mode, [["month", "Vienas mėnuo"], ["annual", "12 mėnesių viename lape"], ["year", "Metai · 12 mėnesio lapų"], ["rolling", "12 mėnesių nuo pasirinktos datos"], ["selection", "Pasirinkti mėnesiai"]])}<div class="ce-row">${field("Metai", "period.year", p.year, "number", 'min="1900" max="2100"')}${select(p.mode === "rolling" ? "Pradžios mėnuo" : "Mėnuo", p.mode === "rolling" ? "period.startMonth" : "period.month", p.mode === "rolling" ? p.startMonth : p.month, MONTHS.map((n, i) => [i + 1, n]))}</div>${p.mode === "selection" ? `<fieldset><legend>Įtraukti mėnesius</legend><div class="ce-months">${MONTHS.map((n, i) => `<label class="check"><input type="checkbox" data-month="${i + 1}"${p.selected.includes(i + 1) ? " checked" : ""}>${n}</label>`).join("")}</div></fieldset>` : ""}<div class="ce-row">${select("Popierius", "layout.paper", s.layout.paper, [["a4", "A4 · 210 × 297 mm"], ["a3", "A3 · 297 × 420 mm"], ["a5", "A5 · 148 × 210 mm"], ["letter", "Letter · 216 × 279 mm"]])}${select("Kryptis", "layout.orientation", s.layout.orientation, [["portrait", "Stačias"], ["landscape", "Gulsčias"]])}</div>${range("Paraštės (mm)", "layout.margin", s.layout.margin, 5, 25)}${select("Savaitės pradžia", "layout.weekstart", s.layout.weekstart, [[0, "Pirmadienis"], [6, "Sekmadienis"]])}${check("ISO savaičių numeriai", "layout.isoWeeks", s.layout.isoWeeks)}${check("Gretimų mėnesių dienos", "layout.neighbors", s.layout.neighbors)}${check("Išskirti savaitgalius", "layout.weekends", s.layout.weekends)}${check("Žymėti šiandieną spaudinyje", "layout.printToday", s.layout.printToday)}`, true)}
${section("02 · Šablonai ir spalvos", `<label>Keisti dizainą<select id="ce-scope">${options([["all", "Visiems mėnesiams"], ["month", "Tik šiam mėnesiui · " + k]], scope)}</select></label><small>Mėnesio išimtis išlaiko savo dizainą pakeitus bendrus nustatymus. Šablonai neištrina nuotraukų, įvykių ar užrašų.</small><div class="ce-template-grid">${Object.entries(TEMPLATES).map(([id, t]) => `<button data-template="${id}" aria-pressed="${s.theme.template === id}"><span class="ce-swatch" style="background:${t.accent}"></span>${t.name}</button>`).join("")}</div><div class="ce-palette">${PALETTES.map(([name, c, b, h], i) => `<button data-palette="${i}">${name}</button>`).join("")}<button data-action="random">Kitos spalvos</button></div>${Object.entries(colorNames).map(([k2, label]) => `<div class="ce-color"><span>${label}</span><input type="color" aria-label="${label}: spalvos parinkiklis" data-color="${k2}" value="${s.theme.colors[k2]}"><input type="text" aria-label="${label}: HEX" data-hex="${k2}" value="${s.theme.colors[k2]}" pattern="#[0-9a-fA-F]{6}" maxlength="7"></div>`).join("")}${select("Šriftas", "theme.font", s.theme.font, [["Lato", "Lato · šiltas ir aiškus"], ["Inter", "Inter · šiuolaikinis"]])}<small>Lato ir Inter šriftai naudojami pagal SIL Open Font License.</small>${range("Antraštės dydis (pt)", "theme.titleSize", s.theme.titleSize, 16, 40)}${range("Dienų dydis (pt)", "theme.bodySize", s.theme.bodySize, 7, 16)}${range("Linijos storis (pt)", "theme.lineWidth", s.theme.lineWidth, 0.1, 2, 0.1)}${check("Taupus spausdinimas · grįžtamasis režimas", "lowInk", state.lowInk)}<button data-action="clear-override">Panaikinti šio mėnesio dizaino išimtį</button>`, true)}
${section("03 · Nuotraukos", `<div class="ce-photo-drop" id="ce-drop"><label>Įkelti nuotraukas<input id="ce-photo-input" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><small>Arba nutempkite failus čia. Iki 24 nuotraukų; JPEG, PNG, WebP.</small></div><div id="ce-photo-list" class="ce-photo-list"></div><button data-action="auto-photos">Paskirstyti nuotraukas mėnesiams iš eilės</button>${select("Nuotraukos vieta", "theme.placement", s.theme.placement, [["top", "Virš kalendoriaus"], ["side", "Šalia kalendoriaus"], ["background", "Kalendoriaus fone"]])}${range("Nuotraukos aukštis / plotis (mm)", "layout.photoHeight", s.layout.photoHeight, 0, 110)}<div id="ce-photo-settings"></div><p class="muted">Kirpimo padėtis saugoma originalo santykiu. Eksportui visuomet naudojamas originalas. Foninė nuotrauka papildomai pašviesinama, kad datos liktų įskaitomos.</p>`)}
${section("04 · Datos ir asmeniniai įvykiai", `${check("Lietuvos šventinės dienos", "layers.statutory", state.layers.statutory)}${check("Atmintinos dienos (atskiras sluoksnis)", "layers.commemorative", state.layers.commemorative)}${check("Paskelbtos mokinių atostogos", "layers.school", state.layers.school)}${select("Ugdymo pakopa", "layers.schoolStage", state.layers.schoolStage, [["basic", "Pradinis ir pagrindinis"], ["secondary", "Vidurinis"]])}<p class="ce-inline-message">Mokinių atostogos: tik oficialūs 2026–2027 m. laikotarpiai. Vėlesnių metų datos nepildomos automatiškai. Švenčių taisyklės peržiūrėtos 2026-10-16; kitų metų datos apskaičiuotos, o ne paskelbtos individualiai.</p>${check("Asmeniniai įvykiai", "layers.personal", state.layers.personal)}${select("Įvykių rodymas", "layers.display", state.layers.display, [["cell", "Tekstas langeliuose ir visas priedas"], ["marks", "Ženklai langeliuose ir visas priedas"], ["legend", "Datos ir visas įrašų priedas"]])}<button data-action="event-new" class="primary">+ Pridėti įvykį</button><small>Taip pat galite paspausti dienos skaičių peržiūroje.</small><label>Ieškoti įvykio<input id="ce-event-search" type="search" placeholder="Pavadinimas, žmogus, pastaba"></label><label>Kategorija<select id="ce-event-filter">${options([["all", "Visos kategorijos"], ...Object.entries(categoryNames)], "all")}</select></label><div id="ce-event-list" class="ce-event-list"></div>`)}
${section("05 · Užrašai ir atostogų planas", `${range("Užrašų / darbų eilutės", "layout.notes", s.layout.notes, 0, 10)}<label>Šio mėnesio užrašai<textarea id="ce-notes" maxlength="2000">${e(state.notes[k] || "")}</textarea></label><small>Visas tekstas bus pateiktas mėnesio priede.</small><fieldset><legend>Jūsų darbo savaitė</legend><div class="ce-months">${DAYS.map((n, i) => `<label class="check"><input type="checkbox" data-workday="${i}"${state.workdays.includes(i) ? " checked" : ""}>${n}</label>`).join("")}</div></fieldset><div class="ce-row"><label>Nuo<input id="ce-leave-start" type="date" min="1900-01-01" max="2100-12-31" value="${state.period.year}-01-01"></label><label>Iki (imtinai)<input id="ce-leave-end" type="date" min="1900-01-01" max="2100-12-31" value="${state.period.year}-01-07"></label></div><button data-action="calculate">Skaičiuoti atostogų dienas</button><p id="ce-leave-result" class="ce-inline-message">Savaitės poilsis, šventės ir atostogų dienos skaičiuojami be dubliavimo. Sluoksnių slėpimas šio skaičiavimo nekeičia.</p><button data-action="suggest">Rodyti ilgųjų savaitgalių idėjas</button><div id="ce-suggestions" class="ce-suggestions"></div>`)}
</aside><section class="ce-preview-area" aria-label="Tiesioginė kalendoriaus peržiūra"><div class="ce-preview-toolbar"><p id="ce-page-label">Kalendorius</p><div class="ce-actions"><button data-action="zoom-out" aria-label="Sumažinti peržiūrą">−</button><button data-action="fit">Sutalpinti</button><button data-action="zoom-in" aria-label="Padidinti peržiūrą">+</button></div></div><div class="ce-preview-shell"><div class="ce-paper" id="ce-paper"></div></div><p class="muted" id="ce-preview-info">Peržiūra išlaiko tikras lapo proporcijas.</p><nav class="ce-thumbs" id="ce-thumbs" aria-label="Kalendoriaus puslapiai"></nav></section></div>
<div class="ce-exportbar"><div><strong>Paruošta jūsų planams</strong><p class="ce-status" id="ce-status" data-error="${statusError}" role="status" aria-live="polite">${e(statusText)}</p></div><div class="ce-actions"><label><span class="visually-hidden">Atsisiuntimo formatas</span><select id="ce-format" aria-label="Atsisiuntimo formatas">${options([["pdf", "PDF · visi puslapiai"], ["webp", "WebP · šis puslapis"], ["png", "PNG · šis puslapis"], ["webp-zip", "WebP · visi ZIP faile"], ["paired", "PDF ir WebP · mėnesių ZIP"], ["print", "Spausdinti visus puslapius"]], sessionStorage.getItem("ce-format") || "pdf")}</select></label><button data-action="export" class="primary">Atsisiųsti</button></div><div id="ce-progress-wrap" hidden><progress class="ce-progress" id="ce-progress" value="0" max="1"></progress><button data-action="cancel">Atšaukti ruošimą</button></div></div>
<input id="ce-project-input" type="file" accept=".zip,.k365" hidden><dialog id="ce-dialog" aria-labelledby="ce-dialog-title"></dialog>`;
  if (opened.length) qa(".ce-controls details").forEach((d) => d.open = opened.includes(d.querySelector("summary").textContent));
  renderEvents();
  renderPhotos();
  schedulePreview();
  if (focused) q(`[data-path="${focused}"]`)?.focus({ preventScroll: true });
}
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => preview().catch((error) => status(error.message, true)), 70);
}
async function preview() {
  let version = ++previewVersion;
  await document.fonts.ready;
  pages = scenes(state, data, editorial);
  index = Math.min(index, pages.length - 1);
  let page = pages[index];
  if (!page) throw Error("Pasirinkite bent vieną mėnesį");
  let cacheKey = JSON.stringify(page.items.filter((i) => i.type === "photo"));
  let urls = photoCache.get(cacheKey);
  if (!urls) {
    urls = await photoURLs(page, 85);
    photoCache.set(cacheKey, urls);
    if (photoCache.size > 18) photoCache.delete(photoCache.keys().next().value);
  }
  if (version !== previewVersion) return;
  q("#ce-paper").innerHTML = svg(page, urls);
  q("#ce-paper").style.width = `${600 * zoom}px`;
  q("#ce-paper").style.maxWidth = zoom > 1 ? "none" : "100%";
  q("#ce-page-label").textContent = `${page.label} · ${index + 1} / ${pages.length}`;
  q("#ce-thumbs").innerHTML = pages.map((p, i) => `<button data-page="${i}" aria-current="${i === index}" aria-label="${e(p.label)}"><span aria-hidden="true">${svg(p, p === page ? urls : {}).replace(/ data-editor-date="[^"<>]+" tabindex="0" role="button" aria-label="[^"<>]+"/g, "")}</span>${e(p.label)}</button>`).join("");
  let warnings = page.items.filter((i) => i.type === "photo").map((i) => {
    let n = Math.round(dpi(i.photo, i.w, i.h));
    return `Nuotraukos efektyvi raiška: ${n} PPI${n < 200 ? " · maža raiška spaudai" : n < 300 ? " · mažiau nei 300 PPI" : ""}`;
  });
  q("#ce-preview-info").textContent = `${Math.round(page.w / 72 * 25.4)} × ${Math.round(page.h / 72 * 25.4)} mm · 300 PPI: ${Math.round(page.w / 72 * 300)} × ${Math.round(page.h / 72 * 300)} px. ${warnings.join(". ")}`;
}
function renderEvents() {
  let search = (q("#ce-event-search")?.value || "").toLocaleLowerCase("lt"), filter = q("#ce-event-filter")?.value || "all";
  q("#ce-event-list").innerHTML = state.events.filter((ev) => (filter === "all" || ev.category === filter) && [ev.title, ev.person, ev.note].join(" ").toLocaleLowerCase("lt").includes(search)).map((ev) => `<article class="ce-event"><p><strong>${e(ev.icon)} ${e(ev.title)}</strong></p><p>${e(ev.start)}${ev.start !== ev.end ? " – " + e(ev.end) : ""} · ${e(categoryNames[ev.category])}${ev.repeat === "yearly" ? " · Kasmet" : ""}${ev.person ? " · " + e(ev.person) : ""}</p><div class="ce-actions"><button data-edit-event="${e(ev.id)}">Keisti</button><button data-copy-event="${e(ev.id)}">Kopijuoti</button><button data-delete-event="${e(ev.id)}">Šalinti</button></div></article>`).join("") || '<p class="muted">Įvykių nerasta. Pridėkite pirmąjį.</p>';
}
async function renderPhotos() {
  let list = q("#ce-photo-list");
  if (!list) return;
  list.innerHTML = state.photos.map((p2, i) => `<button data-select-photo="${p2.id}" aria-pressed="${p2.id === selectedPhoto}">${i + 1}. ${e(p2.name)} · ${p2.width} × ${p2.height}</button>`).join("");
  let p = state.photos.find((p2) => p2.id === selectedPhoto) || state.photos[0];
  if (!p) {
    q("#ce-photo-settings").innerHTML = '<p class="muted">Įkelkite pirmą nuotrauką. Metų rinkiniui galite įkelti 12 failų vienu metu.</p>';
    return;
  }
  selectedPhoto = p.id;
  let k = currentKey();
  q("#ce-photo-settings").innerHTML = `<hr><strong>${e(p.name)}</strong><div class="ce-actions"><button data-action="photo-prev">↑ Ankstesnė</button><button data-action="photo-next">↓ Vėlesnė</button><button data-action="photo-replace">Pakeisti</button><button data-action="photo-remove">Šalinti</button></div><div class="ce-actions"><button data-action="photo-all">Visiems mėnesiams</button><button data-action="photo-month">Tik ${e(k)}</button><button data-action="photo-none">Šį mėnesį be nuotraukos</button><button data-action="photo-copy-month">Atskiras šio mėnesio kirpimas</button></div><label>Kirpimas<select data-photo="fit">${options([["cover", "Užpildyti (kirpti)"], ["contain", "Sutalpinti visą"]], p.fit)}</select></label>${photoRange("Horizontali padėtis", "x", p.x, 0, 1, 0.01)}${photoRange("Vertikali padėtis", "y", p.y, 0, 1, 0.01)}${photoRange("Priartinimas", "zoom", p.zoom, 1, 4, 0.01)}<button data-action="photo-rotate">Pasukti 90°</button>${photoRange("Šviesumas", "brightness", p.brightness, 0.3, 1.7, 0.01)}${photoRange("Kontrastas", "contrast", p.contrast, 0.3, 1.7, 0.01)}${photoRange("Spalvų sodrumas", "saturation", p.saturation, 0, 2, 0.01)}${photoRange("Šalta ↔ šilta", "warmth", p.warmth, -1, 1, 0.01)}${photoRange("Matomumas", "opacity", p.opacity, 0.1, 1, 0.01)}${photoRange("Šviesus uždengimas", "overlay", p.overlay, 0, 0.8, 0.01)}<label>Uždengimo spalva<select data-photo="overlayColor">${options([["light", "Šviesi"], ["dark", "Tamsi"]], p.overlayColor || "light")}</select></label><label class="check"><input type="checkbox" data-photo="mono"${p.mono ? " checked" : ""}>Nespalvota nuotrauka</label><button data-action="photo-reset">Atkurti kirpimą ir filtrus</button><button data-action="photo-palette">Spalvos iš šios nuotraukos</button><p class="muted">Norėdami pakeisti kadrą, naudokite padėties slankiklius. Jie veikia ir telefone.</p>`;
}
function photoRange(label, k, value, min, max, step) {
  return `<label>${label}<input type="range" data-photo="${k}" value="${value}" min="${min}" max="${max}" step="${step}"></label>`;
}
function designTarget(s) {
  if (scope !== "month") return s;
  let k = currentKey();
  s.overrides[k] ??= { theme: {}, layout: {} };
  return s.overrides[k];
}
function setPath(s, path, value) {
  let parts = path.split("."), target = scope === "month" && (parts[0] === "theme" || parts[0] === "layout") && !["paper", "orientation"].includes(parts[1]) ? designTarget(s) : s;
  for (let part of parts.slice(0, -1)) target = target[part] ??= {};
  target[parts.at(-1)] = value;
}
function dialog(title, body) {
  let d = q("#ce-dialog");
  d.innerHTML = `<button class="ce-dialog-close" data-action="close-dialog" aria-label="Uždaryti">×</button><h2 id="ce-dialog-title">${e(title)}</h2>${body}`;
  d.showModal();
  d.querySelector("input,button,select")?.focus();
  return d;
}
function eventDialog(id, date) {
  let ev = state.events.find((x) => x.id === id) || { id: uid(), title: "", start: date || `${state.period.year}-${String(state.period.month).padStart(2, "0")}-01`, end: date || `${state.period.year}-${String(state.period.month).padStart(2, "0")}-01`, category: "family", color: state.theme.colors.personal, icon: "", note: "", person: "", repeat: "none", leapPolicy: "leap" };
  dialog(id ? "Keisti įvykį" : "Naujas įvykis", `<form id="ce-event-form" data-id="${e(ev.id)}"><label>Pavadinimas<input name="title" required maxlength="140" value="${e(ev.title)}"></label><div class="ce-row"><label>Pradžia<input type="date" name="start" value="${ev.start}" min="1900-01-01" max="2100-12-31" required></label><label>Pabaiga (imtinai)<input type="date" name="end" value="${ev.end}" min="1900-01-01" max="2100-12-31" required></label></div><div class="ce-row"><label>Kategorija<select name="category">${options(Object.entries(categoryNames), ev.category)}</select></label><label>Spalva<input type="color" name="color" value="${ev.color}"></label></div><div class="ce-row"><label>Žmogus / šeimos narys<input name="person" maxlength="80" value="${e(ev.person)}"></label><label>Ženklas<select name="icon">${options([["", "Be ženklo"], ["♥", "♥ Širdis"], ["★", "★ Žvaigždė"], ["•", "• Taškas"], ["!", "! Svarbu"]], ev.icon)}</select></label></div><label>Kartojimas<select name="repeat">${options([["none", "Vieną kartą"], ["yearly", "Kasmet nuo pradžios metų"]], ev.repeat)}</select></label><label>Vasario 29 d. nekeliamaisiais metais<select name="leapPolicy">${options([["leap", "Tik keliamaisiais metais"], ["feb28", "Vasario 28 d."], ["mar1", "Kovo 1 d."]], ev.leapPolicy)}</select></label><small>Kasmetiniam kelių dienų įvykiui išlaikoma pradinė trukmė. Pabaiga įskaitoma.</small><label>Pastaba<textarea name="note" maxlength="2000">${e(ev.note)}</textarea></label><p id="ce-event-error" role="alert"></p><div class="ce-dialog-actions"><button type="button" data-action="close-dialog">Atšaukti</button><button class="primary" type="submit">Išsaugoti įvykį</button></div></form>`);
}
async function addPhotos(files, replace = false) {
  if (busy) return;
  busy = true;
  root.setAttribute("aria-busy", "true");
  let before = clone(state), added = [];
  try {
    for (let file of files) {
      if (state.photos.length >= 24 && !replace) throw Error("Leidžiamos iki 24 nuotraukų");
      if (state.photos.reduce((n, p2) => n + (originals.get(p2.id)?.size || 0), 0) + file.size > 96 * 1024 * 1024) throw Error("Bendra nuotraukų riba – 96 MB");
      status("Skaitoma nuotrauka: " + file.name);
      let p = await upload(file);
      added.push(p.id);
      if (replace) {
        let old = state.photos.find((x) => x.id === selectedPhoto);
        state.photos[state.photos.indexOf(old)] = p;
        if (state.assignments.all === old.id) state.assignments.all = p.id;
        for (let k in state.assignments.months) if (state.assignments.months[k] === old.id) state.assignments.months[k] = p.id;
        forgetCache();
        selectedPhoto = p.id;
        break;
      }
      state.photos.push(p);
      selectedPhoto = p.id;
      if (!state.assignments.all) state.assignments.all = p.id;
      await new Promise((r) => setTimeout(r, 0));
    }
    if (state.photos.length && !state.layout.photoHeight) state.layout.photoHeight = 65;
    validate(state);
    history(before);
    dirty();
  } catch (error) {
    state = before;
    added.forEach(forget);
    status(error.message, true);
  } finally {
    busy = false;
    render();
  }
}
function forgetCache() {
  photoCache.clear();
}
async function projectList() {
  try {
    let saved = await storage.list();
    dialog("Juodraščiai šiame įrenginyje", `<p>Įkeliant kitą juodraštį dabartinis pirmiausia išsaugomas.</p><div class="ce-event-list">${saved.map((p) => `<article class="ce-event"><p><strong>${e(p.name)}</strong> · ${e(new Date(p.updated).toLocaleString("lt-LT"))}</p><button data-open-project="${e(p.id)}">Atverti</button><button data-remove-project="${e(p.id)}">Šalinti</button></article>`).join("") || "<p>Išsaugotų juodraščių nėra.</p>"}</div><div class="ce-dialog-actions"><button data-action="duplicate">Sukurti dabartinio kopiją</button><button data-action="save-now">Išsaugoti dabar</button></div>`);
  } catch (error) {
    status(error.message, true);
  }
}
async function loadProject(record) {
  clearTimeout(saveTimer);
  state = clone(record.state);
  validate(state);
  for(let id of originals.keys())forget(id);
  for (let p of record.photos) originals.set(p.id, p.blob);
  undo = [];
  redo = [];
  index = 0;
  selectedPhoto = null;
  photoCache.clear();
  render();
  status("Juodraštis atkurtas");
}
async function exportFiles() {
  if (busy) return;
  let format = q("#ce-format").value;
  sessionStorage.setItem("ce-format", format);
  let frozen=clone(state),frozenIndex=index,list;
  try{validate(frozen);list=scenes(frozen,data,editorial);}catch(error){status(error.message,true);return;}
  busy = true;
  cancelled = false;
  clearTimeout(saveTimer);
  qa("button,input,select,textarea").forEach((n) => n.disabled = true);
  q("#ce-progress-wrap").hidden = false;
  q("[data-action=cancel]").disabled = false;
  root.setAttribute("aria-busy", "true");
  let check2 = () => {
    if (cancelled) throw new DOMException("Ruošimas atšauktas", "AbortError");
  }, progress = (n, total) => {
    q("#ce-progress").max = total;
    q("#ce-progress").value = n;
    status(`Ruošiama: ${n} / ${total}`);
  };
  try {
    await document.fonts.ready;
    check2();
    let blob, name;
    if (format === "print") {
      await output.printPages(list, check2, progress);
      status("Atvertas spausdinimo langas");
    } else {
      if (format === "pdf") {
        blob = await output.pdf(list, check2, progress);
        name = `${frozen.period.year}-mano-kalendorius.pdf`;
      } else if (format === "webp" || format === "png") {
        blob = await output.raster(list[frozenIndex], `image/${format}`);
        name = output.stem(list[frozenIndex]) + (list[frozenIndex].label.includes("Įrašų") ? "-priedas" : "") + "." + format;
      } else {
        blob = await output.bundle(list, format === "paired", check2, progress);
        name = `${frozen.period.year}-kalendoriai${format === "paired" ? "-pdf-ir-webp" : ""}.zip`;
      }
      check2();
      output.download(blob, name);
      status("Failas paruoštas. Patikrinkite naršyklės atsisiuntimus.");
    }
    try {
      await storage.save(frozen);
    } catch (error) {
      status("Failas paruoštas, bet juodraštis neišsaugotas: " + error.message, true);
    }
  } catch (error) {
    status(error.name === "AbortError" ? "Ruošimas atšauktas" : error.message, error.name !== "AbortError");
  } finally {
    busy = false;
    qa("button,input,select,textarea").forEach((n) => n.disabled = false);
    q("#ce-progress-wrap").hidden = true;
    root.setAttribute("aria-busy", "false");
    q("[data-action=undo]").disabled = !undo.length;
    q("[data-action=redo]").disabled = !redo.length;
  }
}
root.addEventListener("submit", (event) => {
  if (event.target.id !== "ce-event-form") return;
  event.preventDefault();
  let form = event.target, ev = Object.fromEntries(new FormData(form));
  ev.id = form.dataset.id;
  try {
    validateEvent(ev);
    change((s) => {
      let i = s.events.findIndex((x) => x.id === ev.id);
      if (i < 0) s.events.push(ev);
      else s.events[i] = ev;
    }, false);
    q("#ce-dialog").close();
    renderEvents();
  } catch (error) {
    q("#ce-event-error").textContent = error.message;
  }
});
root.addEventListener("input", (event) => {
  let n = event.target;
  if (busy) return;
  if (n.id === "ce-event-search") {
    renderEvents();
    return;
  }
  if (n.type === "range") {
    rangeBefore ??= clone(state);
    if (n.dataset.photo) {
      let p = state.photos.find((p2) => p2.id === selectedPhoto);
      p[n.dataset.photo] = +n.value;
    } else setPath(state, n.dataset.path, +n.value);
    let v = q(`[data-value-for="${n.dataset.path}"]`);
    if (v) v.textContent = n.value;
    schedulePreview();
  }
});
root.addEventListener("change", async (event) => {
  let n = event.target;
  try {
    if (n.id === "ce-photo-input") {
      await addPhotos(n.files);
      return;
    }
    if (n.id === "ce-project-input") {
      let file = n.files[0];
      if (!file) return;
      let project = await storage.readPortable(file);
      scenes(project.state,data,editorial);
      for (let p of project.state.photos) {
        let im = await sourceFrom(project.photos.get(p.id));
        if (im.naturalWidth !== p.width || im.naturalHeight !== p.height) throw Error("Nuotraukos matmenys nesutampa su projektu");
      }
      try {
        await storage.save(state);
      } catch {
      }
      clearTimeout(saveTimer);
      state = project.state;
      state.id = uid();
      for(let id of originals.keys())forget(id);
      for (let [id, blob] of project.photos) originals.set(id, blob);
      undo = [];
      redo = [];
      index = 0;
      photoCache.clear();
      dirty();
      render();
      status("Projektas importuotas. Originalai lieka šiame įrenginyje.");
      return;
    }
    if (n.id === "ce-scope") {
      scope = n.value;
      render();
      return;
    }
    if (n.id === "ce-event-filter") {
      renderEvents();
      return;
    }
    if (n.id === "ce-notes") {
      change((s) => {
        s.notes[currentKey()] = n.value;
      }, false);
      return;
    }
    if (n.dataset.workday) {
      change((s) => s.workdays = n.checked ? [...s.workdays, +n.dataset.workday] : s.workdays.filter((x) => x !== +n.dataset.workday));
      return;
    }
    if (n.dataset.month) {
      change((s) => s.period.selected = n.checked ? [...s.period.selected, +n.dataset.month] : s.period.selected.filter((x) => x !== +n.dataset.month));
      return;
    }
    if (n.type === "range") {
      if (rangeBefore) {
        let before = rangeBefore;
        rangeBefore = null;
        try {
          validate(state);
          scenes(state,data,editorial);
          history(before);
          dirty();
        } catch (error) {
          state = before;
          render();
          throw error;
        }
      }
      return;
    }
    if (n.dataset.path) {
      let value = n.type === "checkbox" ? n.checked : n.type === "number" || n.dataset.path === "layout.weekstart" || n.dataset.path.endsWith("month") || n.dataset.path.endsWith("Month") ? +n.value : n.value;
      change((s) => {
        setPath(s, n.dataset.path, value);
        if (n.dataset.path.startsWith("period.")) index = 0;
      });
      return;
    }
    if (n.dataset.color || n.dataset.hex) {
      let k = n.dataset.color || n.dataset.hex;
      if (!/^#[0-9a-f]{6}$/i.test(n.value)) throw Error("Spalvą įrašykite HEX formatu, pvz., #19594A");
      change((s) => setPath(s, "theme.colors." + k, n.value),false);
      let c=effective(state,scope==='month'?currentKey():'').theme.colors[k];
      q(`[data-color="${k}"]`).value=c;q(`[data-hex="${k}"]`).value=c;
      return;
    }
    if (n.dataset.photo) {
      change((s) => {
        let p = s.photos.find((p2) => p2.id === selectedPhoto);
        p[n.dataset.photo] = n.type === "checkbox" ? n.checked : n.value;
      }, false);
    }
  } catch (error) {
    status(error.message, true);
  }
});
async function sourceFrom(blob) {
  const { image } = await import("./photos.js");
  return image(blob);
}
root.addEventListener("click", async (event) => {
  let n = event.target.closest("button,[data-editor-date]");
  if (!n) return;
  let a = n.dataset.action;
  try {
    if (a === "cancel") {
      cancelled = true;
      status("Atšaukiama…");
      return;
    }
    if (busy) return;
    if (n.dataset.editorDate) {
      eventDialog(null, n.dataset.editorDate);
      return;
    }
    if (n.dataset.template) {
      change((s) => {
        if (scope === "month") {
          let copy = effective(s, currentKey());
          template(copy, n.dataset.template);
          s.overrides[currentKey()] = { theme: copy.theme, layout: copy.layout };
        } else template(s, n.dataset.template);
      });
      return;
    }
    if (n.dataset.palette) {
      let [, accent, background, holiday, day = "#172d28", weekend = "#a13b51", grid = "#cbd8d3"] = PALETTES[+n.dataset.palette];
      change((s) => {
        for (let [k, v] of Object.entries({ title: accent, weekday: accent, background, holiday, day, weekend, grid, personal: background === "#1c2b34" ? "#b5d7ff" : "#285eac" })) setPath(s, "theme.colors." + k, v);
      });
      return;
    }
    if (n.dataset.page) {
      index = +n.dataset.page;
      preview();
      if (scope === "month") render();
      return;
    }
    if (n.dataset.selectPhoto) {
      selectedPhoto = n.dataset.selectPhoto;
      renderPhotos();
      return;
    }
    if (n.dataset.editEvent) {
      eventDialog(n.dataset.editEvent);
      return;
    }
    if (n.dataset.copyEvent) {
      change((s) => {
        let ev = clone(s.events.find((e2) => e2.id === n.dataset.copyEvent));
        ev.id = uid();
        ev.title = (ev.title + " (kopija)").slice(0, 140);
        s.events.push(ev);
      });
      return;
    }
    if (n.dataset.deleteEvent) {
      change((s) => s.events = s.events.filter((x) => x.id !== n.dataset.deleteEvent));
      return;
    }
    if (n.dataset.openProject) {
      let records = await storage.list(), record = records.find((p) => p.id === n.dataset.openProject);
      await storage.save(state);
      q("#ce-dialog").close();
      await loadProject(record);
      return;
    }
    if (n.dataset.removeProject) {
      await storage.remove(n.dataset.removeProject);
      q("#ce-dialog").close();
      await projectList();
      return;
    }
    if (n.dataset.applyLeave) {
      let [start2, end] = n.dataset.applyLeave.split("/");
      change((s) => s.events.push({ id: uid(), title: "Atostogos", start: start2, end, category: "vacation", color: s.theme.colors.personal, icon: "", person: "", note: "Pasirinktas ilgojo savaitgalio planas", repeat: "none", leapPolicy: "leap" }));
      status("Atostogų įvykis pridėtas tik jums pasirinkus planą.");
      return;
    }
    switch (a) {
      case "close-dialog":
        q("#ce-dialog").close();
        break;
      case "tab-settings":
        tab = "settings";
        root.dataset.tab = tab;
        qa("[role=tab]").forEach((x) => x.setAttribute("aria-selected", String(x.dataset.action === "tab-settings")));
        break;
      case "tab-preview":
        tab = "preview";
        root.dataset.tab = tab;
        qa("[role=tab]").forEach((x) => x.setAttribute("aria-selected", String(x.dataset.action === "tab-preview")));
        await preview();
        break;
      case "undo":
        if (undo.length) {
          redo.push(clone(state));
          state = undo.pop();
          dirty();
          render();
        }
        break;
      case "redo":
        if (redo.length) {
          undo.push(clone(state));
          state = redo.pop();
          dirty();
          render();
        }
        break;
      case "fit":
        zoom = 1;
        await preview();
        break;
      case "zoom-in":
        zoom = Math.min(2, zoom + 0.2);
        await preview();
        break;
      case "zoom-out":
        zoom = Math.max(0.4, zoom - 0.2);
        await preview();
        break;
      case "event-new":
        eventDialog();
        break;
      case "export":
        await exportFiles();
        break;
      case "project":
        output.download(await storage.portable(clone(state)), `${state.period.year}-mano-kalendoriaus-projektas.k365.zip`);
        status("Projekto kopija su originalais paruošta");
        break;
      case "import":
        q("#ce-project-input").click();
        break;
      case "projects":
        await projectList();
        break;
      case "duplicate":
        q("#ce-dialog").close();
        change((s) => Object.assign(s, storage.duplicate(s)));
        await storage.save(state);
        status("Sukurta atskira projekto kopija");
        break;
      case "save-now":
        await storage.save(state);
        q("#ce-dialog").close();
        status("Išsaugota šiame įrenginyje");
        break;
      case "reset":
        dialog("Pradėti iš naujo?", `<p>Pasirinkite, ką atkurti. Atkūrimą galima atšaukti mygtuku „Atšaukti“.</p><div class="ce-dialog-actions"><button data-action="reset-design">Tik dizainą</button><button data-action="reset-all">Visą kalendorių</button><button data-action="close-dialog">Tęsti kūrimą</button></div>`);
        break;
      case "reset-design":
        change((s) => {
          let f = initial();
          s.theme = f.theme;
          s.layout = f.layout;
          s.overrides = {};
          s.lowInk = false;
        });
        break;
      case "reset-all":
        change((s) => {
          let id = s.id;
          Object.assign(s, initial());
          s.id = id;
          selectedPhoto = null;
          index = 0;
        });
        break;
      case "clear-override":
        change((s) => delete s.overrides[currentKey()]);
        break;
      case "random": {
        let rgb = Array.from({ length: 3 }, () => 20 + Math.floor(Math.random() * 85));
        let accent = "#" + rgb.map((n2) => n2.toString(16).padStart(2, "0")).join("");
        change((s) => {
          setPath(s, "theme.colors.title", accent);
          setPath(s, "theme.colors.weekday", accent);
          setPath(s, "theme.colors.background", "#ffffff");
          setPath(s, "theme.colors.day", "#172d28");
          setPath(s, "theme.colors.weekend", "#a13b51");
          setPath(s, "theme.colors.holiday", "#b12f42");
          setPath(s, "theme.colors.personal", "#285eac");
          setPath(s, "theme.colors.grid", "#cbd8d3");
        });
        break;
      }
      case "auto-photos":
        if (!state.photos.length) throw Error("Pirmiausia įkelkite nuotraukas");
        change((s) => months(s).forEach(([y, m], i) => {
          s.assignments.months[monthKey(y, m)] = s.photos[i % s.photos.length].id;
          if (!s.layout.photoHeight) s.layout.photoHeight = 65;
        }));
        status("Nuotraukos paskirstytos pagal sąrašo eilę");
        break;
      case "photo-all":
        change((s) => {
          s.assignments.all = selectedPhoto;
          s.assignments.months = {};
          if (!s.layout.photoHeight) s.layout.photoHeight = 65;
        });
        break;
      case "photo-month":
        change((s) => {
          s.assignments.months[currentKey()] = selectedPhoto;
          if (!s.layout.photoHeight) s.layout.photoHeight = 65;
        });
        break;
      case "photo-copy-month":
        change((s) => {
          let old = s.photos.find((p2) => p2.id === selectedPhoto);
          if (!old) throw Error("Pasirinkite nuotrauką");
          let p = clone(old);
          p.id = uid();
          p.name = (old.name + " (kopija)").slice(0, 140);
          originals.set(p.id, originals.get(old.id));
          s.photos.push(p);
          s.assignments.months[currentKey()] = p.id;
          selectedPhoto = p.id;
        });
        break;
      case "photo-none":
        change((s) => s.assignments.months[currentKey()] = null);
        break;
      case "photo-prev":
      case "photo-next":
        change((s) => {
          let i = s.photos.findIndex((p) => p.id === selectedPhoto), j = i + (a === "photo-prev" ? -1 : 1);
          if (j >= 0 && j < s.photos.length) [s.photos[i], s.photos[j]] = [s.photos[j], s.photos[i]];
        });
        break;
      case "photo-replace": {
        let input = document.createElement("input");
        input.type = "file";
        input.accept = "image/jpeg,image/png,image/webp";
        input.onchange = () => addPhotos(input.files, true);
        input.click();
        break;
      }
      case "photo-remove":
        change((s) => {
          s.photos = s.photos.filter((p) => p.id !== selectedPhoto);
          if (s.assignments.all === selectedPhoto) s.assignments.all = null;
          for (let k in s.assignments.months) if (s.assignments.months[k] === selectedPhoto) s.assignments.months[k] = null;
          selectedPhoto = null;
        });
        break;
      case "photo-rotate":
        change((s) => {
          let p = s.photos.find((p2) => p2.id === selectedPhoto);
          p.rotation = (p.rotation + 90) % 360;
        });
        break;
      case "photo-reset":
        change((s) => Object.assign(s.photos.find((p) => p.id === selectedPhoto), { x: 0.5, y: 0.5, zoom: 1, rotation: 0, brightness: 1, contrast: 1, saturation: 1, warmth: 0, opacity: 1, overlay: 0, mono: false, fit: "cover" }));
        break;
      case "photo-palette": {
        let colors = await palette(state.photos.find((p) => p.id === selectedPhoto));
        change((s) => {
          for (let [k, v] of Object.entries({ ...colors, weekday: colors.title, day: "#172d28", weekend: "#a13b51", holiday: "#b12f42", grid: "#cbd8d3" })) setPath(s, "theme.colors." + k, v);
        });
        status("Iš nuotraukos parinktos antraštės, akcento ir šviesaus fono spalvos");
        break;
      }
      case "calculate": {
        let r = vacation(q("#ce-leave-start").value, q("#ce-leave-end").value, state.workdays, data);
        q("#ce-leave-result").textContent = `${r.total} kalendorinių dienų = ${r.leave} atostogų + ${r.rest} savaitės poilsio + ${r.holiday} šventinių darbo dienų. Abi ribos įskaitomos.`;
        break;
      }
      case "suggest": {
        let list = suggestions(state.period.year, state.workdays, data);
        q("#ce-suggestions").innerHTML = list.map((r) => `<button data-apply-leave="${r.a}/${r.b}">${r.a} – ${r.b}: ${r.total} laisvos dienos, ${r.leave} atostogų d. · Pridėti šį planą</button>`).join("") || "<p>Pagal pasirinktą darbo savaitę tinkamų pasiūlymų nėra.</p>";
        break;
      }
    }
  } catch (error) {
    status(error.message, true);
  }
});
root.addEventListener("keydown", (event) => {
  if (event.target.dataset.editorDate && ["Enter", " "].includes(event.key)) {
    event.preventDefault();
    eventDialog(null, event.target.dataset.editorDate);
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.target.matches("input,textarea,select")) {
    event.preventDefault();
    q(`[data-action=${event.shiftKey ? "redo" : "undo"}]`)?.click();
  }
});
for (let type of ["dragenter", "dragover", "dragleave", "drop"]) root.addEventListener(type, (event) => {
  let area = event.target.closest("#ce-drop");
  if (!area) return;
  event.preventDefault();
  area.classList.toggle("drag", type === "dragenter" || type === "dragover");
  if (type === "drop") addPhotos(event.dataTransfer.files);
});
window.addEventListener("beforeunload", (event) => {
  if (busy) {
    event.preventDefault();
    event.returnValue = "";
  }
});
async function start() {
  try {
    let responses = await Promise.all(["/assets/data/calendar.json", "/assets/calendar-editor/data.json"].map((url) => fetch(url).then((r) => {
      if (!r.ok) throw Error("Nepavyko įkelti kalendoriaus duomenų");
      return r.json();
    })));
    [data, editorial] = responses;
    let params = new URLSearchParams(location.search), year = Number(params.get("metai")), month = Number(params.get("menuo"));
    if (year >= 1900 && year <= 2100) state.period.year = year;
    if (params.has("menuo") && month >= 0 && month <= 12) {
      if (month === 0) state.period.mode = "annual";
      else state.period.month = month;
    }
    await Promise.all(["Lato", "Inter"].flatMap((f) => [document.fonts.load(`12px ${f}`), document.fonts.load(`bold 12px ${f}`)]));
    render();
    let records;
    try {
      records = await storage.list();
    } catch (error) {
      status("Juodraščių saugykla neprieinama. Naudokite projekto failą.", true);
      return;
    }
    if (records.length) {
      dialog("Rastas išsaugotas juodraštis", `<p><strong>${e(records[0].name)}</strong> · ${e(new Date(records[0].updated).toLocaleString("lt-LT"))}</p><p>Ar norite tęsti ankstesnį darbą?</p><div class="ce-dialog-actions"><button data-action="close-dialog">Kurti naują</button><button class="primary" data-restore="${e(records[0].id)}">Tęsti juodraštį</button></div>`);
      q("[data-restore]").addEventListener("click", async () => {
        try {
          q("#ce-dialog").close();
          await loadProject(records[0]);
        } catch (error) {
          status(error.message, true);
        }
      });
    }
    root.setAttribute("aria-busy", "false");
  } catch (error) {
    root.innerHTML = `<p role="alert">${e(error.message)}. <a href="/kurti-kalendoriu/">Bandykite dar kartą</a> arba rinkitės <a href="/menesiai/">paruoštus kalendorius</a>.</p>`;
  }
}
start();
