import { Grid } from '../graphics/pixel.js';

/** @import { WeatherLayer } from '../scene/weather.js' */

const DISTANT_INKS = new Set([null, '@ridge', '@tower', '@towerEdge', '@towerLit', '@ridgeShade', '@logoBlue']);
const DITHER = [[0, 2], [3, 1]];

/**
 * Suspended dust thickens toward the ridge. The upper floors rise into clean air.
 * @param {{ base: number }} band
 * @param {Grid} backdrop
 * @returns {WeatherLayer}
 */
export function guadalajaraHaze(band, backdrop) {
  const top = Math.floor(band.base / 2);
  const grid = new Grid(backdrop.w, band.base - top);
  for (let x = 0; x < grid.w; x++) {
    const edge = Math.round(2 + 1.5 * Math.sin(x / 63) + 0.8 * Math.sin(x / 26));
    for (let y = 0; y < grid.h; y++) {
      const depth = y - edge - DITHER[y % 2][x % 2];
      if (depth < 0) continue;
      const under = backdrop.get(x, y + top);
      // Only the red-crowned tower's floor slabs share their inks with the stadium.
      const towerSlab = x >= 362 && x <= 376 && (under === '@roofWhite' || under === '@concreteLit');
      if (!DISTANT_INKS.has(under) && !towerSlab) continue;
      const ink = depth < 8 ? '@wHazeThin' : depth < 18 ? '@wHaze' : '@wHazeLow';
      grid.set(x, y, ink);
    }
  }
  return { grid, z: 'ground', y: top };
}
