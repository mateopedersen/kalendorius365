import { LT } from "./lt.js";
import { MONTHS, DAYS, months, monthKey, effective, monthGrid, monthLength, weekday, isoWeek, entries, today } from "./model.js";
const MM = 72 / 25.4;
const escape = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
let measure;
function textWidth(value, size, font, bold = false) {
  if (!measure && typeof document !== "undefined") measure = document.createElement("canvas").getContext("2d");
  if (!measure) return Array.from(value).length * size * .62;
  measure.font = `${bold ? 700 : 400} ${size}px "${font}"`;
  return measure.measureText(value).width;
}
function abbreviate(value, width, size, font, force = false, bold = false) {
  if (!force && textWidth(value, size, font, bold) <= width) return value;
  const chars = Array.from(value);
  while (chars.length && textWidth(chars.join("").trimEnd() + "…", size, font, bold) > width) chars.pop();
  return chars.join("").trimEnd() + "…";
}
function monthRows(year, month, weekstart) {
  const first = monthKey(year, month) + "-01";
  return Math.ceil(((weekday(first) - weekstart + 7) % 7 + monthLength(year, month)) / 7);
}
function wrap(text2, width, size, font = "Lato") {
  const len = value => textWidth(value, size, font);
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
const circle = (p, x, y, r, color) => p.items.push({ type: "circle", x, y, r, color });
const line = (p, x, y, x2, y2, color, width = 0.4) => p.items.push({ type: "line", x, y, x2, y2, color, width });
const text = (p, value, x, y, size, color, bold = false, align = "left", extra = {}) => p.items.push({ type: "text", value: String(value), x, y, size, color, bold, align, font: fontFor(String(value), p.font), ...extra });
function empty(s, label, key) {
  let [w, h] = pageSize(s);
  let p = { w, h, label, key, font: s.theme.font, items: [], cells: [] };
  rect(p, 0, 0, w, h, s.theme.colors.background);
  return p;
}
const recordPriority = { statutory: 0, commemorative: 1, personal: 2, school: 3 };
const eventLabel = entry => [entry.icon, entry.title].filter(Boolean).join(" ");
const fontFor = (value, font) => /[♥★]/.test(value) ? "Inter" : font;

function safeColor(preferred, background, fallback, minimum = 4.5) {
  const luminance = color => [1, 3, 5].reduce((sum, offset, index) => {
    const v = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
    return sum + (v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][index];
  }, 0);
  const base = luminance(background);
  const contrast = color => {
    const ink = luminance(color);
    return (Math.max(ink, base) + .05) / (Math.min(ink, base) + .05);
  };
  if (contrast(preferred) >= minimum) return preferred;
  if (contrast(fallback) >= minimum) return fallback;
  return contrast("#111111") > contrast("#ffffff") ? "#111111" : "#ffffff";
}

function mixColor(a, b, amount) {
  return "#" + [1, 3, 5].map(offset => {
    const start = Number.parseInt(a.slice(offset, offset + 2), 16);
    const end = Number.parseInt(b.slice(offset, offset + 2), 16);
    return Math.round(start * (1 - amount) + end * amount).toString(16).padStart(2, "0");
  }).join("");
}

function eventRows(records, maxLines, width, size, font, colorFor) {
  if (!maxLines || !records.length) return [];
  const fragments = records.map(record => {
    const label = eventLabel(record);
    const family = fontFor(label, font);
    return { lines: wrap(label, width, size, family), color: colorFor(record), font: family };
  });
  const needsSummary = fragments.length > 1 && fragments.reduce((length, fragment) => length + Math.min(3, fragment.lines.length), 0) > maxLines;
  const capacity = maxLines - Number(needsSummary);
  const output = [];
  let visible = 0;
  for (const fragment of fragments) {
    const available = Math.min(3, capacity - output.length);
    if (available <= 0) break;
    const lines = fragment.lines.slice(0, available);
    if (lines.length < fragment.lines.length) {
      lines[lines.length - 1] = abbreviate(lines.at(-1), width, size, fragment.font, true);
    }
    for (const value of lines) output.push({ value, color: fragment.color, font: fragment.font });
    visible++;
  }
  if (visible < records.length) output.push({ value: `+${records.length - visible}` });
  return output;
}

function drawGrid(p, s, data, editorial, y, m, box, mini = false) {
  const c = s.theme.colors;
  const preferredSize = mini ? Math.max(5.5, Math.min(8, box.w / 35)) : s.theme.bodySize;
  const key = monthKey(y, m);
  const first = key + "-01";
  const all = entries(s, data, editorial, first, key + "-" + monthLength(y, m));
  const grid = monthGrid(y, m, s.layout.weekstart);
  const rows = monthRows(y, m, s.layout.weekstart);
  const gutter = s.layout.isoWeeks ? mini ? 15 : 25 : 0;
  const cw = (box.w - gutter) / 7;
  if (box.h < (mini ? 27 : rows * (preferredSize + 7) + preferredSize * 2) || cw < (mini ? 6 : 11)) {
    throw Error(LT.siam_lapui_per_mazai_vietos_sumazinkite_parastes_srifta_ar_uzrasu_eilu);
  }
  const size = Math.min(preferredSize, cw * .49);
  const headingHeight = size * 1.9;
  const ch = (box.h - headingHeight) / rows;
  const daySize = mini ? Math.min(size, ch * .65) : size;
  const padding = mini ? 1 : Math.min(5, Math.max(2, daySize * .32));
  const dateY = padding + daySize * .83;
  const tint = mixColor(c.background, c.weekend, .075);
  const weekdayInk = safeColor(c.weekday, c.background, c.day, 3);
  const now = s.layout.printToday ? today() : null;
  for (let column = 0; column < 7; column++) {
    const dow = (column + s.layout.weekstart) % 7;
    text(p, DAYS[dow], box.x + gutter + (column + .5) * cw, box.y + size, size, weekdayInk, true, "center");
  }

  for (let row = 0; row < rows; row++) {
    const cy = box.y + headingHeight + row * ch;
    if (s.layout.isoWeeks) {
      const a = isoWeek(grid[row * 7]);
      const b = isoWeek(grid[row * 7 + 6]);
      const label = a.week === b.week ? String(a.week) : `${a.week}/${b.week}`;
      const labelSize = Math.min(mini ? 5.3 : 7, (gutter - 3) / (label.length * .62));
      text(p, label, box.x + gutter / 2, cy + dateY, labelSize, weekdayInk, false, "center");
    }

    for (let column = 0; column < 7; column++) {
      const date = grid[row * 7 + column];
      const inMonth = date.startsWith(key);
      const weekend = weekday(date) >= 5;
      const x = box.x + gutter + column * cw;
      const middle = x + cw / 2;
      const background = inMonth && weekend && s.layout.weekendTint ? tint : c.background;
      rect(p, x, cy, cw, ch, background === c.background ? "none" : background, c.grid, s.theme.lineWidth);
      if (!inMonth && !s.layout.neighbors) continue;

      const records = inMonth ? all.filter(e => e.from <= date && e.to >= date).sort((a, b) => recordPriority[a.kind] - recordPriority[b.kind]) : [];
      const isHoliday = records.some(entry => entry.kind === "statutory");
      const dayInk = !inMonth ? mixColor(c.day, background, .46) : isHoliday ? c.holiday : weekend && s.layout.weekends ? c.weekend : c.day;
      const colorFor = (entry, minimum = 4.5) => {
        const preferred = s.lowInk && entry.kind === "personal" ? c.personal : (entry.person && entry.personColor) || entry.color || c.personal;
        return safeColor(preferred, background, c.day, minimum);
      };
      if (date === now) {
        const highlight = Math.min(cw - 2, daySize * 2.4);
        rect(p, middle - highlight / 2, cy + .6, highlight, daySize + padding, mixColor(background, c.title, .15));
      }
      text(p, +date.slice(8), middle, cy + dateY, daySize, safeColor(dayInk, background, c.day, inMonth ? 4.5 : 3), true, "center", { date });
      if (date >= "1900-01-01" && date <= "2100-12-31") {
        p.cells.push({ date, x, y: cy, w: cw, h: ch, count: records.length });
      }

      if (!inMonth) continue;
      const markColors = s.layers.display === "legend" ? [] : [...new Map(records.map(r => [r.kind, colorFor(r, 3)])).values()];
      const short = mini || ch < daySize + 14;
      let contentTop = cy + padding + daySize + 2;
      if (short && markColors.length && cw > daySize * 2.1 + 4) {
        circle(p, x + cw - Math.min(3.6, cw * .15), cy + dateY - daySize * .31, mini ? .9 : 1.55, markColors[0]);
      } else if (!short && markColors.length) {
        const radius = Math.min(1.65, cw * .05);
        const spacing = radius * 3.5;
        markColors.forEach((color, i) => circle(p, middle + (i - (markColors.length - 1) / 2) * spacing, contentTop, radius, color));
        contentTop += radius + 4;
      }
      if (mini) continue;

      const edge = Math.min(5, cw * .12);
      const width = cw - 2 * edge;
      const bottom = cy + ch - 4;
      const noteStep = 12;
      const eventSize = Math.max(6.6, Math.min(11.5, daySize * .77));
      const leading = eventSize * 1.28;
      const showLabels = s.layers.display === "cell" && records.length > 0;
      const requestedLines = Math.min(s.layout.cellLines, Math.max(0, Math.floor((bottom - contentTop - (showLabels ? leading + 3 : 0)) / noteStep)));
      const gap = requestedLines && showLabels ? 3 : 0;
      const maxLines = showLabels ? Math.max(0, Math.min(5, Math.floor((bottom - contentTop - requestedLines * noteStep - gap) / leading))) : 0;
      const labels = eventRows(records, maxLines, width, eventSize, p.font, colorFor);
      const atBottom = s.layout.eventPlacement === "bottom";
      const labelY = atBottom ? bottom - labels.length * leading : contentTop;
      const writingY = atBottom ? contentTop : bottom - requestedLines * noteStep;
      labels.forEach((label, i) => text(p, label.value, middle, labelY + i * leading + eventSize, eventSize, label.color || weekdayInk, false, "center", label.font ? { font: label.font } : {}));
      for (let i = 0; i < requestedLines; i++) {
        const y = writingY + (i + .8) * noteStep;
        line(p, x + edge, y, x + cw - edge, y, c.grid, .32);
      }
    }
  }
  return all;
}
function appendices(s, lines, label, key) {
  const pages = [];
  let p, y;
  const margin = s.layout.margin * MM;
  const size = Math.max(8, s.theme.bodySize);
  const leading = size * 1.45;
  function fresh() {
    p = empty(s, `${label}${LT.irasu_sarasas}${pages.length + 1}`, key);
    pages.push(p);
    const title = `${label} · ${LT.calendar_records_title}`;
    const titleSize = Math.min(20, s.theme.titleSize);
    text(p, abbreviate(title, p.w - 2 * margin, titleSize, p.font, false, true), p.w / 2, margin + 22, titleSize, s.theme.colors.title, true, "center");
    y = margin + 45;
  }

  for (const item of lines) {
    const family = fontFor(item, s.theme.font);
    const width = (p?.w ?? pageSize(s)[0]) - 2 * margin - 4;
    for (const chunk of wrap(item, width, size, family)) {
      if (!p || y + size * .25 > p.h - margin) fresh();
      text(p, chunk, margin, y, size, s.theme.colors.day, false, "left", { font: family });
      y += leading;
    }
    y += leading * .5;
  }
  return pages;
}
function entryLines(all) {
  return all.map(entry => {
    const range = entry.to === entry.from ? entry.from : `${entry.from}–${entry.to}`;
    const type = entry.kind === "statutory" ? LT.svente : entry.kind === "commemorative" ? LT.atmintina_diena : entry.kind === "school" ? LT.mokykla : entry.person || LT.asmeninis_ivykis;
    return [range, type, eventLabel(entry), entry.note].filter(Boolean).join(" · ");
  });
}

function titleBlock(p, s, title, margin) {
  const width = p.w - 2 * margin;
  const colors = s.theme.colors;
  const size = Math.min(s.theme.titleSize, Math.max(12, s.theme.titleSize * width / Math.max(width, textWidth(title, s.theme.titleSize, p.font, true))));
  const y = margin + size;
  text(p, abbreviate(title, width, size, p.font, false, true), p.w / 2, y, size, colors.title, true, "center");
  text(p, abbreviate(s.name, width, 8.5, p.font), p.w / 2, y + 14, 8.5, colors.weekday, false, "center");
  return y + 25;
}

function scenes(state, data, editorial) {
  const result = [];
  const period = months(state);
  if (state.period.mode === "annual") {
    const s = effective(state, "");
    const label = `${state.period.year} metai`;
    const p = empty(s, label, "annual");
    const margin = s.layout.margin * MM;
    const top = titleBlock(p, s, `${state.period.year}${LT.metu_kalendorius}`, margin);
    const bottom = p.h - margin - 11;
    const columns = p.w > p.h ? 4 : 3;
    const gap = 11;
    const width = (p.w - 2 * margin - gap * (columns - 1)) / columns;
    const height = (bottom - top - gap * (12 / columns - 1)) / (12 / columns);
    const all = [];
    period.forEach(([year, month], index) => {
      const x = margin + index % columns * (width + gap);
      const y = top + Math.floor(index / columns) * (height + gap);
      const heading = MONTHS[month - 1];
      const size = Math.min(10, 10 * width / Math.max(width, textWidth(heading, 10, p.font, true)));
      text(p, heading, x + width / 2, y + size, size, s.theme.colors.title, true, "center");
      all.push(...drawGrid(p, s, data, editorial, year, month, { x, y: y + 14, w: width, h: height - 14 }, true));
    });
    if (all.length) {
      text(p, LT.calendar_records_appendix, p.w / 2, p.h - margin, 7.25, s.theme.colors.weekday, false, "center");
    }
    const unique = [...new Map(all.map(entry => [entry.kind + ":" + entry.id + ":" + entry.from, entry])).values()];
    return [p, ...appendices(s, entryLines(unique), label, "annual")];
  }

  for (const [year, month] of period) {
    const key = monthKey(year, month);
    const s = effective(state, key);
    const label = `${year} · ${MONTHS[month - 1]}`;
    const p = empty(s, label, key);
    const margin = s.layout.margin * MM;
    const c = s.theme.colors;
    const width = p.w - 2 * margin;
    const full = entryLines(entries(s, data, editorial, key + "-01", key + "-" + monthLength(year, month)));
    if (s.notes[key]) full.push(LT.uzrasai + s.notes[key]);
    const legend = full.flatMap(value => {
      const font = fontFor(value, p.font);
      return wrap(value, width - 4, 8, font).map(line => ({ line, font }));
    });
    const compact = legend.length <= 5;
    const notesH = s.layout.notes ? 21 + s.layout.notes * 14 : 0;
    const legendH = compact && legend.length ? 23 + legend.length * 11 : 0;
    const footerH = !compact && full.length ? 13 : 0;
    const bottom = p.h - margin - notesH - legendH - footerH;
    let top = titleBlock(p, s, `${MONTHS[month - 1]} ${year}`, margin) + 3;
    let x = margin;
    let gridWidth = width;
    const photoId = Object.hasOwn(s.assignments.months, key) ? s.assignments.months[key] : s.assignments.all;
    const photo = s.photos.find(item => item.id === photoId);
    let photoHeight = Math.min(s.layout.photoHeight * MM, p.h * .4);
    if (s.theme.placement === "top") {
      const minGrid = monthRows(year, month, s.layout.weekstart) * (s.theme.bodySize + 7) + 2 * s.theme.bodySize;
      photoHeight = Math.max(0, Math.min(photoHeight, bottom - top - minGrid - 13));
    }
    if (photo && photoHeight > 0 && !s.lowInk) {
      let frame;
      if (s.theme.placement === "side") {
        const w = Math.min(width * .28, photoHeight);
        frame = { x: margin, y: top, w, h: bottom - top };
        x += w + 12;
        gridWidth -= w + 12;
      } else if (s.theme.placement === "background") {
        frame = { x: 0, y: 0, w: p.w, h: p.h };
      } else {
        frame = { x: margin, y: top, w: width, h: photoHeight };
        top += photoHeight + 13;
      }
      // The shared layout creates the title first. Place the photo behind it.
      p.items.splice(1, 0, { type: "photo", ...frame, photo, background: s.theme.placement === "background" });
    }

    drawGrid(p, s, data, editorial, year, month, { x, y: top, w: gridWidth, h: bottom - top });
    if (s.layout.notes) {
      text(p, LT.uzrasai_ir_darbai, margin, bottom + 16, 8, c.weekday, true);
      for (let i = 0; i < s.layout.notes; i++) {
        const y = bottom + 29 + 14 * i;
        rect(p, margin, y - 7, 6, 6, "none", c.grid);
        line(p, margin + 13, y, p.w - margin, y, c.grid, .35);
      }
    }
    if (legendH) {
      const headingY = bottom + notesH + 15;
      text(p, LT.calendar_records_title, p.w / 2, headingY, 9, c.title, true, "center");
      legend.forEach(({ line: value, font }, i) => text(p, value, p.w / 2, headingY + 12 + i * 11, 8, c.day, false, "center", { font }));
    } else if (footerH) {
      text(p, LT.calendar_records_appendix, p.w / 2, p.h - margin, 7.25, c.weekday, false, "center");
    }
    result.push(p);
    if (!compact) result.push(...appendices(s, full, label, key));
  }
  return result;
}
function svg(p, photoURLs = {}, fontCSS = "", { interactive = false } = {}) {
  const items = p.items.map(i => {
    if (i.type === "rect") return `<rect x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}" fill="${i.fill || "none"}" stroke="${i.stroke || "none"}" stroke-width="${i.line}"/>`;
    if (i.type === "circle") return `<circle cx="${i.x}" cy="${i.y}" r="${i.r}" fill="${i.color}"/>`;
    if (i.type === "line") return `<path d="M${i.x} ${i.y}L${i.x2} ${i.y2}" fill="none" stroke="${i.color}" stroke-width="${i.width}"/>`;
    if (i.type === "photo") {
      const url = photoURLs[i.photo.id + ":" + i.w + ":" + i.h];
      return url ? `<image x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}" opacity="${i.background ? .18 : 1}" href="${escape(url)}"/>` : "";
    }
    const font = i.font || p.font;
    const anchor = i.align === "center" ? "middle" : i.align === "right" ? "end" : "start";
    return `<text x="${i.x}" y="${i.y}" font-size="${i.size}" font-family="${font}" font-weight="${i.bold ? 700 : 400}" fill="${i.color}" text-anchor="${anchor}">${escape(i.value)}</text>`;
  }).join("");
  const targets = interactive ? p.cells.map(({ date, x, y, w, h, count }) => {
    const label = count ? `${date}. ${LT.calendar_record_count} ${count}. ${LT.calendar_open_day}` : `${date}. ${LT.calendar_open_day}`;
    return `<rect data-editor-date="${date}" x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent" tabindex="0" role="button" aria-label="${escape(label)}"/>`;
  }).join("") : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}" viewBox="0 0 ${p.w} ${p.h}" role="group" aria-label="${escape(p.label)}"><style>${fontCSS}text{white-space:pre}</style>${items}${targets}</svg>`;
}
export {
  MM,
  escape,
  pageSize,
  scenes,
  svg,
  wrap
};
