// export/palette.js: focused palette operations.



// --- Palette ------------------------------------------------------------------

// At most `max` colors for a set of RGB canvases: the most used ones, and the
// rest mapped to the nearest (a scene rarely needs it: it has few colors).
export function palettize(canvases, max = 255) {
  const count = new Map();
  for (const c of canvases) {
    for (let i = 0; i < c.px.length; i += 3) {
      const key = (c.px[i] << 16) | (c.px[i + 1] << 8) | c.px[i + 2];
      count.set(key, (count.get(key) ?? 0) + 1);
    }
  }
  const keys = [...count.keys()].sort((a, b) => count.get(b) - count.get(a));
  const kept = keys.slice(0, max);
  const index = new Map(kept.map((k, i) => [k, i]));
  const rgb = (k) => [k >> 16, (k >> 8) & 255, k & 255];
  for (const k of keys.slice(max)) {
    const [r, g, b] = rgb(k);
    let best = 0;
    let bestD = Infinity;
    kept.forEach((q, i) => {
      const [r2, g2, b2] = rgb(q);
      const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
      if (d < bestD) [best, bestD] = [i, d];
    });
    index.set(k, best);
  }
  const indices = canvases.map((c) => {
    const out = new Uint8Array(c.w * c.h);
    for (let i = 0; i < out.length; i++) {
      out[i] = index.get((c.px[i * 3] << 16) | (c.px[i * 3 + 1] << 8) | c.px[i * 3 + 2]);
    }
    return out;
  });
  return { palette: kept.map(rgb), indices };
}

// Nearest-neighbor enlargement of a w x h block of bytes (pixel-exact).
export function upscale(src, w, h, s) {
  if (s === 1) return src;
  const out = new Uint8Array(w * s * h * s);
  for (let y = 0; y < h * s; y++) {
    const row = ((y / s) | 0) * w;
    for (let x = 0; x < w * s; x++) out[y * w * s + x] = src[row + ((x / s) | 0)];
  }
  return out;
}
