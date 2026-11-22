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
  assert.match(spec({ weather: ['hail', null, 'storm'], language: 'es' }).title, /\nClima: Guadalajara granizo, Tequila tormenta$/);
  assert.match(spec({ weather: ['frost', 'frost', 'frost'] }).title, /\nWeather: Guadalajara frost, Los Altos frost, Tequila frost$/);
  assert.match(spec({ weather: ['frost', 'frost', 'frost'], language: 'es' }).title, /\nClima: Guadalajara helada, Los Altos helada, Tequila helada$/);
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

test('hail falls faster and more sparsely than rain, with a one-pixel rebound at impact', () => {
  const context = sceneContext(spec());
  const layers = weatherArt(['hail', 'clear', 'clear'], context);
  assert.ok(layers.some((layer) => layer.blink), 'the storm lightning is present');
  assert.ok(!layers.some((layer) => layer.grid.cells.includes('@wDrop')), 'hail replaces the rain');
  const moving = layers.filter((layer) => layer.fall);
  const flight = moving.find((layer) => layer.clip[0] === 0);
  const { h, dur } = flight.fall;
  const pellets = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < flight.grid.w; x++) {
      if (!flight.grid.get(x, y) || flight.grid.get(x - 1, y)) continue;
      const width = flight.grid.get(x + 1, y) ? 2 : 1;
      assert.equal(flight.grid.get(x + width, y), null);
      assert.equal(flight.grid.get(x, (y + 1) % h), null);
      pellets.push({ x, y, width });
    }
  }
  assert.deepEqual(new Set(pellets.map((p) => p.width)), new Set([1, 2]));
  for (const layer of weatherArt(['rain', 'clear', 'clear'], context).filter((l) => l.fall)) {
    assert.ok(h / dur > layer.fall.h / layer.fall.dur);
    const rainColumns = new Set(layer.grid.cells.flatMap((ink, i) => ink ? [i % context.W] : []));
    assert.ok(pellets.length < rainColumns.size);
  }

  // Sample the clipped fall layers one pixel-step at a time, including across the loop seam.
  const visible = (x, row, step) => moving.some((layer) => {
    const [from, to] = layer.clip;
    return row >= from && row < to && layer.grid.get(x, row - layer.y + h - (step % h));
  });
  const ground = weatherBands(1)[0].base;
  let bounces = 0;
  for (const { x, y } of pellets) {
    const impact = (ground - y + h) % h;
    assert.ok(visible(x, ground, impact));
    if (!visible(x, ground - 1, impact + 1)) continue;
    bounces++;
    assert.ok(!visible(x, ground, impact + 1), 'the pellet leaves the ground');
    assert.ok([2, 3, 4, 5, 6].some((tick) => visible(x, ground, impact + tick)), 'it lands again');
  }
  assert.ok(bounces > 1 && bounces < pellets.length / 2);
  const out = svg({ weather: ['hail', 'clear', 'clear'] });
  const frozen = out.match(/prefers-reduced-motion:reduce\)\{([^{}]*\.w-fall[^{}]*)\{animation:none!important\}/)[1].split(',');
  for (const [, cls] of out.matchAll(/class="(w-fall\d+)"/g)) assert.ok(frozen.includes(`.${cls}`));
});

test('hail banks rest on Guadalajara landmarks, rural furrows and ballast', () => {
  const context = sceneContext(spec());
  const layers = weatherArt(['hail', 'hail', 'hail'], context);
  const banks = layers.filter((l) => l.z === 'ground' && !l.fall && l.grid.cells.includes('@wHail'));
  assert.equal(banks.length, 3);
  assert.ok(banks.every((l) => !l.blink && !l.drift));
  const grains = banks.map(({ grid }) => grid.cells.flatMap((ink, i) =>
    ink === '@wHail' || ink === '@wHailShade' ? [[i % grid.w, Math.floor(i / grid.w)]] : []));
  const bands = weatherBands(3);
  const onRoof = (left, right, inks) => grains[0].some(([x, y]) =>
    x >= left && x <= right && inks.includes(context.backdrop.get(x, y + 1)));
  assert.ok(onRoof(25, 84, ['@roofWhite']), 'stadium roof ring');
  assert.ok(onRoof(91, 152, ['@tileBlue', '@ochreLit', '@stoneLit']), 'Cathedral');
  assert.ok(onRoof(155, 189, ['@tile', '@tileLit']), 'Sagrario dome');
  assert.ok(grains[0].some(([x, y]) => x >= 384 && x <= 412 && context.backdrop.get(x, y) === '@water'), 'Minerva basin');
  assert.ok(grains[0].filter(([, y]) => y === bands[0].base - 1).length > context.W / 2, 'banks along the plaza');
  for (const k of [1, 2]) {
    const field = grains[k].filter(([, y]) => y < bands[k].base);
    assert.ok(field.length > 0);
    assert.ok(field.every(([x, y]) => context.backdrop.get(x, y) === (k === 1 ? '@earthLit' : '@furrow')));
    assert.ok(grains[k].some(([x, y]) => context.backdrop.get(x, y) === '@ballast2'));
  }
});

test('frost keeps the sky clear and still, and only rims the plaza trees, Los Altos tops and wall, and agave tips', () => {
  const weather = ['frost', 'frost', 'frost'];
  const context = sceneContext(spec({ weather }));
  const layers = weatherArt(weather, context);
  assert.equal(layers.length, 3);
  for (const layer of layers) {
    assert.equal(layer.z, 'ground');
    assert.equal(layer.y, 0);
    assert.ok(!layer.fall && !layer.drift && !layer.blink, 'nothing moves in frost');
  }
  const out = svg({ weather });
  assert.ok(!out.includes('w-fall') && !out.includes('w-flash'), 'no weather animations');
  assert.ok(!out.includes('--wCloudy0:') && !out.includes('--wRain0:') && !out.includes('--wStorm0:'), 'clear sky stays untouched');

  const pixelsOf = (grid) => grid.cells.flatMap((ink, i) => (ink ? [[i % grid.w, Math.floor(i / grid.w), ink]] : []));
  const bands = weatherBands(3);
  const { backdrop } = context;

  // Guadalajara: frost only on the plaza trees' lit top row.
  const gdl = pixelsOf(layers[0].grid);
  assert.ok(gdl.length > 50);
  assert.ok(gdl.every(([x, y, ink]) => y >= bands[0].top && y < bands[0].base && ink === '@wFrost' && backdrop.get(x, y) === '@foliageLit'));

  // Los Altos: top pixels of grassland, pasture and tile roofs, plus thin white line on the stone wall.
  const altos = pixelsOf(layers[1].grid);
  const byBackdrop = (target) => altos.filter(([x, y]) => backdrop.get(x, y) === target);
  assert.ok(byBackdrop('@grassland').length > 20, 'grassland ridge top');
  assert.ok(byBackdrop('@pasture').length > 40, 'pasture ridge top');
  const roofFrost = altos.filter(([x, y]) => backdrop.get(x, y) === '@tile' || backdrop.get(x, y) === '@tileLit');
  let totalRoof = 0;
  for (let y = bands[1].top; y < bands[1].base; y++) {
    for (let x = 0; x < context.W; x++) if (backdrop.get(x, y) === '@tile' || backdrop.get(x, y) === '@tileLit') totalRoof++;
  }
  assert.ok(roofFrost.length > 40 && roofFrost.length < totalRoof / 3, 'frosts only the top pixel of roofs, not the whole surface');
  const wallLine = altos.filter(([, , ink]) => ink === '@wFrostLine');
  assert.ok(wallLine.length > context.W / 2, 'thin white line across the dry-stone wall');
  assert.ok(wallLine.every(([x, y]) => backdrop.get(x, y) === '@stone' && backdrop.get(x, y + 1) === '@stoneShade'));

  // Tequila: frosted agave tips only.
  const teq = pixelsOf(layers[2].grid);
  assert.ok(teq.length > 50);
  assert.ok(teq.every(([x, y, ink]) => y >= bands[2].top && y < bands[2].base && ink === '@wFrost' && backdrop.get(x, y) === '@agaveLit'));
});

function sceneContext(scene) {
  const tracks = scene.tracks.map((t) => ({ ...t, overhead: false }));
  const H = 204;
  return { W: SCENE_W, H, tracks, skyline: scene.skyline, backdrop: paintBackdrop(SCENE_W, H, tracks, scene.user, scene.skyline) };
}

test('heat warms the sky behind the landmarks and extends all eight daytime rays by one pixel', () => {
  const weather = ['heat', 'heat', 'heat'];
  const context = sceneContext(spec({ weather }));
  const layers = weatherArt(weather, context);
  const washes = layers.filter(({ grid }) => grid.cells.includes('@wHeatHaze'));
  assert.deepEqual(washes.map(({ z, y }) => [z, y]), [['sky', 0], ['ground', 100], ['ground', 152]]);
  for (const { grid, y: top } of washes.slice(1)) {
    for (let y = 0; y < grid.h; y++) {
      for (let x = 0; x < grid.w; x++) {
        if (grid.get(x, y)) assert.ok(['@dusk', '@haze', '@starlight'].includes(context.backdrop.get(x, top + y)));
      }
    }
  }

  for (const theme of ['light', 'dark']) {
    const scene = rasterScene(spec({ weather }), theme);
    scene.trains = [];
    const hot = renderFrame(scene, 0);
    const clear = renderFrame({ ...scene, weather: [] }, 0);
    const withoutRays = renderFrame({ ...scene, weather: scene.weather.filter(({ grid }) => !grid.cells.includes('@rays')) }, 0);
    const pixel = (frame, x, y) => frame.px.slice((y * frame.w + x) * 3, (y * frame.w + x) * 3 + 3);
    for (const [x, y] of [[0, 0], [0, 100], [0, 152]]) assert.notDeepEqual(pixel(hot, x, y), pixel(clear, x, y));
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const r = dx && dy ? 8 : 11;
        const x = SCENE_W - 56 + dx * r;
        const y = 20 + dy * r;
        const expected = theme === 'light' ? Uint8Array.from(scene.color('@rays').slice(0, 3)) : pixel(withoutRays, x, y);
        assert.deepEqual(pixel(hot, x, y), expected);
        assert.deepEqual(pixel(hot, x + dx, y + dy), pixel(withoutRays, x + dx, y + dy));
      }
    }
  }
});

test('the heat shimmer shifts only two Tequila horizon rows, then returns to its first pose', () => {
  const weather = ['clear', 'clear', 'heat'];
  const scene = rasterScene(spec({ weather }), 'light');
  scene.trains = [];
  const band = weatherBands(3)[2];
  const { W } = scene.plan;
  const top = band.base - 24;
  const strip = (t) => renderFrame(scene, t).px.subarray(3 * W * band.top);
  const start = strip(0);
  assert.deepEqual(strip(1.19), start);
  assert.deepEqual(strip(2.4), start);
  const next = strip(1.2);
  const changedRows = new Set();
  let count = 0;
  for (let i = 0; i < start.length; i += 3) {
    if (start[i] === next[i] && start[i + 1] === next[i + 1] && start[i + 2] === next[i + 2]) continue;
    changedRows.add(band.top + Math.floor(i / (3 * W)));
    assert.deepEqual(next.subarray(i, i + 3), start.subarray(i + 3, i + 6), 'the edge moves left by one pixel');
    count++;
  }
  assert.deepEqual([...changedRows], [top, top + 1]);
  assert.ok(count < W / 10, 'only scattered edges shimmer');
  assert.match(svg({ weather }), /prefers-reduced-motion:reduce\)\{\.w-fall\d+,\.w-fall\d+\{animation:none!important\}/);
});
