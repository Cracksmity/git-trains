// The weather the scene wears: a fixed state from the workflow, or the current
// reading at the skyline's places. If it can't be read the scene still stands.
import { skyOfReading } from '../weather/conditions.js';
import { fetchWeather } from '../weather/open-meteo.js';
import { placesFor } from '../weather/places.js';
import { localTheme } from '../weather/sun.js';
import { sampleWeather } from '../demo/sample.js';

// Workflow commands end at a newline and decode %: keep foreign text on one line.
const annotation = (text) => String(text).replace(/%/g, '%25').replace(/\r?\n/g, '%0A');

/**
 * One weather entry per place, in track order, or null for no weather. A fixed input
 * gives state names or states with modifiers. A live reading also carries the temperature.
 * @param {import('../weather/conditions.js').WeatherInput} request
 * @param {{ preset?: string } | null} skyline
 * @param {{ sample?: boolean, fetchImpl?: typeof fetch, log?: (line: string) => void }} [options]
 * @returns {Promise<Array<string | import('../weather/conditions.js').PlaceSky | null> | null>}
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
    const sky = readings.map(skyOfReading);
    const summary = places.map((place, i) => {
      const reading = readings[i];
      const { state, temperature } = reading;
      const wind = sky[i]?.wind && 'windSpeed' in reading ? `, wind ${reading.windSpeed} km/h` : '';
      return `${place.name} ${state ?? 'unknown'}${temperature === null ? '' : ` ${Math.round(temperature)}°C`}${wind}`;
    });
    log(`Weather (Open-Meteo): ${summary.join(', ')}`);
    return sky;
  } catch (error) {
    log(`::notice::Could not read the weather, the scene stays without it: ${annotation(error.message)}`);
    return null;
  }
}

/**
 * The theme to draw with. `local` becomes light while the sun is up over the skyline's
 * first place when the Action runs, and dark after sunset; a skyline without places
 * falls back to auto, which follows the viewer.
 * @param {string} theme
 * @param {{ preset?: string } | null} skyline
 * @param {Date} now
 * @param {(line: string) => void} [log]
 */
export function themeFor(theme, skyline, now, log = console.log) {
  if (theme !== 'local') return theme;
  const local = localTheme(skyline, now);
  if (!local) {
    log('::notice::theme local needs a skyline with real places behind its tracks (jalisco); using auto');
    return 'auto';
  }
  const where = local.elevation >= 0 ? 'above' : 'below';
  log(`Theme local: the sun is ${Math.abs(Math.round(local.elevation))}° ${where} the horizon in ${local.place} -> ${local.theme}`);
  return local.theme;
}
