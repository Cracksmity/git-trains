// scene/sky.js: focused sky operations.

import { Grid, rng } from '../graphics/pixel.js';
import { SCENE_W, GY0 } from './layout.js';

const SUN = { x: SCENE_W - 56, y: 20 };

// --- Sky ----------------------------------------------------------------

// 4 solid bands and, between them, 3 dithered rows (25%, 50%, and 75%) made with
// dotted lines. Always in the background; everything else is painted over it.
export function skyLayer(W, used) {
  const bh = GY0 / 4;
  let out = '';
  for (let i = 0; i < 4; i++) {
    used.add(`sky${i}`);
    out += `<rect class="c-sky${i}" y="${i * bh}" width="${W}" height="${bh}"/>`;
  }
  for (let i = 1; i < 4; i++) {
    const b = i * bh;
    /** @type {Array<[number, string, number]>} */
    const rows = [
      [b - 3, '1 3', 0],
      [b - 2, '1 1', 1],
      [b - 1, '3 1', 0],
    ];
    for (const [y, dash, off] of rows) {
      out += `<path class="s-sky${i}" stroke-dasharray="${dash}" stroke-dashoffset="${-off}" d="M0 ${y + 0.5}H${W}"/>`;
    }
  }
  return out;
}

// The same sky on a pixel grid (for scripts/export.js): the dashes above, pixel by pixel.
export function paintSky(g) {
  const bh = GY0 / 4;
  for (let i = 0; i < 4; i++) g.rect(0, i * bh, g.w, bh, `@sky${i}`);
  for (let i = 1; i < 4; i++) {
    for (let x = 0; x < g.w; x++) {
      if (x % 4 === 0) g.set(x, i * bh - 3, `@sky${i}`);
      if (x % 2 === 1) g.set(x, i * bh - 2, `@sky${i}`);
      if (x % 4 !== 3) g.set(x, i * bh - 1, `@sky${i}`);
    }
  }
}

// Sun (with rays) or moon (with craters): the theme determines what is visible.
export function celestialLayer(W, used) {
  return celestialGrid(W).paths(used);
}

// The grids behind the SVG layers are exported too: scripts/export.js paints them as pixels.
export function celestialGrid(W) {
  const g = new Grid(W, 40);
  const { x: sx, y: sy } = SUN;
  for (let a = 0; a < 8; a++) {
    const dx = Math.round(Math.cos((a * Math.PI) / 4) * 100) / 100;
    const dy = Math.round(Math.sin((a * Math.PI) / 4) * 100) / 100;
    for (const r of [9, 10]) g.set(sx + Math.round(dx * r), sy + Math.round(dy * r), '@rays');
  }
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -6; dx <= 6; dx++) if (dx * dx + dy * dy <= 38) g.set(sx + dx, sy + dy, '@sun');
  }
  for (const [dx, dy] of [[-2, -1], [2, 2], [1, -3], [-1, 3], [3, -1]]) g.set(sx + dx, sy + dy, '@moonSpot');
  return g;
}

// Stars in two halves that twinkle alternately (visible only in the dark theme).
export function starsLayers(W, used) {
  const { a, b } = starsGrids(W);
  return { a: a.paths(used), b: b.paths(used) };
}

export function starsGrids(W) {
  const rand = rng(4242);
  const a = new Grid(W, 52);
  const b = new Grid(W, 52);
  for (let i = 0; i < 52; i++) {
    const x = Math.floor(rand() * W);
    const y = 2 + Math.floor(rand() * 48);
    if (Math.abs(x - SUN.x) < 12 && Math.abs(y - SUN.y) < 12) continue;
    (i % 2 ? a : b).set(x, y, '@star');
  }
  return { a, b };
}

export function cloud(g, x, y, w, seed) {
  const rand = rng(seed);
  const baseY = y + 6; // flat bottom row
  const n = Math.max(3, Math.round(w / 6));
  for (let i = 0; i < n; i++) {
    const cx = x + 3 + Math.round((i * (w - 6)) / (n - 1));
    const r = 2 + Math.floor(rand() * 3) + (i > 0 && i < n - 1 ? 1 : 0);
    const cy = baseY - r + 1;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r + 1 && cy + dy <= baseY) g.set(cx + dx, cy + dy, '@cloud');
      }
    }
  }
  g.rect(x + 1, baseY - 1, w - 2, 2, '@cloud');
}

// Two consecutive cloud periods: shifting the layer W pixels makes a continuous loop.
export function cloudsLayer(W, used) {
  return cloudsGrid(W).paths(used);
}

export function cloudsGrid(W) {
  const g = new Grid(W * 2, 52);
  const clouds = [[20, 6, 30], [112, 22, 22], [196, 8, 34], [276, 28, 24], [352, 12, 28], [418, 32, 20]];
  clouds.forEach(([x, y, w], i) => {
    for (const o of [0, W]) cloud(g, x + o, y, w, 900 + i);
  });
  return g;
}
