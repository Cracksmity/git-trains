import { line, polygon } from '../graphics/pixel-shapes.js';

/**
 * A round-headed opening: its two top corners are left out.
 * @param {import('../graphics/pixel.js').Grid} g
 * @param {number} x @param {number} y @param {number} w @param {number} h @param {string} color
 */
export function arch(g, x, y, w, h, color) {
  g.rect(x + 1, y, w - 2, h, color);
  g.rect(x, y + 2, w, h - 2, color);
}

// A cathedral tower: shaft flush with the façade, a stage of bells, a stage of
// oval windows ringed by pinnacles, and the yellow tiled needle with blue ribs.
function spireTower(g, cx, b) {
  g.rect(cx - 6, b - 44, 13, 44, '@stone');
  g.rect(cx + 3, b - 44, 4, 44, '@stoneShade');
  for (const y of [b - 26, b - 37, b - 45]) g.rect(cx - 7, y, 15, 2, '@stoneLit');
  for (const ax of [cx - 4, cx + 1]) {
    arch(g, ax, b - 35, 3, 8, '@recess');
    g.set(ax + 1, b - 32, '@ochreLit');
  }
  for (const ax of [cx - 3, cx + 2]) {
    g.rect(ax, b - 42, 2, 4, '@recess');
    g.set(ax, b - 42, '@stone');
  }
  for (const px of [cx - 6, cx + 6]) {
    g.vline(px, b - 50, 5, '@ochreLit');
    g.set(px, b - 51, '@tileBlue');
  }
  polygon(g, [[cx-4,b-45],[cx,b-74],[cx+4,b-45]], '@ochre');
  polygon(g, [[cx-4,b-45],[cx,b-74],[cx,b-45]], '@ochreLit');
  line(g, cx - 4, b - 46, cx, b - 73, '@tileBlue');
  line(g, cx + 4, b - 46, cx, b - 73, '@tileBlue');
  g.vline(cx, b - 78, 5, '@recess');
  g.hline(cx - 1, b - 77, 3, '@recess');
}

/**
 * Guadalajara Cathedral from the plaza: three portals, two round windows and the
 * curved gable with its relief between the towers, a small clock tower behind.
 * @param {import('../graphics/pixel.js').Grid} g
 * @param {number} cx façade axis
 * @param {number} b ground row
 */
export function cathedral(g, cx, b) {
  g.rect(cx - 2, b - 40, 5, 8, '@stoneShade');
  g.set(cx, b - 37, '@ochreLit');
  g.vline(cx, b - 43, 3, '@recess');
  for (let px = cx - 17; px <= cx + 17; px++) {
    const top = b - 24 - Math.round(9 * Math.sqrt(1 - ((px - cx) / 18) ** 2));
    g.vline(px, top, b - top, px > cx + 11 ? '@stoneShade' : '@stone');
    g.set(px, top, '@stoneLit');
  }
  g.hline(cx - 17, b - 25, 35, '@stoneLit');
  g.rect(cx - 3, b - 31, 7, 3, '@stoneLit');
  for (const dx of [-2, 0, 2]) g.set(cx + dx, b - 30, '@stone');
  for (const dx of [-16, -6, 6, 16]) g.vline(cx + dx, b - 24, 24, '@stoneLit');
  for (const dx of [-11, 11]) {
    g.rect(cx + dx - 2, b - 20, 4, 4, '@recess');
    for (const [ox, oy] of [[-2, -20], [1, -20], [-2, -17], [1, -17]]) g.set(cx + dx + ox, b + oy, '@stone');
    arch(g, cx + dx - 2, b - 11, 5, 11, '@recess');
    g.hline(cx + dx - 3, b - 13, 7, '@stoneLit');
  }
  g.rect(cx - 2, b - 22, 5, 6, '@stoneShade');
  for (const dx of [-1, 1]) g.vline(cx + dx, b - 21, 3, '@stoneLit');
  arch(g, cx - 4, b - 14, 9, 14, '@stoneLit');
  arch(g, cx - 3, b - 12, 7, 12, '@recess');
  g.vline(cx, b - 9, 8, '@glassWarm');
  spireTower(g, cx - 24, b);
  spireTower(g, cx + 24, b);
}

/**
 * The Sagrario, joined to the Cathedral's right tower. The lower storey carries
 * the pedimented portico; the balustraded upper storey carries the colonnaded
 * drum, its balustrade ring, the ribbed terracotta dome and the lantern, so
 * every part rests on the one below. Paint it before the Cathedral, so the
 * tower covers the joint.
 * @param {import('../graphics/pixel.js').Grid} g
 * @param {number} x left edge of the 40-pixel body, whose first columns hide behind the tower
 * @param {number} b ground row
 */
export function sagrario(g, x, b) {
  const w = 40;
  const cx = x + 23;
  const dc = cx - 2;
  g.rect(x, b - 26, w - 2, 8, '@stone');
  g.rect(x + w - 8, b - 26, 6, 8, '@stoneShade');
  g.hline(x, b - 27, w - 2, '@stoneLit');
  for (let px = x; px < x + w - 2; px += 2) g.set(px, b - 28, '@stoneLit');
  for (const px of [x + 6, x + w - 4]) g.vline(px, b - 30, 2, '@stoneLit');

  g.rect(dc - 7, b - 36, 15, 9, '@stone');
  g.rect(dc + 4, b - 36, 4, 9, '@stoneShade');
  for (const dx of [-5, -2, 2, 5]) g.vline(dc + dx, b - 34, 5, '@recess');
  for (const dx of [-6, -3, 0, 3, 6]) g.vline(dc + dx, b - 35, 7, '@stoneLit');
  g.hline(dc - 8, b - 37, 17, '@stoneLit');
  for (let px = dc - 8; px <= dc + 8; px += 2) g.set(px, b - 38, '@stoneLit');
  [7, 7, 6, 6, 5, 4, 2].forEach((r, i) => {
    const y = b - 39 - i;
    g.hline(dc - r, y, 2 * r + 1, '@tile');
    for (const f of [-0.6, 0, 0.6]) g.set(dc + Math.round(f * r), y, '@tileLit');
  });
  for (const dx of [-8, 8]) g.vline(dc + dx, b - 40, 2, '@stoneLit');
  g.rect(dc - 1, b - 49, 3, 4, '@stoneLit');
  g.set(dc, b - 48, '@recess');
  g.hline(dc - 1, b - 50, 3, '@tile');
  g.vline(dc, b - 54, 4, '@recess');
  g.hline(dc - 1, b - 53, 3, '@recess');

  g.rect(x, b - 18, w, 18, '@stone');
  g.rect(x + w - 6, b - 18, 6, 18, '@stoneShade');
  g.hline(x - 1, b - 19, w + 1, '@stoneLit');
  for (const px of [x + 7, x + w - 4]) {
    g.rect(px, b - 14, 2, 6, '@recess');
    g.vline(px, b - 13, 4, '@glassWarm');
  }
  polygon(g, [[cx-11,b-19],[cx,b-25],[cx+11,b-19]], '@stoneLit');
  polygon(g, [[cx-7,b-20],[cx,b-23],[cx+7,b-20]], '@stoneShade');
  g.rect(cx - 10, b - 19, 21, 2, '@stoneLit');
  g.rect(cx - 9, b - 17, 19, 17, '@stoneShade');
  for (const dx of [-9, -5, 4, 8]) g.rect(cx + dx, b - 17, 2, 17, '@stoneLit');
  g.rect(cx - 2, b - 9, 4, 9, '@recess');
  g.vline(cx - 1, b - 7, 6, '@glassWarm');
}

/**
 * Teatro Degollado: eight columns before lit doors, the inscribed frieze, the
 * tympanum full of Apollo and the muses, and balustraded wings at the corners.
 * @param {import('../graphics/pixel.js').Grid} g
 * @param {number} x left edge of the 50-pixel portico
 * @param {number} b ground row
 */
export function teatroDegollado(g, x, b) {
  g.rect(x - 4, b - 27, 58, 27, '@stone');
  g.rect(x + 48, b - 27, 6, 27, '@stoneShade');
  g.hline(x - 4, b - 28, 58, '@stoneLit');
  for (let px = x - 4; px < x + 54; px += 2) g.set(px, b - 29, '@stoneLit');
  for (const px of [x - 4, x + 53]) {
    g.vline(px, b - 31, 3, '@stoneLit');
    g.rect(px + (px < x ? 1 : -2), b - 18, 2, 6, '@recess');
  }
  g.rect(x, b - 21, 50, 18, '@stoneShade');
  for (let i = 0; i < 7; i++) {
    const gx = x + 5 + 6 * i;
    g.rect(gx, b - 18, 3, 3, '@recess');
    g.rect(gx, b - 12, 3, 8, '@recess');
    g.vline(gx + 1, b - 11, 7, '@glassWarm');
  }
  for (let i = 0; i < 8; i++) {
    const px = x + 2 + 6 * i;
    g.rect(px, b - 19, 3, 15, '@stone');
    g.vline(px, b - 19, 15, '@stoneLit');
    g.vline(px + 2, b - 19, 15, '@stoneShade');
    g.hline(px - 1, b - 20, 5, '@stoneLit');
    g.hline(px - 1, b - 4, 5, '@stoneLit');
  }
  g.rect(x - 1, b - 23, 52, 3, '@stoneLit');
  for (let px = x + 5; px < x + 45; px += 2) g.set(px, b - 22, '@recess');
  polygon(g, [[x-3,b-24],[x+24,b-35],[x+25,b-35],[x+52,b-24]], '@stoneLit');
  polygon(g, [[x+3,b-25],[x+24,b-33],[x+25,b-33],[x+46,b-25]], '@stone');
  // Apollo stands at the centre; the muses gather in uneven groups, seated or
  // standing, and the outermost figures recline into the corners.
  g.rect(x + 24, b - 32, 2, 7, '@stoneLit');
  g.set(x + 23, b - 30, '@stoneLit');
  g.set(x + 26, b - 30, '@stoneLit');
  for (const [d, h] of [[3, 5], [4, 3], [7, 4], [9, 5], [10, 3], [13, 3], [15, 2]]) {
    const top = Math.max(b - 26 - h, b - 32 + Math.ceil(d * 8 / 21));
    for (const px of [x + 24 - d, x + 25 + d]) g.vline(px, top, b - 25 - top, '@stoneLit');
  }
  g.hline(x + 5, b - 26, 4, '@stoneLit');
  g.hline(x + 41, b - 26, 4, '@stoneLit');
  g.hline(x - 2, b - 3, 54, '@stoneLit');
  g.hline(x - 3, b - 2, 56, '@stone');
}
