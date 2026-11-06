import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// --- The numbers -----------------------------------------------------------------------------

const run = (start, counts) =>
  counts.map((count, i) => ({ date: new Date(Date.parse(`${start}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10), count }));

// --- The Action ------------------------------------------------------------------------------

const runAction = (env) => {
  const dir = mkdtempSync(join(tmpdir(), 'git-trains-'));
  const r = spawnSync(process.execPath, [entry, '--sample'], {
    env: { ...process.env, 'INPUT_OUTPUT-DIR': dir, ...env },
    encoding: 'utf8',
  });
  const has = (f) => existsSync(join(dir, f));
  const read = (f) => readFileSync(join(dir, f), 'utf8');
  return { r, has, read, done: () => rmSync(dir, { recursive: true, force: true }) };
};

const entry = fileURLToPath(new URL('../../src/index.js', import.meta.url));

test('without year-in-review nothing is written, and with it the poster comes in the usual variants', () => {
  const off = runAction({});
  try {
    assert.equal(off.r.status, 0, off.r.stdout);
    assert.ok(!off.has('year-in-review.svg') && !off.has('year-in-review-light.svg'));
  } finally {
    off.done();
  }
  const both = runAction({ 'INPUT_YEAR-IN-REVIEW': 'true' });
  try {
    assert.equal(both.r.status, 0, both.r.stdout);
    for (const f of ['year-in-review-light.svg', 'year-in-review-dark.svg', 'year-in-review.svg']) assert.ok(both.has(f), f);
    assert.ok(both.read('year-in-review.svg').includes('prefers-color-scheme:dark'), 'auto follows the viewer');
    assert.ok(!both.read('year-in-review-dark.svg').includes('prefers-color-scheme'));
    assert.ok(both.read('year-in-review-light.svg').includes('#ffffff'));
    assert.match(both.r.stdout, /year-in-review-light\.svg/);
    assert.ok(both.has('train.svg'), 'the scene is still written');
  } finally {
    both.done();
  }
  const dark = runAction({ 'INPUT_YEAR-IN-REVIEW': 'true', INPUT_THEME: 'dark' });
  try {
    assert.equal(dark.r.status, 0, dark.r.stdout);
    assert.ok(dark.has('year-in-review.svg') && !dark.has('year-in-review-dark.svg') && !dark.has('year-in-review-light.svg'));
    assert.ok(dark.read('year-in-review.svg').includes('#0d1117'));
  } finally {
    dark.done();
  }
});

test('the year defaults to the current one so far, and review-year picks another', () => {
  const sampleDay = run('2026-11-02', [0])[0].date; // the sample runs on 2026-11-02
  const now = runAction({ 'INPUT_YEAR-IN-REVIEW': 'true', INPUT_THEME: 'light' });
  try {
    assert.equal(now.r.status, 0, now.r.stdout);
    const svg = now.read('year-in-review.svg');
    assert.ok(svg.includes(`YEAR IN REVIEW ${sampleDay.slice(0, 4)}`) && svg.includes('of 306 days'));
  } finally {
    now.done();
  }
  const last = runAction({ 'INPUT_YEAR-IN-REVIEW': 'true', 'INPUT_REVIEW-YEAR': '2025', INPUT_THEME: 'light' });
  try {
    assert.equal(last.r.status, 0, last.r.stdout);
    const svg = last.read('year-in-review.svg');
    assert.ok(svg.includes('YEAR IN REVIEW 2025') && svg.includes('of 365 days'));
  } finally {
    last.done();
  }
});

test('the poster follows language, colors and border, and carries the unlocked car unless unlocks is off', () => {
  const run1 = runAction({
    'INPUT_YEAR-IN-REVIEW': 'true',
    INPUT_THEME: 'light',
    INPUT_LANGUAGE: 'es',
    'INPUT_COLOR-BACKGROUND': '112233',
    INPUT_BORDER: 'false',
    'INPUT_REVIEW-YEAR': '2025',
  });
  try {
    assert.equal(run1.r.status, 0, run1.r.stdout);
    const svg = run1.read('year-in-review.svg');
    assert.ok(svg.includes('RESUMEN DEL AÑO 2025') && svg.includes('#112233') && svg.includes('stroke-opacity="0"'));
    assert.ok(svg.includes('Vagón mirador desbloqueado'), 'the sample profile has 340 stars');
  } finally {
    run1.done();
  }
  const off = runAction({ 'INPUT_YEAR-IN-REVIEW': 'true', INPUT_THEME: 'light', INPUT_UNLOCKS: 'false', 'INPUT_REVIEW-YEAR': '2025' });
  try {
    assert.equal(off.r.status, 0, off.r.stdout);
    assert.ok(!off.read('year-in-review.svg').includes('unlocked'));
  } finally {
    off.done();
  }
});

test('the poster uses the train and the stripe of the inputs, and the languages follow exclude-languages', () => {
  const r = runAction({ 'INPUT_YEAR-IN-REVIEW': 'true', INPUT_THEME: 'light', INPUT_TRAIN: 'tram', 'INPUT_EXCLUDE-LANGUAGES': 'TypeScript', 'INPUT_REVIEW-YEAR': '2025' });
  try {
    assert.equal(r.r.status, 0, r.r.stdout);
    const svg = r.read('year-in-review.svg');
    assert.ok(svg.includes('#8a1c2b'), 'the tram');
    assert.ok(!svg.includes('TypeScript') && svg.includes('Python'));
    assert.ok(svg.includes('#3572A5'), 'the stripe is the top language left: Python');
  } finally {
    r.done();
  }
});

test('a year that cannot be reviewed, or a bad toggle, stops the run with a clear message', () => {
  for (const [env, message] of [
    [{ 'INPUT_REVIEW-YEAR': '2007' }, /"review-year" must be a year from 2008 to 2026, or empty for 2026/],
    [{ 'INPUT_REVIEW-YEAR': '2027' }, /"review-year" must be a year from 2008 to 2026/],
    [{ 'INPUT_REVIEW-YEAR': 'last' }, /"review-year" must be a year/],
    [{ 'INPUT_YEAR-IN-REVIEW': 'yes' }, /Unknown year-in-review: "yes"\. Options: true, false/],
  ]) {
    const r = runAction({ 'INPUT_YEAR-IN-REVIEW': 'true', ...env });
    try {
      assert.equal(r.r.status, 1, JSON.stringify(env));
      assert.match(r.r.stdout, message);
      assert.ok(!r.has('year-in-review.svg') && !r.has('train.svg'), 'nothing is written');
    } finally {
      r.done();
    }
  }
  // A year in review that is off does not even look at review-year.
  const off = runAction({ 'INPUT_REVIEW-YEAR': '1999' });
  try {
    assert.equal(off.r.status, 0, off.r.stdout);
  } finally {
    off.done();
  }
});

test('in repo mode there is no user to review: the poster is skipped with a notice and the rest is written', () => {
  const r = runAction({ 'INPUT_YEAR-IN-REVIEW': 'true', INPUT_REPO: 'octocat/hello-world', INPUT_THEME: 'light' });
  try {
    assert.equal(r.r.status, 0, r.r.stdout);
    assert.match(r.r.stdout, /::notice::year-in-review is a poster of a user, so it is skipped in repo mode/);
    assert.ok(r.has('train-repo.svg'));
    assert.ok(!r.has('year-in-review.svg') && !r.has('train-repo-year-in-review.svg'));
  } finally {
    r.done();
  }
});

test('the action.yml declares the two inputs, off and empty by default', () => {
  const yml = readFileSync(new URL('../../action.yml', import.meta.url), 'utf8');
  assert.match(yml, /\n  year-in-review:\n    description: [^\n]*year-in-review\.svg[^\n]*\n    default: "false"\n/);
  assert.match(yml, /\n  review-year:\n    description: [^\n]*January[^\n]*\n    default: ""\n/);
});
