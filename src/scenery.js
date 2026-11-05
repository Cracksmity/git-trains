// Scene scenery: sky, celestial bodies, clouds, city, landscape between tracks, overhead wires
// and signals. Everything is drawn on pixel grids (see pixel.js). Colors
// with "@" are theme variables (THEMES) and change between light and dark.

import { Grid, rng } from './pixel.js';
import { TRAIN_H } from './train.js';
import { drawText, textWidth, clean } from './font.js';
import { paintSkyline, skylineColumns } from './skyline.js';

export { rng };

export const SCENE_W = 448;
export const GY0 = 88; // rail row of the first track
export const PITCH = 52; // distance between tracks
export const BALLAST = 12;

export const THEMES = {
  light: {
    sky0: '#bfe0f5', sky1: '#d3ebf9', sky2: '#e5f4fc', sky3: '#f4fafe',
    sun: '#ffd24a', rays: '#ffe58a', moonSpot: 'rgba(0,0,0,0)', star: 'rgba(255,255,255,0)',
    cloud: '#ffffff',
    city2: '#a9c2d8', city: '#92aec8', cityWin: 'rgba(255,214,106,0)',
    haze: '#dff0f7', hill2: '#b4d8b4', hill: '#9cc9a0', tree: '#4d9867', tree2: '#3b7f52',
    house: '#f3e8d4', houseRoof: '#c8693f', win: '#8db4d6',
    ballast: '#8f8a83', ballast2: '#7a766f', sleeper: '#6b5848',
    rail: '#c4c9d1', railDark: '#6b7079', mast: '#58606c', wire: '#3b414b', shadow: 'rgba(0,0,0,0.22)',
    text: '#2d3440', capbg: 'rgba(255,255,255,0.55)', speed: 'rgba(255,255,255,0.85)',
  },
  dark: {
    sky0: '#070b1e', sky1: '#0d1531', sky2: '#142046', sky3: '#1d2e5c',
    sun: '#e8eefc', rays: 'rgba(0,0,0,0)', moonSpot: '#b5c0de', star: '#dfe8ff',
    cloud: 'rgba(110,130,210,0.28)',
    city2: '#16204a', city: '#0f1736', cityWin: '#ffd36a',
    haze: '#131d42', hill2: '#122a3a', hill: '#0b2029', tree: '#0a2a22', tree2: '#061f19',
    house: '#2a2e4d', houseRoof: '#3d2a35', win: '#ffd36a',
    ballast: '#2a2b32', ballast2: '#222329', sleeper: '#3b2f27',
    rail: '#7a8191', railDark: '#363a45', mast: '#2d3340', wire: '#151821', shadow: 'rgba(0,0,0,0.5)',
    text: '#a7b4d0', capbg: 'rgba(0,0,0,0.45)', speed: 'rgba(255,255,255,0.7)',
  },
};

export function sceneHeight(nTracks) {
  return GY0 + BALLAST + PITCH * (nTracks - 1);
}

const SUN = { x: SCENE_W - 56, y: 20 };

// --- Sky ----------------------------------------------------------------

// 4 solid bands and, between them, 3 dithered rows (25%, 50%, and 75%) made with
// dotted lines. Always in the background; everything else is painted over it.
export function skyLayer(W, used) {
  const bh = GY0 / 4;
  let out = '';
  for (let i = 0; i < 4; i++) {
    used.add(`sky${i}`);
    out += `<rect class="c-sky${i}" y="${i * bh}" width="${W}" height="${bh}"/>`;
  }
  for (let i = 1; i < 4; i++) {
    const b = i * bh;
    const rows = [
      [b - 3, '1 3', 0],
      [b - 2, '1 1', 1],
      [b - 1, '3 1', 0],
    ];
    for (const [y, dash, off] of rows) {
      out += `<path class="s-sky${i}" stroke-dasharray="${dash}" stroke-dashoffset="${-off}" d="M0 ${y + 0.5}H${W}"/>`;
    }
  }
  return out;
}

// The same sky on a pixel grid (for scripts/export.js): the dashes above, pixel by pixel.
export function paintSky(g) {
  const bh = GY0 / 4;
  for (let i = 0; i < 4; i++) g.rect(0, i * bh, g.w, bh, `@sky${i}`);
  for (let i = 1; i < 4; i++) {
    for (let x = 0; x < g.w; x++) {
      if (x % 4 === 0) g.set(x, i * bh - 3, `@sky${i}`);
      if (x % 2 === 1) g.set(x, i * bh - 2, `@sky${i}`);
      if (x % 4 !== 3) g.set(x, i * bh - 1, `@sky${i}`);
    }
  }
}

// Sun (with rays) or moon (with craters): the theme determines what is visible.
export function celestialLayer(W, used) {
  return celestialGrid(W).paths(used);
}

// The grids behind the SVG layers are exported too: scripts/export.js paints them as pixels.
export function celestialGrid(W) {
  const g = new Grid(W, 40);
  const { x: sx, y: sy } = SUN;
  for (let a = 0; a < 8; a++) {
    const dx = Math.round(Math.cos((a * Math.PI) / 4) * 100) / 100;
    const dy = Math.round(Math.sin((a * Math.PI) / 4) * 100) / 100;
    for (const r of [9, 10]) g.set(sx + Math.round(dx * r), sy + Math.round(dy * r), '@rays');
  }
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -6; dx <= 6; dx++) if (dx * dx + dy * dy <= 38) g.set(sx + dx, sy + dy, '@sun');
  }
  for (const [dx, dy] of [[-2, -1], [2, 2], [1, -3], [-1, 3], [3, -1]]) g.set(sx + dx, sy + dy, '@moonSpot');
  return g;
}

// Stars in two halves that twinkle alternately (visible only in the dark theme).
export function starsLayers(W, used) {
  const { a, b } = starsGrids(W);
  return { a: a.paths(used), b: b.paths(used) };
}

export function starsGrids(W) {
  const rand = rng(4242);
  const a = new Grid(W, 52);
  const b = new Grid(W, 52);
  for (let i = 0; i < 52; i++) {
    const x = Math.floor(rand() * W);
    const y = 2 + Math.floor(rand() * 48);
    if (Math.abs(x - SUN.x) < 12 && Math.abs(y - SUN.y) < 12) continue;
    (i % 2 ? a : b).set(x, y, '@star');
  }
  return { a, b };
}

function cloud(g, x, y, w, seed) {
  const rand = rng(seed);
  const baseY = y + 6; // flat bottom row
  const n = Math.max(3, Math.round(w / 6));
  for (let i = 0; i < n; i++) {
    const cx = x + 3 + Math.round((i * (w - 6)) / (n - 1));
    const r = 2 + Math.floor(rand() * 3) + (i > 0 && i < n - 1 ? 1 : 0);
    const cy = baseY - r + 1;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r + 1 && cy + dy <= baseY) g.set(cx + dx, cy + dy, '@cloud');
      }
    }
  }
  g.rect(x + 1, baseY - 1, w - 2, 2, '@cloud');
}

// Two consecutive cloud periods: shifting the layer W pixels makes a continuous loop.
export function cloudsLayer(W, used) {
  return cloudsGrid(W).paths(used);
}

export function cloudsGrid(W) {
  const g = new Grid(W * 2, 52);
  const clouds = [[20, 6, 30], [112, 22, 22], [196, 8, 34], [276, 28, 24], [352, 12, 28], [418, 32, 20]];
  clouds.forEach(([x, y, w], i) => {
    for (const o of [0, W]) cloud(g, x + o, y, w, 900 + i);
  });
  return g;
}

// --- Landscape ---------------------------------------------------------------

function bush(g, x, bottomY, w, h, color) {
  for (let r = 0; r < h; r++) {
    const inset = r === h - 1 ? 2 : r === h - 2 ? 1 : 0;
    if (w - 2 * inset > 0) g.rect(x + inset, bottomY - r, w - 2 * inset, 1, color);
  }
}

function pine(g, x, base, h) {
  g.rect(x, base - 1, 1, 2, '@sleeper');
  for (let i = 0; i < h; i++) {
    const wdt = 1 + 2 * Math.floor(i / 3);
    g.rect(x - (wdt >> 1), base - 1 - (h - i), wdt, 1, i % 5 < 3 ? '@tree' : '@tree2');
  }
}

function roundTree(g, x, base, r) {
  g.rect(x, base - 2, 1, 3, '@sleeper');
  const cy = base - 2 - r;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r + 1) g.set(x + dx, cy + dy, dy > 0 ? '@tree2' : '@tree');
    }
  }
}

function house(g, x, base, w) {
  g.rect(x, base - 5, w, 6, '@house');
  for (let r = 0; r < 4; r++) g.rect(x - 1 + r, base - 6 - r, w + 2 - 2 * r, 1, '@houseRoof');
  g.rect(x + 2, base - 4, 2, 2, '@win');
  g.rect(x + w - 4, base - 4, 2, 2, '@win');
  g.rect(x + (w >> 1), base - 2, 1, 3, '@sleeper');
}

const FAR = [15, 6, 37, 3, 13]; // base, amp1, f1, amp2, f2
const NEAR = [7, 3, 23, 2, 9];
const hillH = (x, [base, a1, f1, a2, f2], ph) =>
  Math.round(base + a1 * Math.sin(x / f1 + ph) + a2 * Math.sin(x / f2 + ph * 2));

// A hill as a single path with 1 px steps (much shorter than one rect per column).
function hillPath(W, y1, heightAt, cls, used) {
  used.add(cls);
  const bottom = y1 + 1;
  let d = `M0 ${bottom}`;
  let prev = null;
  for (let x = 0; x < W; x++) {
    const top = y1 - heightAt(x) + 1;
    if (top === prev) continue;
    d += prev === null ? `V${top}` : `H${x}V${top}`;
    prev = top;
  }
  return `<path class="c-${cls}" d="${d}H${W}V${bottom}z"/>`;
}

// Background of the strips between tracks (tracks 2, 3...): haze and two layers of hills.
// Rendered as separate SVG, beneath the rest of the scenery.
export function bandsLayer(W, tracks, used) {
  let out = '';
  tracks.forEach((_, k) => {
    if (k === 0) return;
    const gy = GY0 + PITCH * k;
    const y0 = gy - PITCH + BALLAST;
    const y1 = gy - 1;
    used.add('haze');
    out += `<rect class="c-haze" y="${y0}" width="${W}" height="${y1 - y0 + 1}"/>`;
    out += hillPath(W, y1, (x) => hillH(x, FAR, k), 'hill2', used);
    out += hillPath(W, y1, (x) => hillH(x, NEAR, k * 1.7), 'hill', used);
  });
  return out;
}

// The same strips on a pixel grid (for scripts/export.js).
export function paintBands(g, tracks) {
  tracks.forEach((_, k) => {
    if (k === 0) return;
    const gy = GY0 + PITCH * k;
    const y1 = gy - 1;
    g.rect(0, gy - PITCH + BALLAST, g.w, PITCH - BALLAST, '@haze');
    for (const [shape, ph, color] of [[FAR, k, '@hill2'], [NEAR, k * 1.7, '@hill']]) {
      for (let x = 0; x < g.w; x++) {
        const h = hillH(x, shape, ph);
        g.vline(x, y1 - h + 1, h, color);
      }
    }
  });
}

// Foreground of those strips: village (odd k) or forest (even k).
function paintBandFront(g, W, y1, k, rand) {
  const top = (x) => y1 - hillH(x, NEAR, k * 1.7) + 1;

  const taken = [];
  if (k % 2 === 1) {
    for (let x = 14 + Math.floor(rand() * 20); x < W - 24; x += 38 + Math.floor(rand() * 30)) {
      const w = 9 + 2 * Math.floor(rand() * 3);
      house(g, x, top(x + (w >> 1)) + 2, w);
      taken.push([x - 4, x + w + 4]);
    }
  }
  const step = k % 2 === 1 ? 11 : 8;
  for (let x = 4; x < W; x += step + Math.floor(rand() * 9)) {
    if (taken.some(([a, b]) => x >= a && x <= b)) continue;
    const base = top(x) + 1;
    if (rand() < 0.55) pine(g, x, base, 9 + Math.floor(rand() * (k % 2 === 1 ? 5 : 11)));
    else roundTree(g, x, base, 3 + Math.floor(rand() * 2));
  }
}

// Tracks: rail, ballast, and sleepers (thick dashed line, one element per track).
// Trains without a pantograph also have a third rail (or guide bar) on
// insulators. Rendered as separate SVG, beneath the rest of the scenery.
export function railsLayer(W, tracks, used) {
  let out = '';
  tracks.forEach((t, k) => {
    const gy = GY0 + PITCH * k;
    used.add('rail').add('railDark').add('ballast');
    out += `<rect class="c-rail" y="${gy}" width="${W}" height="1"/>`;
    out += `<rect class="c-railDark" y="${gy + 1}" width="${W}" height="1"/>`;
    out += `<rect class="c-ballast" y="${gy + 2}" width="${W}" height="${BALLAST - 2}"/>`;
    out += `<path class="s-sleeper" stroke-width="4" stroke-dasharray="5 3" d="M0 ${gy + 4}H${W}"/>`;
    if (!t.overhead) {
      let posts = '';
      for (let x = 4; x < W; x += 16) posts += `M${x} ${gy + 5}h1v2h-1z`;
      out += `<rect class="c-rail" y="${gy + 3}" width="${W}" height="1"/>`;
      out += `<path class="c-railDark" d="M0 ${gy + 4}h${W}v1h-${W}z${posts}"/>`;
    }
  });
  return out;
}

// The same tracks on a pixel grid (for scripts/export.js).
export function paintRails(g, tracks) {
  tracks.forEach((t, k) => {
    const gy = GY0 + PITCH * k;
    g.hline(0, gy, g.w, '@rail');
    g.hline(0, gy + 1, g.w, '@railDark');
    g.rect(0, gy + 2, g.w, BALLAST - 2, '@ballast');
    for (let x = 0; x < g.w; x++) if (x % 8 < 5) g.vline(x, gy + 2, 4, '@sleeper');
    if (!t.overhead) {
      g.hline(0, gy + 3, g.w, '@rail');
      g.hline(0, gy + 4, g.w, '@railDark');
      for (let x = 4; x < g.w; x += 16) g.vline(x, gy + 5, 2, '@railDark');
    }
  });
}

// Signal: red if there was no activity yesterday, amber if low, green if normal or high.
function signal(g, x, gy, state) {
  const on = state === 'idle' ? 0 : state === 'slow' ? 1 : 2;
  const lights = [['#ff4a3d', '#3b1f20'], ['#ffb02e', '#3b3020'], ['#4dff7c', '#16372a']];
  g.rect(x + 1, gy - 19, 2, 19, '@mast');
  g.rect(x, gy - 32, 5, 13, '#1b1d24');
  lights.forEach(([lit, dim], i) => g.rect(x + 1, gy - 31 + i * 4, 3, 3, i === on ? lit : dim));
}

// --- Main scenery -----------------------------------------------------

// Random city in two layers (the usual background): the distant one in `far` and the
// near one, with windows, in `near` (they can be the same grid).
function randomCity(far, near, W, rand) {
  for (const [g, color, minH, maxH, win] of [[far, '@city2', 16, 44, false], [near, '@city', 8, 26, true]]) {
    let x = -4;
    while (x < W) {
      const w = 8 + Math.floor(rand() * 14);
      const h = minH + Math.floor(rand() * (maxH - minH));
      g.rect(x, GY0 - h, w, h, color);
      if (win) {
        for (let wy = GY0 - h + 3; wy < GY0 - 3; wy += 4) {
          for (let wx = x + 2; wx < x + w - 2; wx += 3) if (rand() < 0.35) g.set(wx, wy, '@cityWin');
        }
      }
      x += w + Math.floor(rand() * 3);
    }
  }
}

// Each user gets their own procedural city (and bushes, villages, ballast): the
// random numbers are seeded with the username, so it stays the same every day.
export function seedFor(user) {
  const name = String(user ?? '').trim().toLowerCase();
  if (!name) return 20261102;
  let h = 0x811c9dc5; // FNV-1a
  for (const ch of name) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193) >>> 0;
  return h;
}

// skyline: the skyline already validated (see skyline.js) or null for the procedural city.
export function paintBackdrop(W, H, tracks, user, skyline = null) {
  const g = new Grid(W, H);
  const rand = rng(seedFor(user));

  // City. With a custom skyline the random city is still calculated, on separate
  // grids, so it consumes the same random numbers and the rest of the scenery
  // (bushes, ballast, villages) does not change. With `fill` only its near layer
  // (low buildings with windows) is used as filler: in front of distant buildings,
  // behind nearby ones and without touching their columns.
  if (!skyline) randomCity(g, g, W, rand);
  else {
    const scratch = new Grid(W, H);
    const filler = skyline.fill ? new Grid(W, H) : scratch;
    randomCity(scratch, filler, W, rand);
    paintSkyline(g, skyline, GY0, 'far');
    if (skyline.fill) {
      const busy = skylineColumns(skyline, 'near', 2);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const c = filler.get(x, y);
          if (c && !busy.has(x)) g.set(x, y, c);
        }
      }
    }
    paintSkyline(g, skyline, GY0, 'near');
  }

  // Slope with bushes in front of the city.
  g.rect(0, GY0 - 3, W, 3, '@hill');
  for (let x = 2; x < W; x += 5 + Math.floor(rand() * 9)) {
    bush(g, x, GY0 - 2, 4 + Math.floor(rand() * 5), 3 + Math.floor(rand() * 3), rand() < 0.5 ? '@tree' : '@tree2');
  }

  tracks.forEach((t, k) => {
    const gy = GY0 + PITCH * k;
    if (k > 0) paintBandFront(g, W, gy - 1, k, rand);

    // Ballast specks (ballast and sleepers are in railsLayer).
    for (let x = 0; x < W; x++) {
      if (rand() < 0.08) g.set(x, gy + 6 + Math.floor(rand() * 5), '@ballast2');
    }

    // Signal in front of the train according to its direction of travel.
    signal(g, t.dir === -1 ? 8 : W - 17, gy, t.state);

    // Overhead wires, only if the train on this track has a pantograph.
    if (t.overhead) {
      const wireY = gy - TRAIN_H;
      g.hline(0, wireY, W, '@wire');
      for (let x = 30; x < W; x += 96) {
        g.rect(x, wireY - 8, 2, gy - (wireY - 8), '@mast');
        g.hline(x + 2, wireY - 6, 10, '@mast');
        g.vline(x + 11, wireY - 6, 6, '@mast');
      }
    }
  });

  // Station sign with the user.
  const name = clean(user).replace(/ /g, '').slice(0, 16);
  if (name) {
    const tw = textWidth(name);
    const pw = tw + 8;
    g.rect(24, 24, 2, GY0 - 24, '@mast');
    g.rect(14, 10, pw, 13, '#e9f3ee');
    g.rect(15, 11, pw - 2, 11, '#1f7a56');
    drawText(g, name, 14 + 4, 14, '#ffffff');
  }

  // Legend on the ballast.
  tracks.forEach((t, k) => {
    if (!t.caption) return;
    const gy = GY0 + PITCH * k;
    const tw = textWidth(t.caption);
    if (!tw) return;
    g.rect(4, gy + 4, tw + 5, 7, '@capbg');
    drawText(g, t.caption, 6, gy + 5, '@text');
  });

  return g;
}
