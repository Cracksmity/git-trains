// Turns raw GitHub activity into what the train needs.

import { languageColor } from './languages.js';

// Contributions in the last year needed for cars 2..6.
export const CAR_THRESHOLDS = [50, 200, 500, 1000, 2000];

export function carsFor(total) {
  return 1 + CAR_THRESHOLDS.filter((t) => total >= t).length;
}

// Yesterday's activity -> how the train behaves.
export function stateFor(yesterday) {
  if (yesterday <= 0) return 'idle';
  if (yesterday <= 3) return 'slow';
  if (yesterday <= 9) return 'normal';
  return 'fast';
}

// Consecutive days with activity. If there is nothing yet today, the streak is
// still alive from yesterday (so it doesn't "break" at 6 in the morning).
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

// days: [{ date, count }] in ascending order; languages: [{ name, color, bytes }].
// exclude: language names to leave out (any case), e.g. ['HTML', 'Jupyter Notebook'].
// Anything else that comes with the activity is passed through: repo mode (see repo.js) brings
// `kind: 'repo'`, `fullName` and `seed`, which the title, the calendar caption and the city read.
export function summarize({ user, days, languages, ...identity }, { exclude = [] } = {}) {
  const total = days.reduce((a, d) => a + d.count, 0);
  const yesterday = days.length >= 2 ? days[days.length - 2].count : 0;
  const skip = new Set(exclude.map((n) => n.trim().toLowerCase()).filter(Boolean));

  const merged = new Map();
  for (const l of languages) {
    if (skip.has(l.name.toLowerCase())) continue;
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
    ...identity,
    total,
    yesterday,
    streak: streakFrom(days),
    cars: carsFor(total),
    state: stateFor(yesterday),
    languages: langs,
    days,
  };
}
