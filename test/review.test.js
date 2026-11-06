import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchYear } from '../src/github.js';
import { MINI_EXTRAS, miniTrain } from '../src/mini.js';
import { getModel } from '../src/models.js';
import { parseCustomModel } from '../src/custom.js';
import {
  FIRST_YEAR,
  LABELS,
  REVIEW_COLORS,
  buildReview,
  defaultReviewYear,
  parseReviewYear,
  renderReview,
  yearNumbers,
} from '../src/review.js';
import { sampleProfile, sampleYear, SAMPLE_NOW } from '../src/sample.js';
import { unlockFor } from '../src/unlocks.js';

const entry = fileURLToPath(new URL('../src/index.js', import.meta.url));
const steam = parseCustomModel(JSON.parse(readFileSync(new URL('../examples/trains/steam.json', import.meta.url), 'utf8')));

// --- Which year ------------------------------------------------------------------------------

test('the review is of the current year so far, except in January, when it is the year that just ended', () => {
  assert.equal(defaultReviewYear(new Date('2026-11-05T10:00:00Z')), 2026);
  assert.equal(defaultReviewYear(new Date('2026-02-01T00:00:00Z')), 2026);
  assert.equal(defaultReviewYear(new Date('2026-12-31T23:59:59Z')), 2026);
  assert.equal(defaultReviewYear(new Date('2027-01-01T00:00:00Z')), 2026);
  assert.equal(defaultReviewYear(new Date('2027-01-31T23:59:59Z')), 2026);
  assert.equal(defaultReviewYear(new Date('2027-02-01T00:00:00Z')), 2027);
});

test('review-year is empty for the default, or a year from 2008 to the current one', () => {
  const now = new Date('2026-11-05T10:00:00Z');
  assert.equal(parseReviewYear('', now), 2026);
  assert.equal(parseReviewYear(undefined, now), 2026);
  assert.equal(parseReviewYear(' 2024 ', now), 2024);
  assert.equal(parseReviewYear(String(FIRST_YEAR), now), 2008);
  assert.equal(parseReviewYear('2026', now), 2026);
  assert.equal(parseReviewYear('', new Date('2027-01-10T00:00:00Z')), 2026);
  assert.equal(parseReviewYear('2027', new Date('2027-01-10T00:00:00Z')), 2027);
  for (const bad of ['2007', '2027', '24', 'last', '2024.5', '-2024', '2e3']) {
    assert.throws(() => parseReviewYear(bad, now), /"review-year" must be a year from 2008 to 2026, or empty for 2026/, bad);
  }
});

// --- The numbers -----------------------------------------------------------------------------

const run = (start, counts) =>
  counts.map((count, i) => ({ date: new Date(Date.parse(`${start}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10), count }));

test('the year in numbers: total, active days, longest streak, busiest day and month', () => {
  const days = [
    ...run('2025-01-01', [0, 3, 2, 0, 5, 5, 5, 1, 0]), // streaks of 2 (Jan 2-3) and 4 (Jan 5-8)
    ...run('2025-03-10', [1, 1, 9, 1, 1, 1, 1, 0]), // a streak of 7 from Mar 10, with the busiest day on Mar 12
    ...run('2025-06-01', [4, 0, 4]),
  ];
  const n = yearNumbers(days, 2025);
  assert.equal(n.total, 3 + 2 + 5 + 5 + 5 + 1 + 1 + 1 + 9 + 1 + 1 + 1 + 1 + 4 + 4);
  assert.equal(n.activeDays, 4 + 2 + 7 + 2);
  assert.equal(n.daysCovered, days.length);
  assert.deepEqual(n.longest, { length: 7, start: '2025-03-10', end: '2025-03-16' });
  assert.deepEqual(n.busiest, { date: '2025-03-12', count: 9 });
  assert.equal(n.months.length, 12);
  assert.equal(n.months[0], 3 + 2 + 5 + 5 + 5 + 1);
  assert.equal(n.months[2], 15);
  assert.equal(n.months[5], 8);
  assert.equal(n.months.reduce((a, b) => a + b, 0), n.total);
  assert.deepEqual(n.busiestMonth, { index: 0, count: 21 });
});

test('ties go to the earliest: the longest streak, the busiest day and the busiest month', () => {
  const n = yearNumbers([...run('2025-02-01', [3, 3]), ...run('2025-04-01', [3, 3]), ...run('2025-05-01', [2, 2, 2])], 2025);
  assert.deepEqual(n.longest, { length: 3, start: '2025-05-01', end: '2025-05-03' });
  const tie = yearNumbers([...run('2025-02-01', [3, 3]), ...run('2025-04-01', [3, 3])], 2025);
  assert.deepEqual(tie.longest, { length: 2, start: '2025-02-01', end: '2025-02-02' });
  assert.deepEqual(tie.busiest, { date: '2025-02-01', count: 3 });
  assert.deepEqual(tie.busiestMonth, { index: 1, count: 6 });
});

test('a missing day breaks a streak, only the days of the year count, and an empty year is empty', () => {
  const gap = yearNumbers([{ date: '2025-05-01', count: 2 }, { date: '2025-05-03', count: 2 }], 2025);
  assert.equal(gap.longest.length, 1, 'May 2 is not in the data, so nothing connects them');
  const edges = yearNumbers([...run('2024-12-30', [5, 5, 5, 5]), ...run('2025-12-30', [2, 2, 2, 2])], 2025);
  assert.equal(edges.total, 5 + 5 + 2 + 2, 'Jan 1 and 2, Dec 30 and 31');
  assert.deepEqual(edges.longest, { length: 2, start: '2025-01-01', end: '2025-01-02' }, 'the earliest of two');
  assert.equal(edges.daysCovered, 4);
  const none = yearNumbers(run('2025-01-01', [0, 0, 0]), 2025);
  assert.deepEqual(
    { ...none, months: undefined },
    { total: 0, activeDays: 0, daysCovered: 3, longest: null, busiest: null, months: undefined, busiestMonth: null },
  );
  assert.deepEqual(none.months, new Array(12).fill(0));
  const nothing = yearNumbers([], 2025);
  assert.equal(nothing.daysCovered, 0);
  const one = yearNumbers([{ date: '2025-07-04', count: 1 }], 2025);
  assert.deepEqual(one.longest, { length: 1, start: '2025-07-04', end: '2025-07-04' });
});

test('a streak crosses the end of a month and a leap day', () => {
  const n = yearNumbers(run('2024-02-27', [1, 1, 1, 1, 1]), 2024);
  assert.deepEqual(n.longest, { length: 5, start: '2024-02-27', end: '2024-03-02' });
});

test('the review carries the year, the languages, the train and who it is for', () => {
  const r = buildReview(sampleYear(2025), { year: 2025 });
  assert.equal(r.user, 'octocat');
  assert.equal(r.year, 2025);
  assert.equal(r.daysCovered, 365);
  assert.equal(r.longest.length, r.streak);
  assert.ok(r.longest.length >= 41);
  assert.deepEqual(r.busiest, { date: '2025-03-14', count: 58 });
  assert.equal(r.unlock, null);
  assert.deepEqual(r.languages.map((l) => l.name), ['TypeScript', 'Python', 'Rust', 'Luau']);
  assert.ok(Math.abs(r.languages.reduce((a, l) => a + l.share, 0) - 1) < 1e-9);
  assert.equal(buildReview(sampleYear(2025), { year: 2025, exclude: ['python', ' Luau '] }).languages.length, 2);
  // The cars come from the year's own total.
  assert.equal(r.cars, buildReview({ ...sampleYear(2025), days: [{ date: '2025-01-01', count: 30 }] }, { year: 2025 }).cars + 3);
});

test('the sample year is a whole year, and a year in progress stops at the sample day', () => {
  assert.equal(sampleYear(2025).days.length, 365);
  assert.equal(sampleYear(2024).days.length, 366);
  const so = sampleYear(2026, SAMPLE_NOW);
  assert.equal(so.days.at(-1).date, '2026-11-02');
  assert.equal(so.days.length, 306);
  assert.deepEqual(sampleYear(2025), sampleYear(2025));
});

// --- Reading a year from GitHub -------------------------------------------------------------

const reply = (body, ok = true, status = 200) => async () => ({
  ok,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});
const week = (...days) => ({ contributionDays: days.map(([date, contributionCount]) => ({ date, contributionCount })) });
const repo = (name, color, commits) => ({
  repository: name ? { primaryLanguage: { name, color } } : { primaryLanguage: null },
  contributions: { totalCount: commits },
});
const yearAnswer = (weeks, repos = [], login = 'ana') => ({
  data: { user: { login, contributionsCollection: { contributionCalendar: { weeks }, commitContributionsByRepository: repos } } },
});

test('fetchYear asks for the calendar year, with the token and the user', async () => {
  let seen;
  const r = await fetchYear({
    token: 'secret',
    user: 'ana',
    year: 2025,
    today: new Date('2026-11-05T10:00:00Z'),
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return reply(yearAnswer([week(['2025-01-01', 2], ['2025-01-02', 0])]))();
    },
  });
  assert.equal(seen.url, 'https://api.github.com/graphql');
  assert.equal(seen.init.headers.authorization, 'bearer secret');
  const sent = JSON.parse(seen.init.body);
  assert.deepEqual(sent.variables, { login: 'ana', from: '2025-01-01T00:00:00Z', to: '2025-12-31T23:59:59Z' });
  assert.match(sent.query, /contributionsCollection\(from: \$from, to: \$to\)/);
  assert.match(sent.query, /commitContributionsByRepository\(maxRepositories: 100\)/);
  assert.match(sent.query, /primaryLanguage \{ name color \}/);
  assert.equal(r.user, 'ana');
  assert.equal(r.year, 2025);
  assert.deepEqual(r.days, [{ date: '2025-01-01', count: 2 }, { date: '2025-01-02', count: 0 }]);
});

test('for the year in progress the window ends now; days from other years or the future are dropped', async () => {
  let sent;
  const r = await fetchYear({
    token: 't',
    user: 'ana',
    year: 2026,
    today: new Date('2026-11-02T10:30:00Z'),
    fetchImpl: async (url, init) => {
      sent = JSON.parse(init.body);
      return reply(
        yearAnswer([
          week(['2025-12-31', 9], ['2026-01-01', 1]),
          week(['2026-11-01', 0], ['2026-11-02', 4], ['2026-11-03', 0], ['2027-01-01', 3]),
        ]),
      )();
    },
  });
  assert.equal(sent.variables.from, '2026-01-01T00:00:00Z');
  assert.equal(sent.variables.to, '2026-11-02T10:30:00.000Z');
  assert.deepEqual(r.days.map((d) => d.date), ['2026-01-01', '2026-11-01', '2026-11-02']);
});

test('the languages of the year are the primary languages of the repositories committed to', async () => {
  const r = await fetchYear({
    token: 't',
    user: 'ana',
    year: 2025,
    today: new Date('2026-11-05T10:00:00Z'),
    fetchImpl: reply(
      yearAnswer([], [
        repo('Go', '#00ADD8', 40),
        repo('Rust', '#dea584', 10),
        repo(null, null, 99), // no primary language: it says nothing
        repo('Go', null, 5),
        repo('Zig', '#ec915c', 0),
      ]),
    ),
  });
  assert.deepEqual(r.languages, [
    { name: 'Go', color: '#00ADD8', bytes: 45 },
    { name: 'Rust', color: '#dea584', bytes: 10 },
  ]);
});

test('fetchYear retries like the other queries, fails clearly, and refuses a year that cannot exist', async () => {
  const today = new Date('2026-11-05T10:00:00Z');
  let calls = 0;
  const flaky = async () => {
    calls++;
    if (calls === 1) throw new Error('socket hang up');
    if (calls === 2) return reply({ message: 'bad gateway' }, false, 502)();
    return reply(yearAnswer([week(['2025-05-01', 1])]))();
  };
  const r = await fetchYear({ token: 't', user: 'ana', year: 2025, today, fetchImpl: flaky, retryDelay: 1 });
  assert.equal(calls, 3);
  assert.equal(r.days.length, 1);

  calls = 0;
  const denied = async () => (calls++, reply({ message: 'nope' }, false, 401)());
  await assert.rejects(fetchYear({ token: 'secret', user: 'a', year: 2025, today, fetchImpl: denied, retryDelay: 1 }), (e) => /401/.test(e.message) && !e.message.includes('secret'));
  assert.equal(calls, 1);
  await assert.rejects(fetchYear({ token: 't', user: 'nobody', year: 2025, today, fetchImpl: reply({ data: { user: null } }) }), /User "nobody" not found/);
  await assert.rejects(fetchYear({ token: 't', user: 'a', year: 2025, today, fetchImpl: reply({ errors: [{ message: 'Bad credentials' }] }) }), /Bad credentials/);
  await assert.rejects(fetchYear({ token: 't', user: 'a', year: 2027, today, fetchImpl: reply({}) }), /The year 2027 has not started yet/);
  await assert.rejects(fetchYear({ token: 't', user: 'a', year: 2007, today, fetchImpl: reply({}) }), /Not a year to review/);
  await assert.rejects(fetchYear({ token: 't', user: 'a', year: '2025', today, fetchImpl: reply({}) }), /Not a year to review/);
});

// --- The special cars on the mini train -----------------------------------------------------

test('each special car has a mini that is one cell high, differs from a plain car and from the others', () => {
  const model = getModel('metro-white');
  const plain = miniTrain(model, { streak: 20 });
  assert.equal(plain.extra, undefined);
  assert.deepEqual(MINI_EXTRAS, ['dining', 'observation', 'mail']);
  const seen = new Set([JSON.stringify(plain.car.grid.cells)]);
  for (const kind of MINI_EXTRAS) {
    const { extra, head, car } = miniTrain(model, { streak: 20, extra: kind });
    assert.equal(extra.w, car.w);
    assert.equal(extra.grid.w, car.grid.w);
    assert.equal(extra.grid.h, car.grid.h);
    assert.deepEqual(head, plain.head, 'the cab and the plain car do not change');
    assert.deepEqual(car, plain.car);
    seen.add(JSON.stringify(extra.grid.cells));
  }
  assert.equal(seen.size, 4);
  assert.throws(() => miniTrain(model, { extra: 'sleeper' }), /Unknown special car: "sleeper"/);
});

test('the dining mini carries a lantern on its roof and the mail mini has no windows', () => {
  const model = getModel('metro-orange');
  const dining = miniTrain(model, { streak: 0, extra: 'dining' }).extra.grid;
  const roofRows = [0, 1].flatMap((y) => Array.from({ length: dining.w }, (_, x) => dining.get(x, y)).filter(Boolean));
  assert.ok(roofRows.length >= 3, 'something above the roof line');
  const plainCar = miniTrain(model, { streak: 0 }).car.grid;
  assert.equal([0, 1].flatMap((y) => Array.from({ length: plainCar.w }, (_, x) => plainCar.get(x, y)).filter(Boolean)).length, 0);
  const glass = model.pal.glass;
  const mail = miniTrain(model, { streak: 0, extra: 'mail' }).extra.grid;
  const count = (g, color) => g.cells.filter((c) => c === color).length;
  assert.equal(count(mail, glass), 0, 'no glass');
  assert.ok(count(miniTrain(model, { streak: 0, extra: 'observation' }).extra.grid, glass) > count(plainCar, glass));
});

// --- The poster ------------------------------------------------------------------------------

const review = (year = 2025, unlock = null) => {
  const r = buildReview(sampleYear(year), { year });
  r.unlock = unlock;
  return r;
};
const poster = (o = {}, r = review()) => renderReview(r, { theme: 'light', model: 'metro-white', stripe: '#3178c6', ...o });
const balanced = (svg, tag) => (svg.match(new RegExp(`<${tag}[ >]`, 'g')) ?? []).length === (svg.match(new RegExp(`</${tag}>`, 'g')) ?? []).length;

test('the poster is a complete, self-contained SVG', () => {
  const svg = poster();
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
  assert.equal((svg.match(/<svg/g) ?? []).length, 1);
  assert.ok(balanced(svg, 'g') && balanced(svg, 'text') && balanced(svg, 'defs'));
  assert.ok(!/undefined|NaN|null|Infinity/.test(svg));
  assert.ok(!/(href|src)=["'](?!#)/.test(svg), 'no external references');
  assert.ok(!/<script|<image|@import|url\(["']?http|<foreignObject/.test(svg));
  assert.match(svg, /^<svg[^>]* width="640" height="460" viewBox="0 0 640 460"/);
  assert.match(svg, /role="img" aria-labelledby="t" aria-describedby="d"><title id="t">octocat's 2025 in review: 869 contributions on 197 active days/);
  assert.ok(svg.length < 32 * 1024, `${(svg.length / 1024).toFixed(1)} KB`);
});

test('the poster says the numbers of the year', () => {
  const r = review();
  const svg = poster();
  for (const word of ['YEAR IN REVIEW 2025', 'octocat', 'CONTRIBUTIONS', 'ACTIVE DAYS', 'LONGEST STREAK', 'BUSIEST DAY', 'BUSIEST MONTH', 'TOP LANGUAGES']) {
    assert.ok(svg.includes(word), word);
  }
  assert.ok(svg.includes('of 365 days'));
  assert.ok(svg.includes('58 contributions'), 'the busiest day');
  assert.ok(svg.includes('Mar 31 – May 16'), 'the dates of the streak');
  assert.ok(svg.includes('>March<'), 'the busiest month');
  assert.ok(svg.includes(`${r.months[2]} contributions`) && svg.includes('% of the year'));
  for (const m of ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']) assert.ok(svg.includes(`>${m}<`), m);
  for (const l of ['TypeScript 50%', 'Python 29%', 'Rust 15%', 'Luau 6%']) assert.ok(svg.includes(l), l);
  // The description has every number for a screen reader.
  assert.match(svg, /<desc id="d">CONTRIBUTIONS: 869\. ACTIVE DAYS: 197 of 365 days\./);
  assert.match(svg, /RIDERSHIP BY MONTH: JAN 40, FEB 46, MAR 171/);
});

test('the poster in Spanish speaks Spanish, with Spanish months and numbers', () => {
  const es = poster({ language: 'es' });
  for (const word of ['RESUMEN DEL AÑO 2025', 'CONTRIBUCIONES', 'DÍAS ACTIVOS', 'RACHA MÁS LARGA', 'DÍA MÁS ACTIVO', 'MES MÁS ACTIVO', 'LENGUAJES MÁS USADOS', 'PASAJEROS POR MES']) {
    assert.ok(es.includes(word), word);
  }
  assert.ok(es.includes('de 365 días') && es.includes('>Marzo<') && es.includes('>ENE<') && es.includes('>AGO<') && es.includes('>DIC<'));
  assert.ok(es.includes('58 contribuciones') && es.includes('31 mar – 16 may') && es.includes('% del año') && es.includes('4,4 por día activo'));
  assert.ok(!es.includes('YEAR IN REVIEW') && !es.includes('BUSIEST') && !es.includes('contributions'));
  assert.match(es, /<title id="t">Resumen de 2025 de octocat: 869 contribuciones en 197 días activos/);
  // A thousand is 1.234 in Spanish, 1,234 in English.
  const big = { ...review(), total: 1234 };
  assert.match(renderReview(big, { language: 'es', theme: 'light' }), /1\.234 contribuciones|CONTRIBUCIONES/);
  assert.match(renderReview(big, { language: 'en', theme: 'light' }), /<title id="t">octocat's 2025 in review: 1234 contributions/);
  assert.deepEqual(Object.keys(LABELS.en).sort(), Object.keys(LABELS.es).sort());
  assert.deepEqual(Object.keys(LABELS.en.unlock), Object.keys(LABELS.es.unlock));
});

test('light and dark have their own colors and auto follows the viewer', () => {
  const light = poster({ theme: 'light' });
  const dark = poster({ theme: 'dark' });
  for (const v of Object.values(REVIEW_COLORS.light)) assert.ok(light.toLowerCase().includes(`#${v}`), `light ${v}`);
  for (const v of Object.values(REVIEW_COLORS.dark)) assert.ok(dark.toLowerCase().includes(`#${v}`), `dark ${v}`);
  assert.ok(!light.includes('var(--') && !dark.includes('var(--') && !light.includes('prefers-color-scheme'), 'plain colors: any viewer');
  const auto = poster({ theme: 'auto' });
  assert.match(auto, /:root\{--background:#ffffff;[^}]*\}@media \(prefers-color-scheme:dark\)\{:root\{--background:#0d1117;/);
  assert.ok(auto.includes('var(--ring)') && auto.includes('var(--title)'));
  assert.equal(poster({ theme: 'whatever' }), auto, 'anything else is auto');
});

test('the colors are the same five inputs as the cards, for both themes, and hostile ones fall back', () => {
  const colors = { background: '112233', title: 'AA0011', icon: '00BB22', text: 'DDEE33', ring: '44CC88' };
  for (const theme of ['light', 'dark', 'auto']) {
    const svg = poster({ theme, ...colors });
    for (const hex of Object.values(colors)) assert.ok(svg.includes(`#${hex}`), `${theme} ${hex}`);
    for (const mode of ['light', 'dark']) {
      for (const [role, v] of Object.entries(REVIEW_COLORS[mode])) {
        if (theme === mode || theme === 'auto') assert.ok(!svg.toLowerCase().includes(`#${v}`) || v === colors[role].toLowerCase(), `leftover ${theme}/${mode} default #${v}`);
      }
    }
  }
  const hostile = poster({ background: 'red" onload="x', title: '</style><script>', text: 'javascript:alert(1)' });
  assert.ok(!hostile.includes('onload') && !hostile.includes('<script') && !hostile.includes('javascript'));
  assert.ok(hostile.includes(`#${REVIEW_COLORS.light.background}`));
});

test('the border can be removed', () => {
  assert.ok(poster({ border: true }).includes('stroke-opacity="0.25"'));
  assert.ok(poster({ border: false }).includes('stroke-opacity="0"'));
});

test('the user name and the languages are escaped and clipped', () => {
  const evil = { ...review(), user: '<img src=x onerror=alert(1)>"&', languages: [{ name: '"><script>x</script>', color: 'red" onload="x', bytes: 5, share: 1 }] };
  const svg = poster({}, evil);
  assert.ok(!svg.includes('<img') && !svg.includes('<script') && !svg.includes('onload'));
  assert.ok(svg.includes('&lt;img') || svg.includes('&lt;IMG'));
  assert.ok(balanced(svg, 'g') && balanced(svg, 'text'));
  assert.equal((svg.match(/<svg/g) ?? []).length, 1);
  const long = poster({}, { ...review(), user: 'a'.repeat(39) });
  assert.ok(long.includes('…'), 'a long name is clipped, not run into the title');
  assert.ok(poster({}, { ...review(), languages: [{ name: 'Jupyter Notebook Extra Long', color: '#123456', bytes: 5, share: 1 }] }).includes('Jupyter No…'));
});

test('the stations stand as tall as their months and the busiest one is in the title color', () => {
  const svg = poster();
  // Values above the stations: busiest month flagged in its own class.
  assert.equal((svg.match(/class="val on"/g) ?? []).length, 1);
  assert.equal((svg.match(/class="mo on"/g) ?? []).length, 1);
  assert.match(svg, /class="mo on"[^>]*>MAR</);
  assert.match(svg, /class="val on"[^>]*>171</);
  assert.match(svg, /class="val"[^>]*>40</);
  assert.ok(svg.includes('>3<'), 'August is almost nothing: the number is still shown');
  // A month with nothing has a hut and a name, but no number.
  const r = review();
  r.months[7] = 0;
  const quiet = poster({}, r);
  assert.ok(quiet.includes('>AUG<'));
  assert.equal((quiet.match(/class="val/g) ?? []).length, 11);
  assert.ok(!/class="val"[^>]*>0</.test(quiet));
  // Large months are short ("1.2k"), like on the stats card.
  const huge = review();
  huge.months[5] = 1234;
  assert.match(poster({}, huge), /class="val"[^>]*>1\.2k</);
});

test('an empty year and a year in progress still draw a poster', () => {
  const empty = buildReview({ user: 'ana', days: [{ date: '2025-01-01', count: 0 }], languages: [] }, { year: 2025 });
  const svg = poster({}, empty);
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>') && !/NaN|undefined|Infinity/.test(svg));
  assert.ok(svg.includes('No contributions yet') && svg.includes('No language data'));
  assert.ok(!/class="mo on"/.test(svg) && !/class="val/.test(svg));
  assert.ok(renderReview(empty, { language: 'es', theme: 'dark' }).includes('Sin contribuciones todavía'));
  const part = poster({}, review(2026));
  assert.ok(part.includes('of 306 days') && part.includes('YEAR IN REVIEW 2026'));
  assert.ok(balanced(part, 'g'));
});

test('the train is the one you picked: a catalog model, a custom one, a steam locomotive', () => {
  const svg = (model) => poster({ model });
  assert.ok(svg('tram').includes('#8a1c2b'), 'the tram is wine red');
  assert.ok(!svg('metro-white').includes('#8a1c2b'));
  assert.notEqual(svg(steam), svg('tram'));
  assert.ok(svg(steam).includes('<use href="#h"/>') && svg(steam).includes('#3178c6'), 'the stripe is the language color');
  assert.equal(poster({ stripe: 'not a color' }), poster({ stripe: '#3178c6' }), 'a bad stripe falls back to the top language');
  assert.ok(poster({ stripe: '#ff00aa' }).includes('#ff00aa'));
  const r = review();
  const cars = (n) => (poster({}, { ...r, cars: n }).match(/<use href="#c"\/>/g) ?? []).length;
  assert.deepEqual([1, 2, 4, 6].map(cars), [0, 1, 3, 5]);
  assert.equal(cars(99), 5, 'six cars at most');
});

test('the special car you earned rides right behind the cab, and the poster says so', () => {
  const none = poster({}, review());
  assert.ok(!none.includes('href="#e"') && !none.includes('unlocked'));
  assert.match(none, /height="460"/);
  for (const [kind, en, es] of [
    ['dining', 'Dining car unlocked: 100-day streak', 'Vagón comedor desbloqueado: racha de 100 días'],
    ['observation', 'Observation car unlocked: 100+ stars', 'Vagón mirador desbloqueado: más de 100 estrellas'],
    ['mail', 'Mail car unlocked: 500+ pull requests', 'Vagón postal desbloqueado: más de 500 pull requests'],
  ]) {
    const svg = poster({}, review(2025, kind));
    assert.ok(svg.includes(en), en);
    assert.ok(poster({ language: 'es' }, review(2025, kind)).includes(es), es);
    assert.match(svg, /height="484"/, 'room for the line');
    // The head first, then the special car, then the plain ones.
    assert.match(svg, /<use href="#h"\/><\/g><g[^>]*><use href="#e"\/><\/g><g[^>]*><use href="#c"\/>/);
    assert.notEqual(svg, none);
  }
});

test('the special car is earned on the year: its longest streak, and the profile stars and PRs', () => {
  const r = review();
  const { stars, prs } = sampleProfile();
  assert.equal(unlockFor({ streak: r.streak, stars, prs }), 'observation');
  assert.equal(unlockFor({ streak: r.streak, stars: 0, prs: 0 }), null, 'a 47-day streak is not 100');
});

// The keyframes of the journey: [{ at (%), x (art pixels), steps (to the next one) }], and the stops
// ({ x, hold (% of the loop) }) where two keyframes stand at the same x.
function journey(svg) {
  const frames = /@keyframes run\{(.*?)\}\}/.exec(svg)?.[1] + '}';
  assert.ok(frames.startsWith('0%{'));
  const kf = [...frames.matchAll(/([\d.]+)%\{transform:translate\((-?\d+)px,0\)(?:;animation-timing-function:steps\((\d+)\))?\}/g)].map((m) => ({
    at: Number(m[1]),
    x: Number(m[2]),
    steps: m[3] ? Number(m[3]) : 0,
  }));
  const stops = [];
  for (let i = 1; i < kf.length; i++) if (kf[i].x === kf[i - 1].x) stops.push({ x: kf[i].x, hold: kf[i].at - kf[i - 1].at });
  return { kf, stops };
}

test('the journey is CSS only, in whole-pixel steps, and stops longest where the month was busiest', () => {
  const svg = poster();
  assert.ok(!/<animate|<set |onload=|<script/.test(svg), 'no SMIL or script');
  const { kf, stops } = journey(svg);
  assert.equal(kf.at(-1).at, 100);
  assert.ok(kf.length > 12, 'it moves and it stops');
  assert.ok(kf[0].x < 0, 'it starts out of sight, on the left');
  assert.ok(kf.at(-1).x > 320, 'and leaves on the right');
  for (let i = 1; i < kf.length; i++) {
    assert.ok(kf[i].at > kf[i - 1].at, `keyframe ${i} comes later`);
    assert.ok(kf[i].x >= kf[i - 1].x, 'never backwards');
    // A move: one step per art pixel. A stop: the same place.
    if (kf[i].x !== kf[i - 1].x) assert.equal(kf[i - 1].steps, kf[i].x - kf[i - 1].x, `steps at ${kf[i - 1].at}%`);
  }
  // Dwell time at each station: the busiest month holds the longest, an empty one is passed through.
  assert.equal(stops.length, 12, 'twelve stops: every month had something');
  const longest = stops.reduce((a, b) => (b.hold > a.hold ? b : a));
  assert.equal(longest.x, 28 + 24 * 2 + 8, 'in March');
  const shortest = stops.reduce((a, b) => (b.hold < a.hold ? b : a));
  assert.equal(shortest.x, 28 + 24 * 7 + 8, 'and the shortest in August, which had 3');
  // A month with nothing is an express pass: the train does not stop at its station.
  const r = review();
  r.months[4] = 0;
  const express = journey(poster({}, r));
  assert.equal(express.stops.length, 11);
  assert.ok(!express.stops.some((s) => s.x === 28 + 24 * 4 + 8));
  assert.ok(express.kf.some((k) => k.x === 28 + 24 * 4 + 8), 'it still passes it');
});

test('with reduced motion the train stands at the last station, and it is parked there without animation too', () => {
  const svg = poster();
  assert.match(svg, /@media \(prefers-reduced-motion:\s*reduce\)\{\.tr\{animation:none\}\}/);
  assert.match(svg, /\.tr\{transform:translate\(300px,0\);animation:run [\d.]+s linear infinite\}/);
  assert.equal(300, 28 + 24 * 11 + 8, 'the last station, December');
  const seconds = Number(/animation:run ([\d.]+)s/.exec(svg)[1]);
  assert.ok(seconds > 10 && seconds < 60, `${seconds} s`);
});

test('the poster is deterministic and does not depend on the clock', () => {
  const a = poster({ theme: 'auto' });
  assert.equal(poster({ theme: 'auto' }), a);
  assert.equal(renderReview(review(), { theme: 'auto', model: 'metro-white', stripe: '#3178c6' }), a);
});

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

test('the action.yml declares the two inputs, off and empty by default', () => {
  const yml = readFileSync(new URL('../action.yml', import.meta.url), 'utf8');
  assert.match(yml, /\n  year-in-review:\n    description: [^\n]*year-in-review\.svg[^\n]*\n    default: "false"\n/);
  assert.match(yml, /\n  review-year:\n    description: [^\n]*January[^\n]*\n    default: ""\n/);
});
