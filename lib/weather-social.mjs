import { cityImages } from "./weather-data.mjs";
import { municipalities, weatherPlaces } from "./weather-places.mjs";

export const WIDTH = 1200;
export const HEIGHT = 630;
export const assetRoot = "/assets/visuals/weather-share/";
export const imageRoot = "/oru-vaizdai/v1/";
export const directories = {
  miestai: "Lietuvos miestų orai",
  savivaldybes: "Orai pagal savivaldybę",
};

export function weatherSocial(route) {
  const place = weatherPlaces.get(route);
  if (!place && !Object.hasOwn(directories, route)) return null;
  const photo = Object.hasOwn(cityImages, route) ? cityImages[route] : null;
  const name = place?.name ?? directories[route];
  const district = place && municipalities.get(place.district);
  const county = district?.county.replace(" apskr.", " apskritis");
  const area = place?.municipality ? county : [place?.ward, district?.name].filter(Boolean).join(" · ");
  const title = place?.locative ? `Orai ${place.locative}` : name;
  return {
    src: photo ? `${assetRoot}${route}-v1.jpg` : `${imageRoot}${route}.png`,
    alt: photo ? `${title}. ${photo.alt}.` : `Orų prognozė · ${name}${area ? ` (${area})` : ""}. Lietuvos žemėlapis.`,
    width: WIDTH, height: HEIGHT, type: photo ? "image/jpeg" : "image/png",
    title, area, place, photo,
  };
}

const STRIDE = WIDTH + 1;
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value;
});

function pngChunk(type, data) {
  const bytes = new Uint8Array(data.length + 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) bytes[i + 4] = type.charCodeAt(i);
  bytes.set(data, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < data.length + 8; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  view.setUint32(bytes.length - 4, crc ^ 0xffffffff);
  return bytes;
}

export async function openAtlas(background, type) {
  const stream = background.body.pipeThrough(new DecompressionStream("deflate"));
  const [buffer, { palette, glyphs }] = await Promise.all([new Response(stream).arrayBuffer(), type.json()]);
  if (buffer.byteLength !== STRIDE * HEIGHT) throw new Error("Weather image template size");
  return { base: new Uint8Array(buffer), palette: Uint8Array.from(palette), glyphs };
}

function measure(text, glyphs) {
  let width = 0;
  for (const char of text) width += (glyphs[char] ?? glyphs["?"])[0];
  return width;
}

function lines(text, glyphs, limit) {
  const rows = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? line + " " + word : word;
    if (line && measure(next, glyphs) > limit) {
      rows.push(line);
      line = word;
    } else line = next;
  }
  return rows.concat(line);
}

function drawText(pixels, text, glyphs, x, y, ink, limit) {
  for (const char of text.normalize("NFC")) {
    const [advance, left, top, width, height, encoded] = glyphs[char] ?? glyphs["?"];
    if (x + left + width > limit) break;
    const mask = atob(encoded);
    for (let row = 0; row < height; row++) {
      const offset = (y + top + row) * STRIDE + 1 + x + left;
      for (let col = 0; col < width; col++) {
        const opacity = mask.charCodeAt(row * width + col);
        if (opacity) pixels[offset + col] = ink + opacity;
      }
    }
    x += advance;
  }
}

function plotPlace(pixels, { latitude, longitude }) {
  const x = Math.round(773 + (longitude - 20.6) * 62);
  const y = Math.round(148 + (56.55 - latitude) * 108);
  for (let j = -19; j <= 19; j++) {
    for (let i = -19; i <= 19; i++) {
      const radius = i*i + j*j;
      const color = radius <= 25 ? 8 : radius <= 100 ? 16 : radius <= 144 ? 0 : radius >= 300 && radius <= 361 ? 28 : 0;
      if (color || radius <= 144) pixels[(y+j)*STRIDE + x+i+1] = color;
    }
  }
}

const coord = new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 3, minimumFractionDigits: 3, useGrouping: false });

export async function renderWeatherPng(image, atlas) {
  const { title, area, place } = image;
  const { base, palette, glyphs } = atlas;
  const pixels = base.slice();
  const large = glyphs[68], medium = glyphs[54], small = glyphs[30];
  const titleRows = lines(title, large, 626);
  const titleGlyphs = titleRows.length === 1 ? large : medium;
  for (const [index, row] of lines(title, titleGlyphs, 626).entries()) {
    drawText(pixels, row, titleGlyphs, 58, 219 + index*62, 0, 692);
  }
  const areaRows = lines(area || "Miestai, miesteliai ir kaimai", small, 626);
  drawText(pixels, areaRows[0], small, 62, 374, 16, 692);
  if (place) {
    const text = `${coord.format(place.latitude)}° š. pl.  ·  ${coord.format(place.longitude)}° r. ilg.`;
    drawText(pixels, text, small, 62, 424, 8, 692);
    plotPlace(pixels, place);
  }
  const compressed = new Blob([pixels]).stream().pipeThrough(new CompressionStream("deflate"));
  const data = new Uint8Array(await new Response(compressed).arrayBuffer());
  const header = new Uint8Array(13);
  const dimensions = new DataView(header.buffer);
  dimensions.setUint32(0, WIDTH);
  dimensions.setUint32(4, HEIGHT);
  header.set([8, 3, 0, 0, 0], 8);
  return new Blob([
    Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    pngChunk("IHDR", header),
    pngChunk("PLTE", palette),
    pngChunk("IDAT", data),
    pngChunk("IEND", new Uint8Array()),
  ], { type: "image/png" });
}
