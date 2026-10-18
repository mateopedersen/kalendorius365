import { buildAstronomyICS, composeAstronomyEvents, eventLocalParts, VILNIUS_ZONE } from "./astronomy-agenda-core.js";
import { countNoun } from "./calendar.js";

const $ = (selector) => document.querySelector(selector);
const month = $("#astro-month");
if (month) {
  const year = $("#astro-year"), kind = $("#astro-kind"), list = $("#astro-event-list"), feature = $("#astro-featured");
  const count = $("#astro-agenda-count"), downloadButton = $("#astro-download-ics"), message = $("#astro-agenda-message");
  const monthName = (number) => new Intl.DateTimeFormat("lt-LT", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2027, number - 1, 1)));
  const localFormat = new Intl.DateTimeFormat("lt-LT", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: VILNIUS_ZONE });
  const utcFormat = new Intl.DateTimeFormat("lt-LT", { dateStyle: "medium", timeStyle: "short", hourCycle: "h23", timeZone: "UTC" });
  const create = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };

  function eventCard(event, featured = false) {
    const item = create(featured ? "div" : "li", undefined, featured ? "astro-featured-card" : "astro-event-card");
    const date = new Date(event.instant), parts = eventLocalParts(event.instant);
    const badge = create("span", event.kind === "season" ? "Saulės metų riba" : "Mėnulio fazė", "astro-event-kind");
    const heading = create("h3", event.title);
    const local = create("time", localFormat.format(date), "astro-event-local");
    local.dateTime = event.utc;
    const utc = create("p", `UTC momentas: ${utcFormat.format(date)} UTC`, "astro-event-utc");
    const day = create("span", `${String(parts.day).padStart(2, "0")}`, "astro-date-number");
    const monthLabel = create("span", `${monthName(Number(parts.month))} ${parts.year}`, "astro-date-month");
    const dateTile = create("div", undefined, "astro-date-tile");
    dateTile.append(day, monthLabel);
    const copy = create("div", undefined, "astro-event-copy");
    copy.append(badge, heading, local, utc);
    item.append(dateTile, copy);
    return item;
  }

  function render(events) {
    const selectedYear = Number(year.value), selectedMonth = month.value, selectedKind = kind.value;
    const filtered = events.filter((event) => {
      const parts = eventLocalParts(event.instant);
      return Number(parts.year) === selectedYear &&
        (selectedMonth === "all" || Number(parts.month) === Number(selectedMonth)) &&
        (selectedKind === "all" || event.kind === selectedKind);
    });
    count.textContent = `${selectedMonth === "all" ? selectedYear + " metai" : monthName(Number(selectedMonth)) + " " + selectedYear} · rodoma ${countNoun(filtered.length, "įvykis", "įvykiai", "įvykių")}`;
    list.replaceChildren(...filtered.map((event) => eventCard(event)));
    feature.replaceChildren();
    if (!filtered.length) {
      feature.append(create("p", "Šiam pasirinkimui įvykių nerasta. Pasirinkite kitą mėnesį arba visą metų laikotarpį."));
      downloadButton.disabled = true;
      message.textContent = "Nėra įvykių, kuriuos būtų galima įtraukti į ICS failą.";
      return;
    }
    const now = Date.now(), upcoming = filtered.find((event) => event.instant >= now), highlighted = upcoming || filtered[0];
    const heading = create("p", upcoming ? "Artimiausias įvykis šiame pasirinkime" : "Pirmasis įvykis šiame pasirinkime", "astro-feature-label");
    const card = eventCard(highlighted, true);
    feature.append(heading, card);
    downloadButton.disabled = false;
    message.textContent = `ICS faile bus ${countNoun(filtered.length, "tikslus astronominis momentas", "tikslūs astronominiai momentai", "tikslių astronominių momentų")} pagal pasirinktus filtrus.`;
    downloadButton.onclick = () => {
      try {
        const blob = new Blob([buildAstronomyICS(filtered)], { type: "text/calendar;charset=utf-8" });
        const url = URL.createObjectURL(blob), link = document.createElement("a");
        link.href = url;
        link.download = `astronominiai-ivykiai-${selectedYear}-${selectedMonth === "all" ? "visi-men" : String(selectedMonth).padStart(2, "0")}.ics`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        message.textContent = `Paruoštas ${filtered.length} įvykių ICS failas; atsisiuntimas pradėtas.`;
      } catch {
        message.textContent = "ICS failo paruošti nepavyko. Filtruoti įvykiai liko matomi šiame puslapyje.";
      }
    };
  }

  Promise.all([
    fetch("/assets/data/astronomy/seasons-utc.json").then((response) => { if (!response.ok) throw Error("Sezonų duomenų nepavyko įkelti."); return response.json(); }),
    fetch("/assets/data/astronomy/moon-phases-utc.json").then((response) => { if (!response.ok) throw Error("Mėnulio duomenų nepavyko įkelti."); return response.json(); }),
  ]).then(([seasons, phases]) => {
    const events = composeAstronomyEvents(seasons, phases);
    for (const control of [year, month, kind]) control.addEventListener("change", () => render(events));
    render(events);
  }).catch((error) => {
    count.textContent = "Astronominių įvykių nepavyko įkelti.";
    feature.replaceChildren(create("p", `${error.message} Metų laikų lentelė ir šaltinių nuorodos pateiktos žemiau.`));
    downloadButton.disabled = true;
    message.textContent = "Duomenims nepasiekiant, ICS failas nesukurtas.";
  });
}
