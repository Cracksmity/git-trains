// train/format.js: focused format operations.

import { clone } from '../dom.js';
import { MODELS } from '../../trains/models.js';
import { LOCO_ROWS } from '../../trains/geometry.js';

// JSON as in the examples: one drawing row per line, short number lists on one line.
export function formatTrain(draft) {
  return JSON.stringify(draft, null, 2).replace(/\[\s+((?:-?\d+,?\s*)+)\]/g, (_, nums) => `[${nums.trim().split(/,\s*/).join(', ')}]`);
}

export function blankMetro() {
  const m = clone(MODELS['metro-white']);
  return { id: 'my-train', name: 'My train', description: '', pal: { body: m.pal.body, upper: m.pal.upper, roof: m.pal.roof }, bands: m.bands.join(''), row3: m.row3, win: m.win, doors: m.doors, nose: { rows: m.nose.rows, color: m.nose.color, face: m.nose.face }, pant: m.pant, roofBoxes: true };
}

// The steam example's locomotive, as a starting point for drawing one.
export async function stockLoco() {
  try {
    return (await (await fetch('../examples/trains/steam.json')).json()).loco;
  } catch {
    return { rows: Array.from({ length: LOCO_ROWS }, (_, y) => (y >= 5 && y <= 24 ? 'n'.repeat(24) : '')), wheels: { drive: [6, 17], d: 9 } };
  }
}

export function normalize(c) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c ?? '').trim());
  if (!m) return '#888888';
  return `#${m[1].length === 3 ? [...m[1]].map((x) => x + x).join('') : m[1]}`.toLowerCase();
}
