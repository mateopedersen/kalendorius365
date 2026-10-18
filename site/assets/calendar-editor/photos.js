import { uid } from "./model.js";
const originals = /* @__PURE__ */ new Map();
const decoded = /* @__PURE__ */ new Map();
function image(blob) {
  return new Promise((resolve, reject) => {
    let img = new Image(), url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(Error("Nuotraukos nepavyko perskaityti"));
    };
    img.src = url;
  });
}
async function upload(file) {
  if (file.size > 12 * 1024 * 1024) throw Error("Viena nuotrauka gali būti iki 12 MB");
  let b = new Uint8Array(await file.slice(0, 12).arrayBuffer()), type = b[0] === 255 && b[1] === 216 ? "image/jpeg" : b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71 ? "image/png" : String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP" ? "image/webp" : null;
  if (!type) throw Error("Tinka tik JPEG, PNG ir WebP nuotraukos");
  let blob = new Blob([file], { type }), img = await image(blob);
  if (img.naturalWidth * img.naturalHeight > 4e7) throw Error("Nuotrauka gali turėti iki 40 megapikselių");
  let id = uid();
  originals.set(id, blob);
  decoded.set(id, img);
  return { id, name: file.name.slice(0, 140), type, width: img.naturalWidth, height: img.naturalHeight, x: 0.5, y: 0.5, zoom: 1, rotation: 0, fit: "cover", brightness: 1, contrast: 1, saturation: 1, warmth: 0, opacity: 1, overlay: 0, overlayColor: "light", mono: false };
}
async function source(p) {
  if (!decoded.has(p.id)) {
    let blob = originals.get(p.id);
    if (!blob) throw Error("Nerastas nuotraukos originalas. Importuokite projekto failą.");
    decoded.set(p.id, await image(blob));
  }
  return decoded.get(p.id);
}
function dpi(p, w, h) {
  let rotated = p.rotation % 180 !== 0, sw = rotated ? p.height : p.width, sh = rotated ? p.width : p.height;
  let scale = p.fit === "cover" ? Math.max(w / sw, h / sh) : Math.min(w / sw, h / sh);
  return 72 / (scale * p.zoom);
}
async function renderPhoto(p, w, h, ppi = 100) {
  let img = await source(p), canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(w * ppi / 72));
  canvas.height = Math.max(1, Math.ceil(h * ppi / 72));
  if (canvas.width * canvas.height > 35e6) throw Error("Nuotraukos išvestis per didelė. Pasirinkite mažesnį formatą.");
  let ctx = canvas.getContext("2d", { willReadFrequently: true }), sw = p.rotation % 180 ? p.height : p.width, sh = p.rotation % 180 ? p.width : p.height, scale = (p.fit === "cover" ? Math.max(canvas.width / sw, canvas.height / sh) : Math.min(canvas.width / sw, canvas.height / sh)) * p.zoom;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let ww = sw * scale, hh = sh * scale, ox = (canvas.width - ww) * p.x, oy = (canvas.height - hh) * p.y;
  ctx.save();
  ctx.translate(ox + ww / 2, oy + hh / 2);
  ctx.rotate(p.rotation * Math.PI / 180);
  ctx.drawImage(img, -p.width * scale / 2, -p.height * scale / 2, p.width * scale, p.height * scale);
  ctx.restore();
  let changed = p.brightness !== 1 || p.contrast !== 1 || p.saturation !== 1 || p.mono || p.warmth || p.opacity !== 1 || p.overlay;
  if (changed) {
    let im = ctx.getImageData(0, 0, canvas.width, canvas.height), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2], grey = 0.2126 * r + 0.7152 * g + 0.0722 * b, sat = p.mono ? 0 : p.saturation;
      r = (grey + (r - grey) * sat) * p.brightness;
      g = (grey + (g - grey) * sat) * p.brightness;
      b = (grey + (b - grey) * sat) * p.brightness;
      let rgb = [r + p.warmth * 22, g + p.warmth * 3, b - p.warmth * 22].map((v) => Math.min(255, Math.max(0, (v - 128) * p.contrast + 128)));
      for (let k = 0; k < 3; k++) d[i + k] = Math.round((rgb[k] * p.opacity + 255 * (1 - p.opacity)) * (1 - p.overlay) + (p.overlayColor === "dark" ? 0 : 255) * p.overlay);
    }
    ctx.putImageData(im, 0, 0);
  }
  return canvas;
}
async function photoURLs(page, ppi = 100) {
  let urls = {};
  for (let item of page.items.filter((i) => i.type === "photo")) {
    let canvas = await renderPhoto(item.photo, item.w, item.h, ppi);
    urls[item.photo.id + ":" + item.w + ":" + item.h] = canvas.toDataURL("image/jpeg", 0.96);
    canvas.width = canvas.height = 1;
    await new Promise((r) => setTimeout(r, 0));
  }
  return urls;
}
async function palette(p) {
  let im = await source(p), c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  let x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(im, 0, 0, 64, 64);
  let d = x.getImageData(0, 0, 64, 64).data, counts = /* @__PURE__ */ new Map();
  for (let i = 0; i < d.length; i += 4) {
    let rgb2 = [d[i], d[i + 1], d[i + 2]].map((v) => Math.round(v / 32) * 32);
    if (Math.max(...rgb2) - Math.min(...rgb2) < 15 || rgb2.reduce((a, b) => a + b, 0) > 700) continue;
    let key = rgb2.join(",");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let sorted = [...counts].sort((a, b) => b[1] - a[1]).map((x2) => x2[0].split(",").map(Number));
  let rgb = sorted[0] || [30, 90, 70], accent = sorted.find((c2) => c2.reduce((n, v, i) => n + Math.abs(v - rgb[i]), 0) > 100) || [85, 90, 140];
  const dark = (c2) => {
    c2 = [...c2];
    while (0.2126 * c2[0] + 0.7152 * c2[1] + 0.0722 * c2[2] > 105) c2 = c2.map((v) => Math.round(v * 0.85));
    return c2;
  }, hex = (c2) => "#" + c2.map((v) => Math.min(255, v).toString(16).padStart(2, "0")).join("");
  return { title: hex(dark(rgb)), personal: hex(dark(accent)), background: hex(rgb.map((v) => Math.round(v * 0.06 + 255 * 0.94))) };
}
function forget(id) {
  originals.delete(id);
  decoded.delete(id);
}
function byteTotal() {
  return [...originals.values()].reduce((n, b) => n + b.size, 0);
}
export {
  byteTotal,
  dpi,
  forget,
  image,
  originals,
  palette,
  photoURLs,
  renderPhoto,
  source,
  upload
};
