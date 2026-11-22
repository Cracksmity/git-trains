import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpec } from '../../src/scene/spec.js';
import { renderScene } from '../../src/scene/render.js';
import { weatherArt, weatherBands, FLASH } from '../../src/scene/weather.js';
import { paintBackdrop } from '../../src/scene/backdrop.js';
import { celestialGrid } from '../../src/scene/sky.js';
import { parseSkyline } from '../../src/landscape/skyline-parse.js';
import { sampleStats } from '../../src/demo/sample.js';
import { WEATHER_THEMES } from '../../src/weather/inks.js';
import { WEATHER_STATES } from '../../src/weather/conditions.js';
import { SCENE_W } from '../../src/scene/layout.js';
import { rasterScene, renderFrame } from '../../tools/export/raster.js';

const jalisco = parseSkyline('jalisco');
const WINTER = '2026-01-20';
const MUERTOS = '2026-11-01';
const spec = (opts = {}) => buildSpec(sampleStats(), { train: 'jalisco', skyline: jalisco, mode: 'multi', theme: 'auto', ...opts });
const svg = (opts) => renderScene(spec(opts));

test('without weather, or on a skyline without places, the scene is exactly as before', () => {
  assert.equal(svg({ weather: null }), svg({}));
  assert.equal(spec({ weather: [null, null, null] }).weather, undefined);
  const osaka = (weather) => renderScene(buildSpec(sampleStats(), { skyline: parseSkyline('osaka'), mode: 'multi', date: WINTER, weather }));
  assert.equal(osaka(['storm', 'storm', 'storm']), osaka(null));
  assert.ok(osaka(['rain', 'rain', 'rain']).includes('d-snowcap'), 'other scenes keep their seasons');
});

test('every state renders a well-formed scene whose weather inks exist in both themes', () => {
  for (const state of WEATHER_STATES) {
    for (const theme of ['light', 'dark', 'auto']) {
      const out = svg({ weather: [state, state, state], theme });
      assert.match(out, /^<svg [^>]+>[\s\S]*<\/svg>$/);
      const opened = (out.match(/<g\b/g) ?? []).length;
      assert.equal(opened, (out.match(/<\/g>/g) ?? []).length, `${state}/${theme}: balanced groups`);
      for (const [, ink] of out.matchAll(/class="c-(w[A-Z][A-Za-z0-9]*)"/g)) {
        assert.ok(out.includes(`--${ink}:`), `${state}/${theme}: ${ink} has a color`);
        assert.ok(WEATHER_THEMES.light[ink] && WEATHER_THEMES.dark[ink], `${ink} is defined in both themes`);
      }
    }
  }
  assert.equal(/c-w[A-Z]/.test(svg({ weather: ["clear", "clear", "clear"] })), false, 'clear adds no weather art');
});

test('the same weather always paints the same pixels', () => {
  const weather = ['storm', 'rain', 'cloudy'];
  assert.equal(svg({ weather }), svg({ weather }));
});

test('rain falls only inside its own place, in seamless loops that stop for reduced motion', () => {
  const out = svg({ weather: ['clear', 'rain', 'clear'] });
  const band = weatherBands(3)[1];
  const clips = [...out.matchAll(/<clipPath id="(w-clip\d+)"><rect y="(\d+)" width="\d+" height="(\d+)"\/>/g)];
  assert.equal(clips.length, 2, 'a far and a near layer');
  for (const [, , y, h] of clips) assert.deepEqual([+y, +h], [band.top, band.bottom - band.top]);
  assert.match(out, /@keyframes w-fall\d+\{from\{transform:translateY\(-52px\)\}to\{transform:translateY\(0\)\}\}/);
  assert.match(out, /prefers-reduced-motion:reduce\)\{\.w-fall\d+,\.w-fall\d+\{animation:none!important\}/);

  const scene = spec({ weather: ['storm', 'rain', 'storm'] });
  const art = weatherArt(scene.weather, sceneContext(scene));
  for (const layer of art.filter((l) => l.fall)) {
    const { h } = layer.fall;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < layer.grid.w; x++) assert.equal(layer.grid.get(x, y), layer.grid.get(x, y + h), 'both periods match');
    }
  }
  for (const layer of art.filter((l) => l.drift)) {
    for (let y = 0; y < layer.grid.h; y++) {
      for (let x = 0; x < SCENE_W; x++) assert.equal(layer.grid.get(x, y), layer.grid.get(x + SCENE_W, y), 'the ceiling loops');
    }
  }
});

test('lightning flashes twice per cycle, hides for reduced motion and is lit in frame 0 over Guadalajara', () => {
  const out = svg({ weather: ['storm', 'storm', 'storm'] });
  assert.equal((out.match(/class="w-flash\d+"/g) ?? []).length, 3);
  assert.match(out, /@keyframes w-flash\{0%\{opacity:0\}2%\{opacity:1\}3\.5%\{opacity:0\}6%\{opacity:1\}7\.5%\{opacity:0\}\}/);
  assert.match(out, /\.w-flash\d+\{opacity:0;animation:w-flash 9s step-end -0\.225s infinite\}/);
  assert.ok(FLASH.keys.filter(([, v]) => v === 1).length / FLASH.period < 3, 'under three flashes a second');

  const scene = rasterScene(spec({ weather: ['storm', 'clear', 'clear'] }), 'light');
  const at = (t, x, y) => {
    const frame = renderFrame({ ...scene, trains: [] }, t);
    const i = (y * frame.w + x) * 3;
    return frame.px[i] + frame.px[i + 1] + frame.px[i + 2];
  };
  // A patch of open sky right of the Cathedral, below the cloud ceiling and clear of the rain.
  for (const [x, y] of [[231, 40], [250, 45]]) assert.ok(at(0, x, y) > at(1, x, y) + 60, `the sky at ${x},${y} lights up in frame 0`);
  assert.equal(at(1, 231, 40), at(2, 231, 40), 'and stays dark between flashes');
});

test('in Jalisco the weather replaces the seasonal particles but never a holiday', () => {
  assert.ok(svg({ date: WINTER }).includes('d-snowcap'), 'no weather: the season shows');
  for (const state of WEATHER_STATES) assert.ok(!svg({ date: WINTER, weather: [state, state, state] }).includes('d-snowcap'), state);
  const muertos = svg({ date: MUERTOS, weather: ['rain', 'rain', 'rain'] });
  assert.ok(muertos.includes('w-fall') && /class="d-/.test(muertos), 'the holiday stays under the rain');
});

test('the title names each place with its weather in the scene language', () => {
  assert.match(spec({ weather: ['rain', 'clear', 'storm'] }).title, /\nWeather: Guadalajara rain, Los Altos clear, Tequila storm$/);
  assert.match(spec({ weather: ['cloudy', 'drizzle', 'rain'], language: 'es' }).title, /\nClima: Guadalajara nublado, Los Altos llovizna, Tequila lluvia$/);
  assert.match(spec({ weather: ['partly', null, 'rain'], language: 'es' }).title, /\nClima: Guadalajara medio nublado, Tequila lluvia$/);
  const single = buildSpec(sampleStats(), { train: 'jalisco', skyline: jalisco, mode: 'single', weather: ['storm', 'rain', 'rain'] });
  assert.deepEqual(single.weather, ['storm'], 'one track, one place');
  assert.match(single.title, /Weather: Guadalajara storm$/);
});

test('partly adds separate banks to the city cloud loop and leaves the sun and moon visible in frame 0', () => {
  const weather = ['partly', 'clear', 'clear'];
  const layers = weatherArt(weather, sceneContext(spec({ weather })));
  assert.equal(layers.length, 1);
  const [{ grid, z, drift, y: top }] = layers;
  assert.deepEqual([z, drift, top, grid.w], ['sky', true, 0, 2 * SCENE_W]);
  const celestial = celestialGrid(SCENE_W);
  const covered = Array(SCENE_W).fill(false);
  for (let x = 0; x < SCENE_W; x++) {
    for (let y = 0; y < grid.h; y++) {
      const ink = grid.get(x, y);
      assert.equal(ink, grid.get(x + SCENE_W, y), 'both periods match');
      if (ink) covered[x] = true;
      if (celestial.get(x, y)) assert.equal(ink, null, 'frame 0 leaves the whole disc and rays visible');
    }
  }
  // Count starts on a circle so a bank crossing the scene edge counts once.
  const starts = covered.filter((cloud, x) => cloud && !covered[(x + SCENE_W - 1) % SCENE_W]);
  assert.ok(starts.length === 3 || starts.length === 4);
  const out = svg({ weather });
  assert.equal((out.match(/<g class="cl">/g) ?? []).length, 2, 'usual clouds and extra banks drift together');
  assert.match(out, /prefers-reduced-motion:reduce\)\{[^}]*\.cl\b[^}]*animation:none/);
});

test('partly paints the country banks only on exposed sky pixels', () => {
  const weather = ['clear', 'partly', 'partly'];
  const context = sceneContext(spec({ weather }));
  const layers = weatherArt(weather, context);
  const sky = new Set(['@dusk', '@haze', '@afterglow', '@starlight']);
  assert.equal(layers.length, 2);
  layers.forEach((layer, i) => {
    assert.equal(layer.z, 'ground');
    assert.equal(layer.y, weatherBands(3)[i + 1].top);
    assert.ok(!layer.drift && !layer.fall && !layer.grid.isEmpty());
    for (let y = 0; y < layer.grid.h; y++) {
      for (let x = 0; x < layer.grid.w; x++) {
        if (layer.grid.get(x, y)) assert.ok(sky.has(context.backdrop.get(x, y + layer.y)), 'terrain stays in front');
      }
    }
  });
});

test('drizzle uses the cloudy sky without a veil, sparse slow 1-pixel drops and dry Tequila furrows', () => {
  const out = svg({ weather: ['drizzle', 'drizzle', 'drizzle'] });
  assert.ok(out.includes('--wCloudy0:') && out.includes('--wCloudyCloud:'), 'uses cloudy sky and cloud inks');
  assert.ok(!out.includes('--wRain0:') && !out.includes('--wDimRain:'), 'skips the rain sky and dimming veil');
  assert.match(out, /prefers-reduced-motion:reduce\)\{[^}]*\.w-fall\d+/);

  const bands = weatherBands(3);
  const drizzleArt = weatherArt(['drizzle', 'drizzle', 'drizzle'], sceneContext(spec({ weather: ['drizzle', 'drizzle', 'drizzle'] })));
  const rainArt = weatherArt(['rain', 'rain', 'rain'], sceneContext(spec({ weather: ['rain', 'rain', 'rain'] })));
  const drizzleFall = drizzleArt.filter((l) => l.fall);
  const rainFall = rainArt.filter((l) => l.fall);
  assert.equal(drizzleFall.length, 6, 'two fall layers per place');

  const countColumns = (layer) => {
    let cols = 0;
    let pixels = 0;
    for (let x = 0; x < layer.grid.w; x++) {
      let col = 0;
      for (let y = 0; y < layer.fall.h; y++) if (layer.grid.get(x, y)) col++;
      if (col) cols++;
      pixels += col;
    }
    return { cols, pixels };
  };
  for (let i = 0; i < drizzleFall.length; i++) {
    const d = drizzleFall[i];
    const r = rainFall[i];
    assert.ok(d.fall.dur > r.fall.dur, `fall layer ${i} falls slower than rain`);
    for (let y = 0; y < d.fall.h; y++) {
      for (let x = 0; x < d.grid.w; x++) assert.equal(d.grid.get(x, y), d.grid.get(x, y + d.fall.h), 'seamless loop');
    }
    const stats = countColumns(d);
    assert.equal(stats.pixels, stats.cols, `fall layer ${i} uses 1-pixel drops`);
  }
  // Across all places, drizzle has about a third of rain's drops.
  const drizzleDrops = drizzleFall.reduce((sum, l) => sum + countColumns(l).cols, 0);
  const rainDrops = rainFall.reduce((sum, l) => sum + countColumns(l).cols, 0);
  const ratio = drizzleDrops / rainDrops;
  assert.ok(ratio > 0.25 && ratio < 0.42, `expected ~1/3 of rain drops, got ${drizzleDrops}/${rainDrops}`);

  // Ground details: wet plaza, wet tile roofs, ballast puddles, no Tequila furrow water.
  const ground = drizzleArt.filter((l) => l.z === 'ground' && !l.fall && l.y === 0);
  const hasInkInRows = (ink, y0, y1) => ground.some((l) => {
    for (let y = y0; y < y1; y++) for (let x = 0; x < l.grid.w; x++) if (l.grid.get(x, y) === ink) return true;
    return false;
  });
  assert.ok(hasInkInRows('@wPuddle', bands[0].base - 1, bands[0].base), 'Guadalajara plaza glints');
  assert.ok(hasInkInRows('@glassWarm', bands[0].base - 1, bands[0].base), 'Guadalajara lamp reflections');
  assert.ok(hasInkInRows('@wTileWet', bands[1].top, bands[1].base), 'Los Altos shining tile roofs');
  for (const band of bands) assert.ok(hasInkInRows('@wPuddle', band.base, band.bottom), `ballast puddles on track ${band.k}`);
  assert.equal(hasInkInRows('@wPuddle', bands[2].top, bands[2].base), false, 'no water in Tequila furrows');
});

function sceneContext(scene) {
  const tracks = scene.tracks.map((t) => ({ ...t, overhead: false }));
  const H = 204;
  return { W: SCENE_W, H, tracks, skyline: scene.skyline, backdrop: paintBackdrop(SCENE_W, H, tracks, scene.user, scene.skyline) };
}
