import { closest, elements } from '../../src/browser/dom.js';
// Page controller. Relative fetch URLs intentionally resolve against the page.
import { renderScene, planScene, SCENE_W } from '../../src/scene/render.js';
import { buildSpec } from '../../src/scene/spec.js';
import { sampleStats } from '../../src/demo/sample.js';
import { carsFor, stateFor } from '../../src/activity/stats.js';
import { MODELS } from '../../src/trains/models.js';
import { buildTrain } from '../../src/trains/render.js';
import { TOP, TRAIN_H } from '../../src/trains/geometry.js';
import { parseSkyline } from '../../src/landscape/skyline-parse.js';
import { LANGUAGE_COLORS } from '../../src/activity/languages.js';
import { GY0, BALLAST } from '../../src/scene/layout.js';
import { THEMES } from '../../src/scene/themes.js';

/** Dynamic page IDs address mixed form and image elements. @returns {any} */
const $ = (id) => document.getElementById(id);
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const stillQuery = matchMedia('(prefers-reduced-motion: reduce)');
const theme = () => document.documentElement.dataset.theme ?? (darkQuery.matches ? 'dark' : 'light');

// Sample activity, with the numbers that matter set exactly.
function stats({ user = 'octocat', total = 1400, streak = 21, yesterday = 6 } = {}) {
  const s = sampleStats({ total, streak, yesterday });
  return { ...s, user, total, streak, yesterday, cars: carsFor(total), state: stateFor(yesterday) };
}

// Scenes go in <img> (an inline SVG's <style> would leak into the page), like in a README.
const urls = new Map();
function show(img, svg, alt) {
  if (urls.has(img)) URL.revokeObjectURL(urls.get(img));
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  urls.set(img, url);
  img.src = url;
  img.alt = alt;
}
// Extra CSS for the SVG: parked trains (the close-up) or no motion at all.
const PARKED = '.tr,.wa,.wb,.sp{animation:none!important}.wb,.sb{opacity:0}';
const STILL = PARKED + '.sm,.led,.do,.cl,.tw{animation:none!important}.pb{opacity:0}';
const withCss = (svg, css) => svg.replace('</style>', `${css}</style>`);
const motion = (svg) => (stillQuery.matches ? withCss(svg, STILL) : svg);

// --- Hero: three tracks, and yesterday's contributions set the pace.
const SAYS = {
  idle: 'Stopped at the platform with the doors open, red signal.',
  slow: 'Slow, amber signal.',
  normal: 'Normal speed, green signal.',
  fast: 'Fast, with sparks and speed lines, green signal.',
};
let yesterday = 6;
function renderHero() {
  const s = stats({ yesterday });
  const spec = buildSpec(s, { mode: 'multi', theme: theme() });
  show($('hero'), motion(renderScene(spec)), `${spec.title}. Three of their languages run on three tracks.`);
  $('yesterday-says').textContent = SAYS[s.state];
}
$('yesterday').addEventListener('click', (e) => {
  const b = closest(e, 'button');
  if (!b) return;
  yesterday = Number(b.dataset.v);
  for (const x of $('yesterday').children) x.setAttribute('aria-pressed', String(x === b));
  renderHero();
});

// --- How to read a train: a parked train, cropped to it and its signal, with hotspots.
function bbox(grid, test) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      if (!test(grid.cells[y * grid.w + x])) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
let active = null;
let pinned = null;
function renderCloseup() {
  const s = stats({ total: 300, streak: 17, yesterday: 6 });
  const spec = buildSpec(s, { theme: theme() });
  spec.tracks[0].caption = '';
  const { trains } = planScene(spec);
  const { train, rest, y0 } = trains[0];
  const stripe = s.languages[0].color;
  $('stripe-swatch').style.background = stripe;
  const at = (r) => ({ ...r, x: r.x + rest, y: r.y + y0 });
  const parts = {
    cars: { x: rest, y: y0 + TOP, w: train.width, h: 20 },
    lit: at(bbox(train.layers.lit, Boolean)),
    stripe: at(bbox(train.layers.body, (c) => c === stripe)),
    wheels: { x: rest, y: y0 + TOP + 18, w: train.width, h: TRAIN_H - TOP - 18 },
    led: at(train.led),
    signal: { x: SCENE_W - 17, y: GY0 - 32, w: 5, h: 32 }, // where scenery.js puts it for a train running right
  };
  const crop = { x: rest - 12, y: y0 - 10, w: SCENE_W - rest + 12, h: GY0 + BALLAST - y0 + 10 };
  const pct = (v, of) => `${(v / of) * 100}%`;
  const box = $('closeup');
  box.style.aspectRatio = `${crop.w} / ${crop.h}`;
  const img = document.createElement('img');
  Object.assign(img.style, { width: pct(SCENE_W, crop.w), left: pct(-crop.x, crop.w), top: pct(-crop.y, crop.h) });
  show(img, withCss(motion(renderScene(spec)), PARKED), `${spec.title}, parked by its signal`);
  box.replaceChildren(img);
  for (const [name, r] of Object.entries(parts)) {
    // Thin parts get a taller target, centered on them.
    const h = Math.max(r.h, 5);
    const spot = document.createElement('button');
    spot.className = 'spot';
    spot.dataset.part = name;
    spot.tabIndex = -1;
    spot.setAttribute('aria-hidden', 'true');
    Object.assign(spot.style, {
      left: pct(r.x - crop.x, crop.w), top: pct(r.y - (h - r.h) / 2 - crop.y, crop.h),
      width: pct(r.w, crop.w), height: pct(h, crop.h),
    });
    box.append(spot);
  }
  box.hidden = false;
  $('hint').hidden = false;
  highlight(active);
}
function highlight(part) {
  active = part;
  for (const el of elements('[data-part]')) el.classList.toggle('on', el.dataset.part === part);
  for (const b of $('parts').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.part === pinned));
}
for (const root of [$('closeup'), $('parts')]) {
  root.addEventListener('pointerover', (e) => {
    const el = closest(e, '[data-part]');
    if (el && e.pointerType === 'mouse') highlight(el.dataset.part);
  });
  root.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') highlight(pinned); });
  root.addEventListener('click', (e) => {
    const el = closest(e, '[data-part]');
    if (!el) return;
    pinned = pinned === el.dataset.part ? null : el.dataset.part;
    highlight(pinned);
  });
}
$('parts').addEventListener('focusin', (e) => highlight(closest(e, '[data-part]')?.dataset.part ?? pinned));
$('parts').addEventListener('focusout', () => highlight(pinned));

// --- The six models, two cars each, on a rail. All canvases share the widest
// train's width, so every card shows the pixels at the same size.
function renderModels() {
  const t = THEMES[theme()];
  const canvases = [.../** @type {NodeListOf<HTMLCanvasElement>} */ (document.querySelectorAll('canvas[data-model]'))];
  const trains = canvases.map((canvas) => buildTrain(MODELS[canvas.dataset.model], {
    cars: 2, stripe: LANGUAGE_COLORS[canvas.dataset.lang], streak: 9, label: 'STREAK',
  }));
  const W = Math.max(...trains.map((train) => train.width)) + 4;
  canvases.forEach((canvas, i) => {
    const train = trains[i];
    const ox = Math.floor((W - train.width) / 2);
    canvas.width = W;
    canvas.height = TRAIN_H + 2;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = t.rail;
    ctx.fillRect(0, TRAIN_H, W, 1);
    ctx.fillStyle = t.railDark;
    ctx.fillRect(0, TRAIN_H + 1, W, 1);
    for (const name of ['body', 'lit', 'wa', 'led', 'pa']) {
      const g = train.layers[name];
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          const c = g.cells[y * g.w + x];
          if (!c || c[0] === '@') continue;
          ctx.fillStyle = c;
          ctx.fillRect(ox + x, y, 1, 1);
        }
      }
    }
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${MODELS[canvas.dataset.model].name}, two cars, with a ${canvas.dataset.lang} stripe`);
  });
}

// --- Cities: the skyline buttons and the username.
let skyline = 'city';
function renderCity() {
  const user = $('user').value.trim() || 'octocat';
  const spec = buildSpec(stats({ user, total: 600, streak: 9, yesterday: 3 }), { theme: theme(), skyline: parseSkyline(skyline) });
  spec.tracks[0].caption = '';
  const where = skyline === 'city' ? `${user}'s own city` : parseSkyline(skyline).name;
  show($('city'), motion(renderScene(spec)), `A train in front of ${where}`);
}
$('skyline').addEventListener('click', (e) => {
  const b = closest(e, 'button');
  if (!b) return;
  skyline = b.dataset.v;
  for (const x of $('skyline').children) x.setAttribute('aria-pressed', String(x === b));
  renderCity();
});
$('user').addEventListener('input', renderCity);

// --- Copy buttons.
document.addEventListener('click', async (e) => {
  const b = closest(e, 'button[data-copy]');
  if (!b) return;
  const code = $(b.dataset.copy);
  try {
    await navigator.clipboard.writeText(code.textContent);
    b.textContent = 'Copied';
  } catch {
    // No clipboard (outside https, for example): select the text to copy it by hand.
    getSelection().selectAllChildren(code);
    b.textContent = `Selected: press ${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘C' : 'Ctrl+C'}`;
  }
  setTimeout(() => { b.textContent = 'Copy'; }, 1800);
});

function renderAll() {
  renderHero();
  renderCloseup();
  renderModels();
  renderCity();
}
darkQuery.addEventListener('change', renderAll);
stillQuery.addEventListener('change', renderAll);
renderAll();
