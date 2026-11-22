import { fetchWeather } from './open-meteo.js';
import { fetchAirQuality } from './air-quality.js';

/**
 * Read the three forecasts together and attach the optional PM2.5 reading to Guadalajara alone.
 * @param {{ places: import('./places.js').WeatherPlace[], fetchImpl: typeof fetch }} options
 */
export async function fetchLiveWeather({ places, fetchImpl }) {
  const [forecast, airQuality] = await Promise.all([
    fetchWeather({ places, fetchImpl }),
    fetchAirQuality({ place: places[0], fetchImpl }).catch((error) => ({ pm25: null, problems: [error.message] })),
  ]);
  forecast.places[0].pm25 = airQuality.pm25;
  return { ...forecast, airQuality };
}
