import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchYear } from '../../src/github/user.js';
import { FIRST_YEAR, buildReview, defaultReviewYear, parseReviewYear, yearNumbers } from '../../src/review/data.js';
import { sampleYear, SAMPLE_NOW } from '../../src/demo/sample.js';

// --- The numbers -----------------------------------------------------------------------------

const run = (start, counts) =>
  counts.map((count, i) => ({ date: new Date(Date.parse(`${start}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10), count }));

// --- Reading a year from GitHub -------------------------------------------------------------

const reply = (body, ok = true, status = 200) => async () => ({
  ok,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const week = (...days) => ({ contributionDays: days.map(([date, contributionCount]) => ({ date, contributionCount })) });

const repo = (name, color, commits) => ({
  repository: name ? { primaryLanguage: { name, color } } : { primaryLanguage: null },
  contributions: { totalCount: commits },
});

const yearAnswer = (weeks, repos = [], login = 'ana') => ({
  data: { user: { login, contributionsCollection: { contributionCalendar: { weeks }, commitContributionsByRepository: repos } } },
});

// --- Which year ------------------------------------------------------------------------------

test('the review is of the current year so far, except in January, when it is the year that just ended', () => {
  assert.equal(defaultReviewYear(new Date('2026-11-05T10:00:00Z')), 2026);
  assert.equal(defaultReviewYear(new Date('2026-02-01T00:00:00Z')), 2026);
  assert.equal(defaultReviewYear(new Date('2026-12-31T23:59:59Z')), 2026);
  assert.equal(defaultReviewYear(new Date('2027-01-01T00:00:00Z')), 2026);
  assert.equal(defaultReviewYear(new Date('2027-01-31T23:59:59Z')), 2026);
  assert.equal(defaultReviewYear(new Date('2027-02-01T00:00:00Z')), 2027);
});

test('review-year is empty for the default, or a year from 2008 to the current one', () => {
  const now = new Date('2026-11-05T10:00:00Z');
  assert.equal(parseReviewYear('', now), 2026);
  assert.equal(parseReviewYear(undefined, now), 2026);
  assert.equal(parseReviewYear(' 2024 ', now), 2024);
  assert.equal(parseReviewYear(String(FIRST_YEAR), now), 2008);
  assert.equal(parseReviewYear('2026', now), 2026);
  assert.equal(parseReviewYear('', new Date('2027-01-10T00:00:00Z')), 2026);
  assert.equal(parseReviewYear('2027', new Date('2027-01-10T00:00:00Z')), 2027);
  for (const bad of ['2007', '2027', '24', 'last', '2024.5', '-2024', '2e3']) {
    assert.throws(() => parseReviewYear(bad, now), /"review-year" must be a year from 2008 to 2026, or empty for 2026/, bad);
  }
});

test('the year in numbers: total, active days, longest streak, busiest day and month', () => {
  const days = [
    ...run('2025-01-01', [0, 3, 2, 0, 5, 5, 5, 1, 0]), // streaks of 2 (Jan 2-3) and 4 (Jan 5-8)
    ...run('2025-03-10', [1, 1, 9, 1, 1, 1, 1, 0]), // a streak of 7 from Mar 10, with the busiest day on Mar 12
    ...run('2025-06-01', [4, 0, 4]),
  ];
  const n = yearNumbers(days, 2025);
  assert.equal(n.total, 3 + 2 + 5 + 5 + 5 + 1 + 1 + 1 + 9 + 1 + 1 + 1 + 1 + 4 + 4);
  assert.equal(n.activeDays, 4 + 2 + 7 + 2);
  assert.equal(n.daysCovered, days.length);
  assert.deepEqual(n.longest, { length: 7, start: '2025-03-10', end: '2025-03-16' });
  assert.deepEqual(n.busiest, { date: '2025-03-12', count: 9 });
  assert.equal(n.months.length, 12);
  assert.equal(n.months[0], 3 + 2 + 5 + 5 + 5 + 1);
  assert.equal(n.months[2], 15);
  assert.equal(n.months[5], 8);
  assert.equal(n.months.reduce((a, b) => a + b, 0), n.total);
  assert.deepEqual(n.busiestMonth, { index: 0, count: 21 });
});

test('ties go to the earliest: the longest streak, the busiest day and the busiest month', () => {
  const n = yearNumbers([...run('2025-02-01', [3, 3]), ...run('2025-04-01', [3, 3]), ...run('2025-05-01', [2, 2, 2])], 2025);
  assert.deepEqual(n.longest, { length: 3, start: '2025-05-01', end: '2025-05-03' });
  const tie = yearNumbers([...run('2025-02-01', [3, 3]), ...run('2025-04-01', [3, 3])], 2025);
  assert.deepEqual(tie.longest, { length: 2, start: '2025-02-01', end: '2025-02-02' });
  assert.deepEqual(tie.busiest, { date: '2025-02-01', count: 3 });
  assert.deepEqual(tie.busiestMonth, { index: 1, count: 6 });
});

test('a missing day breaks a streak, only the days of the year count, and an empty year is empty', () => {
  const gap = yearNumbers([{ date: '2025-05-01', count: 2 }, { date: '2025-05-03', count: 2 }], 2025);
  assert.equal(gap.longest.length, 1, 'May 2 is not in the data, so nothing connects them');
  const edges = yearNumbers([...run('2024-12-30', [5, 5, 5, 5]), ...run('2025-12-30', [2, 2, 2, 2])], 2025);
  assert.equal(edges.total, 5 + 5 + 2 + 2, 'Jan 1 and 2, Dec 30 and 31');
  assert.deepEqual(edges.longest, { length: 2, start: '2025-01-01', end: '2025-01-02' }, 'the earliest of two');
  assert.equal(edges.daysCovered, 4);
  const none = yearNumbers(run('2025-01-01', [0, 0, 0]), 2025);
  assert.deepEqual(
    { ...none, months: undefined },
    { total: 0, activeDays: 0, daysCovered: 3, longest: null, busiest: null, months: undefined, busiestMonth: null },
  );
  assert.deepEqual(none.months, new Array(12).fill(0));
  const nothing = yearNumbers([], 2025);
  assert.equal(nothing.daysCovered, 0);
  const one = yearNumbers([{ date: '2025-07-04', count: 1 }], 2025);
  assert.deepEqual(one.longest, { length: 1, start: '2025-07-04', end: '2025-07-04' });
});

test('a streak crosses the end of a month and a leap day', () => {
  const n = yearNumbers(run('2024-02-27', [1, 1, 1, 1, 1]), 2024);
  assert.deepEqual(n.longest, { length: 5, start: '2024-02-27', end: '2024-03-02' });
});

test('the review carries the year, the languages, the train and who it is for', () => {
  const r = buildReview(sampleYear(2025), { year: 2025 });
  assert.equal(r.user, 'octocat');
  assert.equal(r.year, 2025);
  assert.equal(r.daysCovered, 365);
  assert.equal(r.longest.length, r.streak);
  assert.ok(r.longest.length >= 41);
  assert.deepEqual(r.busiest, { date: '2025-03-14', count: 58 });
  assert.equal(r.unlock, null);
  assert.deepEqual(r.languages.map((l) => l.name), ['TypeScript', 'Python', 'Rust', 'Luau']);
  assert.ok(Math.abs(r.languages.reduce((a, l) => a + l.share, 0) - 1) < 1e-9);
  assert.equal(buildReview(sampleYear(2025), { year: 2025, exclude: ['python', ' Luau '] }).languages.length, 2);
  // The cars come from the year's own total.
  assert.equal(r.cars, buildReview({ ...sampleYear(2025), days: [{ date: '2025-01-01', count: 30 }] }, { year: 2025 }).cars + 3);
});

test('the sample year is a whole year, and a year in progress stops at the sample day', () => {
  assert.equal(sampleYear(2025).days.length, 365);
  assert.equal(sampleYear(2024).days.length, 366);
  const so = sampleYear(2026, SAMPLE_NOW);
  assert.equal(so.days.at(-1).date, '2026-11-02');
  assert.equal(so.days.length, 306);
  assert.deepEqual(sampleYear(2025), sampleYear(2025));
});

test('fetchYear asks for the calendar year, with the token and the user', async () => {
  let seen;
  const r = await fetchYear({
    token: 'secret',
    user: 'ana',
    year: 2025,
    today: new Date('2026-11-05T10:00:00Z'),
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return reply(yearAnswer([week(['2025-01-01', 2], ['2025-01-02', 0])]))();
    },
  });
  assert.equal(seen.url, 'https://api.github.com/graphql');
  assert.equal(seen.init.headers.authorization, 'bearer secret');
  const sent = JSON.parse(seen.init.body);
  assert.deepEqual(sent.variables, { login: 'ana', from: '2025-01-01T00:00:00Z', to: '2025-12-31T23:59:59Z' });
  assert.match(sent.query, /contributionsCollection\(from: \$from, to: \$to\)/);
  assert.match(sent.query, /commitContributionsByRepository\(maxRepositories: 100\)/);
  assert.match(sent.query, /primaryLanguage \{ name color \}/);
  assert.equal(r.user, 'ana');
  assert.equal(r.year, 2025);
  assert.deepEqual(r.days, [{ date: '2025-01-01', count: 2 }, { date: '2025-01-02', count: 0 }]);
});

test('for the year in progress the window ends now; days from other years or the future are dropped', async () => {
  let sent;
  const r = await fetchYear({
    token: 't',
    user: 'ana',
    year: 2026,
    today: new Date('2026-11-02T10:30:00Z'),
    fetchImpl: async (url, init) => {
      sent = JSON.parse(init.body);
      return reply(
        yearAnswer([
          week(['2025-12-31', 9], ['2026-01-01', 1]),
          week(['2026-11-01', 0], ['2026-11-02', 4], ['2026-11-03', 0], ['2027-01-01', 3]),
        ]),
      )();
    },
  });
  assert.equal(sent.variables.from, '2026-01-01T00:00:00Z');
  assert.equal(sent.variables.to, '2026-11-02T10:30:00.000Z');
  assert.deepEqual(r.days.map((d) => d.date), ['2026-01-01', '2026-11-01', '2026-11-02']);
});

test('the languages of the year are the primary languages of the repositories committed to', async () => {
  const r = await fetchYear({
    token: 't',
    user: 'ana',
    year: 2025,
    today: new Date('2026-11-05T10:00:00Z'),
    fetchImpl: reply(
      yearAnswer([], [
        repo('Go', '#00ADD8', 40),
        repo('Rust', '#dea584', 10),
        repo(null, null, 99), // no primary language: it says nothing
        repo('Go', null, 5),
        repo('Zig', '#ec915c', 0),
      ]),
    ),
  });
  assert.deepEqual(r.languages, [
    { name: 'Go', color: '#00ADD8', bytes: 45 },
    { name: 'Rust', color: '#dea584', bytes: 10 },
  ]);
});

test('fetchYear retries like the other queries, fails clearly, and refuses a year that cannot exist', async () => {
  const today = new Date('2026-11-05T10:00:00Z');
  let calls = 0;
  const flaky = async () => {
    calls++;
    if (calls === 1) throw new Error('socket hang up');
    if (calls === 2) return reply({ message: 'bad gateway' }, false, 502)();
    return reply(yearAnswer([week(['2025-05-01', 1])]))();
  };
  const r = await fetchYear({ token: 't', user: 'ana', year: 2025, today, fetchImpl: flaky, retryDelay: 1 });
  assert.equal(calls, 3);
  assert.equal(r.days.length, 1);

  calls = 0;
  const denied = async () => (calls++, reply({ message: 'nope' }, false, 401)());
  await assert.rejects(fetchYear({ token: 'secret', user: 'a', year: 2025, today, fetchImpl: denied, retryDelay: 1 }), (e) => /401/.test(e.message) && !e.message.includes('secret'));
  assert.equal(calls, 1);
  await assert.rejects(fetchYear({ token: 't', user: 'nobody', year: 2025, today, fetchImpl: reply({ data: { user: null } }) }), /User "nobody" not found/);
  await assert.rejects(fetchYear({ token: 't', user: 'a', year: 2025, today, fetchImpl: reply({ errors: [{ message: 'Bad credentials' }] }) }), /Bad credentials/);
  await assert.rejects(fetchYear({ token: 't', user: 'a', year: 2027, today, fetchImpl: reply({}) }), /The year 2027 has not started yet/);
  await assert.rejects(fetchYear({ token: 't', user: 'a', year: 2007, today, fetchImpl: reply({}) }), /Not a year to review/);
  await assert.rejects(fetchYear({ token: 't', user: 'a', year: '2025', today, fetchImpl: reply({}) }), /Not a year to review/);
});
