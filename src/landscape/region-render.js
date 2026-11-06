// landscape/region-render.js: focused region-render operations.

import { rng } from '../graphics/pixel.js';

export const SYMBOL_COLORS = {
  '#': '@house',
  w: '@win',
  r: '@houseRoof',
  t: '@sleeper',
  l: '@tree',
  d: '@tree2',
  1: '@accent1',
  2: '@accent2',
  3: '@accent3',
  4: '@accent4',
};

// The sea has no accent of its own: it is a theme color that exists only while a region needs it.
const SEA = { light: '#8fc3e0', dark: '#0f2f55' };

// Theme variables that a region adds on top of THEMES (see applyRegionTheme).
export const REGION_THEME_KEYS = ['accent1', 'accent2', 'accent3', 'accent4', 'sea'];

// The parts of a parsed region with their defaults, for the painter.
export function regionParts(region) {
  const { terrain = 'hills', accents = [], houses = [], trees = [], plants = [], landmark = null } = region;
  return { terrain, accents, houses, trees, plants, landmark };
}

// --- Theme ------------------------------------------------------------------------

// The accents (and the sea) are CSS variables like the rest of THEMES, but they exist only
// while a region uses them, so a scene without region keeps exactly today's stylesheet.
// paintBackdrop calls this on every render, before the stylesheet is written.
export function applyRegionTheme(themes, region) {
  for (const mode of ['light', 'dark']) {
    for (const key of REGION_THEME_KEYS) delete themes[mode][key];
    if (!region) continue;
    (region.accents ?? []).forEach((a, i) => {
      themes[mode][`accent${i + 1}`] = a[mode];
    });
    if (region.terrain === 'sea') themes[mode].sea = SEA[mode];
  }
}

// --- Drawing ----------------------------------------------------------------------

// Paint a drawing standing on `bottom` (the row of its last line) and centered on column
// `cx`. `flip` mirrors it. `clip(x, y)` can hide pixels (what stands behind a hill).
export function paintSprite(g, sprite, cx, bottom, { flip = false, clip = null } = {}) {
  const { rows } = sprite;
  const w = rows[0].length;
  const left = cx - (w >> 1);
  rows.forEach((row, r) => {
    const y = bottom - rows.length + 1 + r;
    for (let c = 0; c < w; c++) {
      const ch = row[flip ? w - 1 - c : c];
      if (ch === '.') continue;
      const x = left + c;
      if (!clip || clip(x, y)) g.set(x, y, SYMBOL_COLORS[ch]);
    }
  });
}

export const spriteWidth = (sprite) => sprite.rows[0].length;

// A separate random stream for the choices of the region (which house, which tree,
// mirrored or not). The scene's own stream is left alone, so the ballast, the signals
// and the city stay exactly where they were with or without a region.
export function regionRng(seed) {
  return rng((seed ^ 0x9e3779b9) >>> 0);
}

export const pickOne = (list, rand) => list[Math.floor(rand() * list.length)];

// --- Terrain ----------------------------------------------------------------------

// Triangle wave in [-1, 1] with period 2 pi: pointed peaks, for mountains.
const tri = (t) => (2 / Math.PI) * Math.asin(Math.sin(t));

// Height (in pixels above the strip's ground) of the far ridge of a terrain, or null for
// the default hills of the scenery. `k` is the strip, so each one has its own ridge.
export function ridgeHeight(terrain, x, k) {
  if (terrain === 'mountains') return Math.round(24 + 8 * tri(x / 41 + k * 1.3) + 4 * tri(x / 17 + k * 2.6));
  if (terrain === 'plains') return Math.round(5 + 1.5 * Math.sin(x / 61 + k) + Math.sin(x / 23 + 2 * k));
  if (terrain === 'sea') return 16;
  return null;
}

// Snow on the peaks: the highest pixels of a mountain ridge.
export const SNOW_LINE = 29;
