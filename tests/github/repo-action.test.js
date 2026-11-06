import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// --- The Action ----------------------------------------------------------------------

const runAction = (env, { args = ['--sample'], node = [] } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'git-trains-'));
  const r = spawnSync(process.execPath, [...node, entry, ...args], {
    env: { ...process.env, 'INPUT_OUTPUT-DIR': dir, ...env },
    encoding: 'utf8',
  });
  const has = (f) => existsSync(join(dir, f));
  const read = (f) => readFileSync(join(dir, f), 'utf8');
  return { r, has, read, dir, done: () => rmSync(dir, { recursive: true, force: true }) };
};

const entry = fileURLToPath(new URL('../../src/index.js', import.meta.url));

test('repo mode names its files train-repo* and card-repo-*, so a profile can share the folder', () => {
  const run = runAction({ INPUT_REPO: 'octocat/signal-box', INPUT_CALENDAR: 'true', INPUT_CARDS: 'stats, languages, departures' });
  try {
    assert.equal(run.r.status, 0, run.r.stdout);
    for (const f of [
      'train-repo-light.svg',
      'train-repo-dark.svg',
      'train-repo.svg',
      'train-repo-calendar-light.svg',
      'train-repo-calendar-dark.svg',
      'train-repo-calendar.svg',
      'card-repo-stats.svg',
      'card-repo-languages.svg',
      'card-repo-departures.svg',
    ]) {
      assert.ok(run.has(f), f);
    }
    for (const f of ['train.svg', 'train-light.svg', 'card-stats.svg', 'train-calendar.svg']) assert.ok(!run.has(f), `${f} is the profile's`);
    assert.ok(run.read('train-repo.svg').includes('Train for octocat/signal-box'));
    assert.ok(run.read('train-repo-calendar.svg').includes('Commit calendar of octocat/signal-box'));
    assert.ok(run.read('card-repo-stats.svg').includes('Contributors:'));
    assert.ok(run.read('card-repo-departures.svg').includes('V2.4.0'));
    assert.match(run.r.stdout, /octocat\/signal-box: \d+ commits, streak \d+/);
  } finally {
    run.done();
  }
});

test('without repo the Action writes the same files as ever', () => {
  const run = runAction({ INPUT_CALENDAR: 'true', INPUT_CARDS: 'both' });
  try {
    assert.equal(run.r.status, 0, run.r.stdout);
    for (const f of ['train.svg', 'train-light.svg', 'train-calendar-light.svg', 'card-stats.svg', 'card-languages.svg']) assert.ok(run.has(f), f);
    assert.ok(!run.has('train-repo.svg'));
  } finally {
    run.done();
  }
});

test('an input that is not owner/name stops the run with a clear error', () => {
  for (const repo of ['signal-box', 'octocat/signal box', 'https://example.com/a/b']) {
    const run = runAction({ INPUT_REPO: repo });
    try {
      assert.equal(run.r.status, 1, repo);
      assert.match(run.r.stdout, /::error::"repo" must look like owner\/name/);
    } finally {
      run.done();
    }
  }
});

test('the whole Action, repo mode, against a fake GitHub', () => {
  // A preload that replaces fetch: the Action runs exactly as on a runner, but with no network.
  const dir = mkdtempSync(join(tmpdir(), 'git-trains-fake-'));
  const preload = join(dir, 'fake-fetch.mjs');
  writeFileSync(
    preload,
    `
const DAY = 86400000;
const now = new Date();
const sunday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - now.getUTCDay() * DAY;
const weeks = Array.from({ length: 52 }, (_, w) => {
  const week = (sunday - (51 - w) * 7 * DAY) / 1000;
  const days = Array.from({ length: 7 }, (_, i) => (w % 3 === 0 ? 0 : i + 1));
  return { week, days, total: days.reduce((a, c) => a + c, 0) };
});
const reply = (body, status = 200, headers = {}) => ({
  ok: status < 300, status, headers: new Headers(headers), json: async () => body, text: async () => JSON.stringify(body),
});
globalThis.fetch = async (url, init = {}) => {
  const { pathname } = new URL(url);
  if (init.headers.authorization !== 'bearer fake-token') return reply({ message: 'Bad credentials' }, 401);
  if (pathname === '/repos/octo/rail/languages') return reply({ Rust: 8000, Shell: 500 });
  if (pathname === '/repos/octo/rail/stats/commit_activity') return reply(weeks);
  if (pathname === '/repos/octo/rail/contributors') return reply([{}], 200, { link: '<https://api.github.com/x?page=12>; rel="last"' });
  if (pathname === '/graphql') {
    const { query } = JSON.parse(init.body);
    if (query.includes('stargazerCount')) {
      return reply({ data: { repository: { nameWithOwner: 'octo/rail', stargazerCount: 250, forkCount: 31, watchers: { totalCount: 9 },
        openIssues: { totalCount: 4 }, allIssues: { totalCount: 60 }, openPrs: { totalCount: 2 }, allPrs: { totalCount: 90 } } } });
    }
    return reply({ data: { repository: { releases: { nodes: [
      { tagName: 'v1.2.0', publishedAt: new Date().toISOString(), createdAt: new Date().toISOString(), isPrerelease: false, isDraft: false },
    ] }, refs: { nodes: [] } } } });
  }
  return reply({ message: 'Not Found' }, 404);
};
`,
  );
  const run = runAction(
    {
      INPUT_REPO: 'octo/rail',
      'INPUT_GITHUB-TOKEN': 'fake-token',
      INPUT_CARDS: 'stats, departures',
      INPUT_CALENDAR: 'true',
      INPUT_LANGUAGE: 'es',
      GITHUB_OUTPUT: join(dir, 'output.txt'),
    },
    { args: [], node: ['--import', pathToFileURL(preload).href] },
  );
  try {
    assert.equal(run.r.status, 0, run.r.stdout + run.r.stderr);
    assert.match(run.r.stdout, /octo\/rail: \d+ commits, streak \d+/);
    const scene = run.read('train-repo.svg');
    assert.ok(scene.includes('Tren de octo/rail'));
    const stats = run.read('card-repo-stats.svg');
    assert.ok(stats.includes('Estadísticas de octo/rail') && stats.includes('>250<') && stats.includes('>12<'));
    const board = run.read('card-repo-departures.svg');
    assert.ok(board.includes('V1.2.0') && board.includes('VERSIÓN') && board.includes('ABORDANDO'));
    assert.ok(run.has('train-repo-calendar.svg'));
    const out = readFileSync(join(dir, 'output.txt'), 'utf8');
    assert.match(out, /files=.*train-repo\.svg/);
    assert.match(out, /streak=\d+/);

    // A 100-star repository earns the observation car, like a profile does.
    assert.ok(/Vagón mirador desbloqueado: más de 100 estrellas/.test(scene), 'the unlockable car follows the repository stars');
  } finally {
    run.done();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the Action tells a missing repository apart from other failures', () => {
  const dir = mkdtempSync(join(tmpdir(), 'git-trains-fake-'));
  const preload = join(dir, 'fake-fetch.mjs');
  writeFileSync(preload, `globalThis.fetch = async () => ({ ok: false, status: 404, headers: new Headers(), json: async () => ({}), text: async () => '{"message":"Not Found"}' });`);
  const run = runAction({ INPUT_REPO: 'octo/ghost', 'INPUT_GITHUB-TOKEN': 'fake-token' }, { args: [], node: ['--import', pathToFileURL(preload).href] });
  try {
    assert.equal(run.r.status, 1);
    assert.match(run.r.stdout, /::error::Repository "octo\/ghost" not found/);
  } finally {
    run.done();
    rmSync(dir, { recursive: true, force: true });
  }
});
