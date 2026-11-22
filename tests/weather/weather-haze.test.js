import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWeatherInput } from '../../src/weather/conditions.js';
import { sampleStats } from '../../src/demo/sample.js';
import { parseSkyline } from '../../src/landscape/skyline-parse.js';
import { buildSpec } from '../../src/scene/spec.js';
import { renderScene } from '../../src/scene/render.js';
import { cropScene } from '../../tools/export/zoom.js';

const skyline = parseSkyline('jalisco');
const spec = (weather, language = 'en') => buildSpec(sampleStats(), { train: 'jalisco', mode: 'multi', skyline, weather, language });
const frame = (weather, theme) => cropScene(spec(weather), theme, { trains: false });

test('haze parses alone or with wind in either order and the title names visible modifiers', () => {
  const hazy = { state: 'clear', haze: true };
  assert.deepEqual(parseWeatherInput('clear+haze'), { mode: 'fixed', states: [hazy, hazy, hazy] });
  assert.match(spec([hazy, hazy, hazy]).title, /Weather: Guadalajara clear with haze, Los Altos clear, Tequila clear$/);
  assert.match(spec([hazy, hazy, hazy], 'es').title, /Clima: Guadalajara despejado con calima, Los Altos despejado, Tequila despejado$/);
  for (const input of ['cloudy+haze+wind', 'cloudy+wind+haze']) {
    const windy = { state: 'cloudy', wind: true, haze: true };
    const parsed = parseWeatherInput(`${input}, clear+haze, fog`);
    assert.deepEqual(parsed.states, [windy, hazy, 'fog']);
    assert.match(spec(parsed.states).title, /Guadalajara cloudy with wind and haze, Los Altos clear, Tequila fog$/);
    assert.match(spec(parsed.states, 'es').title, /Guadalajara nublado con viento y calima, Los Altos despejado, Tequila neblina$/);
  }
});

test('haze changes the dry city sky, including heat, fog and wind', () => {
  for (const state of ['clear', 'partly', 'cloudy', 'heat', 'fog']) {
    for (const wind of [true, false]) {
      const plain = { state, wind };
      const hazy = { ...plain, haze: true };
      assert.notDeepEqual(frame([hazy], 'light').px, frame([plain], 'light').px, state);
    }
  }
});

test('precipitation, frost and the country strips keep their original SVG including the title', () => {
  for (const state of ['drizzle', 'rain', 'storm', 'hail', 'frost']) {
    const plain = { state, wind: true };
    assert.equal(renderScene(spec([{ ...plain, haze: true }, 'clear', 'fog'])), renderScene(spec([plain, 'clear', 'fog'])));
  }
  assert.equal(renderScene(spec(['clear', { state: 'cloudy', haze: true }, { state: 'heat', haze: true }])),
    renderScene(spec(['clear', 'cloudy', 'heat'])));
});

test('haze tints the lower sky, ridge and west-side towers, keeping foreground landmarks crisp in both themes', () => {
  for (const theme of ['light', 'dark']) {
    const plain = frame(['clear', 'clear', 'clear'], theme);
    const hazy = frame([{ state: 'clear', haze: true }, 'clear', 'clear'], theme);
    const row = plain.w * 3;
    assert.deepEqual(hazy.px.subarray(0, 44 * row), plain.px.subarray(0, 44 * row));
    assert.deepEqual(hazy.px.subarray(88 * row), plain.px.subarray(88 * row));
    const pixel = (canvas, x, y) => canvas.px.subarray(y * row + 3 * x, y * row + 3 * x + 3);
    for (const [x, y] of [[83, 52], [22, 67], [310, 52], [340, 55], [370, 55]]) {
      assert.notDeepEqual(pixel(hazy, x, y), pixel(plain, x, y), `${theme} distant pixel at ${x},${y}`);
    }
    // Cathedral, stadium roof, Teatro Degollado, Hospicio Cabañas, La Minerva and the signpost.
    for (const [x, y] of [[98, 58], [54, 70], [210, 70], [292, 51], [398, 58], [24, 52]]) {
      assert.deepEqual(pixel(hazy, x, y), pixel(plain, x, y), `${theme} foreground at ${x},${y}`);
    }
  }
});
