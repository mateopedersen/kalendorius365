import * as cal from "./calendar.js";
import { Store, download } from "./storage.js";
import { notice } from "./common.js?v=3b631dd";
const $ = (s) => document.querySelector(s),
  data = await fetch("/assets/data/calendar.json").then((r) => r.json());
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
if ($("#design-picker") || $("#selected-preview")) {
  function choose(stem) {
    const card =
        document.getElementById("dizainas-" + stem) ||
        [...document.querySelectorAll(".blank-card-variants [data-variant-stem]")].find(
          (option) => option.dataset.variantStem === stem,
        )?.closest(".design-card"),
      thumbnail = card?.querySelector(".preview-link img"),
      previewLink = card?.querySelector(".preview-link"),
      downloads = [...(card?.querySelectorAll("a[download]") || [])],
      pdf = downloads.find((link) => /\.pdf(?:$|\?)/.test(link.href)),
      webp = downloads.find((link) => /\.webp(?:$|\?)/.test(link.href)),
      variant = card?.querySelector('[data-blank-rows] option[value="' + stem + '"]');
    if (!card || !thumbnail || !previewLink || !pdf || !webp) return;
    const selected = variant?.dataset,
      imageSrc = selected?.preview || thumbnail.getAttribute("src"),
      webpHref = selected?.webp || previewLink.href,
      pdfHref = selected?.pdf || pdf.href,
      landscape = Number(selected?.width || thumbnail.getAttribute("width")) >
        Number(selected?.height || thumbnail.getAttribute("height")),
      paper = card.dataset.paper || "A4",
      name = card.querySelector(".design-info h2, .design-info h3")?.textContent.replace(/^\s*\d+\s*/, "").trim() || "Kalendoriaus dizainas";
    if (selected) {
      thumbnail.src = imageSrc;
      thumbnail.srcset = imageSrc.replace("/assets/previews/", "/assets/previews-small/") + " 340w, " + imageSrc + " 680w";
      thumbnail.alt = selected.alt;
      thumbnail.width = Number(selected.width);
      thumbnail.height = Number(selected.height);
      previewLink.href = webpHref;
      pdf.href = pdfHref;
      pdf.download = selected.pdfName;
      webp.href = webpHref;
      webp.download = selected.webpName;
      card.dataset.pdfName = selected.pdfName;
      card.dataset.webpName = selected.webpName;
      for (const action of card.querySelectorAll(".select-design"))
        action.dataset.stem = stem;
    }
    card.dataset.activeStem = stem;
    for (const share of card.querySelectorAll(".share-design-action")) {
      share.href = "/dalintis/kalendorius/" + stem + "/";
      share.dataset.shareKey = "design-" + stem;
    }
    const selectedPreview = $("#selected-preview");
    if (selectedPreview) {
      selectedPreview.src = imageSrc;
      selectedPreview.alt = thumbnail.alt;
      selectedPreview.width = Number(selected?.width || thumbnail.getAttribute("width"));
      selectedPreview.height = Number(selected?.height || thumbnail.getAttribute("height"));
    }
    const previewTitle = $("#preview-title"),
      previewFormat = $("#preview-format"),
      fullPreviewLink = $("#preview-full");
    if (previewTitle) previewTitle.textContent = name;
    if (previewFormat) {
      const rows = selected?.variantStem?.match(/-(5|6)-eilutes$/)?.[1];
      previewFormat.textContent = paper + " · " + (landscape ? "Gulsčias" : "Stačias") + (rows ? " · " + rows + " eilutės" : "");
    }
    if (fullPreviewLink) fullPreviewLink.href = webpHref;
    const printSource = $("#selected-print-source");
    if (printSource) printSource.srcset = webp.href;
    const printRoot = selectedPreview?.closest("[data-print-root]");
    if (printRoot) {
      printRoot.dataset.printPaper = landscape ? "landscape" : "portrait";
      printRoot.dataset.printSize = paper;
    }
    const printStyle = $("#artwork-print-style");
    if (printStyle) printStyle.textContent = `@page{size:${paper} ${landscape ? "landscape" : "portrait"};margin:0}`;
    if ($("#selected-pdf")) {
      $("#selected-pdf").href = pdfHref;
      $("#selected-pdf").download = selected?.pdfName || card.dataset.pdfName || "calendar.pdf";
    }
    if ($("#selected-webp")) {
      $("#selected-webp").href = webpHref;
      $("#selected-webp").download = selected?.webpName || card.dataset.webpName || "calendar.webp";
    }
    if ($("#selected-print")) $("#selected-print").href = pdfHref;
    if ($("#design-picker")) $("#design-picker").value = stem;
    if ($("#print-art")) $("#print-art").open = true;
    for (const card of document.querySelectorAll(".design-card"))
      card.classList.toggle(
        "selected-design",
        card.id === "dizainas-" + stem || card.dataset.activeStem === stem,
      );
  }
  if ($("#design-picker")) $("#design-picker").onchange = (e) => choose(e.target.value);
  for (const selector of document.querySelectorAll("[data-blank-rows]"))
    selector.onchange = (e) => choose(e.target.value);
  for (const a of document.querySelectorAll(".select-design"))
    a.onclick = (e) => {
      e.preventDefault();
      choose(a.dataset.stem);
      $("#perziura").scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    };
}
for (const b of document.querySelectorAll("[data-design-filter]"))
  b.onclick = () => {
    for (const x of document.querySelectorAll("[data-design-filter]"))
      x.setAttribute("aria-pressed", String(x === b));
    for (const c of document.querySelectorAll(".design-card"))
      c.hidden = !(
        b.dataset.designFilter === "all" ||
        b.dataset.designFilter === c.dataset.category ||
        b.dataset.designFilter === c.dataset.style ||
        b.dataset.designFilter === c.dataset.design ||
        b.dataset.designFilter === c.dataset.layout ||
        (b.dataset.designFilter === "holidays" && c.dataset.holidays === "true")
      );
    for (const section of document.querySelectorAll("[data-blank-section]"))
      section.hidden = !section.querySelector(".design-card:not([hidden])");
  };
if ($("#work-schedule")) {
  const comparison = document.querySelector("#workday-compare");
  if (comparison) {
    const totals = {};
    for (const schedule of ["5", "6"]) {
      const row = document.querySelector(`[data-work-table="${schedule}"] tfoot tr`);
      if (!row || row.children.length < 6) continue;
      totals[schedule] = { days: Number(row.children[1].textContent), hours: Number(row.children[5].textContent) };
      const card = comparison.querySelector(`[data-work-compare="${schedule}"]`);
      if (card) {
        card.querySelector("[data-work-days]").textContent = totals[schedule].days.toLocaleString("lt-LT");
        card.querySelector("[data-work-hours]").textContent = totals[schedule].hours.toLocaleString("lt-LT");
      }
    }
    const delta = comparison.querySelector("#workday-compare-delta");
    if (delta && totals["5"] && totals["6"]) {
      const difference = totals["6"].hours - totals["5"].hours;
      const hours = cal.countNoun(Math.abs(difference), "darbo valanda", "darbo valandos", "darbo valandų");
      delta.textContent = `Šešių dienų pavyzdyje yra ${cal.countNoun(totals["6"].days - totals["5"].days, "darbo diena", "darbo dienos", "darbo dienų")} daugiau, o įvertintų valandų ${hours} ${difference > 0 ? "daugiau" : difference < 0 ? "mažiau" : "tiek pat"} nei penkių dienų pavyzdyje.`;
    }
  }
  $("#work-schedule").onchange = (e) => {
    const schedule = e.target.value;
    for (const section of document.querySelectorAll("[data-work-table]"))
      section.hidden = section.dataset.workTable !== schedule;
    const total = document.querySelector(
      "[data-work-table]:not([hidden]) tfoot tr",
    );
    const metrics = document.querySelectorAll(".resource-stats > div");
    if (total && metrics.length === 3) {
      const cells = total.children;
      metrics[0].querySelector("strong").textContent = cells[1].textContent;
      metrics[0].querySelector("span").textContent =
        "Darbo dienos · " + schedule + " d. savaitė";
      metrics[1].querySelector("strong").textContent = cells[5].textContent;
      metrics[2].querySelector("strong").textContent = cells[4].textContent;
    }
    for (const month of document.querySelectorAll("[data-work-month]")) {
      const scheduleKey = schedule === "6" ? "Six" : "Five",
        days = month.dataset[`days${scheduleKey}`],
        hours = month.dataset[`hours${scheduleKey}`],
        workdays = month.querySelector("[data-work-days]"),
        workhours = month.querySelector("[data-work-hours]"),
        bar = month.querySelector("[data-work-bar]"),
        track = month.querySelector(".workyear-month__track");
      if (!days || !hours || !workdays || !workhours || !bar || !track) continue;
      workdays.textContent = days;
      workhours.textContent = `${hours} val.`;
      bar.style.setProperty("--month-fill", `${Math.round(Number(hours) / 176 * 100)}%`);
      track.setAttribute("aria-label", `${hours} darbo valandų`);
    }
    for (const list of document.querySelectorAll("[data-work-eves]"))
      list.hidden = list.dataset.workEves !== schedule;
    updateWorkdayCheck();
  };
  $("#work-csv").onclick = () => {
    const section = document.querySelector("[data-work-table]:not([hidden])");
    const csv = [...section.querySelectorAll("tr")]
      .map((r) =>
        [...r.children]
          .map((c) => '"' + c.textContent.replace(/"/g, '""') + '"')
          .join(";"),
      )
      .join("\r\n");
    download(
      "darbo-laikas-" +
        location.pathname.split("/").filter(Boolean).at(-1) +
        ".csv",
      "\uFEFF" + csv,
      "text/csv;charset=utf-8",
    );
  };
}
const updateWorkdayCheck = () => {
  const input = $("#workday-check-date"),
    result = $("#workday-check-result"),
    state = result?.querySelector("[data-workday-state]"),
    detail = result?.querySelector("[data-workday-detail]"),
    schedule = $("#work-schedule");
  if (!input || !result || !state || !detail || !schedule) return;
  const selected = input.value;
  if (!selected) {
    result.dataset.state = "ready";
    state.textContent = "Pasirinkite datą";
    detail.textContent = "Rezultatas bus apskaičiuotas pagal dabar pasirinktą darbo savaitę.";
    return;
  }
  if (selected.slice(0, 4) !== input.min.slice(0, 4)) {
    result.dataset.state = "error";
    state.textContent = "Pasirinkite 2027 m. datą";
    detail.textContent = "Šis puslapis rodo tik 2027 metų darbo kalendorių.";
    return;
  }
  try {
    const six = schedule.value === "6",
      holidayRecords = cal.holidays(Number(selected.slice(0, 4)), data),
      holiday = holidayRecords.find((item) => item.date === selected),
      day = cal.formatDate(selected, { weekday: "long" }),
      daily = cal.workStats(selected, selected, data, six);
    if (holiday) {
      let next = cal.addDays(selected, 1);
      for (let i = 0; i < 15 && !cal.workStats(next, next, data, six).days; i++)
        next = cal.addDays(next, 1);
      result.dataset.state = "rest";
      state.textContent = "Šventinė nedarbo diena";
      detail.textContent = `${day} · ${holiday.name}. Artimiausia darbo diena pagal pasirinktą grafiką: ${cal.formatDate(next, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;
    } else if (daily.days) {
      result.dataset.state = "work";
      state.textContent = "Darbo diena";
      detail.textContent = `${day} · ${daily.hours} darbo val. pagal ${six ? "6" : "5"} dienų pavyzdinį grafiką.${daily.shortened.length ? " Prieš šventę diena trumpinama viena valanda." : ""}`;
    } else {
      let next = cal.addDays(selected, 1);
      for (let i = 0; i < 15 && !cal.workStats(next, next, data, six).days; i++)
        next = cal.addDays(next, 1);
      result.dataset.state = "rest";
      state.textContent = "Poilsio diena";
      detail.textContent = `${day}. Artimiausia darbo diena pagal pasirinktą grafiką: ${cal.formatDate(next, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;
    }
  } catch (error) {
    result.dataset.state = "error";
    state.textContent = "Nepavyko patikrinti datos";
    detail.textContent = error.message;
  }
};
if ($("#workday-check-form")) {
  $("#workday-check-form").onsubmit = (event) => {
    event.preventDefault();
    updateWorkdayCheck();
  };
  $("#workday-check-date").onchange = updateWorkdayCheck;
  updateWorkdayCheck();
}
if ($("#iso-date")) {
  const input = $("#iso-date"),
    output = $("#iso-result");
  if (!input.value) input.value = cal.today();
  const run = () => {
    try {
      const w = cal.isoWeek(input.value),
        mon = cal.addDays(input.value, -cal.weekday(input.value));
      output.textContent = `${w.year} metų ${w.week} ISO savaitė: ${mon} – ${cal.addDays(mon, 6)}.`;
    } catch (e) {
      output.textContent = e.message;
    }
  };
  const baseRun = run;
  input.onchange = () => {
    baseRun();
    if ($("#iso-nearby")) {
      const monday = cal.addDays(input.value, -cal.weekday(input.value)),
        rows = [];
      for (let n = -2; n <= 2; n++) {
        const start = cal.addDays(monday, n * 7),
          w = cal.isoWeek(start);
        rows.push(
          `<tr><td>${w.year} / ${w.week}</td><td>${start}</td><td>${cal.addDays(start, 6)}</td></tr>`,
        );
      }
      $("#iso-nearby").innerHTML =
        '<div class="table-scroll" tabindex="0" role="region" aria-label="Slenkama ISO savaičių lentelė"><table class="data-table"><thead><tr><th>ISO savaitė</th><th>Pirmadienis</th><th>Sekmadienis</th></tr></thead><tbody>' +
        rows.join("") +
        "</tbody></table></div>";
    }
  };
  input.onchange();
}
if ($("#iso-week-range")) {
  const form = $("#iso-week-range"), output = $("#iso-week-range-result"), copy = $("#iso-week-copy");
  const showRange = (event) => {
    event?.preventDefault();
    try {
      const range = cal.isoWeekRange(Number($("#iso-week-year").value), Number($("#iso-week-number").value));
      copy.dataset.interval = `${range.start} – ${range.end}`;
      copy.disabled = false;
      output.textContent = `${range.year}-W${String(range.week).padStart(2, "0")}: ${range.start} (pirmadienis) – ${range.end} (sekmadienis).`;
    } catch (error) { copy.disabled = true; output.textContent = error.message; }
  };
  form.onsubmit = showRange;
  copy.onclick = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw Error();
      await navigator.clipboard.writeText(copy.dataset.interval);
      output.textContent += " Datų intervalas nukopijuotas.";
    } catch { output.textContent += " Nukopijuoti nepavyko; pažymėkite ir kopijuokite datų intervalą rankiniu būdu."; }
  };
  showRange();
}
if ($("#next-holiday")) {
  const now = cal.today(),
    y = +now.slice(0, 4),
    next = [...cal.holidays(y, data), ...cal.holidays(y + 1, data)].find(
      (h) => h.date >= now,
    );
  $("#next-holiday").textContent = next
    ? `Artimiausia šventė: ${next.name}, ${cal.formatDate(next.date)}. ${cal.difference(now, next.date) === 0 ? "Šiandien!" : "Liko " + cal.difference(now, next.date) + " d."}`
    : "";
}
if ($("#next-holiday-aside"))
  $("#next-holiday-aside").textContent = $("#next-holiday").textContent;
if ($("#calculator")) {
  const f = $("#calculator");
  const startInput = f.elements.start,
    endInput = f.elements.end,
    offsetInput = f.elements.offset,
    offsetUnit = f.elements.namedItem("offset-unit"),
    status = $("#date-calculator-status");
  const isValidDate = (value) => {
    try {
      if (!value || value < "1900-01-01" || value > "2100-12-31") return false;
      cal.parse(value);
      return true;
    } catch {
      return false;
    }
  };
  const params = new URLSearchParams(location.search),
    sharedStart = params.get("nuo"),
    sharedEnd = params.get("iki");
  if (isValidDate(sharedStart) && isValidDate(sharedEnd) && sharedStart <= sharedEnd) {
    if (!startInput.value) startInput.value = sharedStart;
    if (!endInput.value) endInput.value = sharedEnd;
  } else {
    // Preserve values entered before this async module finished loading.
    if (!startInput.value) startInput.value = cal.today();
    if (!endInput.value) endInput.value = cal.addDays(cal.today(), 30);
  }
  f.elements.inclusive.checked = params.get("imtinai") === "1";
  const sharedOffset = Number(params.get("poslinkis"));
  if (params.has("poslinkis") && Number.isInteger(sharedOffset) && Math.abs(sharedOffset) <= 36600)
    offsetInput.value = sharedOffset;
  if (params.get("vienetas") === "darbo") offsetUnit.value = "workday";
  let summary = "";
  const dayForm = (n) => {
    const lastTwo = Math.abs(n) % 100,
      last = Math.abs(n) % 10;
    return last === 1 && lastTwo !== 11 ? "diena" : last >= 2 && last <= 9 && (lastTwo < 12 || lastTwo > 19) ? "dienos" : "dienų";
  };
  const run = (e) => {
    e?.preventDefault();
    try {
      const a = startInput.value,
        b = endInput.value,
        days = cal.difference(a, b),
        work = cal.workStats(a, b, data);
      const n = days + (f.elements.inclusive.checked ? 1 : 0),
        offset = Number(f.elements.offset.value);
      if (!Number.isInteger(offset) || Math.abs(offset) > 36600)
        throw Error("Dienų skaičius turi būti sveikas nuo −36600 iki 36600.");
      const result = offsetUnit.value === "workday"
          ? cal.addWorkdays(a, offset, data)
          : cal.addDays(a, offset),
        duration = cal.calendarDuration(a, b),
        target = $("#calc-result");
      target.replaceChildren();
      const metrics = document.createElement("div");
      metrics.className = "calculator-results";
      for (const [number, label] of [
        [n, cal.countForm(n, "Kalendorinė diena", "Kalendorinės dienos", "Kalendorinių dienų")],
        [Math.floor(n / 7), cal.countForm(Math.floor(n / 7), "Pilna savaitė", "Pilnos savaitės", "Pilnų savaičių")],
        [work.days, cal.countForm(work.days, "Darbo diena", "Darbo dienos", "Darbo dienų")],
        [work.weekends, cal.countForm(work.weekends, "Savaitgalio diena", "Savaitgalio dienos", "Savaitgalio dienų")],
        [work.publicDays, cal.countForm(work.publicDays, "Šventinė darbo diena", "Šventinės darbo dienos", "Šventinių darbo dienų")],
      ]) {
        const block = document.createElement("div"),
          strong = document.createElement("strong"),
          span = document.createElement("span");
        strong.textContent = number;
        span.textContent = label;
        block.append(strong, span);
        metrics.append(block);
      }
      target.append(metrics);
      const interval = document.createElement("p");
      interval.className = "date-result__interval";
      interval.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h14M3 14h14M6 3v6m8 2v6"/></svg>';
      const intervalText = document.createElement("span");
      intervalText.textContent = `Tarp pasirinktų datų: ${duration.years} m. ${duration.months} mėn. ${duration.days} d.`;
      interval.append(intervalText);
      target.append(interval);
      const lines = [
        `${cal.countNoun(n, "kalendorinė diena", "kalendorinės dienos", "kalendorinių dienų")} pagal kalendorių${f.elements.inclusive.checked ? " (abi ribinės datos įtrauktos)" : " (pabaigos data neįtraukta)"}. Tai ${cal.countNoun(Math.floor(n / 7), "pilna savaitė", "pilnos savaitės", "pilnų savaičių")} ir ${cal.countNoun(n % 7, "diena", "dienos", "dienų")}.`,
        `${cal.countNoun(work.days, "darbo diena", "darbo dienos", "darbo dienų")} · ${cal.countNoun(work.hours, "darbo valanda", "darbo valandos", "darbo valandų")} pagal standartinį grafiką · ${cal.countNoun(work.shortened.length, "prieššventinis trumpinimas", "prieššventiniai trumpinimai", "prieššventinių trumpinimų")}.`,
        `${cal.countNoun(work.weekends, "savaitgalio diena", "savaitgalio dienos", "savaitgalio dienų")} ir ${cal.countNoun(work.publicDays, "šventinė darbo diena", "šventinės darbo dienos", "šventinių darbo dienų")}.`,
        `${offsetUnit.value === "workday" ? "Darbo" : "Kalendorinių"} dienų poslinkis: ${offset < 0 ? "−" : "+"}${Math.abs(offset)} nuo pradžios datos → ${cal.formatDate(result, { weekday: "long" })}.`,
      ];
      for (const line of lines) {
        const p = document.createElement("p");
        p.textContent = line;
        target.append(p);
      }
      summary = [
        `Laikotarpis: ${cal.formatDate(a)} – ${cal.formatDate(b)}`,
        `Tiksli trukmė: ${duration.years} m. ${duration.months} mėn. ${duration.days} d.`,
        `Kalendorinės dienos: ${n}; darbo dienos: ${work.days}; savaitgaliai: ${work.weekends}; šventės darbo dienomis: ${work.publicDays}.`,
        `Standartinės darbo valandos: ${work.hours}; prieššventiniai trumpinimai: ${work.shortened.length}.`,
        `Data po ${offset < 0 ? "−" : "+"}${Math.abs(offset)} ${offsetUnit.value === "workday" ? "darbo" : "kalendorinių"} dienų: ${cal.formatDate(result, { weekday: "long" })}.`,
      ].join("\n");

      const chart = $("#calc-chart");
      chart.replaceChildren();
      const heading = document.createElement("p");
      heading.className = "date-chart__title";
      heading.textContent = "Laikotarpio dienų pasiskirstymas";
      chart.append(heading);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 720 58");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", `Laikotarpis apima ${work.days} darbo dienų, ${work.weekends} savaitgalio dienų ir ${work.publicDays} šventinių darbo dienų.`);
      const total = work.days + work.weekends + work.publicDays || 1;
      const background = document.createElementNS(svg.namespaceURI, "rect");
      background.setAttribute("x", "4"); background.setAttribute("y", "17");
      background.setAttribute("width", "712"); background.setAttribute("height", "24");
      background.setAttribute("rx", "12"); background.setAttribute("fill", "#edf2ee");
      svg.append(background);
      const categories = [
        { id: "work", name: "Darbo dienos", value: work.days, color: "#087c56" },
        { id: "weekend", name: "Savaitgaliai", value: work.weekends, color: "#f2bd48" },
        { id: "holiday", name: "Šventės darbo dienomis", value: work.publicDays, color: "#8797c7" },
      ];
      let x = 4;
      for (const item of categories) {
        const width = (712 * item.value) / total;
        if (width > 0.5) {
          const segment = document.createElementNS(svg.namespaceURI, "rect");
          segment.setAttribute("x", String(x)); segment.setAttribute("y", "17");
          segment.setAttribute("width", String(width)); segment.setAttribute("height", "24");
          segment.setAttribute("rx", width >= 18 ? "8" : "1"); segment.setAttribute("fill", item.color);
          svg.append(segment);
        }
        x += width;
      }
      chart.append(svg);
      const legend = document.createElement("div");
      legend.className = "date-chart__legend";
      for (const item of categories) {
        const label = document.createElement("span"), swatch = document.createElement("i");
        swatch.className = `date-chart__swatch--${item.id}`;
        swatch.setAttribute("aria-hidden", "true");
        label.append(swatch, `${item.name} · ${item.value}`);
        legend.append(label);
      }
      chart.append(legend);
      if (status) status.textContent = "Rezultatas atnaujintas.";
    } catch (error) {
      $("#calc-result").textContent = error.message;
      $("#calc-chart")?.replaceChildren();
      summary = "";
      if (status) status.textContent = "Patikrinkite datas ir pasirinkimus.";
    }
  };
  f.onsubmit = run;
  const shareUrl = () => {
    const url = new URL(location.href);
    url.searchParams.set("nuo", startInput.value);
    url.searchParams.set("iki", endInput.value);
    url.searchParams.set("imtinai", f.elements.inclusive.checked ? "1" : "0");
    url.searchParams.set("poslinkis", offsetInput.value || "0");
    url.searchParams.set("vienetas", offsetUnit.value === "workday" ? "darbo" : "kalendorine");
    return url.toString();
  };
  const copyText = async (value) => {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    if (!copied) throw Error("Nukopijuoti nepavyko. Pabandykite dar kartą.");
  };
  $("#copy-date-result")?.addEventListener("click", async () => {
    try {
      await copyText(summary);
      if (status) status.textContent = "Rezultatas nukopijuotas.";
    } catch (error) {
      if (status) status.textContent = error.message;
    }
  });
  $("#share-date-result")?.addEventListener("click", async () => {
    try {
      if (navigator.share) await navigator.share({ title: "Datos skaičiuoklė", text: summary, url: shareUrl() });
      else await copyText(shareUrl());
      if (status) status.textContent = navigator.share ? "Nuoroda paruošta dalytis." : "Dalijimosi nuoroda nukopijuota.";
    } catch (error) {
      if (error.name !== "AbortError" && status) status.textContent = error.message || "Nuorodos paruošti nepavyko.";
    }
  });
  $("#date-swap")?.addEventListener("click", () => {
    [startInput.value, endInput.value] = [endInput.value, startInput.value];
    run();
  });
  for (const button of document.querySelectorAll("[data-range]"))
    button.addEventListener("click", () => {
      const today = cal.today(), year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7));
      if (button.dataset.range === "week") {
        startInput.value = cal.addDays(today, -cal.weekday(today));
        endInput.value = cal.addDays(startInput.value, 6);
      } else if (button.dataset.range === "month") {
        startInput.value = `${today.slice(0, 7)}-01`;
        endInput.value = cal.addDays(startInput.value, cal.monthLength(year, month) - 1);
      } else if (button.dataset.range === "year") {
        startInput.value = `${year}-01-01`;
        endInput.value = `${year}-12-31`;
      } else {
        startInput.value = today;
        endInput.value = cal.addDays(today, Number(button.dataset.range) - 1);
      }
      run();
    });
  for (const input of [startInput, endInput, offsetInput, offsetUnit, f.elements.inclusive])
    input.addEventListener("change", () => run());
  run();
  const countdown = () => {
    try {
      const now = cal.today(),
        d = $("#countdown-date").value,
        n = cal.difference(now, d);
      $("#countdown-result").textContent = n === 0
        ? `${cal.formatDate(d)} yra šiandien.`
        : n > 0
          ? `Iki ${cal.formatDate(d)} liko ${cal.countNoun(n, "diena", "dienos", "dienų")}.`
          : `Nuo ${cal.formatDate(d)} praėjo ${cal.countNoun(-n, "diena", "dienos", "dienų")}.`;
      const y = +now.slice(0, 4),
        monthEnd = `${now.slice(0, 7)}-${cal.monthLength(y, +now.slice(5, 7))}`;
      $("#countdown-standard").textContent =
        `Iki mėnesio pabaigos: ${cal.difference(now, monthEnd)} d. Iki metų pabaigos: ${cal.difference(now, `${y}-12-31`)} d. Iki Naujųjų metų: ${cal.difference(now, `${y + 1}-01-01`)} d.`;
    } catch (error) {
      $("#countdown-result").textContent = error.message;
    }
  };
  const countdownDate = $("#countdown-date");
  if (!countdownDate.value) countdownDate.value = cal.addDays(cal.today(), 30);
  countdownDate.onchange = countdown;
  countdown();
  for (const b of document.querySelectorAll("[data-countdown]"))
    b.onclick = () => {
      const now = cal.today(),
        y = +now.slice(0, 4);
      let target =
        b.dataset.countdown === "new-year"
          ? `${y + 1}-01-01`
          : b.dataset.countdown === "easter"
            ? cal.easter(y)
            : `${y}-${b.dataset.countdown === "jonines" ? "06-24" : "12-25"}`;
      if (target < now)
        target =
          b.dataset.countdown === "easter"
            ? cal.easter(y + 1)
            : `${y + 1}` + target.slice(4);
      $("#countdown-date").value = target;
      countdown();
    };
  countdown();
}
if ($("#year-comparison-form")) {
  const form = $("#year-comparison-form"), target = $("#year-comparison-result");
  const runComparison = (event) => {
    event?.preventDefault();
    const selected = [Number($("#year-compare-a").value), Number($("#year-compare-b").value)];
    target.replaceChildren();
    if (selected[0] === selected[1]) {
      target.textContent = "Pasirinkite du skirtingus metus, kad palyginimas parodytų skirtumus.";
      return;
    }
    for (const year of selected) {
      const start = `${year}-01-01`, end = `${year}-12-31`, holidays = cal.holidays(year, data), stats = cal.workStats(start, end, data);
      const days = Array.from({ length: 12 }, (_, index) => cal.monthLength(year, index + 1)).reduce((sum, length) => sum + length, 0);
      const card = document.createElement("article"), heading = document.createElement("h3"), details = document.createElement("details"), summary = document.createElement("summary"), list = document.createElement("ul");
      card.className = "panel year-comparison-card";
      heading.textContent = `${year} metai`;
      const facts = [
        cal.countNoun(days, "kalendorinė diena", "kalendorinės dienos", "kalendorinių dienų") + (days === 366 ? " · keliamieji metai" : " · nekeliamieji metai"),
        `Pradžia: ${cal.formatDate(start, { weekday: "long" })}; pabaiga: ${cal.formatDate(end, { weekday: "long" })}.`,
        `5 dienų, 8 valandų grafikas: ${cal.countNoun(stats.days, "darbo diena", "darbo dienos", "darbo dienų")}, ${cal.countNoun(stats.hours, "darbo valanda", "darbo valandos", "darbo valandų")}.`,
        `${cal.countNoun(stats.shortened.length, "prieššventinis trumpinimas", "prieššventiniai trumpinimai", "prieššventinių trumpinimų")} pagal parodytą standartinę prielaidą.`,
      ];
      const paragraph = document.createElement("p"); paragraph.textContent = facts.join(" ");
      summary.textContent = `${holidays.length} įstatyminės šventės ir jų savaitės dienos`;
      for (const holiday of holidays) {
        const item = document.createElement("li");
        item.textContent = `${holiday.name} · ${holiday.date} · ${cal.formatDate(holiday.date, { weekday: "long" })}${cal.weekday(holiday.date) >= 5 ? " · savaitgalis" : ""}`;
        list.append(item);
      }
      details.append(summary, list); card.append(heading, paragraph, details); target.append(card);
    }
  };
  form.onsubmit = runComparison;
  $("#year-compare-a").onchange = runComparison;
  $("#year-compare-b").onchange = runComparison;
  runComparison();
}
function svgText(
  x,
  y,
  value,
  size = 11,
  fill = "#182b24",
  weight = 400,
  anchor = "start",
) {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}">${escape(value)}</text>`;
}
let generated = "",
  pageWidth = 842,
  pageHeight = 595;
if ($("#generator")) {
  const form = $("#generator");
  form.elements.year.value = +cal.today().slice(0, 4);
  form.elements.month.value = +cal.today().slice(5, 7);
  const params = new URLSearchParams(location.search),
    wantedYear = Number(params.get("metai")),
    wantedMonth = Number(params.get("menuo"));
  if (Number.isInteger(wantedYear) && wantedYear >= 1900 && wantedYear <= 2100)
    form.elements.year.value = wantedYear;
  if (
    params.has("menuo") &&
    Number.isInteger(wantedMonth) &&
    wantedMonth >= 0 &&
    wantedMonth <= 12
  )
    form.elements.month.value = wantedMonth;
  function draw(e) {
    e?.preventDefault();
    if (!form.reportValidity()) return false;
    const a = form.elements,
      y = +a.year.value,
      m = +a.month.value,
      annual = m === 0;
    for (const name of ["fontsize", "space", "events"])
      a[name].disabled = annual;
    pageWidth = a.paper.value === "a4" ? 841.88976378 : 792;
    pageHeight = a.paper.value === "a4" ? 595.27559055 : 612;
    if (a.orientation.value === "portrait")
      [pageWidth, pageHeight] = [pageHeight, pageWidth];
    const w = pageWidth,
      h = pageHeight,
      font = annual ? 8 : +a.fontsize.value;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${((w / 72) * 25.4).toFixed(2)}mm" height="${((h / 72) * 25.4).toFixed(2)}mm" viewBox="0 0 ${w} ${h}"><style>text{font-family:Inter,Arial,sans-serif}</style><rect width="100%" height="100%" fill="white"/>`;
    const color =
      a.theme.value === "contrast"
        ? "#15271f"
        : a.theme.value === "national"
          ? "#006a44"
          : "#20352a";
    if (a.theme.value === "national")
      for (const [i, c] of ["#FDB913", "#006A44", "#C1272D"].entries())
        svg += `<rect x="25" y="${20 + i * 4}" width="${w - 50}" height="4" fill="${c}"/>`;
    const title =
      a.title.value.trim() ||
      (annual
        ? `${y} metų kalendorius`
        : `${y} m. ${data.months[m - 1][2]} kalendorius`);
    svg += svgText(
      25,
      65,
      title,
      Math.min(24, (w - 50) / Math.max(title.length * 0.55, 1)),
      color,
      700,
    );
    const holidays = a.holidays.checked ? cal.holidays(y, data) : [],
      personal = a.events.checked && !annual ? new Store().data.events : [];
    function month(month, x, top, mw, mh, small) {
      const grid = cal.monthGrid(y, month, +a.weekstart.value),
        weekW = a.weeks.checked ? (small ? 14 : 24) : 0,
        cw = (mw - weekW) / 7,
        rows = Math.ceil(
          (cal.monthLength(y, month) +
            ((cal.weekday(`${y}-${String(month).padStart(2, "0")}-01`) -
              +a.weekstart.value +
              7) %
              7)) /
            7,
        ),
        ch = (mh - 24) / rows;
      let out = "";
      const labels =
        +a.weekstart.value === 6
          ? [data.weekdays[6], ...data.weekdays.slice(0, 6)]
          : data.weekdays;
      for (let j = 0; j < 7; j++)
        out += svgText(
          x + weekW + (j + 0.5) * cw,
          top + 14,
          labels[j],
          small ? 6.5 : 9,
          "#50635a",
          600,
          "middle",
        );
      for (let r = 0; r < rows; r++) {
        if (weekW)
          out += svgText(
            x + weekW / 2,
            top + 24 + r * ch + font + 6,
            cal.isoWeek(grid[r * 7 + (+a.weekstart.value === 6 ? 1 : 0)]).week,
            small ? 5.5 : 7,
            "#50635a",
            400,
            "middle",
          );
        for (let j = 0; j < 7; j++) {
          const s = grid[r * 7 + j];
          if (+s.slice(5, 7) !== month) continue;
          const xx = x + weekW + j * cw,
            yy = top + 24 + r * ch,
            hs = holidays.filter((ho) => ho.date === s),
            ev = personal.filter((e) => cal.occursOn(e, s));
          out += `<rect x="${xx}" y="${yy}" width="${cw}" height="${ch}" fill="${hs.length ? "#fff0ee" : "white"}" stroke="#cdd7d0" stroke-width="0.4"/>`;
          out += svgText(
            xx + 5,
            yy + font + 6,
            +s.slice(8),
            font,
            hs.length ? "#a31b24" : "#182b24",
            hs.length ? 700 : 400,
          );
          if (!small) {
            let ty = yy + font + 18;
            const maxchars = Math.max(8, Math.floor((cw - 10) / 3.4));
            for (const label of [
              ...hs.map((ho) => "◆ " + ho.name),
              ...ev.map((e) => e.title),
            ].slice(0, 2)) {
              let rest = label;
              let lines = 0;
              while (rest && lines < 2 && ty < yy + ch - 4) {
                let cut =
                  rest.length <= maxchars
                    ? rest.length
                    : Math.max(rest.lastIndexOf(" ", maxchars), maxchars - 5);
                out += svgText(
                  xx + 5,
                  ty,
                  rest.slice(0, cut) +
                    (rest.length > cut && lines === 1 ? "…" : ""),
                  6.5,
                  hs.length ? "#a31b24" : "#006a44",
                );
                rest = rest.slice(cut).trim();
                ty += 8;
                lines++;
              }
            }
            if (hs.length + ev.length > 2 && ty < yy + ch - 3)
              out += svgText(
                xx + 5,
                ty,
                "+" + (hs.length + ev.length - 2) + " daugiau",
                6,
                "#50635a",
              );
          }
        }
      }
      return out;
    }
    if (annual) {
      const cols = 3,
        rows = 4,
        gap = 16,
        mw = (w - 50 - gap * 2) / 3,
        mh = (h - 135 - gap * 3) / 4;
      for (let i = 0; i < 12; i++) {
        const x = 25 + (i % cols) * (mw + gap),
          t = 100 + Math.floor(i / cols) * (mh + gap);
        svg +=
          svgText(x, t, data.months[i][1], 10, color, 700) +
          month(i + 1, x, t + 9, mw, mh - 10, true);
      }
    } else {
      const large = a.space.value === "large";
      svg += month(m, 25, 90, w - 50, h - (large ? 220 : 140), false);
      if (large) {
        svg += svgText(25, h - 110, "Užrašai", 10, color, 600);
        for (let i = 0; i < 3; i++)
          svg += `<line x1="25" y1="${h - 91 + i * 20}" x2="${w - 25}" y2="${h - 91 + i * 20}" stroke="#cdd7d0"/>`;
      }
    }
    svg +=
      svgText(
        25,
        h - 16,
        "Kalendorius365.lt · Europe/Vilnius",
        6.5,
        "#50635a",
      ) + "</svg>";
    generated = svg;
    $("#generator-preview").innerHTML = svg;
    let style = $("#generator-print-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "generator-print-style";
      document.head.append(style);
    }
    const paper = a.paper.value === "a4" ? [210, 297] : [215.9, 279.4],
      [printWidth, printHeight] = a.orientation.value === "landscape" ? [...paper].reverse() : paper;
    style.textContent = `@media print{@page{size:${a.paper.value === "a4" ? "A4" : "Letter"} ${a.orientation.value};margin:0}#main #generator-preview{width:${printWidth}mm!important;height:${printHeight - 0.3}mm!important}#main #generator-preview svg{width:100%!important;height:100%!important}}`;
    return true;
  }
  form.onsubmit = draw;
  form.addEventListener("change", draw);
  document.addEventListener("change", (e) => {
    if (e.target.form === form && !form.contains(e.target)) draw();
  });
  window.addEventListener("beforeprint", draw);
  $("#generator-print").onclick = () => {
    if (draw()) window.print();
  };
  $("#generator-webp").onclick = async () => {
    draw();
    try {
      const font = await fetch("/assets/fonts/Inter-Regular.woff2").then((r) =>
        r.arrayBuffer(),
      );
      let chars = "";
      for (const byte of new Uint8Array(font))
        chars += String.fromCharCode(byte);
      const svg = generated.replace(
        "<style>",
        "<style>@font-face{font-family:Inter;src:url(data:font/woff2;base64," +
          btoa(chars) +
          ")}",
      );
      const blob = new Blob([svg], { type: "image/svg+xml" }),
        url = URL.createObjectURL(blob),
        img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round((pageWidth / 72) * 600);
      canvas.height = Math.round((pageHeight / 72) * 600);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const output = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.94),
      );
      if (!output) throw Error("Eksportas nepavyko");
      download(
        `mano-kalendorius-${form.elements.year.value}.webp`,
        output,
        "image/webp",
      );
      notice("WebP kalendorius paruoštas.");
    } catch {
      notice(
        "Naršyklė neleido eksportuoti vaizdo. Naudokite spausdinimą arba kolekcijos failą.",
      );
    }
  };
  draw();
}

// Keep controls inert until the async calendar data and every dependent handler
// are ready, so early input cannot be overwritten by page initialization.
for (const element of document.querySelectorAll("[data-tools-readiness]")) {
  element.inert = false;
  element.setAttribute("aria-busy", "false");
  element.removeAttribute("data-tools-readiness");
}
