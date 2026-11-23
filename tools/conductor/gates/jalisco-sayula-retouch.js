// Gate for the second pass over the Sayula strip:
//   node tools/conductor/gates/jalisco-sayula-retouch.js
// It checks the contract in tools/conductor/tasks/jalisco-sayula-retouch.md: the landmarks
// that must rise above the freight train, the low ones that must sit where the train leaves
// the view in frame 0, one volcanic massif, a flock of smaller pelicans, wind and heat that
// show, and the caption temperature in the same format as the other places.
// jalisco-sayula.js keeps checking the variant's contract; run both.
import { readFileSync } from 'node:fs';
import { parseSkyline } from '../../../src/landscape/skyline-parse.js';
import { JALISCO_WEATHER } from '../../../src/landscape/jalisco-weather.js';
import { jaliscoWind } from '../../../src/landscape/jalisco-weather-wind.js';
import { buildSpec } from '../../../src/scene/spec.js';
import { paintBackdrop } from '../../../src/scene/backdrop.js';
import { scenePalette } from '../../../src/scene/themes.js';
import { weatherBands } from '../../../src/scene/weather.js';
import { BALLAST, GY0, PITCH, SCENE_W, sceneHeight } from '../../../src/scene/layout.js';
import { sampleStats } from '../../../src/demo/sample.js';
import { report } from './weather-checks.js';

// Frame 0 of the sample profile: the freight train covers x 22-287 and rises 26 rows.
const CLEAR_FROM = 292;
const BASE = GY0 + PITCH;
const TOP = GY0 + BALLAST;
const ABOVE_TRAIN = BASE - 27;
const REQUIRED = ['cantera', 'canteraLit', 'canteraShade', 'domeGold', 'kioskBase', 'kioskTrim', 'kioskRoof',
  'ironwork', 'santuarioWall', 'santuarioTrim', 'domeOrange', 'domeRib'];
const LOW = new Set(['kioskBase', 'kioskTrim', 'kioskRoof', 'ironwork', 'shroud', 'shroudFold', 'candle']);
const PARROQUIA = new Set(['cantera', 'canteraLit', 'canteraShade', 'domeGold', 'domeGoldShade']);
const RETIRED = ['fuego', 'fuegoRib', 'plume'];

const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); };
const sayula = /** @type {any} */ (parseSkyline('jalisco-sayula'));
const spec = (weather) => buildSpec(sampleStats(), { train: 'jalisco', skyline: sayula, mode: 'multi', theme: 'auto', language: 'en', weather });

// The caption keeps the format of the other places.
const live = [{ state: 'cloudy', temperature: 15 }, { state: 'rain', temperature: 23.8 }, { state: 'clear', temperature: 29 }];
const captions = spec(live).tracks.map((t) => t.caption);
check(captions[1] === 'Sayula 24° / Python 30%', `the Sayula caption reads "${captions[1]}", not "Sayula 24° / Python 30%" like "${captions[0]}"`);

// Where each ink lies in the strip.
const tracks = spec(null).tracks;
const backdrop = paintBackdrop(SCENE_W, sceneHeight(tracks.length), tracks, 'octocat', sayula);
/** @type {Map<string, Array<[number, number]>>} */
const where = new Map();
for (let y = TOP; y < BASE; y++) {
  for (let x = 0; x < SCENE_W; x++) {
    const ink = backdrop.get(x, y);
    if (typeof ink !== 'string' || !ink.startsWith('@')) continue;
    const name = ink.slice(1);
    if (!where.has(name)) where.set(name, []);
    where.get(name)?.push([x, y]);
  }
}
const at = (names) => [...names].flatMap((name) => where.get(name) ?? []);
const highest = (points) => points.reduce((best, p) => (p[1] < best[1] ? p : best), [0, Infinity]);

const missing = REQUIRED.filter((name) => !where.has(name));
check(!missing.length, `the strip never uses ${missing.map((n) => `@${n}`).join(', ')}`);
const retired = RETIRED.filter((name) => where.has(name));
check(!retired.length, `remove the separate Volcán de Fuego and its plume (${retired.map((n) => `@${n}`).join(', ')}): from Sayula the two volcanoes read as one massif`);

const hidden = at([...LOW, ...PARROQUIA]).filter(([x]) => x < CLEAR_FROM);
check(!hidden.length, `the kiosk, the parroquia and El Ánima must start at x ${CLEAR_FROM} or later, where the train leaves the view in frame 0 (found ${hidden.length} pixels further left, from x ${Math.min(...hidden.map(([x]) => x), Infinity)})`);

const [, towerTop] = highest(at(PARROQUIA));
check(towerTop <= BASE - 34, `the parroquia tower reaches ${Number.isFinite(towerTop) ? BASE - towerTop : 0} rows above the rail; it needs at least 34 so its belfry and golden dome show above the train`);
const goldAbove = (where.get('domeGold') ?? []).filter(([, y]) => y < ABOVE_TRAIN).length;
check(goldAbove >= 6, `only ${goldAbove} pixels of @domeGold rise above the train (row ${ABOVE_TRAIN}); the dome must read when the train passes`);
const domesAbove = at(['domeOrange', 'domeRib']).filter(([, y]) => y < ABOVE_TRAIN).length;
check(domesAbove >= 6, `only ${domesAbove} pixels of the santuario's orange domes rise above the train; put it high on its cerrito`);

const [summitX, summitY] = highest(at(['nevado', 'nevadoShade', 'summitSnow']));
check(summitY <= BASE - 34 && summitX >= 240 && summitX <= 400,
  `the Nevado's summit is at x ${summitX}, ${BASE - summitY} rows up; put it behind the town, between x 240 and 400, at least 34 rows up`);

// Pelicans: one bird per 4-connected patch of plumage.
const plumage = new Set((where.get('plumage') ?? []).map(([x, y]) => `${x},${y}`));
const birds = [];
for (const start of plumage) {
  const stack = [start];
  plumage.delete(start);
  let left = Infinity;
  let right = -Infinity;
  while (stack.length) {
    const [x, y] = String(stack.pop()).split(',').map(Number);
    left = Math.min(left, x);
    right = Math.max(right, x);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${x + dx},${y + dy}`;
      if (plumage.delete(key)) stack.push(key);
    }
  }
  birds.push([left, right]);
}
check(birds.length >= 5, `found ${birds.length} pelicans; draw a flock of at least five, a pixel between birds`);
const wide = birds.filter(([l, r]) => r - l + 1 > 8);
check(!wide.length, `plumage at most 8 pixels long per pelican (bill apart), a pixel between birds (found ${wide.map(([l, r]) => `${r - l + 1} px at x ${l}`).join(', ')})`);
const seen = birds.filter(([l]) => l >= CLEAR_FROM - 4).length;
check(seen >= 3, `only ${seen} pelicans sit right of x ${CLEAR_FROM - 4}, where frame 0 shows them; put most of the flock there`);

// Wind and heat must show on the dry pan.
const band = weatherBands(tracks.length)[1];
/**
 * Pixels drawn by some weather layers, optionally only those of one ink.
 * @param {Array<{ grid: any }>} layers
 * @param {(ink: string) => boolean} [keep]
 */
const count = (layers, keep = () => true) => layers.reduce((sum, { grid }) => {
  let n = 0;
  for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) if (grid.get(x, y) && keep(grid.get(x, y))) n++;
  return sum + n;
}, 0);
const art = /** @type {any} */ (JALISCO_WEATHER).sayula;
const shimmer = art?.heat ? count(art.heat(band, backdrop)) : 0;
check(shimmer >= 200, `the heat mirage draws ${shimmer} pixels; give it at least 200 over a wider dry pan`);
const dust = count(jaliscoWind('sayula', band, backdrop, 'clear'), (ink) => ink === '@saltDust');
check(dust >= 120, `the tolvaneras draw ${dust} pixels of @saltDust; give them at least 120`);
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(String(hex).slice(i, i + 2), 16));
for (const theme of ['light', 'dark']) {
  const palette = scenePalette(theme, sayula);
  const [a, b] = [rgb(palette.saltDust), rgb(palette.salt)];
  const distance = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  check(distance >= 40, `in the ${theme} theme @saltDust (${palette.saltDust}) is too close to @salt (${palette.salt}); make the dust stand apart`);
}

// Place-specific numbers belong to JALISCO_WEATHER, not to the shared weather code.
const shared = readFileSync(new URL('../../../src/scene/weather.js', import.meta.url), 'utf8');
check(!/sayula/i.test(shared), 'src/scene/weather.js still names Sayula; move its heat-sky depth into JALISCO_WEATHER.sayula');

report('jalisco-sayula-retouch', problems, `the landmarks clear the train, ${birds.length} pelicans, ${dust} dust and ${shimmer} mirage pixels`);
