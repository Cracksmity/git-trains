// Traduce las estadísticas a la descripción de escena que entiende renderScene.

import { MODEL_ORDER, getModel } from './models.js';
import { DEFAULT_COLOR } from './languages.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const MODES = ['single', 'multi'];

// opts.tren: 'auto' (evoluciona con los vagones) o el id de un modelo.
// opts.modo: 'single' (un tren con tu lenguaje principal) o 'multi' (3 vías, un tren por lenguaje).
export function buildSpec(stats, opts = {}) {
  const { tren = 'auto', modo = 'single', theme = 'auto', label = 'RACHA', scale = 2 } = opts;
  if (!MODES.includes(modo)) throw new Error(`Modo desconocido: "${modo}". Opciones: ${MODES.join(', ')}`);

  const baseId = tren === 'auto' ? MODEL_ORDER[stats.cars - 1] : getModel(tren).id;
  const baseIdx = MODEL_ORDER.indexOf(baseId);

  const langs = stats.languages.length
    ? stats.languages
    : [{ name: 'Code', color: DEFAULT_COLOR, bytes: 1, share: 1 }];
  const picked = modo === 'multi' ? langs.slice(0, 3) : langs.slice(0, 1);

  const tracks = picked.map((l, i) => ({
    model: MODEL_ORDER[(baseIdx + 2 * i) % MODEL_ORDER.length],
    cars: i === 0 ? stats.cars : clamp(Math.round((stats.cars * l.bytes) / picked[0].bytes), 1, stats.cars),
    stripe: l.color,
    streak: stats.streak,
    label,
    dir: i % 2 === 0 ? 1 : -1,
    state: stats.state,
    caption:
      modo === 'multi'
        ? `${l.name} ${Math.round(l.share * 100)}%`
        : `${l.name} - ${stats.total}`,
  }));

  return {
    theme,
    scale,
    user: stats.user,
    title: `Tren de ${stats.user}: ${stats.cars} vagones, racha de ${stats.streak} días`,
    tracks,
  };
}
