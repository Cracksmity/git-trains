import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpec } from '../../src/scene/spec.js';
import { renderScene } from '../../src/scene/render.js';
import { weatherArt, weatherBands, FLASH } from '../../src/scene/weather.js';
import { paintBackdrop } from '../../src/scene/backdrop.js';
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
  assert.match(spec({ weather: ['snow', 'snow', 'snow'] }).title, /\nWeather: Guadalajara snow, Los Altos snow, Tequila snow$/);
  assert.match(spec({ weather: ['snow', 'snow', 'snow'], language: 'es' }).title, /\nClima: Guadalajara nieve, Los Altos nieve, Tequila nieve$/);
  const single = buildSpec(sampleStats(), { train: 'jalisco', skyline: jalisco, mode: 'single', weather: ['storm', 'rain', 'rain'] });
  assert.deepEqual(single.weather, ['storm'], 'one track, one place');
  assert.match(single.title, /Weather: Guadalajara storm$/);
});

test('a place takes a state name or a reading with extras, keeping its own copy in sky', () => {
  const live = [{ state: 'cloudy', temperature: 19.8 }, null, { state: 'storm', temperature: 22.4, gust: 1 }];
  const scene = spec({ weather: live });
  assert.deepEqual(scene.weather, ['cloudy', null, 'storm']);
  assert.deepEqual(scene.sky, [{ state: 'cloudy', temperature: 19.8 }, null, { state: 'storm', temperature: 22.4, gust: 1 }]);
  assert.notEqual(scene.sky[0], live[0], 'the spec keeps its own copy');
  assert.equal(svg({ weather: [{ state: 'cloudy', gust: 1 }, null, { state: 'storm', temperature: null }] }), svg({ weather: ['cloudy', null, 'storm'] }));
  assert.notEqual(svg({ weather: live }), svg({ weather: ['cloudy', null, 'storm'] }), 'live temperatures appear in the captions');
  assert.deepEqual(spec({ weather: ['rain', { state: 'sleet' }, 7] }).weather, ['rain', null, null]);
  assert.deepEqual(spec({ weather: ['rain', 'rain', 'rain'] }).sky, [{ state: 'rain' }, { state: 'rain' }, { state: 'rain' }]);
});

test('live weather shows each place temperature in Jalisco captions, rounded with no -0°', () => {
  const live = [
    { state: 'cloudy', temperature: 19.8 },
    { state: 'rain', temperature: -2.6 },
    { state: 'storm', temperature: -0.4 },
  ];
  const plain = spec({ weather: ['cloudy', 'rain', 'storm'] }).tracks.map((t) => t.caption);
  const shown = spec({ weather: live }).tracks.map((t) => t.caption);
  assert.deepEqual(shown, [
    plain[0].replace('Guadalajara / ', 'Guadalajara 20° / '),
    plain[1].replace('Los Altos / ', 'Los Altos -3° / '),
    plain[2].replace('Tequila / ', 'Tequila 0° / '),
  ]);
  assert.deepEqual(spec({ weather: live, language: 'es' }).tracks.map((t) => t.caption), shown);
  assert.equal(spec({ weather: [{ state: 'frost', temperature: 0 }, { state: 'frost', temperature: -0.5 }, { state: 'frost', temperature: -0.6 }] }).tracks.map((t) => t.caption.split(' / ')[0]).join(', '), 'Guadalajara 0°, Los Altos 0°, Tequila -1°');
  const single = buildSpec(sampleStats(), { train: 'jalisco', skyline: jalisco, mode: 'single', weather: live });
  assert.match(single.tracks[0].caption, /^Guadalajara 20° \/ TypeScript - \d+$/);

  const missing = spec({ weather: [{ state: 'cloudy', temperature: null }, { state: 'rain' }, { state: 'storm', temperature: Number.NaN }] }).tracks.map((t) => t.caption);
  assert.deepEqual(missing, plain);
  assert.deepEqual(plain, spec({ weather: null }).tracks.map((t) => t.caption));

  const longStats = { ...sampleStats(), languages: [{ name: 'Jupyter Notebook', color: '#DA5B0B', bytes: 100, share: 1 }] };
  const longScene = buildSpec(longStats, { train: 'jalisco', skyline: jalisco, mode: 'single', weather: [{ state: 'frost', temperature: -12.4 }] });
  assert.match(longScene.tracks[0].caption, /^Guadalajara -12° \/ Jupyter Notebook - \d+$/);
  assert.doesNotThrow(() => renderScene(longScene));
});

function sceneContext(scene) {
  const tracks = scene.tracks.map((t) => ({ ...t, overhead: false }));
  const H = 204;
  return { W: SCENE_W, H, tracks, skyline: scene.skyline, backdrop: paintBackdrop(SCENE_W, H, tracks, scene.user, scene.skyline) };
}
