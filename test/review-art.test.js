// The contract of the year in review's pixel art (src/review-art.js): what each painter may
// touch and which colors it may use. How it looks is not tested here, only that it stays in
// its place, on the poster's tones, and the same every time.

import test from 'node:test';
import assert from 'node:assert/strict';
import { Grid } from '../src/pixel.js';
import { buildReview, renderReview } from '../src/review.js';
import { sampleYear } from '../src/sample.js';
import {
  ICON_SIZE,
  STAT_ICONS,
  STATION_MAX_H,
  STATION_MIN_H,
  STATION_W,
  TONES,
  paintBackdrop,
  paintPanel,
  paintRoute,
  paintStatIcon,
  paintStation,
  stationHeight,
} from '../src/review-art.js';

const ROLES = ['background', 'title', 'icon', 'text', 'ring'];
const W = 320;
const H = 200;
const RAIL = 160;

const cells = (g) => g.cells.map((c, i) => [i % g.w, Math.floor(i / g.w), c]).filter(([, , c]) => c);
const colorsOf = (g) => new Set(cells(g).map(([, , c]) => c));
const box = (g) => {
  const c = cells(g);
  return {
    x0: Math.min(...c.map((p) => p[0])),
    x1: Math.max(...c.map((p) => p[0])),
    y0: Math.min(...c.map((p) => p[1])),
    y1: Math.max(...c.map((p) => p[1])),
  };
};

test('the tones are the poster colors, as they are or at a lower opacity', () => {
  assert.ok(Object.keys(TONES).length >= 15);
  for (const [name, [role, opacity]] of Object.entries(TONES)) {
    assert.match(name, /^[a-zA-Z][a-zA-Z0-9]*$/, name);
    assert.ok(ROLES.includes(role), `${name}: ${role}`);
    assert.ok(opacity > 0 && opacity <= 1, `${name}: ${opacity}`);
  }
});

test('every painter draws only with tones, never with a fixed color', () => {
  const g = new Grid(W, H);
  paintBackdrop(g, { width: W, railY: RAIL });
  paintRoute(g, { width: W, railY: RAIL, stops: [28, 52, 76] });
  paintPanel(g, 10, 31, 72, 42);
  for (const kind of STAT_ICONS) paintStatIcon(g, kind, 60, 50);
  for (const [i, h] of [0, STATION_MIN_H, 30, STATION_MAX_H].entries()) {
    paintStation(g, { x: 28 + 24 * i, railY: RAIL, height: h, busiest: i === 3 });
  }
  const colors = colorsOf(g);
  assert.ok(colors.size >= 8, `${colors.size} colors`);
  for (const c of colors) {
    assert.ok(c.startsWith('@') && c.slice(1) in TONES, `${c} is not a tone`);
  }
});

test('the height of a station follows its month, from the minimum to the maximum', () => {
  assert.equal(stationHeight(0, 100), 0);
  assert.equal(stationHeight(-3, 100), 0);
  assert.equal(stationHeight(5, 0), 0);
  assert.equal(stationHeight(100, 100), STATION_MAX_H);
  assert.equal(stationHeight(1, 100000), STATION_MIN_H);
  let last = 0;
  for (let v = 1; v <= 200; v += 3) {
    const h = stationHeight(v, 200);
    assert.ok(h >= last && h >= STATION_MIN_H && h <= STATION_MAX_H, `${v} -> ${h}`);
    last = h;
  }
  assert.ok(stationHeight(100, 200) * 2 >= stationHeight(200, 200) - 1, 'linear: half the month, half the tower');
});

test('a station stays on its column, above the rail, and as tall as it is told', () => {
  for (const height of [STATION_MIN_H, 20, 41, STATION_MAX_H]) {
    for (const busiest of [false, true]) {
      const g = new Grid(W, H);
      paintStation(g, { x: 100, railY: RAIL, height, busiest });
      const b = box(g);
      assert.ok(b.x0 >= 100 - STATION_W / 2 - 1 && b.x1 <= 100 + STATION_W / 2 + 6, `x ${b.x0}..${b.x1}`);
      assert.ok(b.y1 < RAIL, 'stands on the rail row, never on or under it');
      assert.ok(b.y1 >= RAIL - 3, 'and reaches it');
      assert.ok(b.y0 >= RAIL - height - 8, `y ${b.y0}: at most a flag above the tower`);
      assert.ok(b.y0 <= RAIL - height, 'as tall as asked');
    }
  }
});

test('a month with nothing gets a hut, smaller than any station', () => {
  const g = new Grid(W, H);
  paintStation(g, { x: 100, railY: RAIL, height: 0 });
  const b = box(g);
  assert.ok(!g.isEmpty());
  assert.ok(RAIL - b.y0 < STATION_MIN_H, 'lower than the lowest tower');
  assert.ok(b.x0 >= 100 - STATION_W / 2 && b.x1 <= 100 + STATION_W / 2);
});

test('the busiest month is drawn in its own tones and nobody else is', () => {
  const plain = new Grid(W, H);
  const star = new Grid(W, H);
  paintStation(plain, { x: 100, railY: RAIL, height: 40 });
  paintStation(star, { x: 100, railY: RAIL, height: 40, busiest: true });
  const names = (g) => [...colorsOf(g)].map((c) => c.slice(1));
  assert.ok(names(star).some((n) => TONES[n][0] === 'title'), 'the title color');
  assert.ok(!names(plain).some((n) => TONES[n][0] === 'title'), 'not the plain ones');
  assert.ok(names(plain).some((n) => TONES[n][0] === 'ring'), 'the plain ones are the ring color');
  assert.ok(!names(star).some((n) => TONES[n][0] === 'ring'));
  assert.notDeepEqual(plain.cells, star.cells);
});

test('a taller month stands taller, and a flag adds height, not width', () => {
  const tops = [10, 20, 30, 54].map((height) => {
    const g = new Grid(W, H);
    paintStation(g, { x: 100, railY: RAIL, height });
    return box(g).y0;
  });
  assert.deepEqual([...tops].sort((a, b) => b - a), tops);
  assert.equal(new Set(tops).size, tops.length);
});

test('the stat panel stays inside its rectangle and has an outline', () => {
  const g = new Grid(W, H);
  paintPanel(g, 10, 31, 72, 42);
  const b = box(g);
  assert.deepEqual(b, { x0: 10, x1: 81, y0: 31, y1: 72 });
  assert.ok(colorsOf(g).size >= 2, 'a fill and an outline');
  assert.equal(g.get(10, 31), null, 'cut corners');
  assert.equal(g.get(81, 72), null);
  assert.ok(g.get(11, 31) && g.get(10, 32) && g.get(45, 50));
});

test('each stat icon is its own drawing, ICON_SIZE pixels square at most', () => {
  assert.deepEqual(STAT_ICONS, ['total', 'days', 'streak', 'busiest']);
  const seen = new Set();
  for (const kind of STAT_ICONS) {
    const g = new Grid(30, 30);
    paintStatIcon(g, kind, 10, 10);
    const b = box(g);
    assert.ok(b.x0 >= 10 && b.y0 >= 10 && b.x1 < 10 + ICON_SIZE && b.y1 < 10 + ICON_SIZE, `${kind}: ${JSON.stringify(b)}`);
    assert.ok(cells(g).length >= 12, `${kind} has something to see`);
    seen.add(JSON.stringify(g.cells));
  }
  assert.equal(seen.size, STAT_ICONS.length);
  assert.throws(() => paintStatIcon(new Grid(9, 9), 'cat', 0, 0), /Unknown stat icon: "cat"/);
});

test('the backdrop stays above the rail and is the same every time', () => {
  const a = new Grid(W, H);
  const b = new Grid(W, H);
  paintBackdrop(a, { width: W, railY: RAIL });
  paintBackdrop(b, { width: W, railY: RAIL });
  assert.deepEqual(a.cells, b.cells);
  assert.ok(!a.isEmpty());
  assert.ok(box(a).y1 < RAIL, 'nothing on or under the rail');
  assert.ok(box(a).y0 > RAIL - 80, 'low hills: the stations are taller');
  assert.ok(box(a).x0 === 0 && box(a).x1 === W - 1, 'across the whole width');
});

test('the route is a rail with ties and ballast, with a platform edge at each stop', () => {
  const g = new Grid(W, H);
  const stops = [28, 52, 76, 100];
  paintRoute(g, { width: W, railY: RAIL, stops });
  const b = box(g);
  assert.equal(b.y0, RAIL, 'the running rail is the top row');
  assert.ok(b.y1 <= RAIL + 6, 'a few rows deep');
  assert.ok(b.x0 === 0 && b.x1 === W - 1);
  for (let x = 0; x < W; x++) assert.ok(g.get(x, RAIL), `rail at ${x}`);
  const plain = new Grid(W, H);
  paintRoute(plain, { width: W, railY: RAIL, stops: [] });
  assert.notDeepEqual(plain.cells, g.cells, 'the stops show');
  for (const x of stops) assert.ok(g.get(x, RAIL + 1), `platform at ${x}`);
});

test('the whole poster stays small and renders cleanly in both themes with any colors', () => {
  const review = buildReview(sampleYear(2025), { year: 2025 });
  for (const theme of ['light', 'dark', 'auto']) {
    const svg = renderReview(review, { theme, model: 'tram' });
    assert.ok(svg.length < 32 * 1024, `${theme}: ${(svg.length / 1024).toFixed(1)} KB`);
    assert.ok(!/undefined|NaN|null/.test(svg), theme);
  }
  // Every tone the art uses has its CSS rule, with whatever colors the user picked.
  const svg = renderReview(review, { theme: 'light', background: '101820', title: 'fee715', icon: 'ff6b6b', text: 'f2f2f2', ring: '00c2a8' });
  const used = new Set([...svg.matchAll(/class="c-(w+)"/g)].map((m) => m[1]));
  for (const name of used) assert.ok(svg.includes(`.c-${name}{`), `.c-${name} has no rule`);
  for (const hex of ['101820', 'fee715', 'ff6b6b', 'f2f2f2', '00c2a8']) assert.ok(svg.includes(`#${hex}`), hex);
});
