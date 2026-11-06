import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrain } from '../../src/trains/render.js';
import { trainWidth, LED_W } from '../../src/trains/geometry.js';
import { MODELS, MODEL_ORDER } from '../../src/trains/models.js';
import { renderScene, STATES, SCENE_W } from '../../src/scene/render.js';
import { buildSpec } from '../../src/scene/spec.js';
import { sampleStats } from '../../src/demo/sample.js';

test('every model builds with 1 to 6 cars in both directions', () => {
  for (const id of MODEL_ORDER) {
    for (let cars = 1; cars <= 6; cars++) {
      for (const dir of [1, -1]) {
        const t = buildTrain(MODELS[id], { cars, dir, streak: 7 });
        assert.equal(t.width, trainWidth(MODELS[id], cars), `${id} x${cars}`);
        assert.ok(!t.layers.body.isEmpty());
      }
    }
  }
});

test('the longest train fits in the scene', () => {
  for (const id of MODEL_ORDER) assert.ok(trainWidth(MODELS[id], 6) <= SCENE_W, id);
});

test('the sign text is not mirrored when the train runs left', () => {
  const model = MODELS['metro-orange'];
  const right = buildTrain(model, { cars: 1, dir: 1, streak: 12 });
  const left = buildTrain(model, { cars: 1, dir: -1, streak: 12 });
  const crop = (t, x0) => {
    const g = t.layers.led;
    const rows = [];
    for (let y = 0; y < g.h; y++) {
      let row = '';
      for (let x = x0; x < x0 + LED_W; x++) row += g.get(x, y) ? '#' : '.';
      rows.push(row);
    }
    return rows.join('\n');
  };
  // Mirrored, the sign sits in the symmetric position.
  assert.equal(left.led.x, left.width - right.led.x - LED_W);
  assert.equal(crop(left, left.led.x), crop(right, right.led.x));
});

test('every train has a cab at both ends: headlights in front, red lights at the back', () => {
  const HEAD = '#fff4b0';
  const TAIL = '#ff4a4a';
  for (const id of MODEL_ORDER) {
    const model = MODELS[id];
    const t = buildTrain(model, { cars: 2 });
    const colorsIn = (x0, x1) => {
      const out = new Set();
      for (let y = 0; y < t.height; y++) for (let x = x0; x < x1; x++) out.add(t.layers.body.get(x, y));
      return out;
    };
    const rear = colorsIn(0, model.nose.w);
    const front = colorsIn(t.width - model.nose.w, t.width);
    assert.ok(rear.has(TAIL) && !rear.has(HEAD), `${id}: tail`);
    assert.ok(front.has(HEAD) && !front.has(TAIL), `${id}: head`);
  }
});

test('the articulated tram shares a bogie in each pair of cars', () => {
  // Each bogie leaves 6 disc marks (3 per wheel) on the wa layer.
  const bogies = (id, cars) => buildTrain(MODELS[id], { cars }).layers.wa.cells.filter(Boolean).length / 6;
  assert.equal(bogies('tram', 1), 2);
  assert.equal(bogies('tram', 2), 3);
  assert.equal(bogies('tram', 3), 5);
  assert.equal(bogies('tram', 4), 6);
  assert.equal(bogies('metro-orange', 2), 4);
});

test('the overhead wire only shows up over trains with a pantograph', () => {
  const mk = (model) => renderScene({ tracks: [{ model, cars: 2, stripe: '#fff', state: 'idle' }] });
  for (const id of MODEL_ORDER) {
    const overhead = !!MODELS[id].pant;
    assert.equal(/class="c-wire"/.test(mk(id)), overhead, id);
    assert.equal(buildTrain(MODELS[id], { cars: 2 }).hasPantograph, overhead, id);
  }
});

test('the earlier Spanish model ids still work', () => {
  const pick = (train) => buildSpec(sampleStats(), { train }).tracks[0].model;
  assert.equal(pick('suburbano'), 'metro-white');
  assert.equal(pick('metro-blanco'), 'metro-white');
  assert.equal(pick('tranvia'), 'tram');
  assert.equal(pick('bala'), 'bullet');
});

test('lit windows grow with the streak', () => {
  const count = (streak) =>
    buildTrain(MODELS.tram, { cars: 3, streak }).layers.lit.cells.filter(Boolean).length;
  assert.equal(count(0), 0);
  assert.ok(count(5) > 0);
  assert.ok(count(30) > count(5));
  assert.equal(count(30), count(90));
});

test('renderScene produces a well-formed SVG for every state and theme', () => {
  for (const state of Object.keys(STATES)) {
    for (const theme of ['light', 'dark', 'auto']) {
      const svg = renderScene({
        theme,
        user: 'octocat',
        tracks: [{ model: 'bullet', cars: 4, stripe: '#3178c6', streak: 12, state, caption: 'TYPESCRIPT - 12' }],
      });
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
      assert.equal((svg.match(/<g[ >]/g) ?? []).length, (svg.match(/<\/g>/g) ?? []).length);
      assert.ok(!/undefined|NaN|null/.test(svg), `${state}/${theme} has invalid values`);
    }
  }
});

test('the automatic theme includes prefers-color-scheme and the fixed ones do not', () => {
  const spec = { user: 'x', tracks: [{ model: 'tram', cars: 1, stripe: '#fff', state: 'idle' }] };
  assert.match(renderScene({ ...spec, theme: 'auto' }), /prefers-color-scheme:dark/);
  assert.doesNotMatch(renderScene({ ...spec, theme: 'light' }), /prefers-color-scheme:dark/);
});

test('moving trains advance one pixel at a time', () => {
  const svg = renderScene({ tracks: [{ model: 'metro-orange', cars: 2, stripe: '#fff', state: 'normal' }] });
  const w = trainWidth(MODELS['metro-orange'], 2);
  assert.match(svg, new RegExp(`steps\\(${SCENE_W + w}\\)`));
});

test('sparks and speed lines only show up at top speed', () => {
  const mk = (state) =>
    renderScene({ tracks: [{ model: 'bullet', cars: 3, stripe: '#fff', state }] });
  assert.match(mk('fast'), /class="sp sa0"/);
  assert.doesNotMatch(mk('normal'), /class="sp sa0"/);
  assert.match(mk('fast'), /c-speed/);
  assert.doesNotMatch(mk('slow'), /c-speed/);
});

test('multi mode builds 3 tracks with different models running in alternate directions', () => {
  const spec = buildSpec(sampleStats(), { mode: 'multi' });
  assert.equal(spec.tracks.length, 3);
  assert.equal(new Set(spec.tracks.map((t) => t.model)).size, 3);
  assert.deepEqual(spec.tracks.map((t) => t.dir), [1, -1, 1]);
  assert.ok(spec.tracks.every((t) => t.cars >= 1 && t.cars <= spec.tracks[0].cars));
  assert.doesNotThrow(() => renderScene(spec));
});

test('an unknown model gives a clear error', () => {
  assert.throws(() => buildSpec(sampleStats(), { train: 'flying' }), /Unknown train model/);
});

test('train auto evolves with the number of cars', () => {
  const s = sampleStats();
  const first = buildSpec({ ...s, cars: 1 }, { train: 'auto' }).tracks[0].model;
  const last = buildSpec({ ...s, cars: 6 }, { train: 'auto' }).tracks[0].model;
  assert.equal(first, 'tram');
  assert.equal(last, 'bullet');
});

test('the sign word and the title follow the language', () => {
  const s = sampleStats({ total: 600, streak: 4 });
  const en = buildSpec(s, {});
  const es = buildSpec(s, { language: 'es' });
  assert.equal(en.tracks[0].label, 'STREAK');
  assert.equal(es.tracks[0].label, 'RACHA');
  assert.equal(buildSpec(s, { language: 'es', label: 'DIAS' }).tracks[0].label, 'DIAS');
  assert.match(en.title, /^octocat's train: \d cars, 4-day streak$/);
  assert.match(es.title, /^Tren de octocat: \d vagones, racha de 4 días$/);
});

test('the signal shows yesterday: red when stopped, green when moving', () => {
  const mk = (state) => renderScene({ tracks: [{ model: 'tram', cars: 1, stripe: '#fff', state }] });
  assert.match(mk('idle'), /#ff4a3d/);
  assert.doesNotMatch(mk('idle'), /#4dff7c/);
  assert.match(mk('normal'), /#4dff7c/);
  assert.doesNotMatch(mk('normal'), /#ff4a3d/);
});

test('the hills only appear on the extra tracks of multi mode', () => {
  const single = renderScene(buildSpec(sampleStats(), { mode: 'single' }));
  const multi = renderScene(buildSpec(sampleStats(), { mode: 'multi' }));
  assert.doesNotMatch(single, /c-haze/);
  assert.match(multi, /c-haze/);
  assert.match(multi, /c-hill2/);
});

test('the clouds drift a full scene width in a loop', () => {
  const svg = renderScene({ tracks: [{ model: 'tram', cars: 1, stripe: '#fff', state: 'idle' }] });
  assert.ok(svg.includes(`.cl{animation:cl 240s steps(${SCENE_W}) infinite}`));
  assert.ok(svg.includes(`to{transform:translateX(-${SCENE_W}px)}`));
});

test('with prefers-reduced-motion the clouds and stars stay still', () => {
  const svg = renderScene({ tracks: [{ model: 'tram', cars: 1, stripe: '#fff', state: 'normal' }] });
  const reduced = svg.slice(svg.indexOf('prefers-reduced-motion'));
  assert.ok(reduced.includes('.cl,.tw{animation:none!important}'));
});
