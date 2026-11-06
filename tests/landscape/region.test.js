import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSkyline } from '../../src/landscape/skyline-parse.js';
import { SCENE_W, GY0, PITCH, BALLAST, sceneHeight } from '../../src/scene/layout.js';
import { THEMES } from '../../src/scene/themes.js';
import { paintBackdrop } from '../../src/scene/backdrop.js';
import { renderScene } from '../../src/scene/render.js';
import { buildSpec } from '../../src/scene/spec.js';
import { sampleStats } from '../../src/demo/sample.js';

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
const problems = (fn) => {
  try {
    fn();
  } catch (err) {
    return err.errors ?? [err.message];
  }
  assert.fail('expected the validator to complain');
};

// Each drawing uses an accent no other one does, so the tests can tell them apart.
const REGION = {
  terrain: 'mountains',
  accents: [
    { name: 'house', light: '#aa5533', dark: '#552211' },
    { name: 'tree', light: '#33aa55', dark: '#115522' },
    { name: 'plant', light: '#cc33cc', dark: '#661166' },
    { name: 'landmark', light: '#3355dd', dark: '#112266' },
  ],
  houses: [{ name: 'house', rows: ['..111..', '.11111.', '1#w#w#1', '1#####1', '1##t###'] }],
  trees: [{ name: 'tree', rows: ['..222..', '.22222.', '2222222', '...t...', '...t...'] }],
  plants: [{ name: 'plant', rows: ['.333.', '33333', '33333'] }],
  landmark: { name: 'landmark', rows: ['444444', '4....4', '4....4', '4....4'] },
};
const base = { fill: false, buildings: [{ x: 200, w: 10, h: 50 }] };
const withRegion = (region) => ({ ...base, region });
const tracks = (n) => Array.from({ length: n }, (_, k) => ({ model: 'tram', state: 'idle', dir: k % 2 ? -1 : 1, overhead: false }));
const count = (g, color, y0 = 0, y1 = g.h) => {
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) === color) n++;
  return n;
};

// --- The validator ---------------------------------------------------------------

test('a skyline without region parses exactly as before', () => {
  const sky = parseSkyline(base);
  assert.equal('region' in sky, false);
  assert.deepEqual(Object.keys(sky), ['name', 'fill', 'buildings']);
});

test('a region is validated and normalized; parsing the result again gives the same region', () => {
  const sky = parseSkyline(withRegion(REGION));
  assert.equal(sky.region.terrain, 'mountains');
  assert.deepEqual(sky.region.accents[0], { light: '#aa5533', dark: '#552211' });
  assert.equal(sky.region.landmark.place, 'village');
  assert.deepEqual(parseSkyline(sky).region, sky.region);
  // Short colors and rows of different lengths are accepted and normalized.
  const loose = parseSkyline(withRegion({ accents: [{ light: 'a53', dark: '#521' }], houses: [{ rows: ['11', '1'] }] }));
  assert.deepEqual(loose.region.accents[0], { light: '#aa5533', dark: '#552211' });
  assert.deepEqual(loose.region.houses[0].rows, ['11', '1.']);
  assert.equal(loose.region.terrain, 'hills');
});

test('notes are accepted anywhere in the region', () => {
  parseSkyline(withRegion({ ...REGION, name: 'Somewhere', source: 'a book', description: 'x', _todo: 1 }));
});

test('region problems are collected together, with messages for an AI', () => {
  const errs = problems(() =>
    parseSkyline(
      withRegion({
        terrain: 'desert',
        accents: [{ light: 'red', dark: '#12' }, { light: '#fff', dark: '#000' }, 5],
        houses: [
          { rows: ['..x..', '..1..', '..4..'] },
          { rows: ['#'.repeat(30)] },
          { rows: ['....'] },
          { rows: ['##', '..'] },
        ],
        trees: [],
        plants: Array(5).fill({ rows: ['l'] }),
        landmark: { rows: ['#'], place: 'sky' },
        house: [],
      }),
    ),
  );
  const text = errs.join('\n');
  for (const part of [
    'region.terrain: one of hills, mountains, sea, plains',
    'region.accents[0].light: a hex color',
    'region.accents[0].dark: a hex color',
    'region.accents[2]: must be an object',
    'region.houses[0].rows[0]: unknown symbols "x"',
    'region.houses[0].rows: uses accent 4, but only 3 accents are defined',
    'region.houses[1].rows: at most 24 columns and 16 rows for houses (this one is 30 x 1)',
    'region.houses[2].rows: the drawing is empty',
    'region.houses[3].rows: the last row is the ground and has no pixels',
    'region.trees: a list of 1 to 6 drawings',
    'region.plants: a list of 1 to 4 drawings',
    'region.landmark.place: "village"',
    'region: unknown key "house"',
  ]) {
    assert.ok(text.includes(part), `${part}\n---\n${text}`);
  }
  assert.ok(errs.length >= 13, errs.join('\n'));
  assert.ok(problems(() => parseSkyline(withRegion({ houses: [{ name: 'no rows' }] })))[0].includes('region.houses[0].rows: a list of strings'));
});

test('a drawing cannot use an accent that was not defined', () => {
  assert.ok(problems(() => parseSkyline(withRegion({ houses: [{ rows: ['#1#'] }] })))[0].includes('no accents are defined'));
  assert.ok(problems(() => parseSkyline(withRegion({ accents: [{ light: '#fff', dark: '#000' }], houses: [{ rows: ['#2#'] }] })))[0].includes('uses accent 2, but only 1 accent is defined'));
});

test('the region must be an object, and skyline problems are listed with it', () => {
  assert.ok(problems(() => parseSkyline({ buildings: [{ x: 1, w: 5, h: 5 }], region: 'japan' }))[0].includes('region: must be an object'));
  const errs = problems(() => parseSkyline({ buildings: [{ x: 1, w: 0, h: 5 }], region: { terrain: 'x' } }));
  assert.ok(errs.some((e) => e.startsWith('buildings[0].w')) && errs.some((e) => e.startsWith('region.terrain')));
});

// --- No region: today's scenery -------------------------------------------------------

const plainRegion = (n) => ({ ...parseSkyline(base), region: n });

test('an empty region and no region draw exactly the same scene', () => {
  const stats = sampleStats();
  for (const mode of ['single', 'multi']) {
    const none = renderScene(buildSpec(stats, { mode, skyline: parseSkyline(base) }));
    const empty = renderScene(buildSpec(stats, { mode, skyline: parseSkyline(withRegion({})) }));
    assert.equal(empty, none, mode);
    assert.equal(renderScene(buildSpec(stats, { mode, skyline: plainRegion({ terrain: 'hills' }) })), none, mode);
  }
});

test('a region leaves no trace in the scenes drawn after it', () => {
  const stats = sampleStats();
  const render = (skyline) => renderScene(buildSpec(stats, { mode: 'multi', skyline }));
  const before = render(parseSkyline(base));
  const withIt = render(parseSkyline(withRegion({ ...REGION, terrain: 'sea' })));
  assert.match(withIt, /--accent1:/);
  assert.match(withIt, /--sea:/);
  assert.equal(render(parseSkyline(base)), before);
  assert.doesNotMatch(before, /--accent|--sea/);
  assert.equal(Object.keys(THEMES.light).some((k) => k.startsWith('accent') || k === 'sea'), false);
});

test('without a region the countryside has not changed (the usual houses, pines and round trees)', () => {
  const H = sceneHeight(3);
  const g = paintBackdrop(SCENE_W, H, tracks(3), 'octocat', parseSkyline(base));
  assert.ok(count(g, '@houseRoof', GY0 + 1, H) > 0);
  assert.ok(count(g, '@tree', GY0 + 1, H) > 0);
  assert.equal(count(g, '@accent1'), 0);
  assert.equal(count(g, '@sea'), 0);
});

// --- With a region ------------------------------------------------------------------------

test('the region draws its houses, trees, plants and landmark instead of the usual ones', () => {
  const H = sceneHeight(3);
  const g = paintBackdrop(SCENE_W, H, tracks(3), 'octocat', parseSkyline(withRegion(REGION)));
  const band = (k) => [GY0 + PITCH * k - PITCH + BALLAST, GY0 + PITCH * k];
  const [v0, v1] = band(1);
  const [f0, f1] = band(2);
  assert.ok(count(g, '@accent1', v0, v1) > 0, 'houses in the village strip');
  assert.equal(count(g, '@houseRoof', v0, v1), 0, 'no usual houses in the strip');
  assert.ok(count(g, '@accent2', v0, v1) > 0, 'trees in the village strip');
  assert.ok(count(g, '@accent2', f0, f1) > 0, 'trees in the forest strip');
  assert.equal(count(g, '@accent1', f0, f1), 0, 'no houses in the forest strip');
  assert.ok(count(g, '@accent3', 0, GY0) > 0, 'plants on the slope in front of the city');
  assert.ok(count(g, '@accent3', v0, v1) > 0, 'plants between the houses');
  assert.ok(count(g, '@accent4', v0, v1) >= 6, 'the landmark stands in the village strip');
  assert.equal(count(g, '@accent4', f0, f1), 0, 'and not in the forest strip');
  assert.equal(count(g, '@tree', v0, v1), 0, 'no usual trees in the strip');
});

test('only the countryside changes: the city, the ballast and the signals stay where they were', () => {
  const H = sceneHeight(3);
  const plain = paintBackdrop(SCENE_W, H, tracks(3), 'octocat', parseSkyline(base));
  const withIt = paintBackdrop(SCENE_W, H, tracks(3), 'octocat', parseSkyline(withRegion(REGION)));
  const same = (y) => {
    for (let x = 0; x < SCENE_W; x++) assert.equal(withIt.get(x, y), plain.get(x, y), `(${x}, ${y})`);
  };
  for (let y = 0; y < GY0 - 14; y++) same(y); // the city and the sign (plants stand below this)
  tracks(3).forEach((_, k) => {
    for (let y = GY0 + PITCH * k; y < GY0 + PITCH * k + BALLAST; y++) same(y); // ballast and legends
  });
});

test('the region is deterministic and each user gets their own layout', () => {
  const H = sceneHeight(3);
  const sky = parseSkyline(withRegion(REGION));
  const draw = (user) => paintBackdrop(SCENE_W, H, tracks(3), user, sky).cells.join();
  assert.equal(draw('octocat'), draw('Octocat'));
  assert.notEqual(draw('octocat'), draw('monalisa'));
});

test('a far landmark stands behind the nearest hill, a village one in front of it', () => {
  const H = sceneHeight(2);
  const lm = { name: 'x', rows: ['4444444444', '4444444444', '4444444444', '4444444444', '4444444444', '4444444444', '4444444444', '4444444444', '4444444444', '4444444444'] };
  const draw = (place) => paintBackdrop(SCENE_W, H, tracks(2), 'octocat', parseSkyline(withRegion({ ...REGION, landmark: { ...lm, place } })));
  const [v0, v1] = [GY0 + PITCH - PITCH + BALLAST, GY0 + PITCH];
  const village = count(draw('village'), '@accent4', v0, v1);
  const far = count(draw('far'), '@accent4', v0, v1);
  assert.equal(village, 100);
  assert.ok(far > 0 && far < village, `${far} of ${village} pixels show`);
});

test('every terrain draws, and only the sea adds its own color', () => {
  const stats = sampleStats();
  for (const terrain of ['hills', 'mountains', 'plains', 'sea']) {
    const svg = renderScene(buildSpec(stats, { mode: 'multi', skyline: parseSkyline(withRegion({ ...REGION, terrain })) }));
    assert.ok(svg.startsWith('<svg') && !/undefined|NaN|null/.test(svg), terrain);
    assert.equal(svg.includes('--sea:'), terrain === 'sea', terrain);
  }
  const g = (terrain) => paintBackdrop(SCENE_W, sceneHeight(2), tracks(2), 'octocat', parseSkyline(withRegion({ terrain })));
  assert.ok(count(g('mountains'), '@city2', GY0 + 1, sceneHeight(2)) > 0);
  assert.ok(count(g('mountains'), '@cloud', GY0 + 1, sceneHeight(2)) > 0, 'snow on the peaks');
  assert.ok(count(g('sea'), '@sea') > 0);
  assert.ok(count(g('plains'), '@haze') > 0);
});

test('the light and the dark theme each get the accent they were given', () => {
  const svg = renderScene(buildSpec(sampleStats(), { mode: 'multi', theme: 'auto', skyline: parseSkyline(withRegion(REGION)) }));
  const root = svg.match(/<style>:root\{(.*?)\}@media \(prefers-color-scheme:dark\)\{:root\{(.*?)\}\}/);
  assert.ok(root[1].includes('--accent1:#aa5533') && root[2].includes('--accent1:#552211'));
  assert.ok(svg.includes('.c-accent1{fill:var(--accent1)}'));
});

// --- The built-in skylines, the examples and the guide ---------------------------------

test('the region guide has a complete example that passes the validator and keeps its promises', () => {
  const guide = read('docs/ai/region.md');
  const blocks = [...guide.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]));
  const full = blocks.filter((b) => b.buildings);
  assert.ok(full.length >= 1);
  for (const b of full) {
    const sky = parseSkyline(b);
    const r = sky.region;
    assert.ok(r.houses.length && r.trees.length && r.plants.length && r.landmark && r.accents.length, 'the example uses every part');
  }
  // What the guide says about sizes and symbols matches the program.
  for (const [what, text] of [['up to 24 columns by 16 rows', 'houses'], ['up to 20 by 22', 'trees'], ['up to 16 by 12', 'plants'], ['up to 32 by 28', 'landmark']]) {
    assert.ok(guide.includes(what), `${text}: ${what}`);
  }
});
