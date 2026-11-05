import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Grid } from '../src/pixel.js';
import { MODELS, MODEL_ORDER } from '../src/models.js';
import { parseCustomModel } from '../src/custom.js';
import { sampleStats } from '../src/sample.js';
import { calendarCells, calendarGeometry, renderCalendar, tunnelLayout } from '../src/calendar.js';
import { paintTunnels } from '../src/tunnels.js';
import { miniTrain, MINI_H, MINI_UP, CAR_W } from '../src/mini.js';

const example = (name) => parseCustomModel(JSON.parse(readFileSync(new URL(`../examples/trains/${name}.json`, import.meta.url), 'utf8')));

test('the calendar lays days out like GitHub: a column per week, Sunday on top', () => {
  // 2026-11-01 was a Sunday.
  const days = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'].map((date, i) => ({ date, count: i }));
  const { cells, weeks } = calendarCells(days);
  assert.deepEqual(cells.map((c) => [c.col, c.row]), [[0, 5], [0, 6], [1, 0], [1, 1]]);
  assert.equal(weeks, 2);
  assert.equal(cells[0].level, 0);
  assert.ok(cells.slice(1).every((c) => c.level >= 1 && c.level <= 4));
});

test('the train only shows between the tunnel mouths, and every row ends in a tunnel', () => {
  for (const weeks of [1, 53, 54]) {
    const geo = calendarGeometry(weeks);
    const g = new Grid(geo.W, geo.H);
    const layout = tunnelLayout(geo.W, geo.LEFT, geo.RIGHT, geo.rowY);
    paintTunnels(g, layout);
    for (const top of layout.rowTops) {
      const mid = top + layout.cellH / 2;
      assert.ok(g.get(geo.LEFT - 1, mid) && g.get(geo.RIGHT, mid), `weeks ${weeks}: no tunnel mouth at row ${top}`);
    }
  }
  const s = sampleStats();
  const svg = renderCalendar(s, { model: 'tram' });
  const geo = calendarGeometry(Math.ceil((s.days.length + new Date(`${s.days[0].date}T00:00:00Z`).getUTCDay()) / 7));
  assert.match(svg, new RegExp(`<clipPath id="k"><rect x="${geo.LEFT}" y="0" width="${geo.RIGHT - geo.LEFT}" height="${geo.H}"/></clipPath>`));
  assert.match(svg, /<g class="tr" clip-path="url\(#k\)">/);
});

test('every model gets a mini train one cell high', () => {
  const models = [...MODEL_ORDER.map((id) => MODELS[id]), example('new-york'), example('steam')];
  for (const m of models) {
    const { head, car } = miniTrain(m, { stripe: '#3178c6', streak: 10 });
    assert.equal(car.w, CAR_W);
    assert.equal(head.grid.h, MINI_UP + MINI_H);
    assert.ok(head.w >= (m.loco ? 6 : CAR_W + 2) && head.w <= 32, `${m.id}: ${head.w}`);
    assert.ok(!head.grid.isEmpty() && !car.grid.isEmpty());
  }
  // A steam locomotive keeps its chimney above the cars.
  const steam = miniTrain(example('steam')).head.grid;
  assert.ok([...Array(steam.w).keys()].some((x) => steam.get(x, 0) || steam.get(x, 1)));
});

test('the calendar is a well-formed animated SVG for every kind of train', () => {
  const s = sampleStats();
  for (const model of [...MODEL_ORDER, example('osaka'), example('steam')]) {
    for (const theme of ['light', 'dark', 'auto']) {
      const svg = renderCalendar(s, { model, theme, stripe: '#3178c6' });
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
      assert.equal((svg.match(/<g[ >]/g) ?? []).length, (svg.match(/<\/g>/g) ?? []).length);
      assert.ok(!/undefined|NaN|null/.test(svg), `${model.id ?? model} ${theme}`);
      assert.ok(svg.length < 100 * 1024, `${(svg.length / 1024).toFixed(0)} KB`);
    }
  }
});

test('each day with contributions is eaten once, and the train grows to its full length', () => {
  const s = sampleStats({ total: 1400 });
  const svg = renderCalendar(s, { model: 'metro-white' });
  const busy = s.days.filter((d) => d.count > 0).length;
  assert.equal((svg.match(/@keyframes e\d+\{/g) ?? []).length, busy);
  assert.equal((svg.match(/class="u u\d+"/g) ?? []).length, s.cars);
  assert.equal((svg.match(/@keyframes v\d+\{/g) ?? []).length, s.cars - 1);
  // The cars join in order along the way.
  const joins = [...svg.matchAll(/@keyframes v\d+\{0%\{opacity:0\}([\d.]+)%/g)].map((m) => Number(m[1]));
  assert.deepEqual(joins, [...joins].sort((a, b) => a - b));
});

test('with reduced motion nothing moves, and the train is parked in view', () => {
  const svg = renderCalendar(sampleStats(), { model: 'tram' });
  assert.match(svg, /@media \(prefers-reduced-motion:reduce\)\{\.tr>g,\.ce>path\{animation:none!important\}\}/);
  assert.match(svg, /\.u0\{transform:translate\(\d+px,\d+px\);animation:r /);
});

test('the train runs faster after a busier yesterday', () => {
  const period = (yesterday) => Number(/animation:r ([\d.]+)s/.exec(renderCalendar(sampleStats({ yesterday }), { model: 'tram' }))[1]);
  assert.ok(period(0) > period(2) && period(2) > period(6) && period(6) > period(15));
});

test('the caption and the title follow the language', () => {
  const s = sampleStats({ streak: 7 });
  const en = renderCalendar(s, { model: 'tram', language: 'en' });
  const es = renderCalendar(s, { model: 'tram', language: 'es' });
  assert.match(en, /aria-label="octocat's contribution calendar/);
  assert.match(es, /aria-label="Calendario de contribuciones de octocat/);
});
