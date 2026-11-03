// Lectura de la actividad pública de un usuario con la API GraphQL de GitHub.

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

async function graphql({ token, query, user, fetchImpl }) {
  const res = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'git-trenes',
    },
    body: JSON.stringify({ query, variables: { login: user } }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new Error(`GitHub respondió ${res.status}: ${detail}`);
  }
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  const u = json.data?.user;
  if (!u) throw new Error(`No encontré al usuario "${user}"`);
  return u;
}

// Devuelve { user, days: [{date, count}] ascendente hasta hoy, languages: [{name, color, bytes}] }.
export async function fetchActivity({ token, user, today = new Date(), fetchImpl = fetch }) {
  const u = await graphql({ token, query: ACTIVITY_QUERY, user, fetchImpl });

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

// Cifras para la tarjeta de estadísticas.
// Devuelve { login, name, followers, stars, commits, prs, issues, contributed, reviews }.
export async function fetchProfile({ token, user, fetchImpl = fetch }) {
  const u = await graphql({ token, query: PROFILE_QUERY, user, fetchImpl });
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
