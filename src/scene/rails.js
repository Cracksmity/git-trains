// scene/rails.js: focused rails operations.

import { GY0, PITCH, BALLAST } from './layout.js';

// Tracks: rail, ballast, and sleepers (thick dashed line, one element per track).
// Trains without a pantograph also have a third rail (or guide bar) on
// insulators. Rendered as separate SVG, beneath the rest of the scenery.
export function railsLayer(W, tracks, used) {
  let out = '';
  tracks.forEach((t, k) => {
    const gy = GY0 + PITCH * k;
    used.add('rail').add('railDark').add('ballast');
    out += `<rect class="c-rail" y="${gy}" width="${W}" height="1"/>`;
    out += `<rect class="c-railDark" y="${gy + 1}" width="${W}" height="1"/>`;
    out += `<rect class="c-ballast" y="${gy + 2}" width="${W}" height="${BALLAST - 2}"/>`;
    out += `<path class="s-sleeper" stroke-width="4" stroke-dasharray="5 3" d="M0 ${gy + 4}H${W}"/>`;
    if (!t.overhead) {
      let posts = '';
      for (let x = 4; x < W; x += 16) posts += `M${x} ${gy + 5}h1v2h-1z`;
      out += `<rect class="c-rail" y="${gy + 3}" width="${W}" height="1"/>`;
      out += `<path class="c-railDark" d="M0 ${gy + 4}h${W}v1h-${W}z${posts}"/>`;
    }
  });
  return out;
}

// The same tracks on a pixel grid (for scripts/export.js).
export function paintRails(g, tracks) {
  tracks.forEach((t, k) => {
    const gy = GY0 + PITCH * k;
    g.hline(0, gy, g.w, '@rail');
    g.hline(0, gy + 1, g.w, '@railDark');
    g.rect(0, gy + 2, g.w, BALLAST - 2, '@ballast');
    for (let x = 0; x < g.w; x++) if (x % 8 < 5) g.vline(x, gy + 2, 4, '@sleeper');
    if (!t.overhead) {
      g.hline(0, gy + 3, g.w, '@rail');
      g.hline(0, gy + 4, g.w, '@railDark');
      for (let x = 4; x < g.w; x += 16) g.vline(x, gy + 5, 2, '@railDark');
    }
  });
}
