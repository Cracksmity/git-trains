import { requestGitHub, sleep } from './client.js';

// Repo mode: the train describes a repository instead of a user, so any project
// can put a living train in its README. This file reads the repository and
// returns the same shapes as github.js (days, languages, profile numbers,
// departures), so everything downstream (summarize, buildSpec, the calendar and
// the cards) is reused as it is.
//
// The commit activity comes from the REST statistics endpoint, which can answer
// 202 while GitHub computes it; the other numbers come from GraphQL. A plain
// GITHUB_TOKEN reads public repositories and the workflow's own one.

const API = 'https://api.github.com';
const DAY = 86400000;

// Same policy as github.js: 5xx and network blips are retried with backoff, anything
// else (bad token, unknown repository) fails right away.
const isoDay = (d) => d.toISOString().slice(0, 10);

// "owner/name" (a github.com URL and a trailing .git are accepted too) -> { owner, name, full }.
export function parseRepo(value) {
  const text = String(value ?? '')
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  const m = /^([A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?)\/([A-Za-z0-9_.-]+)$/.exec(text);
  if (!m || m[2] === '.' || m[2] === '..') {
    throw new Error(`"repo" must look like owner/name (for example Cracksmity/git-trains), not "${String(value).trim()}"`);
  }
  return { owner: m[1], name: m[2], full: `${m[1]}/${m[2]}` };
}

// One request to GitHub. Statuses in `soft` come back as { status, data: null, headers }
// instead of failing (202: still computing; 204: nothing there; 409: empty repository).
// `label` names the repository in the 404 message.
async function call({ token, path, body, fetchImpl, retryDelay = 1500, soft = [202, 204], label }) {
  return requestGitHub(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      authorization: `bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'git-trains',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }, { fetchImpl, retryDelay, soft, repositoryLabel: label });
}

// ctx: { token, fetchImpl, retryDelay, repo: { owner, name, full } }
const rest = (ctx, path, extra = {}) => call({ ...ctx, path: `/repos/${ctx.repo.owner}/${ctx.repo.name}${path}`, label: ctx.repo.full, ...extra });

async function graphql(ctx, query) {
  const { owner, name, full } = ctx.repo;
  const { data: body } = await call({ ...ctx, path: '/graphql', body: { query, variables: { owner, name } }, label: full });
  const notFound = new Error(`Repository "${full}" not found, or the token can't see it`);
  if (body.errors?.some((e) => e.type === 'NOT_FOUND')) throw notFound;
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  if (!body.data?.repository) throw notFound;
  return body.data.repository;
}

// --- Activity: days and languages -------------------------------------------------

// /stats/commit_activity: [{ week (unix seconds, a Sunday 00:00 UTC), days: [7 counts, Sunday first], total }].
// -> [{ date, count }] ascending, up to `today`.
function daysFromWeeks(weeks, today) {
  const limit = isoDay(today);
  return weeks
    .flatMap((w) => w.days.map((count, i) => ({ date: isoDay(new Date((w.week + i * 86400) * 1000)), count })))
    .filter((d) => d.date <= limit)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// The statistics answer 202 while GitHub computes them: ask again a few times, with a
// pause. Returns the days, or null if they never came (or there is nothing to count).
async function statsDays(ctx, { attempts, delay, today }) {
  for (let i = 0; i < attempts; i++) {
    const r = await rest(ctx, '/stats/commit_activity');
    if (r.status === 200 && Array.isArray(r.data) && r.data.length) return daysFromWeeks(r.data, today);
    if (r.status !== 202) return null; // 204 or an empty answer: nothing to wait for
    if (i < attempts - 1) await sleep(delay);
  }
  return null;
}

// Fallback: count the commits one by one (the last 364 days, newest first). Merge commits are left
// out, as GitHub's statistics leave them out, so both ways give the same numbers. It stops after
// MAX_PAGES pages, so on a very busy repository the oldest days come out light.
const MAX_PAGES = 10;
async function listedDays(ctx, { today }) {
  const first = new Date(`${isoDay(today)}T00:00:00Z`).getTime() - 363 * DAY;
  const since = new Date(first).toISOString();
  const counts = new Map();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await rest(ctx, `/commits?since=${since}&per_page=100&page=${page}`, { soft: [202, 204, 409] }); // 409: empty repository
    if (!Array.isArray(r.data) || !r.data.length) break;
    for (const c of r.data) {
      if (c.parents?.length > 1) continue;
      const day = (c.commit?.author?.date ?? c.commit?.committer?.date ?? '').slice(0, 10);
      if (day) counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    if (r.data.length < 100) break;
  }
  const days = [];
  for (let t = first; isoDay(new Date(t)) <= isoDay(today); t += DAY) {
    const date = isoDay(new Date(t));
    days.push({ date, count: counts.get(date) ?? 0 });
  }
  return days;
}

// /languages: { "JavaScript": bytes, ... } -> [{ name, color, bytes }] (the API gives no colors).
async function languagesOf(ctx) {
  const r = await rest(ctx, '/languages');
  return Object.entries(r.data ?? {}).map(([name, bytes]) => ({ name, color: null, bytes }));
}

// Returns what summarize() takes, plus what tells the rest this is a repository:
// { user (the repository name, for the sign and the captions), fullName, seed (the full name,
// so the city is unique to the repository), kind: 'repo', days, languages }.
//   statsAttempts / statsDelay: how many times to ask for the statistics while GitHub answers 202,
//   and the pause between them (ms). onNotice(message): called when the fallback is used.
/** @returns {Promise<import('../activity/types.js').Activity>} */
export async function fetchRepoActivity({
  token,
  repo,
  today = new Date(),
  fetchImpl = fetch,
  retryDelay = undefined,
  statsAttempts = 5,
  statsDelay = 3000,
  onNotice = (_message) => {},
}) {
  const r = typeof repo === 'string' ? parseRepo(repo) : repo;
  const ctx = { token, fetchImpl, retryDelay, repo: r };
  const languages = await languagesOf(ctx);
  let days = await statsDays(ctx, { attempts: statsAttempts, delay: statsDelay, today });
  if (!days) {
    onNotice(`The commit statistics of ${r.full} are not ready; counting its commits one by one instead`);
    days = await listedDays(ctx, { today });
  }
  return { user: r.name, fullName: r.full, seed: r.full, kind: 'repo', days, languages };
}

// --- Numbers for the stats card and the unlockable cars -----------------------------

const PROFILE_QUERY = `
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    nameWithOwner
    stargazerCount
    forkCount
    watchers { totalCount }
    openIssues: issues(states: OPEN) { totalCount }
    allIssues: issues { totalCount }
    openPrs: pullRequests(states: OPEN) { totalCount }
    allPrs: pullRequests { totalCount }
  }
}`;

// The number of contributors: the last page number of a listing with one per page.
async function contributorsOf(ctx) {
  const r = await rest(ctx, '/contributors?per_page=1&anon=true');
  const link = r.headers?.get?.('link') ?? '';
  const last = /[?&]page=(\d+)[^>]*>;\s*rel="last"/.exec(link);
  return last ? Number(last[1]) : Array.isArray(r.data) ? r.data.length : 0;
}

// Returns { repo (owner/name), name, stars, forks, watchers, openIssues, issues, openPrs, prs, contributors }.
// `contributors` is null when it can't be read; any other failure fails the call.
export async function fetchRepoProfile({ token, repo, fetchImpl = fetch, retryDelay = undefined }) {
  const r = typeof repo === 'string' ? parseRepo(repo) : repo;
  const ctx = { token, fetchImpl, retryDelay, repo: r };
  const [q, contributors] = await Promise.all([graphql(ctx, PROFILE_QUERY), contributorsOf(ctx).catch(() => null)]);
  return {
    repo: q.nameWithOwner,
    name: r.name,
    stars: q.stargazerCount,
    forks: q.forkCount,
    watchers: q.watchers.totalCount,
    openIssues: q.openIssues.totalCount,
    issues: q.allIssues.totalCount,
    openPrs: q.openPrs.totalCount,
    prs: q.allPrs.totalCount,
    contributors,
  };
}

// --- Departures: the latest releases and tags ----------------------------------------

const RELEASES_QUERY = `
query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    releases(first: 10, orderBy: { field: CREATED_AT, direction: DESC }) {
      nodes { tagName publishedAt createdAt isPrerelease isDraft }
    }
    refs(refPrefix: "refs/tags/", first: 10, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
      nodes {
        name
        target {
          ... on Commit { committedDate }
          ... on Tag { tagger { date } target { ... on Commit { committedDate } } }
        }
      }
    }
  }
}`;

// When a tag was made: an annotated tag has a tagger date; a lightweight tag is its commit.
const tagDate = (target) => target?.tagger?.date ?? target?.committedDate ?? target?.target?.committedDate ?? null;

// The `limit` latest releases, newest first; tags that have no release fill in behind them.
// Returns [{ name (the tag), pushedAt (ISO 8601, UTC), kind: 'release' | 'prerelease' | 'tag' }],
// the shape of fetchDepartures with a `kind` where the user's board has a language.
export async function fetchRepoReleases({ token, repo, limit = 6, fetchImpl = fetch, retryDelay = undefined }) {
  const r = typeof repo === 'string' ? parseRepo(repo) : repo;
  const q = await graphql({ token, fetchImpl, retryDelay, repo: r }, RELEASES_QUERY);
  const rows = q.releases.nodes
    .filter((x) => !x.isDraft)
    .map((x) => ({ name: x.tagName, pushedAt: x.publishedAt ?? x.createdAt, kind: x.isPrerelease ? 'prerelease' : 'release' }));
  const seen = new Set(rows.map((x) => x.name));
  for (const t of q.refs.nodes) {
    const pushedAt = tagDate(t.target);
    if (!seen.has(t.name) && pushedAt) rows.push({ name: t.name, pushedAt, kind: 'tag' });
  }
  return rows
    .filter((x) => x.pushedAt)
    .sort((a, b) => b.pushedAt.localeCompare(a.pushedAt))
    .slice(0, limit);
}
