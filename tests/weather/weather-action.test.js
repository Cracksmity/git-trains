import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { weatherFor } from '../../src/action/weather.js';
import { parseSkyline } from '../../src/landscape/skyline-parse.js';

const entry = fileURLToPath(new URL('../../src/index.js', import.meta.url));
const JALISCO = { INPUT_TRAIN: 'jalisco', INPUT_SKYLINE: 'jalisco', INPUT_MODE: 'multi', INPUT_THEME: 'dark' };

function runAction(env) {
  const dir = mkdtempSync(join(tmpdir(), 'git-trains-weather-'));
  const r = spawnSync(process.execPath, [entry, '--sample'], { env: { ...process.env, 'INPUT_OUTPUT-DIR': dir, ...env }, encoding: 'utf8' });
  try {
    return { r, svg: r.status === 0 ? readFileSync(join(dir, 'train.svg'), 'utf8') : '' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('weather is off unless asked for, and live weather in the sample comes from the demo data', () => {
  const off = runAction(JALISCO);
  assert.equal(off.r.status, 0, off.r.stdout + off.r.stderr);
  assert.ok(!off.svg.includes('w-fall') && !off.r.stdout.includes('Weather'));

  const live = runAction({ ...JALISCO, INPUT_WEATHER: 'live' });
  assert.equal(live.r.status, 0, live.r.stdout + live.r.stderr);
  assert.match(live.r.stdout, /Weather \(Open-Meteo\): Guadalajara cloudy 20°C, Los Altos rain 18°C, Tequila storm 22°C/);
  assert.ok(live.svg.includes('w-fall') && live.svg.includes('w-flash'));
  assert.match(live.svg, /Weather: Guadalajara cloudy, Los Altos rain, Tequila storm/);
});

test('fixed weather draws without a reading, and a bad value stops the run with the options', () => {
  const fixed = runAction({ ...JALISCO, INPUT_WEATHER: 'partly,hail,storm' });
  assert.equal(fixed.r.status, 0, fixed.r.stdout + fixed.r.stderr);
  assert.match(fixed.svg, /Weather: Guadalajara partly cloudy, Los Altos hail, Tequila storm/);

  const bad = runAction({ ...JALISCO, INPUT_WEATHER: 'sleet' });
  assert.notEqual(bad.r.status, 0);
  assert.match(bad.r.stdout, /::error::Unknown weather: "sleet"\. Options: off, live, clear, frost, heat, partly, cloudy, fog, drizzle, rain, storm, hail/);
});

test('a skyline without places keeps its scene and says why', () => {
  const city = runAction({ INPUT_WEATHER: 'rain' });
  assert.equal(city.r.status, 0, city.r.stdout + city.r.stderr);
  assert.match(city.r.stdout, /::notice::weather needs a skyline with real places/);
  assert.ok(!city.svg.includes('w-fall'));
});

test('a failed reading leaves the scene without weather and keeps the notice on one line', async () => {
  const lines = [];
  const log = (line) => lines.push(line);
  const skyline = parseSkyline('jalisco');
  const down = async () => { throw new Error('getaddrinfo ENOTFOUND\n100% down'); };
  assert.equal(await weatherFor({ mode: 'live' }, skyline, { fetchImpl: down, log }), null);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^::notice::Could not read the weather, the scene stays without it: could not reach Open-Meteo: getaddrinfo ENOTFOUND%0A100%25 down$/);

  lines.length = 0;
  const partial = async () => ({ ok: true, status: 200, text: async () => JSON.stringify([{ current: { weather_code: 61, temperature_2m: 17.4 } }, {}, { current: { weather_code: 0 } }]) });
  assert.deepEqual(await weatherFor({ mode: 'live' }, skyline, { fetchImpl: partial, log }), ['rain', null, 'clear']);
  assert.deepEqual(lines, [
    '::notice::Weather: place 2: no "current" block',
    'Weather (Open-Meteo): Guadalajara rain 17°C, Los Altos unknown, Tequila clear',
  ]);
});
