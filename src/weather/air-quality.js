// Guadalajara's current particle concentration from Open-Meteo (CC BY 4.0).
import { fetchOpenMeteoJson } from './open-meteo.js';

export const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

/** @param {{ latitude: number, longitude: number }} place */
export function airQualityUrl(place) {
  const query = new URLSearchParams({
    latitude: place.latitude.toFixed(4),
    longitude: place.longitude.toFixed(4),
    current: 'pm2_5',
  });
  return `${AIR_QUALITY_URL}?${query}`;
}

/**
 * @param {{ place: Parameters<typeof airQualityUrl>[0], fetchImpl: typeof fetch, timeoutMs?: number, retryDelay?: number }} options
 * @returns {Promise<{ pm25: number | null, problems: string[] }>}
 */
export async function fetchAirQuality({ place, fetchImpl, timeoutMs, retryDelay }) {
  const data = await fetchOpenMeteoJson(airQualityUrl(place), { fetchImpl, timeoutMs, retryDelay, retryUnreadable: true });
  const pm25 = data?.current?.pm2_5;
  return typeof pm25 === 'number' && pm25 >= 0 && pm25 <= 1000
    ? { pm25, problems: [] }
    : { pm25: null, problems: ['expected current.pm2_5 between 0 and 1000 µg/m³'] };
}
