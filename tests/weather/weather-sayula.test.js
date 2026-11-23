import test from 'node:test';
import assert from 'node:assert/strict';
import { weatherFor } from '../../src/action/weather.js';
import { sampleStats } from '../../src/demo/sample.js';
import { Grid } from '../../src/graphics/pixel.js';
import { parseSkyline } from '../../src/landscape/skyline-parse.js';
import { JALISCO_WEATHER } from '../../src/landscape/jalisco-weather.js';
import { paintBackdrop } from '../../src/scene/backdrop.js';
import { renderScene, planScene } from '../../src/scene/render.js';
import { buildSpec } from '../../src/scene/spec.js';
import { weatherArt, weatherBands } from '../../src/scene/weather.js';
import { WEATHER_STATES, parseWeatherInput } from '../../src/weather/conditions.js';
import { JALISCO_PLACES, placesFor } from '../../src/weather/places.js';
import { localTheme } from '../../src/weather/sun.js';
import { rasterScene, renderFrame } from '../../tools/export/raster.js';

const skyline = parseSkyline('jalisco-sayula');
const spec = (weather, language = 'en', route = skyline) =>
  buildSpec(sampleStats(), { train: 'jalisco', mode: 'multi', skyline: route, weather, language });
const { W, H, tracks } = planScene(spec(null));
const backdrop = paintBackdrop(W, H, tracks, 'octocat', skyline);
const context = { W, H, tracks, backdrop, skyline };
const band = weatherBands(3)[1];

test('Guadalajara and Tequila keep the same pixels on both routes during animated weather', () => {
  const mixed = parseWeatherInput('storm+wind,fog,heat').states;
  for (const theme of ['light', 'dark']) {
    const original = rasterScene(spec(mixed, 'en', parseSkyline('jalisco')), theme);
    const variant = rasterScene(spec(mixed), theme);
    for (const time of [0, 1.3]) {
      const before = renderFrame(original, time).px;
      const after = renderFrame(variant, time).px;
      assert.deepEqual(after.subarray(0, band.top * W * 3), before.subarray(0, band.top * W * 3));
      assert.deepEqual(after.subarray(band.bottom * W * 3), before.subarray(band.bottom * W * 3));
    }
  }
});

test('the Action reads Sayula coordinates and uses that reading for the caption and title', async () => {
  assert.deepEqual(placesFor(skyline), [
    JALISCO_PLACES[0], { id: 'sayula', name: 'Sayula', latitude: 19.883, longitude: -103.6 }, JALISCO_PLACES[2],
  ]);
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(new URL(url));
    if (url.includes('air-quality')) return Response.json({ current: { pm2_5: 12 } });
    return Response.json([[3,15],[61,23.8],[0,29]].map(([weather_code, temperature_2m]) => ({ current: { weather_code, temperature_2m } })));
  };
  const live = await weatherFor({ mode: 'live' }, skyline, { fetchImpl, log() {} });
  const forecast = urls.find((url) => url.pathname.endsWith('/forecast'));
  assert.equal(forecast.searchParams.get('latitude'), '20.6767,19.8830,20.8826');
  assert.equal(forecast.searchParams.get('longitude'), '-103.3475,-103.6000,-103.8360');
  assert.deepEqual(spec(live).tracks.map((t) => t.caption), [
    'Guadalajara 15° / TypeScript 50%', 'Sayula 24° / Python 30%', 'Tequila 29° / Rust 15%',
  ]);
  assert.match(spec(live).title, /Guadalajara cloudy, Sayula rain, Tequila clear/);
  assert.match(spec(live, 'es').title, /Guadalajara nublado, Sayula lluvia, Tequila despejado/);
  assert.doesNotMatch(renderScene({ ...spec(live), date: '2026-01-20' }), /d-snowcap/);
  const now = new Date('2026-01-20T05:00:00Z');
  assert.deepEqual(localTheme(skyline, now), localTheme(parseSkyline('jalisco'), now));
});

test('every Sayula state draws in still air and wind, with haze confined to Guadalajara', () => {
  for (const state of WEATHER_STATES) {
    const draw = (suffix) => {
      const scene = spec(parseWeatherInput(`clear,${state}${suffix},clear`).states);
      const layers = weatherArt(scene.weather, { ...context, sky: scene.sky });
      return { layers, title: scene.title };
    };
    for (const suffix of ['', '+wind']) {
      const { layers, title } = draw(suffix);
      const hazy = draw(suffix + '+haze');
      assert.equal(hazy.title, title);
      assert.deepEqual(hazy.layers, layers);
      assert.equal(layers.length > 0, state !== 'clear' || !!suffix, state);
      const crowns = layers.filter((layer) => layer.sway);
      assert.equal(crowns.length, suffix ? 1 : 0);
      if (suffix) {
        assert.ok(crowns[0].grid.cells.includes('@foliage'));
        assert.equal(crowns[0].grid.cells.includes('@saltDust'), state !== 'snow');
        assert.ok(!crowns[0].grid.cells.includes('@wDust'));
      }
    }
  }
});

test('Sayula weather follows the waterline, roof tiles, tule and mountain faces', () => {
  const ground = (state) => {
    const g = new Grid(W, H);
    JALISCO_WEATHER.sayula.paint(g, state, band, backdrop);
    return g;
  };
  const count = (g, test) => g.cells.reduce((n, ink, i) => n + Number(!!ink && test(ink, backdrop.cells[i])), 0);
  let previous = 0;
  for (const state of ['drizzle', 'rain', 'storm']) {
    const g = ground(state);
    const flooded = count(g, (ink, under) => ['@laguna', '@lakeGlint'].includes(ink) && ['@salt', '@saltSeam'].includes(under));
    assert.ok(flooded > previous, state);
    assert.ok(count(g, (ink, under) => ink === '@wTileWet' && under === '@tileLit'));
    assert.ok(count(g, (ink, under) => ['@wTileWet', '@wPuddle'].includes(ink) && under === '@kioskRoof'));
    assert.ok(count(g, (ink, under) => ink === '@wPuddle' && ['@domeGold', '@domeOrange'].includes(under)));
    previous = flooded;
  }
  const hail = ground('hail');
  assert.ok(count(hail, (ink) => ink === '@wHail'));
  assert.equal(count(hail, (_, under) => !['@salt', '@saltSeam'].includes(under)), 0);
  const frost = ground('frost');
  for (const surface of ['@tule', '@tile', '@kioskRoof', '@salt']) assert.ok(count(frost, (_, under) => under === surface), surface);
  const snow = ground('snow');
  for (const ink of ['@nevado', '@nevadoShade', '@summitSnow', '@tile', '@tileLit', '@kioskRoof', '@domeGold', '@domeOrange']) {
    assert.ok(backdrop.cells.some((under) => under === ink));
    assert.ok(backdrop.cells.every((under, i) => under !== ink || i < band.top * W || i >= band.base * W ||
      ['@wSnow', '@wSnowShade'].includes(snow.cells[i])), ink);
  }
  const fog = ground('fog');
  assert.ok(count(fog, (_, under) => under === '@laguna'));
  assert.equal(count(fog, (_, under) => ['@summitSnow', '@domeGold', '@domeOrange', '@domeRib', '@cantera', '@limewash'].includes(under)), 0);
  const mirage = JALISCO_WEATHER.sayula.heat(band, backdrop);
  for (const layer of mirage) {
    assert.ok(!layer.grid.isEmpty());
    assert.deepEqual(layer.clip, [layer.y, layer.y + 1]);
    assert.ok(layer.grid.cells.every((ink, i) => !ink || ['@salt', '@saltSeam'].includes(backdrop.get(i % W, layer.y))));
  }
});
