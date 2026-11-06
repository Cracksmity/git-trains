// graphics/colors.js: focused colors operations.



// Blend two #rrggbb colors (t = 0 returns a, t = 1 returns b).
/** @param {string} a @param {string} b @param {number} t @returns {string} */
export function mix(a, b, t) {
  const ca = parseInt(a.slice(1), 16);
  const cb = parseInt(b.slice(1), 16);
  let out = '#';
  for (const s of [16, 8, 0]) {
    const v = Math.round(((ca >> s) & 255) * (1 - t) + ((cb >> s) & 255) * t);
    out += v.toString(16).padStart(2, '0');
  }
  return out;
}
