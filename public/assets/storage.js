import { parse, zonedInstant } from "./calendar.js?v=ceb08079403f";
import { WEATHER_CITY_IDS } from "./data/weather-cities.js?v=ceb08079403f";
export const KEY = "kalendorius365:v1";
export const empty = () => ({
  schema: 1,
  events: [],
  tasks: [],
  notes: {},
  preferences: {},
});
const text = (v, max) => typeof v === "string" && v.length <= max;
const date = (v) => {
  try {
    parse(v);
    return true;
  } catch {
    return false;
  }
};
export function validate(x) {
  if (
    !x ||
    x.schema !== 1 ||
    !Array.isArray(x.events) ||
    !Array.isArray(x.tasks) ||
    !x.notes ||
    typeof x.notes !== "object" ||
    Array.isArray(x.notes) ||
    !x.preferences ||
    typeof x.preferences !== "object" ||
    Array.isArray(x.preferences)
  )
    throw Error("Nepalaikomas atsarginės kopijos formatas");
  if (
    x.events.length > 10000 ||
    x.tasks.length > 10000 ||
    Object.keys(x.notes).length > 10000
  )
    throw Error("Per daug įrašų");
  const ids = new Set();
  for (const e of x.events) {
    if (
      !text(e.id, 100) ||
      ids.has(e.id) ||
      !text(e.title, 200) ||
      !e.title.trim() ||
      !text(e.description, 5000) ||
      !Number.isInteger(e.category) ||
      e.category < 0 ||
      e.category > 6 ||
      typeof e.allDay !== "boolean" ||
      typeof e.important !== "boolean" ||
      !["none", "daily", "weekly", "monthly", "yearly"].includes(e.repeat) ||
      !text(e.start, 16) ||
      !text(e.end, 16) ||
      e.end < e.start
    )
      throw Error("Neteisingas įvykis");
    ids.add(e.id);
    if (e.allDay) {
      if (!date(e.start) || !date(e.end)) throw Error("Neteisinga įvykio data");
    } else {
      zonedInstant(e.start);
      zonedInstant(e.end);
    }
    if (e.repeat !== "none" && e.start.slice(0, 10) !== e.end.slice(0, 10))
      throw Error("Pasikartojantis įvykis turi tilpti į vieną dieną");
    if (e.until && (!date(e.until) || e.until < e.start.slice(0, 10)))
      throw Error("Neteisinga kartojimo pabaiga");
  }
  const tids = new Set();
  for (const t of x.tasks) {
    if (
      !text(t.id, 100) ||
      tids.has(t.id) ||
      !date(t.date) ||
      !text(t.title, 300) ||
      !t.title.trim() ||
      typeof t.done !== "boolean"
    )
      throw Error("Neteisinga užduotis");
    tids.add(t.id);
  }
  for (const [k, v] of Object.entries(x.notes))
    if (!date(k) || !text(v, 10000)) throw Error("Neteisingas užrašas");
  if (
    x.preferences.visible !== undefined &&
    (!Array.isArray(x.preferences.visible) ||
      x.preferences.visible.length !== 7 ||
      x.preferences.visible.some((v) => typeof v !== "boolean"))
  )
    throw Error("Neteisingi kalendoriaus sluoksniai");
  for (const k of [
    "holidays",
    "seconds",
    "hour12",
    "large-text",
    "high-contrast",
  ])
    if (x.preferences[k] !== undefined && typeof x.preferences[k] !== "boolean")
      throw Error("Neteisingos nuostatos");
  if (
    x.preferences.city !== undefined &&
    x.preferences.city !== "auto" &&
    !WEATHER_CITY_IDS.has(x.preferences.city)
  )
    throw Error("Neteisingas miestas");
  if (JSON.stringify(x).length > 4e6) throw Error("Kopija per didelė");
  return {
    schema: 1,
    events: x.events.map((e) => ({ ...e })),
    tasks: x.tasks.map((t) => ({ ...t })),
    notes: { ...x.notes },
    preferences: { ...x.preferences },
  };
}
export class Store {
  constructor(storage) {
    this.storage = storage;
    this.error = "";
    try {
      this.storage ||= globalThis.localStorage;
      const raw = this.storage.getItem(KEY);
      this.raw = raw;
      this.data = raw ? validate(JSON.parse(raw)) : empty();
    } catch {
      this.data = empty();
      this.error =
        "Nepavyko perskaityti vietinių duomenų. Ankstesnis įrašas nepakeistas. Eksportuokite kopiją prieš tęsdami.";
      this.locked = true;
    }
  }
  save(next) {
    if (this.locked) throw Error(this.error);
    const clean = validate(next);
    try {
      this.storage.setItem(KEY, JSON.stringify(clean));
    } catch {
      throw Error(
        "Naršyklė neleido išsaugoti. Patikrinkite vietos ir privatumo nustatymus; eksportuokite duomenų kopiją.",
      );
    }
    this.data = clean;
  }
  update(fn) {
    let next = structuredClone(this.data);
    fn(next);
    this.save(next);
  }
  restore(raw) {
    const clean = validate(JSON.parse(raw));
    this.storage.setItem(KEY, JSON.stringify(clean));
    this.data = clean;
    this.locked = false;
    this.error = "";
  }
  clearPersonalData() {
    const clean = validate({
      schema: 1,
      events: [],
      tasks: [],
      notes: {},
      preferences: this.data.preferences,
    });
    try {
      this.storage.setItem(KEY, JSON.stringify(clean));
      this.data = clean;
      this.locked = false;
      this.error = "";
      return true;
    } catch {
      try {
        this.storage.removeItem(KEY);
      } catch {
        throw Error(
          "Nepavyko ištrinti duomenų. Patikrinkite naršyklės svetainės saugojimo nustatymus.",
        );
      }
      this.data = empty();
      this.locked = false;
      this.error = "";
      return false;
    }
  }
}
export function download(name, content, type) {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
