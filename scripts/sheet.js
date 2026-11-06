// Dev tool: draws a PNG sheet with the trains zoomed in.
// node scripts/sheet.js out.png [scale] [cars] [open] [model,model...]
// Each model can be a catalog id or the path to a custom train (.json):
// node scripts/sheet.js mine.png 5 2 0 examples/trains/new-york.json
// A special car (dining, observation or mail) joins every train with a 7th argument:
// node scripts/sheet.js cars.png 4 3 0 metro-orange,bullet a dining

import { readFileSync, writeFileSync } from 'node:fs';
import { buildTrain } from '../src/trains/render.js';
import { TRAIN_H } from '../src/trains/geometry.js';
import { MODEL_ORDER, getModel } from '../src/trains/models.js';
import { parseCustomModel } from '../src/trains/parse.js';
import { png } from '../tools/export/png.js';

const [out = 'sheet.png', scaleArg = '4', carsArg = '3', openArg = '0', modelsArg, frameArg = 'a', extraArg = ''] = process.argv.slice(2);
const scale = Number(scaleArg);
const cars = Number(carsArg);
const open = openArg === '1';
const wheelLayer = frameArg === 'b' ? 'wb' : 'wa';
const smokeLayer = frameArg === 'b' ? 'pb' : 'pa'; // locomotive smoke (if any)
const ids = modelsArg ? modelsArg.split(',') : MODEL_ORDER;
const stripeColors = ['#3178c6', '#3572A5', '#dea584', '#f1e05a', '#41b883', '#e34c26'];

function hex(c) {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const load = (id) => (id.endsWith('.json') ? parseCustomModel(JSON.parse(readFileSync(id, 'utf8'))) : getModel(id));
const trains = ids.map((id, i) =>
  buildTrain(load(id), { cars, stripe: stripeColors[i % stripeColors.length], streak: extraArg ? 120 : 12, label: 'STREAK', extra: extraArg || null }),
);
const gap = 6;
const W = Math.max(...trains.map((t) => t.width)) * scale + 16;
const H = trains.length * (TRAIN_H + gap) * scale + 8;
const px = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) px.set([232, 236, 242, 255], i * 4);

trains.forEach((t, k) => {
  const oy = (k * (TRAIN_H + gap) + 2) * scale;
  // Rail under the train, to judge the wheel contrast.
  for (let x = 0; x < t.width; x++) {
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        px.set([196, 201, 209, 255], ((oy + TRAIN_H * scale + dy) * W + 8 + x * scale + dx) * 4);
      }
    }
  }
  for (const name of ['body', 'lit', wheelLayer, ...(open ? ['open'] : []), 'led', smokeLayer]) {
    const g = t.layers[name];
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const rgb = g.cells[y * g.w + x] && hex(g.cells[y * g.w + x]);
        if (!rgb) continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            px.set([...rgb, 255], ((oy + y * scale + dy) * W + 8 + x * scale + dx) * 4);
          }
        }
      }
    }
  }
});

writeFileSync(out, png(W, H, px));
console.log(`${out} ${W}x${H}`);
