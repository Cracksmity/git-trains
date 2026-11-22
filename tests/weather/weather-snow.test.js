import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpec } from '../../src/scene/spec.js';
import { renderScene } from '../../src/scene/render.js';
import { weatherArt, weatherBands } from '../../src/scene/weather.js';
import { paintBackdrop } from '../../src/scene/backdrop.js';
import { parseSkyline } from '../../src/landscape/skyline-parse.js';
import { sampleStats } from '../../src/demo/sample.js';
import { SCENE_W } from '../../src/scene/layout.js';
import { rasterScene, renderFrame } from '../../tools/export/raster.js';

const jalisco = parseSkyline('jalisco');
const spec = (opts = {}) => buildSpec(sampleStats(), { train: 'jalisco', skyline: jalisco, mode: 'multi', theme: 'auto', ...opts });
const svg = (opts) => renderScene(spec(opts));

function sceneContext(scene) {
  const tracks = scene.tracks.map((t) => ({ ...t, overhead: false }));
  const H = 204;
  return { W: SCENE_W, H, tracks, skyline: scene.skyline, backdrop: paintBackdrop(SCENE_W, H, tracks, scene.user, scene.skyline) };
}

test('snow uses the cloudy sky without rain or lightning, and clips slow drifting flakes per place', () => {
  const weather = ['snow', 'snow', 'snow'];
  const out = svg({ weather });
  assert.ok(out.includes('--wCloudy0:') && out.includes('--wCloudyCloud:'), 'uses cloudy sky and cloud inks');
  assert.ok(!out.includes('--wRain0:') && !out.includes('--wDimRain:'), 'no rain sky or dimming veil');
  assert.ok(!out.includes('w-flash') && !out.includes('--wDrop:'), 'no lightning or rain streaks');
  assert.match(out, /@keyframes w-flutter\{0%,100%\{transform:translateX\(0\)\}50%\{transform:translateX\(1px\)\}\}/);

  const reduced = out.match(/@media \(prefers-reduced-motion:reduce\)\{([^{}]*\.w-fall[^{}]*)\{animation:none!important\}\}/);
  assert.ok(reduced, 'weather animations have a reduced-motion rule');
  const stopped = new Set(reduced[1].split(','));
  for (const [, cls] of out.matchAll(/\.(w-[\w-]+)\{[^{}]*animation:/g)) {
    assert.ok(stopped.has(`.${cls}`), `.${cls} stops for prefers-reduced-motion`);
  }

  const bands = weatherBands(3);
  const context = sceneContext(spec({ weather }));
  const snowArt = weatherArt(weather, context);
  const rainArt = weatherArt(['rain', 'rain', 'rain'], context);
  const snowFall = snowArt.filter((l) => l.fall);
  const rainFall = rainArt.filter((l) => l.fall);
  assert.equal(snowFall.length, 6, 'two snow layers per place');

  snowFall.forEach((layer, i) => {
    const band = bands[Math.floor(i / 2)];
    assert.deepEqual(layer.clip, [band.top, band.bottom], `layer ${i} clips to place ${band.k}`);
    assert.ok(layer.fall.flutter > 0, `layer ${i} drifts horizontally`);
    assert.ok(layer.fall.dur > rainFall[i].fall.dur, `layer ${i} falls slower than rain`);
    const { h } = layer.fall;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < layer.grid.w; x++) {
        assert.equal(layer.grid.get(x, y), layer.grid.get(x, y + h), 'seamless vertical loop');
      }
    }
  });
});

test('snow rests statically on Guadalajara landmarks, Los Altos roofs and parcels, and Tequila volcano and agave', () => {
  const weather = ['snow', 'snow', 'snow'];
  const context = sceneContext(spec({ weather }));
  const layers = weatherArt(weather, context);
  const settled = layers.filter((l) => l.z === 'ground' && !l.fall && l.y === 0);
  assert.equal(settled.length, 3, 'one static resting snow layer per place');
  for (const layer of settled) assert.ok(!layer.drift && !layer.blink, 'resting snow does not move');

  const bands = weatherBands(3);
  const { backdrop } = context;
  const isSnow = (ink) => ink === '@wSnow' || ink === '@wSnowShade';
  const pixelsOf = (grid) => grid.cells.flatMap((ink, i) => (isSnow(ink) ? [[i % grid.w, Math.floor(i / grid.w), ink]] : []));

  // Guadalajara: Cathedral spires and roofs, stadium roof, and plaza row.
  const gdl = pixelsOf(settled[0].grid);
  assert.ok(gdl.some(([x, y]) => x >= 94 && x <= 102 && y >= 13 && y <= 43), 'Cathedral left spire');
  assert.ok(gdl.some(([x, y]) => x >= 142 && x <= 150 && y >= 13 && y <= 43), 'Cathedral right spire');
  assert.ok(gdl.some(([x, y]) => x >= 105 && x <= 139 && y >= 47 && y <= 65), 'Cathedral roofs and gable');
  assert.ok(gdl.some(([x, y]) => x >= 25 && x <= 84 && backdrop.get(x, y + 1) === '@roofWhite'), 'stadium roof');
  assert.ok(gdl.filter(([, y]) => y === bands[0].base - 1).length > context.W * 0.7, 'plaza row blanketed');

  // Los Altos: ranch and church roofs, top of dry-stone wall, and red parcels showing through in patches.
  const altos = settled[1].grid;
  const altosPx = pixelsOf(altos);
  assert.ok(altosPx.some(([x, y]) => x >= 22 && x <= 47 && (backdrop.get(x, y) === '@tile' || backdrop.get(x, y + 1) === '@tile')), 'ranch roof');
  assert.ok(altosPx.some(([x, y]) => x >= 273 && x <= 307 && y >= 104 && y <= 120), 'parish church roofs');
  let wallSnow = 0;
  let parcelTotal = 0;
  let parcelCovered = 0;
  for (let x = 0; x < context.W; x++) {
    const wallTop = bands[1].base - 6 - Math.round(1.4 * Math.sin(x / 44));
    if (isSnow(altos.get(x, wallTop - 1)) || isSnow(altos.get(x, wallTop))) wallSnow++;
    for (let y = bands[1].top; y < wallTop; y++) {
      const under = backdrop.get(x, y);
      if (under !== '@earth' && under !== '@earthLit') continue;
      parcelTotal++;
      if (isSnow(altos.get(x, y))) parcelCovered++;
    }
  }
  assert.ok(wallSnow > context.W * 0.7, 'dry-stone wall top');
  const share = parcelCovered / parcelTotal;
  assert.ok(share > 0.2 && share < 0.75, `red parcels show through in patches (covered ${(share * 100).toFixed(0)}%)`);

  // Tequila: upper slopes of the volcano turn white while lower slopes stay dark, and agave tips catch a little.
  const tequila = settled[2].grid;
  const peak = bands[2].base - 38;
  const horizon = bands[2].base - 22;
  let upperSnow = 0;
  let lowerDark = 0;
  for (let x = 90; x <= 175; x++) {
    for (let y = peak; y < horizon; y++) {
      const under = backdrop.get(x, y);
      if (!['@ridgeShade', '@ridge', '@rimLit', '@rimShade'].includes(under)) continue;
      if (y <= peak + 7 && isSnow(tequila.get(x, y))) upperSnow++;
      if (y >= horizon - 3 && !isSnow(tequila.get(x, y))) lowerDark++;
    }
  }
  assert.ok(upperSnow > 80, 'upper slopes of the volcano turn white');
  assert.ok(lowerDark > 80, 'lower volcano slopes remain dark');
  const agaveSnow = pixelsOf(tequila).filter(([x, y]) => backdrop.get(x, y) === '@agaveLit');
  assert.ok(agaveSnow.length > 40, 'agave tips catch snow');
});

test('snow stays distinct from hail and frost in both raster themes', () => {
  for (const theme of ['light', 'dark']) {
    const frameOf = (state) => renderFrame({ ...rasterScene(spec({ weather: [state, state, state], theme }), theme), trains: [] }, 0).px;
    const snow = frameOf('snow');
    assert.notDeepEqual(snow, frameOf('hail'), `${theme}: distinct from hail`);
    assert.notDeepEqual(snow, frameOf('frost'), `${theme}: distinct from frost`);
  }
});
