// Gate for haze over Guadalajara, a modifier read from Open-Meteo's air-quality API:
//   node tools/conductor/gates/weather-haze.js
// It checks the contract in tools/conductor/tasks/weather-haze.md: the second request
// (Guadalajara only, optional, tested with a fake fetch), the PM2.5 threshold, the
// `<state>+haze` input, the title, and the art: over Guadalajara only, in clear and
// cloudy weather, washed away by rain and storms. weather-unchanged.js checks the rest.
import * as conditions from '../../../src/weather/conditions.js';
import { OPEN_METEO_URL } from '../../../src/weather/open-meteo.js';
import { JALISCO_PLACES } from '../../../src/weather/places.js';
import { weatherFor } from '../../../src/action/weather.js';
import { parseSkyline } from '../../../src/landscape/skyline-parse.js';
import { fakeFetch, jaliscoSpec, jaliscoSvg, rasterProblems, report, sceneProblems } from './weather-checks.js';

const MAX_EXTRA_KB = 60;
const AIR_QUALITY = 'https://air-quality-api.open-meteo.com/v1/air-quality';
// The gate checks a module and fields the task adds, so it reads them untyped.
const { WEATHER_MODIFIERS: modifiers, parseWeatherInput } = /** @type {any} */ (conditions);
const AIR_QUALITY_MODULE = '../../../src/weather/air-quality.js';
const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); };

check(Array.isArray(modifiers) && modifiers.includes('haze') && modifiers.includes('wind'), 'WEATHER_MODIFIERS must list "haze" next to "wind"');

/** @type {any} */
let air = null;
try {
  air = await import(AIR_QUALITY_MODULE);
} catch (error) {
  problems.push(`src/weather/air-quality.js does not load: ${error.message}`);
}

// The input: `<state>+haze`, with or without wind, in any order.
const parsed = (input) => {
  try {
    return parseWeatherInput(input).states;
  } catch (error) {
    problems.push(`parseWeatherInput("${input}") throws: ${error.message}`);
    return [];
  }
};
const is = (entry, state, mods) =>
  entry?.state === state && ['wind', 'haze'].every((m) => (mods.includes(m) ? entry[m] === true : !entry[m]));
check(parsed('clear+haze').every((e) => is(e, 'clear', ['haze'])), 'parseWeatherInput("clear+haze") must give { state: "clear", haze: true } for every place');
for (const input of ['cloudy+wind+haze', 'cloudy+haze+wind']) {
  check(parsed(input).every((e) => is(e, 'cloudy', ['wind', 'haze'])), `parseWeatherInput("${input}") must give { state: "cloudy", wind: true, haze: true }`);
}
check(parsed('rain+wind').every((e) => is(e, 'rain', ['wind'])), 'wind alone must still parse as before');

// The second request.
const [city] = JALISCO_PLACES;
if (air) {
  check(air.AIR_QUALITY_URL === AIR_QUALITY, `AIR_QUALITY_URL must be ${AIR_QUALITY}`);
  const url = new URL(air.airQualityUrl(city));
  check(url.origin + url.pathname === AIR_QUALITY, `airQualityUrl asks ${url.origin + url.pathname}`);
  check(url.searchParams.get('current') === 'pm2_5', 'airQualityUrl must ask for current=pm2_5');
  check(url.searchParams.get('latitude') === city.latitude.toFixed(4) && url.searchParams.get('longitude') === city.longitude.toFixed(4),
    'airQualityUrl must send the place coordinates with four decimals, as weatherUrl does');
  const pm = async (value) => air.fetchAirQuality({ place: city, fetchImpl: fakeFetch([[AIR_QUALITY, { current: { pm2_5: value } }]]).impl, retryDelay: 0 });
  check((await pm(37.5))?.pm25 === 37.5, 'fetchAirQuality must return { pm25 } from current.pm2_5');
  for (const bad of [-1, 5000, 'x', null]) {
    const out = await pm(bad).catch((error) => ({ thrown: error.message }));
    check(out?.pm25 === null && out?.problems?.length === 1, `pm2_5 ${JSON.stringify(bad)} must give pm25 null and one problem, got ${JSON.stringify(out)}`);
  }
  const down = fakeFetch([[AIR_QUALITY, new Error('offline')]]);
  const failed = await air.fetchAirQuality({ place: city, fetchImpl: down.impl, retryDelay: 0 }).then(() => false, () => true);
  check(failed, 'fetchAirQuality must throw when the air-quality API cannot be reached');
}

// End to end: the Action's live reading.
const weatherAnswer = [[0, 24], [3, 18], [0, 22]].map(([weather_code, temperature_2m]) => ({ current: { weather_code, temperature_2m } }));
async function liveWith(pm25) {
  const lines = [];
  const fetch = fakeFetch([[OPEN_METEO_URL, weatherAnswer], [AIR_QUALITY, pm25 instanceof Error ? pm25 : { current: { pm2_5: pm25 } }]]);
  const out = await weatherFor({ mode: 'live' }, parseSkyline('jalisco'), { fetchImpl: fetch.impl, log: (l) => lines.push(l) }).catch((error) => {
    problems.push(`weatherFor live throws: ${error.message}`);
    return null;
  });
  return { out, lines, asked: fetch.asked };
}
const hazy = await liveWith(80);
check(hazy.out?.[0]?.haze === true && !hazy.out?.[1]?.haze && !hazy.out?.[2]?.haze, `PM2.5 80 must give haze in Guadalajara only: ${JSON.stringify(hazy.out)}`);
const quality = hazy.asked.filter((u) => u.startsWith(AIR_QUALITY));
check(quality.length === 1, `weatherFor live must ask the air-quality API once, asked ${quality.length} time(s)`);
check(quality.every((u) => new URL(u).searchParams.get('latitude') === city.latitude.toFixed(4)), 'the air-quality request is for Guadalajara');
check(!(await liveWith(55)).out?.[0]?.haze, 'PM2.5 55 is not haze: it must be above 55');
check((await liveWith(55.1)).out?.[0]?.haze === true, 'PM2.5 55.1 is haze');
const offline = await liveWith(new Error('offline'));
check(offline.out?.[0]?.state === 'clear' && offline.out?.[1]?.state === 'cloudy' && !offline.out?.[0]?.haze,
  `when the air-quality API fails, the weather must stay and there is no haze: ${JSON.stringify(offline.out)}`);
check(offline.lines.some((l) => l.startsWith('::notice::') && !l.includes('\n')), 'a failed air-quality request must leave one ::notice:: line');
const never = fakeFetch([]);
const fixedOut = await weatherFor({ mode: 'fixed', states: ['clear', 'clear', 'clear'] }, parseSkyline('jalisco'), { fetchImpl: never.impl, log: () => {} });
check(never.asked.length === 0 && fixedOut?.length === 3, 'fixed weather must not ask any API');
const sampleOut = await weatherFor({ mode: 'live' }, parseSkyline('jalisco'), { sample: true, fetchImpl: never.impl, log: () => {} });
check(never.asked.length === 0 && Array.isArray(sampleOut), 'the sample run must not ask any API');

// The scenes.
if (!problems.length) {
  const H = (state, extra = {}) => ({ state, haze: true, ...extra });
  const svg = (weather) => jaliscoSvg(weather);
  for (const state of ['clear', 'cloudy']) {
    const plain = svg([state, state, state]);
    const withHaze = svg([H(state), state, state]);
    check(withHaze !== plain, `"${state}+haze" draws exactly like "${state}" over Guadalajara`);
    const extra = (withHaze.length - plain.length) / 1024;
    check(extra <= MAX_EXTRA_KB, `"${state}+haze" adds ${extra.toFixed(1)} KB; keep it under ${MAX_EXTRA_KB} KB`);
    problems.push(...sceneProblems([H(state), state, state], `"${state}+haze"`, [state, state, state]));
    check(svg([state, H(state), H(state)]) === plain, `haze is drawn over Guadalajara only: "${state}+haze" changes Los Altos or Tequila`);
  }
  for (const state of ['rain', 'storm']) {
    check(svg([H(state), state, state]) === svg([state, state, state]), `rain washes the haze away: "${state}+haze" must draw like "${state}"`);
  }
  const windy = { state: 'clear', wind: true };
  check(svg([H('clear', { wind: true }), windy, windy]) !== svg([windy, windy, windy]), 'haze must still show with wind');
  problems.push(...rasterProblems([H('clear'), 'clear', 'clear'], '"clear+haze"'));
  const title = (weather, language = 'en') => jaliscoSpec(weather, { language }).title;
  check(title([H('clear'), 'cloudy', 'clear']).includes('Weather: Guadalajara clear with haze, Los Altos cloudy, Tequila clear'),
    `the English title must say "clear with haze": ${title([H('clear'), 'cloudy', 'clear'])}`);
  check(title([H('clear'), 'cloudy', 'clear'], 'es').includes('Clima: Guadalajara despejado con calima, Los Altos nublado, Tequila despejado'),
    `the Spanish title must say "despejado con calima": ${title([H('clear'), 'cloudy', 'clear'], 'es')}`);
  check(title([H('clear', { wind: true }), 'clear', 'clear']).includes('Guadalajara clear with wind and haze'), 'with both: "clear with wind and haze"');
  check(title([H('clear', { wind: true }), 'clear', 'clear'], 'es').includes('Guadalajara despejado con viento y calima'), 'con ambos: "despejado con viento y calima"');
  check(!/haze/.test(title([H('rain'), 'rain', 'rain'])) && !/haze|calima/.test(title(['clear', H('clear'), 'clear'], 'es')),
    'the title names haze only where it is drawn (not in rain, not outside Guadalajara)');
}

report('weather-haze', problems, 'read on its own, optional, named and drawn over Guadalajara in clear and cloudy weather');
