import { LT, CALENDAR_LT } from "./lt.js";
import { parse, iso, addDays, difference, weekday, monthLength, monthGrid, isoWeek, holidays, today } from "../calendar.js";
const MONTHS = CALENDAR_LT.months;
const MONTH_FILES = CALENDAR_LT.monthFiles;
const DAYS = CALENDAR_LT.weekdays;
const TEMPLATES = {
  minimal: { name: LT.svarus_minimalizmas, accent: "#19594a", background: "#ffffff", placement: "top", photoHeight: 0, notes: 3 },
  photo: { name: LT.didele_nuotrauka, accent: "#264b64", background: "#ffffff", placement: "top", photoHeight: 82, notes: 2 },
  pastel: { name: LT.svelnios_pasteles, accent: "#75577e", background: "#faf3f4", placement: "top", photoHeight: 45, notes: 3 },
  family: { name: LT.seimos_planai, accent: "#994d27", background: "#fffaf0", placement: "side", photoHeight: 55, notes: 5 },
  school: { name: LT.mokslo_metu_uzrasai, accent: "#225599", background: "#f5f8ff", placement: "top", photoHeight: 36, notes: 7 },
  ink: { name: LT.taupus_spausdinimas, accent: "#111111", background: "#ffffff", placement: "top", photoHeight: 0, notes: 4 }
};
const PALETTES = [[LT.miskas, "#19594a", "#ffffff", "#bd3949"], [LT.jura, "#225788", "#f4f9fc", "#b63b57"], ["Levandos", "#75577e", "#faf3f4", "#a13b51"], [LT.smelis, "#715630", "#fffaf0", "#a14032"], ["Vakaras", "#f4dfac", "#1c2b34", "#ffd8ae", "#eef5f6", "#ffc7cf", "#687b86"]];
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clone = (v) => structuredClone(v);
function initial() {
  const d = today();
  return { schema: 1, kind: "kalendorius365-projektas", id: uid(), name: LT.mano_kalendorius, period: { mode: "month", year: +d.slice(0, 4), month: +d.slice(5, 7), startMonth: 9, selected: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }, layout: { paper: "a4", orientation: "portrait", margin: 12, photoHeight: 0, notes: 3, weekstart: 0, isoWeeks: true, neighbors: true, weekends: true, printToday: false }, theme: { template: "minimal", font: "Lato", titleSize: 25, bodySize: 11, lineWidth: 0.4, placement: "top", colors: { background: "#ffffff", title: "#19594a", day: "#172d28", weekday: "#435e55", weekend: "#a13b51", holiday: "#b12f42", personal: "#285eac", grid: "#cbd8d3" } }, layers: { statutory: true, commemorative: false, school: false, schoolStage: "basic", personal: true, display: "cell" }, overrides: {}, photos: [], assignments: { all: null, months: {} }, events: [], notes: {}, workdays: [0, 1, 2, 3, 4], lowInk: false };
}
function months(s) {
  let p = s.period;
  if (p.mode === "month") return [[p.year, p.month]];
  if (p.mode === "selection") return [...new Set(p.selected)].sort((a, b) => a - b).map((m) => [p.year, m]);
  if (p.mode === "rolling") return Array.from({ length: 12 }, (_, i) => {
    let k = p.startMonth - 1 + i;
    return [p.year + Math.floor(k / 12), k % 12 + 1];
  }).filter(([y]) => y <= 2100);
  return Array.from({ length: 12 }, (_, i) => [p.year, i + 1]);
}
const monthKey = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
function effective(s, key) {
  let q = clone(s);
  if (s.overrides[key]) {
    let o = s.overrides[key];
    q.theme = { ...q.theme, ...o.theme, colors: { ...q.theme.colors, ...o.theme?.colors } };
    q.layout = { ...q.layout, ...o.layout };
  }
  if (s.lowInk) {
    q.theme.colors = { background: "#ffffff", title: "#111111", day: "#111111", weekday: "#333333", weekend: "#444444", holiday: "#111111", personal: "#222222", grid: "#bcbcbc" };
    q.layout.photoHeight = 0;
    q.theme.placement = "top";
  }
  return q;
}
function template(s, id) {
  let t = TEMPLATES[id];
  if (!t) throw Error(LT.nezinomas_sablonas);
  s.theme.template = id;
  s.theme.placement = t.placement;
  s.theme.colors = { ...s.theme.colors, background: t.background, title: t.accent, weekday: t.accent, day: "#172d28", weekend: "#a13b51", holiday: "#b12f42", personal: "#285eac", grid: id === "ink" ? "#c9c9c9" : "#cbd8d3" };
  s.layout.photoHeight = t.photoHeight;
  s.layout.notes = t.notes;
}
function validDate(s) {
  parse(s);
  if (s < "1900-01-01" || s > "2100-12-31") throw Error(LT.rinkites_data_nuo_1900_iki_2100_metu);
  return s;
}
function validateEvent(e) {
  if (!e || typeof e !== "object") throw Error(LT.neteisingas_ivykis);
  for (let k of ["title", "note", "person", "icon"]) if (typeof e[k] !== "string" || e[k].length > { title: 140, note: 2e3, person: 80, icon: 8 }[k]) throw Error(LT.per_ilgas_arba_neteisingas_ivykio_tekstas);
  if (!e.title.trim()) throw Error(LT.irasykite_ivykio_pavadinima);
  validDate(e.start);
  validDate(e.end);
  if (e.end < e.start || difference(e.start, e.end) > 366) throw Error(LT.ivykio_laikotarpis_turi_buti_nuo_1_iki_367_dienu);
  if (!["none", "yearly"].includes(e.repeat) || !["leap", "feb28", "mar1"].includes(e.leapPolicy)) throw Error(LT.neteisingas_kartojimas);
  if (!/^#[0-9a-f]{6}$/i.test(e.color) || !["birthday", "anniversary", "family", "work", "school", "vacation", "other"].includes(e.category)) throw Error(LT.neteisinga_ivykio_spalva_arba_kategorija);
  if (e.personColor !== void 0 && !/^#[0-9a-f]{6}$/i.test(e.personColor)) throw Error(LT.neteisinga_asmens_spalva);
  return e;
}
function occurrences(e, a, b) {
  let out = [];
  let duration = difference(e.start, e.end);
  if (e.repeat === "none") {
    if (e.start <= b && e.end >= a) out.push({ ...e, from: e.start, to: e.end });
    return out;
  }
  for (let y = Math.max(1900, +a.slice(0, 4) - 1); y <= +b.slice(0, 4); y++) {
    if (y < +e.start.slice(0, 4)) continue;
    let md = e.start.slice(5);
    if (md === "02-29" && monthLength(y, 2) === 28) {
      if (e.leapPolicy === "leap") continue;
      md = e.leapPolicy === "feb28" ? "02-28" : "03-01";
    }
    let from = `${y}-${md}`, to = addDays(from, duration);
    if (from <= b && to >= a) out.push({ ...e, from, to });
  }
  return out;
}
function entries(s, data, editorial, a, b) {
  let out = [];
  if (s.layers.statutory) {
    for (let y = +a.slice(0, 4); y <= +b.slice(0, 4); y++) for (let h of holidays(y, data)) if (h.date >= a && h.date <= b) out.push({ id: h.id, title: h.name, from: h.date, to: h.date, kind: "statutory", color: s.theme.colors.holiday });
  }
  if (s.layers.commemorative) for (let y = +a.slice(0, 4); y <= +b.slice(0, 4); y++) for (let h of editorial.commemorations || []) {
    let d = `${y}-${String(h.month).padStart(2, "0")}-${String(h.day).padStart(2, "0")}`;
    if (d >= a && d <= b) out.push({ id: h.id, title: h.title, from: d, to: d, kind: "commemorative", color: s.theme.colors.weekday });
  }
  if (s.layers.school) for (let h of data.school.periods) {
    if (h.stage !== LT.visi_mokiniai && !h.stage.startsWith(s.layers.schoolStage === "basic" ? "Pradinis" : "Vidurinis")) continue;
    if (h.start <= b && h.end >= a) out.push({ id: `school-${h.start}-${h.stage}`, title: `${h.name}${LT.mokiniu_atostogos}`, from: h.start, to: h.end, kind: "school", color: s.theme.colors.personal });
  }
  if (s.layers.personal) for (let e of s.events) out.push(...occurrences(e, a, b).map((x) => ({ ...x, kind: "personal" })));
  return out.sort((x, y) => x.from.localeCompare(y.from) || x.title.localeCompare(y.title, "lt"));
}
function vacation(a, b, workdays, data) {
  validDate(a);
  validDate(b);
  if (a > b || difference(a, b) > 731) throw Error(LT.rinkites_iki_dveju_metu_laikotarpi);
  let hs = /* @__PURE__ */ new Set();
  for (let y = +a.slice(0, 4); y <= +b.slice(0, 4); y++) holidays(y, data).forEach((h) => hs.add(h.date));
  let result = { total: 0, leave: 0, rest: 0, holiday: 0 };
  for (let d = a; d <= b; d = addDays(d, 1)) {
    result.total++;
    if (!workdays.includes(weekday(d))) result.rest++;
    else if (hs.has(d)) result.holiday++;
    else result.leave++;
  }
  return result;
}
function suggestions(year, workdays, data) {
  let candidates = [];
  for (let h of holidays(year, data)) {
    for (let before = 0; before <= 4; before++) for (let after = 0; after <= 4; after++) {
      let a = addDays(h.date, -before), b = addDays(h.date, after);
      if (a < "1900-01-01" || b > "2100-12-31") continue;
      let r = vacation(a, b, workdays, data);
      if (r.total >= 4 && r.leave > 0 && r.leave <= 2 && r.total / r.leave >= 3) candidates.push({ a, b, ...r });
    }
  }
  let unique = [...new Map(candidates.map((x) => [`${x.a}/${x.b}`, x])).values()];
  return unique.sort((a, b) => b.total / b.leave - a.total / a.leave || b.total - a.total || a.a.localeCompare(b.a)).slice(0, 8);
}
function validate(s) {
  if (!s || s.schema !== 1 || s.kind !== "kalendorius365-projektas") throw Error(LT.nepalaikoma_projekto_versija);
  const f = initial();
  if (typeof s.id !== "string" || s.id.length > 100 || typeof s.name !== "string" || s.name.length > 100) throw Error(LT.neteisingas_projekto_pavadinimas);
  if (!["month", "annual", "year", "rolling", "selection"].includes(s.period?.mode) || !Number.isInteger(s.period.year) || s.period.year < 1900 || s.period.year > 2100 || !Number.isInteger(s.period.month) || s.period.month < 1 || s.period.month > 12 || !Number.isInteger(s.period.startMonth) || s.period.startMonth < 1 || s.period.startMonth > 12 || !Array.isArray(s.period.selected) || !s.period.selected.length || s.period.selected.some((n) => !Number.isInteger(n) || n < 1 || n > 12)) throw Error(LT.neteisingas_laikotarpis);
  if (s.period.mode === "rolling" && s.period.year === 2100 && s.period.startMonth !== 1) throw Error(LT.laikotarpis_negali_testis_uz_2100_metu);
  for (let k of Object.keys(f.layout)) {
    let v = s.layout?.[k];
    if (typeof v !== typeof f.layout[k]) throw Error(LT.neteisingi_puslapio_nustatymai);
  }
  if (!["a3", "a4", "a5", "letter"].includes(s.layout.paper) || !["portrait", "landscape"].includes(s.layout.orientation) || ![0, 6].includes(s.layout.weekstart)) throw Error(LT.neteisingas_lapo_formatas);
  for (let [k, min, max] of [["margin", 5, 25], ["photoHeight", 0, 110], ["notes", 0, 10]]) if (!Number.isFinite(s.layout[k]) || s.layout[k] < min || s.layout[k] > max) throw Error(LT.nustatymas_neatitinka_leidziamu_ribu);
  if (!TEMPLATES[s.theme?.template] || !["Lato", "Inter"].includes(s.theme.font) || !["top", "side", "background"].includes(s.theme.placement)) throw Error(LT.neteisingas_dizainas);
  for (let k of Object.keys(f.theme.colors)) if (!/^#[0-9a-f]{6}$/i.test(s.theme.colors?.[k])) throw Error(LT.neteisinga_hex_spalva);
  for (let [k, min, max] of [["titleSize", 16, 40], ["bodySize", 7, 16], ["lineWidth", 0.1, 2]]) if (!Number.isFinite(s.theme[k]) || s.theme[k] < min || s.theme[k] > max) throw Error(LT.neteisingas_srifto_arba_linijos_dydis);
  if (!s.layers || Object.keys(f.layers).some((k) => typeof s.layers[k] !== typeof f.layers[k]) || !["basic", "secondary"].includes(s.layers.schoolStage) || !["cell", "legend", "marks"].includes(s.layers.display)) throw Error(LT.neteisingi_duomenu_sluoksniai);
  if (!Array.isArray(s.events) || s.events.length > 500) throw Error(LT.leidziama_iki_500_ivykiu);
  s.events.forEach(validateEvent);
  if (s.events.some((e) => typeof e.id !== "string" || !e.id || e.id.length > 100) || new Set(s.events.map((e) => e.id)).size !== s.events.length) throw Error(LT.neteisingi_arba_pasikartojantys_ivykiu_identifikatoriai);
  if (!Array.isArray(s.workdays) || !s.workdays.length || s.workdays.some((n) => !Number.isInteger(n) || n < 0 || n > 6)) throw Error(LT.pasirinkite_darbo_savaites_dienas);
  if (!Array.isArray(s.photos) || s.photos.length > 24) throw Error(LT.leidziamos_iki_24_nuotrauku);
  if (new Set(s.photos.map((p) => p.id)).size !== s.photos.length) throw Error(LT.pasikartojantis_nuotraukos_identifikatorius);
  for (let p of s.photos) {
    if (typeof p.name !== "string" || p.name.length > 140 || p.overlayColor !== void 0 && !["light", "dark"].includes(p.overlayColor)) throw Error(LT.neteisingi_nuotraukos_duomenys);
    if (typeof p.id !== "string" || !/^[a-z0-9-]{1,100}$/i.test(p.id) || !["image/jpeg", "image/png", "image/webp"].includes(p.type) || !Number.isFinite(p.width) || !Number.isFinite(p.height) || p.width < 1 || p.height < 1 || p.width * p.height > 4e7) throw Error(LT.neteisinga_nuotrauka);
    for (let [k, min, max] of [["x", 0, 1], ["y", 0, 1], ["zoom", 1, 4], ["brightness", 0.3, 1.7], ["contrast", 0.3, 1.7], ["saturation", 0, 2], ["warmth", -1, 1], ["opacity", 0.1, 1], ["overlay", 0, 0.8]]) if (!Number.isFinite(p[k]) || p[k] < min || p[k] > max) throw Error(LT.neteisingas_nuotraukos_filtras);
    if (![0, 90, 180, 270].includes(p.rotation) || !["cover", "contain"].includes(p.fit) || typeof p.mono !== "boolean") throw Error(LT.neteisingas_nuotraukos_kirpimas);
  }
  if (!s.overrides || typeof s.overrides !== "object" || Array.isArray(s.overrides) || Object.keys(s.overrides).length > 12) throw Error(LT.neteisingi_menesiu_nustatymai);
  for (let [key, o] of Object.entries(s.overrides)) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) throw Error(LT.neteisingas_menuo);
    let q = clone(s);
    q.overrides = {};
    q.theme = { ...s.theme, ...o.theme, colors: { ...s.theme.colors, ...o.theme?.colors } };
    q.layout = { ...s.layout, ...o.layout };
    validate(q);
  }
  if (!s.notes || typeof s.notes !== "object" || Object.entries(s.notes).some(([k, v]) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(k) || typeof v !== "string" || v.length > 2e3)) throw Error(LT.neteisingi_uzrasai);
  if (!s.assignments || typeof s.assignments.months !== "object" || Object.keys(s.assignments.months).length > 12) throw Error(LT.neteisingas_nuotrauku_paskirstymas);
  let ids = new Set(s.photos.map((p) => p.id));
  if (s.assignments.all && !ids.has(s.assignments.all) || Object.entries(s.assignments.months).some(([k, v]) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(k) || v !== null && !ids.has(v))) throw Error(LT.nuotraukos_paskyrimas_nerastas);
  if (typeof s.lowInk !== "boolean") throw Error(LT.neteisinga_taupymo_nuostata);
  return s;
}
export {
  DAYS,
  MONTHS,
  MONTH_FILES,
  PALETTES,
  TEMPLATES,
  addDays,
  clone,
  difference,
  effective,
  entries,
  holidays,
  initial,
  iso,
  isoWeek,
  monthGrid,
  monthKey,
  monthLength,
  months,
  occurrences,
  parse,
  suggestions,
  template,
  today,
  uid,
  vacation,
  validDate,
  validate,
  validateEvent,
  weekday
};
