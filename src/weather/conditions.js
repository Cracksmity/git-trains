// What the sky is doing over a place, reduced to the states a scene can draw.
// Only the classification and the input format live here; src/scene/weather.js draws it.

/** The weather states the scenes know how to draw, from calm to wild. */
export const WEATHER_STATES = ['clear', 'frost', 'heat', 'partly', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'storm', 'hail'];
export const WEATHER_MODIFIERS = ['wind', 'haze'];
const HAZY_STATES = new Set(['clear', 'partly', 'cloudy', 'heat', 'fog']);

/** The name of each state in the scene's accessible title. */
export const WEATHER_NAMES = {
  en: { clear: 'clear', frost: 'frost', heat: 'heat', partly: 'partly cloudy', cloudy: 'cloudy', fog: 'fog', drizzle: 'drizzle', rain: 'rain', snow: 'snow', storm: 'storm', hail: 'hail' },
  es: { clear: 'despejado', frost: 'helada', heat: 'calor', partly: 'medio nublado', cloudy: 'nublado', fog: 'neblina', drizzle: 'llovizna', rain: 'lluvia', snow: 'nieve', storm: 'tormenta', hail: 'granizo' },
};

// WMO weather interpretation codes, as Open-Meteo reports them. Clear/partly codes
// can become frost or heat in readCurrentWeather.
const CODES = {
  clear: [0],
  partly: [1, 2],
  cloudy: [3],
  fog: [45, 48],
  drizzle: [51, 53, 55, 56, 57],
  rain: [61, 63, 65, 66, 67, 80, 81, 82],
  snow: [71, 73, 75, 77, 85, 86],
  storm: [95],
  hail: [96, 99],
};
const FROST_MAX_C = 2;
const HEAT_MIN_C = 32;
const WIND_MIN_KMH = 40;
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
 * @property {number | null} windSpeed km/h at 10 m
 * @property {number | null} [pm25] fine particles in µg/m³, measured separately for Guadalajara
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
      return { state: null, code: null, temperature: null, windSpeed: null };
    }
    const code = current.weather_code;
    const baseState = stateOfCode(code);
    if (!baseState) problems.push(`${where}: unknown weather_code ${JSON.stringify(code)?.slice(0, 20)}`);
    const t = current.temperature_2m;
    const temperature = typeof t === 'number' && t >= -60 && t <= 60 ? t : null;
    if (temperature === null && t !== undefined) problems.push(`${where}: temperature_2m out of range`);
    const speed = current.wind_speed_10m;
    const windSpeed = typeof speed === 'number' && speed >= 0 && speed <= 200 ? speed : null;
    if (windSpeed === null && Object.hasOwn(current, 'wind_speed_10m')) problems.push(`${where}: wind_speed_10m out of range`);
    let state = baseState;
    if (temperature !== null && (baseState === 'clear' || baseState === 'partly')) {
      if (temperature <= FROST_MAX_C) state = 'frost';
      else if (temperature >= HEAT_MIN_C) state = 'heat';
    }
    return { state, code: state ? code : null, temperature, windSpeed };
  });
  return { places, problems };
}

/**
 * What a scene draws over one place, from a fixed input or a live reading.
 * @typedef {object} PlaceSky
 * @property {string} state a key of WEATHER_STATES
 * @property {number | null} [temperature] degrees Celsius at 2 m, from a live reading only
 * @property {boolean} [wind] set by +wind or a live wind speed of at least 40 km/h
 * @property {boolean} [haze] set by +haze or a live Guadalajara PM2.5 reading above 55 µg/m³
 */

/** @param {string} placeId @param {PlaceSky | null | undefined} sky */
export function showsHaze(placeId, sky) {
  return placeId === 'guadalajara' && sky?.haze === true && HAZY_STATES.has(sky.state);
}

/**
 * One entry of a scene's weather, a state name or a PlaceSky, as a PlaceSky. Null when it
 * names no state the scenes know. The other fields are kept for the designs that read them.
 * @param {unknown} entry
 * @returns {PlaceSky | null}
 */
export function placeSky(entry) {
  if (typeof entry === 'string') return WEATHER_STATES.includes(entry) ? { state: entry } : null;
  if (!entry || typeof entry !== 'object') return null;
  const sky = /** @type {PlaceSky} */ (entry);
  return WEATHER_STATES.includes(sky.state) ? { ...sky } : null;
}

/**
 * What a live reading draws, or null when its state could not be read.
 * @param {{ state: string | null, temperature: number | null, windSpeed?: number | null, pm25?: number | null }} reading
 * @returns {PlaceSky | null}
 */
export function skyOfReading(reading) {
  if (!reading.state) return null;
  const sky = { state: reading.state, temperature: reading.temperature };
  if (reading.windSpeed >= WIND_MIN_KMH) sky.wind = true;
  if (reading.pm25 > 55) sky.haze = true;
  return sky;
}

/**
 * @typedef {{ mode: 'off' } | { mode: 'live' } | { mode: 'fixed', states: Array<string | PlaceSky> }} WeatherInput
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
  const entries = text.split(',').map((s) => s.split('+').map((part) => part.trim()));
  const invalid = entries.some(([state, ...modifiers]) =>
    !WEATHER_STATES.includes(state) || modifiers.some((mod) => !WEATHER_MODIFIERS.includes(mod)));
  if (invalid || (entries.length !== 1 && entries.length !== places)) {
    throw new Error(
      `Unknown weather: "${value}". Options: off, live, ${WEATHER_STATES.join(', ')}, ` +
        `or one state per place separated by commas (${places} places). Modifiers: ${WEATHER_MODIFIERS.map((m) => '+' + m).join(', ')}`,
    );
  }
  const states = Array.from({ length: places }, (_, i) => {
    const [state, ...modifiers] = entries[i] ?? entries[0];
    return modifiers.length ? { state, ...Object.fromEntries(modifiers.map((mod) => [mod, true])) } : state;
  });
  return { mode: 'fixed', states };
}
