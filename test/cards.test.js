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
} from '../src/cards.js';
import { fetchProfile } from '../src/github.js';
import { sampleProfile } from '../src/sample.js';

const entry = fileURLToPath(new URL('../src/index.js', import.meta.url));

const profile = { ...sampleProfile(), name: 'Ana', login: 'ana' };

test('el rango mejora con más actividad y nunca sale de la escala', () => {
  const empty = calculateRank({ commits: 0, prs: 0, issues: 0, reviews: 0, stars: 0, followers: 0 });
  const mid = calculateRank({ commits: 120, prs: 22, issues: 0, reviews: 0, stars: 1, followers: 0 });
  const top = calculateRank({ commits: 5000, prs: 800, issues: 300, reviews: 200, stars: 9000, followers: 4000 });
  assert.equal(empty.level, 'C');
  assert.equal(top.level, 'S');
  assert.ok(top.percentile < mid.percentile && mid.percentile < empty.percentile);
  assert.ok(empty.percentile <= 100 && top.percentile >= 0);
});

test('kFormat abrevia miles como github-readme-stats', () => {
  assert.equal(kFormat(0), '0');
  assert.equal(kFormat(999), '999');
  assert.equal(kFormat(1200), '1.2k');
});

test('hexColor acepta hex con o sin # y rechaza cualquier otra cosa', () => {
  assert.equal(hexColor('C9A04A', '000'), '#C9A04A');
  assert.equal(hexColor('#fff', '000'), '#fff');
  assert.equal(hexColor('', '0d1117'), '#0d1117');
  assert.equal(hexColor('red" onload="alert(1)', '0d1117'), '#0d1117');
});

test('la tarjeta de estadísticas usa idioma, colores y números abreviados', () => {
  const en = renderStatsCard({ ...profile, stars: 1200 }, { idioma: 'en', titulo: 'C9A04A', fondo: '0F1115' });
  assert.ok(en.startsWith('<svg') && en.endsWith('</svg>'));
  assert.ok(en.includes("Ana's GitHub Stats"));
  assert.ok(en.includes('fill:#C9A04A'));
  assert.ok(en.includes('fill="#0F1115"'));
  assert.ok(en.includes('>1.2k</text>'));
  assert.equal((en.match(/<g[ >]/g) ?? []).length, (en.match(/<\/g>/g) ?? []).length);
  assert.ok(!/undefined|NaN|null/.test(en));

  const es = renderStatsCard(profile, { idioma: 'es' });
  assert.ok(es.includes('Estadísticas de GitHub de Ana'));
  assert.ok(es.includes('Estrellas recibidas'));
});

test('el nombre del usuario se escapa en el título y en las etiquetas', () => {
  const svg = renderStatsCard({ ...profile, name: '<b>&"x"' }, { idioma: 'en' });
  assert.ok(!svg.includes('<b>'));
  assert.ok(svg.includes('&lt;b&gt;&amp;&quot;x&quot;'));
});

test('el centro del anillo es la letra del rango o la marca de GitHub', () => {
  assert.ok(renderStatsCard(profile, { rango: 'letra' }).includes('class="rank-text"'));
  const gh = renderStatsCard(profile, { rango: 'github' });
  assert.ok(gh.includes('M8 0C3.58 0'));
  assert.ok(!gh.includes('class="rank-text"'));
});

test('el borde se puede quitar', () => {
  assert.ok(renderStatsCard(profile, { borde: true }).includes('stroke-opacity="0.25"'));
  assert.ok(renderStatsCard(profile, { borde: false }).includes('stroke-opacity="0"'));
});

test('la tarjeta de lenguajes reparte el 100 % entre los mostrados y respeta el máximo', () => {
  const langs = [
    { name: 'Python', color: '#3572A5', bytes: 600 },
    { name: 'JavaScript', color: '#f1e05a', bytes: 300 },
    { name: 'C++', color: '#f34b7d', bytes: 100 },
    { name: 'Rust', color: '#dea584', bytes: 9999 },
  ].sort((a, b) => b.bytes - a.bytes);
  const svg = renderLangsCard(langs, { idioma: 'en', max: 3 });
  const pcts = [...svg.matchAll(/(\d+\.\d\d)%/g)].map((m) => Number(m[1]));
  assert.equal(pcts.length, 3);
  assert.ok(Math.abs(pcts.reduce((a, b) => a + b, 0) - 100) < 0.05);
  assert.ok(!svg.includes('C++')); // el cuarto y quinto quedan fuera con max 3 (Rust, Python, JS)
  assert.ok(svg.includes('Most Used Languages'));
});

test('lenguajes: nombres largos se recortan y un color inválido cae al gris', () => {
  const svg = renderLangsCard([{ name: 'Un lenguaje con nombre larguísimo', color: 'javascript:1', bytes: 10 }], {});
  assert.ok(svg.includes('…'));
  assert.ok(svg.includes('#8b949e'));
  assert.ok(!svg.includes('javascript:1'));
});

test('lenguajes: sin datos muestra un aviso en vez de romperse', () => {
  const svg = renderLangsCard([], { idioma: 'en' });
  assert.ok(svg.includes('No language data'));
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
});

test('fetchProfile suma estrellas y usa el login si no hay nombre', async () => {
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

test('la Action genera las tarjetas pedidas y respeta idioma y colores', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trenes-'));
  try {
    execFileSync(process.execPath, [entry, '--sample'], {
      env: {
        ...process.env,
        INPUT_SALIDA: dir,
        INPUT_TARJETAS: 'both',
        INPUT_IDIOMA: 'en',
        INPUT_COLOR_TITULO: 'C9A04A',
        'INPUT_COLOR-TITULO': 'C9A04A',
        INPUT_TEMA: 'dark',
      },
      stdio: 'pipe',
    });
    const stats = readFileSync(join(dir, 'tarjeta-stats.svg'), 'utf8');
    assert.ok(stats.includes("The Octocat's GitHub Stats"));
    assert.ok(stats.includes('fill:#C9A04A'));
    assert.ok(existsSync(join(dir, 'tarjeta-lenguajes.svg')));
    assert.ok(existsSync(join(dir, 'tren.svg')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sin pedir tarjetas no se genera ninguna', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trenes-'));
  try {
    execFileSync(process.execPath, [entry, '--sample'], { env: { ...process.env, INPUT_SALIDA: dir, INPUT_TEMA: 'dark' }, stdio: 'pipe' });
    assert.ok(!existsSync(join(dir, 'tarjeta-stats.svg')));
    assert.ok(!existsSync(join(dir, 'tarjeta-lenguajes.svg')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('valores inválidos de tarjetas, idioma o rango dan un error claro', () => {
  for (const [name, value, msg] of [
    ['INPUT_TARJETAS', 'todas', /tarjetas/],
    ['INPUT_IDIOMA', 'fr', /Idioma desconocido/],
    ['INPUT_RANGO', 'estrella', /rango/],
  ]) {
    const r = spawnSync(process.execPath, [entry, '--sample'], {
      env: { ...process.env, [name]: value, INPUT_SALIDA: tmpdir() },
      encoding: 'utf8',
    });
    assert.equal(r.status, 1, name);
    assert.match(r.stdout, msg);
  }
});
