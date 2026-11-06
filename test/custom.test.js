import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { MODELS, MODEL_ORDER } from '../src/models.js';
import { buildTrain, trainWidth, MAX_CARS } from '../src/train.js';
import { parseCustomModel, CustomError } from '../src/custom.js';
import { parseSkyline, SKYLINES } from '../src/skyline.js';
import { paintBackdrop, GY0, SCENE_W, sceneHeight } from '../src/scenery.js';
import { renderScene } from '../src/scene.js';
import { buildSpec } from '../src/compose.js';
import { sampleStats } from '../src/sample.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const jsonBlocks = (md) => [...md.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]));
const problems = (fn) => {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof CustomError, err.message);
    return err.errors;
  }
  assert.fail('expected an error');
};

// --- Trains ---------------------------------------------------------------------

test('every catalog model survives a JSON round trip and draws the same', () => {
  for (const id of MODEL_ORDER) {
    const m = parseCustomModel(JSON.parse(JSON.stringify(MODELS[id])));
    for (const cars of [1, 2, 5]) {
      const a = buildTrain(MODELS[id], { cars, streak: 9 });
      const b = buildTrain(m, { cars, streak: 9 });
      for (const k of Object.keys(a.layers)) {
        assert.equal(b.layers[k].cells.join(), a.layers[k].cells.join(), `${id} x${cars} layer ${k}`);
      }
    }
  }
});

test('a minimal train only needs the body color and a nose', () => {
  const m = parseCustomModel({ pal: { body: '1A7F37' }, nose: 'metro-white' });
  assert.equal(m.pal.body, '#1a7f37');
  assert.match(m.pal.bodyHi, /^#[0-9a-f]{6}$/);
  assert.equal(m.nose.w, MODELS['metro-white'].nose.w);
  assert.equal(m.id, 'custom');
  assert.ok(trainWidth(m, MAX_CARS) <= SCENE_W);
});

test('a catalog nose can be repainted and keeps its bogie', () => {
  const m = parseCustomModel({ pal: { body: '#fff' }, nose: { base: 'bullet', color: '#c00' } });
  assert.equal(m.nose.color, '#cc0000');
  assert.equal(m.cabBogieOff, MODELS.bullet.cabBogieOff);
});

test('catalog noses still accept their earlier Spanish ids', () => {
  const a = parseCustomModel({ pal: { body: '#fff' }, nose: 'bala' });
  const b = parseCustomModel({ pal: { body: '#fff' }, nose: { base: 'metro-blanco' } });
  assert.equal(a.nose.w, MODELS.bullet.nose.w);
  assert.equal(b.nose.w, MODELS['metro-white'].nose.w);
});

const examples = (dir) =>
  readdirSync(new URL(`../examples/${dir}/`, import.meta.url)).filter((f) => f.endsWith('.json'));

test('the examples and the AI guide are valid trains', () => {
  assert.ok(examples('trains').length >= 2);
  for (const f of examples('trains')) parseCustomModel(JSON.parse(read(`examples/trains/${f}`)));
  const blocks = jsonBlocks(read('docs/ai/train.md'));
  assert.ok(blocks.length >= 2);
  for (const b of blocks) parseCustomModel(b);
  // The big examples in the guide are the same as the example files.
  assert.deepEqual(blocks[0], JSON.parse(read('examples/trains/new-york.json')));
  assert.deepEqual(blocks.find((b) => b.loco), JSON.parse(read('examples/trains/steam.json')));
});

test('problems are collected in one list to hand back to the AI', () => {
  const errs = problems(() =>
    parseCustomModel({ pal: { body: 'red' }, bands: 'xx', doors: 4, colour: 1, nose: { rows: ['ss'] } }),
  );
  assert.equal(errs.length, 5);
  assert.ok(errs.some((e) => e.includes('"colour"')));
  assert.ok(errs.some((e) => e.startsWith('pal.body')));
  assert.ok(errs.some((e) => e.startsWith('nose.rows')));
});

test('a nose needs at least one headlight and a filled joining column', () => {
  const rows = Array.from({ length: 20 }, () => 'ssss');
  assert.ok(problems(() => parseCustomModel({ pal: { body: '#888' }, nose: { rows } })).some((e) => e.includes('headlight')));
  const holed = rows.map((r, y) => (y === 5 ? '.sss' : y === 10 ? 'sssl' : r));
  assert.ok(problems(() => parseCustomModel({ pal: { body: '#888' }, nose: { rows: holed } })).some((e) => e.includes('rows[5]')));
});

test('a train too long for the scene is rejected with a clear message', () => {
  const rows = Array.from({ length: 20 }, (_, y) => (y === 10 ? 'l' : 's').repeat(40));
  const errs = problems(() => parseCustomModel({ pal: { body: '#888' }, cabWindows: 30, nose: { rows } }));
  assert.match(errs[0], /is \d+ px long and the scene is 448/);
});

test('colors cannot smuggle anything into the SVG', () => {
  for (const body of ['#fff" onload="x', 'url(#a)', 'red', '#12345g']) {
    assert.ok(problems(() => parseCustomModel({ pal: { body }, nose: 'bullet' })).some((e) => e.startsWith('pal.body')), body);
  }
  assert.ok(problems(() => parseCustomModel({ id: '<script>', pal: { body: '#fff' }, nose: 'bullet' })).some((e) => e.startsWith('id')));
});

// --- Locomotives (steam trains) ---------------------------------------------------

const steam = () => JSON.parse(read('examples/trains/steam.json'));
const locoRows = (w = 20) => Array.from({ length: 30 }, (_, y) => (y >= 5 && y <= 24 ? 'n'.repeat(w) : ''));
const locoTrain = (loco, extra = {}) => ({ pal: { body: '#888' }, loco: { rows: locoRows(), wheels: { drive: [5, 14] }, ...loco }, ...extra });

test('with a locomotive: cars behind, a coupler and the locomotive in front', () => {
  const m = parseCustomModel(steam());
  assert.equal(m.nose, undefined);
  assert.equal(m.loco.w, 48);
  for (let cars = 1; cars <= MAX_CARS; cars++) {
    for (const dir of [1, -1]) {
      const t = buildTrain(m, { cars, dir, streak: 12 });
      assert.equal(t.width, cars * 64 + 2 + m.loco.w);
      assert.equal(t.width, trainWidth(m, cars));
      assert.ok(t.led && t.led.x >= 0 && t.led.x + 39 <= t.width, 'the sign is on the first car');
    }
  }
  assert.ok(trainWidth(m, MAX_CARS) <= SCENE_W);
});

test('with a locomotive the tail is flat with a red lamp and the headlight is only in front', () => {
  const m = parseCustomModel(steam());
  const t = buildTrain(m, { cars: 2 });
  const colorsIn = (x0, x1) => {
    const out = new Set();
    for (let y = 0; y < t.height; y++) for (let x = x0; x < x1; x++) out.add(t.layers.body.get(x, y));
    return out;
  };
  const rear = colorsIn(0, 4);
  const front = colorsIn(t.width - m.loco.w, t.width);
  assert.ok(rear.has('#ff4a4a') && !rear.has('#fff4b0'), 'tail');
  assert.ok(front.has('#fff4b0') && !front.has('#ff4a4a'), 'locomotive');
});

test('the rod and the smoke change between frames; no chimney means no smoke', () => {
  const m = parseCustomModel(steam());
  const t = buildTrain(m, { cars: 1 });
  const loco = (g) => {
    const out = [];
    for (let y = 0; y < g.h; y++) for (let x = t.width - m.loco.w; x < t.width; x++) out.push(g.get(x, y));
    return out.join();
  };
  assert.notEqual(loco(t.layers.wa), loco(t.layers.wb));
  assert.ok(!t.layers.pa.isEmpty() && !t.layers.pb.isEmpty());
  assert.notEqual(loco(t.layers.pa), loco(t.layers.pb));
  const noSmoke = steam();
  delete noSmoke.loco.smoke;
  const t2 = buildTrain(parseCustomModel(noSmoke), { cars: 1 });
  assert.ok(t2.layers.pa.isEmpty() && t2.layers.pb.isEmpty());
  // Catalog trains don't smoke.
  assert.ok(buildTrain(MODELS.bullet, { cars: 2 }).layers.pa.isEmpty());
});

test('the locomotive is validated with messages for the AI', () => {
  assert.doesNotThrow(() => parseCustomModel(locoTrain({})));
  const has = (raw, text) => assert.ok(problems(() => parseCustomModel(raw)).some((e) => e.includes(text)), text);
  has(locoTrain({}, { nose: 'bullet' }), 'nose: with "loco"');
  has(locoTrain({}, { pant: 'lead' }), 'pant: with "loco"');
  has(locoTrain({}, { articulated: true }), 'articulated');
  has(locoTrain({ rows: locoRows().slice(0, 20) }), 'loco.rows: must be 30');
  has(locoTrain({ rows: locoRows(70) }), '16 to 60');
  has(locoTrain({ rows: locoRows().map((r, y) => (y === 9 ? 'nnxn' : r)) }), 'loco.rows[9]: unknown symbols "x"');
  has(locoTrain({ wheels: { drive: [5, 10] } }), 'overlap');
  has(locoTrain({ wheels: { drive: [2] } }), 'sticks out of the locomotive');
  has(locoTrain({ wheels: { drive: [5], d: 8 } }), 'loco.wheels.d');
  has(locoTrain({ wheels: { drive: [] } }), 'loco.wheels.drive');
  has(locoTrain({ wheels: undefined }), 'loco.wheels: missing');
  has(locoTrain({ smoke: 3, rows: locoRows().map((r) => r.replace(/^(...)n/, '$1.')) }), 'loco.smoke: column 3 is empty');
  has(locoTrain({ chimney: 3 }), 'loco: unknown key "chimney"');
  has({ pal: { body: '#888' } }, 'or use "loco"');
});

test('a train with a locomotive is drawn in the scene with animated smoke', () => {
  const m = parseCustomModel(steam());
  for (const state of ['idle', 'slow', 'fast']) {
    const svg = renderScene({ tracks: [{ model: m, cars: 3, stripe: '#f1e05a', streak: 5, state, dir: -1 }] });
    assert.ok(svg.startsWith('<svg') && !/undefined|NaN|null/.test(svg), state);
    assert.match(svg, /class="sm pa0"/);
    assert.match(svg, /\.pa0\{animation:sa [\d.]+s step-end infinite\}/);
    assert.ok(!svg.includes('c-wire'), 'no overhead wire');
  }
  const metro = renderScene({ tracks: [{ model: 'metro-gray', cars: 3, stripe: '#fff', state: 'normal' }] });
  assert.ok(!metro.includes('class="sm'));
});

test('a custom train runs on the main track; in multi mode the others follow the catalog', () => {
  const custom = parseCustomModel(JSON.parse(read('examples/trains/new-york.json')));
  const single = buildSpec(sampleStats(), { train: custom });
  assert.equal(single.tracks[0].model, custom);
  const multi = buildSpec(sampleStats(), { train: custom, mode: 'multi' });
  assert.equal(multi.tracks[0].model, custom);
  assert.ok(multi.tracks.slice(1).every((t) => MODEL_ORDER.includes(t.model)));
  const svg = renderScene(multi);
  assert.ok(svg.startsWith('<svg') && !/undefined|NaN|null/.test(svg));
});

// --- Skylines -------------------------------------------------------------------

const countCity = (g, x0, x1, y1) => {
  let n = 0;
  for (let y = 0; y < y1; y++) {
    for (let x = x0; x < x1; x++) if (['@city', '@city2', '@cityWin'].includes(g.get(x, y))) n++;
  }
  return n;
};
const tracks = [{ model: 'tram', state: 'idle', dir: 1, overhead: false }];

test('"city", its Spanish alias or nothing means the procedural city', () => {
  for (const v of [undefined, null, '', 'city', 'ciudad']) assert.equal(parseSkyline(v), null);
  const base = renderScene({ tracks: [{ model: 'bullet', cars: 3, stripe: '#fff', state: 'idle' }] });
  assert.equal(renderScene({ skyline: null, tracks: [{ model: 'bullet', cars: 3, stripe: '#fff', state: 'idle' }] }), base);
});

test('the earlier preset id "nueva-york" still works', () => {
  assert.deepEqual(parseSkyline('nueva-york'), parseSkyline('new-york'));
});

test('the built-in skylines, the examples and the guide are valid', () => {
  for (const id of Object.keys(SKYLINES)) assert.ok(parseSkyline(id).buildings.length > 0, id);
  for (const f of examples('skylines')) parseSkyline(JSON.parse(read(`examples/skylines/${f}`)));
  const blocks = jsonBlocks(read('docs/ai/skyline.md'));
  assert.ok(blocks.some((b) => b.buildings));
  for (const b of blocks) parseSkyline(b.buildings ? b : { buildings: [b] });
});

test('a skyline changes the city but not the rest of the scenery', () => {
  const H = sceneHeight(1);
  const plain = paintBackdrop(SCENE_W, H, tracks, 'octocat');
  // Without its region: the region's plants replace some of the bushes (see region.test.js).
  const ny = paintBackdrop(SCENE_W, H, tracks, 'octocat', parseSkyline({ ...SKYLINES['new-york'], region: undefined }));
  // From the embankment down (bushes, ballast, signal) everything stays the same.
  for (let y = GY0 - 8; y < H; y++) {
    for (let x = 0; x < SCENE_W; x++) {
      const a = plain.get(x, y);
      const b = ny.get(x, y);
      if (!['@city', '@city2', '@cityWin'].includes(a) && !['@city', '@city2', '@cityWin'].includes(b)) {
        assert.equal(b, a, `(${x}, ${y})`);
      }
    }
  }
});

test('each user gets their own procedural city, the same one every day', () => {
  const H = sceneHeight(1);
  const city = (user) => paintBackdrop(SCENE_W, H, tracks, user).cells.join();
  assert.equal(city('octocat'), city('Octocat'));
  assert.notEqual(city('octocat'), city('monalisa'));
});

test('without fill only the skyline buildings are drawn; with fill, nothing covers them', () => {
  const H = sceneHeight(1);
  const sky = (fill) => parseSkyline({ fill, buildings: [{ x: 200, w: 10, h: 50, windows: false }] });
  const solo = paintBackdrop(SCENE_W, H, tracks, '', sky(false));
  assert.equal(countCity(solo, 0, SCENE_W, GY0 - 10), 10 * 40);
  const filled = paintBackdrop(SCENE_W, H, tracks, '', sky(true));
  assert.ok(countCity(filled, 0, SCENE_W, GY0 - 10) > 10 * 40);
  assert.equal(countCity(filled, 198, 212, GY0 - 10), 10 * 40);
});

test('tops stack and drawings sit on the ground row', () => {
  const H = sceneHeight(1);
  const sky = parseSkyline({
    fill: false,
    buildings: [
      { x: 100, w: 10, h: 20, windows: false, top: [{ type: 'stepped', steps: 2, h: 3 }, { type: 'antenna', h: 5 }] },
      { x: 300, rows: Array(12).fill('#') },
    ],
  });
  const g = paintBackdrop(SCENE_W, H, tracks, '', sky);
  const topRow = (x0, x1) => {
    for (let y = 0; y < GY0; y++) for (let x = x0; x < x1; x++) if (g.get(x, y) === '@city') return y;
    return null;
  };
  assert.equal(topRow(100, 110), GY0 - 20 - 3 * 2 - 5);
  assert.equal(topRow(300, 301), GY0 - 12);
});

test('skyline problems are collected together too', () => {
  const errs = problems(() =>
    parseSkyline({
      buildings: [
        { x: 10, w: 0, h: 99 },
        { x: 20, w: 5, h: 5, top: 'tower' },
        { x: 30, rows: ['#x#'], w: 3 },
        { x: 40, w: 5, h: 5, layer: 'middle' },
      ],
    }),
  );
  assert.ok(errs.length >= 5, errs.join('\n'));
  assert.ok(errs.some((e) => e.includes('unknown top "tower"')));
  assert.ok(errs.some((e) => e.includes('unknown symbols "x"')));
  assert.ok(problems(() => parseSkyline('paris'))[0].includes('new-york'));
});
