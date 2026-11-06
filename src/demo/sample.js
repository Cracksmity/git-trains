// Sample data for testing without a token or network.

import { summarize } from '../activity/stats.js';

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

// The moment the sample departures board is read at, so the card never changes.
export const SAMPLE_NOW = new Date('2026-11-02T16:40:00Z');

// Sample repositories for the departures board: one of each status at SAMPLE_NOW.
export function sampleDepartures() {
  return [
    { name: 'git-trains', pushedAt: '2026-11-02T15:12:00Z', language: 'JavaScript' },
    { name: 'station-api', pushedAt: '2026-11-01T22:47:00Z', language: 'TypeScript' },
    { name: 'signal-box', pushedAt: '2026-10-29T08:20:00Z', language: 'Rust' },
    { name: 'timetable-cli', pushedAt: '2026-10-20T17:05:00Z', language: 'Python' },
    { name: 'ticket-office', pushedAt: '2026-10-06T11:30:00Z', language: 'Luau' },
    { name: 'old-depot', pushedAt: '2026-08-14T09:00:00Z', language: 'Go' },
  ];
}

// The sample activity of one calendar year, for the year in review: reproducible, busier in
// spring and autumn than in a quiet summer, with one long streak in April and May and one
// very busy day in March. Like the real thing, a year in progress (the one `now` is in) ends
// on `now`'s day. Returns what fetchYear returns.
export function sampleYear(year = 2025, now = SAMPLE_NOW) {
  const season = [0.6, 0.9, 1.5, 1.3, 1.1, 0.8, 0.7, 0.25, 0.9, 1.3, 1.1, 0.5]; // by month
  const days = [];
  let seed = 11 + year;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const limit = now.toISOString().slice(0, 10);
  for (let ms = Date.UTC(year, 0, 1); ms < Date.UTC(year + 1, 0, 1); ms += 86400000) {
    const d = new Date(ms);
    const date = d.toISOString().slice(0, 10);
    if (date > limit) break;
    const weekend = [0, 6].includes(d.getUTCDay());
    const k = season[d.getUTCMonth()];
    const count = rand() < Math.min(0.9, (weekend ? 0.25 : 0.7) * k) ? 1 + Math.floor(rand() * 7 * k) : 0;
    days.push({ date, count });
  }
  const set = (date, floor) => {
    const day = days.find((x) => x.date === date);
    if (day) day.count = Math.max(day.count, floor);
  };
  // 41 days in a row, from April 6 to May 16, and one busy day.
  for (let ms = Date.UTC(year, 3, 6); ms <= Date.UTC(year, 4, 16); ms += 86400000) {
    set(new Date(ms).toISOString().slice(0, 10), 1 + Math.floor(rand() * 4));
  }
  set(`${year}-03-14`, 58);
  return {
    user: 'octocat',
    year,
    days,
    // Commits to the repositories of each primary language that year.
    languages: [
      { name: 'TypeScript', color: '#3178c6', bytes: 410 },
      { name: 'Python', color: '#3572A5', bytes: 240 },
      { name: 'Rust', color: '#dea584', bytes: 120 },
      { name: 'Luau', color: '#00A2FF', bytes: 45 },
    ],
  };
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

// Repo mode (see repo.js): a made-up repository, so `--sample` and the docs need no network.
export const SAMPLE_REPO = 'octocat/signal-box';

export function sampleRepoStats(overrides = {}) {
  return summarize(
    {
      user: 'signal-box',
      fullName: SAMPLE_REPO,
      seed: SAMPLE_REPO,
      kind: 'repo',
      days: sampleDays({ total: 620, streak: 8, yesterday: 4, ...overrides }),
      languages: [
        { name: 'Rust', color: '#dea584', bytes: 520000 },
        { name: 'TypeScript', color: '#3178c6', bytes: 210000 },
        { name: 'Shell', color: '#89e051', bytes: 24000 },
      ],
    },
    { exclude: overrides.exclude },
  );
}

// The repository's numbers for the stats card (commits is added from the year's total).
export function sampleRepoProfile() {
  return {
    repo: SAMPLE_REPO,
    name: 'signal-box',
    stars: 1340,
    forks: 96,
    watchers: 41,
    openIssues: 23,
    issues: 310,
    openPrs: 7,
    prs: 188,
    contributors: 27,
  };
}

// Releases and tags for the repository's departures board: one of each kind and status at SAMPLE_NOW.
export function sampleReleases() {
  return [
    { name: 'v2.4.0', pushedAt: '2026-11-02T14:05:00Z', kind: 'release' },
    { name: 'v2.4.0-rc.1', pushedAt: '2026-10-30T09:40:00Z', kind: 'prerelease' },
    { name: 'v2.3.2', pushedAt: '2026-10-21T18:12:00Z', kind: 'release' },
    { name: 'v2.3.0', pushedAt: '2026-10-02T11:30:00Z', kind: 'release' },
    { name: 'nightly-2026-09-14', pushedAt: '2026-09-14T03:00:00Z', kind: 'tag' },
    { name: 'v2.0.0', pushedAt: '2026-06-18T16:20:00Z', kind: 'release' },
  ];
}
