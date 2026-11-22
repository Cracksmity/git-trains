// Shared snow helpers used by seasonal winter decor and the Jalisco snow state.
import { Grid } from '../graphics/pixel.js';

/**
 * One-pixel stepped horizontal sway keyframe, shared by falling flakes.
 * @param {string} name CSS @keyframes identifier
 */
export const swayKeyframe = (name) =>
  `@keyframes ${name}{0%,100%{transform:translateX(0)}50%{transform:translateX(1px)}}`;

/**
 * Two identical h-row periods of falling flakes so vertical loops have no seam.
 * @param {number} w grid width
 * @param {number} h period height in pixels
 * @param {number} count flakes per period
 * @param {() => number} rand seeded RNG
 * @param {string} primary main flake ink
 * @param {string} secondary accent ink drawn beside every third flake
 */
export function flakeGrid(w, h, count, rand, primary, secondary) {
  const g = new Grid(w, h * 2);
  for (let i = 0; i < count; i++) {
    const x = 3 + Math.floor(((i + rand()) * (w - 7)) / count);
    const y = Math.floor(rand() * h);
    const pixel = (dx, dy, color) => {
      const row = (y + dy) % h;
      for (const offset of [0, h]) g.set(x + dx, row + offset, color);
    };
    pixel(0, 0, primary);
    if (i % 3 === 0) pixel(1, 0, secondary);
  }
  return g;
}

/**
 * Paint snow one pixel above exposed roofs found by scanning the backdrop grid.
 * @param {Grid} g target grid
 * @param {Grid} backdrop painted scene backdrop
 * @param {{ fromX?: number, toX?: number, fromY: number, toY: number, roofs: Set<string>, above?: (ink: string | null) => boolean, ink: string, firstOnly?: boolean }} opts
 */
export function capRoofs(g, backdrop, { fromX = 0, toX = g.w, fromY, toY, roofs, above = (ink) => !ink, ink, firstOnly = false }) {
  for (let x = fromX; x < toX; x++) {
    for (let y = fromY; y < toY; y++) {
      if (!roofs.has(backdrop.get(x, y))) continue;
      if (y > 0 && above(backdrop.get(x, y - 1))) g.set(x, y - 1, ink);
      if (firstOnly) break;
    }
  }
}
