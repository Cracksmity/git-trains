import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { weatherFor } from '../../src/action/weather.js';
import { airQualityUrl } from '../../src/weather/air-quality.js';
import { weatherUrl } from '../../src/weather/open-meteo.js';
import { JALISCO_PLACES } from '../../src/weather/places.js';
import { parseSkyline } from '../../src/landscape/skyline-parse.js';

const entry = fileURLToPath(new URL('../../src/index.js', import.meta.url));
const JALISCO = { INPUT_TRAIN: 'jalisco', INPUT_SKYLINE: 'jalisco', INPUT_MODE: 'multi', INPUT_THEME: 'dark' };

function liveFetch(forecast, airQuality, asked = []) {
  return async (url) => {
    asked.push(url);
    if (url === weatherUrl(JALISCO_PLACES)) return Response.json(forecast);
    assert.equal(url, airQualityUrl(JALISCO_PLACES[0]));
    return airQuality instanceof Response ? airQuality : Response.json({ current: { pm2_5: airQuality } });
  };
}

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
  assert.match(bad.r.stdout, /::error::Unknown weather: "sleet"\. Options: off, live, clear, frost, heat, partly, cloudy, fog, drizzle, rain, snow, storm, hail/);
});

test('a skyline without places keeps its scene and says why', () => {
  const city = runAction({ INPUT_WEATHER: 'rain' });
  assert.equal(city.r.status, 0, city.r.stdout + city.r.stderr);
  assert.match(city.r.stdout, /::notice::weather needs a skyline with real places/);
  assert.ok(!city.svg.includes('w-fall'));
});

test('live weather logs the speed beside each windy place', async () => {
  const lines = [];
  const data = [[61, 18, 45], [0, 20, 39.9], [95, 22, 40]].map(([weather_code, temperature_2m, wind_speed_10m]) =>
    ({ current: { weather_code, temperature_2m, wind_speed_10m } }));
  const fetchImpl = liveFetch(data, 12);
  const sky = await weatherFor({ mode: 'live' }, parseSkyline('jalisco'), { fetchImpl, log: (line) => lines.push(line) });
  assert.deepEqual(sky, [{ state: 'rain', temperature: 18, wind: true }, { state: 'clear', temperature: 20 }, { state: 'storm', temperature: 22, wind: true }]);
  assert.deepEqual(lines, [
    'Weather (Open-Meteo): Guadalajara rain 18°C, wind 45 km/h, Los Altos clear 20°C, Tequila storm 22°C, wind 40 km/h',
    'Air quality (Open-Meteo): Guadalajara PM2.5 12 µg/m³',
  ]);
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
  const partial = liveFetch([{ current: { weather_code: 61, temperature_2m: 17.4 } }, {}, { current: { weather_code: 0 } }], 12);
  assert.deepEqual(await weatherFor({ mode: 'live' }, skyline, { fetchImpl: partial, log }), [
    { state: 'rain', temperature: 17.4 },
    null,
    { state: 'clear', temperature: null },
  ]);
  assert.deepEqual(lines, [
    '::notice::Weather: place 2: no "current" block',
    'Weather (Open-Meteo): Guadalajara rain 17°C, Los Altos unknown, Tequila clear',
    'Air quality (Open-Meteo): Guadalajara PM2.5 12 µg/m³',
  ]);
});

test('live PM2.5 adds haze only above 55 and only in Guadalajara', async () => {
  const forecast = Array(3).fill({ current: { weather_code: 0, temperature_2m: 22, wind_speed_10m: 40 } });
  const windy = { state: 'clear', temperature: 22, wind: true };
  for (const pm25 of [54, 55, 55.1, 61]) {
    const asked = [];
    const lines = [];
    const sky = await weatherFor({ mode: 'live' }, parseSkyline('jalisco'), {
      fetchImpl: liveFetch(forecast, pm25, asked), log: (line) => lines.push(line),
    });
    assert.deepEqual(asked.sort(), [weatherUrl(JALISCO_PLACES), airQualityUrl(JALISCO_PLACES[0])].sort());
    assert.deepEqual(sky, [pm25 > 55 ? { ...windy, haze: true } : windy, windy, windy]);
    assert.ok(lines.includes(`Air quality (Open-Meteo): Guadalajara PM2.5 ${pm25} µg/m³${pm25 > 55 ? ' -> haze' : ''}`));
  }
});

test('a failed or unusable air-quality reading leaves the forecast intact and emits one notice', async () => {
  const forecast = [0, 1, 3].map((weather_code) => ({ current: { weather_code } }));
  for (const answer of [new Response('unavailable\r\n100%\rdown', { status: 400 }), '61']) {
    const lines = [];
    const sky = await weatherFor({ mode: 'live' }, parseSkyline('jalisco'), {
      fetchImpl: liveFetch(forecast, answer), log: (line) => lines.push(line),
    });
    assert.deepEqual(sky, ['clear', 'partly', 'cloudy'].map((state) => ({ state, temperature: null })));
    const notices = lines.filter((line) => line.startsWith('::notice::'));
    assert.equal(notices.length, 1);
    assert.doesNotMatch(notices[0], /[\r\n]/);
    if (answer instanceof Response) assert.match(notices[0], /unavailable%0A100%25%0Ddown/);
  }
});

test('fixed haze and sample weather skip both APIs', async () => {
  const asked = [];
  const options = { fetchImpl: liveFetch([], 61, asked), log: () => {} };
  const skyline = parseSkyline('jalisco');
  const states = [{ state: 'clear', haze: true }, 'clear', 'clear'];
  assert.deepEqual(await weatherFor({ mode: 'fixed', states }, skyline, options), states);
  const sample = await weatherFor({ mode: 'live' }, skyline, { ...options, sample: true });
  assert.equal(sample[0].state, 'cloudy');
  assert.deepEqual(asked, []);
});
