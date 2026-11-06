// Dev tool: draws a PNG sheet with the drawings of a skyline's region zoomed in, by day and
// at night, to judge the pixel art. Takes a built-in id or the path to a skyline .json.
//   node scripts/region-sheet.js osaka sheet.png [scale]
//   node scripts/region-sheet.js examples/skylines/guadalajara.json sheet.png 8

import { readFileSync, writeFileSync } from 'node:fs';
import { Grid } from '../src/pixel.js';
import { parseSkyline } from '../src/skyline.js';
import { THEMES } from '../src/scenery.js';
import { SYMBOL_COLORS, applyRegionTheme, paintSprite, regionParts } from '../src/region.js';
import { drawText, textWidth } from '../src/font.js';
import { png } from './export.js';

const [input, out = 'region-sheet.png', scaleArg = '6'] = process.argv.slice(2);
if (!input) {
  console.log('usage: node scripts/region-sheet.js <skyline id or .json> [out.png] [scale]');
  process.exit(1);
}
const scale = Number(scaleArg);
const sky = parseSkyline(input.endsWith('.json') ? JSON.parse(readFileSync(input, 'utf8')) : input);
if (!sky?.region) {
  console.log(`${input} has no region`);
  process.exit(1);
}
const region = regionParts(sky.region);
applyRegionTheme(THEMES, region);

const items = [
  ...region.houses.map((s, i) => ['house', s, i]),
  ...region.trees.map((s, i) => ['tree', s, i]),
  ...region.plants.map((s, i) => ['plant', s, i]),
  ...(region.landmark ? [['landmark', region.landmark, 0]] : []),
];
const cell = Math.max(...items.map(([, s]) => s.rows[0].length)) + 6;
const tall = Math.max(...items.map(([, s]) => s.rows.length)) + 12;
const cols = 4;
const rowsN = Math.ceil(items.length / cols);
const W = cols * cell * 2;
const H = rowsN * tall;

const hex = (c) => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const px = new Uint8Array(W * scale * H * scale * 4);
for (const [mode, x0] of [['light', 0], ['dark', W / 2]]) {
  const theme = THEMES[mode];
  const g = new Grid(W / 2, H);
  g.rect(0, 0, W / 2, H, '@haze');
  items.forEach(([kind, sprite, i], n) => {
    const cx = (n % cols) * cell + (cell >> 1);
    const base = Math.floor(n / cols) * tall + tall - 5;
    g.rect((n % cols) * cell, base + 1, cell, 3, '@hill');
    paintSprite(g, sprite, cx, base);
    const tag = `${kind[0]}${i + 1}`;
    drawText(g, tag, cx - (textWidth(tag) >> 1), Math.max(0, base - sprite.rows.length - 8), '@text');
  });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W / 2; x++) {
      const c = g.get(x, y);
      const rgb = hex(c[0] === '@' ? theme[c.slice(1)] : c);
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) px.set([...rgb, 255], ((y * scale + dy) * W * scale + (x0 + x) * scale + dx) * 4);
      }
    }
  }
}
writeFileSync(out, png(W * scale, H * scale, px));
console.log(`${out}: ${items.length} drawings, ${Object.keys(SYMBOL_COLORS).length} symbols, light on the left and dark on the right`);
