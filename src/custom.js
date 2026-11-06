// Custom trains: turns a JSON file (written by hand or by an AI) into a model like
// the ones in models.js. The file comes from outside, so it is only read as data:
// every field is checked and all the problems are reported together, worded so
// they can be pasted back to the AI for it to fix.
//
// The format uses the same keys as models.js, so a custom train can join the
// catalog by copy and paste. See docs/ai/train.md.

import { MODELS, modelId } from './models.js';
import { buildNose } from './noses.js';
import {
  buildTrain, trainWidth, mix, MAX_CARS, LED_W, DOOR_W,
  LOCO_ROWS, LOCO_UP, LOCO_MIN_W, LOCO_MAX_W, LOCO_WHEELS, LOCO_SMALL,
} from './train.js';
import { SCENE_W } from './scenery.js';
import { CustomError, NOTE_KEYS, isInt, isObj, normColor, unknownKeys } from './validate.js';

export { CustomError };

const COMMON = { outline: '#16131a', gangway: '#2d2d35', wheel: '#25252b', skirt: '#3b3b43' };

// Palette: only `body` is required; the rest is derived when missing.
const PAL_DEFAULTS = [
  ['upper', (p) => p.body],
  ['bodyHi', (p) => mix(p.body, '#ffffff', 0.15)],
  ['bodyLo', (p) => mix(p.body, '#000000', 0.15)],
  ['roof', () => '#9aa0aa'],
  ['roofHi', (p) => mix(p.roof, '#ffffff', 0.25)],
  ['roofVent', (p) => mix(p.roof, '#000000', 0.18)],
  ['trim', () => '#f2f4f7'],
  ['dark', () => '#2f3340'],
  ['glass', () => '#262b36'],
  ['glassHi', (p) => mix(p.glass, '#ffffff', 0.2)],
  ['door', (p) => p.body],
  ['doorHi', (p) => mix(p.door, '#ffffff', 0.18)],
  ...Object.entries(COMMON).map(([k, v]) => [k, () => v]),
];
const PAL_KEYS = ['body', ...PAL_DEFAULTS.map(([k]) => k)];

export const BAND_SYMBOLS = 'bhltdua';
export const NOSE_SYMBOLS = 'snfgGokmlyrqiatdh';
const NOSE_OPS = { r: 5, p: 3, f: 5, e: 5, ep: 3 };

const KEYS = [
  'id', 'name', 'pal', 'bands', 'row3', 'win', 'winBand', 'doors', 'nose',
  'pant', 'pantX', 'roofBoxes', 'articulated', 'tyres', 'cabWindows', 'cabBogieOff', 'loco',
];
// Cab keys that do not apply when the train has a locomotive.
const CAB_KEYS = ['nose', 'cabWindows', 'cabBogieOff', 'pantX'];

function parseNose(raw, errors) {
  // "bullet" or { "base": "bullet", "color": ..., "face": ... }: reuses a nose from the catalog.
  if (typeof raw === 'string') raw = { base: raw };
  if (!isObj(raw)) {
    errors.push('nose: must be the id of a catalog nose or an object');
    return null;
  }
  unknownKeys(raw, ['base', 'w', 'edge', 'ops', 'rows', 'color', 'face'], 'nose', errors);

  let nose = null;
  let bogieOff;
  if (raw.base !== undefined) {
    const base = MODELS[modelId(raw.base)];
    if (!base) {
      errors.push(`nose.base: "${raw.base}" does not exist (options: ${Object.keys(MODELS).join(', ')})`);
      return null;
    }
    nose = { w: base.nose.w, rows: [...base.nose.rows], color: base.nose.color, face: base.nose.face };
    bogieOff = base.cabBogieOff;
  } else if (raw.rows !== undefined) {
    nose = noseFromRows(raw, errors);
  } else if (raw.edge !== undefined || raw.ops !== undefined) {
    nose = noseFromOps(raw, errors);
  } else {
    errors.push('nose: needs "base", "rows" or "edge" + "ops"');
    return null;
  }
  if (!nose) return null;

  for (const k of ['color', 'face']) {
    if (raw[k] === undefined) continue;
    const c = normColor(raw[k]);
    if (c) nose[k] = c;
    else errors.push(`nose.${k}: "${raw[k]}" is not a hex color (#rrggbb)`);
  }
  if (!nose.rows.some((r) => /[ly]/.test(r))) {
    errors.push('nose: needs at least one headlight ("l" or "y"); at the tail those same pixels turn red');
  }
  return { nose, bogieOff };
}

// A nose drawn directly: 20 rows of symbols, from left (where it joins the car)
// to right (the tip). Short rows are padded with "." on the right.
function noseFromRows(raw, errors) {
  const { rows } = raw;
  if (!Array.isArray(rows) || rows.length !== 20 || !rows.every((r) => typeof r === 'string')) {
    errors.push(`nose.rows: must be 20 strings (one per row, from the roof to the skirt); got ${Array.isArray(rows) ? rows.length : typeof rows}`);
    return null;
  }
  const longest = Math.max(...rows.map((r) => r.length));
  const w = raw.w ?? longest;
  if (!isInt(w) || w < 4 || w > 40 || w < longest) {
    errors.push(`nose.w: must be an integer from 4 to 40 matching the longest row (${longest} columns; got ${raw.w ?? longest})`);
    return null;
  }
  const out = [];
  rows.forEach((r, y) => {
    const bad = [...r].filter((c) => c !== '.' && !NOSE_SYMBOLS.includes(c));
    if (bad.length) errors.push(`nose.rows[${y}]: unknown symbols "${[...new Set(bad)].join('')}" (valid: ${NOSE_SYMBOLS} and ".")`);
    if (r[0] === undefined || r[0] === '.') errors.push(`nose.rows[${y}]: the first column cannot be empty (that is where it joins the car)`);
    out.push(r.padEnd(w, '.'));
  });
  return { w, rows: out };
}

function noseFromOps(raw, errors) {
  const { w, edge, ops = [] } = raw;
  const before = errors.length;
  if (!isInt(w) || w < 4 || w > 40) errors.push(`nose.w: must be an integer from 4 to 40 (got ${w})`);
  if (!Array.isArray(edge) || edge.length !== 20) {
    errors.push(`nose.edge: must be 20 numbers, one per row (got ${Array.isArray(edge) ? edge.length : typeof edge})`);
  } else {
    edge.forEach((e, y) => {
      if (!isInt(e) || e < 0 || e >= w) errors.push(`nose.edge[${y}]: ${e} must be an integer from 0 to ${w - 1}`);
    });
  }
  if (!Array.isArray(ops) || ops.length > 200) errors.push('nose.ops: must be a list of at most 200 operations');
  else {
    ops.forEach((op, i) => {
      if (!Array.isArray(op) || !(op[0] in NOSE_OPS)) {
        errors.push(`nose.ops[${i}]: unknown operation ${JSON.stringify(op?.[0] ?? op)} (valid: ${Object.keys(NOSE_OPS).join(', ')})`);
        return;
      }
      const n = NOSE_OPS[op[0]];
      if (op.length !== n + 1) {
        errors.push(`nose.ops[${i}]: "${op[0]}" takes ${n} values after its name and got ${op.length - 1}`);
        return;
      }
      const nums = op.slice(1, -1);
      const sym = op[op.length - 1];
      if (!nums.every((v) => Number.isSafeInteger(v) && v >= -80 && v <= 80)) errors.push(`nose.ops[${i}]: coordinates must be integers from -80 to 80`);
      if (typeof sym !== 'string' || sym.length !== 1 || !NOSE_SYMBOLS.includes(sym)) {
        errors.push(`nose.ops[${i}]: unknown symbol "${sym}" (valid: ${NOSE_SYMBOLS})`);
      }
      if ((op[0] === 'e' || op[0] === 'ep') && isInt(op[1]) && (op[1] < 0 || op[1] > 19)) {
        errors.push(`nose.ops[${i}]: row ${op[1]} is outside 0..19`);
      }
    });
  }
  if (errors.length > before) return null;
  return buildNose(w, edge, ops);
}

// Locomotive: a 30-row drawing (5 above the cars' roof, 20 at body height and 5
// of wheels; the last one touches the rail) facing right, plus its wheels. The
// program draws the wheels on top of the drawing.
function parseLoco(raw, errors) {
  if (!isObj(raw)) {
    errors.push('loco: must be an object { "rows": [...], "wheels": { "drive": [...] } }');
    return null;
  }
  unknownKeys(raw, ['rows', 'color', 'face', 'wheels', 'smoke'], 'loco', errors);
  const before = errors.length;

  const { rows } = raw;
  if (!Array.isArray(rows) || rows.length !== LOCO_ROWS || !rows.every((r) => typeof r === 'string')) {
    errors.push(
      `loco.rows: must be ${LOCO_ROWS} strings (${LOCO_UP} above the cars' roof, 20 for the body and 5 for the wheels); ` +
      `got ${Array.isArray(rows) ? rows.length : typeof rows}`,
    );
    return null;
  }
  const w = Math.max(...rows.map((r) => r.length));
  if (w < LOCO_MIN_W || w > LOCO_MAX_W) {
    errors.push(`loco.rows: the longest row is ${w} columns; the locomotive must be ${LOCO_MIN_W} to ${LOCO_MAX_W} wide`);
    return null;
  }
  rows.forEach((r, y) => {
    const bad = [...r].filter((c) => c !== '.' && !NOSE_SYMBOLS.includes(c));
    if (bad.length) errors.push(`loco.rows[${y}]: unknown symbols "${[...new Set(bad)].join('')}" (valid: ${NOSE_SYMBOLS} and ".")`);
  });
  const loco = { w, rows: rows.map((r) => r.padEnd(w, '.')) };
  if (!loco.rows.some((r) => /[^.]/.test(r))) errors.push('loco.rows: the drawing is empty');

  for (const k of ['color', 'face']) {
    if (raw[k] === undefined) continue;
    const c = normColor(raw[k]);
    if (c) loco[k] = c;
    else errors.push(`loco.${k}: "${raw[k]}" is not a hex color (#rrggbb)`);
  }
  if (loco.color) {
    loco.hi = mix(loco.color, '#ffffff', 0.18);
    loco.lo = mix(loco.color, '#000000', 0.2);
  }

  // Wheels.
  const wh = raw.wheels;
  if (!isObj(wh)) {
    errors.push('loco.wheels: missing; for example { "drive": [10, 20, 30], "d": 9 } (centers of the driving wheels)');
  } else {
    unknownKeys(wh, ['drive', 'd', 'small', 'rod', 'color'], 'loco.wheels', errors);
    const wheels = { d: wh.d ?? 9, small: wh.small ?? [], rod: wh.rod ?? true, drive: wh.drive };
    if (!LOCO_WHEELS.includes(wheels.d)) errors.push(`loco.wheels.d: driving wheel diameter ${LOCO_WHEELS.join(', ')} (got ${wh.d})`);
    if (typeof wheels.rod !== 'boolean') errors.push('loco.wheels.rod: must be true (coupling rod between the driving wheels) or false');
    const list = (v, key, lo, hi) => {
      if (!Array.isArray(v) || v.length < lo || v.length > hi || !v.every(isInt)) {
        errors.push(`loco.wheels.${key}: a list of ${lo} to ${hi} integer columns (the center of each wheel)`);
        return false;
      }
      return true;
    };
    const okDrive = list(wheels.drive, 'drive', 1, 6);
    const okSmall = list(wheels.small, 'small', 0, 4);
    if (wh.color !== undefined) {
      const c = normColor(wh.color);
      if (c) wheels.color = c;
      else errors.push(`loco.wheels.color: "${wh.color}" is not a hex color (#rrggbb)`);
    }
    if (okDrive && okSmall && LOCO_WHEELS.includes(wheels.d) && w >= LOCO_MIN_W) {
      const all = [
        ...wheels.drive.map((x) => ({ x, r: (wheels.d - 1) / 2, key: 'drive' })),
        ...wheels.small.map((x) => ({ x, r: (LOCO_SMALL - 1) / 2, key: 'small' })),
      ];
      for (const { x, r, key } of all) {
        if (x < r || x > w - 1 - r) errors.push(`loco.wheels.${key}: the wheel at column ${x} sticks out of the locomotive (it must be from ${r} to ${w - 1 - r})`);
      }
      all.sort((a, b) => a.x - b.x);
      for (let i = 1; i < all.length; i++) {
        const [a, b] = [all[i - 1], all[i]];
        if (b.x - a.x < a.r + b.r + 1) {
          errors.push(`loco.wheels: the wheels at columns ${a.x} and ${b.x} overlap; keep them at least ${a.r + b.r + 1} columns apart`);
        }
      }
    }
    loco.wheels = wheels;
  }

  // Chimney: the column the smoke comes out of.
  if (raw.smoke !== undefined) {
    if (!isInt(raw.smoke) || raw.smoke < 0 || raw.smoke >= w) errors.push(`loco.smoke: the chimney column, an integer from 0 to ${w - 1}`);
    else if (!loco.rows.some((r) => r[raw.smoke] !== '.')) errors.push(`loco.smoke: column ${raw.smoke} is empty; put the chimney there`);
    else loco.smoke = raw.smoke;
  }
  return errors.length > before ? null : loco;
}

// Returns a model ready for buildTrain, or throws CustomError with every problem.
export function parseCustomModel(raw) {
  const errors = [];
  if (!isObj(raw)) throw new CustomError('The train', ['the file must be a JSON object { ... }']);
  unknownKeys(raw, [...KEYS, ...NOTE_KEYS], 'train', errors);

  const m = {};
  m.id = 'custom';
  if (raw.id !== undefined) {
    if (typeof raw.id === 'string' && /^[a-z0-9][a-z0-9-]{0,31}$/.test(raw.id)) m.id = raw.id;
    else errors.push('id: use lowercase letters, digits and hyphens (32 at most), for example "nyc-subway"');
  }
  m.name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 40) : 'Custom train';

  // Palette.
  const pal = {};
  if (!isObj(raw.pal)) errors.push('pal: the palette is missing; at least { "body": "#rrggbb" }');
  else {
    unknownKeys(raw.pal, PAL_KEYS, 'pal', errors);
    for (const k of PAL_KEYS) {
      if (raw.pal[k] === undefined) continue;
      const c = normColor(raw.pal[k]);
      if (c) pal[k] = c;
      else errors.push(`pal.${k}: "${raw.pal[k]}" is not a hex color (#rrggbb)`);
    }
    if (!raw.pal.body) errors.push('pal.body: required (the main color of the body)');
  }
  if (pal.body) for (const [k, f] of PAL_DEFAULTS) pal[k] ??= f(pal);
  m.pal = pal;

  // Stripes on rows 11..17 and the roof edge.
  const bands = raw.bands ?? 'bbaabll';
  const bandList = typeof bands === 'string' ? [...bands] : bands;
  if (!Array.isArray(bandList) || bandList.length !== 7 || !bandList.every((s) => typeof s === 'string' && s.length === 1 && BAND_SYMBOLS.includes(s))) {
    errors.push(`bands: must be 7 symbols from "${BAND_SYMBOLS}" (rows 11 to 17), for example "bbaabll"`);
  } else m.bands = bandList;
  m.row3 = raw.row3 ?? 'u';
  if (typeof m.row3 !== 'string' || m.row3.length !== 1 || !BAND_SYMBOLS.includes(m.row3)) {
    errors.push(`row3: must be one symbol from "${BAND_SYMBOLS}"`);
  }

  // Windows.
  const win = raw.win ?? { y0: 4, y1: 10 };
  if (!isObj(win) || !isInt(win.y0) || !isInt(win.y1) || win.y0 < 3 || win.y0 > 6 || win.y1 < 8 || win.y1 > 12 || win.y1 - win.y0 < 3) {
    errors.push('win: must be { "y0": 3..6, "y1": 8..12 } (top and bottom rows of the frame)');
  } else m.win = { y0: win.y0, y1: win.y1 };
  if (raw.winBand !== undefined && raw.winBand !== null) {
    const c = normColor(raw.winBand);
    if (c) m.winBand = c;
    else errors.push(`winBand: "${raw.winBand}" is not a hex color (or leave it out)`);
  }
  m.doors = raw.doors ?? 2;
  if (m.doors !== 2 && m.doors !== 3) errors.push('doors: 2 or 3 doors per side');

  for (const k of ['roofBoxes', 'articulated', 'tyres']) {
    const v = raw[k] ?? k === 'roofBoxes';
    if (typeof v !== 'boolean') errors.push(`${k}: must be true or false`);
    m[k] = !!v;
  }

  if (raw.cabWindows !== undefined && raw.cabWindows !== 0) {
    if (!isInt(raw.cabWindows) || raw.cabWindows < 4 || raw.cabWindows > 30 || raw.cabWindows % 2) {
      errors.push('cabWindows: an even number from 4 to 30 (extra windows in the cab), or 0');
    } else m.cabWindows = raw.cabWindows;
  }

  // Locomotive: replaces the cab (and its nose) at both ends.
  const hasLoco = raw.loco !== undefined && raw.loco !== null;
  if (hasLoco) {
    const loco = parseLoco(raw.loco, errors);
    if (loco) m.loco = loco;
    for (const k of CAB_KEYS) {
      if (raw[k] !== undefined) errors.push(`${k}: with "loco" there is no cab; remove it (the locomotive leads and the tail is flat)`);
    }
    if (m.articulated) errors.push('articulated: with "loco" the cars are not paired; remove it or set it to false');
  }

  // Nose (and, when it comes from the catalog, the distance from the bogie to the tip).
  const parsedNose = hasLoco
    ? null
    : raw.nose === undefined
      ? (errors.push('nose: the nose is missing (or use "loco" for a train pulled by a locomotive)'), null)
      : parseNose(raw.nose, errors);
  if (parsedNose) m.nose = parsedNose.nose;
  const bogieOff = hasLoco ? undefined : raw.cabBogieOff ?? parsedNose?.bogieOff;
  if (bogieOff !== undefined) {
    if (!isInt(bogieOff) || bogieOff < 14 || bogieOff > 30) errors.push('cabBogieOff: an integer from 14 to 30');
    else m.cabBogieOff = bogieOff;
  }

  // Pantograph.
  m.pant = raw.pant ?? null;
  if (m.pant !== null && m.pant !== 'lead' && m.pant !== 'alt') errors.push('pant: "lead" (on the cab), "alt" (every other car) or null (third rail)');
  else if (hasLoco && m.pant !== null) errors.push('pant: with "loco" it must be null (a locomotive has no pantograph)');
  if (m.pant === 'lead' && !hasLoco) {
    m.pantX = raw.pantX ?? 24;
    const doorW = m.doors === 3 ? 9 : DOOR_W;
    const room = 3 + LED_W + 2 + doorW + 2 + (m.cabWindows ? m.cabWindows + 2 : 0) - 9;
    if (!isInt(m.pantX) || m.pantX < 2 || m.pantX > room) errors.push(`pantX: an integer from 2 to ${room} (pantograph position on the cab roof)`);
  }

  if (errors.length) throw new CustomError('The train', errors);

  const width = trainWidth(m, MAX_CARS);
  if (width > SCENE_W) {
    throw new CustomError('The train', [
      m.loco
        ? `with ${MAX_CARS} cars it is ${width} px long and the scene is ${SCENE_W}: make the locomotive (loco) narrower`
        : `with ${MAX_CARS} cars it is ${width} px long and the scene is ${SCENE_W}: make the nose narrower or remove cabWindows`,
    ]);
  }
  // Last safety net: if something slipped through, fail here with a message, not in the Action.
  try {
    for (let cars = 1; cars <= MAX_CARS; cars++) for (const dir of [1, -1]) buildTrain(m, { cars, dir, streak: 12 });
  } catch (err) {
    throw new CustomError('The train', [`could not be drawn: ${err.message}`]);
  }
  m.custom = true;
  return m;
}
