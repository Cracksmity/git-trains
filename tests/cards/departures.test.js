import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COLUMNS,
  DEPARTURES_COLORS,
  departureRows,
  departureStatus,
  departureTime,
  renderDeparturesCard,
} from '../../src/cards/departures.js';
import { fetchDepartures } from '../../src/github/user.js';
import { sampleDepartures, SAMPLE_NOW } from '../../src/demo/sample.js';

const entry = fileURLToPath(new URL('../../src/index.js', import.meta.url));
const NOW = new Date('2026-11-02T16:40:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();
const MIN = 60000;
const DAY = 86400000;

test('a push shows as boarding, on time, delayed or departed by its age', () => {
  assert.equal(departureStatus('2026-11-02T00:00:00Z', NOW), 'boarding');
  assert.equal(departureStatus(ago(5 * MIN), NOW), 'boarding');
  assert.equal(departureStatus('2026-11-01T23:59:00Z', NOW), 'on-time'); // yesterday, even if only 17 h ago
  assert.equal(departureStatus(ago(7 * DAY), NOW), 'on-time');
  assert.equal(departureStatus(ago(7 * DAY + MIN), NOW), 'delayed');
  assert.equal(departureStatus(ago(30 * DAY), NOW), 'delayed');
  assert.equal(departureStatus(ago(30 * DAY + MIN), NOW), 'departed');
  assert.equal(departureStatus('2020-01-01T00:00:00Z', NOW), 'departed');
  assert.equal(departureStatus('2026-11-03T09:00:00Z', NOW), 'boarding'); // a clock that runs ahead
});

test('the time is HH:MM (UTC) for today and the date for anything older', () => {
  assert.equal(departureTime('2026-11-02T09:05:00Z', NOW), '09:05');
  assert.equal(departureTime('2026-11-02T00:00:00Z', NOW), '00:00');
  assert.equal(departureTime('2026-11-01T23:59:00Z', NOW), '01 NOV');
  assert.equal(departureTime('2026-08-03T10:00:00Z', NOW), '03 AUG');
  assert.equal(departureTime('2026-08-03T10:00:00Z', NOW, 'es'), '03 AGO');
  assert.equal(departureTime('2026-01-09T10:00:00Z', NOW, 'es'), '09 ENE');
  assert.equal(departureTime('2026-12-25T10:00:00Z', NOW, 'es'), '25 DIC');
});

test('rows are capitals clipped to their column, and a missing language is a dash', () => {
  const rows = departureRows(
    [
      { name: 'a-very-long-repository-name', pushedAt: ago(DAY), language: 'Jupyter Notebook' },
      { name: 'tiny', pushedAt: ago(40 * DAY), language: null },
    ],
    { now: NOW },
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].destination.length, COLUMNS.destination);
  assert.ok(rows[0].destination.endsWith('…') && rows[0].destination.startsWith('A-VERY-LONG-REP'));
  assert.equal(rows[0].platform.length, COLUMNS.platform);
  assert.equal(rows[0].status, 'ON TIME');
  assert.deepEqual(rows[1], { time: '23 SEP', destination: 'TINY', platform: '-', status: 'DEPARTED', tone: 'departed' });
  for (const r of rows) for (const k of Object.keys(COLUMNS)) assert.ok(r[k].length <= COLUMNS[k], k);
  assert.equal(departureRows(new Array(20).fill({ name: 'x', pushedAt: ago(DAY), language: 'Go' }), { now: NOW }).length, 6);
});

test('the statuses are translated', () => {
  const at = (ms) => ({ name: 'x', pushedAt: ago(ms), language: 'Go' });
  const es = departureRows([at(MIN), at(2 * DAY), at(20 * DAY), at(90 * DAY)], { language: 'es', now: NOW });
  assert.deepEqual(es.map((r) => r.status), ['ABORDANDO', 'A TIEMPO', 'RETRASADO', 'SALIÓ']);
  const en = departureRows([at(MIN), at(2 * DAY), at(20 * DAY), at(90 * DAY)], { language: 'en', now: NOW });
  assert.deepEqual(en.map((r) => r.status), ['BOARDING', 'ON TIME', 'DELAYED', 'DEPARTED']);
  for (const r of [...es, ...en]) assert.ok(r.status.length <= COLUMNS.status, r.status);
});

const repos = sampleDepartures();

test('the card is a complete, self-contained SVG with the board on it', () => {
  const svg = renderDeparturesCard(repos, 'octocat', { now: SAMPLE_NOW });
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
  assert.equal((svg.match(/<g[ >]/g) ?? []).length, (svg.match(/<\/g>/g) ?? []).length);
  assert.ok(!/undefined|NaN|null/.test(svg));
  assert.ok(!/(href|src)=["'](?!#)/.test(svg), 'no external references');
  assert.ok(!/<script|<image|@import|url\(["']?http/.test(svg));
  for (const word of ['DEPARTURES', 'TIME', 'DESTINATION', 'PLATFORM', 'STATUS']) assert.ok(svg.includes(word), word);
  for (const r of repos) assert.ok(svg.includes(r.name.toUpperCase().slice(0, 15)), r.name);
  for (const status of ['BOARDING', 'ON TIME', 'DELAYED', 'DEPARTED']) assert.ok(svg.includes(status), status);
  assert.ok(svg.length < 40 * 1024, `${(svg.length / 1024).toFixed(1)} KB`);
  assert.match(svg, /aria-labelledby="t"/);
  assert.match(svg, /<title id="t">[^<]*octocat/);
});

test('the Spanish card speaks Spanish', () => {
  const svg = renderDeparturesCard(repos, 'octocat', { language: 'es', now: SAMPLE_NOW });
  for (const word of ['SALIDAS', 'DESTINO', 'ANDÉN', 'ESTADO', 'ABORDANDO', 'A TIEMPO', 'RETRASADO', 'SALIÓ']) {
    assert.ok(svg.includes(word), word);
  }
  assert.ok(!svg.includes('DEPARTURES') && !svg.includes('BOARDING'));
});

test('repository names, languages and the login are escaped', () => {
  const evil = [
    { name: '<img src=x onerror=alert(1)>', pushedAt: ago(MIN), language: '"><script>x</script>' },
    { name: 'a&b"c\'d', pushedAt: ago(DAY), language: 'C++' },
  ];
  const svg = renderDeparturesCard(evil, '<b>"me"&', { now: NOW });
  assert.ok(!svg.includes('<img') && !svg.includes('<script') && !svg.includes('<b>'));
  assert.ok(svg.includes('&lt;IMG') && svg.includes('A&amp;B&quot;C'));
  assert.equal((svg.match(/<svg/g) ?? []).length, 1);
  assert.equal((svg.match(/<g[ >]/g) ?? []).length, (svg.match(/<\/g>/g) ?? []).length);
});

test('the colors are the same inputs as the other cards, with a board of their own by default', () => {
  const plain = renderDeparturesCard(repos, 'octocat', { now: SAMPLE_NOW });
  for (const [k, v] of Object.entries(DEPARTURES_COLORS)) assert.ok(plain.toLowerCase().includes(`#${v}`), `default ${k}`);
  const custom = renderDeparturesCard(repos, 'octocat', {
    now: SAMPLE_NOW,
    background: '112233',
    title: 'AA0011',
    icon: '00BB22',
    text: 'DDEE33',
    ring: '44CC88',
  });
  for (const hex of ['112233', 'AA0011', '00BB22', 'DDEE33', '44CC88']) assert.ok(custom.includes(`#${hex}`), hex);
  for (const [, v] of Object.entries(DEPARTURES_COLORS)) assert.ok(!custom.toLowerCase().includes(`#${v}`), `leftover default #${v}`);
  // A color that is not hex falls back to the default instead of reaching the SVG.
  const hostile = renderDeparturesCard(repos, 'octocat', { now: SAMPLE_NOW, background: 'red" onload="x' });
  assert.ok(!hostile.includes('onload'));
  assert.ok(hostile.includes(`#${DEPARTURES_COLORS.background}`));
});

test('the border can be removed', () => {
  assert.ok(renderDeparturesCard(repos, 'octocat', { now: SAMPLE_NOW, border: true }).includes('stroke-opacity="0.25"'));
  assert.ok(renderDeparturesCard(repos, 'octocat', { now: SAMPLE_NOW, border: false }).includes('stroke-opacity="0"'));
});

test('the flip animation is CSS only and respects reduced motion', () => {
  const svg = renderDeparturesCard(repos, 'octocat', { now: SAMPLE_NOW });
  assert.match(svg, /@keyframes/);
  assert.match(svg, /animation[^;}]*/);
  assert.match(svg, /@media \(prefers-reduced-motion:\s*reduce\)\{[^}]*animation:\s*none/);
  assert.ok(!/<animate|<set |onload=|<script/.test(svg), 'no SMIL or script');
});

test('the card grows and shrinks with its rows and has a board for no departures', () => {
  const height = (svg) => Number(/<svg width="\d+" height="(\d+)"/.exec(svg)[1]);
  const one = renderDeparturesCard(repos.slice(0, 1), 'octocat', { now: SAMPLE_NOW });
  const six = renderDeparturesCard(repos, 'octocat', { now: SAMPLE_NOW });
  assert.ok(height(six) > height(one));
  const none = renderDeparturesCard([], 'octocat', { now: SAMPLE_NOW });
  assert.ok(none.includes('NO DEPARTURES') && none.startsWith('<svg') && none.endsWith('</svg>'));
  assert.ok(renderDeparturesCard([], 'octocat', { language: 'es', now: SAMPLE_NOW }).includes('SIN SALIDAS'));
});

test('the card is deterministic for the same data and time', () => {
  const a = renderDeparturesCard(repos, 'octocat', { now: SAMPLE_NOW });
  assert.equal(renderDeparturesCard(repos, 'octocat', { now: SAMPLE_NOW }), a);
});

// --- fetchDepartures -----------------------------------------------------------

const reply = (body, ok = true, status = 200) => async () => ({
  ok,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});
const node = (name, pushedAt, lang) => ({ name, pushedAt, primaryLanguage: lang ? { name: lang } : null });
const answer = (nodes, login = 'ana') => ({ data: { user: { login, repositories: { nodes } } } });

test('fetchDepartures reads name, push time and primary language, newest first', async () => {
  let seen;
  const r = await fetchDepartures({
    token: 'secret',
    user: 'ana',
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return reply(answer([node('b', '2026-11-02T10:00:00Z', 'Go'), node('a', '2026-10-01T10:00:00Z', null)]))();
    },
  });
  assert.deepEqual(r, [
    { name: 'b', pushedAt: '2026-11-02T10:00:00Z', language: 'Go' },
    { name: 'a', pushedAt: '2026-10-01T10:00:00Z', language: null },
  ]);
  assert.equal(seen.init.headers.authorization, 'bearer secret');
  const sent = JSON.parse(seen.init.body);
  assert.equal(sent.variables.login, 'ana');
  assert.match(sent.query, /orderBy: \{ field: PUSHED_AT, direction: DESC \}/);
  assert.match(sent.query, /privacy: PUBLIC/);
  assert.match(sent.query, /isFork: false/);
  assert.match(sent.query, /primaryLanguage \{ name \}/);
});

test('fetchDepartures leaves out the profile repository, empty repositories, and stops at the limit', async () => {
  const nodes = [
    node('Ana', '2026-11-02T10:00:00Z', null), // the profile repository, named like the user
    node('empty', null, null),
    ...Array.from({ length: 10 }, (_, i) => node(`r${i}`, `2026-10-${String(20 - i).padStart(2, '0')}T10:00:00Z`, 'Go')),
  ];
  const r = await fetchDepartures({ token: 't', user: 'ana', fetchImpl: reply(answer(nodes)) });
  assert.deepEqual(r.map((d) => d.name), ['r0', 'r1', 'r2', 'r3', 'r4', 'r5']);
  const three = await fetchDepartures({ token: 't', user: 'ana', limit: 3, fetchImpl: reply(answer(nodes)) });
  assert.equal(three.length, 3);
});

test('fetchDepartures retries a 503 like the other queries and fails clearly otherwise', async () => {
  let calls = 0;
  const r = await fetchDepartures({
    token: 't',
    user: 'ana',
    retryDelay: 0,
    fetchImpl: async () => (++calls < 3 ? reply({}, false, 503)() : reply(answer([node('x', '2026-11-02T10:00:00Z', 'Go')]))()),
  });
  assert.equal(calls, 3);
  assert.equal(r.length, 1);
  await assert.rejects(fetchDepartures({ token: 't', user: 'ana', fetchImpl: reply({}, false, 401) }), /GitHub answered 401/);
  await assert.rejects(fetchDepartures({ token: 't', user: 'nobody', fetchImpl: reply({ data: { user: null } }) }), /User "nobody" not found/);
});

// --- The Action ------------------------------------------------------------------

const runAction = (env) => {
  const dir = mkdtempSync(join(tmpdir(), 'git-trains-'));
  const r = spawnSync(process.execPath, [entry, '--sample'], {
    env: { ...process.env, 'INPUT_OUTPUT-DIR': dir, INPUT_THEME: 'dark', ...env },
    encoding: 'utf8',
  });
  const has = (f) => existsSync(join(dir, f));
  const read = (f) => readFileSync(join(dir, f), 'utf8');
  return { r, has, read, done: () => rmSync(dir, { recursive: true, force: true }) };
};

test('cards accepts a list, and both keeps meaning stats and languages', () => {
  const cases = [
    ['departures', { 'card-departures.svg': true, 'card-stats.svg': false, 'card-languages.svg': false }],
    ['stats, departures', { 'card-departures.svg': true, 'card-stats.svg': true, 'card-languages.svg': false }],
    ['both', { 'card-departures.svg': false, 'card-stats.svg': true, 'card-languages.svg': true }],
    ['both, departures', { 'card-departures.svg': true, 'card-stats.svg': true, 'card-languages.svg': true }],
    ['langs,departures', { 'card-departures.svg': true, 'card-stats.svg': false, 'card-languages.svg': true }],
    ['none', { 'card-departures.svg': false, 'card-stats.svg': false, 'card-languages.svg': false }],
  ];
  for (const [cards, expected] of cases) {
    const run = runAction({ INPUT_CARDS: cards });
    try {
      assert.equal(run.r.status, 0, `${cards}: ${run.r.stdout}`);
      for (const [file, want] of Object.entries(expected)) assert.equal(run.has(file), want, `${cards}: ${file}`);
    } finally {
      run.done();
    }
  }
});

test('the Action writes the departures board in the chosen language and colors', () => {
  const run = runAction({ INPUT_CARDS: 'departures', INPUT_LANGUAGE: 'es', 'INPUT_COLOR-BACKGROUND': '112233' });
  try {
    assert.equal(run.r.status, 0, run.r.stdout);
    const svg = run.read('card-departures.svg');
    assert.ok(svg.includes('SALIDAS') && svg.includes('ANDÉN'));
    assert.ok(svg.includes('#112233'));
    assert.ok(svg.includes('GIT-TRAINS'), 'the sample repositories');
    assert.match(run.r.stdout, /card-departures\.svg/);
  } finally {
    run.done();
  }
});

test('an unknown card names every option, and none cannot be mixed with others', () => {
  for (const cards of ['all', 'stats, trains', 'departure']) {
    const run = runAction({ INPUT_CARDS: cards });
    try {
      assert.equal(run.r.status, 1, cards);
      assert.match(run.r.stdout, /Unknown cards: "[^"]+"\. Options: none, stats, languages, departures, both/);
    } finally {
      run.done();
    }
  }
  const run = runAction({ INPUT_CARDS: 'none, stats' });
  try {
    assert.equal(run.r.status, 1);
    assert.match(run.r.stdout, /"none" can't be combined/);
  } finally {
    run.done();
  }
});
