// landscape/skyline-render.js: focused skyline-render operations.

import { rng } from '../graphics/pixel.js';

const odd = (n) => Math.max(1, n % 2 ? n : n - 1);

// Paint a top on the block { x, w, top } (top = highest occupied row) and
// return the new block, so the next top can be stacked on it.
function paintTop(g, blk, t, color) {
  const { x, w, top } = blk;
  const cx = x + (w - 1) / 2;
  if (t.type === 'flat') return blk;
  if (t.type === 'stepped') {
    const steps = t.steps ?? 2;
    const th = t.h ?? 3;
    let cur = blk;
    for (let s = 1; s <= steps; s++) {
      const inset = Math.max(1, Math.round((w * s) / (2 * (steps + 1))));
      const nw = Math.max(1, w - 2 * inset);
      cur = { x: x + Math.floor((w - nw) / 2), w: nw, top: cur.top - th };
      g.rect(cur.x, cur.top, cur.w, th, color);
    }
    return cur;
  }
  if (t.type === 'pyramid') {
    const tip = Math.min(t.tip ?? 1, w);
    const h = t.h ?? Math.max(1, Math.ceil((w - tip) / 2));
    let last = blk;
    for (let r = 1; r <= h; r++) {
      const rw = Math.max(tip, Math.round(w - ((w - tip) * r) / h));
      const rx = x + Math.floor((w - rw) / 2);
      g.rect(rx, top - r, rw, 1, color);
      last = { x: rx, w: rw, top: top - r };
    }
    return last;
  }
  if (t.type === 'dome') {
    const rad = w / 2;
    const h = t.h ?? Math.max(1, Math.ceil(rad * 0.8));
    let last = blk;
    for (let r = 1; r <= h; r++) {
      const dy = (r / h) * rad;
      const half = Math.sqrt(Math.max(0, rad * rad - dy * dy));
      const rw = Math.max(1, Math.round(half * 2));
      const rx = x + Math.floor((w - rw) / 2);
      g.rect(rx, top - r, rw, 1, color);
      last = { x: rx, w: rw, top: top - r };
    }
    return last;
  }
  if (t.type === 'spire') {
    const base = odd(Math.min(w, 3));
    const h = t.h ?? 6;
    for (let r = 1; r <= h; r++) {
      const rw = r <= Math.ceil(h / 3) ? base : 1;
      g.rect(Math.round(cx - (rw - 1) / 2), top - r, rw, 1, color);
    }
    return { x: Math.round(cx), w: 1, top: top - h };
  }
  // antenna
  const h = t.h ?? 5;
  g.rect(Math.round(cx), top - h, 1, h, color);
  return { x: Math.round(cx), w: 1, top: top - h };
}

// Windows as in the random city: a grid every 3 columns and 4 rows, with
// some lit at random (visible only at night).
function paintWindows(g, x, top, w, ground, seed) {
  const rand = rng(seed);
  for (let wy = top + 3; wy < ground - 3; wy += 4) {
    for (let wx = x + 2; wx < x + w - 2; wx += 3) if (rand() < 0.35) g.set(wx, wy, '@cityWin');
  }
}

// Columns occupied by buildings in a layer, with `margin` pixels on each side.
// The filler city is not drawn there so the custom buildings remain clear.
export function skylineColumns(sky, layer, margin = 0) {
  const cols = new Set();
  for (const b of sky.buildings) {
    if (b.layer !== layer) continue;
    const w = b.rows ? b.rows[0].length : b.w;
    for (let x = b.x - margin; x < b.x + w + margin; x++) cols.add(x);
  }
  return cols;
}

// Paint a skyline layer ('far' or 'near') on the scenery grid.
// `ground` is the ground row. Layers are painted separately so the filler city
// sits between them: behind nearby buildings and in front of distant ones.
export function paintSkyline(g, sky, ground, layer) {
  sky.buildings.forEach((b, i) => {
    if (b.layer === layer) paintBuilding(g, b, i, ground);
  });
}

function paintBuilding(g, b, i, ground) {
  const color = b.layer === 'far' ? '@city2' : '@city';
  if (b.rows) {
    // Free drawing: the last row touches the ground.
    const h = b.rows.length;
    b.rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== '.') g.set(b.x + c, ground - h + r, row[c] === 'w' ? '@cityWin' : color);
      }
    });
    return;
  }
  const top = ground - b.h;
  g.rect(b.x, top, b.w, b.h, color);
  if (b.windows) paintWindows(g, b.x, top, b.w, ground, 7000 + i * 131 + b.x);
  let blk = { x: b.x, w: b.w, top };
  for (const t of b.top) blk = paintTop(g, blk, t, color);
}
