import { rng } from '../graphics/pixel.js';
import { flakeGrid } from './snow.js';

/** @import { WeatherLayer } from './weather.js' */

// Far and near snowfall: much slower than rain, with gentle horizontal drift.
const SNOW_SPEED = [9, 13];
const SNOW_SPACING = [760, 920];
const SNOW_FLUTTER = [8, 6];

/**
 * Two depths of drifting flakes clipped to one place's strip, reusing the
 * winter decoration's flake builder.
 * @param {{ top: number, bottom: number, k: number }} band
 * @param {number} W
 * @returns {WeatherLayer[]}
 */
export function snowLayers(band, W) {
  const h = band.bottom - band.top;
  return [0, 1].map((near) => {
    const count = Math.round((W * h) / SNOW_SPACING[near]);
    const rand = rng(7400 + 10 * band.k + near);
    const grid = near
      ? flakeGrid(W, h, count, rand, '@wSnow', '@wSnowIce')
      : flakeGrid(W, h, count, rand, '@wSnowIce', '@wSnow');
    const dur = Math.round((h / SNOW_SPEED[near]) * 100) / 100;
    return {
      grid,
      z: /** @type {const} */ ('ground'),
      y: band.top,
      clip: /** @type {[number, number]} */ ([band.top, band.bottom]),
      fall: { h, dur, flutter: SNOW_FLUTTER[near] },
    };
  });
}
