export function filterPixels(d,p,start=0,end=d.length){
    for (let i = start; i < end; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2], grey = 0.2126 * r + 0.7152 * g + 0.0722 * b, sat = p.mono ? 0 : p.saturation;
      r = (grey + (r - grey) * sat) * p.brightness;
      g = (grey + (g - grey) * sat) * p.brightness;
      b = (grey + (b - grey) * sat) * p.brightness;
      let rgb = [r + p.warmth * 22, g + p.warmth * 3, b - p.warmth * 22].map((v) => Math.min(255, Math.max(0, (v - 128) * p.contrast + 128)));
      for (let k = 0; k < 3; k++) d[i + k] = Math.round((rgb[k] * p.opacity + 255 * (1 - p.opacity)) * (1 - p.overlay) + (p.overlayColor === "dark" ? 0 : 255) * p.overlay);
    }
}
