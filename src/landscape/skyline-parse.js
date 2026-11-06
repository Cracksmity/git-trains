// landscape/skyline-parse.js: focused skyline-parse operations.

import { NEW_YORK } from './catalog/new-york.js';
import { OSAKA } from './catalog/osaka.js';
import { parseRegion } from './region-parse.js';
import { CustomError, NOTE_KEYS, isInt, isObj, unknownKeys } from '../validation/primitives.js';

const MAX_H = 84;

// the city ends at row 88; leave 4 rows of sky
const MAX_BUILDINGS = 120;

const TOPS = ['flat', 'stepped', 'spire', 'antenna', 'dome', 'pyramid'];

const ART = '#w.';

// Included backgrounds. Coordinates on the 448 px scene; the ground is row 88.
// The station sign goes at the top left (up to x?90, y?23) and the sun or moon
// at the top right (x?392, y?20): avoid covering the sign with towers.
export const SKYLINES = {
  'new-york': NEW_YORK,
  'osaka': OSAKA,
};

function parseTop(t, where, errors) {
  if (typeof t === 'string') t = { type: t };
  if (!isObj(t) || !TOPS.includes(t.type)) {
    errors.push(`${where}: unknown top ${JSON.stringify(t?.type ?? t)} (valid: ${TOPS.join(', ')})`);
    return null;
  }
  unknownKeys(t, ['type', 'h', 'steps', 'tip'], where, errors);
  const out = { type: t.type };
  if (t.h !== undefined) {
    if (!isInt(t.h) || t.h < 1 || t.h > 40) errors.push(`${where}.h: an integer from 1 to 40`);
    else out.h = t.h;
  }
  if (t.steps !== undefined) {
    if (t.type !== 'stepped' || !isInt(t.steps) || t.steps < 1 || t.steps > 4) errors.push(`${where}.steps: only on "stepped", from 1 to 4`);
    else out.steps = t.steps;
  }
  if (t.tip !== undefined) {
    if (t.type !== 'pyramid' || !isInt(t.tip) || t.tip < 1 || t.tip > 20) errors.push(`${where}.tip: only on "pyramid", tip width from 1 to 20`);
    else out.tip = t.tip;
  }
  return out;
}

function parseBuilding(b, i, errors) {
  const where = `buildings[${i}]`;
  if (!isObj(b)) {
    errors.push(`${where}: must be an object { "x": ..., "w": ..., "h": ... }`);
    return null;
  }
  unknownKeys(b, ['x', 'w', 'h', 'layer', 'top', 'windows', 'rows', 'name'], where, errors);
  const before = errors.length;
  const out = { x: b.x, layer: b.layer ?? 'near' };
  if (!isInt(b.x) || b.x < -40 || b.x > 447) errors.push(`${where}.x: an integer from -40 to 447 (left column)`);
  if (out.layer !== 'near' && out.layer !== 'far') errors.push(`${where}.layer: "near" (in front, with windows) or "far" (behind, lighter)`);
  out.windows = b.windows ?? out.layer === 'near';
  if (typeof out.windows !== 'boolean') errors.push(`${where}.windows: true or false`);

  if (b.rows !== undefined) {
    // Free drawing: "#" building, "w" window, "." empty. The last row touches the ground.
    if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > MAX_H || !b.rows.every((r) => typeof r === 'string')) {
      errors.push(`${where}.rows: 1 to ${MAX_H} strings; the last row touches the ground`);
    } else {
      const longest = Math.max(...b.rows.map((r) => r.length));
      if (longest > 200) {
        errors.push(`${where}.rows: at most 200 columns (the longest has ${longest})`);
        return null;
      }
      b.rows.forEach((r, y) => {
        const bad = [...r].filter((c) => !ART.includes(c));
        if (bad.length) errors.push(`${where}.rows[${y}]: unknown symbols "${[...new Set(bad)].join('')}" (valid: # w .)`);
      });
      out.rows = b.rows.map((r) => r.padEnd(longest, '.'));
    }
    if (b.w !== undefined || b.h !== undefined || b.top !== undefined) {
      errors.push(`${where}: with "rows", leave out "w", "h" and "top"`);
    }
  } else {
    if (!isInt(b.w) || b.w < 2 || b.w > 200) errors.push(`${where}.w: an integer from 2 to 200 (width)`);
    if (!isInt(b.h) || b.h < 2 || b.h > MAX_H) errors.push(`${where}.h: an integer from 2 to ${MAX_H} (body height, without the top)`);
    out.w = b.w;
    out.h = b.h;
    const tops = b.top === undefined ? [] : Array.isArray(b.top) ? b.top : [b.top];
    if (tops.length > 4) {
      errors.push(`${where}.top: at most 4 stacked tops`);
      return null;
    }
    out.top = tops.map((t, k) => parseTop(t, `${where}.top${Array.isArray(b.top) ? `[${k}]` : ''}`, errors)).filter(Boolean);
  }
  return errors.length > before ? null : out;
}

// Earlier preset ids that are still accepted (the original Spanish ones).
export const SKYLINE_ALIASES = { ciudad: 'city', 'nueva-york': 'new-york' };

// Accepts a preset id ("new-york") or an object { name, fill, buildings }.
// Returns null for the procedural city ("city" or empty).
export function parseSkyline(raw) {
  if (typeof raw === 'string') raw = SKYLINE_ALIASES[raw] ?? raw;
  if (raw === undefined || raw === null || raw === '' || raw === 'city') return null;
  if (typeof raw === 'string') {
    const preset = SKYLINES[raw];
    if (!preset) throw new CustomError('The skyline', [`"${raw}" does not exist (options: city, ${Object.keys(SKYLINES).join(', ')} or the path to a .json file)`]);
    raw = preset;
  }
  const errors = [];
  if (!isObj(raw)) throw new CustomError('The skyline', ['the file must be a JSON object { ... }']);
  unknownKeys(raw, ['name', 'fill', 'buildings', 'region', ...NOTE_KEYS], 'skyline', errors);
  const fill = raw.fill ?? true;
  if (typeof fill !== 'boolean') errors.push('fill: true (fills the gaps with the procedural city) or false');
  const list = raw.buildings;
  if (!Array.isArray(list) || !list.length || list.length > MAX_BUILDINGS) {
    errors.push(`buildings: a list of 1 to ${MAX_BUILDINGS} buildings`);
    throw new CustomError('The skyline', errors);
  }
  const buildings = Array.isArray(list) ? list.map((b, i) => parseBuilding(b, i, errors)) : [];
  const region = raw.region === undefined ? undefined : parseRegion(raw.region, errors);
  if (errors.length) throw new CustomError('The skyline', errors);
  return {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 40) : 'Custom skyline',
    fill,
    buildings,
    ...(region ? { region } : {}),
  };
}
