import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRepo, fetchRepoActivity, fetchRepoProfile, fetchRepoReleases } from '../../src/github/repository.js';
import { summarize } from '../../src/activity/stats.js';
import { renderDeparturesCard } from '../../src/cards/departures.js';
import { SAMPLE_NOW } from '../../src/demo/sample.js';

const TODAY = new Date('2026-11-04T10:00:00Z');

// --- A fake GitHub ----------------------------------------------------------------

const json = (body, status = 200, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers(headers),
  json: async () => body,
  text: async () => JSON.stringify(body),
});

// routes: { 'GET /repos/o/n/languages': response | (callNumber, url, init) => response }. Every call is
// recorded in fetchImpl.calls; anything without a route is a 404.
function github(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const key = `${init.method ?? 'GET'} ${u.pathname}`;
    calls.push({ key, url: u, init });
    const route = routes[key];
    if (!route) return json({ message: 'Not Found' }, 404);
    return typeof route === 'function' ? route(calls.filter((c) => c.key === key).length, u, init) : route;
  };
  fetchImpl.calls = calls;
  fetchImpl.count = (key) => calls.filter((c) => c.key === key).length;
  return fetchImpl;
}

// 52 weeks like /stats/commit_activity: the last one is the week of `today`, so it runs on into the future.
function weeksUntil(today, countOn = () => 0) {
  const sunday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - today.getUTCDay() * DAY;
  return Array.from({ length: 52 }, (_, w) => {
    const week = (sunday - (51 - w) * 7 * DAY) / 1000;
    const days = Array.from({ length: 7 }, (_, i) => countOn(new Date((week + i * 86400) * 1000).toISOString().slice(0, 10)));
    return { week, days, total: days.reduce((a, c) => a + c, 0) };
  });
}

const STATS = 'GET /repos/ana/rails/stats/commit_activity';

const LANGS = 'GET /repos/ana/rails/languages';

const COMMITS = 'GET /repos/ana/rails/commits';

const fast = { retryDelay: 1, statsDelay: 1 };

// --- fetchRepoProfile -----------------------------------------------------------------

const graphqlAnswer = (repository) => json({ data: { repository } });

const profileData = {
  nameWithOwner: 'ana/rails',
  stargazerCount: 1200,
  forkCount: 80,
  watchers: { totalCount: 30 },
  openIssues: { totalCount: 14 },
  allIssues: { totalCount: 220 },
  openPrs: { totalCount: 5 },
  allPrs: { totalCount: 410 },
};

const CONTRIBUTORS = 'GET /repos/ana/rails/contributors';

const GRAPHQL = 'POST /graphql';

// --- fetchRepoReleases -----------------------------------------------------------------

const tagNode = (name, target) => ({ name, target });

const lightweight = (date) => ({ committedDate: date });

const annotated = (date) => ({ tagger: { date }, target: { committedDate: '2020-01-01T00:00:00Z' } });

// a Wednesday
const DAY = 86400000;

// --- parseRepo ---------------------------------------------------------------------

test('parseRepo takes owner/name, a github.com URL and a trailing .git', () => {
  assert.deepEqual(parseRepo('Cracksmity/git-trains'), { owner: 'Cracksmity', name: 'git-trains', full: 'Cracksmity/git-trains' });
  assert.equal(parseRepo('  ana/rails  ').full, 'ana/rails');
  assert.equal(parseRepo('https://github.com/ana/rails').full, 'ana/rails');
  assert.equal(parseRepo('https://github.com/ana/rails.git').full, 'ana/rails');
  assert.equal(parseRepo('ana/.github').name, '.github');
  assert.equal(parseRepo('a/b_c.d-e').name, 'b_c.d-e');
});

test('parseRepo rejects anything that is not owner/name, so nothing odd ends up in a URL', () => {
  for (const bad of ['', 'ana', 'ana/', '/rails', 'ana/rails/extra', 'ana rails', 'ana/ra ils', '-ana/rails', 'ana-/rails', 'ana/..', 'ana/.', 'ana/rails?x=1', 'ana/ra#ils', '../rails/x']) {
    assert.throws(() => parseRepo(bad), /"repo" must look like owner\/name/, JSON.stringify(bad));
  }
});

// --- fetchRepoActivity ---------------------------------------------------------------

test('the days come from the commit activity, up to today, and the languages from /languages', async () => {
  const fetchImpl = github({
    [STATS]: json(weeksUntil(TODAY, (d) => (d === '2026-11-03' ? 5 : d === '2026-11-04' ? 2 : d === '2026-11-05' ? 9 : 0))),
    [LANGS]: json({ Ruby: 9000, JavaScript: 1000 }),
  });
  const r = await fetchRepoActivity({ token: 'secret', repo: 'ana/rails', today: TODAY, fetchImpl, ...fast });

  assert.equal(r.user, 'rails', 'the label is the repository name');
  assert.equal(r.fullName, 'ana/rails');
  assert.equal(r.seed, 'ana/rails', 'the city is seeded with the full name');
  assert.equal(r.kind, 'repo');
  assert.deepEqual(r.languages, [
    { name: 'Ruby', color: null, bytes: 9000 },
    { name: 'JavaScript', color: null, bytes: 1000 },
  ]);

  // 51 full weeks + Sunday to Wednesday of this one: the days to come are dropped (the 9 commits of Thursday).
  assert.equal(r.days.length, 51 * 7 + 4);
  assert.deepEqual(r.days.slice(-3), [
    { date: '2026-11-02', count: 0 },
    { date: '2026-11-03', count: 5 },
    { date: '2026-11-04', count: 2 },
  ]);
  assert.equal(r.days[0].date, '2025-11-09'); // a Sunday, like the first column of the calendar
  const dates = r.days.map((d) => d.date);
  assert.deepEqual(dates, [...dates].sort());
  assert.equal(new Set(dates).size, dates.length);

  // Bearer token on every call, and nothing but the commit activity and the languages was asked.
  assert.ok(fetchImpl.calls.every((c) => c.init.headers.authorization === 'bearer secret'));
  assert.deepEqual(fetchImpl.calls.map((c) => c.key).sort(), [LANGS, STATS].sort());
});

test('the result feeds summarize and keeps what says it is a repository', async () => {
  const fetchImpl = github({
    [STATS]: json(weeksUntil(TODAY, (d) => (d >= '2026-11-01' ? 3 : 0))),
    [LANGS]: json({ Ruby: 9000 }),
  });
  const s = summarize(await fetchRepoActivity({ token: 't', repo: 'ana/rails', today: TODAY, fetchImpl, ...fast }));
  assert.equal(s.user, 'rails');
  assert.equal(s.fullName, 'ana/rails');
  assert.equal(s.seed, 'ana/rails');
  assert.equal(s.kind, 'repo');
  assert.equal(s.total, 12);
  assert.equal(s.streak, 4);
  assert.equal(s.yesterday, 3);
  assert.equal(s.state, 'slow');
  assert.equal(s.languages[0].name, 'Ruby');
  assert.match(s.languages[0].color, /^#[0-9a-f]{6}$/i);
});

test('while GitHub answers 202 it asks again, and uses the answer when it comes', async () => {
  const fetchImpl = github({
    [STATS]: (n) => (n < 3 ? json({}, 202) : json(weeksUntil(TODAY, (d) => (d === '2026-11-04' ? 7 : 0)))),
    [LANGS]: json({ Go: 1 }),
    [COMMITS]: () => assert.fail('the commit listing is only for when the statistics never come'),
  });
  const notices = [];
  const t0 = Date.now();
  const r = await fetchRepoActivity({
    token: 't',
    repo: 'ana/rails',
    today: TODAY,
    fetchImpl,
    retryDelay: 1,
    statsDelay: 25,
    onNotice: (m) => notices.push(m),
  });
  assert.equal(fetchImpl.count(STATS), 3, 'two 202s and then the data');
  assert.ok(Date.now() - t0 >= 40, `it waited between tries (${Date.now() - t0} ms)`);
  assert.equal(r.days.at(-1).count, 7);
  assert.deepEqual(notices, [], 'no fallback, no notice');
});

test('if the statistics never come it counts the commits one by one', async () => {
  const commit = (iso, parents = 1) => ({
    commit: { author: { date: iso }, committer: { date: '2026-11-04T09:00:00Z' } },
    parents: Array.from({ length: parents }, (_, i) => ({ sha: String(i) })),
  });
  const page1 = [
    ...Array.from({ length: 98 }, () => commit('2026-11-04T08:00:00Z')),
    commit('2026-11-03T23:30:00Z'),
    commit('2026-11-03T01:00:00Z'),
  ]; // 100 commits: there may be another page
  const page2 = [commit('2026-11-03T12:00:00Z'), commit('2026-10-15T12:00:00Z'), commit('2026-11-03T13:00:00Z', 2)]; // the last one is a merge
  const fetchImpl = github({
    [STATS]: json({}, 202),
    [LANGS]: json({ Go: 5 }),
    [COMMITS]: (n) => json(n === 1 ? page1 : page2),
  });
  const notices = [];
  const r = await fetchRepoActivity({ token: 't', repo: 'ana/rails', today: TODAY, fetchImpl, statsAttempts: 3, ...fast, onNotice: (m) => notices.push(m) });

  assert.equal(fetchImpl.count(STATS), 3, 'it tried three times before giving up');
  assert.equal(fetchImpl.count(COMMITS), 2, 'a full page means ask for the next one');
  assert.equal(notices.length, 1);
  assert.match(notices[0], /ana\/rails.*not ready/);

  const count = (date) => r.days.find((d) => d.date === date).count;
  assert.equal(count('2026-11-04'), 98);
  assert.equal(count('2026-11-03'), 3, 'a merge commit is not counted, like in the statistics');
  assert.equal(count('2026-10-15'), 1);
  assert.equal(count('2026-11-02'), 0);
  assert.equal(r.days.length, 364);
  assert.equal(r.days.at(-1).date, '2026-11-04');
  assert.equal(r.days[0].date, '2025-11-06');
  // The listing asks only for the last year.
  const asked = fetchImpl.calls.find((c) => c.key === COMMITS).url;
  assert.equal(asked.searchParams.get('since'), '2025-11-06T00:00:00.000Z');
  assert.equal(asked.searchParams.get('per_page'), '100');
});

test('an empty repository gives a year of quiet days, not an error', async () => {
  for (const stats of [json(null, 204), json([]), json({}, 202)]) {
    const fetchImpl = github({ [STATS]: stats, [LANGS]: json({}), [COMMITS]: json({ message: 'Git Repository is empty.' }, 409) });
    const s = summarize(await fetchRepoActivity({ token: 't', repo: 'ana/rails', today: TODAY, fetchImpl, statsAttempts: 2, ...fast }));
    assert.equal(s.total, 0);
    assert.equal(s.streak, 0);
    assert.equal(s.state, 'idle');
    assert.equal(s.days.length, 364);
    assert.deepEqual(s.languages, []);
  }
});

test('a repository that does not exist, or the token cannot see, says so', async () => {
  await assert.rejects(
    fetchRepoActivity({ token: 'secret', repo: 'ana/nope', fetchImpl: github({}), ...fast }),
    (e) => /Repository "ana\/nope" not found/.test(e.message) && !e.message.includes('secret'),
  );
  await assert.rejects(
    fetchRepoActivity({ token: 'secret', repo: 'ana/rails', fetchImpl: github({ [LANGS]: json({ message: 'Bad credentials' }, 401) }), ...fast }),
    (e) => /401/.test(e.message) && !e.message.includes('secret'),
  );
});

test('5xx answers and network blips are retried, a 401 is not', async () => {
  let n = 0;
  const flaky = github({
    [LANGS]: () => {
      n++;
      if (n === 1) throw new Error('socket hang up');
      return n === 2 ? json({ message: 'bad gateway' }, 502) : json({ Go: 3 });
    },
    [STATS]: json(weeksUntil(TODAY)),
  });
  const r = await fetchRepoActivity({ token: 't', repo: 'ana/rails', today: TODAY, fetchImpl: flaky, ...fast });
  assert.equal(n, 3);
  assert.equal(r.languages[0].name, 'Go');

  const down = github({ [LANGS]: json({ message: 'bad gateway' }, 502) });
  await assert.rejects(fetchRepoActivity({ token: 't', repo: 'ana/rails', fetchImpl: down, ...fast }), /502/);
  assert.equal(down.count(LANGS), 4);
});

test('the profile has the numbers for the stats card and the unlockable cars', async () => {
  const fetchImpl = github({
    [GRAPHQL]: graphqlAnswer(profileData),
    // One contributor per page: the last page number is how many there are.
    [CONTRIBUTORS]: json([{ login: 'a' }], 200, { link: '<https://api.github.com/repositories/1/contributors?per_page=1&anon=true&page=2>; rel="next", <https://api.github.com/repositories/1/contributors?per_page=1&anon=true&page=37>; rel="last"' }),
  });
  const p = await fetchRepoProfile({ token: 'secret', repo: 'ana/rails', fetchImpl });
  assert.deepEqual(p, {
    repo: 'ana/rails',
    name: 'rails',
    stars: 1200,
    forks: 80,
    watchers: 30,
    openIssues: 14,
    issues: 220,
    openPrs: 5,
    prs: 410,
    contributors: 37,
  });
  const sent = JSON.parse(fetchImpl.calls.find((c) => c.key === GRAPHQL).init.body);
  assert.deepEqual(sent.variables, { owner: 'ana', name: 'rails' });
  assert.match(sent.query, /repository\(owner: \$owner, name: \$name\)/);
});

test('a repository with a single contributor has no Link header, and an unreadable count does not sink the profile', async () => {
  const one = github({ [GRAPHQL]: graphqlAnswer(profileData), [CONTRIBUTORS]: json([{ login: 'a' }]) });
  assert.equal((await fetchRepoProfile({ token: 't', repo: 'ana/rails', fetchImpl: one })).contributors, 1);

  const none = github({ [GRAPHQL]: graphqlAnswer(profileData), [CONTRIBUTORS]: json(null, 204) });
  assert.equal((await fetchRepoProfile({ token: 't', repo: 'ana/rails', fetchImpl: none })).contributors, 0);

  const broken = github({ [GRAPHQL]: graphqlAnswer(profileData), [CONTRIBUTORS]: json({ message: 'too many' }, 403) });
  const p = await fetchRepoProfile({ token: 't', repo: 'ana/rails', fetchImpl: broken });
  assert.equal(p.contributors, null);
  assert.equal(p.stars, 1200);
});

test('GraphQL errors on a repository come through clearly', async () => {
  const missing = github({
    [GRAPHQL]: json({ data: { repository: null }, errors: [{ type: 'NOT_FOUND', message: "Could not resolve to a Repository with the name 'ana/rails'." }] }),
    [CONTRIBUTORS]: json([]),
  });
  await assert.rejects(fetchRepoProfile({ token: 't', repo: 'ana/rails', fetchImpl: missing }), /Repository "ana\/rails" not found/);
  const limited = github({
    [GRAPHQL]: json({ data: null, errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }] }),
    [CONTRIBUTORS]: json([]),
  });
  await assert.rejects(fetchRepoProfile({ token: 't', repo: 'ana/rails', fetchImpl: limited }), /API rate limit exceeded/);
});

test('the departures are the latest releases, with the tags that have no release behind them', async () => {
  const fetchImpl = github({
    [GRAPHQL]: graphqlAnswer({
      releases: {
        nodes: [
          { tagName: 'v2.0.0', publishedAt: '2026-11-02T10:00:00Z', createdAt: '2026-11-01T10:00:00Z', isPrerelease: false, isDraft: false },
          { tagName: 'v2.1.0-beta', publishedAt: '2026-11-03T10:00:00Z', createdAt: '2026-11-03T09:00:00Z', isPrerelease: true, isDraft: false },
          { tagName: 'v9.9.9', publishedAt: null, createdAt: '2026-11-04T10:00:00Z', isPrerelease: false, isDraft: true },
          { tagName: 'v1.0.0', publishedAt: null, createdAt: '2026-06-01T10:00:00Z', isPrerelease: false, isDraft: false },
        ],
      },
      refs: {
        nodes: [
          tagNode('v2.0.0', lightweight('2026-11-01T09:00:00Z')), // already a release
          tagNode('nightly', lightweight('2026-10-30T03:00:00Z')),
          tagNode('v0.9.0', annotated('2026-03-01T12:00:00Z')),
          tagNode('broken', null),
        ],
      },
    }),
  });
  const r = await fetchRepoReleases({ token: 't', repo: 'ana/rails', fetchImpl });
  assert.deepEqual(r, [
    { name: 'v2.1.0-beta', pushedAt: '2026-11-03T10:00:00Z', kind: 'prerelease' },
    { name: 'v2.0.0', pushedAt: '2026-11-02T10:00:00Z', kind: 'release' },
    { name: 'nightly', pushedAt: '2026-10-30T03:00:00Z', kind: 'tag' },
    { name: 'v1.0.0', pushedAt: '2026-06-01T10:00:00Z', kind: 'release' }, // a release made without publishing date uses when it was created
    { name: 'v0.9.0', pushedAt: '2026-03-01T12:00:00Z', kind: 'tag' },
  ]);
  const three = await fetchRepoReleases({ token: 't', repo: 'ana/rails', limit: 3, fetchImpl });
  assert.deepEqual(three.map((x) => x.name), ['v2.1.0-beta', 'v2.0.0', 'nightly']);
});

test('a repository with no releases and no tags has an empty board', async () => {
  const fetchImpl = github({ [GRAPHQL]: graphqlAnswer({ releases: { nodes: [] }, refs: { nodes: [] } }) });
  assert.deepEqual(await fetchRepoReleases({ token: 't', repo: 'ana/rails', fetchImpl }), []);
  assert.ok(renderDeparturesCard([], 'ana/rails', { repo: true, now: SAMPLE_NOW }).includes('NO DEPARTURES'));
});
