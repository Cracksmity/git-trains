// Turns the stats into the scene description that renderScene understands.

import { MODEL_ORDER, getModel } from './models.js';
import { DEFAULT_COLOR } from './languages.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const MODES = ['single', 'multi'];
export const LANGUAGES = ['en', 'es'];

// Word on the LED sign before the streak number, and the scene's accessible title.
const TEXT = {
  en: {
    label: 'STREAK',
    title: (s) => `${s.user}'s train: ${s.cars} car${s.cars === 1 ? '' : 's'}, ${s.streak}-day streak`,
  },
  es: {
    label: 'RACHA',
    title: (s) => `Tren de ${s.user}: ${s.cars} ${s.cars === 1 ? 'vagón' : 'vagones'}, racha de ${s.streak} día${s.streak === 1 ? '' : 's'}`,
  },
};

// opts.train: 'auto' (evolves with the number of cars), a model id, or a custom
//   model already validated by parseCustomModel. A custom train runs on the main
//   track; in multi mode the other tracks follow the automatic evolution.
// opts.mode: 'single' (one train in your top language) or 'multi' (3 tracks, one train per language).
// opts.skyline: a skyline already validated by parseSkyline, or null for the procedural city.
// opts.language: 'en' or 'es' (LED sign word and title); opts.label overrides the sign word.
export function buildSpec(stats, opts = {}) {
  const { train = 'auto', mode = 'single', theme = 'auto', language = 'en', scale = 2, skyline = null } = opts;
  if (!MODES.includes(mode)) throw new Error(`Unknown mode: "${mode}". Options: ${MODES.join(', ')}`);
  const text = TEXT[language] ?? TEXT.en;
  const label = opts.label || text.label;

  const custom = typeof train === 'object' && train !== null ? train : null;
  const baseId = custom || train === 'auto' ? MODEL_ORDER[stats.cars - 1] : getModel(train).id;
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

  return {
    theme,
    scale,
    user: stats.user,
    title: text.title(stats),
    skyline,
    tracks,
  };
}
