import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MINI_EXTRAS, miniTrain } from '../../src/trains/mini.js';
import { getModel } from '../../src/trains/models.js';
import { parseCustomModel } from '../../src/trains/parse.js';
import { buildReview } from '../../src/review/data.js';
import { LABELS, REVIEW_COLORS, renderReview } from '../../src/review/render.js';
import { sampleProfile, sampleYear } from '../../src/demo/sample.js';
import { unlockFor } from '../../src/activity/unlocks.js';

const steam = parseCustomModel(JSON.parse(readFileSync(new URL('../../examples/trains/steam.json', import.meta.url), 'utf8')));

// --- The poster ------------------------------------------------------------------------------

const review = (year = 2025, unlock = null) => {
  const r = buildReview(sampleYear(year), { year });
  r.unlock = unlock;
  return r;
};

const poster = (o = {}, r = review()) => renderReview(r, { theme: 'light', model: 'metro-white', stripe: '#3178c6', ...o });

const balanced = (svg, tag) => (svg.match(new RegExp(`<${tag}[ >]`, 'g')) ?? []).length === (svg.match(new RegExp(`</${tag}>`, 'g')) ?? []).length;

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
