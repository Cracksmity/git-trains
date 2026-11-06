// trains/locomotive.js: focused locomotive operations.

import { TOP, LOCO_ROWS, LOCO_UP, LOCO_SMALL } from './geometry.js';
import { partColor, underColors } from './palette.js';
import { mix } from '../graphics/colors.js';

// --- Locomotive --------------------------------------------------------------

const ROD = '#c9cdd4';

const ROD_PIN = '#7c828c';

const STEAM = { '#': '#f4f5f8', '%': '#cfd4dc', o: '#8f98a5' };

// Smoke puffs: [mask, dx, dy] with the mask centered on the chimney + dx
// and its bottom row at the chimney mouth + dy. "#" smoke, "%" shadow, "o"
// outline. Two frames: the puff emerges and the previous one stays behind (the train
// moves forward). Few rows remain above the chimney, so the smoke spreads out.
const PUFF_S = ['.oo.', 'o##o', 'o#%o', '.oo.'];

const PUFF_M = ['.ooo.', 'o###o', 'o#%%o', '.ooo.'];

const PUFF_L = ['..ooo..', '.o###oo', 'o######o', 'o##%%%%o', '.oooooo.'];

/** @type {Record<string, Array<[string[], number, number]>>} */
const PUFFS = {
  pa: [[PUFF_S, 0, -1], [PUFF_L, -10, -1]],
  pb: [[PUFF_M, -1, -1], [PUFF_L, -17, -2]],
};

// Pixels of a wheel with radius r: [dx, dy, tire?].
/** @param {number} r @returns {Array<[number, number, boolean]>} */
function wheelPixels(r) {
  const lim = (r + 0.5) ** 2;
  const inside = (dx, dy) => dx * dx + dy * dy <= lim;
  const out = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (!inside(dx, dy)) continue;
      const rim = !inside(dx - 1, dy) || !inside(dx + 1, dy) || !inside(dx, dy - 1) || !inside(dx, dy + 1);
      out.push([dx, dy, rim]);
    }
  }
  return out;
}

// Symmetric rounding (Math.round(-1.5) gives -1).
const sround = (v) => Math.sign(v) * Math.round(Math.abs(v));

// Locomotive wheel centered at (cx, cy). Disc marks rotate 60? between
// the wa and wb layers, as on the bogies.
function drawWheel(ctx, cx, cy, r, colors) {
  const { layers: L } = ctx;
  for (const [dx, dy, rim] of wheelPixels(r)) {
    L.body.set(cx + dx, cy + dy, rim ? colors.rim : dy < 0 ? colors.hi : colors.lo);
  }
  L.body.set(cx, cy, colors.hub);
  if (r >= 4) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) L.body.set(cx + dx, cy + dy, colors.hubLo);
  const rm = r - 1;
  const marks = { wa: [-90, 30, 150], wb: [-30, 90, 210] };
  for (const [layer, angles] of Object.entries(marks)) {
    for (const a of angles) {
      const t = (a * Math.PI) / 180;
      L[layer].set(cx + sround(rm * Math.cos(t)), cy + sround(rm * Math.sin(t)), colors.mark);
    }
  }
}

// Locomotive with its top-left corner at column ox of the train.
export function drawLoco(ctx, ox) {
  const { layers: L, model, stripe } = ctx;
  const P = model.pal;
  const loco = model.loco;
  const y0 = TOP - LOCO_UP; // train row where the drawing begins
  const at = (x, y) => (y >= 0 && y < LOCO_ROWS && x >= 0 && x < loco.w ? loco.rows[y][x] : '.');
  const filled = (x, y) => at(x, y) !== '.';

  // 1. Drawing and automatic outline on the silhouette edges.
  for (let y = 0; y < LOCO_ROWS; y++) {
    for (let x = 0; x < loco.w; x++) {
      const sym = at(x, y);
      if (sym === '.') continue;
      const edge = !filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1);
      L.body.set(ox + x, y0 + y, edge ? P.outline : partColor(model, loco, sym, y - LOCO_UP, stripe));
    }
  }

  // 2. Wheels: driving wheels joined by the connecting rod and separate small wheels. All touch
  //    the rail on the last row of the drawing.
  const { wheels } = loco;
  const U = underColors(P);
  const disc = wheels.color ?? U.disc;
  const colors = {
    rim: P.outline,
    hi: mix(disc, '#ffffff', 0.1),
    lo: disc,
    hub: mix(disc, '#ffffff', 0.45),
    hubLo: mix(disc, '#ffffff', 0.2),
    mark: mix(disc, '#ffffff', 0.3),
  };
  const bottom = TOP + 24;
  const r = (wheels.d - 1) / 2;
  const rs = (LOCO_SMALL - 1) / 2;
  for (const x of wheels.small) drawWheel(ctx, ox + x, bottom - rs, rs, colors);
  for (const x of wheels.drive) drawWheel(ctx, ox + x, bottom - r, r, colors);

  // The connecting rod goes on the wa/wb layers: down and forward in one frame, up and back
  // in the other, like the crankpin turning with the wheel.
  if (wheels.rod && wheels.drive.length >= 2) {
    const q = Math.max(1, Math.round(Math.max(1, r - 2) * 0.7));
    const cy = bottom - r;
    const x0 = Math.min(...wheels.drive);
    const x1 = Math.max(...wheels.drive);
    for (const [layer, d] of /** @type {Array<[string, number]>} */ ([['wa', q], ['wb', -q]])) {
      L[layer].hline(ox + x0 + d, cy + d, x1 - x0 + 1, ROD);
      for (const x of wheels.drive) L[layer].set(ox + x + d, cy + d, ROD_PIN);
    }
  }

  // 3. Smoke above the chimney; sparks (fast train) emerge from there too. Without
  //    a chimney, they jump from the rail under the front driving wheel.
  if (loco.smoke !== undefined) {
    const sx = ox + loco.smoke;
    let top = 0;
    while (!filled(loco.smoke, top)) top++;
    const mouth = y0 + top;
    for (const [layer, puffs] of Object.entries(PUFFS)) {
      for (const [mask, dx, dy] of puffs) {
        const left = sx + dx - Math.floor(mask[0].length / 2);
        const yTop = mouth + dy - mask.length + 1;
        mask.forEach((row, j) => {
          for (let i = 0; i < row.length; i++) {
            if (row[i] !== '.') L[layer].set(left + i, yTop + j, STEAM[row[i]]);
          }
        });
      }
    }
    ctx.shoeAnchor = { x: sx, y: mouth - 1 };
  } else {
    ctx.shoeAnchor = { x: ox + Math.max(...wheels.drive) + r, y: bottom };
  }
}
