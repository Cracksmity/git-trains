// Mini trains for the calendar: every model (catalog, custom or steam) shrunk to
// one contribution cell high, derived from its own palette and its nose or
// locomotive drawing, so a custom train gets its mini version for free.
//
// A mini unit faces right. Its grid is MINI_UP rows taller than a cell (room
// for a locomotive's chimney) and its front is the right edge.

import { Grid } from './pixel.js';
import { partColor, rowColor, symbolColor } from './train.js';

export const MINI_H = 10; // a contribution cell
export const MINI_UP = 2; // rows above the cell, for chimneys and domes
export const CAR_W = 12;
const LIT = '#ffd86b';

// A car seen from the side, one cell high. R roof light, r roof, 3 roof edge,
// u upper body, g window, A stripe band, L lower band, k skirt, w wheels.
const CAR = [
  '.RRRRRRRRRR.',
  'rrrrrrrrrrrr',
  '333333333333',
  'uugguggugguu',
  'uugguggugguu',
  'uuuuuuuuuuuu',
  'AAAAAAAAAAAA',
  'LLLLLLLLLLLL',
  '.kkkkkkkkkk.',
  '.ww......ww.',
];
const PANES = [2, 5, 8]; // x of each window, back to front

// Body row (0 roof .. 19 skirt) that each mini row stands for, and the range it
// summarizes when a nose or locomotive drawing is shrunk.
const BODY_ROW = [0, 2, 3, 5, 7, 10, 13, 16, 18];
const ranges = (map, last) => map.map((y, i) => [y, (map[i + 1] ?? last + 1) - 1]);
const BODY_RANGES = ranges(BODY_ROW, 19);

function carColors(model, stripe) {
  const p = model.pal;
  const bands = model.bands ?? ['b', 'b', 'a', 'a', 'b', 'l', 'l'];
  const a = bands.indexOf('a');
  return {
    R: p.roofHi,
    r: p.roof,
    3: rowColor(model, 3, stripe),
    u: p.upper,
    w4: model.winBand ?? p.upper, // the window rows sit on the window band, if any
    g: p.glass,
    A: symbolColor(model, bands[a === -1 ? 2 : a], stripe),
    L: symbolColor(model, bands[5], stripe),
    k: p.skirt,
    w: p.wheel,
  };
}

// lit: how many windows are lit, from the front.
function paintCar(g, ox, oy, colors, lit) {
  const litX = new Set(PANES.slice(PANES.length - lit));
  CAR.forEach((row, y) => {
    [...row].forEach((s, x) => {
      if (s === '.') return;
      let c = colors[s];
      if (s === 'u' && (y === 3 || y === 4)) c = colors.w4;
      if (s === 'g') c = litX.has(x) || litX.has(x - 1) ? LIT : colors.g;
      g.set(ox + x, oy + y, c);
    });
  });
}

// Shrinks rows of nose/locomotive symbols into a block of `w` columns: each
// mini pixel takes the most common symbol of its block, a headlight wins, and a
// mostly empty block stays empty.
function shrink(rows, w, rowRanges) {
  const src = rows[0].length;
  return rowRanges.map(([y0, y1]) => {
    let line = '';
    for (let c = 0; c < w; c++) {
      const x0 = Math.floor((c * src) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((c + 1) * src) / w));
      const count = new Map();
      let filled = 0;
      let total = 0;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x < x1; x++) {
          total++;
          const s = rows[y]?.[x] ?? '.';
          if (s === '.') continue;
          filled++;
          count.set(s, (count.get(s) ?? 0) + 1);
        }
      }
      if (filled * 2 < total) line += '.';
      else if (count.has('l')) line += 'l';
      else if (count.has('y')) line += 'y';
      else line += [...count].sort((a, b) => b[1] - a[1])[0][0];
    }
    return line;
  });
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Lead unit: a car with the model's nose on its front.
function miniCab(model, stripe, lit) {
  const nw = clamp(Math.round(model.nose.w / 3), 2, 9);
  const nose = shrink(model.nose.rows, nw, BODY_RANGES);
  const w = CAR_W + nw;
  const g = new Grid(w, MINI_UP + MINI_H);
  paintCar(g, 0, MINI_UP, carColors(model, stripe), lit);
  nose.forEach((line, r) => {
    [...line].forEach((s, c) => {
      const x = CAR_W + c;
      if (s !== '.') g.set(x, MINI_UP + r, partColor(model, model.nose, s, BODY_ROW[r], stripe));
      else if (c === 0) g.set(x, MINI_UP + r, rowColor(model, BODY_ROW[r], stripe)); // the joint stays closed
    });
  });
  // Wheels under the nose end, like the bogie under the cab.
  g.set(w - Math.ceil(nw / 2) - 2, MINI_UP + 9, model.pal.wheel);
  g.set(w - Math.ceil(nw / 2) - 1, MINI_UP + 9, model.pal.wheel);
  return { grid: g, w };
}

// Lead unit of a steam train: the locomotive drawing, shrunk. Its 30 rows are
// 5 above the cars' roof, 20 of body and 5 of wheels.
const LOCO_RANGES = [[0, 2], [3, 4], ...BODY_RANGES.map(([a, b]) => [a + 5, b + 5]), [25, 29]];

function miniLoco(model, stripe) {
  const { loco } = model;
  const w = clamp(Math.round(loco.w / 3), 6, 20);
  const rows = shrink(loco.rows, w, LOCO_RANGES);
  const g = new Grid(w, MINI_UP + MINI_H);
  rows.forEach((line, r) => {
    const bodyY = r < 2 ? 0 : r - 2 < BODY_ROW.length ? BODY_ROW[r - 2] : 19;
    [...line].forEach((s, c) => {
      if (s !== '.') g.set(c, r, partColor(model, loco, s, bodyY, stripe));
    });
  });
  // The program draws the wheels on top of the drawing; so does the mini.
  const wheel = loco.wheels?.color ?? model.pal.wheel;
  for (const x of loco.wheels?.drive ?? []) {
    const cx = clamp(Math.round((x * w) / loco.w), 0, w - 2);
    g.rect(cx, MINI_UP + 8, 2, 2, wheel);
  }
  for (const x of loco.wheels?.small ?? []) {
    g.set(clamp(Math.round((x * w) / loco.w), 0, w - 1), MINI_UP + 9, wheel);
  }
  return { grid: g, w };
}

// Returns the units of a mini train: { head: {grid, w}, car: {grid, w} }.
// streak lights the windows like on the big train (30 days lights them all).
export function miniTrain(model, { stripe = '#58a6ff', streak = 0 } = {}) {
  const lit = streak > 0 ? clamp(Math.round(PANES.length * Math.min(1, streak / 30)), 1, PANES.length) : 0;
  const car = new Grid(CAR_W, MINI_UP + MINI_H);
  paintCar(car, 0, MINI_UP, carColors(model, stripe), lit);
  return {
    head: model.loco ? miniLoco(model, stripe) : miniCab(model, stripe, lit),
    car: { grid: car, w: CAR_W },
  };
}
