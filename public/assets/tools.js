import * as cal from "./calendar.js?v=d2d84b990885";
import { Store, download } from "./storage.js?v=d2d84b990885";
import { notice } from "./common.js?v=d2d84b990885";
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
if ($("#design-picker")) {
  function choose(stem) {
    const card = document.getElementById("dizainas-" + stem),
      thumbnail = card?.querySelector(".preview-link img"),
      previewLink = card?.querySelector(".preview-link"),
      downloads = [...(card?.querySelectorAll("a[download]") || [])],
      pdf = downloads.find((link) => /\.pdf(?:$|\?)/.test(link.href)),
      webp = downloads.find((link) => /\.webp(?:$|\?)/.test(link.href));
    if (!card || !thumbnail || !previewLink || !pdf || !webp) return;
    const landscape = Number(thumbnail.getAttribute("width")) > Number(thumbnail.getAttribute("height")),
      name = card.querySelector(".design-info h2")?.textContent.replace(/^\s*\d+\s*/, "").trim() || "Kalendoriaus dizainas";
    const selectedPreview = $("#selected-preview");
    if (selectedPreview) {
      selectedPreview.src = thumbnail.getAttribute("src");
      selectedPreview.alt = thumbnail.alt;
      selectedPreview.width = Number(thumbnail.getAttribute("width"));
      selectedPreview.height = Number(thumbnail.getAttribute("height"));
    }
    const previewTitle = $("#preview-title"),
      previewFormat = $("#preview-format"),
      fullPreviewLink = $("#preview-full");
    if (previewTitle) previewTitle.textContent = name;
    if (previewFormat) previewFormat.textContent = "A4 · " + (landscape ? "Gulsčias" : "Stačias");
    if (fullPreviewLink) fullPreviewLink.href = previewLink.href;
    $("#selected-pdf").href = pdf.href;
    $("#selected-webp").href = webp.href;
    $("#selected-print").href = pdf.href;
    $("#design-picker").value = stem;
    if ($("#print-art")) $("#print-art").open = true;
    for (const card of document.querySelectorAll(".design-card"))
      card.classList.toggle("selected-design", card.id === "dizainas-" + stem);
  }
  $("#design-picker").onchange = (e) => choose(e.target.value);
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
  for (const b of document.querySelectorAll("[data-design-filter]"))
    b.onclick = () => {
      for (const x of document.querySelectorAll("[data-design-filter]"))
        x.setAttribute("aria-pressed", String(x === b));
      for (const c of document.querySelectorAll(".design-card"))
        c.hidden = !(
          b.dataset.designFilter === "all" ||
          b.dataset.designFilter === c.dataset.style ||
          b.dataset.designFilter === c.dataset.design ||
          b.dataset.designFilter === c.dataset.layout
        );
    };
}
if ($("#work-schedule")) {
  $("#work-schedule").onchange = (e) => {
    for (const section of document.querySelectorAll("[data-work-table]"))
      section.hidden = section.dataset.workTable !== e.target.value;
    const total = document.querySelector(
      "[data-work-table]:not([hidden]) tfoot tr",
    );
    const metrics = document.querySelectorAll(".resource-stats > div");
    if (total && metrics.length === 3) {
      const cells = total.children;
      metrics[0].querySelector("strong").textContent = cells[1].textContent;
      metrics[0].querySelector("span").textContent =
        "Darbo dienos · " + e.target.value + " d. savaitė";
      metrics[1].querySelector("strong").textContent = cells[5].textContent;
      metrics[2].querySelector("strong").textContent = cells[4].textContent;
    }
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
if ($("#iso-date")) {
  const input = $("#iso-date"),
    output = $("#iso-result");
  input.value = cal.today();
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
  f.elements.start.value = cal.today();
  f.elements.end.value = cal.addDays(cal.today(), 30);
  const run = (e) => {
    e?.preventDefault();
    try {
      const a = f.elements.start.value,
        b = f.elements.end.value,
        days = cal.difference(a, b),
        work = cal.workStats(a, b, data);
      const n = days + (f.elements.inclusive.checked ? 1 : 0),
        offset = Number(f.elements.offset.value);
      if (!Number.isInteger(offset) || Math.abs(offset) > 36600)
        throw Error(
          "Dienų poslinkis turi būti sveikas skaičius nuo −36600 iki 36600.",
        );
      const result = cal.addDays(a, offset),
        target = $("#calc-result");
      target.replaceChildren();
      const metrics = document.createElement("div");
      metrics.className = "calculator-results";
      for (const [number, label] of [
        [n, "Kalendorinės dienos"],
        [Math.floor(n / 7), "Pilnos savaitės"],
        [work.days, "Darbo dienos"],
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
      for (const s of [
        `${n} kalendorinės dienos · ${Math.floor(n / 7)} savaitės ir ${n % 7} dienos.`,
        `${work.days} darbo dienos, ${work.hours} darbo valandos; prieššventinių trumpinimų: ${work.shortened.length}.`,
        `${work.weekends} savaitgalio dienos; šventės darbo dienomis: ${work.publicDays}.`,
        `Pradžios data ${offset < 0 ? "−" : "+"} ${Math.abs(offset)} d. = ${cal.formatDate(result, { weekday: "long" })}.`,
      ]) {
        const p = document.createElement("p");
        p.textContent = s;
        target.append(p);
      }
    } catch (error) {
      $("#calc-result").textContent = error.message;
    }
  };
  f.onsubmit = run;
  run();
  const countdown = () => {
    try {
      const now = cal.today(),
        d = $("#countdown-date").value,
        n = cal.difference(now, d);
      $("#countdown-result").textContent =
        n >= 0
          ? `Iki ${cal.formatDate(d)} liko ${n} dienos.`
          : `Nuo ${cal.formatDate(d)} praėjo ${-n} dienos.`;
      const y = +now.slice(0, 4),
        monthEnd = `${now.slice(0, 7)}-${cal.monthLength(y, +now.slice(5, 7))}`;
      $("#countdown-standard").textContent =
        `Iki mėnesio pabaigos: ${cal.difference(now, monthEnd)} d. Iki metų pabaigos: ${cal.difference(now, `${y}-12-31`)} d. Iki Naujųjų metų: ${cal.difference(now, `${y + 1}-01-01`)} d.`;
    } catch (error) {
      $("#countdown-result").textContent = error.message;
    }
  };
  $("#countdown-date").value = cal.addDays(cal.today(), 30);
  $("#countdown-date").onchange = countdown;
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
    if (!form.reportValidity()) return;
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
    style.textContent = `@media print{@page{size:${a.paper.value === "a4" ? "A4" : "Letter"} ${a.orientation.value};margin:0}.tool-preview{padding:0}.tool-preview svg{width:${(w / 72) * 25.4}mm;height:${(h / 72) * 25.4}mm}.content-main>h1,.page-heading,.source-note{display:none}}`;
  }
  form.onsubmit = draw;
  form.addEventListener("change", draw);
  document.addEventListener("change", (e) => {
    if (e.target.form === form && !form.contains(e.target)) draw();
  });
  $("#generator-print").onclick = () => {
    draw();
    window.print();
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
