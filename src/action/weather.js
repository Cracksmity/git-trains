// The weather the scene wears: a fixed state from the workflow, or the current
// reading at the skyline's places. If it can't be read the scene still stands,
// with the last good reading when the workflow keeps one (weather-cache).
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { showsHaze, skyOfReading } from '../weather/conditions.js';
import { fetchLiveWeather } from '../weather/live.js';
import { placesFor } from '../weather/places.js';
import { CACHE_MAX_BYTES, cacheEntry, formatAge, readingsFromCache } from '../weather/reading-cache.js';
import { localTheme } from '../weather/sun.js';
import { sampleWeather } from '../demo/sample.js';

// Workflow commands end at a newline and decode %: keep foreign text on one line.
const annotation = (text) => String(text).replace(/%/g, '%25').replace(/\r?\n/g, '%0A').replace(/\r/g, '%0D');

/** "Guadalajara rain 17°C, Sayula clear 24°C, wind 45 km/h, ..." for the log. */
function summarize(places, readings, sky) {
  return places.map((place, i) => {
    const reading = readings[i];
    const { state, temperature } = reading;
    const wind = sky[i]?.wind && 'windSpeed' in reading ? `, wind ${reading.windSpeed} km/h` : '';
    return `${place.name} ${state ?? 'unknown'}${temperature === null ? '' : ` ${Math.round(temperature)}°C`}${wind}`;
  }).join(', ');
}

/**
 * The cached readings, or why there are none.
 * @param {string} file absolute path
 * @returns {import('../weather/reading-cache.js').CachedReading | { problems: string[] }}
 */
function readCache(file, places, now) {
  let text;
  try {
    if (statSync(file).size > CACHE_MAX_BYTES) return { problems: [`it is larger than ${CACHE_MAX_BYTES / 1024} KB`] };
    text = readFileSync(file, 'utf8');
  } catch (error) {
    return { problems: [error.code === 'ENOENT' ? 'no reading saved yet' : error.message] };
  }
  try {
    return readingsFromCache(JSON.parse(text), places, now);
  } catch {
    return { problems: ['it is not valid JSON'] };
  }
}

/** Save a complete reading for the next run. A failure to save never stops the scene. */
function writeCache(file, places, readings, now, log) {
  const entry = cacheEntry(places, readings, now);
  if (!entry) return;
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(entry, null, 2)}\n`);
  } catch (error) {
    log(`::notice::Could not save the weather cache: ${annotation(error.message)}`);
  }
}

/**
 * One weather entry per place, in track order, or null for no weather. A fixed input
 * gives state names or states with modifiers. A live reading also carries the temperature.
 * @param {import('../weather/conditions.js').WeatherInput} request
 * @param {{ preset?: string } | null} skyline
 * @param {{ sample?: boolean, fetchImpl?: typeof fetch, log?: (line: string) => void, cache?: string | null, now?: Date }} [options]
 *   cache: absolute path of the weather-cache file, read when the live request fails and written after it succeeds
 * @returns {Promise<Array<string | import('../weather/conditions.js').PlaceSky | null> | null>}
 */
export async function weatherFor(request, skyline, { sample = false, fetchImpl = fetch, log = console.log, cache = null, now = new Date() } = {}) {
  if (request.mode === 'off') return null;
  const places = placesFor(skyline);
  if (!places) {
    log('::notice::weather needs a skyline with real places behind its tracks (jalisco); the scene stays without it');
    return null;
  }
  if (request.mode === 'fixed') return request.states.slice(0, places.length);
  const keep = sample ? null : cache;
  let live;
  try {
    live = sample ? { ...sampleWeather(), airQuality: null } : await fetchLiveWeather({ places, fetchImpl });
  } catch (error) {
    const saved = keep ? readCache(keep, places, now) : null;
    if (!saved || 'problems' in saved) {
      log(`::notice::Could not read the weather, the scene stays without it: ${annotation(error.message)}`);
      if (saved && 'problems' in saved) log(`::notice::The weather cache has no usable reading: ${annotation(saved.problems.join(', '))}`);
      return null;
    }
    log(`::notice::Could not read the weather, using the reading from ${formatAge(saved.age)} ago: ${annotation(error.message)}`);
    const sky = saved.readings.map(skyOfReading);
    log(`Weather (cached, ${saved.at.toISOString().slice(11, 16)} UTC): ${summarize(places, saved.readings, sky)}`);
    return sky;
  }
  const { places: readings, problems, airQuality } = live;
  for (const problem of problems) log(`::notice::Weather: ${annotation(problem)}`);
  const sky = readings.map(skyOfReading);
  log(`Weather (Open-Meteo): ${summarize(places, readings, sky)}`);
  if (airQuality) {
    const [city] = places;
    if (airQuality.pm25 === null) {
      log(`::notice::Air quality (Open-Meteo): ${city.name}: ${annotation(airQuality.problems.join(', '))}`);
    } else {
      const effect = showsHaze(city.id, sky[0]) ? ' -> haze' : '';
      log(`Air quality (Open-Meteo): ${city.name} PM2.5 ${airQuality.pm25} µg/m³${effect}`);
    }
  }
  if (keep) writeCache(keep, places, readings, now, log);
  return sky;
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
