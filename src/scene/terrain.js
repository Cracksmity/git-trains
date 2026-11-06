// scene/terrain.js: focused terrain operations.

import { paintSprite, spriteWidth, pickOne, ridgeHeight, SNOW_LINE } from '../landscape/region-render.js';
import { GY0, PITCH, BALLAST } from './layout.js';


// --- Landscape ---------------------------------------------------------------

export function bush(g, x, bottomY, w, h, color) {
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

export function house(g, x, base, w) {
  g.rect(x, base - 5, w, 6, '@house');
  for (let r = 0; r < 4; r++) g.rect(x - 1 + r, base - 6 - r, w + 2 - 2 * r, 1, '@houseRoof');
  g.rect(x + 2, base - 4, 2, 2, '@win');
  g.rect(x + w - 4, base - 4, 2, 2, '@win');
  g.rect(x + (w >> 1), base - 2, 1, 3, '@sleeper');
}

/** @type {[number, number, number, number, number]} */
const FAR = [15, 6, 37, 3, 13];

// base, amp1, f1, amp2, f2
/** @type {[number, number, number, number, number]} */
const NEAR = [7, 3, 23, 2, 9];

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

// The far ridge of a region's terrain in strip k, painted over the strip's backdrop.
// bandsLayer (the hills) is drawn without knowing the skyline, so this goes on the
// scenery grid, which is painted after it: mountains stand behind the default far hills
// (only what rises above them is added), plains and sea replace them with haze.
function paintTerrain(g, W, y1, k, terrain) {
  const nearTop = (x) => y1 - hillH(x, NEAR, k * 1.7) + 1;
  for (let x = 0; x < W; x++) {
    const ridgeTop = y1 - ridgeHeight(terrain, x, k) + 1;
    const farTop = y1 - hillH(x, FAR, k) + 1;
    const near = nearTop(x);
    if (terrain === 'mountains') {
      const snow = Math.min(3, y1 - ridgeTop + 1 - SNOW_LINE + 1);
      for (let y = ridgeTop; y < Math.min(farTop, near); y++) g.set(x, y, y - ridgeTop < snow ? '@cloud' : '@city2');
      continue;
    }
    for (let y = Math.min(farTop, ridgeTop); y < near; y++) {
      if (y < ridgeTop) g.set(x, y, '@haze');
      else if (terrain === 'sea') g.set(x, y, (x * 7 + y * 13 + k * 5) % 23 === 0 && y > ridgeTop + 1 ? '@cloud' : '@sea');
      else g.set(x, y, '@hill2');
    }
  }
}

// Ground under a drawing: its lowest column of the near hill, so it never floats.
function groundFor(top, cx, w) {
  let y = -Infinity;
  for (let x = cx - (w >> 1); x < cx - (w >> 1) + w; x++) y = Math.max(y, top(x));
  return y;
}

// Foreground of those strips: village (odd k) or forest (even k). With a region, its
// houses, trees, plants and landmark are drawn instead of the usual ones; the random
// numbers are drawn exactly as before (the region only chooses with its own stream),
// so the ballast, signals and bushes of the scene do not move.
export function paintBandFront(g, W, y1, k, rand, region = null, pick = null) {
  const top = (x) => y1 - hillH(x, NEAR, k * 1.7) + 1;
  const village = k % 2 === 1;
  if (region && region.terrain !== 'hills') paintTerrain(g, W, y1, k, region.terrain);

  // Spans taken by houses and the landmark: trees and plants keep out of them.
  const solid = [];
  const free = (a, b) => !solid.some(([x0, x1]) => a <= x1 + 1 && b >= x0 - 1);
  const lm = region?.landmark;
  if (lm && village) {
    const w = spriteWidth(lm);
    const cx = 24 + Math.floor(pick() * (W - 48));
    if (lm.place === 'far') {
      paintSprite(g, lm, cx, groundFor(top, cx, w) + 1, { clip: (x, y) => y < top(x) });
    } else {
      paintSprite(g, lm, cx, groundFor(top, cx, w) + 1);
      solid.push([cx - (w >> 1), cx - (w >> 1) + w - 1]);
    }
  }

  const taken = [];
  if (village) {
    for (let x = 14 + Math.floor(rand() * 20); x < W - 24; x += 38 + Math.floor(rand() * 30)) {
      const w = 9 + 2 * Math.floor(rand() * 3);
      taken.push([x - 4, x + w + 4]);
      if (!region?.houses.length) {
        house(g, x, top(x + (w >> 1)) + 2, w);
        continue;
      }
      const sprite = pickOne(region.houses, pick);
      const flip = pick() < 0.5;
      const sw = spriteWidth(sprite);
      const cx = x + (w >> 1);
      const left = cx - (sw >> 1);
      if (!free(left, left + sw - 1)) continue;
      paintSprite(g, sprite, cx, groundFor(top, cx, sw) + 1, { flip });
      solid.push([left, left + sw - 1]);
    }
  }
  const step = village ? 11 : 8;
  let lastRight = -Infinity; // trees may overlap a little, not pile up
  for (let x = 4; x < W; x += step + Math.floor(rand() * 9)) {
    if (taken.some(([a, b]) => x >= a && x <= b)) continue;
    const base = top(x) + 1;
    const pineRoll = rand() < 0.55;
    const size = rand();
    if (!region) {
      if (pineRoll) pine(g, x, base, 9 + Math.floor(size * (village ? 5 : 11)));
      else roundTree(g, x, base, 3 + Math.floor(size * 2));
      continue;
    }
    const plant = village && region.plants.length && pick() < 0.35;
    const pool = plant ? region.plants : region.trees;
    if (!pool.length) {
      if (pineRoll) pine(g, x, base, 9 + Math.floor(size * (village ? 5 : 11)));
      else roundTree(g, x, base, 3 + Math.floor(size * 2));
      continue;
    }
    const sprite = pickOne(pool, pick);
    const flip = pick() < 0.5;
    const sw = spriteWidth(sprite);
    const left = x - (sw >> 1);
    if (!free(left, left + sw - 1) || left < lastRight - 3) continue;
    paintSprite(g, sprite, x, groundFor(top, x, sw) + 1, { flip });
    lastRight = left + sw - 1;
  }
}

export const hillH = (x, [base, a1, f1, a2, f2], ph) =>
  Math.round(base + a1 * Math.sin(x / f1 + ph) + a2 * Math.sin(x / f2 + ph * 2));
