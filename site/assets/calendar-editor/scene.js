import { MONTHS, DAYS, months, monthKey, effective, monthGrid, monthLength, weekday, isoWeek, entries, today, addDays } from "./model.js";
const MM = 72 / 25.4;
const escape = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
let measure;
function wrap(text2, width, size, font = "Lato") {
  if (!measure && typeof document !== "undefined") measure = document.createElement("canvas").getContext("2d");
  if (measure) measure.font = `${size}px ${font}`;
  const len = (s) => measure ? measure.measureText(s).width : s.length * size * 0.57;
  let lines = [];
  for (let paragraph of String(text2).split("\n")) {
    let line2 = "";
    for (let word of paragraph.split(/\s+/)) {
      if (len(word) > width) {
        if (line2) {
          lines.push(line2);
          line2 = "";
        }
        let part = "";
        for (let char of word) {
          if (len(part + char) > width && part) {
            lines.push(part);
            part = "";
          }
          part += char;
        }
        line2 = part;
      } else if (line2 && len(line2 + " " + word) > width) {
        lines.push(line2);
        line2 = word;
      } else line2 += (line2 ? " " : "") + word;
    }
    lines.push(line2);
  }
  return lines;
}
function pageSize(s) {
  let [w, h] = { a3: [297, 420], a4: [210, 297], a5: [148, 210], letter: [215.9, 279.4] }[s.layout.paper];
  return (s.layout.orientation === "landscape" ? [h, w] : [w, h]).map((x) => x * MM);
}
const rect = (p, x, y, w, h, fill, stroke, line2 = 0.4) => p.items.push({ type: "rect", x, y, w, h, fill, stroke, line: line2 });
const line = (p, x, y, x2, y2, color, width = 0.4) => p.items.push({ type: "line", x, y, x2, y2, color, width });
const text = (p, value, x, y, size, color, bold = false, align = "left", extra = {}) => p.items.push({ type: "text", value: String(value), x, y, size, color, bold, align, font: /[♥★]/.test(String(value)) ? "Inter" : p.font, ...extra });
function empty(s, label, key) {
  let [w, h] = pageSize(s);
  let p = { w, h, label, key, font: s.theme.font, items: [] };
  rect(p, 0, 0, w, h, s.theme.colors.background);
  return p;
}
function drawGrid(p, s, data, editorial, y, m, box, mini = false) {
  const c = s.theme.colors, sz = mini ? Math.max(5.5, Math.min(8, box.w / 35)) : s.theme.bodySize;
  let key = monthKey(y, m), first = key + "-01", last = key + "-" + monthLength(y, m), all = entries(s, data, editorial, first, last);
  let grid = monthGrid(y, m, s.layout.weekstart);
  let rows = Math.ceil(((weekday(first) - s.layout.weekstart + 7) % 7 + monthLength(y, m)) / 7);
  if (box.h < (mini ? 35 : rows * (sz + 7) + sz * 2) || box.w < 100 && !mini) throw Error('Šiam lapui per mažai vietos. Sumažinkite paraštes, šriftą ar užrašų eilučių skaičių.');
  let gutter = s.layout.isoWeeks ? mini ? 15 : 25 : 0;
  let cw = (box.w - gutter) / 7, ch = (box.h - sz * 2) / rows;
  for (let k = 0; k < 7; k++) {
    let dow = (k + s.layout.weekstart) % 7;
    text(p, DAYS[dow], box.x + gutter + (k + 0.5) * cw, box.y + sz, sz, c.weekday, true, "center");
  }
  for (let r = 0; r < rows; r++) {
    let cy = box.y + sz * 2 + r * ch;
    if (s.layout.isoWeeks) {
      let a = isoWeek(grid[r * 7]), b = isoWeek(grid[r * 7 + 6]);
      let lab = a.week === b.week ? `${a.week}` : `${a.week}/${b.week}`;
      text(p, lab, box.x + gutter - 4, cy + sz + (mini ? 2 : 5), mini ? 5.5 : 7, c.weekday, false, "right");
    }
    for (let k = 0; k < 7; k++) {
      let d = grid[r * 7 + k], inMonth = d.startsWith(key), x = box.x + gutter + k * cw;
      rect(p, x, cy, cw, ch, "none", c.grid, s.theme.lineWidth);
      if (!inMonth && !s.layout.neighbors) continue;
      let es = all.filter((e) => e.from <= d && e.to >= d), holiday = es.some((e) => e.kind === "statutory"), we = weekday(d) >= 5, color = !inMonth ? "#929b97" : holiday ? c.holiday : we && s.layout.weekends ? c.weekend : c.day;
      let isToday = s.layout.printToday && d === today();
      if (isToday) rect(p, x + 2, cy + 2, cw - 4, sz + 8, "#e5eee9");
      text(p, +d.slice(8), x + 5, cy + sz + (mini ? 2 : 5), sz, color, true, "left", { "date": d });
      if (!inMonth) continue;
      if (es.length) {
        let marker = es.some((e) => e.kind === "personal") ? c.personal : es[0].color;
        text(p, "•", x + cw - 6, cy + sz + (mini ? 2 : 5), sz, marker, true, "right");
      }
      if (!mini && s.layers.display === "cell") {
        let yy = cy + sz * 2.1;
        for (let e of es.slice(0, 2)) {
          let value = (e.icon ? e.icon + " " : "") + e.title;
          let short = wrap(value, cw - 8, Math.max(6, sz * 0.65), p.font)[0];
          if (yy + sz * 0.7 < cy + ch - 3) text(p, short, x + 4, yy, Math.max(6, sz * 0.65), e.color || c.personal);
          yy += sz * 0.85;
        }
      }
    }
  }
  return all;
}
function appendices(s, lines, label, key) {
  let out = [], p, y, margin = s.layout.margin * MM, size = Math.max(8, s.theme.bodySize), leading = size * 1.45;
  const fresh = () => {
    p = empty(s, `${label} · Įrašų sąrašas ${out.length + 1}`, key);
    out.push(p);
    text(p, `${label} · Visi įrašai`, margin, margin + 22, Math.min(20, s.theme.titleSize), s.theme.colors.title, true);
    y = margin + 45;
  };
  for (let item of lines) {
    let chunks = wrap(item, p ? p.w - 2 * margin : pageSize(s)[0] - 2 * margin, size, /[♥★]/.test(item) ? "Inter" : s.theme.font);
    for (let chunk of chunks) {
      if (!p || y > p.h - margin - 18) fresh();
      text(p, chunk, margin, y, size, s.theme.colors.day);
      y += leading;
    }
    y += leading * 0.5;
  }
  return out;
}
function entryLines(all) {
  return all.map((e) => `${e.from}${e.to !== e.from ? " – " + e.to : ""} · ${e.kind === "statutory" ? "Šventė" : e.kind === "commemorative" ? "Atmintina diena" : e.kind === "school" ? "Mokykla" : e.person || "Asmeninis įvykis"} · ${e.icon ? e.icon + " " : ""}${e.title}${e.note ? " — " + e.note : ""}`);
}
function scenes(state, data, editorial) {
  let result = [], period = months(state), annual = state.period.mode === "annual";
  if (annual) {
    let s = effective(state, ""), p = empty(s, `${state.period.year} metai`, "annual"), margin = s.layout.margin * MM;
    text(p, `${state.period.year} metų kalendorius`, margin, margin + 25, Math.min(s.theme.titleSize,(p.w-2*margin)/12), s.theme.colors.title, true);
    text(p, wrap(state.name,p.w-2*margin,8,s.theme.font)[0],margin,margin+39,8,s.theme.colors.weekday);
    let cols = p.w > p.h ? 4 : 3, rows = 12 / cols, gap = 14, w = (p.w - 2 * margin - gap * (cols - 1)) / cols, h = (p.h - 2 * margin - 65 - gap * (rows - 1)) / rows, all = [];
    for (let i = 0; i < 12; i++) {
      let [y, m] = period[i], x = margin + i % cols * (w + gap), yy = margin + 55 + Math.floor(i / cols) * (h + gap);
      text(p, MONTHS[m - 1], x, yy, 10, s.theme.colors.title, true);
      all.push(...drawGrid(p, s, data, editorial, y, m, { x, y: yy + 9, w, h: h - 22 }, true));
    }
    text(p, "Visi pažymėti įrašai pateikti priede. ISO: eilutėje gali būti dviejų savaičių numeriai.", margin, p.h - margin + 3, 6.5, s.theme.colors.weekday);
    result.push(p, ...appendices(s, entryLines([...new Map(all.map((e) => [e.id + e.from, e])).values()]), `${state.period.year} metai`, "annual"));
    return result;
  }
  for (let [y, m] of period) {
    let key = monthKey(y, m), s = effective(state, key), label = `${y} · ${MONTHS[m - 1]}`, p = empty(s, label, key), margin = s.layout.margin * MM, c = s.theme.colors;
    let titleY = margin + Math.min(36, s.theme.titleSize), top = titleY + 25;
    let photoId = Object.hasOwn(s.assignments.months, key) ? s.assignments.months[key] : s.assignments.all, photo = s.photos.find((x) => x.id === photoId);
    let photoH = Math.min(s.layout.photoHeight * MM, p.h * 0.4), gridX = margin, gridW = p.w - 2 * margin;
    let notesH = s.layout.notes * 14 + 20;
    let bottom = p.h - margin - notesH - 20;
    let monthRows=Math.ceil(((weekday(key+'-01')-s.layout.weekstart+7)%7+monthLength(y,m))/7);
    if(s.theme.placement==='top') photoH=Math.max(0,Math.min(photoH,bottom-top-(monthRows*(s.theme.bodySize+7)+2*s.theme.bodySize)-15));
    let ph;
    if (photo && photoH > 0 && !s.lowInk) {
      if (s.theme.placement === "side") {
        let pw = Math.min(gridW * 0.28, photoH);
        ph = { x: margin, y: top, w: pw, h: bottom - top };
        gridX += pw + 12;
        gridW -= pw + 12;
      } else if (s.theme.placement === "background") {
        ph = { x: 0, y: 0, w: p.w, h: p.h };
      } else {
        ph = { x: margin, y: top, w: gridW, h: photoH };
        top += photoH + 15;
      }
      if (ph) p.items.push({ type: "photo", ...ph, photo, background: s.theme.placement === "background" });
    }
    text(p, `${y}`, margin, titleY, Math.max(14, s.theme.titleSize * 0.62), c.weekday);
    text(p, MONTHS[m - 1], p.w - margin, titleY, s.theme.titleSize, c.title, true, "right");
    text(p, wrap(s.name,p.w-2*margin,8,s.theme.font)[0], margin, titleY + 15, 8, c.weekday);
    let all = drawGrid(p, s, data, editorial, y, m, { x: gridX, y: top, w: gridW, h: bottom - top });
    for (let n = 0; n < s.layout.notes; n++) {
      let yy = bottom + 28 + n * 14;
      rect(p, margin, yy - 7, 6, 6, "none", c.grid);
      line(p, margin + 13, yy, p.w - margin, yy, c.grid, 0.35);
    }
    text(p, "Užrašai ir darbai", margin, bottom + 16, 8, c.weekday, true);
    let info = all.length ? "Visi pažymėti įrašai ir užrašai pateikti priede." : "ISO savaitė: pirmadienio sistema; „52/1“ žymi dvi savaites.";
    text(p, info, margin, p.h - margin + 5, 6.5, c.weekday);
    result.push(p);
    let full = entryLines(all);
    if (s.notes[key]) full.push("Užrašai: " + s.notes[key]);
    result.push(...appendices(s, full, label, key));
  }
  return result;
}
function svg(p, photoURLs = {}, fontCSS = "") {
  let items = p.items.map((i) => {
    if (i.type === "rect") return `<rect x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}" fill="${i.fill || "none"}" stroke="${i.stroke || "none"}" stroke-width="${i.line}"/>`;
    if (i.type === "line") return `<path d="M${i.x} ${i.y}L${i.x2} ${i.y2}" fill="none" stroke="${i.color}" stroke-width="${i.width}"/>`;
    if (i.type === "photo") {
      let u = photoURLs[i.photo.id + ":" + i.w + ":" + i.h];
      return u ? `<image x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}" opacity="${i.background ? 0.18 : 1}" href="${escape(u)}"/>` : "";
    }
    return `<text x="${i.x}" y="${i.y}" font-size="${i.size}" font-family="${i.font || p.font}" font-weight="${i.bold ? 700 : 400}" fill="${i.color}" text-anchor="${i.align === "center" ? "middle" : i.align === "right" ? "end" : "start"}"${i.date ? ` data-editor-date="${i.date}" tabindex="0" role="button" aria-label="${i.date}: pridėti įvykį"` : ""}>${escape(i.value)}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}" viewBox="0 0 ${p.w} ${p.h}" role="img" aria-label="${escape(p.label)}"><style>${fontCSS}text{white-space:pre}</style>${items}</svg>`;
}
export {
  MM,
  escape,
  pageSize,
  scenes,
  svg,
  wrap
};
