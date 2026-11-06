import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { earnedUnlocks, unlockFor, unlockThreshold, UNLOCK_IDS } from '../../src/activity/unlocks.js';
import { SPECIAL_CARS } from '../../src/trains/special-cars.js';
import { buildTrain } from '../../src/trains/render.js';
import { cabWidth, trainWidth, MID_W, TOP } from '../../src/trains/geometry.js';
import { MODELS, MODEL_ORDER } from '../../src/trains/models.js';
import { parseCustomModel } from '../../src/trains/parse.js';
import { buildSpec } from '../../src/scene/spec.js';
import { renderScene, SCENE_W } from '../../src/scene/render.js';
import { sampleStats } from '../../src/demo/sample.js';

const steam = parseCustomModel(JSON.parse(readFileSync(new URL('../../examples/trains/steam.json', import.meta.url), 'utf8')));
const ALL = [...MODEL_ORDER.map((id) => MODELS[id]), steam];
const nobody = { streak: 0, stars: 0, prs: 0 };

test('each unlock is earned at its threshold and not before', () => {
  assert.deepEqual(earnedUnlocks(nobody), []);
  assert.deepEqual(earnedUnlocks({ ...nobody, streak: 99 }), []);
  assert.deepEqual(earnedUnlocks({ ...nobody, streak: 100 }), ['dining']);
  assert.deepEqual(earnedUnlocks({ ...nobody, stars: 99 }), []);
  assert.deepEqual(earnedUnlocks({ ...nobody, stars: 100 }), ['observation']);
  assert.deepEqual(earnedUnlocks({ ...nobody, prs: 499 }), []);
  assert.deepEqual(earnedUnlocks({ ...nobody, prs: 500 }), ['mail']);
  assert.deepEqual(earnedUnlocks({}), []);
  assert.deepEqual(earnedUnlocks({ streak: 'x', stars: null, prs: undefined }), []);
});

test('only the rarest car is shown when several are earned', () => {
  assert.equal(unlockFor({ streak: 100, stars: 5000, prs: 900 }), 'mail');
  assert.equal(unlockFor({ streak: 100, stars: 5000, prs: 20 }), 'dining');
  assert.equal(unlockFor({ streak: 3, stars: 5000, prs: 20 }), 'observation');
  assert.equal(unlockFor(nobody), null);
  assert.deepEqual([...UNLOCK_IDS].sort(), [...SPECIAL_CARS].sort());
  assert.deepEqual(UNLOCK_IDS.map(unlockThreshold), [500, 100, 100]);
});

// A hash of every layer of every model at 1..6 cars in both directions: if the
// trains of someone with no unlocks ever change, this changes.
function fingerprint(extra) {
  const h = createHash('sha256');
  for (const model of ALL) {
    for (let cars = 1; cars <= 6; cars++) {
      for (const dir of [1, -1]) {
        const t = buildTrain(model, { cars, dir, streak: 7, stripe: '#3178c6', label: 'STREAK', ...extra });
        for (const k of Object.keys(t.layers).sort()) h.update(`${model.id}|${cars}|${dir}|${k}|${t.layers[k].paths()}`);
      }
    }
  }
  return h.digest('hex');
}
const TODAY = '7b4a54d006884da5d427c5fbaeca5aeab065a0c1bacd78a7e55c8ef17be1ab69';

test('without an unlock the trains are exactly what they were', () => {
  assert.equal(fingerprint({}), TODAY);
  assert.equal(fingerprint({ extra: null }), TODAY);
  assert.equal(fingerprint({ extra: undefined }), TODAY);
});

test('without an unlock the scene is the same SVG, spec and title', () => {
  const stats = sampleStats({ total: 900, streak: 12 });
  const plain = buildSpec(stats, { theme: 'light' });
  const none = buildSpec(stats, { theme: 'light', unlock: null });
  assert.deepEqual(none, plain);
  assert.ok(!('extra' in plain.tracks[0]));
  assert.ok(!plain.title.includes('\n'));
  assert.equal(renderScene(none), renderScene(plain));
});

test('every special car adds one car of its own to every model, both ways', () => {
  for (const model of ALL) {
    for (const kind of SPECIAL_CARS) {
      for (let cars = 1; cars <= 5; cars++) {
        for (const dir of [1, -1]) {
          const t = buildTrain(model, { cars, dir, streak: 120, extra: kind });
          assert.equal(t.width, trainWidth(model, cars, true), `${model.id} ${kind} x${cars}`);
          assert.equal(t.width, trainWidth(model, cars) + MID_W);
          assert.ok(!t.layers.body.isEmpty());
        }
      }
    }
  }
  assert.throws(() => buildTrain(MODELS.tram, { cars: 2, extra: 'sleeper' }), /Unknown special car: "sleeper"/);
});

// The cells of a layer between two train columns, as one string.
const crop = (t, layer, x0, x1) => {
  const g = t.layers[layer];
  const out = [];
  for (let y = 0; y < g.h; y++) for (let x = x0; x < x1; x++) out.push(g.get(x, y) ?? '.');
  return out.join(',');
};

// metro-white (a pantograph on every other car) and the tram (cars in articulated pairs) are left
// out: they keep their alternation counting from the head, so the cars behind a special car change.
test('a special car sits right behind the cab and leaves its neighbours alone', () => {
  for (const id of ['metro-orange', 'metro-gray', 'metro-yellow', 'bullet']) {
    const model = MODELS[id];
    const cab = cabWidth(model);
    for (const kind of SPECIAL_CARS) {
      for (const cars of [2, 3, 4]) {
        const opts = { cars, streak: 120, stripe: '#3178c6' };
        const base = buildTrain(model, opts);
        const plus = buildTrain(model, { ...opts, extra: kind });
        const where = `${id} ${kind} x${cars}`;
        // Same train in front of the special car, same cab after it.
        assert.equal(crop(plus, 'body', 0, plus.width - cab - MID_W), crop(base, 'body', 0, base.width - cab), `${where}: rear`);
        assert.equal(crop(plus, 'body', plus.width - cab, plus.width), crop(base, 'body', base.width - cab, base.width), `${where}: cab`);
        // The special car itself is not an ordinary car.
        const own = crop(plus, 'body', plus.width - cab - MID_W, plus.width - cab);
        const ordinary = crop(buildTrain(model, { ...opts, cars: cars + 1 }), 'body', base.width - cab, base.width - cab + MID_W);
        assert.notEqual(own, ordinary, `${where}: looks like an ordinary car`);
      }
    }
  }
});

test('the three special cars look different from each other, on every model', () => {
  for (const model of ALL) {
    const cars = 2;
    const look = (kind) => {
      const t = buildTrain(model, { cars, streak: 120, stripe: '#3178c6', extra: kind });
      // The special car is the one right behind the cab (right behind the locomotive on a steam train).
      const end = model.loco ? t.width - model.loco.w - 2 : t.width - cabWidth(model);
      return crop(t, 'body', end - MID_W, end);
    };
    const looks = SPECIAL_CARS.map(look);
    assert.equal(new Set(looks).size, SPECIAL_CARS.length, model.id);
  }
});

// Pixels of the special car (train coordinates), with the colors used to tell its parts apart.
function special(model, kind, dir = 1) {
  const t = buildTrain(model, { cars: 3, streak: 120, stripe: '#3178c6', extra: kind });
  const end = t.width - cabWidth(model);
  const x0 = end - MID_W;
  const at = (x, y, layer = 'body') => t.layers[layer].get(x0 + x, TOP + y);
  return { t, x0, w: MID_W, at, glass: new Set([model.pal.glass, model.pal.glassHi]) };
}

test('the observation car has a glass roof', () => {
  for (const id of ['metro-orange', 'metro-white', 'bullet', 'tram']) {
    const { w, at, glass } = special(MODELS[id], 'observation');
    let n = 0;
    for (let y = -6; y <= 2; y++) for (let x = 3; x < w - 2; x++) if (glass.has(at(x, y))) n++;
    assert.ok(n >= 40, `${id}: only ${n} glass pixels on the roof`);
  }
});

test('the mail car has no windows and carries the language stripe', () => {
  for (const id of MODEL_ORDER) {
    const { w, at, glass } = special(MODELS[id], 'mail');
    let panes = 0;
    let stripe = 0;
    for (let y = 3; y <= 17; y++) {
      for (let x = 3; x < w - 2; x++) {
        if (glass.has(at(x, y))) panes++;
        if (at(x, y) === '#3178c6') stripe++;
      }
    }
    assert.equal(panes, 0, `${id}: the mail car has windows`);
    assert.ok(stripe >= 20, `${id}: the stripe is missing`);
  }
});

test('the dining car has round windows and a lamp that glows', () => {
  for (const id of MODEL_ORDER) {
    const { t, x0, w, at, glass } = special(MODELS[id], 'dining');
    // Connected groups of glass in the window rows.
    const seen = new Set();
    const groups = [];
    for (let y = 3; y <= 12; y++) {
      for (let x = 3; x < w - 2; x++) {
        if (!glass.has(at(x, y)) || seen.has(`${x},${y}`)) continue;
        const group = [];
        const todo = [[x, y]];
        seen.add(`${x},${y}`);
        while (todo.length) {
          const [cx, cy] = todo.pop();
          group.push([cx, cy]);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const key = `${cx + dx},${cy + dy}`;
            if (cy + dy >= 3 && cy + dy <= 12 && glass.has(at(cx + dx, cy + dy)) && !seen.has(key)) {
              seen.add(key);
              todo.push([cx + dx, cy + dy]);
            }
          }
        }
        groups.push(group);
      }
    }
    const windows = groups.filter((g) => g.length >= 8);
    assert.ok(windows.length >= 3, `${id}: expected at least 3 windows, found ${windows.length}`);
    for (const g of windows) {
      const xs = g.map((p) => p[0]);
      const ys = g.map((p) => p[1]);
      const [ax, bx, ay, by] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      assert.ok(bx - ax >= 2 && by - ay >= 2, `${id}: a window is too small to be round`);
      const has = (x, y) => g.some((p) => p[0] === x && p[1] === y);
      const corners = [has(ax, ay), has(bx, ay), has(ax, by), has(bx, by)].filter(Boolean).length;
      assert.ok(corners <= 1, `${id}: a window is square, not round`);
    }
    // The lamp glows: something in the car is on the lit layer.
    let lit = 0;
    for (let y = -2; y < 20; y++) for (let x = 0; x < w; x++) if (t.layers.lit.get(x0 + x, TOP + y)) lit++;
    assert.ok(lit >= 1, `${id}: nothing glows in the dining car`);
  }
});

test('a special car only paints inside its own columns, with real colors', () => {
  for (const model of ALL) {
    for (const kind of SPECIAL_CARS) {
      const t = buildTrain(model, { cars: 3, streak: 120, stripe: '#3178c6', extra: kind });
      for (const [name, g] of Object.entries(t.layers)) {
        for (const c of g.cells) {
          if (c !== null) assert.match(c, /^#[0-9a-f]{6}$/i, `${model.id} ${kind} ${name}: ${c}`);
        }
      }
    }
  }
});

test('the spec gives the extra car to the main train only, with a line in the title', () => {
  const stats = sampleStats({ total: 900, streak: 120 });
  for (const kind of UNLOCK_IDS) {
    const multi = buildSpec(stats, { mode: 'multi', unlock: kind });
    assert.equal(multi.tracks[0].extra, kind);
    for (const t of multi.tracks.slice(1)) assert.ok(!('extra' in t));
    const lines = multi.title.split('\n');
    assert.equal(lines.length, 2);
    assert.equal(lines[0], buildSpec(stats, {}).title);
    assert.match(lines[1], /unlocked/);
  }
  assert.match(buildSpec(stats, { unlock: 'mail' }).title, /Mail car unlocked: 500\+ pull requests/);
  assert.match(buildSpec(stats, { unlock: 'dining' }).title, /Dining car unlocked: 100-day streak/);
  assert.match(buildSpec(stats, { unlock: 'observation' }).title, /Observation car unlocked: 100\+ stars/);
  assert.match(buildSpec(stats, { unlock: 'dining', language: 'es' }).title, /Vagón comedor desbloqueado: racha de 100 días/);
  assert.match(buildSpec(stats, { unlock: 'observation', language: 'es' }).title, /Vagón mirador desbloqueado: más de 100 estrellas/);
  assert.match(buildSpec(stats, { unlock: 'mail', language: 'es' }).title, /Vagón postal desbloqueado: más de 500 pull requests/);
  assert.throws(() => buildSpec(stats, { unlock: 'sleeper' }), /Unknown unlock: "sleeper"/);
});

test('the scene draws the extra car and keeps the title safe', () => {
  const stats = sampleStats({ total: 900, streak: 120 });
  const plain = renderScene(buildSpec(stats, { theme: 'light' }));
  for (const kind of UNLOCK_IDS) {
    const svg = renderScene(buildSpec(stats, { theme: 'light', unlock: kind }));
    assert.notEqual(svg, plain);
    assert.ok(svg.includes(`${kind[0].toUpperCase()}${kind.slice(1)} car unlocked`));
    assert.ok(!/undefined|NaN/.test(svg));
  }
});

test('the longest train still fits in the scene with a special car', () => {
  for (const model of ALL) {
    const stats = sampleStats({ total: 5000, streak: 120 });
    for (const unlock of UNLOCK_IDS) {
      const lead = buildSpec(stats, { train: model.loco || !MODEL_ORDER.includes(model.id) ? model : model.id, unlock }).tracks[0];
      assert.equal(lead.extra, unlock);
      assert.ok(trainWidth(model, lead.cars, true) <= SCENE_W, `${model.id}: ${lead.cars} cars + ${unlock}`);
      assert.ok(lead.cars >= 5, `${model.id}: lost more than one car`);
    }
  }
  // Shorter trains keep every car they earned.
  const small = buildSpec(sampleStats({ total: 300, streak: 120 }), { unlock: 'mail' }).tracks[0];
  assert.equal(small.cars, 3);
});
