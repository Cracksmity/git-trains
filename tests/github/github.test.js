import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchActivity } from '../../src/github/user.js';

const reply = (body, ok = true, status = 200) => async () => ({
  ok,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const sample = {
  data: {
    user: {
      login: 'ana',
      contributionsCollection: {
        contributionCalendar: {
          weeks: [
            { contributionDays: [
              { date: '2026-10-31', contributionCount: 2 },
              { date: '2026-11-01', contributionCount: 0 },
            ] },
            { contributionDays: [
              { date: '2026-11-02', contributionCount: 4 },
              { date: '2026-11-03', contributionCount: 0 }, // future: must be dropped
            ] },
          ],
        },
      },
      repositories: {
        nodes: [
          { languages: { edges: [{ size: 900, node: { name: 'Go', color: '#00ADD8' } }] } },
          { languages: { edges: [] } },
        ],
      },
    },
  },
};

test('flattens the calendar, drops future days and reads languages', async () => {
  const r = await fetchActivity({
    token: 't',
    user: 'ana',
    today: new Date('2026-11-02T10:00:00Z'),
    fetchImpl: reply(sample),
  });
  assert.equal(r.user, 'ana');
  assert.deepEqual(r.days.map((d) => d.date), ['2026-10-31', '2026-11-01', '2026-11-02']);
  assert.deepEqual(r.languages, [{ name: 'Go', color: '#00ADD8', bytes: 900 }]);
});

test('sends the token as bearer and the user as a variable', async () => {
  let seen;
  await fetchActivity({
    token: 'secret',
    user: 'ana',
    today: new Date('2026-11-02T10:00:00Z'),
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return reply(sample)();
    },
  });
  assert.equal(seen.url, 'https://api.github.com/graphql');
  assert.equal(seen.init.headers.authorization, 'bearer secret');
  assert.equal(JSON.parse(seen.init.body).variables.login, 'ana');
});

test('an unknown user gives a clear error', async () => {
  await assert.rejects(
    fetchActivity({ token: 't', user: 'nobody', fetchImpl: reply({ data: { user: null } }) }),
    /User "nobody" not found/,
  );
});

test('GraphQL and HTTP errors come through without exposing the token', async () => {
  await assert.rejects(
    fetchActivity({ token: 'secret', user: 'a', fetchImpl: reply({ errors: [{ message: 'Bad credentials' }] }) }),
    /Bad credentials/,
  );
  await assert.rejects(
    fetchActivity({ token: 'secret', user: 'a', fetchImpl: reply({ message: 'nope' }, false, 401) }),
    (e) => /401/.test(e.message) && !e.message.includes('secret'),
  );
});

test('502s and network blips are retried; a 401 is not', async () => {
  const today = new Date('2026-11-02T10:00:00Z');
  let calls = 0;
  const flaky = async () => {
    calls++;
    if (calls === 1) throw new Error('socket hang up');
    if (calls === 2) return reply({ message: 'bad gateway' }, false, 502)();
    return reply(sample)();
  };
  const r = await fetchActivity({ token: 't', user: 'ana', today, fetchImpl: flaky, retryDelay: 1 });
  assert.equal(r.user, 'ana');
  assert.equal(calls, 3);

  calls = 0;
  const denied = async () => {
    calls++;
    return reply({ message: 'nope' }, false, 401)();
  };
  await assert.rejects(fetchActivity({ token: 't', user: 'a', fetchImpl: denied, retryDelay: 1 }), /401/);
  assert.equal(calls, 1);

  calls = 0;
  const down = async () => {
    calls++;
    return reply({ message: 'bad gateway' }, false, 502)();
  };
  await assert.rejects(fetchActivity({ token: 't', user: 'a', fetchImpl: down, retryDelay: 1 }), /502/);
  assert.equal(calls, 4);
});
