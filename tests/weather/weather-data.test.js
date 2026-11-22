import test from 'node:test';
import assert from 'node:assert/strict';
import { WEATHER_STATES, parseWeatherInput, readCurrentWeather, stateOfCode } from '../../src/weather/conditions.js';
import { fetchWeather, weatherUrl } from '../../src/weather/open-meteo.js';
import { JALISCO_PLACES, placesFor } from '../../src/weather/places.js';

const reading = (code, temperature = 20) => ({ current: { weather_code: code, temperature_2m: temperature } });
const answer = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

test('every WMO code Open-Meteo documents maps to a state the scenes draw', () => {
  const documented = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
  for (const code of documented) assert.ok(WEATHER_STATES.includes(stateOfCode(code)), `code ${code}`);
  assert.equal(stateOfCode(0), 'clear');
  for (const code of [1, 2]) assert.equal(stateOfCode(code), 'partly', `code ${code}`);
  assert.equal(stateOfCode(3), 'cloudy');
  assert.equal(stateOfCode(45), 'cloudy');
  for (const code of [51, 53, 55, 56, 57]) assert.equal(stateOfCode(code), 'drizzle', `code ${code}`);
  for (const code of [61, 63, 65, 66, 67, 80, 81, 82]) assert.equal(stateOfCode(code), 'rain', `code ${code}`);
  assert.equal(stateOfCode(95), 'storm');
  for (const bad of [4, 68, 100, -1, 1.5, '61', null, undefined]) assert.equal(stateOfCode(bad), null, String(bad));
});

test('the weather input accepts off, live, one state or one per place', () => {
  assert.deepEqual(parseWeatherInput(''), { mode: 'off' });
  assert.deepEqual(parseWeatherInput('off'), { mode: 'off' });
  assert.deepEqual(parseWeatherInput(' Live '), { mode: 'live' });
  assert.deepEqual(parseWeatherInput('partly'), { mode: 'fixed', states: ['partly', 'partly', 'partly'] });
  assert.deepEqual(parseWeatherInput('drizzle'), { mode: 'fixed', states: ['drizzle', 'drizzle', 'drizzle'] });
  assert.deepEqual(parseWeatherInput('rain'), { mode: 'fixed', states: ['rain', 'rain', 'rain'] });
  assert.deepEqual(parseWeatherInput('storm, cloudy ,clear'), { mode: 'fixed', states: ['storm', 'cloudy', 'clear'] });
  assert.throws(() => parseWeatherInput('snow'), /Unknown weather: "snow"\. Options: off, live, clear, partly, cloudy, drizzle, rain, storm/);
  assert.throws(() => parseWeatherInput('rain,clear'), /one state per place/);
});

test('a reading is checked field by field and a bad place does not spoil the others', () => {
  const ok = readCurrentWeather([reading(3, 19.8), reading(61), reading(95, 24)], 3);
  assert.deepEqual(ok.problems, []);
  assert.deepEqual(ok.places.map((p) => p.state), ['cloudy', 'rain', 'storm']);
  assert.equal(ok.places[0].temperature, 19.8);

  const bad = readCurrentWeather([reading(42), { current: null }, reading(0, 999)], 3);
  assert.deepEqual(bad.places.map((p) => p.state), [null, null, 'clear']);
  assert.equal(bad.places[2].temperature, null);
  assert.equal(bad.problems.length, 3);
  assert.match(bad.problems[0], /place 1: unknown weather_code 42/);

  const single = readCurrentWeather(reading(0), 1);
  assert.deepEqual(single.places.map((p) => p.state), ['clear']);
  const short = readCurrentWeather([reading(0)], 3);
  assert.match(short.problems[0], /expected 3 place\(s\), got 1/);
  assert.deepEqual(short.places.map((p) => p.state), ['clear', null, null]);
});

test('one request carries every place, and the answer is read per place', async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    return answer([reading(0), reading(3), reading(80)]);
  };
  const result = await fetchWeather({ places: JALISCO_PLACES, fetchImpl });
  assert.equal(urls.length, 1);
  assert.equal(urls[0], weatherUrl(JALISCO_PLACES));
  const query = new URL(urls[0]).searchParams;
  assert.equal(query.get('latitude'), '20.6767,20.7058,20.8826');
  assert.equal(query.get('longitude'), '-103.3475,-102.3466,-103.8360');
  assert.equal(query.get('current'), 'weather_code,temperature_2m');
  assert.deepEqual(result.places.map((p) => p.state), ['clear', 'cloudy', 'rain']);
});

test('network and server errors are retried once; other failures say what went wrong', async () => {
  let calls = 0;
  const flaky = async () => {
    calls++;
    if (calls === 1) throw new Error('socket hang up');
    return answer([reading(1)]);
  };
  const one = [JALISCO_PLACES[0]];
  assert.equal((await fetchWeather({ places: one, fetchImpl: flaky, retryDelay: 0 })).places[0].state, 'partly');
  assert.equal(calls, 2);

  const down = async () => answer('busy', 503);
  await assert.rejects(fetchWeather({ places: one, fetchImpl: down, retryDelay: 0 }), /Open-Meteo answered 503/);
  const offline = async () => { throw new Error('ENOTFOUND'); };
  await assert.rejects(fetchWeather({ places: one, fetchImpl: offline, retryDelay: 0 }), /could not reach Open-Meteo: ENOTFOUND/);
  const refused = async () => answer('{"reason":"bad latitude"}', 400);
  await assert.rejects(fetchWeather({ places: one, fetchImpl: refused }), /Open-Meteo answered 400: \{"reason":"bad latitude"\}/);
  const garbage = async () => answer('<html>');
  await assert.rejects(fetchWeather({ places: one, fetchImpl: garbage }), /not JSON/);
  const huge = async () => answer(`[${'0,'.repeat(40000)}0]`);
  await assert.rejects(fetchWeather({ places: one, fetchImpl: huge }), /more than 64 KB/);
});

test('only skylines with real places have weather', () => {
  assert.equal(placesFor({ preset: 'jalisco' }), JALISCO_PLACES);
  assert.equal(placesFor({ preset: 'osaka' }), null);
  assert.equal(placesFor(null), null);
  assert.deepEqual(JALISCO_PLACES.map((p) => p.name), ['Guadalajara', 'Los Altos', 'Tequila']);
});
