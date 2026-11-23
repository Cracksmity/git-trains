// Nighttime headlight beam projected forward from the lead lamp onto the rails.
// Shared by the SVG renderer and the raster exporter so both paint the same pixels.

import { Grid } from '../graphics/pixel.js';
import { TOP, TRAIN_H, LOCO_UP, LOCO_ROWS } from '../trains/geometry.js';

export const BEAM_LEN = 42;

/**
 * Locate the lead headlight anchor in right-facing train coordinates.
 * Locomotives only read `'l'` (steam engines use `'y'` for brass); cab noses fall back to `'y'`.
 * @param {any} model
 * @param {number} width
 * @returns {{ x: number, y: number } | null}
 */
export function headlightOf(model, width) {
  /** @type {Array<{ x: number, y: number }>} */
  const pts = [];
  if (model.loco) {
    const ox = width - model.loco.w;
    const y0 = TOP - LOCO_UP;
    for (let y = 0; y < LOCO_ROWS; y++) {
      const row = model.loco.rows[y] ?? '';
      for (let x = 0; x < row.length; x++) {
        if (row[x] === 'l') pts.push({ x: ox + x, y: y0 + y });
      }
    }
  } else if (model.nose) {
    const ox = width - model.nose.w;
    for (const sym of ['l', 'y']) {
      for (let y = 0; y < model.nose.rows.length; y++) {
        const row = model.nose.rows[y];
        for (let x = 0; x < row.length; x++) {
          if (row[x] === sym) pts.push({ x: ox + x, y: TOP + y });
        }
      }
      if (pts.length) break;
    }
  }
  if (!pts.length) return null;
  // Frontmost lamp; when a nose has upper and lower lamps, pick the track-facing lower cluster.
  const maxX = Math.max(...pts.map((p) => p.x));
  const front = pts.filter((p) => p.x >= maxX - 1);
  const maxY = Math.max(...front.map((p) => p.y));
  const cluster = front.filter((p) => maxY - p.y <= 2);
  const y = cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length;
  return { x: maxX, y };
}

/**
 * Build the tapered two-tone pixel cone for a train heading right (`1`) or left (`-1`).
 * Theme inks `@beam` and `@beamSoft` are transparent by day and warm translucent glow at night.
 * @param {any} model
 * @param {number} width
 * @param {1 | -1} [dir]
 * @returns {{ grid: Grid, dx: number } | null}
 */
export function headlightBeam(model, width, dir = 1) {
  const hl = headlightOf(model, width);
  if (!hl) return null;
  const x0 = hl.x + 1;
  const gw = width + BEAM_LEN - x0;
  if (gw <= 0) return null;
  const h = TRAIN_H + 3;
  const g = new Grid(gw, h);
  const railY = TRAIN_H;
  const aimDx = (width - x0) + BEAM_LEN * 0.85;
  const aimDy = (railY - 1.5) - hl.y;

  for (let gx = 0; gx < gw; gx++) {
    const x = x0 + gx;
    const ahead = Math.max(0, x - width);
    const t = ahead / BEAM_LEN;
    const cy = hl.y + (gx / aimDx) * aimDy;
    const halfH = 1.1 + gx * 0.145;
    const y0 = Math.max(0, Math.floor(cy - halfH));
    const y1 = Math.min(h - 1, Math.ceil(cy + halfH));
    for (let y = y0; y <= y1; y++) {
      const rad = Math.abs(y - cy) / Math.max(1, halfH);
      if (rad > 1) continue;
      let strength = (1 - t * 0.92) * (1 - rad * rad * 0.72);
      if (gx <= 3) strength += 0.15;
      if (y === railY) strength = Math.max(strength, (1 - t * 0.9) * 0.82);
      if (y === railY + 2) strength *= 0.55;
      if (strength > 0.52) g.set(gx, y, '@beam');
      else if (strength > 0.19) g.set(gx, y, '@beamSoft');
    }
  }
  return dir === 1 ? { grid: g, dx: x0 } : { grid: g.mirror(), dx: -BEAM_LEN };
}
