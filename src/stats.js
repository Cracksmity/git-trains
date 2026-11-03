// Convierte la actividad cruda de GitHub en lo que necesita el tren.

import { languageColor } from './languages.js';

// Contribuciones del último año necesarias para el vagón 2..6.
export const CAR_THRESHOLDS = [50, 200, 500, 1000, 2000];

export function carsFor(total) {
  return 1 + CAR_THRESHOLDS.filter((t) => total >= t).length;
}

// Actividad de ayer -> comportamiento del tren.
export function stateFor(yesterday) {
  if (yesterday <= 0) return 'idle';
  if (yesterday <= 3) return 'slow';
  if (yesterday <= 9) return 'normal';
  return 'fast';
}

// Días consecutivos con actividad. Si hoy aún no hay nada, la racha sigue viva
// desde ayer (para no "romperla" a las 6 de la mañana).
export function streakFrom(days) {
  let i = days.length - 1;
  if (i >= 0 && days[i].count === 0) i--;
  let streak = 0;
  while (i >= 0 && days[i].count > 0) {
    streak++;
    i--;
  }
  return streak;
}

// days: [{ date, count }] ordenados ascendente; languages: [{ name, color, bytes }]
export function summarize({ user, days, languages }) {
  const total = days.reduce((a, d) => a + d.count, 0);
  const yesterday = days.length >= 2 ? days[days.length - 2].count : 0;

  const merged = new Map();
  for (const l of languages) {
    const cur = merged.get(l.name) ?? { name: l.name, color: l.color, bytes: 0 };
    cur.bytes += l.bytes;
    cur.color ||= l.color;
    merged.set(l.name, cur);
  }
  const ranked = [...merged.values()].sort((a, b) => b.bytes - a.bytes);
  const sum = ranked.reduce((a, l) => a + l.bytes, 0) || 1;
  const langs = ranked.map((l) => ({
    name: l.name,
    color: languageColor(l.name, l.color),
    bytes: l.bytes,
    share: l.bytes / sum,
  }));

  return {
    user,
    total,
    yesterday,
    streak: streakFrom(days),
    cars: carsFor(total),
    state: stateFor(yesterday),
    languages: langs,
  };
}
