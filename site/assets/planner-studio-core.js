const DAYS = ["Pirmadienis", "Antradienis", "Trečiadienis", "Ketvirtadienis", "Penktadienis", "Šeštadienis", "Sekmadienis"];
const THEMES = new Set(["forest", "blue", "amber", "mono"]);
const LAYOUTS = { weekly: new Set(["time", "priority"]), daily: new Set(["time", "priority"]), family: new Set(["people", "shared"]) };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function weekDates(date, weekStart = 1, count = 7) {
  if (!Number.isInteger(weekStart) || ![0, 1].includes(weekStart)) throw new TypeError("Savaitės pradžia turi būti pirmadienis arba sekmadienis.");
  if (!Number.isInteger(count) || count < 1 || count > 7) throw new RangeError("Dienų skaičius turi būti nuo 1 iki 7.");
  if (!ISO_DATE.test(date)) throw new TypeError("Nurodykite tikrą kalendorinę datą.");
  const parts = date.split("-").map(Number);
  const anchor = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12));
  if (anchor.getUTCFullYear() !== parts[0] || anchor.getUTCMonth() !== parts[1] - 1 || anchor.getUTCDate() !== parts[2]) throw new TypeError("Nurodykite tikrą kalendorinę datą.");
  const offset = (anchor.getUTCDay() - weekStart + 7) % 7;
  anchor.setUTCDate(anchor.getUTCDate() - offset);
  return Array.from({ length: count }, (_, index) => {
    const current = new Date(anchor);
    current.setUTCDate(current.getUTCDate() + index);
    return current.toISOString().slice(0, 10);
  });
}

function minutes(value, allow24 = false) {
  if (allow24 && value === "24:00") return 1440;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function dailySlots(start, end, step = 30, endNextDay = false) {
  const from = minutes(start);
  let to = minutes(end, true);
  if (!Number.isInteger(step) || ![15, 30, 60].includes(step)) throw new RangeError("Laiko žingsnis turi būti 15, 30 arba 60 minučių.");
  if (from === null || to === null) throw new TypeError("Patikrinkite pradžios ir pabaigos laiką.");
  if (endNextDay) to += 1440;
  if (to <= from || to - from > 24 * 60) throw new RangeError("Pabaiga turi būti vėliau už pradžią; kitą dieną pasirinkite atskirai.");
  const result = [];
  for (let at = from; at < to; at += step) {
    const dayOffset = Math.floor(at / 1440);
    const minuteOfDay = at % 1440;
    result.push({ dayOffset, minutes: at, label: String(Math.floor(minuteOfDay / 60)).padStart(2, "0") + ":" + String(minuteOfDay % 60).padStart(2, "0") });
  }
  return result;
}

export function dailySlotIndex(task, start, end, step = 30, endNextDay = false) {
  if (!task?.time) return null;
  const slots = dailySlots(start, end, step, endNextDay);
  const taskMinute = minutes(task.time);
  if (taskMinute === null) return null;
  const from = minutes(start);
  const to = minutes(end, true) + (endNextDay ? 1440 : 0);
  const wrapsMidnight = endNextDay && minutes(end, true) < from;
  const position = taskMinute + (wrapsMidnight && taskMinute <= minutes(end, true) ? 1440 : 0);
  const index = slots.findIndex((slot) => position >= slot.minutes && position < Math.min(slot.minutes + step, to));
  return index >= 0 ? index : null;
}

export function defaultStudioState(kind) {
  return {
    schema: 1, kind, title: "", date: "", weekStart: 1, dayCount: kind === "daily" ? 1 : 7,
    start: "08:00", end: "20:00", endNextDay: false, step: 30, peopleCount: 4,
    people: ["Aš", "Šeima", "Vaikai", "Bendra"], theme: "forest",
    layout: kind === "family" ? "people" : "time",
    priorities: ["", "", ""], tasks: [], notes: "", lowInk: false, paper: "A4", orientation: kind === "daily" ? "portrait" : "landscape"
  };
}

export function validateStudioState(input, expectedKind = null) {
  if (!input || typeof input !== "object" || Array.isArray(input) || input.schema !== 1) throw new TypeError("Juodraščio formatas neatpažintas.");
  const kind = input.kind;
  if (!["weekly", "daily", "family"].includes(kind) || (expectedKind && kind !== expectedKind)) throw new TypeError("Juodraštis skirtas kitam planuokliui.");
  const state = { ...defaultStudioState(kind), ...input };
  if (typeof state.title !== "string" || state.title.length > 80) throw new TypeError("Pavadinimas per ilgas.");
  if (state.date && (!ISO_DATE.test(state.date) || weekDates(state.date, 1, 1).length !== 1)) throw new TypeError("Juodraščio data netinkama.");
  if (!THEMES.has(state.theme)) throw new TypeError("Spalvų tema neatpažinta.");
  if (!LAYOUTS[kind].has(state.layout)) throw new TypeError("Pasirinktas maketas neatpažintas.");
  if (!Number.isInteger(state.dayCount) || state.dayCount < 1 || state.dayCount > 7) throw new TypeError("Dienų skaičius netinkamas.");
  if (!Number.isInteger(state.weekStart) || ![0, 1].includes(state.weekStart)) throw new TypeError("Savaitės pradžia netinkama.");
  if (!Number.isInteger(state.peopleCount) || state.peopleCount < 1 || state.peopleCount > 8) throw new TypeError("Žmonių skaičius turi būti nuo 1 iki 8.");
  if (!Array.isArray(state.people) || state.people.length !== state.peopleCount || state.people.some((name) => typeof name !== "string" || name.length > 30)) throw new TypeError("Patikrinkite žmonių pavadinimus.");
  if (!Array.isArray(state.priorities) || state.priorities.length !== 3 || state.priorities.some((item) => typeof item !== "string" || item.length > 90)) throw new TypeError("Prioritetų duomenys netinkami.");
  if (typeof state.notes !== "string" || state.notes.length > 1200) throw new TypeError("Pastabų laukas per ilgas.");
  if (!Array.isArray(state.tasks) || state.tasks.length > 40) throw new TypeError("Viename plane galima turėti iki 40 veiklų.");
  if (kind === "daily") {
    if (state.end === "24:00") throw new TypeError("Pabaigai po vidurnakčio naudokite 00:00 ir pažymėkite kitą dieną.");
    dailySlots(state.start, state.end, Number(state.step), state.endNextDay === true);
  }
  state.tasks = state.tasks.map((task) => {
    if (!task || typeof task !== "object" || typeof task.text !== "string" || task.text.length > 120) throw new TypeError("Patikrinkite veiklos tekstą.");
    const day = Number(task.day ?? 0);
    if (!Number.isInteger(day) || day < 0 || day >= state.dayCount) throw new TypeError("Veiklos diena nepatenka į pasirinktą planą.");
    const time = task.time || "";
    if (time && minutes(time) === null) throw new TypeError("Veiklos pradžios laikas netinkamas.");
    const end = task.end || "";
    if (end && (minutes(end) === null || (kind === "daily" && end === "24:00"))) throw new TypeError("Veiklos pabaigos laikas netinkamas.");
    if (kind === "daily" && end && !time) throw new TypeError("Pabaigos laikui pirmiausia nurodykite pradžią.");
    if (kind === "daily" && task.endNextDay === true && (!time || !end)) throw new TypeError("Pažymėkite pabaigą kitą dieną tik įrašę pradžios ir pabaigos laiką.");
    if (kind === "daily" && time && end) dailySlots(time, end, 15, task.endNextDay === true);
    let person = "shared";
    if (kind === "family" && task.person !== "shared") {
      if (Array.isArray(task.person)) {
        person = [...new Set(task.person.map(Number))];
        if (!person.length || person.some((index) => !Number.isInteger(index) || index < 0 || index >= state.peopleCount)) throw new TypeError("Veiklos dalyviai neatpažinti.");
        if (person.length === 1) person = person[0];
      } else {
        person = Number(task.person ?? 0);
        if (!Number.isInteger(person) || person < 0 || person >= state.peopleCount) throw new TypeError("Veiklos dalyvis neatpažintas.");
      }
    }
    return { text: task.text, day, time, end, endNextDay: task.endNextDay === true, person };
  });
  if (!["A4", "A3", "A5"].includes(state.paper)) throw new TypeError("Popieriaus formatas neatpažintas.");
  if (!["portrait", "landscape"].includes(state.orientation)) throw new TypeError("Popieriaus kryptis neatpažinta.");
  state.lowInk = state.lowInk === true;
  state.step = Number(state.step);
  if (kind === "daily" && ![15, 30, 60].includes(state.step)) throw new TypeError("Laiko žingsnis neatpažintas.");
  return state;
}

export { DAYS };
