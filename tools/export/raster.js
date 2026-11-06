// export/raster.js: focused raster operations.


import { Grid } from '../../src/graphics/pixel.js';
import { planScene, speedLines, TIMING } from '../../src/scene/render.js';
import { TRAIN_H } from '../../src/trains/geometry.js';
import { THEMES } from '../../src/scene/themes.js';
import { paintSky, celestialGrid, starsGrids, cloudsGrid } from '../../src/scene/sky.js';
import { paintBands } from '../../src/scene/terrain.js';
import { paintRails } from '../../src/scene/rails.js';
import { paintBackdrop } from '../../src/scene/backdrop.js';



// --- Scene -> RGB frames -----------------------------------------------------

// '#rrggbb' or 'rgba(r,g,b,a)' -> [r, g, b, a].
export function rgba(c) {
  const hex = /^#([0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255, 1];
  }
  const fn = /^rgba\(([^)]+)\)$/.exec(c);
  if (fn) return fn[1].split(',').map(Number);
  throw new Error(`export: unknown color "${c}"`);
}

// RGB pixels; paint() blends a grid in with its colors' alpha times the layer opacity,
// as the browser does with the SVG groups.
export class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 3);
  }

  paint(grid, ox, oy, color, opacity = 1) {
    if (opacity <= 0) return;
    for (let y = Math.max(0, -oy); y < grid.h && oy + y < this.h; y++) {
      for (let x = Math.max(0, -ox); x < grid.w && ox + x < this.w; x++) {
        const c = grid.cells[y * grid.w + x];
        if (!c) continue;
        const [r, g, b, a0] = color(c);
        const a = a0 * opacity;
        if (a <= 0) continue;
        const i = ((oy + y) * this.w + ox + x) * 3;
        this.px[i] = Math.round(this.px[i] * (1 - a) + r * a);
        this.px[i + 1] = Math.round(this.px[i + 1] * (1 - a) + g * a);
        this.px[i + 2] = Math.round(this.px[i + 2] * (1 - a) + b * a);
      }
    }
  }
}

const cycle = (v) => v - Math.floor(v);

// Value of step-end keyframes ([[offset, value], ...]) at a point of the cycle.
const keyframe = (phase, keys) => {
  const p = cycle(phase);
  let v = keys[0][1];
  for (const [at, value] of keys) if (p >= at) v = value;
  return v;
};

// The keyframes in scene.js.
const ON_OFF = [[0, 1], [0.5, 0]];

// wa, sa
const OFF_ON = [[0, 0], [0.5, 1]];

// wb, sb
const TWA = [[0, 1], [0.5, 0.2]];

const TWB = [[0, 0.2], [0.5, 1]];

const LED = [[0, 1], [0.9, 0.35], [0.95, 1]];

const DOORS = [[0, 0], [0.08, 1], [0.78, 0]];

// Everything that doesn't change between frames, built once.
export function rasterScene(spec, theme = spec.theme === 'dark' ? 'dark' : 'light') {
  const plan = planScene(spec);
  const { W, H, tracks, trains } = plan;
  const vars = THEMES[theme];
  const cache = new Map();
  const color = (c) => {
    let v = cache.get(c);
    if (!v) cache.set(c, (v = rgba(c[0] === '@' ? vars[c.slice(1)] : c)));
    return v;
  };
  const sky = new Grid(W, H);
  paintSky(sky);
  const ground = new Grid(W, H); // opaque: haze, hills and tracks
  paintBands(ground, tracks);
  paintRails(ground, tracks);
  return {
    plan,
    color,
    sky,
    celestial: celestialGrid(W),
    stars: starsGrids(W),
    clouds: cloudsGrid(W),
    ground,
    backdrop: paintBackdrop(W, H, tracks, spec.user ?? '', spec.skyline ?? null, spec.seed ?? spec.user ?? ''),
    trains: trains.map((tr, k) => {
      const shadow = new Grid(tr.train.width, TRAIN_H + 4);
      shadow.rect(0, TRAIN_H + 2, tr.train.width, 2, '@shadow');
      const lines = tr.moving && tr.st.lines ? speedLines(900 + k) : null;
      return { ...tr, k, shadow, lines: lines && (tr.dir === 1 ? lines : lines.mirror()) };
    }),
  };
}

// Left edge of a train at time t (seconds since the SVG started).
export function trainX(tr, t) {
  if (!tr.moving) return tr.rest;
  return tr.from + tr.dir * Math.floor(cycle((t - tr.delay) / tr.st.dur) * tr.steps);
}

// A moment when train k stands at x (its resting place by default): the middle of its jump to there.
export function timeAt(scene, k = 0, x = scene.trains[k].rest) {
  const tr = scene.trains[k];
  if (!tr.moving) return 0;
  const n = tr.dir * (x - tr.from);
  return cycle((tr.delay + ((n + 0.5) / tr.steps) * tr.st.dur) / tr.st.dur) * tr.st.dur;
}

export function renderFrame(scene, t) {
  const { plan, color } = scene;
  const c = new Canvas(plan.W, plan.H);
  c.paint(scene.sky, 0, 0, color);
  c.paint(scene.celestial, 0, 0, color);
  c.paint(scene.stars.a, 0, 0, color, keyframe(t / TIMING.twinkle, TWA));
  c.paint(scene.stars.b, 0, 0, color, keyframe(t / TIMING.twinkle, TWB));
  c.paint(scene.clouds, -Math.floor(cycle(t / TIMING.clouds) * plan.W), 0, color);
  c.paint(scene.ground, 0, 0, color);
  c.paint(scene.backdrop, 0, 0, color);
  for (const tr of scene.trains) {
    const { layers: L, width } = tr.train;
    const x = trainX(tr, t);
    const at = (grid, opacity = 1, dx = 0) => c.paint(grid, x + dx, tr.y0, color, opacity);
    at(tr.shadow);
    if (tr.lines) at(tr.lines, 1, tr.dir === 1 ? -tr.lines.w : width);
    at(L.body);
    at(L.lit);
    at(L.wa, tr.moving ? keyframe(t / tr.st.wheel, ON_OFF) : 1);
    at(L.wb, tr.moving ? keyframe(t / tr.st.wheel, OFF_ON) : 0);
    at(L.open, tr.moving ? 0 : keyframe((t + tr.k * TIMING.doorStagger) / TIMING.doors, DOORS));
    at(L.led, keyframe(t / TIMING.led, LED));
    at(L.pa, keyframe(t / tr.puff, ON_OFF));
    at(L.pb, keyframe(t / tr.puff, OFF_ON));
    if (tr.moving && tr.st.sparks) {
      at(L.sa, keyframe(t / TIMING.sparks, ON_OFF));
      at(L.sb, keyframe(t / TIMING.sparks, OFF_ON));
    }
  }
  return c;
}
