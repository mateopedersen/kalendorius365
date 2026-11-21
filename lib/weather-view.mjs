import { weatherDate } from "./weather-forecast.mjs";

const periods = new Set(["1", "3", "5", "7", "10", "15", "30", "45", "90"]);

export function weatherView(params, now) {
  const requested = params.get("dienos");
  const period = periods.has(requested) ? Number(requested) : 5;
  if (period <= 15) return { period, month: null };
  const first = weatherDate(now, 15).slice(0, 7);
  const last = weatherDate(now, period - 1).slice(0, 7);
  const month = params.get("menuo") || "";
  return { period, month: /^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) && month >= first && month <= last ? month : first };
}

export function climateSpan(now, view) {
  if (!view.month || view.period <= 15) return null;
  const first = weatherDate(now, 15);
  const last = weatherDate(now, view.period - 1);
  const monthStart = view.month + "-01";
  const endOfMonth = new Date(monthStart + "T00:00:00Z");
  endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1, 0);
  const monthEnd = endOfMonth.toISOString().slice(0, 10);
  return { start: first > monthStart ? first : monthStart, end: last < monthEnd ? last : monthEnd };
}
