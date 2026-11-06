import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calculateRank,
  hexColor,
  kFormat,
  renderLangsCard,
  renderStatsCard,
} from '../../src/cards/profile.js';
import { fetchProfile } from '../../src/github/user.js';
import { sampleProfile } from '../../src/demo/sample.js';

const entry = fileURLToPath(new URL('../../src/index.js', import.meta.url));

const profile = { ...sampleProfile(), name: 'Ana', login: 'ana' };

test('the rank improves with more activity and never leaves the scale', () => {
  const empty = calculateRank({ commits: 0, prs: 0, issues: 0, reviews: 0, stars: 0, followers: 0 });
  const mid = calculateRank({ commits: 120, prs: 22, issues: 0, reviews: 0, stars: 1, followers: 0 });
  const top = calculateRank({ commits: 5000, prs: 800, issues: 300, reviews: 200, stars: 9000, followers: 4000 });
  assert.equal(empty.level, 'C');
  assert.equal(top.level, 'S');
  assert.ok(top.percentile < mid.percentile && mid.percentile < empty.percentile);
  assert.ok(empty.percentile <= 100 && top.percentile >= 0);
});

test('kFormat shortens thousands like github-readme-stats', () => {
  assert.equal(kFormat(0), '0');
  assert.equal(kFormat(999), '999');
  assert.equal(kFormat(1200), '1.2k');
});

test('hexColor accepts hex with or without # and rejects anything else', () => {
  assert.equal(hexColor('C9A04A', '000'), '#C9A04A');
  assert.equal(hexColor('#fff', '000'), '#fff');
  assert.equal(hexColor('', '0d1117'), '#0d1117');
  assert.equal(hexColor('red" onload="alert(1)', '0d1117'), '#0d1117');
});

test('the stats card follows the language, colors and short numbers', () => {
  const en = renderStatsCard({ ...profile, stars: 1200 }, { language: 'en', title: 'C9A04A', background: '0F1115' });
  assert.ok(en.startsWith('<svg') && en.endsWith('</svg>'));
  assert.ok(en.includes("Ana's GitHub Stats"));
  assert.ok(en.includes('fill:#C9A04A'));
  assert.ok(en.includes('fill="#0F1115"'));
  assert.ok(en.includes('>1.2k</text>'));
  assert.equal((en.match(/<g[ >]/g) ?? []).length, (en.match(/<\/g>/g) ?? []).length);
  assert.ok(!/undefined|NaN|null/.test(en));

  const es = renderStatsCard(profile, { language: 'es' });
  assert.ok(es.includes('Estadísticas de GitHub de Ana'));
  assert.ok(es.includes('Estrellas recibidas'));
});

test('the user name is escaped in the title and the labels', () => {
  const svg = renderStatsCard({ ...profile, name: '<b>&"x"' }, { language: 'en' });
  assert.ok(!svg.includes('<b>'));
  assert.ok(svg.includes('&lt;b&gt;&amp;&quot;x&quot;'));
});

test('the center of the ring is the rank letter or the GitHub mark', () => {
  assert.ok(renderStatsCard(profile, { rank: 'letter' }).includes('class="rank-text"'));
  const gh = renderStatsCard(profile, { rank: 'github' });
  assert.ok(gh.includes('M8 0C3.58 0'));
  assert.ok(!gh.includes('class="rank-text"'));
});

test('the border can be removed', () => {
  assert.ok(renderStatsCard(profile, { border: true }).includes('stroke-opacity="0.25"'));
  assert.ok(renderStatsCard(profile, { border: false }).includes('stroke-opacity="0"'));
});

test('the languages card splits 100 % among the ones shown and respects the maximum', () => {
  const langs = [
    { name: 'Python', color: '#3572A5', bytes: 600 },
    { name: 'JavaScript', color: '#f1e05a', bytes: 300 },
    { name: 'C++', color: '#f34b7d', bytes: 100 },
    { name: 'Rust', color: '#dea584', bytes: 9999 },
  ].sort((a, b) => b.bytes - a.bytes);
  const svg = renderLangsCard(langs, { language: 'en', max: 3 });
  const pcts = [...svg.matchAll(/(\d+\.\d\d)%/g)].map((m) => Number(m[1]));
  assert.equal(pcts.length, 3);
  assert.ok(Math.abs(pcts.reduce((a, b) => a + b, 0) - 100) < 0.05);
  assert.ok(!svg.includes('C++')); // with max 3 only Rust, Python and JS make it
  assert.ok(svg.includes('Most Used Languages'));
});

test('languages: long names are clipped and an invalid color falls back to gray', () => {
  const svg = renderLangsCard([{ name: 'A language with a very long name', color: 'javascript:1', bytes: 10 }], {});
  assert.ok(svg.includes('…'));
  assert.ok(svg.includes('#8b949e'));
  assert.ok(!svg.includes('javascript:1'));
});

test('languages: with no data it shows a notice instead of breaking', () => {
  const svg = renderLangsCard([], { language: 'en' });
  assert.ok(svg.includes('No language data'));
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
});

test('fetchProfile adds up stars and uses the login when there is no name', async () => {
  const body = {
    data: {
      user: {
        login: 'ana',
        name: null,
        followers: { totalCount: 3 },
        pullRequests: { totalCount: 7 },
        issues: { totalCount: 2 },
        repositoriesContributedTo: { totalCount: 5 },
        contributionsCollection: { totalCommitContributions: 40, totalPullRequestReviewContributions: 1 },
        repositories: { nodes: [{ stargazerCount: 10 }, { stargazerCount: 5 }, { stargazerCount: 0 }] },
      },
    },
  };
  const r = await fetchProfile({
    token: 't',
    user: 'ana',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => body, text: async () => '' }),
  });
  assert.deepEqual(r, {
    login: 'ana',
    name: 'ana',
    followers: 3,
    stars: 15,
    commits: 40,
    prs: 7,
    issues: 2,
    contributed: 5,
    reviews: 1,
  });
});

const runAction = (env) =>
  spawnSync(process.execPath, [entry, '--sample'], { env: { ...process.env, ...env }, encoding: 'utf8' });

test('the Action writes the requested cards and follows language and colors', () => {
  const dir = mkdtempSync(join(tmpdir(), 'git-trains-'));
  try {
    execFileSync(process.execPath, [entry, '--sample'], {
      env: {
        ...process.env,
        'INPUT_OUTPUT-DIR': dir,
        INPUT_CARDS: 'both',
        INPUT_LANGUAGE: 'en',
        'INPUT_COLOR-TITLE': 'C9A04A',
        INPUT_THEME: 'dark',
      },
      stdio: 'pipe',
    });
    const stats = readFileSync(join(dir, 'card-stats.svg'), 'utf8');
    assert.ok(stats.includes("The Octocat's GitHub Stats"));
    assert.ok(stats.includes('fill:#C9A04A'));
    assert.ok(existsSync(join(dir, 'card-languages.svg')));
    assert.ok(existsSync(join(dir, 'train.svg')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('with theme both the Action writes light, dark and automatic scenes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'git-trains-'));
  try {
    const r = runAction({ 'INPUT_OUTPUT-DIR': dir });
    assert.equal(r.status, 0, r.stdout);
    for (const f of ['train-light.svg', 'train-dark.svg', 'train.svg']) assert.ok(existsSync(join(dir, f)), f);
    assert.match(readFileSync(join(dir, 'train.svg'), 'utf8'), /aria-label="octocat's train/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('no cards are written unless asked for', () => {
  const dir = mkdtempSync(join(tmpdir(), 'git-trains-'));
  try {
    execFileSync(process.execPath, [entry, '--sample'], { env: { ...process.env, 'INPUT_OUTPUT-DIR': dir, INPUT_THEME: 'dark' }, stdio: 'pipe' });
    assert.ok(!existsSync(join(dir, 'card-stats.svg')));
    assert.ok(!existsSync(join(dir, 'card-languages.svg')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the Spanish input names from before v1 still work, with a deprecation warning', () => {
  const dir = mkdtempSync(join(tmpdir(), 'git-trains-'));
  try {
    const r = runAction({
      INPUT_SALIDA: dir,
      INPUT_TEMA: 'dark',
      INPUT_TARJETAS: 'langs',
      INPUT_IDIOMA: 'es',
      INPUT_RANGO: 'letra',
      INPUT_TREN: 'metro-blanco',
      INPUT_FONDO: 'nueva-york',
      INPUT_THEME: 'both', // the English input holding its default loses to the Spanish one that was set
    });
    assert.equal(r.status, 0, r.stdout);
    assert.ok(existsSync(join(dir, 'train.svg')) && !existsSync(join(dir, 'train-light.svg')));
    assert.ok(readFileSync(join(dir, 'card-languages.svg'), 'utf8').includes('Lenguajes más usados'));
    assert.match(r.stdout, /::warning::The input "tema" is deprecated; rename it to "theme"/);
    assert.match(r.stdout, /car\(s\) metro-white/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('exclude-languages takes the languages off the stripes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'git-trains-'));
  try {
    const r = runAction({ 'INPUT_OUTPUT-DIR': dir, INPUT_THEME: 'dark', 'INPUT_EXCLUDE-LANGUAGES': 'TypeScript, python', INPUT_MODE: 'multi' });
    assert.equal(r.status, 0, r.stdout);
    const svg = readFileSync(join(dir, 'train.svg'), 'utf8');
    assert.ok(!svg.includes('#3178c6'), 'no TypeScript blue');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('invalid cards, language or rank values give a clear error', () => {
  for (const [name, value, msg] of [
    ['INPUT_CARDS', 'all', /Unknown cards: "all"/],
    ['INPUT_LANGUAGE', 'fr', /Unknown language: "fr"/],
    ['INPUT_RANK', 'star', /Unknown rank: "star"/],
  ]) {
    const r = runAction({ [name]: value, 'INPUT_OUTPUT-DIR': tmpdir() });
    assert.equal(r.status, 1, name);
    assert.match(r.stdout, msg);
  }
});
