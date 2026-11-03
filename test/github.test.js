import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchActivity } from '../src/github.js';

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
              { date: '2026-11-03', contributionCount: 0 }, // futuro: debe descartarse
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

test('aplana el calendario, descarta días futuros y lee lenguajes', async () => {
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

test('manda el token como bearer y el usuario como variable', async () => {
  let seen;
  await fetchActivity({
    token: 'secreto',
    user: 'ana',
    today: new Date('2026-11-02T10:00:00Z'),
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return reply(sample)();
    },
  });
  assert.equal(seen.url, 'https://api.github.com/graphql');
  assert.equal(seen.init.headers.authorization, 'bearer secreto');
  assert.equal(JSON.parse(seen.init.body).variables.login, 'ana');
});

test('usuario inexistente da un error claro', async () => {
  await assert.rejects(
    fetchActivity({ token: 't', user: 'nadie', fetchImpl: reply({ data: { user: null } }) }),
    /No encontré al usuario "nadie"/,
  );
});

test('errores de GraphQL y HTTP se propagan sin exponer el token', async () => {
  await assert.rejects(
    fetchActivity({ token: 'secreto', user: 'a', fetchImpl: reply({ errors: [{ message: 'Bad credentials' }] }) }),
    /Bad credentials/,
  );
  await assert.rejects(
    fetchActivity({ token: 'secreto', user: 'a', fetchImpl: reply({ message: 'nope' }, false, 401) }),
    (e) => /401/.test(e.message) && !e.message.includes('secreto'),
  );
});
