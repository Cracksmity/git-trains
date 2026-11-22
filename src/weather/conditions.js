// What the sky is doing over a place, reduced to the states a scene can draw.
// Only the classification and the input format live here; src/scene/weather.js draws it.

/** The weather states the scenes know how to draw, from calm to wild. */
export const WEATHER_STATES = ['clear', 'frost', 'heat', 'partly', 'cloudy', 'fog', 'drizzle', 'rain', 'storm', 'hail'];

/** The name of each state in the scene's accessible title. */
export const WEATHER_NAMES = {
  en: { clear: 'clear', frost: 'frost', heat: 'heat', partly: 'partly cloudy', cloudy: 'cloudy', fog: 'fog', drizzle: 'drizzle', rain: 'rain', storm: 'storm', hail: 'hail' },
  es: { clear: 'despejado', frost: 'helada', heat: 'calor', partly: 'medio nublado', cloudy: 'nublado', fog: 'neblina', drizzle: 'llovizna', rain: 'lluvia', storm: 'tormenta', hail: 'granizo' },
};

// WMO weather interpretation codes, as Open-Meteo reports them. Clear/partly codes
// can become frost or heat in readCurrentWeather. Snow still borrows the closest
// state (see docs/weather-backlog.md for the designs still to draw).
const CODES = {
  clear: [0],
  partly: [1, 2],
  cloudy: [3],
  fog: [45, 48],
  drizzle: [51, 53, 55, 56, 57],
  rain: [61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86],
  storm: [95],
  hail: [96, 99],
};
const FROST_MAX_C = 2;
const HEAT_MIN_C = 32;
const STATE_OF_CODE = new Map(Object.entries(CODES).flatMap(([state, codes]) => codes.map((code) => [code, state])));

/**
 * The state for a WMO weather code, or null for a code the scenes do not know.
 * @param {unknown} code
 * @returns {string | null}
 */
export function stateOfCode(code) {
  return (Number.isInteger(code) && STATE_OF_CODE.get(/** @type {number} */ (code))) || null;
}

/**
 * @typedef {object} PlaceWeather
 * @property {string | null} state a key of WEATHER_STATES, or null when the reading was unusable
 * @property {number | null} code the WMO code as reported
 * @property {number | null} temperature degrees Celsius at 2 m
 */

/**
 * Reads an Open-Meteo `current` answer for `count` places. Every field is checked, and
 * an unusable place becomes a null state with its problems listed, so one bad
 * reading never stops the scene.
 * @param {unknown} data the parsed JSON: an array for several places, an object for one
 * @param {number} count how many places were asked for
 * @returns {{ places: PlaceWeather[], problems: string[] }}
 */
export function readCurrentWeather(data, count) {
  const list = Array.isArray(data) ? data : [data];
  const problems = [];
  if (list.length !== count) problems.push(`expected ${count} place(s), got ${list.length}`);
  const places = Array.from({ length: count }, (_, i) => {
    const current = /** @type {any} */ (list[i])?.current;
    const where = `place ${i + 1}`;
    if (!current || typeof current !== 'object') {
      problems.push(`${where}: no "current" block`);
      return { state: null, code: null, temperature: null };
    }
    const code = current.weather_code;
    const baseState = stateOfCode(code);
    if (!baseState) problems.push(`${where}: unknown weather_code ${JSON.stringify(code)?.slice(0, 20)}`);
    const t = current.temperature_2m;
    const temperature = typeof t === 'number' && t >= -60 && t <= 60 ? t : null;
    if (temperature === null && t !== undefined) problems.push(`${where}: temperature_2m out of range`);
    let state = baseState;
    if (temperature !== null && (baseState === 'clear' || baseState === 'partly')) {
      if (temperature <= FROST_MAX_C) state = 'frost';
      else if (temperature >= HEAT_MIN_C) state = 'heat';
    }
    return { state, code: state ? code : null, temperature };
  });
  return { places, problems };
}

/**
 * @typedef {{ mode: 'off' } | { mode: 'live' } | { mode: 'fixed', states: string[] }} WeatherInput
 */

/**
 * The `weather` input: off, live, or one state for every place, or a comma-separated
 * state per place in track order (Guadalajara, Los Altos, Tequila).
 * @param {string} value
 * @param {number} [places] how many places the scene has
 * @returns {WeatherInput}
 */
export function parseWeatherInput(value, places = 3) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text || text === 'off') return { mode: 'off' };
  if (text === 'live') return { mode: 'live' };
  const states = text.split(',').map((s) => s.trim());
  const bad = states.filter((s) => !WEATHER_STATES.includes(s));
  if (bad.length || (states.length !== 1 && states.length !== places)) {
    throw new Error(
      `Unknown weather: "${value}". Options: off, live, ${WEATHER_STATES.join(', ')}, ` +
        `or one state per place separated by commas (${places} places)`,
    );
  }
  return { mode: 'fixed', states: states.length === 1 ? Array(places).fill(states[0]) : states };
}
