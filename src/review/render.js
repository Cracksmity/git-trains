// review/render.js: focused render operations.

import { Grid } from '../graphics/pixel.js';
import { drawText, textWidth } from '../graphics/font.js';
import { CARD_COLORS, FONT, LABELS as CARD_LABELS, esc, hexColor, kFormat } from '../cards/profile.js';
import { MINI_UP, miniTrain } from '../trains/mini.js';
import { getModel } from '../trains/models.js';
import { unlockThreshold } from '../activity/unlocks.js';
import * as art from './art.js';

// --- text -----------------------------------------------------------------------------

const MONTHS = {
  en: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
  es: ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'],
};

const MONTH_NAMES = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
};

export const LABELS = {
  en: {
    title: 'YEAR IN REVIEW',
    aria: (r) =>
      `${r.user}'s ${r.year} in review: ${r.total} contributions on ${r.activeDays} active days, longest streak ${r.streak} days`,
    total: 'CONTRIBUTIONS',
    days: 'ACTIVE DAYS',
    streak: 'LONGEST STREAK',
    busiest: 'BUSIEST DAY',
    perDay: (v) => `${v} per active day`,
    ofDays: (n) => `of ${n} days`,
    contributions: (n) => `${n} contribution${n === 1 ? '' : 's'}`,
    route: 'RIDERSHIP BY MONTH',
    busiestMonth: 'BUSIEST MONTH',
    share: (p) => `${p}% of the year`,
    languages: 'TOP LANGUAGES',
    noLanguages: 'No language data',
    none: 'No contributions yet',
    unlock: {
      dining: (n) => `Dining car unlocked: ${n}-day streak`,
      observation: (n) => `Observation car unlocked: ${n}+ stars`,
      mail: (n) => `Mail car unlocked: ${n}+ pull requests`,
    },
  },
  es: {
    title: 'RESUMEN DEL AÑO',
    aria: (r) =>
      `Resumen de ${r.year} de ${r.user}: ${r.total} contribuciones en ${r.activeDays} días activos, racha más larga de ${r.streak} días`,
    total: 'CONTRIBUCIONES',
    days: 'DÍAS ACTIVOS',
    streak: 'RACHA MÁS LARGA',
    busiest: 'DÍA MÁS ACTIVO',
    perDay: (v) => `${v} por día activo`,
    ofDays: (n) => `de ${n} días`,
    contributions: (n) => `${n} ${n === 1 ? 'contribución' : 'contribuciones'}`,
    route: 'PASAJEROS POR MES',
    busiestMonth: 'MES MÁS ACTIVO',
    share: (p) => `${p}% del año`,
    languages: 'LENGUAJES MÁS USADOS',
    noLanguages: CARD_LABELS.es.noLangs,
    none: 'Sin contribuciones todavía',
    unlock: {
      dining: (n) => `Vagón comedor desbloqueado: racha de ${n} días`,
      observation: (n) => `Vagón mirador desbloqueado: más de ${n} estrellas`,
      mail: (n) => `Vagón postal desbloqueado: más de ${n} pull requests`,
    },
  },
};

// 1234 -> "1,234" (English) or "1.234" (Spanish); the same everywhere, whatever the ICU data.
const num = (n, language) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, language === 'es' ? '.' : ',');

const dec = (n, language) => (Math.round(n * 10) / 10).toFixed(1).replace('.', language === 'es' ? ',' : '.');

const dayOf = (date) => Number(date.slice(8, 10));

const monthOf = (date) => Number(date.slice(5, 7)) - 1;

// "Jun 3" / "3 jun", and in capitals for the LED: "JUN 3" / "3 JUN".
function shortDay(date, language, caps = false) {
  const m = MONTHS[language][monthOf(date)];
  // Capitals for the LED; otherwise "Jun" in English and "jun" in Spanish.
  const month = caps ? m : language === 'es' ? m.toLowerCase() : m[0] + m.slice(1).toLowerCase();
  return language === 'es' ? `${dayOf(date)} ${month}` : `${month} ${dayOf(date)}`;
}

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// --- colors ---------------------------------------------------------------------------

// Default colors, hexadecimal without "#": the same five inputs as the cards. The dark one
// is the cards' own (GitHub's dark theme) with the contribution green and an LED amber for
// the numbers; the light one is its GitHub light counterpart.
//   background  the poster      title  headings, the big numbers, the busiest month
//   text        values and labels, the panels      icon  the rails and the panel icons
//   ring        the stations (the ridership) and the hills behind them
export const REVIEW_COLORS = {
  dark: { ...CARD_COLORS, title: 'f0b429', ring: '3fb950' },
  light: { background: 'ffffff', title: 'b45309', icon: '0969da', text: '24292f', ring: '1a7f37' },
};

// --- the poster -----------------------------------------------------------------------

export const REVIEW_W = 640;

const S = 2;

// SVG units per art pixel
const RAIL_Y = 160;

// art pixels: the row of the running rail
const STOP_X = (i) => 28 + 24 * i;

// art pixels: the center of the station of month i
const FRONT = 8;

// art pixels: how far the front of the train stands past the center of its station
const SPEED = 36;

// art pixels a second
const COUPLING = 1;

// art pixels between the units of the train
const TILE = { x: (i) => 10 + 76 * i, y: 31, w: 72, h: 42 };

// art pixels

const LANG_COLOR = /^#[0-9a-f]{6}$/i;

// review: see buildReview (and renderReview's use of `unlock`).
// o: { language, theme ('light' | 'dark' | 'auto'), model (id or custom model), stripe (color),
//      border, background, title, icon, text, ring (the card color inputs) }
export function renderReview(review, o = {}) {
  const language = o.language in LABELS ? o.language : 'en';
  const L = LABELS[language];
  const theme = ['light', 'dark'].includes(o.theme) ? o.theme : 'auto';
  const model = typeof o.model === 'string' ? getModel(o.model) : o.model ?? getModel('tram');
  const stripe = LANG_COLOR.test(o.stripe ?? '') ? o.stripe : review.languages?.[0]?.color ?? '#58a6ff';
  const login = String(review.user ?? '');
  const { months, busiest, busiestMonth, longest } = review;
  const used = new Set();

  // Colors: a role is a literal color, or a CSS variable when the theme follows the viewer.
  const pick = (name, mode) => hexColor(o[name], REVIEW_COLORS[mode][name]);
  const roles = Object.keys(CARD_COLORS);
  const vars = (mode) => roles.map((r) => `--${r}:${pick(r, mode)}`).join(';');
  const color = (role) => (theme === 'auto' ? `var(--${role})` : pick(role, theme));
  const rootCss =
    theme === 'auto' ? `:root{${vars('light')}}@media (prefers-color-scheme:dark){:root{${vars('dark')}}}` : '';

  const H = review.unlock ? 484 : 460;
  const gridW = REVIEW_W / S;
  const gridH = Math.ceil(H / S);
  const g = new Grid(gridW, gridH);

  // --- Stat panels: label, big number, a line under it and an icon.
  const maxValue = Math.max(0, ...months);
  const perActive = review.activeDays ? review.total / review.activeDays : 0;
  const stats = [
    {
      key: 'total',
      led: num(review.total, language),
      sub: review.activeDays ? L.perDay(dec(perActive, language)) : L.none,
    },
    { key: 'days', led: num(review.activeDays, language), sub: L.ofDays(num(review.daysCovered, language)) },
    {
      key: 'streak',
      led: longest ? num(longest.length, language) : '-',
      sub: !longest
        ? L.none
        : longest.start === longest.end
          ? shortDay(longest.start, language)
          : `${shortDay(longest.start, language)} – ${shortDay(longest.end, language)}`,
    },
    {
      key: 'busiest',
      led: busiest ? shortDay(busiest.date, language, true) : '-',
      sub: busiest ? L.contributions(busiest.count) : L.none,
    },
  ];
  let tiles = '';
  stats.forEach((s, i) => {
    const x = TILE.x(i);
    art.paintPanel(g, x, TILE.y, TILE.w, TILE.h);
    art.paintStatIcon(g, s.key, x + TILE.w - 6 - art.ICON_SIZE, TILE.y + 18);
    // The number is LED text in the pixel font, as big as fits beside the icon.
    const room = (TILE.w - 6 - art.ICON_SIZE - 6 - 6) * S; // SVG units
    const scale = [4, 3, 2].find((k) => textWidth(s.led) * k <= room) ?? 2;
    const led = new Grid(textWidth(s.led) + 1, 5);
    drawText(led, s.led, 0, 0, '@led');
    const ux = x * S + 12;
    const uy = TILE.y * S;
    tiles +=
      `<text class="lab" x="${ux}" y="${uy + 22}">${esc(L[s.key])}</text>` +
      `<g transform="translate(${ux} ${uy + 32 + (20 - 5 * scale) / 2}) scale(${scale})">${led.paths(used)}</g>` +
      `<text class="sub" x="${ux}" y="${uy + 72}">${esc(s.sub)}</text>`;
  });

  // --- The line: hills, the rail and a station per month.
  art.paintBackdrop(g, { width: gridW, railY: RAIL_Y });
  const stops = months.map((_, i) => STOP_X(i));
  art.paintRoute(g, { width: gridW, railY: RAIL_Y, stops });
  let labels = '';
  months.forEach((value, i) => {
    const on = busiestMonth?.index === i;
    const height = art.stationHeight(value, maxValue);
    art.paintStation(g, { x: stops[i], railY: RAIL_Y, height, busiest: on });
    const x = stops[i] * S;
    const top = (RAIL_Y - height - (on ? 7 : 0)) * S;
    labels +=
      `<text class="mo${on ? ' on' : ''}" x="${x}" y="${(RAIL_Y + 4) * S + 18}">${MONTHS[language][i]}</text>` +
      (value > 0 ? `<text class="val${on ? ' on' : ''}" x="${x}" y="${top - 5}">${esc(kFormat(value))}</text>` : '');
  });

  // --- The train, facing right: the cab, the special car right behind it, then the cars.
  const mini = miniTrain(model, { stripe, streak: review.streak, extra: review.unlock });
  const cars = Math.max(1, Math.min(6, review.cars ?? 1));
  const units = [
    ['h', mini.head],
    ...(mini.extra ? [['e', mini.extra]] : []),
    ...Array.from({ length: cars - 1 }, () => ['c', mini.car]),
  ];
  let trainLen = 0;
  let train = '';
  for (const [id, u] of units) {
    train += `<g transform="translate(${-trainLen} ${RAIL_Y - (MINI_UP + 10)})"><use href="#${id}"/></g>`;
    trainLen += u.w + COUPLING;
  }
  trainLen -= COUPLING;
  const sprite = (id, u) => `<g id="${id}"><g transform="translate(${-u.w} 0)">${u.grid.paths(used)}</g></g>`;
  const defs =
    `<defs>${sprite('h', mini.head)}${sprite('c', mini.car)}${mini.extra ? sprite('e', mini.extra) : ''}</defs>`;

  // The journey: stop at every station for as long as its month was busy (a month with
  // nothing is an express pass), then leave and start over. 1 art pixel per step.
  const points = months.map((value, i) => ({
    x: stops[i] + FRONT,
    hold: value > 0 ? 0.35 + 1.1 * (value / maxValue) : 0,
  }));
  points.push({ x: gridW + trainLen + 2, hold: 0 });
  const keyframes = [];
  let t = 0;
  let at = -2; // just outside, so the first frame has no train
  for (const p of points) {
    const dist = p.x - at;
    keyframes.push({ t, x: at, steps: dist });
    t += dist / SPEED;
    at = p.x;
    if (p.hold > 0) {
      keyframes.push({ t, x: at });
      t += p.hold;
    }
  }
  keyframes.push({ t, x: at });
  const period = t;
  const pct = (v) => `${+((v / period) * 100).toFixed(4)}%`;
  const run = keyframes
    .map((k, i) => {
      const where = i === 0 ? '0%' : i === keyframes.length - 1 ? '100%' : pct(k.t);
      return `${where}{transform:translate(${k.x}px,0)${k.steps ? `;animation-timing-function:steps(${k.steps})` : ''}}`;
    })
    .join('');
  // Parked at the last station: where the train shows with reduced motion, or where the
  // picture is drawn if it can't animate.
  const park = stops[11] + FRONT;

  // --- Footer: the busiest month and the top languages.
  let footer = '';
  const fy = 364;
  const bm = busiestMonth;
  footer +=
    `<text class="cap" x="20" y="${fy + 26}">${esc(L.busiestMonth)}</text>` +
    (bm
      ? `<text class="big" x="20" y="${fy + 52}">${esc(MONTH_NAMES[language][bm.index])}</text>` +
        `<text class="sub" x="20" y="${fy + 70}">${esc(
          `${L.contributions(bm.count)} · ${L.share(Math.round((100 * bm.count) / review.total))}`,
        )}</text>`
      : `<text class="sub" x="20" y="${fy + 50}">${esc(L.none)}</text>`);

  footer += `<text class="cap" x="330" y="${fy + 26}">${esc(L.languages)}</text>`;
  const langs = (review.languages ?? []).slice(0, 4);
  const langTotal = langs.reduce((a, l) => a + l.bytes, 0);
  if (!langs.length || langTotal <= 0) {
    footer += `<text class="sub" x="330" y="${fy + 50}">${esc(L.noLanguages)}</text>`;
  } else {
    const barX = 165; // art pixels
    const barW = 145;
    const barY = (fy + 36) / S;
    let x = 0;
    let spent = 0;
    langs.forEach((l, i) => {
      const w = i === langs.length - 1 ? barW - spent : Math.max(1, Math.round((barW * l.bytes) / langTotal));
      spent += w;
      const c = LANG_COLOR.test(l.color ?? '') ? l.color : '#8b949e';
      g.rect(barX + x, barY, w, 4, c);
      x += w;
      const cx = i % 2 === 0 ? 330 : 480;
      const cy = fy + 60 + Math.floor(i / 2) * 18;
      g.rect(cx / S, (cy - 6) / S, 3, 3, c);
      footer += `<text class="lang" x="${cx + 12}" y="${cy + 1}">${esc(clip(l.name, 11))} ${Math.round((100 * l.bytes) / langTotal)}%</text>`;
    });
  }

  // The special car the profile earned, with its line.
  let unlock = '';
  if (review.unlock && mini.extra) {
    const y = fy + 82;
    unlock =
      `<g transform="translate(20 ${y}) scale(${S})"><g transform="translate(${mini.extra.w} 0)"><use href="#e"/></g></g>` +
      `<text class="sub" x="${20 + (mini.extra.w + 4) * S}" y="${y + 17}">${esc(
        L.unlock[review.unlock](unlockThreshold(review.unlock)),
      )}</text>`;
  }

  // --- Assemble. The art goes first: painting it is what tells which tones the CSS needs.
  const artSvg = g.paths(used);
  const toneCss = [...used]
    .filter((n) => n in art.TONES)
    .sort()
    .map((n) => {
      const [role, opacity] = art.TONES[n];
      return `.c-${n}{fill:${color(role)}${opacity < 1 ? `;fill-opacity:${opacity}` : ''}}`;
    })
    .join('');
  const f = esc(FONT);
  const css =
    rootCss +
    toneCss +
    `.title{font:700 16px ${f};letter-spacing:2px;fill:${color('title')}}` +
    `.who{font:600 13px ${f};fill:${color('text')};text-anchor:end}` +
    `.cap{font:700 10px ${f};letter-spacing:1px;fill:${color('title')}}` +
    `.lab{font:700 9px ${f};letter-spacing:.6px;fill:${color('title')}}` +
    `.sub{font:400 11px ${f};fill:${color('text')};fill-opacity:.78}` +
    `.big{font:700 22px ${f};fill:${color('title')}}` +
    `.lang{font:400 11px ${f};fill:${color('text')}}` +
    `.mo{font:700 10px ${f};fill:${color('text')};fill-opacity:.85;text-anchor:middle}` +
    `.val{font:600 9px ${f};fill:${color('text')};fill-opacity:.7;text-anchor:middle}` +
    `.mo.on,.val.on{fill:${color('title')};fill-opacity:1}.val.on{font-weight:700}` +
    `.tr{transform:translate(${park}px,0);animation:run ${+period.toFixed(3)}s linear infinite}` +
    `@keyframes run{${run}}` +
    `@media (prefers-reduced-motion:reduce){.tr{animation:none}}`;

  const title = L.aria({ ...review, user: login }).replace(/[<&>"]/g, '');
  const description = [
    `${L.total}: ${num(review.total, language)}`,
    `${L.days}: ${num(review.activeDays, language)} ${L.ofDays(num(review.daysCovered, language))}`,
    ...stats.slice(2).map((s) => `${L[s.key]}: ${s.led} (${s.sub})`),
    `${L.route}: ${months.map((v, i) => `${MONTHS[language][i]} ${v}`).join(', ')}`,
  ].join('. ');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${REVIEW_W}" height="${H}" viewBox="0 0 ${REVIEW_W} ${H}" ` +
    `fill="none" role="img" aria-labelledby="t" aria-describedby="d"><title id="t">${esc(title)}</title>` +
    `<desc id="d">${esc(description)}</desc><style>${css}</style>${defs}` +
    `<rect x=".5" y=".5" rx="7" width="${REVIEW_W - 1}" height="${H - 1}" fill="${color('background')}" ` +
    `stroke="${color('text')}" stroke-opacity="${o.border === false ? 0 : 0.25}"/>` +
    // The title bar of the departures board: a rule with the title's color at its start, a train
    // glyph, the title with the year, and whose year it is.
    `<path d="M20 46.5H${REVIEW_W - 20}" stroke="${color('text')}" stroke-opacity=".14"/>` +
    `<path d="M20 46.5h24" stroke="${color('title')}" stroke-opacity=".7"/>` +
    `<g transform="translate(21 16)" stroke="${color('icon')}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<rect x="1" y="1" width="14" height="16" rx="3"/><path d="M4 5h8v5H4zM5 17l-2 3m8-3 2 3M4 20h8"/>` +
    `<path d="M4 13.5h1m6 0h1" stroke-width="2"/></g>` +
    `<text class="title" x="50" y="32">${esc(L.title)} ${review.year}</text>` +
    `<text class="who" x="${REVIEW_W - 20}" y="32">${esc(clip(login, 30))}</text>` +
    `<text class="cap" x="20" y="172">${esc(L.route)}</text>` +
    `<g transform="scale(${S})" shape-rendering="crispEdges">${artSvg}</g>` +
    tiles +
    `<g transform="scale(${S})" shape-rendering="crispEdges"><g class="tr">${train}</g></g>` +
    labels +
    `<path d="M20 ${fy - 0.5}H${REVIEW_W - 20}" stroke="${color('text')}" stroke-opacity=".14"/>` +
    footer +
    unlock +
    `</svg>`
  );
}
