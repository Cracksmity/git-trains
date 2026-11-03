import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('los ejemplos y las instrucciones para la IA son trenes válidos', () => {
  parseCustomModel(JSON.parse(read('examples/tren-nueva-york.json')));
  const blocks = jsonBlocks(read('docs/ia/tren.md'));
  assert.ok(blocks.length >= 2);
  for (const b of blocks) parseCustomModel(b);
  // El ejemplo grande de las instrucciones es el mismo del archivo de ejemplo.
  assert.deepEqual(blocks[0], JSON.parse(read('examples/tren-nueva-york.json')));
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
  parseSkyline(JSON.parse(read('examples/fondo-cdmx.json')));
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
