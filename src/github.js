// Reads a user's public activity through the GitHub GraphQL API.

const ENDPOINT = 'https://api.github.com/graphql';

const ACTIVITY_QUERY = `
query($login: String!) {
  user(login: $login) {
    login
    contributionsCollection {
      contributionCalendar {
        weeks { contributionDays { date contributionCount } }
      }
    }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC,
                 orderBy: { field: PUSHED_AT, direction: DESC }) {
      nodes {
        languages(first: 6, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name color } }
        }
      }
    }
  }
}`;

const PROFILE_QUERY = `
query($login: String!) {
  user(login: $login) {
    login
    name
    followers { totalCount }
    pullRequests(first: 1) { totalCount }
    issues(first: 1) { totalCount }
    repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) {
      totalCount
    }
    contributionsCollection {
      totalCommitContributions
      totalPullRequestReviewContributions
    }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC,
                 orderBy: { field: STARGAZERS, direction: DESC }) {
      nodes { stargazerCount }
    }
  }
}`;

// The public repositories pushed most recently (the departures board). Forks stay out,
// as in the other queries; 30 leaves room for the ones fetchDepartures drops.
const DEPARTURES_QUERY = `
query($login: String!) {
  user(login: $login) {
    login
    repositories(first: 30, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC,
                 orderBy: { field: PUSHED_AT, direction: DESC }) {
      nodes { name pushedAt primaryLanguage { name } }
    }
  }
}`;

// One calendar year of activity: the day-by-day calendar and, for the languages, the
// primary language of every repository the user committed to that year.
const YEAR_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    login
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        weeks { contributionDays { date contributionCount } }
      }
      commitContributionsByRepository(maxRepositories: 100) {
        repository { primaryLanguage { name color } }
        contributions(first: 1) { totalCount }
      }
    }
  }
}`;

// GraphQL answers 502/503/504 now and then on heavy queries, and the network can
// blip: those are retried with backoff. Anything else (bad token, unknown user)
// fails right away.
const RETRIES = 3;
const RETRY_STATUS = new Set([500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function graphql({ token, query, user, variables = {}, fetchImpl, retryDelay = 1500 }) {
  for (let attempt = 0; ; attempt++) {
    const last = attempt === RETRIES;
    let res;
    try {
      res = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `bearer ${token}`,
          'content-type': 'application/json',
          'user-agent': 'git-trains',
        },
        body: JSON.stringify({ query, variables: { login: user, ...variables } }),
      });
    } catch (err) {
      if (last) throw new Error(`Could not reach GitHub: ${err.message}`);
      await sleep(retryDelay * 2 ** attempt);
      continue;
    }
    if (!res.ok) {
      if (RETRY_STATUS.has(res.status) && !last) {
        await sleep(retryDelay * 2 ** attempt);
        continue;
      }
      const detail = (await res.text()).slice(0, 200);
      throw new Error(`GitHub answered ${res.status}: ${detail}`);
    }
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
    const u = json.data?.user;
    if (!u) throw new Error(`User "${user}" not found`);
    return u;
  }
}

// Returns { user, days: [{date, count}] ascending up to today, languages: [{name, color, bytes}] }.
export async function fetchActivity({ token, user, today = new Date(), fetchImpl = fetch, retryDelay }) {
  const u = await graphql({ token, query: ACTIVITY_QUERY, user, fetchImpl, retryDelay });

  const limit = today.toISOString().slice(0, 10);
  const days = u.contributionsCollection.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .map((d) => ({ date: d.date, count: d.contributionCount }))
    .filter((d) => d.date <= limit)
    .sort((a, b) => a.date.localeCompare(b.date));

  const languages = u.repositories.nodes.flatMap((r) =>
    r.languages.edges.map((e) => ({ name: e.node.name, color: e.node.color, bytes: e.size })),
  );

  return { user: u.login, days, languages };
}

// One calendar year (January 1 to December 31, UTC) for the year in review. For the
// current year the window ends now, so the days to come are not asked for. GitHub caps a
// window at one year, which a calendar year never exceeds.
// Returns { user, year, days: [{date, count}] ascending, languages: [{name, color, bytes}] }.
// The languages are the primary languages of the repositories committed to that year, and
// `bytes` counts those commits (not bytes of code), so the year's own work is what ranks.
export async function fetchYear({ token, user, year, today = new Date(), fetchImpl = fetch, retryDelay }) {
  if (!Number.isInteger(year) || year < 2008) throw new Error(`Not a year to review: "${year}"`);
  const first = `${year}-01-01`;
  const last = `${year}-12-31`;
  const limit = today.toISOString().slice(0, 10);
  if (first > limit) throw new Error(`The year ${year} has not started yet`);
  const to = limit < last ? today.toISOString() : `${last}T23:59:59Z`;
  const u = await graphql({
    token,
    query: YEAR_QUERY,
    user,
    variables: { from: `${first}T00:00:00Z`, to },
    fetchImpl,
    retryDelay,
  });

  const days = u.contributionsCollection.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .map((d) => ({ date: d.date, count: d.contributionCount }))
    .filter((d) => d.date >= first && d.date <= last && d.date <= limit)
    .sort((a, b) => a.date.localeCompare(b.date));

  const byLanguage = new Map();
  for (const c of u.contributionsCollection.commitContributionsByRepository) {
    const lang = c.repository?.primaryLanguage;
    if (!lang) continue;
    const cur = byLanguage.get(lang.name) ?? { name: lang.name, color: lang.color, bytes: 0 };
    cur.bytes += c.contributions.totalCount;
    cur.color ||= lang.color;
    byLanguage.set(lang.name, cur);
  }
  return { user: u.login, year, days, languages: [...byLanguage.values()].filter((l) => l.bytes > 0) };
}

// Numbers for the stats card.
// Returns { login, name, followers, stars, commits, prs, issues, contributed, reviews }.
export async function fetchProfile({ token, user, fetchImpl = fetch, retryDelay }) {
  const u = await graphql({ token, query: PROFILE_QUERY, user, fetchImpl, retryDelay });
  return {
    login: u.login,
    name: u.name || u.login,
    followers: u.followers.totalCount,
    stars: u.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0),
    commits: u.contributionsCollection.totalCommitContributions,
    prs: u.pullRequests.totalCount,
    issues: u.issues.totalCount,
    contributed: u.repositoriesContributedTo.totalCount,
    reviews: u.contributionsCollection.totalPullRequestReviewContributions,
  };
}

// The departures board: the `limit` public repositories pushed most recently, newest first.
// Returns [{ name, pushedAt (ISO 8601, UTC), language (primary language name or null) }].
// The profile repository (the one named like the user) is left out: the workflow that
// draws these cards commits to it every day, so it would always sit at the top of the board.
export async function fetchDepartures({ token, user, limit = 6, fetchImpl = fetch, retryDelay }) {
  const u = await graphql({ token, query: DEPARTURES_QUERY, user, fetchImpl, retryDelay });
  return u.repositories.nodes
    .filter((r) => r.pushedAt && r.name.toLowerCase() !== u.login.toLowerCase())
    .slice(0, limit)
    .map((r) => ({ name: r.name, pushedAt: r.pushedAt, language: r.primaryLanguage?.name ?? null }));
}
