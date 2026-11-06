// Regional countryside: the houses, trees, plants and landmark that a skyline brings
// with it, so Osaka shows farmhouses and cherry trees and Guadalajara shows adobe
// houses and agaves instead of the same houses and pines everywhere.
//
// A region is optional JSON inside a skyline (`"region": { ... }`). Like trains and
// skylines it can come from outside, so everything is validated here and the
// problems are reported together. See docs/ai/region.md.
//
// A drawing is a list of `rows` of symbols, top to bottom, the last row on the ground:
//   . empty   # wall   w window   r roof   t trunk or timber   l leaves   d dark leaves
//   1 2 3 4   the region's own accent colors (accents[0] to accents[3])
// The symbols map to theme colors (see SYMBOL_COLORS), so everything follows light and
// dark. Only the accents are the region's own, with a light and a dark value each.

import { rng } from './pixel.js';
import { NOTE_KEYS, isObj, normColor, unknownKeys } from './validate.js';

export const TERRAINS = ['hills', 'mountains', 'sea', 'plains'];
export const REGION_KEYS = ['terrain', 'accents', 'houses', 'trees', 'plants', 'landmark'];
export const SYMBOLS = '.#wrtld1234';

export const SYMBOL_COLORS = {
  '#': '@house',
  w: '@win',
  r: '@houseRoof',
  t: '@sleeper',
  l: '@tree',
  d: '@tree2',
  1: '@accent1',
  2: '@accent2',
  3: '@accent3',
  4: '@accent4',
};

// Largest drawing of each kind (columns x rows) and how many of each are accepted.
export const LIMITS = {
  houses: { w: 24, h: 16, count: 4 },
  trees: { w: 20, h: 22, count: 6 },
  plants: { w: 16, h: 12, count: 4 },
  landmark: { w: 32, h: 28 },
};
const MAX_ACCENTS = 4;
const PLACES = ['village', 'far'];

// The sea has no accent of its own: it is a theme color that exists only while a region needs it.
const SEA = { light: '#8fc3e0', dark: '#0f2f55' };

// Theme variables that a region adds on top of THEMES (see applyRegionTheme).
export const REGION_THEME_KEYS = ['accent1', 'accent2', 'accent3', 'accent4', 'sea'];

// --- Validation -------------------------------------------------------------------

function parseDrawing(d, kind, where, accents, errors) {
  if (!isObj(d)) {
    errors.push(`${where}: must be an object { "rows": [ ...strings... ] }`);
    return null;
  }
  unknownKeys(d, ['name', 'rows', ...(kind === 'landmark' ? ['place'] : []), ...NOTE_KEYS], where, errors);
  const before = errors.length;
  const max = LIMITS[kind];
  const rows = d.rows;
  if (!Array.isArray(rows) || !rows.length || !rows.every((r) => typeof r === 'string')) {
    errors.push(`${where}.rows: a list of strings, top to bottom; the last row is on the ground`);
    return null;
  }
  const w = Math.max(...rows.map((r) => r.length));
  if (rows.length > max.h || w > max.w) {
    errors.push(`${where}.rows: at most ${max.w} columns and ${max.h} rows for ${kind === 'landmark' ? 'a landmark' : kind} (this one is ${w} x ${rows.length})`);
    return null;
  }
  rows.forEach((r, y) => {
    const bad = [...r].filter((c) => !SYMBOLS.includes(c));
    if (bad.length) errors.push(`${where}.rows[${y}]: unknown symbols "${[...new Set(bad)].join('')}" (valid: ${[...SYMBOLS].join(' ')})`);
  });
  const used = new Set(rows.join(''));
  if (!used.size || [...used].every((c) => c === '.')) errors.push(`${where}.rows: the drawing is empty`);
  else if (/^\.*$/.test(rows[rows.length - 1])) errors.push(`${where}.rows: the last row is the ground and has no pixels; remove the empty rows at the bottom`);
  for (const n of [1, 2, 3, 4]) {
    if (used.has(String(n)) && n > accents) {
      errors.push(`${where}.rows: uses accent ${n}, but ${accents ? `only ${accents} accent${accents > 1 ? 's are' : ' is'}` : 'no accents are'} defined (add it to region.accents)`);
    }
  }
  const out = { rows: rows.map((r) => r.padEnd(w, '.')) };
  if (kind === 'landmark') {
    out.place = d.place ?? 'village';
    if (!PLACES.includes(out.place)) errors.push(`${where}.place: "village" (among the houses) or "far" (on the horizon, behind the nearest hill)`);
  }
  return errors.length > before ? null : out;
}

function parseDrawings(list, kind, where, accents, errors) {
  const { count } = LIMITS[kind];
  if (!Array.isArray(list) || !list.length || list.length > count) {
    errors.push(`${where}: a list of 1 to ${count} drawings [ { "rows": [ ... ] } ]`);
    return [];
  }
  return list.map((d, i) => parseDrawing(d, kind, `${where}[${i}]`, accents, errors)).filter(Boolean);
}

function parseAccents(list, where, errors) {
  if (!Array.isArray(list) || !list.length || list.length > MAX_ACCENTS) {
    errors.push(`${where}: a list of 1 to ${MAX_ACCENTS} colors [ { "light": "#rrggbb", "dark": "#rrggbb" } ]; drawings use them as the symbols 1 to ${MAX_ACCENTS}`);
    return [];
  }
  const out = [];
  list.forEach((a, i) => {
    const at = `${where}[${i}]`;
    if (!isObj(a)) {
      errors.push(`${at}: must be an object { "light": "#rrggbb", "dark": "#rrggbb" }`);
      return;
    }
    unknownKeys(a, ['name', 'light', 'dark', ...NOTE_KEYS], at, errors);
    const light = normColor(a.light);
    const dark = normColor(a.dark);
    if (!light) errors.push(`${at}.light: a hex color like "#b64e36" (the color by day)`);
    if (!dark) errors.push(`${at}.dark: a hex color like "#6b2a1c" (the color at night, usually darker)`);
    if (light && dark) out.push({ light, dark });
  });
  return out;
}

// Validates the "region" object of a skyline. Pushes every problem onto `errors` and
// returns the normalized region, or null when there are problems. The result is itself
// a valid region (only what was given, plus the terrain), so it can be parsed again.
export function parseRegion(raw, errors, where = 'region') {
  if (!isObj(raw)) {
    errors.push(`${where}: must be an object { "terrain": ..., "houses": [...], "trees": [...] }`);
    return null;
  }
  unknownKeys(raw, ['name', ...REGION_KEYS, ...NOTE_KEYS], where, errors);
  const before = errors.length;
  const out = { terrain: raw.terrain ?? 'hills' };
  if (!TERRAINS.includes(out.terrain)) errors.push(`${where}.terrain: one of ${TERRAINS.join(', ')}`);
  if (raw.accents !== undefined) out.accents = parseAccents(raw.accents, `${where}.accents`, errors);
  const n = Array.isArray(raw.accents) ? Math.min(raw.accents.length, MAX_ACCENTS) : 0;
  for (const kind of ['houses', 'trees', 'plants']) {
    if (raw[kind] !== undefined) out[kind] = parseDrawings(raw[kind], kind, `${where}.${kind}`, n, errors);
  }
  if (raw.landmark !== undefined) out.landmark = parseDrawing(raw.landmark, 'landmark', `${where}.landmark`, n, errors);
  return errors.length > before ? null : out;
}

// The parts of a parsed region with their defaults, for the painter.
export function regionParts(region) {
  const { terrain = 'hills', accents = [], houses = [], trees = [], plants = [], landmark = null } = region;
  return { terrain, accents, houses, trees, plants, landmark };
}

// --- Theme ------------------------------------------------------------------------

// The accents (and the sea) are CSS variables like the rest of THEMES, but they exist only
// while a region uses them, so a scene without region keeps exactly today's stylesheet.
// paintBackdrop calls this on every render, before the stylesheet is written.
export function applyRegionTheme(themes, region) {
  for (const mode of ['light', 'dark']) {
    for (const key of REGION_THEME_KEYS) delete themes[mode][key];
    if (!region) continue;
    (region.accents ?? []).forEach((a, i) => {
      themes[mode][`accent${i + 1}`] = a[mode];
    });
    if (region.terrain === 'sea') themes[mode].sea = SEA[mode];
  }
}

// --- Drawing ----------------------------------------------------------------------

// Paint a drawing standing on `bottom` (the row of its last line) and centered on column
// `cx`. `flip` mirrors it. `clip(x, y)` can hide pixels (what stands behind a hill).
export function paintSprite(g, sprite, cx, bottom, { flip = false, clip = null } = {}) {
  const { rows } = sprite;
  const w = rows[0].length;
  const left = cx - (w >> 1);
  rows.forEach((row, r) => {
    const y = bottom - rows.length + 1 + r;
    for (let c = 0; c < w; c++) {
      const ch = row[flip ? w - 1 - c : c];
      if (ch === '.') continue;
      const x = left + c;
      if (!clip || clip(x, y)) g.set(x, y, SYMBOL_COLORS[ch]);
    }
  });
}

export const spriteWidth = (sprite) => sprite.rows[0].length;

// A separate random stream for the choices of the region (which house, which tree,
// mirrored or not). The scene's own stream is left alone, so the ballast, the signals
// and the city stay exactly where they were with or without a region.
export function regionRng(seed) {
  return rng((seed ^ 0x9e3779b9) >>> 0);
}

export const pickOne = (list, rand) => list[Math.floor(rand() * list.length)];

// --- Terrain ----------------------------------------------------------------------

// Triangle wave in [-1, 1] with period 2 pi: pointed peaks, for mountains.
const tri = (t) => (2 / Math.PI) * Math.asin(Math.sin(t));

// Height (in pixels above the strip's ground) of the far ridge of a terrain, or null for
// the default hills of the scenery. `k` is the strip, so each one has its own ridge.
export function ridgeHeight(terrain, x, k) {
  if (terrain === 'mountains') return Math.round(24 + 8 * tri(x / 41 + k * 1.3) + 4 * tri(x / 17 + k * 2.6));
  if (terrain === 'plains') return Math.round(5 + 1.5 * Math.sin(x / 61 + k) + Math.sin(x / 23 + 2 * k));
  if (terrain === 'sea') return 16;
  return null;
}

// Snow on the peaks: the highest pixels of a mountain ridge.
export const SNOW_LINE = 29;
