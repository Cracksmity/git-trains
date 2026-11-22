// Current weather from Open-Meteo (https://open-meteo.com, data CC BY 4.0): no key,
// one request for every place. Callers inject fetch, so tests never touch the network
// and the browser can pass its own.
import { readCurrentWeather } from './conditions.js';

export const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const ATTEMPTS = 2;

/**
 * The request for the current reading at each place.
 * @param {Array<{ latitude: number, longitude: number }>} places
 * @returns {string}
 */
export function weatherUrl(places) {
  const coordinate = (key) => places.map((p) => p[key].toFixed(4)).join(',');
  const query = new URLSearchParams({
    latitude: coordinate('latitude'),
    longitude: coordinate('longitude'),
    current: 'weather_code,temperature_2m,wind_speed_10m',
  });
  return `${OPEN_METEO_URL}?${query}`;
}

/**
 * Reads the current weather at each place. Network and server errors are retried
 * once; an answer that can't be read throws, and a place with a bad reading comes
 * back with a null state and a problem.
 * @param {object} options
 * @param {Array<{ latitude: number, longitude: number }>} options.places
 * @param {typeof fetch} options.fetchImpl
 * @param {number} [options.timeoutMs]
 * @param {number} [options.retryDelay]
 * @returns {Promise<ReturnType<typeof readCurrentWeather>>}
 */
export async function fetchWeather({ places, fetchImpl, timeoutMs, retryDelay }) {
  const data = await fetchOpenMeteoJson(weatherUrl(places), { fetchImpl, timeoutMs, retryDelay });
  return readCurrentWeather(data, places.length);
}

/**
 * Read a bounded JSON response from either Open-Meteo endpoint.
 * @param {string} url
 * @param {{ fetchImpl: typeof fetch, timeoutMs?: number, retryDelay?: number, retryUnreadable?: boolean }} options
 */
export async function fetchOpenMeteoJson(url, { fetchImpl, timeoutMs = 10000, retryDelay = 1500, retryUnreadable = false }) {
  let failure = '';
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, retryDelay));
    let response;
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
    } catch (error) {
      failure = `could not reach Open-Meteo: ${error.message}`;
      continue;
    }
    if (response.status >= 500) {
      failure = `Open-Meteo answered ${response.status}`;
      continue;
    }
    if (!response.ok) throw new Error(`Open-Meteo answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
    let text;
    try {
      text = await response.text();
    } catch (error) {
      if (!retryUnreadable) throw error;
      failure = `could not read Open-Meteo: ${error.message}`;
      continue;
    }
    if (text.length > 64 * 1024) throw new Error('Open-Meteo answered more than 64 KB');
    try {
      return JSON.parse(text);
    } catch {
      failure = 'Open-Meteo answered something that is not JSON';
      if (!retryUnreadable) throw new Error(failure);
    }
  }
  throw new Error(failure);
}
