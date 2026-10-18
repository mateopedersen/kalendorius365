import { LT } from "./lt.js";
import { validate, clone, uid } from "./model.js";
import { originals, byteTotal } from "./photos.js";
const MAX = 160 * 1024 * 1024, enc = new TextEncoder(), dec = new TextDecoder();
const table = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 3988292384 ^ n >>> 1 : n >>> 1;
  return n >>> 0;
});
function crc(bytes) {
  let c = 4294967295;
  for (let b of bytes) c = table[(c ^ b) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
function header(n) {
  let b = new Uint8Array(n);
  return [b, new DataView(b.buffer)];
}
async function zip(files, check = () => {
}) {
  let parts = [], central = [], offset = 0;
  for (let f of files) {
    check();
    let bytes = new Uint8Array(await f.blob.arrayBuffer()), name = enc.encode(f.name), sum = crc(bytes), [h, v] = header(30);
    v.setUint32(0, 67324752, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 2048, true);
    v.setUint32(14, sum, true);
    v.setUint32(18, bytes.length, true);
    v.setUint32(22, bytes.length, true);
    v.setUint16(26, name.length, true);
    parts.push(h, name, bytes);
    let [c, cv] = header(46);
    cv.setUint32(0, 33639248, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 2048, true);
    cv.setUint32(16, sum, true);
    cv.setUint32(20, bytes.length, true);
    cv.setUint32(24, bytes.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.push(c, name);
    offset += 30 + name.length + bytes.length;
    await new Promise((r) => setTimeout(r, 0));
  }
  let centralSize = central.reduce((n, b) => n + b.length, 0), [end, ev] = header(22);
  ev.setUint32(0, 101010256, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}
async function unzip(blob) {
  if (blob.size > MAX) throw Error(LT.projekto_failas_gali_buti_iki_160_mb);
  let bytes = new Uint8Array(await blob.arrayBuffer()), v = new DataView(bytes.buffer), pos = 0, files = /* @__PURE__ */ new Map(), total = 0;
  while (pos + 4 <= bytes.length && v.getUint32(pos, true) === 67324752) {
    if (pos + 30 > bytes.length) throw Error(LT.sugadintas_projekto_archyvas);
    let flags = v.getUint16(pos + 6, true), method = v.getUint16(pos + 8, true), sum = v.getUint32(pos + 14, true), size = v.getUint32(pos + 18, true), unpacked = v.getUint32(pos + 22, true), n = v.getUint16(pos + 26, true), extra = v.getUint16(pos + 28, true), start = pos + 30 + n + extra, end = start + size;
    if (method !== 0 || flags !== 2048 || size !== unpacked || end > bytes.length || files.size >= 26) throw Error(LT.nepalaikomas_arba_sugadintas_projekto_archyvas);
    let name = dec.decode(bytes.slice(pos + 30, pos + 30 + n));
    if (!/^(projektas\.json|nuotraukos\/[a-zA-Z0-9-]+\.(jpg|png|webp))$/.test(name) || files.has(name)) throw Error(LT.neleistinas_projekto_failo_pavadinimas);
    total += size;
    if (total > MAX || name === "projektas.json" && size > 3 * 1024 * 1024 || name !== "projektas.json" && size > 12 * 1024 * 1024) throw Error(LT.projektas_per_didelis);
    let data = bytes.slice(start, end);
    if (crc(data) !== sum) throw Error(LT.projekto_failo_kontroline_suma_nesutampa);
    files.set(name, data);
    pos = end;
  }
  if (!files.has("projektas.json") || pos + 4 > bytes.length || v.getUint32(pos, true) !== 33639248) throw Error(LT.nerastas_projekto_aprasas);
  return files;
}
const extension = (t) => t === "image/jpeg" ? "jpg" : t === "image/png" ? "png" : "webp";
async function portable(s) {
  validate(s);
  let files = [{ name: "projektas.json", blob: new Blob([JSON.stringify(s)], { type: "application/json" }) }];
  for (let p of s.photos) {
    let b = originals.get(p.id);
    if (!b) throw Error(LT.nerastas_nuotraukos_originalas);
    files.push({ name: `nuotraukos/${p.id}.${extension(p.type)}`, blob: b });
  }
  return zip(files);
}
async function readPortable(blob) {
  let files = await unzip(blob), state;
  try {
    state = JSON.parse(dec.decode(files.get("projektas.json")));
  } catch {
    throw Error(LT.neteisingas_projekto_json);
  }
  validate(state);
  let photos = /* @__PURE__ */ new Map(), total = 0;
  for (let p of state.photos) {
    let b = files.get(`nuotraukos/${p.id}.${extension(p.type)}`);
    if (!b) throw Error(LT.projekte_truksta_nuotraukos_originalo);
    let type = b[0] === 255 && b[1] === 216 ? "image/jpeg" : b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71 ? "image/png" : String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP" ? "image/webp" : null;
    if (type !== p.type) throw Error(LT.nuotraukos_turinys_neatitinka_failo_tipo);
    let raw = new Blob([b], { type: p.type });
    total += raw.size;
    photos.set(p.id, raw);
  }
  if (files.size !== photos.size + 1 || total > 96 * 1024 * 1024) throw Error(LT.projekte_yra_pertekliniu_arba_per_dideliu_failu);
  return { state, photos };
}
function photoBlob(record, type) {
  if (record?.blob instanceof Blob) return record.blob;
  if (record?.bytes instanceof ArrayBuffer || ArrayBuffer.isView(record?.bytes))
    return new Blob([record.bytes], { type: type || record.type || "application/octet-stream" });
  throw Error(LT.truksta_nuotraukos_originalo);
}
let dbPromise;
function db() {
  if (!globalThis.indexedDB) return Promise.reject(Error(LT.sioje_narsykleje_saugykla_neprieinama));
  return dbPromise ??= new Promise((resolve, reject) => {
    let req = indexedDB.open("kalendorius365-editorius", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("projects", { keyPath: "id" });
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}
async function list() {
  let d = await db();
  return new Promise((resolve, reject) => {
    let tx = d.transaction("projects"), req = tx.objectStore("projects").getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.updated - a.updated));
    req.onerror = () => reject(req.error);
  });
}
async function save(s) {
  validate(s);
  if (s.photos.reduce((n, p) => n + (originals.get(p.id)?.size || 0), 0) > 96 * 1024 * 1024) throw Error(LT.bendra_nuotrauku_riba_96_mb);
  let photos = await Promise.all(s.photos.map(async (p) => {
    let blob = originals.get(p.id);
    if (!blob) throw Error(LT.truksta_nuotraukos_originalo);
    return { id: p.id, type: p.type, bytes: await blob.arrayBuffer() };
  })), d = await db();
  return new Promise((resolve, reject) => {
    let tx = d.transaction("projects", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || Error(LT.saugojimas_nutrauktas));
    tx.objectStore("projects").put({ id: s.id, name: s.name, state: clone(s), photos, updated: Date.now() });
  });
}
async function remove(id) {
  let d = await db();
  return new Promise((resolve, reject) => {
    let tx = d.transaction("projects", "readwrite");
    tx.objectStore("projects").delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
function duplicate(s) {
  let q = clone(s);
  q.id = uid();
  q.name = (s.name + " (kopija)").slice(0, 100);
  return q;
}
export {
  crc,
  duplicate,
  list,
  photoBlob,
  portable,
  readPortable,
  remove,
  save,
  unzip,
  zip
};
