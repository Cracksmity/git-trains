// Gate for wind in the Jalisco weather, a modifier that combines with any state:
//   node tools/conductor/gates/weather-wind.js
// It checks the contract in tools/conductor/tasks/weather-wind.md: the Open-Meteo field,
// its validation, the 40 km/h threshold, the `<state>+wind` input, the title, and that
// wind draws in every state, slants whatever falls, and stays light and still for
// reduced motion. weather-unchanged.js checks that the scenes without wind did not move.
import * as conditions from '../../../src/weather/conditions.js';
import { OPEN_METEO_URL, weatherUrl } from '../../../src/weather/open-meteo.js';
import { JALISCO_PLACES } from '../../../src/weather/places.js';
import { weatherFor } from '../../../src/action/weather.js';
import { parseSkyline } from '../../../src/landscape/skyline-parse.js';
import { fakeFetch, jaliscoSpec, jaliscoSvg, rasterProblems, report, sceneProblems } from './weather-checks.js';

const MAX_EXTRA_KB = 60;
const FALLING = ['drizzle', 'rain', 'storm', 'hail'];
// The gate checks fields the task adds, so it reads the module untyped.
const { WEATHER_STATES, WEATHER_MODIFIERS: modifiers, parseWeatherInput, readCurrentWeather, skyOfReading } = /** @type {any} */ (conditions);
const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); };
const attempt = (label, fn) => {
  try {
    return fn();
  } catch (error) {
    problems.push(`${label} throws: ${error.message}`);
    return undefined;
  }
};

check(Array.isArray(modifiers) && modifiers.includes('wind'), 'src/weather/conditions.js must export WEATHER_MODIFIERS with "wind"');

// The input: `<state>+wind`, for every place or per place.
const windy = (state) => ({ state, wind: true });
const fixed = (input) => attempt(`parseWeatherInput("${input}")`, () => parseWeatherInput(input));
// Compared by meaning, so key order and false flags don't matter.
const isWindy = (entry, state) => entry?.state === state && entry.wind === true;
const all = fixed('rain+wind');
check(all?.mode === 'fixed' && all.states.length === 3 && all.states.every((e) => isWindy(e, 'rain')),
  `parseWeatherInput("rain+wind") gives ${JSON.stringify(all)}, not three { state: "rain", wind: true }`);
const mixed = fixed('storm+wind, clear, Hail+Wind');
check(isWindy(mixed?.states[0], 'storm') && mixed?.states[1] === 'clear' && isWindy(mixed?.states[2], 'hail'),
  `parseWeatherInput("storm+wind, clear, Hail+Wind") gives ${JSON.stringify(mixed?.states)}`);
check(JSON.stringify(fixed('rain')?.states) === JSON.stringify(['rain', 'rain', 'rain']), 'a plain state must still parse to state names');
try {
  parseWeatherInput('rain+gust');
  problems.push('parseWeatherInput("rain+gust") must throw: "gust" is not a modifier');
} catch (error) {
  check(/wind/.test(error.message), `the error for "rain+gust" must list the modifiers: ${error.message}`);
}

// The reading: wind_speed_10m in km/h, from 0 to 200, and windy from 40 km/h.
const url = new URL(weatherUrl(JALISCO_PLACES));
check((url.searchParams.get('current') ?? '').split(',').includes('wind_speed_10m'), `the Open-Meteo request does not ask for wind_speed_10m: ${url}`);
const reading = (current) => readCurrentWeather([{ current }], 1);
const at = (speed) => reading({ weather_code: 61, temperature_2m: 18, wind_speed_10m: speed });
check(at(45).places[0].windSpeed === 45 && !at(45).problems.length, 'readCurrentWeather must keep wind_speed_10m as windSpeed (km/h)');
check(at(0).places[0].windSpeed === 0, 'a calm reading (0 km/h) is a valid windSpeed');
for (const bad of [-3, 250, '40', null]) {
  const out = at(bad);
  check(out.places[0].windSpeed === null && out.problems.length === 1, `wind_speed_10m ${JSON.stringify(bad)} must give windSpeed null and one problem`);
  check(out.places[0].state === 'rain', `a bad wind_speed_10m (${JSON.stringify(bad)}) must not lose the state`);
}
const quiet = reading({ weather_code: 61, temperature_2m: 18 });
check(quiet.places[0].windSpeed === null && !quiet.problems.length, 'a reading without wind_speed_10m gives windSpeed null and no problem');
const sky = (speed) => skyOfReading({ state: 'rain', code: 61, temperature: 18, windSpeed: speed });
check(sky(40)?.wind === true && sky(63)?.wind === true, 'skyOfReading must set wind: true from 40 km/h');
for (const speed of [39.9, 0, null]) check(!sky(speed)?.wind, `skyOfReading must not set wind at ${speed} km/h`);
check(sky(12)?.state === 'rain' && sky(12)?.temperature === 18, 'skyOfReading must keep the state and the temperature');

// End to end: the Action's live reading.
const answer = [[61, 18, 45], [0, 20, 10], [95, 22, 60]].map(([weather_code, temperature_2m, wind_speed_10m]) => ({ current: { weather_code, temperature_2m, wind_speed_10m } }));
const { impl } = fakeFetch([[OPEN_METEO_URL, answer]]);
const live = await weatherFor({ mode: 'live' }, parseSkyline('jalisco'), { fetchImpl: impl, log: () => {} }).catch((error) => {
  problems.push(`weatherFor live throws: ${error.message}`);
  return null;
});
check(live?.[0]?.wind === true && !live?.[1]?.wind && live?.[2]?.wind === true, `weatherFor live gives ${JSON.stringify(live)}: wind in Guadalajara and Tequila only`);

// The scenes.
if (!problems.length) {
  const every = (state) => [windy(state), windy(state), windy(state)];
  for (const state of WEATHER_STATES) {
    const svg = jaliscoSvg(every(state));
    const plain = jaliscoSvg([state, state, state]);
    check(svg !== plain, `"${state}+wind" draws exactly like "${state}": wind must show in every state`);
    const extra = (svg.length - plain.length) / 1024;
    check(extra <= MAX_EXTRA_KB, `"${state}+wind" adds ${extra.toFixed(1)} KB to "${state}"; keep it under ${MAX_EXTRA_KB} KB`);
  }
  for (const state of ['clear', 'cloudy', ...FALLING]) problems.push(...sceneProblems(every(state), `"${state}+wind"`, [state, state, state]));
  for (const state of FALLING) {
    // Weather keyframes are named w-…; translate( and translateX( take x first.
    const keyframes = [...jaliscoSvg(every(state)).matchAll(/@keyframes w-[\w-]+\{((?:[^{}]*\{[^{}]*\})*)\}/g)];
    const sideways = keyframes.some(([, body]) => [...body.matchAll(/translateX?\(\s*(-?[\d.]+)/g)].some(([, x]) => Number(x) !== 0));
    check(sideways, `with wind, the ${state} particles must fall slanted: no weather keyframes (w-…) move them sideways`);
  }
  problems.push(...rasterProblems(every('rain'), '"rain+wind"'), ...rasterProblems(every('clear'), '"clear+wind"'));
  const title = (weather, language) => jaliscoSpec(weather, { language }).title;
  check(title([windy('rain'), 'clear', 'storm'], 'en').includes('Weather: Guadalajara rain with wind, Los Altos clear, Tequila storm'),
    `the English title must say "rain with wind": ${title([windy('rain'), 'clear', 'storm'], 'en')}`);
  check(title([windy('rain'), 'clear', 'storm'], 'es').includes('Clima: Guadalajara lluvia con viento, Los Altos despejado, Tequila tormenta'),
    `the Spanish title must say "lluvia con viento": ${title([windy('rain'), 'clear', 'storm'], 'es')}`);
}

report('weather-wind', problems, 'read, parsed, named and drawn in every state, slanted where it falls');
