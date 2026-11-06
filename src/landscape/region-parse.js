// landscape/region-parse.js: focused region-parse operations.

import { NOTE_KEYS, isObj, normColor, unknownKeys } from '../validation/primitives.js';

export const TERRAINS = ['hills', 'mountains', 'sea', 'plains'];

export const REGION_KEYS = ['terrain', 'accents', 'houses', 'trees', 'plants', 'landmark'];

export const SYMBOLS = '.#wrtld1234';

// Largest drawing of each kind (columns x rows) and how many of each are accepted.
export const LIMITS = {
  houses: { w: 24, h: 16, count: 4 },
  trees: { w: 20, h: 22, count: 6 },
  plants: { w: 16, h: 12, count: 4 },
  landmark: { w: 32, h: 28 },
};

const MAX_ACCENTS = 4;

const PLACES = ['village', 'far'];

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
