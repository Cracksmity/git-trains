// Turns the stats into the scene description that renderScene understands.

import { MODEL_ORDER, getModel } from '../trains/models.js';
import { JALISCO_TRAINS } from '../trains/jalisco.js';
import { DEFAULT_COLOR } from '../activity/languages.js';
import { trainWidth } from '../trains/geometry.js';
import { SCENE_W } from './layout.js';
import { UNLOCK_IDS, unlockThreshold } from '../activity/unlocks.js';
import { WEATHER_NAMES, WEATHER_STATES } from '../weather/conditions.js';
import { placesFor } from '../weather/places.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const MODES = ['single', 'multi'];
export const LANGUAGES = ['en', 'es'];

// Word on the LED sign before the streak number, and the scene's accessible title.
const TEXT = {
  en: {
    label: 'STREAK',
    days: (n) => (n === 1 ? 'DAY' : 'DAYS'),
    title: (s) => `${s.user}'s train: ${s.cars} car${s.cars === 1 ? '' : 's'}, ${s.streak}-day streak`,
    repoTitle: (s) => `Train for ${s.fullName}: ${s.cars} car${s.cars === 1 ? '' : 's'}, ${s.streak}-day commit streak`,
    unlock: {
      dining: (n) => `Dining car unlocked: ${n}-day streak`,
      observation: (n) => `Observation car unlocked: ${n}+ stars`,
      mail: (n) => `Mail car unlocked: ${n}+ pull requests`,
    },
    weather: 'Weather',
  },
  es: {
    label: 'RACHA',
    days: (n) => (n === 1 ? 'DÍA' : 'DÍAS'),
    title: (s) => `Tren de ${s.user}: ${s.cars} ${s.cars === 1 ? 'vagón' : 'vagones'}, racha de ${s.streak} día${s.streak === 1 ? '' : 's'}`,
    repoTitle: (s) => `Tren de ${s.fullName}: ${s.cars} ${s.cars === 1 ? 'vagón' : 'vagones'}, racha de commits de ${s.streak} día${s.streak === 1 ? '' : 's'}`,
    unlock: {
      dining: (n) => `Vagón comedor desbloqueado: racha de ${n} días`,
      observation: (n) => `Vagón mirador desbloqueado: más de ${n} estrellas`,
      mail: (n) => `Vagón postal desbloqueado: más de ${n} pull requests`,
    },
    weather: 'Clima',
  },
};

// opts.train: 'auto' (evolves with the number of cars), a model id, or a custom
//   model already validated by parseCustomModel. A custom train runs on the main
//   track; in multi mode the other tracks follow the automatic evolution.
// opts.mode: 'single' (one train in your top language) or 'multi' (3 tracks, one train per language).
// opts.skyline: a skyline already validated by parseSkyline, or null for the procedural city.
// opts.language: 'en' or 'es' (LED sign word and title); opts.label overrides the sign word.
// opts.date: a day (Date or YYYY-MM-DD) that dresses the scene for its season or holiday (see seasons.js);
//   without it the scene stays plain. opts.hemisphere: 'north' (default) or 'south'. opts.seasons: false ignores the date.
// opts.unlock: the special car the profile earned (see unlocks.js), or null. It joins the
//   main train right behind the cab and adds a line to the title. Next to a full-length
//   train it takes the place of the last regular car, so the train still fits the scene.
// opts.weather: one weather state per track (see src/weather/conditions.js), or null. Only
//   skylines with real places behind their tracks (the jalisco preset) wear it; the title names it.
export function buildSpec(stats, opts = {}) {
  const { train = 'auto', mode = 'single', theme = 'auto', language = 'en', scale = 2, skyline = null } = opts;
  const unlock = opts.unlock ?? null;
  if (!MODES.includes(mode)) throw new Error(`Unknown mode: "${mode}". Options: ${MODES.join(', ')}`);
  if (unlock && !UNLOCK_IDS.includes(unlock)) {
    throw new Error(`Unknown unlock: "${unlock}". Options: ${UNLOCK_IDS.join(', ')}`);
  }
  const text = TEXT[language] ?? TEXT.en;
  const label = opts.label || text.label;

  const custom = typeof train === 'object' && train !== null ? train : null;
  const jalisco = train === 'jalisco';
  const baseId = custom || jalisco || train === 'auto' ? MODEL_ORDER[stats.cars - 1] : getModel(train).id;
  const baseIdx = MODEL_ORDER.indexOf(baseId);

  const langs = stats.languages.length
    ? stats.languages
    : [{ name: 'Code', color: DEFAULT_COLOR, bytes: 1, share: 1 }];
  const picked = mode === 'multi' ? langs.slice(0, 3) : langs.slice(0, 1);

  const tracks = picked.map((l, i) => ({
    model: custom && i === 0 ? custom : MODEL_ORDER[(baseIdx + 2 * i) % MODEL_ORDER.length],
    cars: i === 0 ? stats.cars : clamp(Math.round((stats.cars * l.bytes) / picked[0].bytes), 1, stats.cars),
    stripe: l.color,
    streak: stats.streak,
    label,
    dir: i % 2 === 0 ? 1 : -1,
    state: stats.state,
    caption:
      mode === 'multi'
        ? `${l.name} ${Math.round(l.share * 100)}%`
        : `${l.name} - ${stats.total}`,
  }));

  const places = placesFor(skyline);
  if (jalisco) {
    tracks.forEach((track, i) => {
      track.model = JALISCO_TRAINS[i];
      // Every caption reads "place / language %"; the regional trains carry no
      // LED sign, so the streak hangs on a plaque beneath the station sign.
      const place = skyline?.preset === 'jalisco' ? `${places[i].name} / ` : '';
      track.caption = place + track.caption;
    });
    tracks[0].plaque = `${label} ${stats.streak} ${text.days(stats.streak)}`;
  }

  if (unlock) {
    const lead = tracks[0];
    const model = typeof lead.model === 'string' ? getModel(lead.model) : lead.model;
    lead.extra = unlock;
    while (lead.cars > 1 && trainWidth(model, lead.cars, true) > SCENE_W) lead.cars--;
  }

  const weather = places && Array.isArray(opts.weather)
    ? tracks.map((_, i) => (WEATHER_STATES.includes(opts.weather[i]) ? opts.weather[i] : null))
    : null;
  const names = WEATHER_NAMES[language] ?? WEATHER_NAMES.en;
  const forecast = weather?.some(Boolean)
    ? `${text.weather}: ${weather.flatMap((state, i) => (state ? [`${places[i].name} ${names[state]}`] : [])).join(', ')}`
    : '';

  // Repo mode (see repo.js): the title names the repository, and the city is seeded with its full name.
  const title = stats.kind === 'repo' ? text.repoTitle(stats) : text.title(stats);
  const lines = [title, unlock ? text.unlock[unlock](unlockThreshold(unlock)) : '', forecast].filter(Boolean);
  return {
    theme,
    scale,
    user: stats.user,
    ...(stats.seed ? { seed: stats.seed } : {}),
    title: lines.join('\n'),
    skyline,
    tracks,
    ...(opts.date && opts.seasons !== false ? { date: opts.date, hemisphere: opts.hemisphere ?? 'north' } : {}),
    ...(forecast ? { weather } : {}),
  };
}
