// Enlarged crops of a scene for reviewing hand-painted art: both themes, with
// or without the trains, at any moment of the animation.
import { Canvas, rasterScene, renderFrame } from './raster.js';
import { pngOf } from './png.js';

/**
 * @typedef {object} ZoomOptions
 * @property {{ x0?: number, y0?: number, x1?: number, y1?: number }} [region]
 *   Scene pixels, end exclusive. Missing or non-numeric edges cover the whole scene.
 * @property {number} [scale] Pixel size in the PNG (default 6).
 * @property {boolean} [trains] False paints only sky, scenery and rails.
 * @property {number} [time] Seconds into the animation (default 0, the frame the static PNG shows).
 */

const edge = (value, fallback, max) => {
  const v = Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(0, Math.min(max, v));
};

/**
 * One theme's frame, cropped to the region at scene resolution.
 * @param {Parameters<typeof rasterScene>[0]} spec scene description from buildSpec
 * @param {'light' | 'dark'} theme
 * @param {ZoomOptions} [options]
 * @returns {Canvas}
 */
export function cropScene(spec, theme, { region = {}, trains = true, time = 0 } = {}) {
  const scene = rasterScene(spec, theme);
  if (!trains) scene.trains = [];
  const full = renderFrame(scene, time);
  const x0 = edge(region.x0, 0, full.w);
  const y0 = edge(region.y0, 0, full.h);
  const x1 = edge(region.x1, full.w, full.w);
  const y1 = edge(region.y1, full.h, full.h);
  if (x1 <= x0 || y1 <= y0) {
    throw new Error(`zoom: empty region ${x0},${y0} to ${x1},${y1} in a ${full.w}x${full.h} scene`);
  }
  const crop = new Canvas(x1 - x0, y1 - y0);
  for (let y = 0; y < crop.h; y++) {
    const row = ((y0 + y) * full.w) * 3;
    crop.px.set(full.px.subarray(row + x0 * 3, row + x1 * 3), y * crop.w * 3);
  }
  return crop;
}

/**
 * PNG files of the same crop in the light and dark themes.
 * @param {Parameters<typeof rasterScene>[0]} spec
 * @param {ZoomOptions} [options]
 * @returns {{ light: Uint8Array, dark: Uint8Array }}
 */
export function zoomScene(spec, options = {}) {
  const scale = Math.max(1, Math.round(options.scale ?? 6));
  return {
    light: pngOf(cropScene(spec, 'light', options), scale),
    dark: pngOf(cropScene(spec, 'dark', options), scale),
  };
}
