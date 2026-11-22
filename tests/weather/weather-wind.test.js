import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleStats } from '../../src/demo/sample.js';
import { Grid } from '../../src/graphics/pixel.js';
import { parseSkyline } from '../../src/landscape/skyline-parse.js';
import { renderScene } from '../../src/scene/render.js';
import { buildSpec } from '../../src/scene/spec.js';
import { weatherBands } from '../../src/scene/weather.js';
import { WEATHER_STATES } from '../../src/weather/conditions.js';
import { rasterScene, renderFrame } from '../../tools/export/raster.js';

const skyline = parseSkyline('jalisco');
const spec = (weather, language = 'en') => buildSpec(sampleStats(), { train: 'jalisco', skyline, mode: 'multi', weather, language });
const windy = (state) => ({ state, wind: true });

test('only the places with wind name it in either language and sway their trees', () => {
  const weather = [windy('rain'), 'clear', 'storm'];
  assert.match(spec(weather).title, /Weather: Guadalajara rain with wind, Los Altos clear, Tequila storm$/);
  assert.match(spec(weather, 'es').title, /Clima: Guadalajara lluvia con viento, Los Altos despejado, Tequila tormenta$/);
  const scene = rasterScene(spec(weather));
  assert.equal(scene.weather.filter((layer) => layer.sway).length, 1);
  assert.ok(!scene.weather.some(({ grid }) => grid.cells.includes('@wDust')));
  assert.ok(scene.weather.filter((layer) => layer.fall && layer.fall.dx).every((layer) => layer.clip[0] === 0));
});

test('wind moves the plaza trees, mesquites, piruls and red field dust in every state', () => {
  const bands = weatherBands(3);
  for (const state of WEATHER_STATES) {
    const scene = spec(Array.from({ length: 3 }, () => windy(state)));
    const { weather } = rasterScene(scene);
    const crowns = weather.filter((layer) => layer.sway);
    assert.equal(crowns.length, 3, state);
    crowns.forEach(({ y, grid }, k) => {
      assert.ok(y >= bands[k].top && y + grid.h <= bands[k].base);
      assert.ok(grid.cells.includes('@foliage'), `${state} on track ${k}`);
    });
    const dust = weather.filter(({ grid }) => grid.cells.includes('@wDust'));
    // Snow covers the parcels, so it has no dust to lift.
    assert.equal(dust.length, state === 'snow' ? 0 : 1, state);
    for (const layer of dust) assert.ok(layer.y >= bands[1].top && layer.y + layer.grid.h <= bands[1].base);
    const svg = renderScene(scene);
    assert.match(svg, /\.w-sway\{[^{}]*animation:w-sway [\d.]+s step-end infinite/);
    const stopped = svg.match(/prefers-reduced-motion:reduce\)\{([^{}]*\.w-sway[^{}]*)\{animation:none!important\}/)[1].split(',');
    for (const [, cls] of svg.matchAll(/class="(w-[\w-]+)"/g)) assert.ok(stopped.includes('.' + cls), cls);
  }
});

// Paint one weather layer white on an empty frame to sample its actual exported motion.
function frameOf(plan, layer, time) {
  const empty = new Grid(0, 0);
  return renderFrame({
    plan, color: () => [255, 255, 255, 1], sky: empty, celestial: empty, stars: { a: empty, b: empty },
    clouds: empty, ground: empty, backdrop: empty, weather: [layer], trains: [],
  }, time);
}

test('the canopy bends one pixel and releases while the trunks stay put', () => {
  const { plan, weather } = rasterScene(spec(Array(3).fill(windy('clear'))));
  for (const layer of weather.filter((l) => l.sway)) {
    const bent = frameOf(plan, layer, 0);
    const rest = frameOf(plan, layer, 1.3);
    assert.notDeepEqual(bent.px, rest.px);
    for (let y = layer.y; y < layer.y + layer.grid.h; y++) {
      const row = y * plan.W * 3;
      const end = row + plan.W * 3;
      assert.deepEqual(bent.px.subarray(row + 3, end), rest.px.subarray(row, end - 3));
    }
  }
});

test('slanted precipitation follows the same tiled diagonal in SVG and raster, including across the seam', () => {
  for (const state of ['drizzle', 'rain', 'storm', 'hail']) {
    const scene = spec(Array(3).fill(windy(state)));
    const svg = renderScene(scene);
    const { plan, weather } = rasterScene(scene);
    const falling = weather.filter((l) => l.fall);
    assert.equal(falling.length, state === 'hail' ? 9 : 6);
    for (const layer of falling) {
      const { h, dx, dur } = layer.fall;
      const { grid, clip } = layer;
      assert.equal(dx, h);
      assert.ok(svg.includes(`from{transform:translate(-${dx}px,-${h}px)}to{transform:translate(0,0)}`));
      const tile = 'w-tile' + weather.indexOf(layer);
      assert.ok(svg.includes(`<g id="${tile}">`));
      for (const [x, y] of [[plan.W, 0], [dx - plan.W, h], [dx, h]]) {
        assert.ok(svg.includes(`<use href="#${tile}" x="${x}" y="${y}"/>`), `tile at ${x},${y}`);
      }
      const pixels = grid.cells.flatMap((ink, i) => ink ? [[i % grid.w, Math.floor(i / grid.w)]] : []);
      if (clip[1] - clip[0] > 1) {
        const paired = pixels.filter(([x, y]) => grid.get(x + 1, y + 1) || grid.get(x - 1, y - 1));
        assert.ok(paired.length > pixels.length / 2, `${state} particles have diagonal bodies`);
      }
      for (const tick of [0, 1, Math.floor(h / 2), h - 1, h]) {
        const frame = frameOf(plan, layer, (tick + 0.25) * dur / h);
        const expected = new Uint8Array(frame.px.length);
        for (const [x, y] of pixels) {
          const row = layer.y + (y + tick) % h;
          if (row < clip[0] || row >= clip[1]) continue;
          const col = (grid.w + x + tick - Math.floor((y + tick) / h) * dx) % grid.w;
          const start = 3 * (row * frame.w + col);
          expected.fill(255, start, start + 3);
        }
        assert.ok(frame.px.every((value, i) => value === expected[i]), `${state} at row ${layer.y}, tick ${tick}`);
      }
    }
  }
});
