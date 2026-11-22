import { Grid, rng } from '../graphics/pixel.js';

/** @import { WeatherLayer } from './weather.js' */

/**
 * Hail reaches the rail, with six extra steps offscreen for the bounce.
 * All three clips share a clock so impacts stay in phase in SVG and raster.
 * @param {{ top: number, base: number, k: number }} band
 * @param {number} W
 * @returns {WeatherLayer[]}
 */
export function hailLayers({ top, base, k }, W) {
  const height = base - top + 1;
  const h = height + 6;
  const fall = { h, dur: h / 112 };
  const rand = rng(7319 + k);
  const count = Math.round(W * height / 780);
  const falling = new Grid(W, 2 * h);
  const hop = new Grid(W, 2 * h);
  const landed = new Grid(W, 2 * h);

  for (let i = 0; i < count; i++) {
    const x = Math.floor((i + rand()) * (W - 1) / count);
    const y = Math.floor(rand() * h);
    const width = rand() < 0.35 ? 2 : 1;
    const stamp = (grid, row) => {
      const phase = (row + h) % h;
      for (const offset of [0, h]) grid.hline(x, phase + offset, width, '@wHail');
    };
    stamp(falling, y);
    if (i % 4 !== 0) continue;
    // A single-row clip shows one pose at a time. Hold the apex for four
    // ticks so a one-pixel rebound is visible even between display frames.
    for (let tick = 1; tick <= 4; tick++) stamp(hop, y - tick - 1);
    for (let tick = 5; tick <= 6; tick++) stamp(landed, y - tick);
  }
  return [
    { grid: falling, z: 'ground', y: top, clip: [top, base + 1], fall },
    { grid: hop, z: 'ground', y: top, clip: [base - 1, base], fall },
    { grid: landed, z: 'ground', y: top, clip: [base, base + 1], fall },
  ];
}
