import { Grid } from '../graphics/pixel.js';

/** @import { WeatherLayer } from '../scene/weather.js' */

const HORIZON_INKS = new Set(['@afterglow', '@ridge', '@ridgeShade']);

/** Two poses of one scanline. The one-row clip selects a pose every 1.2 seconds
 * in both renderers. Row 2 repeats row 0 across the seam.
 * @param {(x: number) => string | null} inkAt
 * @returns {WeatherLayer}
 */
export function shimmerLine(width, y, pose, inkAt) {
  const grid = new Grid(width, 3);
  for (let x = 0; x < width; x++) {
    const ink = inkAt(x);
    if (!ink) continue;
    grid.set(x, pose, ink);
    if (pose === 0) grid.set(x, 2, ink);
  }
  return { grid, z: 'ground', y, clip: [y, y + 1], fall: { h: 2, dur: 2.4 } };
}

/** Refract the edges of the distant slopes just above the agave field.
 * @returns {WeatherLayer[]}
 */
export function tequilaShimmer(band, backdrop) {
  const horizon = band.base - 22;
  return [horizon - 2, horizon - 1].map((y, row) => {
    return shimmerLine(backdrop.w, y, row, (x) => {
      const here = backdrop.get(x, y);
      const adjacent = backdrop.get(x + (row ? 1 : -1), y);
      return here !== adjacent && HORIZON_INKS.has(here) && HORIZON_INKS.has(adjacent) ? adjacent : null;
    });
  });
}
