import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpec } from '../../src/scene/spec.js';
import { SCENE_W, planScene, renderScene } from '../../src/scene/render.js';
import { parseSkyline } from '../../src/landscape/skyline-parse.js';
import { sampleStats } from '../../src/demo/sample.js';
import { JALISCO_TRAINS } from '../../src/trains/jalisco.js';
import { buildTrain } from '../../src/trains/render.js';
import { TOP } from '../../src/trains/geometry.js';

test('Jalisco assigns the regional trains and captions to the available languages in order', () => {
  const stats = sampleStats();
  const opts = { train: 'jalisco', skyline: parseSkyline('jalisco'), mode: 'multi', language: 'es' };
  for (const count of [1, 2, 3]) {
    const spec = buildSpec({ ...stats, languages: stats.languages.slice(0, count) }, opts);
    const { tracks, trains } = planScene(spec);
    assert.deepEqual(tracks.map((t) => t.model.id), ['teg-90', 'ferromex', 'jose-cuervo-express'].slice(0, count));
    assert.match(tracks[0].caption, /Guadalajara.*RACHA/);
    assert.deepEqual(tracks.map((t) => t.overhead), [true, false, false].slice(0, count));
    for (const tr of trains) assert.ok(tr.rest >= 0 && tr.rest + tr.train.width <= SCENE_W);
    assert.doesNotMatch(renderScene(spec), /undefined|NaN/);
  }
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
