// Dev tool: enlarged crops of a scene in both themes, to review hand-painted art.
// node scripts/zoom.js [x0 y0 x1 y1] [--scale 6] [--no-trains] [--time 0]
//   [--train jalisco] [--skyline jalisco] [--language es] [--weather rain|storm,cloudy,clear]
//   [--out sample/zoom]
// Coordinates are scene pixels: 448 wide, the first rail on row 88 and each
// further track 52 rows lower. Writes <out>-light.png and <out>-dark.png.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { buildSpec } from '../src/scene/spec.js';
import { parseSkyline } from '../src/landscape/skyline-parse.js';
import { sampleStats } from '../src/demo/sample.js';
import { parseWeatherInput } from '../src/weather/conditions.js';
import { zoomScene } from '../tools/export/zoom.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    scale: { type: 'string', default: '6' },
    time: { type: 'string', default: '0' },
    'no-trains': { type: 'boolean', default: false },
    train: { type: 'string', default: 'jalisco' },
    skyline: { type: 'string', default: 'jalisco' },
    language: { type: 'string', default: 'es' },
    weather: { type: 'string', default: 'off' },
    out: { type: 'string', default: 'sample/zoom' },
  },
});

const [x0, y0, x1, y1] = positionals.map(Number);
const weather = parseWeatherInput(values.weather);
if (weather.mode === 'live') throw new Error('zoom draws fixed weather: off, or states such as rain or storm,cloudy,clear');
const spec = buildSpec(sampleStats(), {
  weather: weather.mode === 'fixed' ? weather.states : null,
  train: values.train,
  skyline: parseSkyline(values.skyline),
  mode: 'multi',
  language: values.language,
});
const files = zoomScene(spec, {
  region: { x0, y0, x1, y1 },
  scale: Number(values.scale),
  trains: !values['no-trains'],
  time: Number(values.time),
});
mkdirSync(dirname(values.out), { recursive: true });
for (const [theme, data] of Object.entries(files)) {
  writeFileSync(`${values.out}-${theme}.png`, data);
  console.log(`${values.out}-${theme}.png`);
}
