// The weather the scene wears: a fixed state from the workflow, or the current
// reading at the skyline's places. If it can't be read the scene still stands.
import { fetchWeather } from '../weather/open-meteo.js';
import { placesFor } from '../weather/places.js';
import { sampleWeather } from '../demo/sample.js';

// Workflow commands end at a newline and decode %: keep foreign text on one line.
const annotation = (text) => String(text).replace(/%/g, '%25').replace(/\r?\n/g, '%0A');

/**
 * One weather state (or null) per place, in track order, or null for no weather.
 * @param {import('../weather/conditions.js').WeatherInput} request
 * @param {{ preset?: string } | null} skyline
 * @param {{ sample?: boolean, fetchImpl?: typeof fetch, log?: (line: string) => void }} [options]
 * @returns {Promise<Array<string | null> | null>}
 */
export async function weatherFor(request, skyline, { sample = false, fetchImpl = fetch, log = console.log } = {}) {
  if (request.mode === 'off') return null;
  const places = placesFor(skyline);
  if (!places) {
    log('::notice::weather needs a skyline with real places behind its tracks (jalisco); the scene stays without it');
    return null;
  }
  if (request.mode === 'fixed') return request.states.slice(0, places.length);
  try {
    const { places: readings, problems } = sample ? sampleWeather() : await fetchWeather({ places, fetchImpl });
    for (const problem of problems) log(`::notice::Weather: ${annotation(problem)}`);
    const summary = places.map((place, i) => {
      const { state, temperature } = readings[i];
      return `${place.name} ${state ?? 'unknown'}${temperature === null ? '' : ` ${Math.round(temperature)}°C`}`;
    });
    log(`Weather (Open-Meteo): ${summary.join(', ')}`);
    return readings.map((reading) => reading.state);
  } catch (error) {
    log(`::notice::Could not read the weather, the scene stays without it: ${annotation(error.message)}`);
    return null;
  }
}
