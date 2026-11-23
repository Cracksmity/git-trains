import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpec } from '../../src/scene/spec.js';
import { SCENE_W, planScene, renderScene } from '../../src/scene/render.js';
import { parseSkyline } from '../../src/landscape/skyline-parse.js';
import { sampleStats } from '../../src/demo/sample.js';
import { JALISCO_TRAINS } from '../../src/trains/jalisco.js';
import { buildTrain } from '../../src/trains/render.js';
import { TOP } from '../../src/trains/geometry.js';
import { Grid } from '../../src/graphics/pixel.js';
import { paintSayula } from '../../src/landscape/jalisco-sayula.js';
import { paintBackdrop } from '../../src/scene/backdrop.js';
import { sceneHeight } from '../../src/scene/layout.js';
import { scenePalette } from '../../src/scene/themes.js';

test('Sayula selects a middle strip within the original Jalisco preset', () => {
  const original = { name: 'Jalisco', preset: 'jalisco', fill: false, buildings: [], region: undefined };
  assert.deepEqual(parseSkyline('jalisco'), original);
  const skyline = parseSkyline('jalisco-sayula');
  assert.deepEqual(skyline, { ...original, variant: 'sayula' });
  const scene = buildSpec(sampleStats(), { train: 'jalisco', mode: 'multi', skyline });
  assert.deepEqual(scene.tracks.map((track) => track.caption), [
    'Guadalajara / TypeScript 50%', 'Sayula / Python 30%', 'Tequila / Rust 15%',
  ]);
  // Hold the captions fixed to compare every other pixel, including the ballast.
  const { tracks, H } = planScene(scene);
  const backdrop = (route) => paintBackdrop(SCENE_W, H, tracks, scene.user, route);
  const altos = backdrop(original);
  const sayula = backdrop(skyline);
  for (let y = 0; y < H; y++) {
    if (y >= 100 && y < 140) continue;
    const row = (g) => g.cells.slice(y * SCENE_W, (y + 1) * SCENE_W);
    assert.deepEqual(row(sayula), row(altos), `row ${y}`);
  }
  assert.ok(altos.cells.includes('@earth') && !altos.cells.includes('@salt'));
  assert.ok(sayula.cells.includes('@salt') && !sayula.cells.includes('@earth'));
});

test('Sayula fills exactly forty rows and El Ánima disappears into the road by day', () => {
  const g = new Grid(SCENE_W, sceneHeight(3));
  paintSayula(g, 140, 40);
  assert.ok(g.cells.slice(0, 100 * g.w).every((ink) => ink === null));
  assert.ok(g.cells.slice(100 * g.w, 140 * g.w).every(Boolean));
  assert.ok(g.cells.slice(140 * g.w).every((ink) => ink === null));
  const route = parseSkyline('jalisco-sayula');
  const day = scenePalette('light', route);
  const night = scenePalette('dark', route);
  for (const ink of ['shroud', 'shroudFold', 'candle']) {
    assert.ok(g.cells.includes('@' + ink));
    assert.equal(day[ink], day.road);
    assert.notEqual(night[ink], night.road);
  }
});

test('Jalisco assigns the regional trains and captions to the available languages in order', () => {
  const stats = sampleStats();
  const opts = { train: 'jalisco', skyline: parseSkyline('jalisco'), mode: 'multi', language: 'es' };
  for (const count of [1, 2, 3]) {
    const spec = buildSpec({ ...stats, languages: stats.languages.slice(0, count) }, opts);
    const { tracks, trains } = planScene(spec);
    assert.deepEqual(tracks.map((t) => t.model.id), ['teg-90', 'ferromex', 'jose-cuervo-express'].slice(0, count));
    assert.match(tracks[0].caption, /^Guadalajara \/ [^/]+ \d+%$/);
    assert.equal(tracks[0].plaque, `RACHA ${stats.streak} DÍAS`);
    assert.ok(tracks.slice(1).every((t) => !t.plaque && !/RACHA/.test(t.caption)));
    assert.deepEqual(tracks.map((t) => t.overhead), [true, false, false].slice(0, count));
    for (const tr of trains) assert.ok(tr.rest >= 0 && tr.rest + tr.train.width <= SCENE_W);
    assert.doesNotMatch(renderScene(spec), /undefined|NaN/);
  }
});

test('the Jalisco streak plaque follows the language, the custom label and the singular', () => {
  const opts = { train: 'jalisco', skyline: parseSkyline('jalisco'), mode: 'multi' };
  const one = { ...sampleStats(), streak: 1 };
  assert.equal(buildSpec(one, { ...opts, language: 'en' }).tracks[0].plaque, 'STREAK 1 DAY');
  assert.equal(buildSpec(one, { ...opts, language: 'es' }).tracks[0].plaque, 'RACHA 1 DÍA');
  assert.equal(buildSpec(one, { ...opts, label: 'COMMITS' }).tracks[0].plaque, 'COMMITS 1 DAY');
  assert.equal(buildSpec(one, { mode: 'multi' }).tracks[0].plaque, undefined);
});

test('Jalisco trains fit at every length and leave their bodies free of signs in both directions', () => {
  for (const model of JALISCO_TRAINS) {
    for (let cars = 1; cars <= 6; cars++) {
      const right = buildTrain(model, { cars });
      const left = buildTrain(model, { cars, dir: -1 });
      assert.ok(right.width <= SCENE_W);
      assert.ok(right.layers.led.isEmpty() && left.layers.led.isEmpty());
      assert.equal(right.led, null);
      assert.equal(left.led, null);
      assert.deepEqual(left.layers.body.cells, right.layers.body.mirror().cells);
    }
  }
});

test('the TEG-90 has continuous upright ends from the windshield to the sill', () => {
  const model = JALISCO_TRAINS[0];
  for (const dir of [1, -1]) {
    const train = buildTrain(model, { cars: 2, dir, streak: 30 });
    for (const x of [0, train.width - 1]) {
      for (let y = 1; y < 19; y++) assert.ok(train.layers.body.get(x, TOP + y));
    }
    assert.ok(train.layers.led.isEmpty());
  }
});
