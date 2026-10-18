import { formatDate, holidays, today } from "./calendar.js?v=cd07f2e424fb";

const weekday = new Intl.DateTimeFormat("lt-LT", {
  weekday: "long",
  timeZone: "UTC",
});
const cardDate = new Intl.DateTimeFormat("lt-LT", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function nextDate(article, calendarData, from) {
  const ids = new Set(article.holiday_ids || []);
  for (let year = Number(from.slice(0, 4)); year <= Number(from.slice(0, 4)) + 10; year += 1) {
    const dates = ids.size
      ? holidays(year, calendarData)
          .filter((holiday) => ids.has(holiday.id))
          .map((holiday) => holiday.date)
      : [`${year}-${String(article.month).padStart(2, "0")}-${String(article.day).padStart(2, "0")}`];
    const upcoming = dates.sort().find((date) => date >= from);
    if (upcoming) return upcoming;
  }
  return null;
}

async function refresh() {
  const targets = [...document.querySelectorAll("[data-holiday-id]")];
  if (!targets.length) return;

  try {
    const [editorialResponse, calendarResponse] = await Promise.all([
      fetch("/assets/data/holiday-editorial.json?v=e8708d8fc7f5"),
      fetch("/assets/data/calendar.json?v=d2f3d4db84c0", { cache: "force-cache" }),
    ]);
    if (!editorialResponse.ok || !calendarResponse.ok) return;
    const [editorial, calendarData] = await Promise.all([
      editorialResponse.json(),
      calendarResponse.json(),
    ]);
    const records = new Map(
      [...editorial.articles, ...editorial.commemorations].map((article) => [article.id, article]),
    );
    const localToday = today();

    for (const target of targets) {
      const article = records.get(target.dataset.holidayId);
      const date = article && nextDate(article, calendarData, localToday);
      const time = target.querySelector("[data-next-occurrence]");
      if (!date || !time) continue;
      time.dateTime = date;
      time.textContent = target.classList.contains("holiday-card")
        ? cardDate.format(new Date(`${date}T12:00:00Z`))
        : `${weekday.format(new Date(`${date}T12:00:00Z`))}, ${formatDate(date)}`;
    }
  } catch {
    // Keep the server-rendered date as a useful fallback when JavaScript or
    // the data files are unavailable.
  }
}

void refresh();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void refresh();
});
