// scene/backdrop.js: focused backdrop operations.

import { Grid, rng } from '../graphics/pixel.js';
import { TRAIN_H } from '../trains/geometry.js';
import { drawText, textWidth, clean } from '../graphics/font.js';
import { paintSkyline, skylineColumns } from '../landscape/skyline-render.js';
import { applyRegionTheme, regionParts, paintSprite, regionRng, pickOne } from '../landscape/region-render.js';
import { GY0, PITCH } from './layout.js';
import { THEMES } from './themes.js';
import { bush, paintBandFront } from './terrain.js';

// Signal: red if there was no activity yesterday, amber if low, green if normal or high.
function signal(g, x, gy, state) {
  const on = state === 'idle' ? 0 : state === 'slow' ? 1 : 2;
  const lights = [['#ff4a3d', '#3b1f20'], ['#ffb02e', '#3b3020'], ['#4dff7c', '#16372a']];
  g.rect(x + 1, gy - 19, 2, 19, '@mast');
  g.rect(x, gy - 32, 5, 13, '#1b1d24');
  lights.forEach(([lit, dim], i) => g.rect(x + 1, gy - 31 + i * 4, 3, 3, i === on ? lit : dim));
}

// --- Main scenery -----------------------------------------------------

// Random city in two layers (the usual background): the distant one in `far` and the
// near one, with windows, in `near` (they can be the same grid).
function randomCity(far, near, W, rand) {
  for (const [g, color, minH, maxH, win] of [[far, '@city2', 16, 44, false], [near, '@city', 8, 26, true]]) {
    let x = -4;
    while (x < W) {
      const w = 8 + Math.floor(rand() * 14);
      const h = minH + Math.floor(rand() * (maxH - minH));
      g.rect(x, GY0 - h, w, h, color);
      if (win) {
        for (let wy = GY0 - h + 3; wy < GY0 - 3; wy += 4) {
          for (let wx = x + 2; wx < x + w - 2; wx += 3) if (rand() < 0.35) g.set(wx, wy, '@cityWin');
        }
      }
      x += w + Math.floor(rand() * 3);
    }
  }
}

// Each user gets their own procedural city (and bushes, villages, ballast): the
// random numbers are seeded with the username, so it stays the same every day.
export function seedFor(user) {
  const name = String(user ?? '').trim().toLowerCase();
  if (!name) return 20261102;
  let h = 0x811c9dc5; // FNV-1a
  for (const ch of name) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193) >>> 0;
  return h;
}

// skyline: the skyline already validated (see skyline.js) or null for the procedural city.
// seed: what the random numbers are seeded with; the user's name unless the scene says otherwise
// (repo mode seeds with the full name, owner/name, while the sign shows the repository name).
export function paintBackdrop(W, H, tracks, user, skyline = null, seed = user) {
  const g = new Grid(W, H);
  const rand = rng(seedFor(seed));
  // The region's countryside (see region.js). Its colors join THEMES for this scene only.
  const region = skyline?.region ? regionParts(skyline.region) : null;
  applyRegionTheme(THEMES, region);
  const pick = region ? regionRng(seedFor(seed)) : null;

  // City. With a custom skyline the random city is still calculated, on separate
  // grids, so it consumes the same random numbers and the rest of the scenery
  // (bushes, ballast, villages) does not change. With `fill` only its near layer
  // (low buildings with windows) is used as filler: in front of distant buildings,
  // behind nearby ones and without touching their columns.
  if (!skyline) randomCity(g, g, W, rand);
  else {
    const scratch = new Grid(W, H);
    const filler = skyline.fill ? new Grid(W, H) : scratch;
    randomCity(scratch, filler, W, rand);
    paintSkyline(g, skyline, GY0, 'far');
    if (skyline.fill) {
      const busy = skylineColumns(skyline, 'near', 2);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const c = filler.get(x, y);
          if (c && !busy.has(x)) g.set(x, y, c);
        }
      }
    }
    paintSkyline(g, skyline, GY0, 'near');
  }

  // Slope with bushes in front of the city.
  g.rect(0, GY0 - 3, W, 3, '@hill');
  for (let x = 2; x < W; x += 5 + Math.floor(rand() * 9)) {
    const w = 4 + Math.floor(rand() * 5);
    const h = 3 + Math.floor(rand() * 3);
    const color = rand() < 0.5 ? '@tree' : '@tree2';
    if (region?.plants.length && pick() < 0.5) {
      paintSprite(g, pickOne(region.plants, pick), x + (w >> 1), GY0 - 2, { flip: pick() < 0.5 });
    } else {
      bush(g, x, GY0 - 2, w, h, color);
    }
  }

  tracks.forEach((t, k) => {
    const gy = GY0 + PITCH * k;
    if (k > 0) paintBandFront(g, W, gy - 1, k, rand, region, pick);

    // Ballast specks (ballast and sleepers are in railsLayer).
    for (let x = 0; x < W; x++) {
      if (rand() < 0.08) g.set(x, gy + 6 + Math.floor(rand() * 5), '@ballast2');
    }

    // Signal in front of the train according to its direction of travel.
    signal(g, t.dir === -1 ? 8 : W - 17, gy, t.state);

    // Overhead wires, only if the train on this track has a pantograph.
    if (t.overhead) {
      const wireY = gy - TRAIN_H;
      g.hline(0, wireY, W, '@wire');
      for (let x = 30; x < W; x += 96) {
        g.rect(x, wireY - 8, 2, gy - (wireY - 8), '@mast');
        g.hline(x + 2, wireY - 6, 10, '@mast');
        g.vline(x + 11, wireY - 6, 6, '@mast');
      }
    }
  });

  // Station sign with the user.
  const name = clean(user).replace(/ /g, '').slice(0, 16);
  if (name) {
    const tw = textWidth(name);
    const pw = tw + 8;
    g.rect(24, 24, 2, GY0 - 24, '@mast');
    g.rect(14, 10, pw, 13, '#e9f3ee');
    g.rect(15, 11, pw - 2, 11, '#1f7a56');
    drawText(g, name, 14 + 4, 14, '#ffffff');
  }

  // Legend on the ballast.
  tracks.forEach((t, k) => {
    if (!t.caption) return;
    const gy = GY0 + PITCH * k;
    const tw = textWidth(t.caption);
    if (!tw) return;
    g.rect(4, gy + 4, tw + 5, 7, '@capbg');
    drawText(g, t.caption, 6, gy + 5, '@text');
  });

  return g;
}
