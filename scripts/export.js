// Raster export: a scene as a PNG still or an animated GIF, with no dependencies.
// It paints the same pixel grids the SVG is built from (buildTrain layers,
// paintBackdrop, the sky...) and samples the timing in scene.js, so each frame is
// what the SVG shows at that instant, scaled up pixel for pixel.
//
//   npm run export                     sample scene -> sample/train-{light,dark}.{png,gif}
//   npm run export -- --train bullet --yesterday 14 --theme dark --scale 3 --seconds 5
//   npm run export -- social           docs/social.png (1280x640) and docs/og.png (1200x630)
//
// Options: --out <base path> --theme light|dark|both --scale 1-6 --seconds --fps
//          --train --skyline --mode --user --total --streak --yesterday --language

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { crc32, deflateSync } from 'node:zlib';
import { Grid } from '../src/pixel.js';
import { planScene, speedLines, TIMING } from '../src/scene.js';
import { TRAIN_H } from '../src/train.js';
import {
  THEMES,
  paintSky,
  celestialGrid,
  starsGrids,
  cloudsGrid,
  paintBands,
  paintRails,
  paintBackdrop,
} from '../src/scenery.js';
import { drawText, textWidth } from '../src/font.js';
import { buildSpec } from '../src/compose.js';
import { sampleStats } from '../src/sample.js';
import { parseCustomModel } from '../src/custom.js';
import { parseSkyline } from '../src/skyline.js';

// --- Scene -> RGB frames -----------------------------------------------------

// '#rrggbb' or 'rgba(r,g,b,a)' -> [r, g, b, a].
function rgba(c) {
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
class Canvas {
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
const ON_OFF = [[0, 1], [0.5, 0]]; // wa, sa
const OFF_ON = [[0, 0], [0.5, 1]]; // wb, sb
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
    backdrop: paintBackdrop(W, H, tracks, spec.user ?? '', spec.skyline ?? null),
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

// --- Palette ------------------------------------------------------------------

// At most `max` colors for a set of RGB canvases: the most used ones, and the
// rest mapped to the nearest (a scene rarely needs it: it has few colors).
export function palettize(canvases, max = 255) {
  const count = new Map();
  for (const c of canvases) {
    for (let i = 0; i < c.px.length; i += 3) {
      const key = (c.px[i] << 16) | (c.px[i + 1] << 8) | c.px[i + 2];
      count.set(key, (count.get(key) ?? 0) + 1);
    }
  }
  const keys = [...count.keys()].sort((a, b) => count.get(b) - count.get(a));
  const kept = keys.slice(0, max);
  const index = new Map(kept.map((k, i) => [k, i]));
  const rgb = (k) => [k >> 16, (k >> 8) & 255, k & 255];
  for (const k of keys.slice(max)) {
    const [r, g, b] = rgb(k);
    let best = 0;
    let bestD = Infinity;
    kept.forEach((q, i) => {
      const [r2, g2, b2] = rgb(q);
      const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
      if (d < bestD) [best, bestD] = [i, d];
    });
    index.set(k, best);
  }
  const indices = canvases.map((c) => {
    const out = new Uint8Array(c.w * c.h);
    for (let i = 0; i < out.length; i++) {
      out[i] = index.get((c.px[i * 3] << 16) | (c.px[i * 3 + 1] << 8) | c.px[i * 3 + 2]);
    }
    return out;
  });
  return { palette: kept.map(rgb), indices };
}

// Nearest-neighbor enlargement of a w x h block of bytes (pixel-exact).
function upscale(src, w, h, s) {
  if (s === 1) return src;
  const out = new Uint8Array(w * s * h * s);
  for (let y = 0; y < h * s; y++) {
    const row = ((y / s) | 0) * w;
    for (let x = 0; x < w * s; x++) out[y * w * s + x] = src[row + ((x / s) | 0)];
  }
  return out;
}

// --- PNG ----------------------------------------------------------------------

// data: palette indices (with `palette`, [[r, g, b], ...]) or RGBA bytes (without it).
export function png(w, h, data, palette = null) {
  const bpp = palette ? 1 : 4;
  const raw = Buffer.alloc((w * bpp + 1) * h);
  for (let y = 0; y < h; y++) raw.set(data.subarray(y * w * bpp, (y + 1) * w * bpp), y * (w * bpp + 1) + 1);
  const chunk = (type, body) => {
    const typed = Buffer.concat([Buffer.from(type), body]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([len, typed, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = palette ? 3 : 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    ...(palette ? [chunk('PLTE', Buffer.from(palette.flat()))] : []),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function pngOf(canvas, scale = 1) {
  const { palette, indices } = palettize([canvas], 256);
  return png(canvas.w * scale, canvas.h * scale, upscale(indices[0], canvas.w, canvas.h, scale), palette);
}

// --- GIF ----------------------------------------------------------------------

// GIF's variable-width LZW: codes from minSize + 1 to 12 bits, packed LSB first,
// with a clear code when the 4096-entry table fills up.
export function lzw(minSize, data) {
  const clear = 1 << minSize;
  const eoi = clear + 1;
  const out = [];
  let acc = 0;
  let nbits = 0;
  let size = minSize + 1;
  let next = eoi + 1;
  let dict = new Map();
  const emit = (code) => {
    acc |= code << nbits;
    nbits += size;
    while (nbits >= 8) {
      out.push(acc & 255);
      acc >>>= 8;
      nbits -= 8;
    }
  };
  emit(clear);
  let prefix = data[0];
  for (let i = 1; i < data.length; i++) {
    const key = (prefix << 8) | data[i];
    const code = dict.get(key);
    if (code !== undefined) {
      prefix = code;
      continue;
    }
    emit(prefix);
    if (next === 4096) {
      emit(clear);
      dict = new Map();
      size = minSize + 1;
      next = eoi + 1;
    } else {
      if (next >= 1 << size) size++;
      dict.set(key, next++);
    }
    prefix = data[i];
  }
  emit(prefix);
  emit(eoi);
  if (nbits > 0) out.push(acc & 255);
  return out;
}

// frames: [{ canvas, delay }] (delay in hundredths of a second). Each frame only
// stores the rectangle that changed, with the unchanged pixels transparent.
export function gif(frames, scale = 1) {
  const { w, h } = frames[0].canvas;
  const { palette, indices } = palettize(frames.map((f) => f.canvas), 255);
  const clear = palette.length; // transparent index
  const bits = Math.max(2, Math.ceil(Math.log2(clear + 1)));
  const bytes = [...Buffer.from('GIF89a')];
  const u16 = (n) => bytes.push(n & 255, n >> 8);
  u16(w * scale);
  u16(h * scale);
  bytes.push(0x80 | ((bits - 1) << 4) | (bits - 1), 0, 0);
  for (let i = 0; i < 1 << bits; i++) bytes.push(...(palette[i] ?? [0, 0, 0]));
  bytes.push(0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0); // loop forever

  let prev = null;
  frames.forEach(({ delay }, f) => {
    const cur = indices[f];
    let [x0, y0, x1, y1] = prev ? [w, h, -1, -1] : [0, 0, w - 1, h - 1];
    if (prev) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (cur[y * w + x] === prev[y * w + x]) continue;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
      if (x1 < 0) [x0, y0, x1, y1] = [0, 0, 0, 0]; // nothing changed: one transparent pixel
    }
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    const block = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const i = (y0 + y) * w + x0 + x;
        block[y * bw + x] = prev && cur[i] === prev[i] ? clear : cur[i];
      }
    }
    bytes.push(0x21, 0xf9, 4, (1 << 2) | 1); // keep the previous frame below; transparency on
    u16(delay);
    bytes.push(clear, 0, 0x2c);
    u16(x0 * scale);
    u16(y0 * scale);
    u16(bw * scale);
    u16(bh * scale);
    bytes.push(0, bits);
    const data = lzw(bits, upscale(block, bw, bh, scale));
    for (let i = 0; i < data.length; i += 255) {
      const sub = data.slice(i, i + 255);
      bytes.push(sub.length, ...sub);
    }
    bytes.push(0);
    prev = cur;
  });
  bytes.push(0x3b);
  return Buffer.from(bytes);
}

// A clip of `seconds` sampled every `delay` hundredths: centered on the moment the
// first train passes its resting place, so a moving one crosses the middle.
export function clip(scene, { seconds = 4, fps = 25 } = {}) {
  const delay = Math.max(2, Math.round(100 / fps));
  const n = Math.max(1, Math.round((seconds * 100) / delay));
  const t0 = scene.trains[0].moving ? timeAt(scene) - (n * delay) / 200 : 0;
  const frames = [];
  for (let i = 0; i < n; i++) {
    const canvas = renderFrame(scene, t0 + (i * delay) / 100);
    const last = frames.at(-1);
    if (last && last.canvas.px.every((v, j) => v === canvas.px[j])) last.delay += delay;
    else frames.push({ canvas, delay });
  }
  return frames;
}

// --- Social images -------------------------------------------------------------

// "git-trains" in a bold lowercase pixel face drawn for these images, in the spirit of
// the site's Pixelify Sans: 2-dot stems, x-height 7, ascenders from row 0, descenders to row 12.
const TITLE_GLYPHS = {
  g: ['', '', '', '.#####', '##..##', '##..##', '##..##', '##..##', '##..##', '.#####', '....##', '....##', '#####.'],
  i: ['', '##', '', '##', '##', '##', '##', '##', '##', '##'],
  t: ['', '.##', '.##', '#####', '.##', '.##', '.##', '.##', '.##', '..###'],
  '-': ['', '', '', '', '', '', '####'],
  r: ['', '', '', '##.##', '####.', '###', '##', '##', '##', '##'],
  a: ['', '', '', '.####.', '....##', '....##', '.#####', '##..##', '##..##', '.#####'],
  n: ['', '', '', '#####.', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##'],
  s: ['', '', '', '.#####', '##', '##', '.####.', '....##', '....##', '#####.'],
};
const glyphW = (ch) => Math.max(...TITLE_GLYPHS[ch].map((r) => r.length));
const titleWidth = (text) => [...text].reduce((w, ch) => w + glyphW(ch) + 1, -1);

function drawTitle(g, text, x, y, px, color) {
  for (const ch of text) {
    TITLE_GLYPHS[ch].forEach((row, r) => {
      for (let c = 0; c < row.length; c++) if (row[c] === '#') g.rect(x + c * px, y + r * px, px, px, color);
    });
    x += (glyphW(ch) + 1) * px;
  }
}

// The 3x5 sign font, `px` pixels per dot.
function drawSmall(g, text, x, y, px, color) {
  const tmp = new Grid(textWidth(text), 5);
  drawText(tmp, text, 0, 0, '#');
  for (let r = 0; r < 5; r++) for (let c = 0; c < tmp.w; c++) if (tmp.get(c, r)) g.rect(x + c * px, y + r * px, px, px, color);
}

const INK = {
  light: { title: '#18201b', shadow: '#ffffff', tag: '#2d3440', yellow: '#c98f00', green: '#1b8638' },
  dark: { title: '#f4f7f5', shadow: '#070b1e', tag: '#a7b4d0', yellow: '#f0c23a', green: '#47c06a' },
};

// width x height pixels at `scale` (pixels per scene pixel): the scene along the bottom,
// its sky reaching the top, and the name with the site's stripe over it. `title` and
// `small` are scene pixels per dot of the title and of the tagline.
export function socialImage({ width, height, scale, theme = 'dark', title = 3, small = 2 }) {
  const W = width / scale;
  const H = height / scale;
  // No station sign or caption: just the train, with a yellow (JavaScript) stripe.
  const stats = sampleStats({ total: 420, streak: 30, yesterday: 14 });
  stats.user = '';
  stats.languages[0] = { ...stats.languages[0], name: 'JavaScript', color: '#f1e05a' };
  const spec = buildSpec(stats, { train: 'bullet', theme });
  spec.tracks[0].caption = '';
  const scene = rasterScene(spec, theme);
  const { plan } = scene;
  const cropX = plan.W - W; // keep the right side: the sun and the signal
  const tr = scene.trains[0];
  const frame = renderFrame(scene, timeAt(scene, 0, cropX + Math.round(W * 0.56 - tr.train.width / 2)));

  const out = new Canvas(W, H);
  const top = H - plan.H;
  // Sky above the scene: its top color, and in the dark theme more of its stars.
  const sky = new Grid(W, top);
  sky.rect(0, 0, W, top, '@sky0');
  out.paint(sky, 0, 0, scene.color);
  for (let y = top - 50; y > -50; y -= 50) {
    out.paint(scene.stars.a, -cropX, y, scene.color);
    out.paint(scene.stars.b, -cropX, y, scene.color, 0.2);
  }
  for (let y = 0; y < plan.H; y++) {
    out.px.set(frame.px.subarray((y * plan.W + cropX) * 3, (y * plan.W + plan.W) * 3), ((top + y) * W) * 3);
  }

  // Stripe (about 128 x 8 px, like the site's 120 x 6), title and a two-line tagline.
  const ink = INK[theme];
  const text = new Grid(W, H);
  const shade = new Grid(W, H);
  const m = Math.round(64 / scale);
  const band = Math.max(1, Math.round(4 / scale));
  const titleY = m + 2 * band + 2 * title;
  const tagY = titleY + 13 * title + 3 * small;
  const tagline = ['YOUR GITHUB ACTIVITY', 'AS A PIXEL-ART TRAIN'];
  for (const [g, d, colors] of [[shade, 1, null], [text, 0, ink]]) {
    const c = (k) => (colors ? colors[k] : ink.shadow);
    g.rect(m + d, m + d, Math.round(128 / scale), band, c('yellow'));
    g.rect(m + d, m + d + band, Math.round(128 / scale), band, c('green'));
    drawTitle(g, 'git-trains', m + d, titleY + d, title, c('title'));
    tagline.forEach((line, i) => drawSmall(g, line, m + d, tagY + i * 8 * small + d, small, c('tag')));
  }
  const color = (c) => rgba(c);
  out.paint(shade, 0, 0, color, 0.6);
  out.paint(text, 0, 0, color);
  const right = m + Math.max(titleWidth('git-trains') * title, ...tagline.map((l) => textWidth(l) * small));
  return { canvas: out, fits: right < W && tagY + 13 * small < top + 44 };
}

// --- Command line ----------------------------------------------------------------

function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: 'string', default: 'sample/train' },
      theme: { type: 'string', default: 'both' },
      scale: { type: 'string', default: '2' },
      seconds: { type: 'string', default: '4' },
      fps: { type: 'string', default: '25' },
      train: { type: 'string', default: 'auto' },
      skyline: { type: 'string', default: 'city' },
      mode: { type: 'string', default: 'single' },
      user: { type: 'string', default: 'octocat' },
      total: { type: 'string', default: '1400' },
      streak: { type: 'string', default: '12' },
      yesterday: { type: 'string', default: '6' },
      language: { type: 'string', default: 'en' },
    },
  });
  const save = (path, data) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data);
    console.log(`${path} ${(data.length / 1024).toFixed(1)} KB`);
  };

  if (positionals[0] === 'social') {
    // GitHub's repository social preview, and the Open Graph image for the site.
    for (const [path, opts] of [
      ['docs/social.png', { width: 1280, height: 640, scale: 4, title: 3, small: 2 }],
      ['docs/og.png', { width: 1200, height: 630, scale: 3, title: 4, small: 3 }],
    ]) {
      const { canvas, fits } = socialImage(opts);
      if (!fits) throw new Error(`${path}: the title does not fit`);
      save(path, pngOf(canvas, opts.scale));
    }
    return;
  }

  const scale = Number(values.scale);
  if (!Number.isInteger(scale) || scale < 1 || scale > 6) throw new Error('--scale: a whole number from 1 to 6');
  const load = (v, parse) => (v.endsWith('.json') ? parse(JSON.parse(readFileSync(v, 'utf8'))) : v);
  const stats = sampleStats({ total: +values.total, streak: +values.streak, yesterday: +values.yesterday });
  stats.user = values.user;
  const spec = buildSpec(stats, {
    train: load(values.train, parseCustomModel),
    skyline: parseSkyline(load(values.skyline, (raw) => raw)),
    mode: values.mode,
    language: values.language,
  });
  const themes = values.theme === 'both' ? ['light', 'dark'] : [values.theme];
  for (const theme of themes) {
    if (!THEMES[theme]) throw new Error('--theme: light, dark or both');
    const scene = rasterScene(spec, theme);
    const frames = clip(scene, { seconds: +values.seconds, fps: +values.fps });
    const base = themes.length > 1 ? `${values.out}-${theme}` : values.out;
    save(`${base}.png`, pngOf(renderFrame(scene, timeAt(scene)), scale));
    save(`${base}.gif`, gif(frames, scale));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2));
