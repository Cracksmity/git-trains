// A quick look at a train or a skyline in the terminal: the real pixel grids,
// shrunk to fit the window and drawn with half-block characters (each character
// shows two pixels, one above the other, using a foreground and a background color).
// Truecolor ANSI, so it is meant for a terminal; callers skip it when output is piped.

import { buildTrain } from '../trains/render.js';
import { paintBackdrop } from '../scene/backdrop.js';
import { THEMES } from '../scene/themes.js';

const SKY = ['#bfe0f5', '#d3ebf9', '#e5f4fc', '#f4fafe']; // the light theme's sky, top to bottom

// Skylines have no colors of their own (the scene's theme paints them). Here they get
// a daytime palette with more contrast than the scene has, so the silhouettes read.
const SKYLINE_COLORS = { city2: '#7d96b4', city: '#33415c', cityWin: '#ffd36a', hill: '#74b07c', tree: '#3f8556', tree2: '#2f6e45' };

function rgba(c) {
  if (c[0] === '@') c = SKYLINE_COLORS[c.slice(1)] ?? THEMES.light[c.slice(1)] ?? '#000000';
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (m) {
    const h = m[1].length === 3 ? [...m[1]].map((x) => x + x).join('') : m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  m = /^rgba?\(([^)]+)\)$/.exec(c);
  if (m) {
    const [r, g, b, a = 1] = m[1].split(',').map(Number);
    return [r, g, b, a];
  }
  return [0, 0, 0, 1];
}

/** @param {number[]} under @param {number[]} rgba */
const mixRgb = (under, rgba) => {
  const [r, g, b, a] = rgba;
  return [under[0] * (1 - a) + r * a, under[1] * (1 - a) + g * a, under[2] * (1 - a) + b * a];
};

// Pixels of `grids` painted in order over nothing: an array of [r, g, b] or null.
function raster(grids, w, h) {
  const px = new Array(w * h).fill(null);
  for (const grid of grids) {
    for (let i = 0; i < grid.cells.length; i++) {
      const c = grid.cells[i];
      if (!c) continue;
      const col = rgba(c);
      if (col[3] <= 0.05) continue;
      px[i] = mixRgb(px[i] ?? skyAt((Math.floor(i / w) / h) * 1), col);
    }
  }
  return { w, h, px };
}

const skyAt = (t) => rgba(SKY[Math.min(SKY.length - 1, Math.floor(t * SKY.length))]).slice(0, 3);

// Smallest box around the painted pixels, plus a margin.
function crop(r, margin = 1) {
  let x0 = r.w, y0 = r.h, x1 = -1, y1 = -1;
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      if (!r.px[y * r.w + x]) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return r;
  x0 = Math.max(0, x0 - margin); y0 = Math.max(0, y0 - margin);
  x1 = Math.min(r.w - 1, x1 + margin); y1 = Math.min(r.h - 1, y1 + margin);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const px = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.push(r.px[(y0 + y) * r.w + x0 + x]);
  return { w, h, px };
}

// Shrinks by an integer factor. A block counts as painted when a quarter of it is,
// and takes the average of its painted pixels, so thin spires and outlines survive.
function shrink(r, k) {
  if (k <= 1) return r;
  const w = Math.ceil(r.w / k), h = Math.ceil(r.h / k);
  const px = [];
  for (let by = 0; by < h; by++) {
    for (let bx = 0; bx < w; bx++) {
      let n = 0, sr = 0, sg = 0, sb = 0;
      for (let y = by * k; y < Math.min(r.h, (by + 1) * k); y++) {
        for (let x = bx * k; x < Math.min(r.w, (bx + 1) * k); x++) {
          const p = r.px[y * r.w + x];
          if (p) { n++; sr += p[0]; sg += p[1]; sb += p[2]; }
        }
      }
      px.push(n >= k * k * 0.25 ? [sr / n, sg / n, sb / n] : null);
    }
  }
  return { w, h, px };
}

// Lines of text: two pixel rows per line, the sky showing through empty pixels.
function halfBlocks(r) {
  const color = (p, y) => (p ?? skyAt(y / r.h)).map(Math.round);
  const lines = [];
  for (let y = 0; y < r.h; y += 2) {
    let line = '';
    let last = '';
    for (let x = 0; x < r.w; x++) {
      const [tr, tg, tb] = color(r.px[y * r.w + x], y);
      const [br, bg, bb] = y + 1 < r.h ? color(r.px[(y + 1) * r.w + x], y + 1) : color(null, y + 1);
      const sgr = `\x1b[38;2;${tr};${tg};${tb};48;2;${br};${bg};${bb}m`;
      if (sgr !== last) line += sgr;
      last = sgr;
      line += '▀';
    }
    lines.push(`${line}\x1b[0m`);
  }
  return lines;
}

function fit(r, columns) {
  return shrink(r, Math.max(1, Math.ceil(r.w / Math.max(20, columns))));
}

// model: what parseCustomModel returns. Two cars: the lead (nose) and the tail.
export function previewTrain(model, { columns = 100 } = {}) {
  const t = buildTrain(model, { cars: 2, stripe: '#58a6ff', streak: 0 });
  const L = t.layers;
  const r = crop(raster([L.body, L.lit, L.led, L.wa], t.width, L.body.h), 2);
  return halfBlocks(fit(r, columns)).join('\n');
}

// sky: what parseSkyline returns.
export function previewSkyline(sky, { columns = 100 } = {}) {
  const W = 448, H = 90;
  const g = paintBackdrop(W, H, [], '', sky);
  return halfBlocks(fit(raster([g], W, H), columns)).join('\n');
}
