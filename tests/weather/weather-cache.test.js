import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { weatherFor } from '../../src/action/weather.js';
import { parseSkyline } from '../../src/landscape/skyline-parse.js';
import { placesFor } from '../../src/weather/places.js';
import { CACHE_MAX_AGE_MS, cacheEntry, formatAge, readingsFromCache } from '../../src/weather/reading-cache.js';
import { weatherUrl } from '../../src/weather/open-meteo.js';

const entry = fileURLToPath(new URL('../../src/index.js', import.meta.url));
const skyline = parseSkyline('jalisco-sayula');
const places = placesFor(skyline);
const NOW = new Date('2026-11-23T01:30:00Z');
const READINGS = [
  { state: 'cloudy', code: 3, temperature: 25.1, windSpeed: 7, pm25: 7.8 },
  { state: 'rain', code: 61, temperature: 19.6, windSpeed: 44, pm25: null },
  { state: 'clear', code: 0, temperature: 26, windSpeed: 3, pm25: null },
];

function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'git-trains-cache-'));
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

// Open-Meteo answers the forecast with these readings, or refuses every request.
const answering = (codes) => async (url) => (url === weatherUrl(places)
  ? Response.json(codes.map(([weather_code, temperature_2m, wind_speed_10m]) => ({ current: { weather_code, temperature_2m, wind_speed_10m } })))
  : Response.json({ current: { pm2_5: 7.8 } }));
const refused = async () => new Response('{"reason":"Daily API request limit exceeded. Please try again tomorrow.","error":true}', { status: 429 });

test('a complete reading round-trips through the cache file', () => {
  const saved = cacheEntry(places, READINGS, new Date('2026-11-23T00:18:00Z'));
  assert.deepEqual(saved?.places.map((p) => p.id), ['guadalajara', 'sayula', 'tequila']);
  const back = readingsFromCache(JSON.parse(JSON.stringify(saved)), places, NOW);
  assert.ok('readings' in back);
  assert.deepEqual(back.readings, READINGS);
  assert.equal(back.at.toISOString(), '2026-11-23T00:18:00.000Z');
  assert.equal(formatAge(back.age), '1 h 12 min');
  assert.equal(formatAge(45 * 60000), '45 min');
  assert.equal(formatAge(2 * 3600000), '2 h');
  // A place without a state never replaces a complete reading.
  assert.equal(cacheEntry(places, [READINGS[0], { ...READINGS[1], state: null }, READINGS[2]], NOW), null);
});

test('the cache is checked field by field and every problem is reported', () => {
  const good = cacheEntry(places, READINGS, new Date(NOW.getTime() - 3600000));
  const problems = (data, route = places) => {
    const result = readingsFromCache(data, route, NOW);
    return 'problems' in result ? result.problems : [];
  };
  assert.deepEqual(problems(null), ['it is not a JSON object']);
  assert.deepEqual(problems([]), ['it is not a JSON object']);
  assert.deepEqual(problems({ ...good, version: 2, at: 'yesterday' }), ['version 2 is not 1', '"at" is not a date']);
  assert.deepEqual(problems({ ...good, at: new Date(NOW.getTime() - CACHE_MAX_AGE_MS - 60000).toISOString() }), ['the reading is 6 h 1 min old (at most 6 h)']);
  assert.deepEqual(problems({ ...good, at: new Date(NOW.getTime() + 3600000).toISOString() }), ['"at" is in the future']);
  assert.deepEqual(problems({ ...good, at: new Date(NOW.getTime() + 60000).toISOString() }), [], 'a little clock skew is fine');
  // A reading for Los Altos is not Sayula's, after switching skylines.
  assert.deepEqual(problems(good, placesFor(parseSkyline('jalisco'))), ['place 2 is "sayula", not "altos"']);
  assert.deepEqual(problems({ ...good, places: good.places.slice(0, 2) }), ['it has 2 place(s), the skyline has 3']);
  assert.deepEqual(problems({ ...good, places: 'three' }), ['"places" is not a list']);
  const broken = structuredClone(good);
  Object.assign(broken.places[0], { state: 'sleet', code: 1.5, temperature: 99 });
  Object.assign(broken.places[2], { windSpeed: -1, pm25: '7' });
  broken.places[1] = 'rain';
  assert.deepEqual(problems(broken), [
    'place 1: unknown state "sleet"', 'place 1: code out of range', 'place 1: temperature out of range',
    'place 2 is not an object', 'place 3: windSpeed out of range', 'place 3: pm25 out of range',
  ]);
});

test('a good live reading is saved for the next run', () => withDir(async (dir) => {
  const cache = join(dir, '.weather', 'last.json');
  const lines = [];
  const sky = await weatherFor({ mode: 'live' }, skyline, {
    fetchImpl: answering([[3, 25.1, 7], [61, 19.6, 44], [0, 26, 3]]), log: (line) => lines.push(line), cache, now: NOW,
  });
  assert.deepEqual(sky, [
    { state: 'cloudy', temperature: 25.1 }, { state: 'rain', temperature: 19.6, wind: true }, { state: 'clear', temperature: 26 },
  ]);
  const saved = JSON.parse(readFileSync(cache, 'utf8'));
  assert.equal(saved.at, NOW.toISOString());
  assert.deepEqual(saved.places.map((p) => [p.id, p.state, p.temperature]), [['guadalajara', 'cloudy', 25.1], ['sayula', 'rain', 19.6], ['tequila', 'clear', 26]]);
  assert.equal(saved.places[0].pm25, 7.8);
  assert.ok(!lines.some((line) => line.includes('cache')));
}));

test('a refused or unreachable Open-Meteo falls back to a recent saved reading', () => withDir(async (dir) => {
  const cache = join(dir, 'last.json');
  writeFileSync(cache, JSON.stringify(cacheEntry(places, READINGS, new Date('2026-11-23T00:18:00Z'))));
  const lines = [];
  const sky = await weatherFor({ mode: 'live' }, skyline, { fetchImpl: refused, log: (line) => lines.push(line), cache, now: NOW });
  assert.deepEqual(sky, [
    { state: 'cloudy', temperature: 25.1 }, { state: 'rain', temperature: 19.6, wind: true }, { state: 'clear', temperature: 26 },
  ]);
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^::notice::Could not read the weather, using the reading from 1 h 12 min ago: Open-Meteo answered 429: .*Daily API request limit exceeded/);
  assert.equal(lines[1], 'Weather (cached, 00:18 UTC): Guadalajara cloudy 25°C, Sayula rain 20°C, wind 44 km/h, Tequila clear 26°C');
  // The fallback leaves the saved reading as it was.
  assert.equal(JSON.parse(readFileSync(cache, 'utf8')).at, '2026-11-23T00:18:00.000Z');
}));

test('without a usable saved reading the scene stays without weather and says why', () => withDir(async (dir) => {
  const cache = join(dir, 'last.json');
  const run = async () => {
    const lines = [];
    const sky = await weatherFor({ mode: 'live' }, skyline, { fetchImpl: refused, log: (line) => lines.push(line), cache, now: NOW });
    return { sky, lines };
  };
  let { sky, lines } = await run();
  assert.equal(sky, null);
  assert.match(lines[0], /^::notice::Could not read the weather, the scene stays without it: Open-Meteo answered 429/);
  assert.equal(lines[1], '::notice::The weather cache has no usable reading: no reading saved yet');

  writeFileSync(cache, JSON.stringify(cacheEntry(places, READINGS, new Date('2026-11-22T12:00:00Z'))));
  ({ sky, lines } = await run());
  assert.equal(sky, null);
  assert.equal(lines[1], '::notice::The weather cache has no usable reading: the reading is 13 h 30 min old (at most 6 h)');

  writeFileSync(cache, '{"version":1,');
  ({ sky, lines } = await run());
  assert.equal(lines[1], '::notice::The weather cache has no usable reading: it is not valid JSON');

  writeFileSync(cache, ' '.repeat(17 * 1024));
  ({ sky, lines } = await run());
  assert.equal(lines[1], '::notice::The weather cache has no usable reading: it is larger than 16 KB');
}));

test('a partial reading keeps the saved one, and fixed or sample weather never touches it', () => withDir(async (dir) => {
  const cache = join(dir, 'last.json');
  const before = `${JSON.stringify(cacheEntry(places, READINGS, new Date('2026-11-23T00:18:00Z')))}\n`;
  writeFileSync(cache, before);
  const log = () => {};
  await weatherFor({ mode: 'live' }, skyline, { fetchImpl: answering([[3, 25, 7], [999, 20, 4], [0, 26, 3]]), log, cache, now: NOW });
  assert.equal(readFileSync(cache, 'utf8'), before);

  const fresh = join(dir, 'fresh.json');
  await weatherFor({ mode: 'fixed', states: ['rain', 'rain', 'rain'] }, skyline, { log, cache: fresh, now: NOW });
  await weatherFor({ mode: 'live' }, skyline, { sample: true, log, cache: fresh, now: NOW });
  assert.ok(!existsSync(fresh));
}));

test('weather-cache must be a .json file inside the repository', () => withDir((dir) => {
  const run = (path) => spawnSync(process.execPath, [entry, '--sample'], {
    env: {
      ...process.env, GITHUB_WORKSPACE: dir, 'INPUT_OUTPUT-DIR': join(dir, 'out'),
      INPUT_TRAIN: 'jalisco', INPUT_SKYLINE: 'jalisco-sayula', INPUT_MODE: 'multi', INPUT_WEATHER: 'live', 'INPUT_WEATHER-CACHE': path,
    },
    encoding: 'utf8',
  });
  const ok = run('.weather/last.json');
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  for (const [path, message] of [
    ['../elsewhere.json', /::error::"weather-cache" must stay inside the repository: "\.\.\/elsewhere\.json"/],
    ['.weather/last.txt', /::error::"weather-cache" must be the path to a \.json file inside the repository: "\.weather\/last\.txt"/],
  ]) {
    const bad = run(path);
    assert.notEqual(bad.status, 0);
    assert.match(bad.stdout, message);
  }
}));
