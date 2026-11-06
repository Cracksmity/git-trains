import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpec } from '../../src/scene/spec.js';
import { renderScene } from '../../src/scene/render.js';
import { renderCalendar } from '../../src/calendar/render.js';
import { renderRepoStatsCard } from '../../src/cards/profile.js';
import { departureRows, renderDeparturesCard } from '../../src/cards/departures.js';
import { sampleRepoStats, sampleRepoProfile, sampleReleases, SAMPLE_NOW } from '../../src/demo/sample.js';

// --- The drawings ------------------------------------------------------------------

test('the departures board says release, prerelease or tag where the profile board says the language', () => {
  const rows = departureRows(sampleReleases(), { now: SAMPLE_NOW });
  assert.deepEqual(rows.map((r) => r.platform), ['RELEASE', 'PRERELEASE', 'RELEASE', 'RELEASE', 'TAG', 'RELEASE']);
  assert.deepEqual(rows.map((r) => r.status).slice(0, 3), ['BOARDING', 'ON TIME', 'DELAYED']);
  assert.equal(rows[0].destination, 'V2.4.0');
  const es = departureRows(sampleReleases(), { language: 'es', now: SAMPLE_NOW });
  assert.deepEqual(es.map((r) => r.platform).slice(0, 2), ['VERSIÓN', 'PREVERSIÓN']);

  const card = renderDeparturesCard(sampleReleases(), 'octocat/signal-box', { repo: true, now: SAMPLE_NOW });
  assert.ok(card.includes('Departures board of octocat/signal-box: its latest releases and tags'));
  assert.ok(renderDeparturesCard(sampleReleases(), 'octocat/signal-box', { repo: true, language: 'es', now: SAMPLE_NOW }).includes('Panel de salidas de octocat/signal-box'));
  // The profile board is untouched.
  assert.ok(renderDeparturesCard([{ name: 'x', pushedAt: '2026-11-02T10:00:00Z', language: 'Go' }], 'ana', { now: SAMPLE_NOW }).includes("ana's departures board"));
});

test('the repository stats card shows stars, forks, commits, open issues and contributors', () => {
  const svg = renderRepoStatsCard({ ...sampleRepoProfile(), commits: 640 });
  for (const text of ['octocat/signal-box Stats', 'Stars:', '1.3k', 'Forks:', '96', 'Commits (last year):', '640', 'Open Issues:', '23', 'Contributors:', '27']) {
    assert.ok(svg.includes(text), text);
  }
  assert.ok(!svg.includes('Total PRs'), 'not the profile card');
  assert.match(svg, /class="rank-text"[^>]*>[SABC][+-]?</);

  const es = renderRepoStatsCard({ ...sampleRepoProfile(), commits: 640 }, { language: 'es' });
  assert.ok(es.includes('Estadísticas de octocat/signal-box') && es.includes('Colaboradores:') && es.includes('Issues abiertos:'));

  // A count that could not be read is a dash, not "null".
  const dash = renderRepoStatsCard({ ...sampleRepoProfile(), commits: 640, contributors: null });
  assert.ok(!dash.includes('null') && dash.includes('>-</text>'));
  // A very long name is clipped so it stays out of the ring.
  assert.ok(renderRepoStatsCard({ ...sampleRepoProfile(), repo: 'an-organization/a-repository-with-a-very-long-name', commits: 1 }).includes('…'));
  assert.equal(renderRepoStatsCard({ ...sampleRepoProfile(), commits: 640 }), svg, 'deterministic');
});

test('the scene is about the repository: its title, its sign and a city of its own', () => {
  const a = sampleRepoStats();
  const spec = buildSpec(a, { theme: 'light' });
  assert.equal(spec.seed, 'octocat/signal-box');
  assert.equal(spec.user, 'signal-box');
  assert.match(spec.title, /^Train for octocat\/signal-box: \d cars?, 8-day commit streak$/);
  assert.match(buildSpec(a, { language: 'es' }).title, /^Tren de octocat\/signal-box: \d vagones, racha de commits de 8 días$/);
  assert.ok(renderScene(spec).includes('aria-label="Train for octocat/signal-box'));

  // The same repository name under another owner is another city (only the seed changes, not the title);
  // the same full name is always the same one.
  const other = { ...a, seed: 'someone/signal-box' };
  const svg = renderScene(spec);
  assert.notEqual(renderScene(buildSpec(other, { theme: 'light' })), svg);
  assert.equal(renderScene(buildSpec(sampleRepoStats(), { theme: 'light' })), svg);
  // The city is seeded with the full name, not with the name on the sign.
  const bySign = { ...a, seed: undefined };
  assert.notEqual(renderScene(buildSpec(bySign, { theme: 'light' })), svg);
});

test('a user\'s scene is exactly what it was: no seed, the old title', () => {
  const user = { ...sampleRepoStats(), kind: undefined, fullName: undefined, seed: undefined, user: 'octocat' };
  const spec = buildSpec(user, {});
  assert.equal('seed' in spec, false);
  assert.match(spec.title, /^octocat's train: /);
});

test('the calendar counts commits and belongs to the repository', () => {
  const stats = sampleRepoStats();
  const svg = renderCalendar(stats, { model: 'tram', stripe: '#dea584', theme: 'light' });
  assert.ok(svg.includes('Commit calendar of octocat/signal-box, with its train running through it'));
  assert.match(renderCalendar(stats, { language: 'es' }), /Calendario de commits de octocat\/signal-box/);
  // The profile calendar keeps its title.
  const user = renderCalendar({ ...stats, kind: undefined, user: 'octocat' }, { theme: 'light' });
  assert.ok(user.includes("octocat's contribution calendar"));
  assert.notEqual(user, svg);
});
