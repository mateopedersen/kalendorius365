import { LT } from "./lt.js";
import { svg } from "./scene.js";
import { photoURLs, image } from "./photos.js";
import { zip } from "./storage.js";
import { MONTH_FILES } from "./model.js";
let loader;
async function pdfLibrary() {
  if (window.jspdf) return window.jspdf.jsPDF;
  loader ??= new Promise((resolve, reject) => {
    let script = document.createElement("script");
    script.src = new URL("./vendor/jspdf-4.2.1.umd.min.js" + new URL(import.meta.url).search, import.meta.url).href;
    script.onload = resolve;
    script.onerror = () => {
      loader = null;
      script.remove();
      reject(Error(LT.nepavyko_ikelti_pdf_priemones_patikrinkite_rysi));
    };
    document.head.append(script);
  });
  await loader;
  return window.jspdf.jsPDF;
}
const fontUrls = {
  Lato: { Regular: "/assets/fonts/Lato-Regular.ttf", Bold: "/assets/fonts/Lato-Bold.ttf" },
  Inter: { Regular: "/assets/fonts/Inter-Regular.ttf", Bold: "/assets/fonts/Inter-Bold.ttf" },
};
const fontCache = /* @__PURE__ */ new Map();
async function fonts(family) {
  if (!fontCache.has(family)) {
    fontCache.set(family, Promise.all(["Regular", "Bold"].map(async (weight) => {
      let response = await fetch(fontUrls[family][weight]);
      if (!response.ok) throw Error(LT.nepavyko_ikelti_lietuvisko_srifto);
      let bytes = new Uint8Array(await response.arrayBuffer());
      let result = "";
      for (let start = 0; start < bytes.length; start += 32768) result += String.fromCharCode(...bytes.subarray(start, start + 32768));
      return btoa(result);
    })).catch((e) => {
      fontCache.delete(family);
      throw e;
    }));
  }
  return fontCache.get(family);
}
function download(blob, name) {
  let url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 6e4);
}
function stem(page) {
  if (page.key === "annual") return `${page.label.slice(0, 4)}-metu-kalendorius`;
  let [year, m] = page.key.split("-");
  return `${year}-${MONTH_FILES[+m - 1]}-kalendorius`;
}
async function pdf(pages, check, progress) {
  let JsPDF = await pdfLibrary();
  check();
  let first = pages[0], doc = new JsPDF({ unit: "pt", format: [first.w, first.h], orientation: first.w > first.h ? "landscape" : "portrait", compress: true, putOnlyUsedFonts: true });
  let families = [...new Set(pages.flatMap((p) => [p.font, ...p.items.filter((i) => i.type === "text").map((i) => i.font || p.font)]))];
  for (let family of families) {
    let [regular, bold] = await fonts(family);
    for (let [style, bytes] of [["normal", regular], ["bold", bold]]) {
      let name = `${family}-${style}.ttf`;
      doc.addFileToVFS(name, bytes);
      doc.addFont(name, family, style);
    }
  }
  for (let n = 0; n < pages.length; n++) {
    check();
    let page = pages[n];
    if (n) doc.addPage([page.w, page.h], page.w > page.h ? "landscape" : "portrait");
    let urls = await photoURLs(page, 300);
    check();
    for (let i of page.items) {
      if (i.type === "rect") {
        if (i.fill && i.fill !== "none") doc.setFillColor(i.fill);
        if (i.stroke && i.stroke !== "none") doc.setDrawColor(i.stroke);
        doc.setLineWidth(i.line || 0.4);
        let fill = i.fill && i.fill !== "none", stroke = i.stroke && i.stroke !== "none";
        if (fill || stroke) doc.rect(i.x, i.y, i.w, i.h, fill && stroke ? "FD" : fill ? "F" : "S");
      } else if (i.type === "line") {
        doc.setDrawColor(i.color);
        doc.setLineWidth(i.width);
        doc.line(i.x, i.y, i.x2, i.y2);
      } else if (i.type === "text") {
        doc.setFont(i.font || page.font, i.bold ? "bold" : "normal");
        doc.setFontSize(i.size);
        doc.setTextColor(i.color);
        doc.text(i.value, i.x, i.y, { align: i.align });
      } else {
        let data = urls[i.photo.id + ":" + i.w + ":" + i.h];
        if (i.background) doc.setGState(new doc.GState({ opacity: 0.18 }));
        doc.addImage(data, "JPEG", i.x, i.y, i.w, i.h, void 0, "FAST");
        if (i.background) doc.setGState(new doc.GState({ opacity: 1 }));
      }
    }
    progress(n + 1, pages.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  check();
  doc.setProperties({ title: LT.asmeninis_kalendorius, subject: LT.kalendorius365_lietuviskas_spausdinamas_kalendorius, creator: "Kalendorius365" });
  return doc.output("blob");
}
async function raster(page, type = "image/webp", ppi = 300) {
  await document.fonts.ready;
  let [regular, bold] = await fonts(page.font), [inter, interBold] = await fonts("Inter"), css = `@font-face{font-family:Inter;src:url(data:font/ttf;base64,${inter})}@font-face{font-family:Inter;font-weight:700;src:url(data:font/ttf;base64,${interBold})}@font-face{font-family:${page.font};src:url(data:font/ttf;base64,${regular})} @font-face{font-family:${page.font};font-weight:700;src:url(data:font/ttf;base64,${bold})}`, urls = await photoURLs(page, ppi), markup = svg(page, urls, css);
  let img = await image(new Blob([markup], { type: "image/svg+xml" })), canvas = document.createElement("canvas");
  canvas.width = Math.round(page.w / 72 * ppi);
  canvas.height = Math.round(page.h / 72 * ppi);
  if (canvas.width * canvas.height > 35e6) throw Error(LT.pasirinktas_lapas_virsija_narsykles_isvesties_riba);
  let ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let blob = await new Promise((r) => canvas.toBlob(r, type, 0.98));
  canvas.width = canvas.height = 1;
  if (!blob || blob.type !== type) throw Error(type === "image/webp" ? LT.si_narsykle_negali_sukurti_webp_failo_pasirinkite_png_arba_pdf : LT.nepavyko_sukurti_paveikslo);
  return blob;
}
async function bundle(pages, paired, check, progress) {
  let files = [], groups = /* @__PURE__ */ new Map();
  for (let page of pages) {
    let key = page.key;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(page);
  }
  let count = 0;
  for (let group of groups.values()) {
    check();
    let name = stem(group[0]);
    if (paired) files.push({ name: name + ".pdf", blob: await pdf(group, check, () => {
    }) });
    for (let i = 0; i < group.length; i++) {
      check();
      files.push({ name: name + (i ? `-priedas-${i}` : "") + ".webp", blob: await raster(group[i]) });
    }
    progress(++count, groups.size);
    await new Promise((r) => setTimeout(r, 0));
  }
  return zip(files, check);
}
async function printPages(pages, check, progress) {
  let win = window.open("", "_blank");
  if (!win) throw Error(LT.leiskite_atverti_spausdinimo_langa);
  try {
    win.document.write('<!doctype html><html lang="lt"><head><meta charset="utf-8"><title>Mano kalendorius · Spausdinti</title></head><body></body></html>');
    win.document.close();
    let style = win.document.createElement("style");
    style.textContent = `@page{size:${pages[0].w}pt ${pages[0].h}pt;margin:0}html,body{width:100%;height:auto;margin:0;padding:0}section{display:block;box-sizing:border-box;width:${pages[0].w}pt;height:${pages[0].h}pt;margin:0;padding:0;break-inside:avoid;page-break-inside:avoid}section:not(:last-child){break-after:page;page-break-after:always}svg{display:block;width:100%;height:100%}@media print{section{overflow:hidden}}@media screen{body{background:#ddd}section{background:white;margin:12px auto}}`;
    win.document.head.append(style);
    for (let i = 0; i < pages.length; i++) {
      check();
      let page = pages[i], [normal, bold] = await fonts(page.font), [inter, interBold] = await fonts("Inter"), urls = await photoURLs(page, 300), section = win.document.createElement("section");
      section.innerHTML = svg(page, urls, `@font-face{font-family:Inter;src:url(data:font/ttf;base64,${inter})}@font-face{font-family:Inter;font-weight:700;src:url(data:font/ttf;base64,${interBold})}@font-face{font-family:${page.font};src:url(data:font/ttf;base64,${normal})}@font-face{font-family:${page.font};font-weight:700;src:url(data:font/ttf;base64,${bold})}`);
      win.document.body.append(section);
      progress(i + 1, pages.length);
    }
    await win.document.fonts.ready;
    await Promise.all([...win.document.images].map((img) => img.decode().catch(() => {
    })));
    check();
    win.focus();
    win.print();
  } catch (e) {
    win.close();
    throw e;
  }
}
export {
  bundle,
  download,
  fonts,
  pdf,
  printPages,
  raster,
  stem
};
