import { Grid } from '../graphics/pixel.js';

/** @import { WeatherLayer } from '../scene/weather.js' */

const HORIZON_INKS = new Set(['@afterglow', '@ridge', '@ridgeShade']);

/** Refract the edges of the distant slopes just above the agave field.
 * @returns {WeatherLayer[]}
 */
export function tequilaShimmer(band, backdrop) {
  const horizon = band.base - 22;
  return [horizon - 2, horizon - 1].map((y, row) => {
    // Each grid holds two poses of one scanline. The one-row clip selects a pose
    // every 1.2 seconds in both renderers. Row 2 repeats row 0 across the seam.
    const grid = new Grid(backdrop.w, 3);
    for (let x = 1; x < backdrop.w; x++) {
      const left = backdrop.get(x - 1, y);
      const right = backdrop.get(x, y);
      if (left === right || !HORIZON_INKS.has(left) || !HORIZON_INKS.has(right)) continue;
      if (row === 0) {
        grid.set(x, 0, left);
        grid.set(x, 2, left);
      } else {
        grid.set(x - 1, 1, right);
      }
    }
    return { grid, z: 'ground', y, clip: [y, y + 1], fall: { h: 2, dur: 2.4 } };
  });
}
