// Calendar mode: your contribution calendar with your train running through it
// like a snake. It runs row by row (left to right, then right to left), goes
// into a tunnel at the end of each row and comes out one row down. Each day
// with contributions it passes is eaten (the cell goes blank), and the train
// grows a car at a time until it has as many as on your big train. At the end
// it leaves through the last tunnel, the calendar fills up again and it starts
// over.
//
// Same rules as the scene: one SVG, CSS animation only, 1 px steps, theme
// colors as CSS variables, and nothing moves with prefers-reduced-motion.

import { Grid } from './pixel.js';
import { drawText, textWidth } from './font.js';
import { LED_ON } from './train.js';
import { miniTrain, MINI_UP } from './mini.js';
import { paintTunnels } from './tunnels.js';
import { getModel } from './models.js';

// What the tunnels need to know about the calendar (see tunnels.js).
export const tunnelLayout = (width, left, right, rowY) => ({
  width,
  left,
  right,
  rowTops: Array.from({ length: ROWS }, (_, r) => rowY(r)),
  cellH: CELL,
  up: MINI_UP,
});

const CELL = 10;
const GAP = 3;
const PITCH = CELL + GAP;
const ROWS = 7;
const SIDE = 36; // room on each side for the tunnels
const TOP = 8;
const CAPTION = 24;
const COUPLING = 1; // gap between units

// Speed in px per second, from yesterday's activity.
export const CALENDAR_SPEED = { idle: 55, slow: 70, normal: 90, fast: 120 };

export const CALENDAR_THEMES = {
  light: {
    l0: '#ebedf0', l1: '#9be9a8', l2: '#40c463', l3: '#30a14e', l4: '#216e39',
    rail: '#d0d7de', hill: '#87ad77', hill2: '#567e54', stone: '#c6c5b4', mouth: '#202c31', text: '#57606a',
    grass: '#b6d49b', stone2: '#7e897b',
  },
  dark: {
    l0: '#161b22', l1: '#0e4429', l2: '#006d32', l3: '#26a641', l4: '#39d353',
    rail: '#30363d', hill: '#35553b', hill2: '#233e2c', stone: '#95a297', mouth: '#080e13', text: '#8b949e',
    grass: '#638654', stone2: '#56675a',
  },
};

const TEXT = {
  en: { word: 'contributions', title: (u) => `${u}'s contribution calendar, with their train running through it` },
  es: { word: 'contribuciones', title: (u) => `Calendario de contribuciones de ${u}, con su tren recorriéndolo` },
};

// days: [{ date: 'YYYY-MM-DD', count }] ascending. Returns the cells laid out
// like GitHub's calendar (a column per week, Sunday on top) with a level 0..4
// from the quartiles of the days with contributions.
export function calendarCells(days) {
  if (!days.length) return { cells: [], weeks: 0 };
  const first = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
  const busy = days.map((d) => d.count).filter((c) => c > 0).sort((a, b) => a - b);
  const q = (p) => busy[Math.min(busy.length - 1, Math.floor(p * busy.length))] ?? 0;
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
  const level = (c) => (c <= 0 ? 0 : c <= q1 ? 1 : c <= q2 ? 2 : c <= q3 ? 3 : 4);
  const cells = days.map((d, i) => ({
    date: d.date,
    count: d.count,
    col: Math.floor((i + first) / 7),
    row: (i + first) % 7,
    level: level(d.count),
  }));
  return { cells, weeks: cells[cells.length - 1].col + 1 };
}

// Where everything goes for a calendar `weeks` columns wide. The hills cover
// x < LEFT and x >= RIGHT.
export function calendarGeometry(weeks) {
  const gridW = Math.max(weeks, 1) * PITCH - GAP;
  const gridH = ROWS * PITCH - GAP;
  return {
    gridW,
    gridH,
    W: SIDE * 2 + gridW,
    H: TOP + gridH + CAPTION,
    GX: SIDE,
    GY: TOP,
    LEFT: SIDE - 2,
    RIGHT: SIDE + gridW + 2,
    rowY: (r) => TOP + r * PITCH,
  };
}

const pct = (v) => `${+v.toFixed(4)}%`;
const sec = (v) => `${+v.toFixed(3)}s`;
// A cell with one pixel cut off each corner, like GitHub's rounded squares.
const cellPath = (x, y) => `M${x + 1} ${y}h8v1h1v8h-1v1h-8v-1h-1v-8h1z`;

// stats: the summary (days, user, total, streak, cars, state); opts.model: a
// model id or a custom model; opts.stripe: the language color.
export function renderCalendar(stats, opts = {}) {
  const { theme = 'auto', language = 'en', stripe = '#58a6ff' } = opts;
  const model = typeof opts.model === 'string' ? getModel(opts.model) : opts.model ?? getModel('tram');
  const text = TEXT[language] ?? TEXT.en;
  const label = opts.label || (language === 'es' ? 'RACHA' : 'STREAK');
  const { cells, weeks } = calendarCells(stats.days ?? []);
  const { gridW, gridH, W, H, GX, GY, LEFT, RIGHT, rowY } = calendarGeometry(weeks);
  const used = new Set();

  // --- The train: its units, their lengths and offsets along the path.
  const mini = miniTrain(model, { stripe, streak: stats.streak });
  const cars = Math.max(1, Math.min(6, stats.cars ?? 1));
  const units = [mini.head, ...Array.from({ length: cars - 1 }, () => mini.car)];
  const offsets = [];
  let trainLen = 0;
  for (const u of units) {
    offsets.push(trainLen);
    trainLen += u.w + COUPLING;
  }
  const maxLen = Math.max(...units.map((u) => u.w)) + 2;
  const v = CALENDAR_SPEED[stats.state] ?? CALENDAR_SPEED.normal;

  // --- The path: one straight segment per row, alternating direction. The
  // first row starts a little inside its tunnel (a beat before the train shows
  // up); the last one runs on inside the exit until the whole train is in.
  const segments = [];
  let s = 0;
  for (let r = 0; r < ROWS; r++) {
    const right = r % 2 === 0;
    let x0 = right ? LEFT : RIGHT;
    let x1 = right ? RIGHT + maxLen : LEFT - maxLen;
    if (r === 0) x0 -= Math.round(v * 1.2);
    if (r === ROWS - 1) x1 += trainLen + Math.round(v * 1.5);
    const len = Math.abs(x1 - x0);
    segments.push({ r, right, x0, x1, s0: s, len });
    s += len;
  }
  const total = s;
  const period = total / v;
  const at = (dist) => (dist / total) * 100;

  // When the front of the train passes the middle of each cell.
  const passTime = new Map();
  for (const seg of segments) {
    for (const c of cells) {
      if (c.row !== seg.r) continue;
      const cx = GX + c.col * PITCH + CELL / 2;
      passTime.set(c, seg.s0 + (seg.right ? cx - seg.x0 : seg.x0 - cx));
    }
  }

  // Growth: car j joins when the train has eaten j/cars of the year.
  const eaten = cells.filter((c) => c.count > 0).sort((a, b) => passTime.get(a) - passTime.get(b));
  const sum = eaten.reduce((a, c) => a + c.count, 0);
  const joinAt = [0];
  let acc = 0;
  let next = 1;
  for (const c of eaten) {
    acc += c.count;
    while (next < cars && acc >= (sum * next) / cars) {
      joinAt[next++] = passTime.get(c);
    }
  }
  while (next < cars) joinAt[next++] = 0;

  // --- Background: empty cells, rails, tunnels, caption.
  const base = new Grid(W, H);
  for (const c of cells) {
    const x = GX + c.col * PITCH;
    const y = rowY(c.row);
    base.rect(x + 1, y, CELL - 2, 1, '@l0');
    base.rect(x, y + 1, CELL, CELL - 2, '@l0');
    base.rect(x + 1, y + CELL - 1, CELL - 2, 1, '@l0');
  }
  for (let r = 0; r < ROWS; r++) base.hline(LEFT, rowY(r) + CELL, RIGHT - LEFT, '@rail');

  const front = new Grid(W, H);
  paintTunnels(front, tunnelLayout(W, LEFT, RIGHT, rowY));

  // Caption at double size: who and how much on the left, the streak on the right.
  const capY = GY + gridH + 7;
  const cap = new Grid(Math.ceil(W / 2), 6);
  drawText(cap, `${stats.user ?? ''} - ${stats.total ?? 0} ${text.word}`, Math.round(LEFT / 2), 0, '@text');
  const led = `${label} ${stats.streak ?? 0}`;
  const lw = textWidth(led);
  const ledX = Math.floor(RIGHT / 2) - lw - 2;
  const ledBox = `<rect x="${ledX * 2 - 4}" y="${capY - 3}" width="${lw * 2 + 8}" height="16" rx="2" fill="#0a0a10"/>`;
  const ledText = new Grid(Math.ceil(W / 2), 6);
  drawText(ledText, led, ledX, 0, LED_ON);

  // --- Animation.
  const css = [];
  const runFrames = [];
  segments.forEach((seg, i) => {
    const y = rowY(seg.r);
    const flip = seg.right ? '1,1' : '-1,1';
    const start = i === 0 ? '0%' : pct(at(seg.s0) + 0.001);
    const end = i === segments.length - 1 ? '100%' : pct(at(seg.s0 + seg.len));
    runFrames.push(
      `${start}{transform:translate(${seg.x0}px,${y}px) scale(${flip});animation-timing-function:steps(${seg.len})}`,
      `${end}{transform:translate(${seg.x1}px,${y}px) scale(${flip})}`,
    );
  });
  css.push(`@keyframes r{${runFrames.join('')}}`);

  // Parked at the end of the last row: where the train shows with reduced motion.
  const parkX = GX + gridW - 4;
  let unitsSvg = '';
  units.forEach((u, i) => {
    const delay = i === 0 ? 0 : -(period - offsets[i] / v);
    const anims = [`r ${sec(period)} linear ${sec(delay)} infinite`];
    if (i > 0) {
      css.push(`@keyframes v${i}{0%{opacity:0}${pct(at(joinAt[i]))}{opacity:1}}`);
      anims.push(`v${i} ${sec(period)} step-end infinite`);
    }
    css.push(`.u${i}{transform:translate(${parkX - offsets[i]}px,${rowY(ROWS - 1)}px);animation:${anims.join(',')}}`);
    unitsSvg += `<g class="u u${i}"><use href="#${i === 0 ? 'h' : 'c'}"/></g>`;
  });

  // Green cells over the empty ones; each goes blank when the train passes it.
  let greens = '';
  eaten.forEach((c, i) => {
    used.add(`l${c.level}`);
    greens += `<path class="c-l${c.level} e${i}" d="${cellPath(GX + c.col * PITCH, rowY(c.row))}"/>`;
    css.push(`.e${i}{animation:e${i} ${sec(period)} step-end infinite}@keyframes e${i}{${pct(at(passTime.get(c)))}{opacity:0}}`);
  });

  const sprite = (u) => `<g transform="translate(${-u.w} ${-MINI_UP})">${u.grid.paths(used)}</g>`;
  // The train only shows between the tunnel mouths: outside them it is turning
  // around, and whatever the page behind looks like, it must not show.
  const defs =
    `<defs><clipPath id="k"><rect x="${LEFT}" y="0" width="${RIGHT - LEFT}" height="${H}"/></clipPath>` +
    `<g id="h">${sprite(mini.head)}</g><g id="c">${sprite(mini.car)}</g></defs>`;

  const vars = (name) => Object.entries(CALENDAR_THEMES[name]).map(([k, val]) => `--${k}:${val}`).join(';');
  const rootCss =
    theme === 'auto'
      ? `:root{${vars('light')}}@media (prefers-color-scheme:dark){:root{${vars('dark')}}}`
      : `:root{${vars(theme === 'dark' ? 'dark' : 'light')}}`;
  const body =
    base.paths(used) +
    `<g class="ce">${greens}</g>` +
    `<g class="tr" clip-path="url(#k)">${unitsSvg}</g>` +
    front.paths(used) +
    `<g transform="translate(0 ${capY}) scale(2)">${cap.paths(used)}</g>` +
    ledBox +
    `<g transform="translate(0 ${capY}) scale(2)">${ledText.paths(used)}</g>`;
  const classCss = [...used]
    .filter((n) => n in CALENDAR_THEMES.light)
    .sort()
    .map((n) => `.c-${n}{fill:var(--${n})}`)
    .join('');
  const reduced = '@media (prefers-reduced-motion:reduce){.tr>g,.ce>path{animation:none!important}}';

  const title = text.title(stats.user ?? '').replace(/[<&>"]/g, '');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="${title}">` +
    `<title>${title}</title><style>${rootCss}${classCss}${css.join('')}${reduced}</style>${defs}${body}</svg>`
  );
}
