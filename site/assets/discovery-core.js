const DAY_MS = 86400000;

function validDate(value) {
  if (!/^\d{4}-\d\d-\d\d$/.test(value)) throw new Error("Patikrinkite datą.");
  const instant = Date.parse(value + "T00:00:00Z");
  if (!Number.isFinite(instant) || new Date(instant).toISOString().slice(0, 10) !== value) throw new Error("Patikrinkite datą.");
  return instant;
}

export function shiftIsoDate(value, amount) {
  return new Date(validDate(value) + amount * DAY_MS).toISOString().slice(0, 10);
}

/** Fold an iCalendar content line without splitting a UTF-8 character. */
export function foldIcsLine(line) {
  const encoder = new TextEncoder();
  let output = "";
  let segment = "";
  let bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      output += segment + "\r\n ";
      segment = "";
      bytes = 1;
    }
    segment += character;
    bytes += size;
  }
  return output + segment;
}

export function thirdFridayOfMay(year) {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new Error("Patikrinkite metus.");
  const first = new Date(Date.UTC(year, 4, 1)).getUTCDay();
  const firstFriday = 1 + ((5 - first + 7) % 7);
  return year + "-05-" + String(firstFriday + 14).padStart(2, "0");
}

function extendSide(boundary, direction, leaveAllowance) {
  let edge = boundary;
  let addedDays = 0;
  let leaveDays = 0;
  const leaveDates = [];
  for (let step = 0; step < 12; step += 1) {
    const next = shiftIsoDate(edge, direction);
    const weekday = new Date(validDate(next)).getUTCDay();
    if (weekday === 0 || weekday === 6) {
      edge = next;
      addedDays += 1;
      continue;
    }
    if (leaveDays >= leaveAllowance) break;
    edge = next;
    addedDays += 1;
    leaveDays += 1;
    leaveDates.push(next);
  }
  return { edge, addedDays, leaveDays, leaveDates };
}

/** Extends a published long weekend with up to five weekday leave days. */
export function recommendExtendedWeekend(start, end, maximumLeaveDays = 1) {
  validDate(start);
  validDate(end);
  if (end < start) throw new Error("Laikotarpio pabaiga negali būti ankstesnė už pradžią.");
  if (!Number.isInteger(maximumLeaveDays) || maximumLeaveDays < 0 || maximumLeaveDays > 5) throw new Error("Galima palyginti nuo 0 iki 5 atostogų dienų.");

  const baseDays = Math.round((validDate(end) - validDate(start)) / DAY_MS) + 1;
  let best = null;
  for (let beforeBudget = 0; beforeBudget <= maximumLeaveDays; beforeBudget += 1) {
    const afterBudget = maximumLeaveDays - beforeBudget;
    const before = extendSide(start, -1, beforeBudget);
    const after = extendSide(end, 1, afterBudget);
    const candidate = {
      start: before.edge,
      end: after.edge,
      daysOff: baseDays + before.addedDays + after.addedDays,
      leaveDays: before.leaveDays + after.leaveDays,
      leaveDates: [...before.leaveDates, ...after.leaveDates].sort(),
    };
    if (!best || candidate.daysOff > best.daysOff ||
      (candidate.daysOff === best.daysOff && candidate.leaveDays < best.leaveDays) ||
      (candidate.daysOff === best.daysOff && candidate.leaveDays === best.leaveDays && candidate.start < best.start)) {
      best = candidate;
    }
  }
  return best;
}

/** Allocates one annual leave budget across distinct long weekends. */
export function recommendAnnualWeekendPlan(events, maximumLeaveDays = 0, leaveYear = null) {
  if (!Array.isArray(events)) throw new Error("Reikia pateikti savaitgalių sąrašą.");
  if (!Number.isInteger(maximumLeaveDays) || maximumLeaveDays < 0 || maximumLeaveDays > 5) {
    throw new Error("Galima paskirstyti nuo 0 iki 5 atostogų dienų.");
  }
  const ordered = events.map((event) => {
    validDate(event.start);
    validDate(event.end);
    if (event.end < event.start) throw new Error("Laikotarpio pabaiga negali būti ankstesnė už pradžią.");
    return { ...event, baseDays: Math.round((validDate(event.end) - validDate(event.start)) / DAY_MS) + 1 };
  }).sort((a, b) => a.start.localeCompare(b.start));
  const memo = new Map();

  function bestPlan(index, remaining, lastEnd) {
    if (index >= ordered.length || remaining === 0) return { recommendations: [], leaveDays: 0, extraDays: 0, restDays: 0 };
    const key = index + "|" + remaining + "|" + lastEnd;
    if (memo.has(key)) return memo.get(key);
    const event = ordered[index];
    let best = bestPlan(index + 1, remaining, lastEnd);
    for (let allowance = 1; allowance <= Math.min(3, remaining); allowance += 1) {
      const recommendation = recommendExtendedWeekend(event.start, event.end, allowance);
      if (recommendation.leaveDays === 0 || recommendation.start <= lastEnd) continue;
      if (leaveYear && !recommendation.leaveDates.every((date) => date.startsWith(String(leaveYear) + "-"))) continue;
      const next = bestPlan(index + 1, remaining - recommendation.leaveDays, recommendation.end);
      const current = {
        recommendations: [{ ...event, ...recommendation, extraDays: recommendation.daysOff - event.baseDays }, ...next.recommendations],
        leaveDays: recommendation.leaveDays + next.leaveDays,
        extraDays: recommendation.daysOff - event.baseDays + next.extraDays,
        restDays: recommendation.daysOff + next.restDays,
      };
      if (current.extraDays > best.extraDays ||
        (current.extraDays === best.extraDays && current.leaveDays < best.leaveDays) ||
        (current.extraDays === best.extraDays && current.leaveDays === best.leaveDays &&
          current.recommendations.map((item) => item.start).join(",") < best.recommendations.map((item) => item.start).join(","))) best = current;
    }
    memo.set(key, best);
    return best;
  }

  return bestPlan(0, maximumLeaveDays, "");
}
