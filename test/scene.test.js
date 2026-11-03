import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrain, trainWidth, LED_W } from '../src/train.js';
import { MODELS, MODEL_ORDER } from '../src/models.js';
import { renderScene, STATES, SCENE_W } from '../src/scene.js';
import { buildSpec } from '../src/compose.js';
import { sampleStats } from '../src/sample.js';

test('todos los modelos se construyen con 1 a 6 vagones y ambos sentidos', () => {
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

test('el tren más largo cabe en la escena', () => {
  for (const id of MODEL_ORDER) assert.ok(trainWidth(MODELS[id], 6) <= SCENE_W, id);
});

test('el texto del letrero no se espeja al ir hacia la izquierda', () => {
  const model = MODELS['metro-naranja'];
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
  // Espejado, el letrero queda en la posición simétrica.
  assert.equal(left.led.x, left.width - right.led.x - LED_W);
  assert.equal(crop(left, left.led.x), crop(right, right.led.x));
});

test('cada tren tiene cabina en ambos extremos: faros adelante, luces rojas atrás', () => {
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
    assert.ok(rear.has(TAIL) && !rear.has(HEAD), `${id}: cola`);
    assert.ok(front.has(HEAD) && !front.has(TAIL), `${id}: cabeza`);
  }
});

test('el tranvía articulado comparte un bogie en cada par de coches', () => {
  // Cada bogie deja 6 marcas de disco (3 por rueda) en la capa wa.
  const bogies = (id, cars) => buildTrain(MODELS[id], { cars }).layers.wa.cells.filter(Boolean).length / 6;
  assert.equal(bogies('tranvia', 1), 2);
  assert.equal(bogies('tranvia', 2), 3);
  assert.equal(bogies('tranvia', 3), 5);
  assert.equal(bogies('tranvia', 4), 6);
  assert.equal(bogies('metro-naranja', 2), 4);
});

test('la catenaria solo aparece sobre trenes con pantógrafo', () => {
  const mk = (model) => renderScene({ tracks: [{ model, cars: 2, stripe: '#fff', state: 'idle' }] });
  for (const id of MODEL_ORDER) {
    const overhead = !!MODELS[id].pant;
    assert.equal(/class="c-wire"/.test(mk(id)), overhead, id);
    assert.equal(buildTrain(MODELS[id], { cars: 2 }).hasPantograph, overhead, id);
  }
});

test('el nombre anterior "suburbano" sigue funcionando', () => {
  assert.equal(buildSpec(sampleStats(), { tren: 'suburbano' }).tracks[0].model, 'metro-blanco');
});

test('las ventanas iluminadas crecen con la racha', () => {
  const count = (streak) =>
    buildTrain(MODELS.tranvia, { cars: 3, streak }).layers.lit.cells.filter(Boolean).length;
  assert.equal(count(0), 0);
  assert.ok(count(5) > 0);
  assert.ok(count(30) > count(5));
  assert.equal(count(30), count(90));
});

test('renderScene produce un SVG bien formado para cada estado y tema', () => {
  for (const state of Object.keys(STATES)) {
    for (const theme of ['light', 'dark', 'auto']) {
      const svg = renderScene({
        theme,
        user: 'octocat',
        tracks: [{ model: 'bala', cars: 4, stripe: '#3178c6', streak: 12, state, caption: 'TYPESCRIPT - 12' }],
      });
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
      assert.equal((svg.match(/<g[ >]/g) ?? []).length, (svg.match(/<\/g>/g) ?? []).length);
      assert.ok(!/undefined|NaN|null/.test(svg), `${state}/${theme} contiene valores inválidos`);
    }
  }
});

test('el tema automático incluye prefers-color-scheme y los fijos no', () => {
  const spec = { user: 'x', tracks: [{ model: 'tranvia', cars: 1, stripe: '#fff', state: 'idle' }] };
  assert.match(renderScene({ ...spec, theme: 'auto' }), /prefers-color-scheme:dark/);
  assert.doesNotMatch(renderScene({ ...spec, theme: 'light' }), /prefers-color-scheme:dark/);
});

test('los trenes en movimiento avanzan de píxel en píxel', () => {
  const svg = renderScene({ tracks: [{ model: 'metro-naranja', cars: 2, stripe: '#fff', state: 'normal' }] });
  const w = trainWidth(MODELS['metro-naranja'], 2);
  assert.match(svg, new RegExp(`steps\\(${SCENE_W + w}\\)`));
});

test('las chispas y líneas de velocidad solo aparecen a máxima velocidad', () => {
  const mk = (state) =>
    renderScene({ tracks: [{ model: 'bala', cars: 3, stripe: '#fff', state }] });
  assert.match(mk('fast'), /class="sp sa0"/);
  assert.doesNotMatch(mk('normal'), /class="sp sa0"/);
  assert.match(mk('fast'), /c-speed/);
  assert.doesNotMatch(mk('slow'), /c-speed/);
});

test('el modo multi crea 3 vías con modelos distintos y sentidos alternos', () => {
  const spec = buildSpec(sampleStats(), { modo: 'multi' });
  assert.equal(spec.tracks.length, 3);
  assert.equal(new Set(spec.tracks.map((t) => t.model)).size, 3);
  assert.deepEqual(spec.tracks.map((t) => t.dir), [1, -1, 1]);
  assert.ok(spec.tracks.every((t) => t.cars >= 1 && t.cars <= spec.tracks[0].cars));
  assert.doesNotThrow(() => renderScene(spec));
});

test('un modelo desconocido da un error claro', () => {
  assert.throws(() => buildSpec(sampleStats(), { tren: 'volador' }), /Modelo de tren desconocido/);
});

test('tren auto evoluciona con los vagones', () => {
  const s = sampleStats();
  const first = buildSpec({ ...s, cars: 1 }, { tren: 'auto' }).tracks[0].model;
  const last = buildSpec({ ...s, cars: 6 }, { tren: 'auto' }).tracks[0].model;
  assert.equal(first, 'tranvia');
  assert.equal(last, 'bala');
});

test('el semáforo refleja la actividad de ayer: rojo parado, verde en marcha', () => {
  const mk = (state) => renderScene({ tracks: [{ model: 'tranvia', cars: 1, stripe: '#fff', state }] });
  assert.match(mk('idle'), /#ff4a3d/);
  assert.doesNotMatch(mk('idle'), /#4dff7c/);
  assert.match(mk('normal'), /#4dff7c/);
  assert.doesNotMatch(mk('normal'), /#ff4a3d/);
});

test('el paisaje de colinas solo aparece en las vías extra del modo multi', () => {
  const single = renderScene(buildSpec(sampleStats(), { modo: 'single' }));
  const multi = renderScene(buildSpec(sampleStats(), { modo: 'multi' }));
  assert.doesNotMatch(single, /c-haze/);
  assert.match(multi, /c-haze/);
  assert.match(multi, /c-hill2/);
});

test('las nubes avanzan un periodo completo de la escena en bucle', () => {
  const svg = renderScene({ tracks: [{ model: 'tranvia', cars: 1, stripe: '#fff', state: 'idle' }] });
  assert.ok(svg.includes(`.cl{animation:cl 240s steps(${SCENE_W}) infinite}`));
  assert.ok(svg.includes(`to{transform:translateX(-${SCENE_W}px)}`));
});

test('con prefers-reduced-motion las nubes y estrellas se quedan quietas', () => {
  const svg = renderScene({ tracks: [{ model: 'tranvia', cars: 1, stripe: '#fff', state: 'normal' }] });
  const reduced = svg.slice(svg.indexOf('prefers-reduced-motion'));
  assert.ok(reduced.includes('.cl,.tw{animation:none!important}'));
});
