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

// GraphQL answers 502/503/504 now and then on heavy queries, and the network can
// blip: those are retried with backoff. Anything else (bad token, unknown user)
// fails right away.
const RETRIES = 3;
const RETRY_STATUS = new Set([500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function graphql({ token, query, user, fetchImpl, retryDelay = 1500 }) {
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
        body: JSON.stringify({ query, variables: { login: user } }),
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
