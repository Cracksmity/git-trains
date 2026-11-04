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
  assert.fail('se esperaba un error');
};

// --- Trenes -------------------------------------------------------------------

test('cada modelo del catálogo pasa por JSON y se dibuja idéntico', () => {
  for (const id of MODEL_ORDER) {
    const m = parseCustomModel(JSON.parse(JSON.stringify(MODELS[id])));
    for (const cars of [1, 2, 5]) {
      const a = buildTrain(MODELS[id], { cars, streak: 9 });
      const b = buildTrain(m, { cars, streak: 9 });
      for (const k of Object.keys(a.layers)) {
        assert.equal(b.layers[k].cells.join(), a.layers[k].cells.join(), `${id} x${cars} capa ${k}`);
      }
    }
  }
});

test('un tren mínimo solo necesita el color de la caja y una trompa', () => {
  const m = parseCustomModel({ pal: { body: '1A7F37' }, nose: 'metro-blanco' });
  assert.equal(m.pal.body, '#1a7f37');
  assert.match(m.pal.bodyHi, /^#[0-9a-f]{6}$/);
  assert.equal(m.nose.w, MODELS['metro-blanco'].nose.w);
  assert.equal(m.id, 'personalizado');
  assert.ok(trainWidth(m, MAX_CARS) <= SCENE_W);
});

test('una trompa del catálogo se puede repintar y conserva su bogie', () => {
  const m = parseCustomModel({ pal: { body: '#fff' }, nose: { base: 'bala', color: '#c00' } });
  assert.equal(m.nose.color, '#cc0000');
  assert.equal(m.cabBogieOff, MODELS.bala.cabBogieOff);
});

const examples = (prefix) =>
  readdirSync(new URL('../examples/', import.meta.url)).filter((f) => f.startsWith(prefix) && f.endsWith('.json'));

test('los ejemplos y las instrucciones para la IA son trenes válidos', () => {
  assert.ok(examples('tren-').length >= 2);
  for (const f of examples('tren-')) parseCustomModel(JSON.parse(read(`examples/${f}`)));
  const blocks = jsonBlocks(read('docs/ia/tren.md'));
  assert.ok(blocks.length >= 2);
  for (const b of blocks) parseCustomModel(b);
  // Los ejemplos grandes de las instrucciones son los mismos de los archivos de ejemplo.
  assert.deepEqual(blocks[0], JSON.parse(read('examples/tren-nueva-york.json')));
  assert.deepEqual(blocks.find((b) => b.loco), JSON.parse(read('examples/tren-vapor.json')));
});

test('los errores se juntan en una lista para pasársela a la IA', () => {
  const errs = problems(() =>
    parseCustomModel({ pal: { body: 'rojo' }, bands: 'xx', doors: 4, colour: 1, nose: { rows: ['ss'] } }),
  );
  assert.equal(errs.length, 5);
  assert.ok(errs.some((e) => e.includes('"colour"')));
  assert.ok(errs.some((e) => e.startsWith('pal.body')));
  assert.ok(errs.some((e) => e.startsWith('nose.rows')));
});

test('la trompa necesita al menos un faro y la columna de unión ocupada', () => {
  const rows = Array.from({ length: 20 }, () => 'ssss');
  assert.ok(problems(() => parseCustomModel({ pal: { body: '#888' }, nose: { rows } })).some((e) => e.includes('faro')));
  const holed = rows.map((r, y) => (y === 5 ? '.sss' : y === 10 ? 'sssl' : r));
  assert.ok(problems(() => parseCustomModel({ pal: { body: '#888' }, nose: { rows: holed } })).some((e) => e.includes('rows[5]')));
});

test('un tren que no cabe en la escena se rechaza con un mensaje claro', () => {
  const rows = Array.from({ length: 20 }, (_, y) => (y === 10 ? 'l' : 's').repeat(40));
  const errs = problems(() => parseCustomModel({ pal: { body: '#888' }, cabWindows: 30, nose: { rows } }));
  assert.match(errs[0], /mide \d+ px y la escena mide 448/);
});

test('los colores no pueden colar nada en el SVG', () => {
  for (const body of ['#fff" onload="x', 'url(#a)', 'red', '#12345g']) {
    assert.ok(problems(() => parseCustomModel({ pal: { body }, nose: 'bala' })).some((e) => e.startsWith('pal.body')), body);
  }
  assert.ok(problems(() => parseCustomModel({ id: '<script>', pal: { body: '#fff' }, nose: 'bala' })).some((e) => e.startsWith('id')));
});

// --- Locomotora (trenes de vapor) ---------------------------------------------

const vapor = () => JSON.parse(read('examples/tren-vapor.json'));
const locoRows = (w = 20) => Array.from({ length: 30 }, (_, y) => (y >= 5 && y <= 24 ? 'n'.repeat(w) : ''));
const locoTrain = (loco, extra = {}) => ({ pal: { body: '#888' }, loco: { rows: locoRows(), wheels: { drive: [5, 14] }, ...loco }, ...extra });

test('con locomotora: vagones detrás, enganche y la locomotora al frente', () => {
  const m = parseCustomModel(vapor());
  assert.equal(m.nose, undefined);
  assert.equal(m.loco.w, 48);
  for (let cars = 1; cars <= MAX_CARS; cars++) {
    for (const dir of [1, -1]) {
      const t = buildTrain(m, { cars, dir, streak: 12 });
      assert.equal(t.width, cars * 64 + 2 + m.loco.w);
      assert.equal(t.width, trainWidth(m, cars));
      assert.ok(t.led && t.led.x >= 0 && t.led.x + 39 <= t.width, 'el letrero va en el primer vagón');
    }
  }
  assert.ok(trainWidth(m, MAX_CARS) <= SCENE_W);
});

test('con locomotora la cola es plana con luz roja y el faro va solo adelante', () => {
  const m = parseCustomModel(vapor());
  const t = buildTrain(m, { cars: 2 });
  const colorsIn = (x0, x1) => {
    const out = new Set();
    for (let y = 0; y < t.height; y++) for (let x = x0; x < x1; x++) out.add(t.layers.body.get(x, y));
    return out;
  };
  const rear = colorsIn(0, 4);
  const front = colorsIn(t.width - m.loco.w, t.width);
  assert.ok(rear.has('#ff4a4a') && !rear.has('#fff4b0'), 'cola');
  assert.ok(front.has('#fff4b0') && !front.has('#ff4a4a'), 'locomotora');
});

test('la biela y el humo cambian entre fotogramas; sin chimenea no hay humo', () => {
  const m = parseCustomModel(vapor());
  const t = buildTrain(m, { cars: 1 });
  const loco = (g) => {
    const out = [];
    for (let y = 0; y < g.h; y++) for (let x = t.width - m.loco.w; x < t.width; x++) out.push(g.get(x, y));
    return out.join();
  };
  assert.notEqual(loco(t.layers.wa), loco(t.layers.wb));
  assert.ok(!t.layers.pa.isEmpty() && !t.layers.pb.isEmpty());
  assert.notEqual(loco(t.layers.pa), loco(t.layers.pb));
  const sinHumo = vapor();
  delete sinHumo.loco.smoke;
  const t2 = buildTrain(parseCustomModel(sinHumo), { cars: 1 });
  assert.ok(t2.layers.pa.isEmpty() && t2.layers.pb.isEmpty());
  // Los trenes del catálogo no echan humo.
  assert.ok(buildTrain(MODELS.bala, { cars: 2 }).layers.pa.isEmpty());
});

test('la locomotora se valida con mensajes para la IA', () => {
  assert.doesNotThrow(() => parseCustomModel(locoTrain({})));
  const has = (raw, text) => assert.ok(problems(() => parseCustomModel(raw)).some((e) => e.includes(text)), text);
  has(locoTrain({}, { nose: 'bala' }), 'nose: con "loco"');
  has(locoTrain({}, { pant: 'lead' }), 'pant: con "loco"');
  has(locoTrain({}, { articulated: true }), 'articulated');
  has(locoTrain({ rows: locoRows().slice(0, 20) }), 'loco.rows: deben ser 30');
  has(locoTrain({ rows: locoRows(70) }), 'de 16 a 60');
  has(locoTrain({ rows: locoRows().map((r, y) => (y === 9 ? 'nnxn' : r)) }), 'loco.rows[9]: símbolos desconocidos "x"');
  has(locoTrain({ wheels: { drive: [5, 10] } }), 'se enciman');
  has(locoTrain({ wheels: { drive: [2] } }), 'se sale de la locomotora');
  has(locoTrain({ wheels: { drive: [5], d: 8 } }), 'loco.wheels.d');
  has(locoTrain({ wheels: { drive: [] } }), 'loco.wheels.drive');
  has(locoTrain({ wheels: undefined }), 'loco.wheels: falta');
  has(locoTrain({ smoke: 3, rows: locoRows().map((r) => r.replace(/^(...)n/, '$1.')) }), 'loco.smoke: la columna 3 está vacía');
  has(locoTrain({ chimenea: 3 }), 'loco: clave desconocida "chimenea"');
  has({ pal: { body: '#888' } }, 'o usa "loco"');
});

test('un tren con locomotora se dibuja en la escena con humo animado', () => {
  const m = parseCustomModel(vapor());
  for (const state of ['idle', 'slow', 'fast']) {
    const svg = renderScene({ tracks: [{ model: m, cars: 3, stripe: '#f1e05a', streak: 5, state, dir: -1 }] });
    assert.ok(svg.startsWith('<svg') && !/undefined|NaN|null/.test(svg), state);
    assert.match(svg, /class="sm pa0"/);
    assert.match(svg, /\.pa0\{animation:sa [\d.]+s step-end infinite\}/);
    assert.ok(!svg.includes('c-wire'), 'sin catenaria');
  }
  const metro = renderScene({ tracks: [{ model: 'metro-gris', cars: 3, stripe: '#fff', state: 'normal' }] });
  assert.ok(!metro.includes('class="sm'));
});

test('un tren personalizado va en la vía principal; en multi las demás siguen el catálogo', () => {
  const custom = parseCustomModel(JSON.parse(read('examples/tren-nueva-york.json')));
  const single = buildSpec(sampleStats(), { tren: custom });
  assert.equal(single.tracks[0].model, custom);
  const multi = buildSpec(sampleStats(), { tren: custom, modo: 'multi' });
  assert.equal(multi.tracks[0].model, custom);
  assert.ok(multi.tracks.slice(1).every((t) => MODEL_ORDER.includes(t.model)));
  const svg = renderScene(multi);
  assert.ok(svg.startsWith('<svg') && !/undefined|NaN|null/.test(svg));
});

// --- Fondos -------------------------------------------------------------------

const countCity = (g, x0, x1, y1) => {
  let n = 0;
  for (let y = 0; y < y1; y++) {
    for (let x = x0; x < x1; x++) if (['@city', '@city2', '@cityWin'].includes(g.get(x, y))) n++;
  }
  return n;
};
const tracks = [{ model: 'tranvia', state: 'idle', dir: 1, overhead: false }];

test('"ciudad" o vacío es la ciudad aleatoria de siempre', () => {
  for (const v of [undefined, null, '', 'ciudad']) assert.equal(parseSkyline(v), null);
  const base = renderScene({ tracks: [{ model: 'bala', cars: 3, stripe: '#fff', state: 'idle' }] });
  assert.equal(renderScene({ skyline: null, tracks: [{ model: 'bala', cars: 3, stripe: '#fff', state: 'idle' }] }), base);
});

test('los fondos incluidos, los ejemplos y las instrucciones son válidos', () => {
  for (const id of Object.keys(SKYLINES)) assert.ok(parseSkyline(id).buildings.length > 0, id);
  for (const f of examples('fondo-')) parseSkyline(JSON.parse(read(`examples/${f}`)));
  const blocks = jsonBlocks(read('docs/ia/fondo.md'));
  assert.ok(blocks.some((b) => b.buildings));
  for (const b of blocks) parseSkyline(b.buildings ? b : { buildings: [b] });
});

test('un fondo cambia la ciudad pero no el resto del decorado', () => {
  const H = sceneHeight(1);
  const plain = paintBackdrop(SCENE_W, H, tracks, 'octocat');
  const ny = paintBackdrop(SCENE_W, H, tracks, 'octocat', parseSkyline('nueva-york'));
  // Del talud para abajo (arbustos, balasto, semáforo) todo queda igual.
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

test('sin relleno solo se dibujan los edificios del fondo; con relleno, no se les encima', () => {
  const H = sceneHeight(1);
  const sky = (fill) => parseSkyline({ fill, buildings: [{ x: 200, w: 10, h: 50, windows: false }] });
  const solo = paintBackdrop(SCENE_W, H, tracks, '', sky(false));
  assert.equal(countCity(solo, 0, SCENE_W, GY0 - 10), 10 * 40);
  const filled = paintBackdrop(SCENE_W, H, tracks, '', sky(true));
  assert.ok(countCity(filled, 0, SCENE_W, GY0 - 10) > 10 * 40);
  assert.equal(countCity(filled, 198, 212, GY0 - 10), 10 * 40);
});

test('los remates se apilan y los dibujos usan la fila del suelo', () => {
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

test('los errores del fondo también se juntan', () => {
  const errs = problems(() =>
    parseSkyline({
      buildings: [
        { x: 10, w: 0, h: 99 },
        { x: 20, w: 5, h: 5, top: 'torre' },
        { x: 30, rows: ['#x#'], w: 3 },
        { x: 40, w: 5, h: 5, layer: 'medio' },
      ],
    }),
  );
  assert.ok(errs.length >= 5, errs.join('\n'));
  assert.ok(errs.some((e) => e.includes('remate desconocido "torre"')));
  assert.ok(errs.some((e) => e.includes('símbolos desconocidos "x"')));
  assert.ok(problems(() => parseSkyline('paris'))[0].includes('nueva-york'));
});
