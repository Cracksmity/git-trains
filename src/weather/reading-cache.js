// The last good live reading, kept between runs by the workflow. GitHub's runners share
// IP addresses, and Open-Meteo counts its free daily quota per address, so a run can be
// refused or time out through no fault of its own. Then the scene falls back to this
// reading. This module only builds and checks the file; the Action reads and writes it.
import { WEATHER_STATES } from './conditions.js';

export const CACHE_VERSION = 1;
/** A cached reading older than this is not used. */
export const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
/** The largest cache file read back. Three places take a few hundred bytes. */
export const CACHE_MAX_BYTES = 16 * 1024;
// The clocks of two runners may disagree by a little.
const FUTURE_SLACK_MS = 5 * 60 * 1000;

/**
 * @typedef {object} CachedReading
 * @property {import('./conditions.js').PlaceWeather[]} readings one per place, in track order
 * @property {Date} at when the reading was taken
 * @property {number} age milliseconds between the reading and now
 */

/**
 * What to save after a live reading. Null when a place has no usable state, so a
 * partial reading never replaces a complete one.
 * @param {import('./places.js').WeatherPlace[]} places
 * @param {import('./conditions.js').PlaceWeather[]} readings
 * @param {Date} now
 */
export function cacheEntry(places, readings, now) {
  if (readings.length !== places.length || readings.some((reading) => !reading?.state)) return null;
  return {
    version: CACHE_VERSION,
    at: now.toISOString(),
    places: places.map((place, i) => {
      const { state, code, temperature, windSpeed, pm25 } = readings[i];
      return { id: place.id, state, code: code ?? null, temperature: temperature ?? null, windSpeed: windSpeed ?? null, pm25: pm25 ?? null };
    }),
  };
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const inRange = (value, min, max) => value === null || (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max);

/**
 * The readings in a cache file, or every reason it can't be used. The file sits in the
 * workflow's cache, so it is checked like any other data: each field, every problem.
 * @param {unknown} data the parsed file
 * @param {import('./places.js').WeatherPlace[]} places the skyline's places, in track order
 * @param {Date} now
 * @returns {CachedReading | { problems: string[] }}
 */
export function readingsFromCache(data, places, now) {
  if (!isObject(data)) return { problems: ['it is not a JSON object'] };
  const entry = /** @type {Record<string, unknown>} */ (data);
  const problems = [];
  if (entry.version !== CACHE_VERSION) problems.push(`version ${JSON.stringify(entry.version)?.slice(0, 20)} is not ${CACHE_VERSION}`);
  const at = typeof entry.at === 'string' ? new Date(entry.at) : null;
  const age = at && Number.isFinite(at.getTime()) ? now.getTime() - at.getTime() : NaN;
  if (Number.isNaN(age)) problems.push('"at" is not a date');
  else if (age < -FUTURE_SLACK_MS) problems.push('"at" is in the future');
  else if (age > CACHE_MAX_AGE_MS) problems.push(`the reading is ${formatAge(age)} old (at most ${formatAge(CACHE_MAX_AGE_MS)})`);
  const list = Array.isArray(entry.places) ? entry.places : null;
  if (!list) problems.push('"places" is not a list');
  else if (list.length !== places.length) problems.push(`it has ${list.length} place(s), the skyline has ${places.length}`);
  const readings = places.map((place, i) => {
    const item = list?.[i];
    const where = `place ${i + 1}`;
    if (!isObject(item)) {
      if (list && list.length === places.length) problems.push(`${where} is not an object`);
      return null;
    }
    const { id, state, code, temperature, windSpeed, pm25 = null } = /** @type {Record<string, any>} */ (item);
    if (id !== place.id) problems.push(`${where} is ${JSON.stringify(id)?.slice(0, 30)}, not "${place.id}"`);
    if (!WEATHER_STATES.includes(state)) problems.push(`${where}: unknown state ${JSON.stringify(state)?.slice(0, 20)}`);
    if (!(code === null || (Number.isInteger(code) && code >= 0 && code <= 99))) problems.push(`${where}: code out of range`);
    if (!inRange(temperature, -60, 60)) problems.push(`${where}: temperature out of range`);
    if (!inRange(windSpeed, 0, 200)) problems.push(`${where}: windSpeed out of range`);
    if (!inRange(pm25, 0, 1000)) problems.push(`${where}: pm25 out of range`);
    return { state, code, temperature, windSpeed, pm25 };
  });
  if (problems.length) return { problems };
  return { readings: /** @type {import('./conditions.js').PlaceWeather[]} */ (readings), at: /** @type {Date} */ (at), age: Math.max(0, age) };
}

/**
 * How long ago, for the log: "45 min", "2 h 5 min".
 * @param {number} ms
 */
export function formatAge(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} h${rest ? ` ${rest} min` : ''}`;
}
