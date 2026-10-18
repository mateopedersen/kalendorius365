import { addDays, difference, holidays, today, TZ } from "./calendar.js";
import { buildShiftIcs, buildShiftPlan, lessonConflicts, lessonFieldError, lunarIllumination, solarFor, visibleLessons } from "./phase-5-6-8-core.js";
import { download } from "./storage.js";

const $ = (selector, root = document) => root.querySelector(selector);
const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");
const isoParts = (date) => ({
  y: Number(date.slice(0, 4)),
  m: Number(date.slice(5, 7)),
  d: Number(date.slice(8, 10)),
});
const dateAt = (date, plus = 0) => addDays(date, plus);
const localFmt = new Intl.DateTimeFormat("lt-LT", {
  timeZone: TZ,
  dateStyle: "long",
  timeStyle: "short",
});
const dateFmt = new Intl.DateTimeFormat("lt-LT", {
  timeZone: "UTC",
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});
const displayDate = (date) => dateFmt.format(new Date(date + "T12:00:00Z"));
const safeFile = (name, body, type) => download(name, body, type);
const validISODate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toISOString().slice(0, 10) === value;
};
const CALENDAR_DATA = await fetch("/assets/data/calendar.json").then((r) => {
  if (!r.ok) throw Error("Kalendoriaus dienų rinkinio nepavyko įkelti.");
  return r.json();
}).catch(() => ({ holidays: [] }));
const REST_RULES = await fetch("/assets/data/lt/work-rest-rules.json").then((r) => r.ok ? r.json() : null).catch(() => null);

function readLocal(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value && value.schema === 1 ? value : fallback;
  } catch {
    return fallback;
  }
}
const writeLocal = (key, value) => localStorage.setItem(key, JSON.stringify(value));
function saveJSON(name, obj) {
  safeFile(name, JSON.stringify(obj, null, 2), "application/json;charset=utf-8");
}
async function readJSONFile(file, max = 1_000_000) {
  if (!file || file.size > max) throw Error("Failas per didelis arba nepasirinktas.");
  const data = JSON.parse(await file.text());
  if (!data || data.schema !== 1) throw Error("Nepalaikomas atsarginės kopijos formatas.");
  return data;
}
function make(tag, text, attrs = {}) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  for (const [name, value] of Object.entries(attrs)) {
    if (name === "class") node.className = value;
    else if (name === "checked") node.checked = Boolean(value);
    else if (name === "value") node.value = value;
    else node.setAttribute(name, value);
  }
  return node;
}
function replace(node, children) {
  node.replaceChildren(...children);
}

function setupShift() {
  const form = $("#shift-planner");
  if (!form) return;
  const key = "k365:phase568:shift:v1";
  const saved = readLocal(key, {});
  const hasSavedDraft = Boolean(saved.schema);
  let exceptions = Array.isArray(saved["shift-exceptions"]) ? saved["shift-exceptions"] : [];
  const requestedTemplate = new URLSearchParams(location.search).get("template");
  const todayLT = today();
  const defaultDates = { "shift-anchor": todayLT, "shift-from": todayLT, "shift-to": todayLT };
  if (!hasSavedDraft && requestedTemplate === "cycle") {
    defaultDates["shift-from"] = todayLT;
    defaultDates["shift-to"] = dateAt(todayLT, 27);
  } else if (!hasSavedDraft && requestedTemplate === "month") {
    defaultDates["shift-from"] = todayLT.slice(0, 7) + "-01";
    const [year, month] = todayLT.slice(0, 7).split("-").map(Number);
    defaultDates["shift-to"] = `${year}-${pad(month)}-${pad(new Date(Date.UTC(year, month, 0)).getUTCDate())}`;
  }
  for (const id of ["shift-anchor", "shift-from", "shift-to"]) $("#" + id).value = saved[id] || defaultDates[id];
  for (const id of ["shift-cycle", "shift-definitions", "shift-fold", "shift-view", "shift-display", "shift-week-filter"])
    if (saved[id] !== undefined) $("#" + id).value = saved[id];
  $("#shift-exception-date").value = saved["shift-exception-date"] || todayLT;
  $("#shift-exception-reason").value = saved["shift-exception-reason"] || "shift";
  const preset = $("#shift-preset");
  if (requestedTemplate === "cycle") {
    if (!hasSavedDraft) $("#shift-cycle").value = "D,D,N,N,P,P,P,P";
    $("#shift-display").value = "list";
  }
  if (requestedTemplate === "month") { $("#shift-view").value = "month"; $("#shift-display").value = "month"; }
  if (preset) preset.value = $("#shift-cycle").value === "D,D,N,N,P,P,P,P" ? "day-night" : $("#shift-cycle").value === "D,D,P,P" ? "day-rest" : "custom";
  const weekdays = ["Pirmadienis", "Antradienis", "Trečiadienis", "Ketvirtadienis", "Penktadienis", "Šeštadienis", "Sekmadienis"];
  const dayList = $("#shift-custom-days-list");
  weekdays.forEach((name, index) => {
    const day = index + 1, label = make("label"), input = make("input", undefined, { type: "checkbox", value: String(day), checked: (saved["shift-week-days"] || [1,2,3,4,5,6,7]).includes(day), "aria-label": name });
    input.id = `shift-weekday-${day}`; label.htmlFor = input.id; label.append(input, document.createTextNode(name)); dayList.append(label);
  });
  const updateCustomDays = () => { $("#shift-custom-days").hidden = $("#shift-week-filter").value !== "custom"; };
  $("#shift-week-filter").onchange = updateCustomDays; updateCustomDays();
  let latest = [];
  const message = (value, error = false) => {
    const node = $("#shift-message"); node.textContent = value; node.setAttribute("role", error ? "alert" : "status");
  };
  function persistDraft() {
    const state = Object.fromEntries(["shift-anchor", "shift-from", "shift-to", "shift-cycle", "shift-definitions", "shift-fold", "shift-view", "shift-display", "shift-week-filter", "shift-exception-date", "shift-exception-reason"].map((id) => [id, $("#" + id).value]));
    state["shift-week-days"] = Array.from(dayList.querySelectorAll("input:checked"), (input) => Number(input.value));
    state["shift-exceptions"] = exceptions;
    try { writeLocal(key, { schema: 1, ...state }); return true; }
    catch { message("Nepavyko išsaugoti juodraščio šiame įrenginyje. Atsisiųskite JSON kopiją prieš išeidami.", true); return false; }
  }
  const cycleCode = $("#shift-cycle-code"), cycleItems = $("#shift-cycle-items"), definitionList = $("#shift-definition-list");
  function readDefinitions() {
    const value = JSON.parse($("#shift-definitions").value);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Pamainų aprašai turi būti objektas.");
    return value;
  }
  function setCycle(codes) {
    if (!codes.length || codes.length > 31) return message("Cikle turi būti nuo 1 iki 31 žymos.", true);
    $("#shift-cycle").value = codes.join(",");
    preset.value = "custom";
    syncCycleEditor();
    render();
  }
  function syncCycleEditor() {
    let definitions = {};
    try { definitions = readDefinitions(); } catch { /* advanced JSON is being edited */ }
    cycleCode.replaceChildren(make("option", "P · poilsio diena", { value: "P" }), ...Object.entries(definitions).map(([code, def]) => make("option", `${code} · ${def?.name || "pamaina"}`, { value: code })));
    const codes = $("#shift-cycle").value.split(",").map((code) => code.trim()).filter(Boolean);
    replace(cycleItems, codes.map((code, index) => {
      const item = make("li"), title = code === "P" ? "Poilsio diena · P" : `${code} · ${definitions[code]?.name || "neaprašyta pamaina"}`;
      item.append(make("span", title));
      for (const [delta, label] of [[-1, "Perkelti aukštyn"], [1, "Perkelti žemyn"]]) {
        const button = make("button", delta < 0 ? "↑" : "↓", { type: "button", "aria-label": `${label}: ${title}` });
        button.disabled = index + delta < 0 || index + delta >= codes.length;
        button.onclick = () => { const next = [...codes]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; setCycle(next); };
        item.append(button);
      }
      const remove = make("button", "Pašalinti", { type: "button", "aria-label": `Pašalinti iš ciklo: ${title}` });
      remove.onclick = () => setCycle(codes.filter((_, at) => at !== index)); item.append(remove); return item;
    }));
  }
  function syncDefinitionEditor() {
    let definitions;
    try { definitions = readDefinitions(); }
    catch (error) { definitionList.replaceChildren(make("p", error.message, { class: "result" })); return; }
    replace(definitionList, Object.entries(definitions).map(([originalCode, raw]) => {
      const def = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
      const fieldset = make("fieldset", undefined, { class: "shift-definition" });
      fieldset.append(make("legend", `Pamaina ${originalCode}`));
      const controls = {};
      for (const [key, title, type, value, max] of [
        ["code", "Žyma", "text", originalCode, 4], ["name", "Pavadinimas", "text", def.name || "", 40],
        ["start", "Pradžia", "time", def.start || "", 0], ["end", "Pabaiga", "time", def.end || "", 0],
        ["break", "Neapmokama pertrauka · min.", "number", String(def.break ?? 0), 0], ["color", "Spalva", "color", def.color || "#006a44", 0],
      ]) {
        const label = make("label", title), input = make("input", undefined, { type, value, ...(max ? { maxlength: String(max) } : {}) });
        if (key === "break") { input.min = "0"; input.max = "720"; input.step = "1"; }
        controls[key] = input; label.append(input); fieldset.append(label);
      }
      const save = make("button", "Išsaugoti pamainą", { type: "button" });
      save.onclick = () => {
        const code = controls.code.value.trim().toUpperCase(), name = controls.name.value.trim(), start = controls.start.value, end = controls.end.value;
        const pause = Number(controls.break.value), color = controls.color.value;
        if (!/^[A-Z0-9]{1,4}$/.test(code) || code === "P" || (code !== originalCode && definitions[code])) return message("Naudokite unikalią 1–4 raidžių ar skaitmenų žymą; P skirta poilsiui.", true);
        if (!name || name.length > 40 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || !Number.isInteger(pause) || pause < 0 || pause > 720) return message("Patikrinkite pavadinimą, laiką ir 0–720 min. pertrauką.", true);
        if (Object.entries(definitions).some(([existing, item]) => existing !== originalCode && typeof item.color === "string" && item.color.toLowerCase() === color.toLowerCase())) return message("Kiekvienai pamainai pasirinkite skirtingą spalvą.", true);
        const next = { ...definitions }; delete next[originalCode]; next[code] = { ...def, name, start, end, break: pause, color };
        $("#shift-definitions").value = JSON.stringify(next, null, 2);
        if (code !== originalCode) {
          $("#shift-cycle").value = $("#shift-cycle").value.split(",").map((item) => item.trim() === originalCode ? code : item.trim()).join(",");
          exceptions = exceptions.map((exception) => exception.reason === "shift" && exception.code === originalCode ? { ...exception, code } : exception);
        }
        syncShiftEditors(); render(); message(`Pamaina ${code} išsaugota.`);
      };
      const remove = make("button", "Pašalinti rūšį", { type: "button" });
      remove.onclick = () => {
        if ($("#shift-cycle").value.split(",").map((item) => item.trim()).includes(originalCode)) return message("Pirmiausia pašalinkite šią žymą iš ciklo.", true);
        if (exceptions.some((exception) => exception.reason === "shift" && exception.code === originalCode)) return message("Pirmiausia pašalinkite arba pakeiskite šią pamainą naudojančias vienos dienos išimtis.", true);
        const next = { ...definitions }; delete next[originalCode]; $("#shift-definitions").value = JSON.stringify(next, null, 2); syncShiftEditors(); render();
      };
      fieldset.append(save, remove); return fieldset;
    }));
  }
  function syncExceptionCodes() {
    const select = $("#shift-exception-code"), reason = $("#shift-exception-reason").value;
    let definitions = {};
    try { definitions = readDefinitions(); } catch { /* allow JSON editing to finish */ }
    select.replaceChildren(...Object.entries(definitions).map(([code, def]) => make("option", `${code} · ${def.name || "pamaina"}`, { value: code })));
    if (!select.options.length) select.append(make("option", "Pirmiausia sukurkite pamainą", { value: "" }));
    select.disabled = reason !== "shift";
    if (reason === "shift" && !Object.hasOwn(definitions, select.value)) select.value = Object.keys(definitions)[0] || "";
    $("#shift-exception-add").disabled = reason === "shift" && !Object.keys(definitions).length;
  }
  function renderExceptions() {
    const list = $("#shift-exception-list"), labels = { shift: "Pakeista pamaina", rest: "Poilsio diena", leave: "Atostogos", sick: "Liga", other: "Kita neatvykimo diena" };
    const from = $("#shift-from").value, to = $("#shift-to").value;
    const items = exceptions.map((exception) => {
      const li = make("li"), definition = exception.reason === "shift" ? (() => { try { return readDefinitions()[exception.code]?.name || exception.code; } catch { return exception.code; } })() : "0 darbo valandų";
      const outside = from && to && (exception.date < from || exception.date > to);
      li.append(make("span", `${displayDate(exception.date)} · ${labels[exception.reason] || "Vienos dienos pakeitimas"}${exception.reason === "shift" ? ` · ${exception.code} ${definition}` : " · P"}${outside ? " · už rodomo laikotarpio, dabar netaikoma" : ""}`));
      const remove = make("button", "Pašalinti", { type: "button", "aria-label": `Pašalinti pakeitimą ${displayDate(exception.date)}` });
      remove.onclick = () => {
        const previous = exceptions; exceptions = exceptions.filter((entry) => entry.date !== exception.date);
        if (!persistDraft()) { exceptions = previous; return; }
        render(); message(`Vienos dienos pakeitimas ${displayDate(exception.date)} pašalintas; ciklas vėl taikomas.`);
      };
      li.append(remove); return li;
    });
    replace(list, items);
    list.hidden = !items.length;
  }
  function syncShiftEditors() { syncCycleEditor(); syncDefinitionEditor(); syncExceptionCodes(); renderExceptions(); }
  $("#shift-cycle-add").onclick = () => setCycle([...$("#shift-cycle").value.split(",").map((code) => code.trim()).filter(Boolean), cycleCode.value]);
  $("#shift-definition-add").onclick = () => {
    try {
      const definitions = readDefinitions();
      if (Object.keys(definitions).length >= 8) return message("Galima aprašyti iki 8 pamainų rūšių.", true);
      const code = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"].find((candidate) => candidate !== "P" && !definitions[candidate]);
      if (!code) return message("Nebėra laisvos trumpos žymos. Pakeiskite žymą JSON nustatymuose.", true);
      const colors = ["#ad5b38", "#8656a8", "#b47b22", "#247a93", "#687c35", "#7a5969", "#365f91", "#895f35", "#3d765f", "#a14561", "#594b93", "#64767f"];
      const color = colors.find((candidate) => !Object.values(definitions).some((item) => typeof item.color === "string" && item.color.toLowerCase() === candidate));
      if (!color) return message("Spalvą pamainai pasirinkite išplėstiniuose JSON nustatymuose.", true);
      definitions[code] = { name: "Nauja pamaina", start: "15:00", end: "23:00", break: 0, color };
      $("#shift-definitions").value = JSON.stringify(definitions, null, 2); syncShiftEditors(); render();
    } catch (error) { message(error.message, true); }
  };
  $("#shift-cycle").onchange = () => { syncCycleEditor(); persistDraft(); };
  $("#shift-definitions").onchange = () => { syncShiftEditors(); persistDraft(); render(); };
  $("#shift-exception-reason").onchange = syncExceptionCodes;
  $("#shift-exception-add").onclick = () => {
    const date = $("#shift-exception-date").value, reason = $("#shift-exception-reason").value;
    if (!date || date < $("#shift-from").value || date > $("#shift-to").value) return message("Pasirinkite datą rodomame laikotarpyje.", true);
    if (!exceptions.some((entry) => entry.date === date) && exceptions.length >= 370) return message("Vienam grafikui galima pridėti iki 370 vienos dienos pakeitimų.", true);
    const item = { date, reason, code: reason === "shift" ? $("#shift-exception-code").value : "P" };
    const wasExisting = exceptions.some((entry) => entry.date === date);
    const previous = exceptions;
    exceptions = [...exceptions.filter((entry) => entry.date !== date), item].sort((a, b) => a.date.localeCompare(b.date));
    if (!persistDraft()) { exceptions = previous; return; }
    render();
    const reasonLabel = { shift: "pamaina pakeista", rest: "pažymėta poilsio diena", leave: "pažymėtos atostogos", sick: "pažymėta liga", other: "pažymėta neatvykimo diena" }[reason];
    message(`${displayDate(date)}: ${reasonLabel}${wasExisting ? "; ankstesnis tos dienos pakeitimas atnaujintas" : ""}. Kitos ciklo dienos nepakeistos.`);
  };
  function compute() {
    const start = $("#shift-anchor").value, from = $("#shift-from").value, to = $("#shift-to").value;
    if (!start || !from || !to) throw Error("Įrašykite ciklo pradžią ir abi laikotarpio datas.");
    let definitions;
    try { definitions = JSON.parse($("#shift-definitions").value); } catch { throw Error("Pamainų aprašai turi būti galiojantis JSON."); }
    const legalHolidays = [...new Set(Array.from({ length: +to.slice(0, 4) - +from.slice(0, 4) + 1 }, (_, i) => +from.slice(0, 4) + i)
      .flatMap((year) => holidays(year, CALENDAR_DATA)))].filter((holiday) => holiday.date >= from && holiday.date <= to);
    const activeExceptions = exceptions.filter((exception) => exception.date >= from && exception.date <= to);
    const plan = buildShiftPlan({ anchor: start, from, to, cycleText: $("#shift-cycle").value, definitions,
      foldPolicy: $("#shift-fold").value, holidayDates: legalHolidays.map((h) => h.date), exceptions: activeExceptions, zone: TZ });
    return { ...plan, legalHolidays };
  }
  function render() {
    try {
      const result = compute(), shifts = result.visible; latest = shifts;
      renderExceptions();
      const filterMode = $("#shift-week-filter").value;
      const customWeekdays = new Set(Array.from(dayList.querySelectorAll("input:checked"), (input) => Number(input.value)));
      const shownShifts = shifts.filter((shift) => {
        const weekday = new Date(shift.date + "T12:00:00Z").getUTCDay() || 7;
        return filterMode === "all" || (filterMode === "five" && weekday <= 5) || (filterMode === "six" && weekday <= 6) || (filterMode === "custom" && customWeekdays.has(weekday));
      });
      const shiftsByDate = new Map(shownShifts.map((shift) => [shift.date, shift]));
      const holidayByDate = new Map();
      const exceptionByDate = new Map(result.exceptions.map((exception) => [exception.date, exception]));
      const exceptionLabels = { shift: "Vienos dienos pamainos pakeitimas", rest: "Poilsio diena", leave: "Atostogos", sick: "Liga", other: "Kita neatvykimo diena" };
      for(const holiday of result.legalHolidays)holidayByDate.set(holiday.date,[...(holidayByDate.get(holiday.date)||[]),holiday.name]);
      const hours = shifts.reduce((n, s) => n + s.worked, 0);
      const elapsedHours = shifts.reduce((n, s) => n + s.elapsed, 0);
      const daysInRange = difference($("#shift-from").value, $("#shift-to").value) + 1;
      const daysOff = Math.max(0, daysInRange - new Set(shifts.map((s) => s.date)).size);
      const belowRest = shifts.filter((s) => s.rest !== null && s.rest < s.requiredRest);
      const tbody = $("#shift-rows");
      replace(tbody, shownShifts.map((s) => {
        const tr = make("tr");
        const labelCell = make("td"), symbol = make("strong", s.symbol), name = make("span", ` · ${s.name}${s.exception === "shift" ? " · vienos dienos pakeitimas" : ""}${s.holidayDates.length ? " · šventė: " + s.holidayDates.join(", ") : ""}`);
        labelCell.append(symbol, name);
        const details = [s.location, s.note].filter(Boolean);
        if (details.length) labelCell.append(make("small", details.join(" · "), { class: "shift-row-note" }));
        tr.append(make("td", displayDate(s.date)), labelCell,
          make("td", `${s.startTime}–${s.endTime}`), make("td", `${s.elapsed.toFixed(2).replace(".", ",")} val.`),
          make("td", `${s.worked.toFixed(2).replace(".", ",")} val.`), make("td", s.rest === null ? "—" : `${s.rest.toFixed(2).replace(".", ",")} val.`));
        tr.style.borderInlineStart = `4px solid ${s.color}`;
        return tr;
      }));
      $("#shift-list-region").hidden = $("#shift-display").value !== "list";
      replace($("#shift-summary"), [
        ...[[shifts.length, "Pamainos"], [hours.toLocaleString("lt-LT", { maximumFractionDigits: 2 }), "Įvertintos darbo valandos"], [elapsedHours.toLocaleString("lt-LT", { maximumFractionDigits: 2 }), "Pamainų trukmė"], [shifts.filter((s) => s.code === "D").length, "Dieninės D pamainos"], [shifts.filter((s) => s.code === "N").length, "Naktinės N pamainos"], [daysOff, "Laisvos ciklo dienos"], [result.exceptions.length, "Vienos dienos pakeitimai"], [shifts.reduce((n,s)=>n+s.holidayDates.length,0), "Šventinių datų sankirtos"]].map(([v, l]) => { const box = make("div"); box.append(make("strong", String(v)), make("span", l)); return box; }),
      ]);
      const groups = new Map();
      for (const s of shifts) {
        const d = new Date(s.date + "T12:00:00Z"), monthKey=s.date.slice(0,7), monday=dateAt(s.date,-((d.getUTCDay()+6)%7)), weekKey=monday;
        const yearKey=s.date.slice(0,4);
        for (const [key,label] of [[weekKey,`Savaitė nuo ${displayDate(monday)}`],[monthKey,new Intl.DateTimeFormat("lt-LT",{month:"long",year:"numeric",timeZone:"UTC"}).format(d)],[yearKey,`${s.date.slice(0,4)} metai`]]) {
          const g=groups.get(key)||{label,count:0,day:0,night:0,hours:0,holidays:new Set()};g.count++;g.day+=s.code==="D"?1:0;g.night+=s.code==="N"?1:0;g.hours+=s.worked;s.holidayDates.forEach(x=>g.holidays.add(x));groups.set(key,g);
        }
      }
      const periodRows=[];const view=$("#shift-view").value;
      for(const [key,g] of groups){if(view==="week"&&!/^\d{4}-\d{2}-\d{2}$/.test(key))continue;if(view==="month"&&!/^\d{4}-\d\d$/.test(key))continue;if(view==="year"&&!/^\d{4}$/.test(key))continue;if(view==="list")continue;const tr=make("tr");tr.append(make("td",g.label),make("td",String(g.count)),make("td",String(g.day)),make("td",String(g.night)),make("td",`${g.hours.toFixed(2).replace(".",",")} val.`),make("td",String(g.holidays.size)));periodRows.push(tr);}
      replace($("#shift-periods"),periodRows);
      const visualization=$("#shift-visualization"), display=$("#shift-display").value;
      visualization.replaceChildren();
      if(display==="month"){
        let monthKey=$("#shift-from").value.slice(0,7), lastMonth=$("#shift-to").value.slice(0,7);
        while(monthKey<=lastMonth){
          const [year,month]=monthKey.split("-").map(Number), first=new Date(Date.UTC(year,month-1,1)), offset=(first.getUTCDay()+6)%7, length=new Date(Date.UTC(year,month,0)).getUTCDate();
          const section=make("section"), heading=make("h3",new Intl.DateTimeFormat("lt-LT",{month:"long",year:"numeric",timeZone:"UTC"}).format(first));section.className="shift-month-view";section.append(heading);
          const table=make("table",undefined,{class:"shift-calendar-table","aria-label":`Pamainų kalendorius ${heading.textContent}`}),thead=make("thead"),head=make("tr");
          ["Pr","An","Tr","Kt","Pn","Št","Sk"].forEach((day,index)=>{const th=make("th",day);th.setAttribute("aria-label",weekdays[index]);head.append(th);});thead.append(head);table.append(thead);
          const body=make("tbody"),cells=Math.ceil((offset+length)/7)*7;
          for(let i=0;i<cells;i+=7){const row=make("tr");for(let col=0;col<7;col++){
            const number=i+col-offset+1,cell=make("td");
            if(number<1||number>length){cell.setAttribute("aria-hidden","true");row.append(cell);continue;}
            const date=`${year}-${pad(month)}-${pad(number)}`,holidayNames=holidayByDate.get(date)||[],shift=shiftsByDate.get(date),exception=exceptionByDate.get(date),dateLabel=displayDate(date);
            if(col>=5)cell.classList.add("is-weekend");if(holidayNames.length)cell.classList.add("is-holiday");
            cell.setAttribute("aria-label",[dateLabel,holidayNames.length?`Įstatyminė šventė: ${holidayNames.join(", ")}`:"",exception?exceptionLabels[exception.reason]:"",shift?`${shift.symbol} · ${shift.name}, ${shift.startTime}–${shift.endTime}`:"Poilsio diena"].filter(Boolean).join(". "));
            cell.append(make("span",String(number),{class:"shift-calendar-day"}));
            if(shift){const chip=make("span",shift.symbol,{class:"shift-calendar-chip",title:`${shift.name}, ${shift.startTime}–${shift.endTime}${shift.exception==="shift"?" · vienos dienos pakeitimas":""}`});chip.style.borderInlineStart=`3px solid ${shift.color}`;cell.append(chip);}
            if(exception)cell.append(make("small",exception.reason==="shift"?"Pakeista pamaina":exceptionLabels[exception.reason],{class:`shift-exception-chip${exception.reason==="shift"?" is-shift":""}`}));
            row.append(cell);
          }body.append(row);}
          table.append(body);section.append(table);visualization.append(section);monthKey=month===12?`${year+1}-01`:`${year}-${pad(month+1)}`;
        }
        const legend=make("div");legend.className="shift-calendar-legend";const holidayLegend=make("span");holidayLegend.append(make("span",undefined,{class:"shift-legend-swatch","aria-hidden":"true"}),document.createTextNode("Įstatyminė šventė"));legend.append(holidayLegend,make("span","Pamainos žyma nurodo jos pradžios dieną."));visualization.append(legend);
      }else if(display==="week"){
        const section=make("section"),heading=make("h3","Savaitės laiko juosta");section.className="shift-week-view";section.append(heading);
        const table=make("table",undefined,{class:"data-table shift-week-table"}),thead=make("thead"),header=make("tr");header.append(make("th","Savaitė"));["Pr","An","Tr","Kt","Pn","Št","Sk"].forEach((day,index)=>{const th=make("th",day);th.setAttribute("aria-label",weekdays[index]);header.append(th);});thead.append(header);table.append(thead);
        const body=make("tbody");let monday=dateAt($("#shift-from").value,-((new Date($("#shift-from").value+"T12:00:00Z").getUTCDay()+6)%7));
        while(monday<=$("#shift-to").value){const row=make("tr"),weekEnd=dateAt(monday,6);row.append(make("th",`${displayDate(monday)} – ${displayDate(weekEnd)}`,{scope:"row"}));
          for(let col=0;col<7;col++){const date=dateAt(monday,col),cell=make("td"),shift=shiftsByDate.get(date),holidayNames=holidayByDate.get(date)||[],exception=exceptionByDate.get(date);if(col>=5)cell.classList.add("is-weekend");if(holidayNames.length)cell.classList.add("is-holiday");
            cell.setAttribute("aria-label",[displayDate(date),holidayNames.length?`Įstatyminė šventė: ${holidayNames.join(", ")}`:"",exception?exceptionLabels[exception.reason]:"",shift?`${shift.symbol} · ${shift.name}, ${shift.startTime}–${shift.endTime}`:"Poilsio diena"].filter(Boolean).join(". "));
            cell.append(make("strong",date.slice(-2)));if(shift){const item=make("div",`${shift.code} · ${shift.startTime}–${shift.endTime}`);item.style.borderInlineStart=`3px solid ${shift.color}`;cell.append(item);}if(exception)cell.append(make("small",exception.reason==="shift"?"Pakeista pamaina":exceptionLabels[exception.reason],{class:`shift-exception-chip${exception.reason==="shift"?" is-shift":""}`}));row.append(cell);
          }body.append(row);monday=dateAt(monday,7);}
        table.append(body);const scroll=make("div");scroll.className="table-scroll";scroll.setAttribute("tabindex","0");scroll.setAttribute("role","region");scroll.setAttribute("aria-label","Savaitės pamainų laiko juosta; siaurame ekrane slinkite horizontaliai");scroll.append(table);section.append(scroll);visualization.append(section);
      }else if(display==="year"){
        let year=Number($("#shift-from").value.slice(0,4)),lastYear=Number($("#shift-to").value.slice(0,4));
        while(year<=lastYear){const section=make("section"),heading=make("h3",`${year} metų apžvalga`),table=make("table",undefined,{class:"data-table shift-year-table"}),thead=make("thead"),header=make("tr");section.className="shift-year-view";section.append(heading);["Mėnuo","Pamainos","Darbo valandos","Laisvos dienos","Įstatyminės šventės"].forEach((text)=>header.append(make("th",text)));thead.append(header);table.append(thead);const body=make("tbody");
          for(let month=1;month<=12;month++){const begin=`${year}-${pad(month)}-01`,last=`${year}-${pad(month)}-${pad(new Date(Date.UTC(year,month,0)).getUTCDate())}`;if(last<$("#shift-from").value||begin>$("#shift-to").value)continue;const monthly=shownShifts.filter((s)=>s.date>=begin&&s.date<=last),days=Math.max(0,difference(begin>$("#shift-from").value?begin:$("#shift-from").value,last<$("#shift-to").value?last:$("#shift-to").value)+1),off=Math.max(0,days-new Set(monthly.map((s)=>s.date)).size),name=new Intl.DateTimeFormat("lt-LT",{month:"long",timeZone:"UTC"}).format(new Date(begin+"T12:00:00Z")),tr=make("tr");
            tr.append(make("th",name,{scope:"row"}),make("td",String(monthly.length)),make("td",monthly.reduce((sum,s)=>sum+s.worked,0).toLocaleString("lt-LT",{maximumFractionDigits:2})),make("td",String(off)),make("td",String(result.legalHolidays.filter((h)=>h.date>=begin&&h.date<=last).length)));body.append(tr);}
          table.append(body);const scroll=make("div");scroll.className="table-scroll";scroll.setAttribute("tabindex","0");scroll.setAttribute("role","region");scroll.setAttribute("aria-label",`${year} metų pamainų suvestinė; siaurame ekrane slinkite horizontaliai`);scroll.append(table);section.append(scroll);visualization.append(section);year++;}
      }
      const warnings = [];
      if (belowRest.length) warnings.push(`${belowRest.length} tarpų trumpesni už taikomą bendrą ${REST_RULES?.dailyRestHours || 11}/${REST_RULES?.extendedShiftRestHours || 24} val. atskaitą`);
      if (result.weeklyWarnings.length) warnings.push(`galimai trūksta ${REST_RULES?.weeklyRestHours || 35} val. nepertraukiamo poilsio ${result.weeklyWarnings.length} iš eilės einančių 7 dienų laikotarpiuose`);
      $("#shift-warning").textContent = `${warnings.length ? "Peržiūros pastaba: " + warnings.join("; ") + ". " : "Šiose pamainose pagal parodytą laikotarpį neužfiksuota trumpesnio nei nustatyto bendro poilsio tarpo. "}VDI informaciniame šaltinyje nurodomi bendrieji ${REST_RULES?.dailyRestHours || 11} val. paros ir ${REST_RULES?.weeklyRestHours || 35} val. savaitės poilsio dydžiai. Įrankis nepatikrina visų teisės išimčių, ankstesnio grafiko, kelių darbdavių ar apskaitos laikotarpio ir nepateikia teisėtumo išvados.`;
      message(`${shifts.length} pamainos apskaičiuotos. Faktinis laikas atsižvelgia į Europe/Vilnius vasaros laiką; darbo valandos atimant pertrauką yra planavimo įvertis.`);
      const state = Object.fromEntries(["shift-anchor", "shift-from", "shift-to", "shift-cycle", "shift-definitions", "shift-fold", "shift-view", "shift-display", "shift-week-filter", "shift-exception-date", "shift-exception-reason"].map((id) => [id, $("#" + id).value]));
      state["shift-week-days"] = Array.from(dayList.querySelectorAll("input:checked"), (input) => Number(input.value));
      state["shift-exceptions"] = exceptions;
      writeLocal(key, { schema: 1, ...state });
    } catch (error) { latest = []; $("#shift-rows").replaceChildren(); $("#shift-periods").replaceChildren(); $("#shift-summary").replaceChildren(); $("#shift-visualization").replaceChildren(); $("#shift-warning").textContent = "Patikrinkite įvestį. Teisinė atitiktis nėra nustatoma."; message(error.message, true); }
  }
  if (preset) preset.onchange = () => {
    const value = preset.value;
    if (value === "day-rest") $("#shift-cycle").value = "D,D,P,P";
    else if (value === "day-night") $("#shift-cycle").value = "D,D,N,N,P,P,P,P";
    else return;
    syncCycleEditor();
    render();
  };
  form.onsubmit = (event) => { event.preventDefault(); render(); };
  ["shift-anchor", "shift-from", "shift-to", "shift-cycle", "shift-definitions", "shift-fold", "shift-view", "shift-display", "shift-week-filter", "shift-exception-date", "shift-exception-reason"].forEach((id) => {
    $("#" + id).addEventListener("input", persistDraft);
    $("#" + id).addEventListener("change", () => { persistDraft(); if (["shift-view", "shift-display", "shift-week-filter"].includes(id)) updateCustomDays(); render(); });
  });
  dayList.onchange = () => { persistDraft(); render(); };
  const backupData = () => ({ ...Object.fromEntries(["shift-anchor", "shift-from", "shift-to", "shift-cycle", "shift-definitions", "shift-fold", "shift-view", "shift-display", "shift-week-filter", "shift-exception-date", "shift-exception-reason"].map((id) => [id, $("#" + id).value])), "shift-week-days": Array.from(dayList.querySelectorAll("input:checked"), (input) => Number(input.value)), "shift-exceptions": exceptions });
  $("#shift-json-export").onclick = () => saveJSON("pamainu-grafikas.json", { schema: 1, data: backupData() });
  $("#shift-json-import").onchange = async (event) => {
    try {
      const json = await readJSONFile(event.target.files[0]), d = json.data;
      const allowedKeys = new Set(["shift-anchor", "shift-from", "shift-to", "shift-cycle", "shift-definitions", "shift-fold", "shift-view", "shift-display", "shift-week-filter", "shift-exception-date", "shift-exception-reason", "shift-week-days", "shift-exceptions"]);
      if (!d || typeof d !== "object" || Array.isArray(d) || Object.keys(d).length > allowedKeys.size || Object.keys(d).some((key) => !allowedKeys.has(key)) || typeof d["shift-cycle"] !== "string" || d["shift-cycle"].length > 160 || typeof d["shift-definitions"] !== "string" || d["shift-definitions"].length > 5000 || (d["shift-week-days"] !== undefined && (!Array.isArray(d["shift-week-days"]) || d["shift-week-days"].length > 7 || new Set(d["shift-week-days"]).size !== d["shift-week-days"].length || d["shift-week-days"].some((n) => !Number.isInteger(n) || n<1 || n>7)))) throw Error("Kopijos turinys netinkamas.");
      const importedExceptions=d["shift-exceptions"]===undefined?[]:d["shift-exceptions"], importedDefinitions=JSON.parse(d["shift-definitions"]);
      if (!Array.isArray(importedExceptions) || importedExceptions.length > 370 || new Set(importedExceptions.map((x)=>x?.date)).size !== importedExceptions.length || importedExceptions.some((x)=>!x || typeof x.date!=="string" || !["shift","rest","leave","sick","other"].includes(x.reason) || typeof x.code!=="string")) throw Error("Vienos dienos pakeitimų sąrašas netinkamas.");
      const importedFrom=d["shift-from"],importedTo=d["shift-to"];
      if(typeof importedFrom!=="string"||typeof importedTo!=="string"||difference(importedFrom,importedTo)<0) throw Error("Kopijoje nurodytas laikotarpis netinkamas.");
      for(const exception of importedExceptions){
        difference(exception.date,exception.date);
        const invalidCode=exception.reason==="shift"?(!importedDefinitions?.[exception.code]||exception.code==="P"):exception.code!=="P";
        if(exception.date<importedFrom||exception.date>importedTo||invalidCode) throw Error("Patikrinkite vienos dienos pakeitimo datą ir pamainos žymą.");
      }
      buildShiftPlan({ anchor: d["shift-anchor"], from: importedFrom, to: importedTo, cycleText: d["shift-cycle"], definitions: importedDefinitions, foldPolicy: d["shift-fold"], exceptions: importedExceptions, zone: TZ });
      if ((d["shift-view"] !== undefined && !["week", "month", "year", "list"].includes(d["shift-view"])) || (d["shift-display"] !== undefined && !["list", "month", "week", "year"].includes(d["shift-display"])) || (d["shift-week-filter"] !== undefined && !["all", "five", "six", "custom"].includes(d["shift-week-filter"]))) throw Error("Kopijos peržiūros nustatymai netinkami.");
      for (const [id, value] of Object.entries(d)) if ($("#" + id)) $("#" + id).value = String(value);
      if (Array.isArray(d["shift-week-days"])) dayList.querySelectorAll("input").forEach((input)=>{input.checked=d["shift-week-days"].includes(Number(input.value));});
      exceptions=importedExceptions;updateCustomDays();syncShiftEditors();render();
    }
    catch (error) { message(error.message, true); } finally { event.target.value = ""; }
  };
  $("#shift-ics").onclick = () => {
    try {
      render(); if (!latest.length) throw Error("Pirmiausia pataisykite įvestį ir apskaičiuokite grafiką.");
      const defs=JSON.parse($("#shift-definitions").value);
      safeFile("pamainu-grafikas.ics", buildShiftIcs(latest, defs), "text/calendar;charset=utf-8");
    } catch (error) { message(error.message, true); }
  };
  $("#shift-print").onclick = () => window.print();
  syncShiftEditors();
  render();
  if (["cycle", "month"].includes(requestedTemplate)) {
    const explanation = requestedTemplate === "cycle" ? "Atidarytas ciklo šablonas: 2 dieninės, 2 naktinės ir 4 poilsio dienos." : "Atidarytas mėnesio šablonas su pasirinkto mėnesio dienomis.";
    message(hasSavedDraft ? `Atidarytas šablonas. Esamas ciklas ir datos išsaugoti; pakeistas tik vaizdas. ${explanation}` : explanation);
  }
}

function setupSchool() {
  const root = $("#school-planner"); if (!root) return;
  const key = "k365:phase568:school:v1";
  let hasSavedDraft = false;
  try { hasSavedDraft = Boolean(localStorage.getItem(key)); } catch { /* local persistence is optional */ }
  let state = readLocal(key, { schema: 1, title: "", days: 5, template: "regular", lessons: [], homework: [] });
  const requestedTemplate = new URLSearchParams(location.search).get("template");
  if (!hasSavedDraft && requestedTemplate === "week-grid") state.template = "regular";
  if (!hasSavedDraft && requestedTemplate === "lesson-homework") state.template = "large";
  const subjects = ["Pirmadienis", "Antradienis", "Trečiadienis", "Ketvirtadienis", "Penktadienis", "Šeštadienis"];
  const fieldNames = { start: "pradžia", end: "pabaiga", subject: "dalykas", room: "kabinetas", teacher: "mokytojo trumpinys" };
  let undoSnapshot = null;
  const put = (msg, error = false) => { const message = $("#school-message"); message.textContent = msg; message.setAttribute("role", error ? "alert" : "status"); };
  function persist() {
    try { writeLocal(key, state); return true; }
    catch { put("Nepavyko išsaugoti įrenginyje. Pakeitimai dar matomi šiame puslapyje; prieš išeidami atsisiųskite JSON kopiją.", true); return false; }
  }
  function renderLessonConflicts() {
    const message = $("#school-conflicts"), conflicts = lessonConflicts(state.lessons.filter((lesson) => lesson.day < state.days))
      .map(({ day, first, second }) => `${subjects[day]}: ${first.number} (${first.start}–${first.end}) ir ${second.number} (${second.start}–${second.end})`);
    message.hidden = !conflicts.length;
    message.textContent = conflicts.length ? `Pamokų laikai persidengia. Patikrinkite: ${conflicts.join("; ")}.` : "";
    if (conflicts.length) message.setAttribute("role", "alert");
    else message.setAttribute("role", "status");
  }
  function renderLessons() {
    const body = $("#school-lessons");
    const view = $("#school-view").value, viewDay = Number($("#school-view-day").value);
    replace(body, visibleLessons(state.lessons, { days: state.days, view, day: viewDay }).map((l) => {
      const tr = make("tr");
      tr.append(make("td", subjects[l.day], { "data-label": "Diena" })); tr.append(make("td", String(l.number), { "data-label": "Pamokos Nr." }));
      for (const [name, max] of [["start",5],["end",5],["subject",50],["room",30],["teacher",30]]) {
        const td = make("td", undefined, { "data-label": fieldNames[name] }), input = make("input", undefined, { "aria-label": `${subjects[l.day]}, ${l.number} pamoka: ${fieldNames[name]}`, maxlength: max, value: l[name] || "" });
        if (["start","end"].includes(name)) input.type = "time";
        input.onchange = () => {
          const error = lessonFieldError(name, input.value, l.start, l.end);
          input.setCustomValidity(error);
          if (error) { input.reportValidity(); return; }
          l[name] = input.value;
          if (persist()) put("Pamokos pakeitimas išsaugotas šiame įrenginyje.");
          renderLessonConflicts();
        };
        td.append(input); tr.append(td);
      }
      const td = make("td", undefined, { "data-label": "Veiksmai" }), remove = make("button", "Pašalinti", { type: "button", "aria-label": `${subjects[l.day]} ${l.number} pamoką pašalinti` });
      remove.onclick = () => {
        const index = state.lessons.indexOf(l), [removed] = state.lessons.splice(index, 1);
        if (!persist()) { state.lessons.splice(index, 0, removed); renderLessons(); return; }
        renderLessons(); put("Pamoka pašalinta.");
      };
      td.append(remove); tr.append(td); return tr;
    }));
    $("#school-title").value = state.title; $("#school-days").value = String(state.days); $("#school-template").value = state.template;
    const dayPicker = $("#lesson-add-day");
    for (const option of dayPicker.options) option.hidden = Number(option.value) >= state.days;
    if (Number(dayPicker.value) >= state.days) dayPicker.value = "0";
    const viewDayPicker = $("#school-view-day");
    for (const option of viewDayPicker.options) option.hidden = Number(option.value) >= state.days;
    if (Number(viewDayPicker.value) >= state.days) viewDayPicker.value = "0";
    $("#school-view-day").closest("label").hidden = view !== "day";
    $("#school-lessons-heading").textContent = view === "day" ? `${subjects[Number(viewDayPicker.value)]} pamokos` : "Savaitės pamokos";
    $("#school-view-status").textContent = view === "day"
      ? `Rodoma ${subjects[Number(viewDayPicker.value)].toLowerCase()}; kitos savaitės pamokos lieka tvarkaraštyje ir atsarginėje kopijoje.`
      : "Rodoma visa pasirinktos trukmės savaitė.";
    body.closest("table").dataset.template = state.template;
    renderLessonConflicts();
  }
  function renderHomework() {
    const list = $("#homework-list");
    const sorted = [...state.homework].sort((a,b) => Number(a.done)-Number(b.done) || a.due.localeCompare(b.due) || (a.priority === "high" ? -1 : 0) - (b.priority === "high" ? -1 : 0));
    const filter = $("#homework-filter").value, subjectFilter = $("#homework-subject-filter"), selectedSubject = subjectFilter.value, todayLT = today();
    const subjects = [...new Set(sorted.map((task) => task.subject))].sort((a, b) => a.localeCompare(b, "lt-LT"));
    subjectFilter.replaceChildren(make("option", "Visi dalykai", { value: "" }), ...subjects.map((subject) => make("option", subject, { value: subject })));
    subjectFilter.value = subjects.includes(selectedSubject) ? selectedSubject : "";
    const visible = sorted.filter((task) => (!subjectFilter.value || task.subject === subjectFilter.value) && (filter === "all" || filter === "completed" && task.done || filter === "upcoming" && !task.done && task.due >= todayLT || filter === "overdue" && !task.done && task.due < todayLT));
    $("#homework-count").textContent = visible.length ? `Rodoma ${visible.length} iš ${sorted.length} užduočių.` : sorted.length ? "Pagal šį filtrą užduočių nėra." : "Užduočių dar nėra.";
    replace(list, visible.map((task) => {
      const li = make("li"), check = make("input", undefined, { type: "checkbox", checked: task.done, "aria-label": `${task.subject}: atlikta` });
      check.onchange = () => { const previous = task.done; task.done = check.checked; if (!persist()) { task.done = previous; check.checked = previous; return; } renderHomework(); put(task.done ? "Užduotis pažymėta kaip atlikta." : "Užduotis vėl aktyvi."); };
      const text = make("span", `${task.subject} · ${task.task} · ${displayDate(task.due)}`);
      if (task.priority === "high" || !task.done && task.due < todayLT) text.classList.add("important"); if (task.done) text.classList.add("done");
      const edit = make("button", "Redaguoti", { type: "button", "aria-label": `${task.subject} užduotį redaguoti` });
      edit.onclick = () => {
        const form = make("form", undefined, { class: "homework-edit-form" }), subjectLabel = make("label", "Dalykas"), taskLabel = make("label", "Užduotis"), dueLabel = make("label", "Terminas");
        const subjectInput = make("input", undefined, { maxlength: 50, required: "required", value: task.subject }), taskInput = make("input", undefined, { maxlength: 180, required: "required", value: task.task }), dueInput = make("input", undefined, { type: "date", required: "required", value: task.due });
        const priorityLabel = make("label", "Prioritetas"), priorityInput = make("select");
        for (const [value, label] of [["normal", "Įprastas"], ["high", "Svarbus"]]) { const option = make("option", label, { value }); option.selected = value === task.priority; priorityInput.append(option); }
        subjectLabel.append(subjectInput); taskLabel.append(taskInput); dueLabel.append(dueInput); priorityLabel.append(priorityInput);
        const save = make("button", "Išsaugoti pakeitimus", { type: "submit" }), cancel = make("button", "Atšaukti", { type: "button" });
        cancel.onclick = renderHomework;
        form.append(subjectLabel, taskLabel, dueLabel, priorityLabel, save, cancel);
        form.onsubmit = (event) => {
          event.preventDefault();
          if (!subjectInput.value.trim() || !taskInput.value.trim() || !validISODate(dueInput.value)) { put("Patikrinkite dalyką, užduoties tekstą ir terminą.", true); return; }
          const previous = { ...task };
          Object.assign(task, { subject: subjectInput.value.trim().slice(0, 50), task: taskInput.value.trim().slice(0, 180), due: dueInput.value, priority: priorityInput.value });
          if (!persist()) { Object.assign(task, previous); return; }
          renderHomework(); put("Užduoties pakeitimai išsaugoti šiame įrenginyje.");
        };
        li.replaceChildren(form); subjectInput.focus();
      };
      const remove = make("button", "Pašalinti", { type: "button" }); remove.onclick = () => { const previous = state.homework; state.homework = state.homework.filter((x) => x !== task); if (!persist()) { state.homework = previous; return; } renderHomework(); put("Užduotis pašalinta."); };
      li.append(check, text, edit, remove); return li;
    }));
  }
  $("#school-view").onchange = renderLessons;
  $("#school-view-day").onchange = renderLessons;
  $("#school-days").onchange = (e) => { state.days = Number(e.target.value); const saved = persist(); renderLessons(); if (saved) put("Savaitės dienų pasirinkimas išsaugotas šiame įrenginyje."); };
  $("#school-title").onchange = (e) => { state.title = e.target.value.slice(0, 60); if (persist()) put("Tvarkaraščio pavadinimas išsaugotas šiame įrenginyje."); };
  $("#school-template").onchange = (e) => { state.template = e.target.value; const saved = persist(); renderLessons(); if (saved) put("Šablonas išsaugotas šiame įrenginyje."); };
  $("#school-duplicate-week").onclick = () => {
    const source = state.lessons.filter((l) => l.day === 0 && l.day < state.days);
    if (!source.length) return put("Pirmiausia pridėkite pirmadienio pamokas.");
    undoSnapshot = structuredClone(state.lessons);
    let added = 0;
    for (let day = 1; day < state.days; day++) for (const lesson of source) {
      if (state.lessons.some((x) => x.day === day && x.number === lesson.number)) continue;
      state.lessons.push({ ...lesson, day }); added++;
    }
    state.lessons.sort((a,b) => a.day-b.day || a.number-b.number); const saved = persist(); renderLessons();
    $("#school-undo").disabled = !undoSnapshot;
    if (saved) put(added ? `${added} pamoka nukopijuota į neužpildytas savaitės vietas. Esami įrašai nepakeisti; prireikus galite anuliuoti.` : "Tuščios savaitės vietos nerastos.");
  };
  $("#school-clear-week").onclick = () => {
    if (!state.lessons.length) return put("Tvarkaraštis jau tuščias.");
    undoSnapshot = structuredClone(state.lessons); state.lessons = []; const saved = persist(); renderLessons();
    $("#school-undo").disabled = !saved; if (saved) put("Savaitės pamokos pašalintos. Galite anuliuoti veiksmą.");
  };
  $("#school-undo").onclick = () => {
    if (!undoSnapshot) return;
    state.lessons = undoSnapshot; const saved = persist(); renderLessons();
    if (saved) { undoSnapshot = null; $("#school-undo").disabled = true; put("Paskutinis tvarkaraščio veiksmas atšauktas."); }
  };
  $("#lesson-add").onclick = () => {
    if (state.lessons.length >= 120) return put("Viename atsarginės kopijos faile galima turėti iki 120 pamokų.");
    const day = Math.min(state.days - 1, Number($("#lesson-add-day").value)), number = state.lessons.filter((l) => l.day === day).reduce((n, l) => Math.max(n, l.number), 0) + 1;
    state.lessons.push({ day, number, start: "", end: "", subject: "", room: "", teacher: "" }); state.lessons.sort((a, b) => a.day - b.day || a.number - b.number); const saved = persist(); renderLessons(); if (saved) put(`${subjects[day]} pridėta ${number} pamoka; nustatykite jos laiką ir dalyką.`);
  };
  $("#homework-filter").onchange = renderHomework;
  $("#homework-subject-filter").onchange = renderHomework;
  $("#homework-form").onsubmit = (e) => {
    e.preventDefault(); if (state.homework.length >= 300) return put("Pasiektas 300 užduočių limitas.");
    const task = $("#homework-task").value.trim(), subject = $("#homework-subject").value.trim(), due = $("#homework-due").value;
    if (!task || !subject || !due) return put("Užpildykite dalyką, užduotį ir terminą.");
    try { const p = isoParts(due); if (new Date(Date.UTC(p.y,p.m-1,p.d)).toISOString().slice(0,10) !== due) throw Error(); } catch { return put("Terminas turi būti galiojanti data."); }
    const item = { subject: subject.slice(0,50), task: task.slice(0,180), due, priority: $("#homework-priority").value, done: false };
    state.homework.push(item);
    if (!persist()) { state.homework.pop(); return; }
    renderHomework(); e.target.reset(); put("Užduotis pridėta ir saugoma šiame įrenginyje.");
  };
  $("#school-json-export").onclick = () => saveJSON("pamoku-tvarkarastis.json", state);
  $("#school-json-import").onchange = async (e) => {
    try {
      const backup = await readJSONFile(e.target.files[0]); const x = backup;
      if (!Array.isArray(x.lessons) || x.lessons.length > 120 || !Array.isArray(x.homework) || x.homework.length > 300 || ![5,6].includes(x.days) || typeof x.title !== "string" || x.title.length > 60) throw Error("Kopijoje yra netinkamų laukų arba per daug duomenų.");
      if (x.lessons.some((l) => !Number.isInteger(l.day) || l.day < 0 || l.day >= x.days || !Number.isInteger(l.number) || l.number < 1 || l.number > 30 || [l.start,l.end,l.subject,l.room,l.teacher].some((v) => typeof v !== "string" || v.length > 50) || (l.start && !/^([01]\d|2[0-3]):[0-5]\d$/.test(l.start)) || (l.end && !/^([01]\d|2[0-3]):[0-5]\d$/.test(l.end)) || (l.start && l.end && l.start >= l.end))) throw Error("Pamokų įrašai netinkami.");
      if (x.homework.some((t) => typeof t.task !== "string" || t.task.length > 180 || typeof t.subject !== "string" || t.subject.length > 50 || !validISODate(t.due) || typeof t.done !== "boolean" || !["high","normal"].includes(t.priority))) throw Error("Namų darbų įrašai netinkami.");
      const previous = state;
      state = { schema: 1, title: x.title, days: x.days, template: ["regular","large","compact","mono"].includes(x.template) ? x.template : "regular", lessons: x.lessons, homework: x.homework };
      if (!persist()) state = previous;
      else { renderLessons(); renderHomework(); put("Atsarginė kopija atkurta."); }
    } catch (error) { put(error.message, true); } finally { e.target.value = ""; }
  };
  $("#school-reset").onclick = () => { if (!confirm("Ištrinti šio įrenginio tvarkaraštį ir namų darbus? Jei reikia, atsisiųskite kopiją pirma.")) return; const previous = state; state = { schema: 1, title: "", days: 5, template: "regular", lessons: [], homework: [] }; if (!persist()) state = previous; else { renderLessons(); renderHomework(); put("Vietiniai duomenys ištrinti."); } };
  $("#school-print").onclick = () => window.print();
  renderLessons(); renderHomework();
  if (["week-grid", "lesson-homework"].includes(requestedTemplate)) {
    const homework = requestedTemplate === "lesson-homework";
    const target = homework ? $("#homework-section") : root;
    if (!hasSavedDraft) {
      state.template = homework ? "large" : "regular";
      persist(); renderLessons();
    }
    put(hasSavedDraft ? "Atidarytas šablonas. Esamas tvarkaraštis ir užduotys išsaugoti; pasirinkimas jų nepakeitė." : (homework ? "Atidarytas pamokų ir namų darbų šablonas." : "Atidarytas savaitės pamokų tinklelis."));
    setTimeout(() => {
      target?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      if (homework) $("#homework-subject")?.focus({ preventScroll: true });
    }, 80);
  }
}

// NOAA solar position equations: equation of time + declination; sunrise zenith 90.833°,
// civil twilight 96°. Events are calculations, not observations.
const CITY_DATA = await fetch("/assets/data/astronomy/cities.json").then((r) => {
  if (!r.ok) throw Error("Miestų koordinačių nepavyko įkelti.");
  return r.json();
}).catch(() => ({ cities: [] }));
const CITIES = Object.fromEntries(CITY_DATA.cities.map((c) => [c.id, { name: c.name, lat: c.latitude, lon: c.longitude }]));
const clock = (n) => n === null ? "—" : new Intl.DateTimeFormat("lt-LT", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(n));
function setupSun() {
  const root=$("#sun-tool"); if (!root) return;
  const dateInput=$("#sun-date"), cityInput=$("#sun-city"); if (!dateInput.value) dateInput.value=today().slice(0,4)==="2026"?"2027-01-01":today();
  const render=()=>{
    try {
      const date=dateInput.value, city=CITIES[cityInput.value]; if (!date || !city) throw Error("Pasirinkite datą ir miestą.");
      const year=Number(date.slice(0,4)); if (year<2027||year>2029) throw Error("Ši lentelė skirta 2027–2029 metams.");
      const {sunrise,sunset,noon,dayMinutes,civilStart,civilEnd}=solarFor(date,city);
      const delta=solarFor(dateAt(date,-1),city).dayMinutes, tomorrowDelta=solarFor(dateAt(date,1),city).dayMinutes-dayMinutes, change=dayMinutes-delta;
      $("#sun-summary").textContent=`${displayDate(date)} · ${city.name} · Europe/Vilnius. Saulėtekis ${clock(sunrise)}, Saulės vidurdienis ${clock(noon)}, saulėlydis ${clock(sunset)}. Dienos šviesa ${Math.floor(dayMinutes/60)} val. ${pad(dayMinutes%60)} min.; palyginti su ankstesne diena ${change>=0?"+":"−"}${Math.abs(change)} min., kitą dieną ${tomorrowDelta>=0?"+":"−"}${Math.abs(tomorrowDelta)} min.`;
      const {m}=isoParts(date), length=new Date(Date.UTC(year,m,0)).getUTCDate(), rows=[];
      const monthData=[];
      for(let d=1;d<=length;d++){
        const day=`${year}-${pad(m)}-${pad(d)}`, s=solarFor(day,city), tr=make("tr");monthData.push({date:day,...s});
        for(const value of [displayDate(day),clock(s.sunrise),clock(s.noon),clock(s.sunset),`${Math.floor(s.dayMinutes/60)} val. ${pad(s.dayMinutes%60)} min.`,`${clock(s.civilStart)} – ${clock(s.civilEnd)}`])tr.append(make("td",value)); rows.push(tr);
      }
      $("#sun-table-caption").textContent=`${city.name}: ${new Intl.DateTimeFormat("lt-LT",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(date+"T12:00:00Z"))}`;replace($("#sun-rows"),rows);
      const monthChart=$("#sun-chart"), total=length; monthChart.replaceChildren();
      const monthSvg=document.createElementNS("http://www.w3.org/2000/svg","svg");monthSvg.setAttribute("viewBox",`0 0 ${total*8} 92`);monthSvg.setAttribute("role","img");monthSvg.setAttribute("aria-label",`${city.name}: ${m} mėnesio dienos šviesos trukmė nuo ${Math.floor(Math.min(...monthData.map((x)=>x.dayMinutes))/60)} iki ${Math.floor(Math.max(...monthData.map((x)=>x.dayMinutes))/60)} valandų`);
      monthData.forEach((s,index)=>{const rect=document.createElementNS("http://www.w3.org/2000/svg","rect");rect.setAttribute("x",String(index*8+1));rect.setAttribute("y",String(84-s.dayMinutes/24));rect.setAttribute("width","5");rect.setAttribute("height",String(s.dayMinutes/24));rect.setAttribute("rx","1");rect.setAttribute("fill","#006a44");rect.setAttribute("aria-hidden","true");monthSvg.append(rect);});monthChart.append(monthSvg);

      const yearLength=year%4===0&&(year%100!==0||year%400===0)?366:365, yearData=[];
      for(let day=1;day<=yearLength;day++){const stamp=new Date(Date.UTC(year,0,day)).toISOString().slice(0,10);yearData.push({date:stamp,...solarFor(stamp,city)});}
      const yearChart=$("#sun-year-chart"),yearSvg=document.createElementNS("http://www.w3.org/2000/svg","svg");yearChart.replaceChildren();yearSvg.setAttribute("viewBox",`0 0 ${yearLength} 190`);yearSvg.setAttribute("role","img");yearSvg.setAttribute("aria-label",`${city.name}, ${year} m.: kiekvienos metų dienos apskaičiuota šviesaus paros meto trukmė. Mėnesių ribos pažymėtos skaičiais.`);
      const baseLine=document.createElementNS("http://www.w3.org/2000/svg","line");baseLine.setAttribute("x1","0");baseLine.setAttribute("x2",String(yearLength));baseLine.setAttribute("y1","168");baseLine.setAttribute("y2","168");baseLine.setAttribute("stroke","#8793a1");yearSvg.append(baseLine);
      yearData.forEach((s,index)=>{const rect=document.createElementNS("http://www.w3.org/2000/svg","rect");rect.setAttribute("x",String(index));rect.setAttribute("y",String(166-s.dayMinutes*.125));rect.setAttribute("width","0.82");rect.setAttribute("height",String(s.dayMinutes*.125));rect.setAttribute("fill","#006a44");rect.setAttribute("aria-hidden","true");yearSvg.append(rect);});
      for(let month=1;month<=12;month++){const start=Date.UTC(year,month-1,1),index=Math.round((start-Date.UTC(year,0,1))/DAY),tick=document.createElementNS("http://www.w3.org/2000/svg","text");tick.setAttribute("x",String(index+2));tick.setAttribute("y","184");tick.setAttribute("font-size","8");tick.setAttribute("fill","#52606d");tick.textContent=pad(month);yearSvg.append(tick);if(month>1){const line=document.createElementNS("http://www.w3.org/2000/svg","line");line.setAttribute("x1",String(index));line.setAttribute("x2",String(index));line.setAttribute("y1","12");line.setAttribute("y2","168");line.setAttribute("stroke","#c8d0da");line.setAttribute("stroke-dasharray","2 3");yearSvg.append(line);}}
      yearChart.append(yearSvg);
      $("#sun-year-caption").textContent=`${city.name}: ${year} metų apskaičiuota dienos šviesa; mėnesio vidurkis ir kraštinės dienos.`;
      const yearRows=[];
      for(let month=1;month<=12;month++){const days=yearData.filter((entry)=>+entry.date.slice(5,7)===month),shortest=days.reduce((a,b)=>a.dayMinutes<=b.dayMinutes?a:b),longest=days.reduce((a,b)=>a.dayMinutes>=b.dayMinutes?a:b),average=Math.round(days.reduce((sum,item)=>sum+item.dayMinutes,0)/days.length),tr=make("tr");
        tr.append(make("th",new Intl.DateTimeFormat("lt-LT",{month:"long",timeZone:"UTC"}).format(new Date(Date.UTC(year,month-1,1))),{scope:"row"}),make("td",`${Math.floor(average/60)} val. ${pad(average%60)} min.`),make("td",`${displayDate(shortest.date)} · ${Math.floor(shortest.dayMinutes/60)} val. ${pad(shortest.dayMinutes%60)} min.`),make("td",`${displayDate(longest.date)} · ${Math.floor(longest.dayMinutes/60)} val. ${pad(longest.dayMinutes%60)} min.`));yearRows.push(tr);}
      replace($("#sun-year-rows"),yearRows);
    } catch(error){$("#sun-summary").textContent=error.message;}
  };
  $("#sun-calculate").onclick=render;dateInput.onchange=render;cityInput.onchange=render;render();
}

const phaseName = { new: "Jaunatis", first: "Priešpilnis · pirmasis ketvirtis", full: "Pilnatis", last: "Delčia · paskutinis ketvirtis" };
async function setupMoon() {
  if (!$("#moon-tool") && !$("#moon-year-tool") && !$("#season-rows")) return;
  try {
    const [data, seasons] = await Promise.all([
      fetch("/assets/data/astronomy/moon-phases-utc.json").then((r)=>{if(!r.ok)throw Error("Mėnulio duomenų nepavyko įkelti.");return r.json();}),
      fetch("/assets/data/astronomy/seasons-utc.json").then((r)=>{if(!r.ok)throw Error("Metų laikų duomenų nepavyko įkelti.");return r.json();}),
    ]);
    const instants=data.events.map(e=>({ ...e, instant:Date.parse(e.utc) }));
    const newMoons=instants.filter(e=>e.phase==="new").map(e=>e.instant);
    function renderMoon(y,m,tbody,caption) {
      const selected=instants.filter(e=>{const t=new Date(e.instant);const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(t).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));return +p.year===y&&+p.month===m;});
      replace(tbody,selected.map(e=>{const tr=make("tr"), at=new Date(e.instant), percent=lunarIllumination(e.instant,newMoons);tr.append(make("td",phaseName[e.phase]),make("td",localFmt.format(at)),make("td",percent===null?"—":`apie ${percent} %`));return tr;}));
      if(caption)caption.textContent=`${new Intl.DateTimeFormat("lt-LT",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(y,m-1,1)))} · ${selected.length} pagrindinės fazės`;
      return selected;
    }
    const next=instants.find(e=>e.instant>Date.now());if($("#moon-next"))$("#moon-next").textContent=next?`Artimiausia šiame kalendoriuje rodoma fazė: ${phaseName[next.phase]}, ${localFmt.format(new Date(next.instant))}.`:"Artimiausia fazė dar nepatenka į šio puslapio duomenų laikotarpį.";
    if($("#moon-tool")){
      const year=$("#moon-year"),month=$("#moon-month"),tbody=$("#moon-rows"),caption=$("#moon-caption");
      const draw=()=>{const rows=renderMoon(+year.value,+month.value,tbody,caption);const grid=$("#moon-calendar");grid.replaceChildren();grid.setAttribute("role","grid");grid.setAttribute("aria-label",`${year.value} m. ${month.options[month.selectedIndex].text} kalendorius`);const weekNames=["Pr","An","Tr","Kt","Pn","Št","Sk"];for(const name of weekNames)grid.append(make("div",name,{class:"moon-day", "data-weekday":"true",role:"columnheader"}));const offset=(new Date(Date.UTC(+year.value,+month.value-1,1)).getUTCDay()+6)%7;for(let i=0;i<offset;i++)grid.append(make("div","",{class:"moon-day",role:"presentation"}));const length=new Date(Date.UTC(+year.value,+month.value,0)).getUTCDate();const dayEvents=new Map();for(const e of rows){const t=new Date(e.instant),p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(t).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));const d=+p.day;dayEvents.set(d,[...(dayEvents.get(d)||[]),e]);}for(let d=1;d<=length;d++){const cell=make("div",String(d),{class:"moon-day",role:"gridcell"});for(const event of dayEvents.get(d)||[])cell.append(make("small",phaseName[event.phase]));grid.append(cell);} };
      $("#moon-show").onclick=draw;year.onchange=draw;month.onchange=draw;draw();
    }
    for(const node of document.querySelectorAll("#moon-year-tool")){const year=+node.dataset.year,grid=$("#moon-year-grid",node);for(let m=1;m<=12;m++){const section=make("section",undefined,{class:"panel moon-month"});section.append(make("h3",new Intl.DateTimeFormat("lt-LT",{month:"long",timeZone:"UTC"}).format(new Date(Date.UTC(year,m-1,1)))));const table=make("table"),head=make("thead"),headRow=make("tr"),body=make("tbody");for(const label of ["Fazė","Momentas Lietuvoje","Apšviesto disko įvertis"])headRow.append(make("th",label,{scope:"col"}));head.append(headRow);table.append(head,body);renderMoon(year,m,body);section.append(table);grid.append(section);}}
    const seasonsBody=$("#season-rows");if(seasonsBody){replace(seasonsBody,seasons.events.filter(e=>[2027,2028,2029].includes(e.year)).map(e=>{const tr=make("tr");tr.append(make("td",String(e.year)),...e.utc.map(value=>make("td",localFmt.format(new Date(value)))));return tr;}));}
  } catch(error) { for(const id of ["moon-next","moon-rows","season-rows"]){const node=$("#"+id);if(node)node.textContent=error.message;} }
}

function setupHomeLink() {
  const host=$("[data-astro-links]"); if (!host) return;
  const links = [["/saule/", "Saulėtekis ir dienos ilgumas"], ["/menulio-fazes/", "Mėnulio fazės"], ["/astronominis-kalendorius/", "Astronominis kalendorius"]];
  replace(host, links.flatMap(([href, label], index) => { const out = [make("a", label, { href })]; if (index < links.length - 1) out.push(make("span", " · ", { "aria-hidden": "true" })); return out; }));
}

setupShift(); setupSchool(); setupSun(); setupMoon(); setupHomeLink();
