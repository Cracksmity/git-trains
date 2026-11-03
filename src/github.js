// Lectura de la actividad pública de un usuario con la API GraphQL de GitHub.

const ENDPOINT = 'https://api.github.com/graphql';

const QUERY = `
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

// Devuelve { user, days: [{date, count}] ascendente hasta hoy, languages: [{name, color, bytes}] }.
export async function fetchActivity({ token, user, today = new Date(), fetchImpl = fetch }) {
  const res = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'git-trenes',
    },
    body: JSON.stringify({ query: QUERY, variables: { login: user } }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new Error(`GitHub respondió ${res.status}: ${detail}`);
  }
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  const u = json.data?.user;
  if (!u) throw new Error(`No encontré al usuario "${user}"`);

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
