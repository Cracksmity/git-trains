import { Grid } from '../graphics/pixel.js';
import { celestialGrid, cloudsGrid, paintSky, starsGrids } from './sky.js';

/** @import { WeatherLayer } from './weather.js' */

const UPPER_SKY = new Set(['@sky0', '@sky1', '@dusk', '@haze']);

/** @returns {WeatherLayer[]} */
export function heatSky(band, backdrop) {
  const width = backdrop.w;
  const city = band.k === 0;
  const grid = new Grid(width, city ? band.base / 2 : 13);
  const sky = city ? new Grid(width, grid.h) : backdrop;
  if (city) paintSky(sky);
  const stars = city ? starsGrids(width) : null;
  // Follow the existing band dithering. Star pixels show plain sky only by day.
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < width; x++) {
      const ink = sky.get(x, band.top + y);
      if (!UPPER_SKY.has(ink) && ink !== '@starlight') continue;
      const star = ink === '@starlight' || stars?.a.get(x, y) || stars?.b.get(x, y);
      grid.set(x, y, star ? '@wHeatDayHaze' : '@wHeatHaze');
    }
  }
  if (!city) return [{ grid, z: 'ground', y: band.top }];

  const sun = celestialGrid(width);
  // Extend each of the eight rays by one pixel, using the same night-transparent ink.
  const cx = width - 56;
  const cy = 20;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const radius = dx && dy ? 8 : 11;
      sun.set(cx + dx * radius, cy + dy * radius, '@rays');
    }
  }
  // The city sky is behind its skyline. Keep the disc and drifting clouds in front of the haze.
  return [
    { grid, z: 'sky', y: 0 },
    { grid: sun, z: 'sky', y: 0 },
    { grid: cloudsGrid(width), z: 'sky', y: 0, drift: true },
  ];
}
