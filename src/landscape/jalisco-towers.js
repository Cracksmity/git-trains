import { polygon } from '../graphics/pixel-shapes.js';

// Windows lit only at night: `towerLit` matches `tower` in the light theme.
function nightWindows(g, x, w, top, bottom, seed) {
  for (let y = top; y < bottom; y += 2) {
    for (let px = x; px < x + w; px++) {
      const hash = (Math.imul(px, 374761393) ^ Math.imul(y, 668265263) ^ seed) >>> 0;
      if (hash % 7 === 0 && g.get(px, y) === '@tower') g.set(px, y, '@towerLit');
    }
  }
}

/**
 * Twin glass office prisms: a taller grey block with vertical mullions behind a
 * darker banded block that carries a blue disc near its top.
 * @param {import('../graphics/pixel.js').Grid} g
 * @param {number} x left edge of the front block
 * @param {number} base ground row
 */
export function glassOffices(g, x, base) {
  g.rect(x + 8, base - 54, 16, 54, '@tower');
  g.rect(x + 20, base - 54, 4, 54, '@ridgeShade');
  g.hline(x + 8, base - 54, 16, '@towerEdge');
  for (let px = x + 15; px < x + 20; px += 3) g.vline(px, base - 52, 52, '@towerEdge');
  nightWindows(g, x + 14, 6, base - 51, base, 2);
  g.rect(x, base - 44, 14, 44, '@ridgeShade');
  g.hline(x, base - 44, 14, '@towerEdge');
  for (let y = base - 34; y < base; y += 3) g.hline(x + 1, y, 12, '@tower');
  for (const [dx, dy, w] of [[6, -41, 3], [5, -40, 5], [5, -39, 5], [5, -38, 5], [6, -37, 3]]) {
    g.hline(x + dx, base + dy, w, '@logoBlue');
  }
}

/**
 * A slender hotel tower: banded glass over a broad lower block, a wedge-shaped
 * crown rising to the east with its red sign, and the mast on its high corner.
 * @param {import('../graphics/pixel.js').Grid} g
 * @param {number} x left edge of the 15-pixel shaft
 * @param {number} base ground row
 */
export function wedgeTower(g, x, base) {
  g.rect(x - 3, base - 24, 21, 24, '@ridgeShade');
  for (let y = base - 22; y < base; y += 2) g.hline(x - 2, y, 19, '@tower');
  g.rect(x, base - 66, 15, 42, '@tower');
  g.rect(x + 11, base - 66, 4, 42, '@ridgeShade');
  for (let y = base - 65; y < base - 24; y += 2) g.hline(x + 1, y, 10, '@towerEdge');
  nightWindows(g, x + 1, 10, base - 64, base - 24, 5);
  polygon(g, [[x,base-66],[x+14,base-76],[x+14,base-66]], '@towerEdge');
  g.rect(x + 7, base - 70, 7, 2, '@signRed');
  g.vline(x + 13, base - 84, 8, '@towerEdge');
}

/**
 * A stepped cylinder: three tiers narrowing upwards, banded white floor slabs
 * between dark glass, a wider red crown and the red spire beside its axis.
 * @param {import('../graphics/pixel.js').Grid} g
 * @param {number} cx axis
 * @param {number} base ground row
 */
export function redCrownTower(g, cx, base) {
  for (const [r, from, to] of [[7, 0, 32], [6, 32, 44], [4, 44, 54]]) {
    for (let h = from; h < to; h++) {
      const y = base - 1 - h;
      const slab = h % 2 === 1;
      g.hline(cx - r, y, 2 * r + 1, slab ? '@roofWhite' : '@ridgeShade');
      if (slab) g.hline(cx + r - 1, y, 2, '@concreteLit');
    }
  }
  g.rect(cx - 5, base - 56, 11, 2, '@capRed');
  g.rect(cx + 1, base - 66, 2, 10, '@capRed');
  g.set(cx + 1, base - 67, '@capRed');
}
