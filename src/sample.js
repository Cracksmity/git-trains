// Sample data for testing without a token or network.

import { summarize } from './stats.js';

// Generate a year of activity with a reproducible pattern.
export function sampleDays({ total = 1400, streak = 12, yesterday = 6 } = {}) {
  const days = [];
  const today = new Date('2026-11-02T00:00:00Z');
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const weekend = [0, 6].includes(d.getUTCDay());
    days.push({ date: d.toISOString().slice(0, 10), count: rand() < (weekend ? 0.3 : 0.75) ? 1 + Math.floor(rand() * 9) : 0 });
  }
  // Adjust the approximate total, streak, and yesterday.
  const sum = days.reduce((a, d) => a + d.count, 0) || 1;
  for (const d of days) d.count = Math.round((d.count * total) / sum);
  for (let i = 0; i < streak; i++) days[days.length - 1 - i].count ||= 1;
  if (streak < days.length) days[days.length - 1 - streak].count = 0;
  days[days.length - 2].count = yesterday;
  if (yesterday === 0) days[days.length - 1].count = 0;
  return days;
}

export const SAMPLE_LANGUAGES = [
  { name: 'TypeScript', color: '#3178c6', bytes: 640000 },
  { name: 'Python', color: '#3572A5', bytes: 380000 },
  { name: 'Rust', color: '#dea584', bytes: 190000 },
  { name: 'Luau', color: '#00A2FF', bytes: 60000 },
];

export function sampleStats(overrides = {}) {
  return summarize(
    {
      user: 'octocat',
      days: sampleDays(overrides),
      languages: SAMPLE_LANGUAGES,
    },
    { exclude: overrides.exclude },
  );
}

// Sample profile figures for the cards.
export function sampleProfile() {
  return {
    login: 'octocat',
    name: 'The Octocat',
    followers: 120,
    stars: 340,
    commits: 880,
    prs: 64,
    issues: 21,
    contributed: 18,
    reviews: 12,
  };
}
