import { line, polygon } from '../graphics/pixel-shapes.js';

/**
 * Estadio Jalisco: an exposed concrete frame with zigzag ramps, the flat white
 * roof ring overhanging it and small pyramidal trusses standing on the roof.
 * The ends of the oval recede, so façade and roof drop a little at each side.
 * @param {import('../graphics/pixel.js').Grid} g
 * @param {number} x left edge of the 58-pixel façade
 * @param {number} base ground row
 */
export function estadioJalisco(g, x, base) {
  const w = 58;
  const top = base - 15;
  const drop = (px) => {
    const edge = Math.min(px - x, x + w - 1 - px);
    return edge < 0 ? 3 : [3, 2, 1, 1][edge] ?? 0;
  };
  // Concrete floors and columns, with the dark openings of each bay between them.
  for (let px = x; px < x + w; px++) {
    const t = top + drop(px);
    const bay = (px - x) % 6;
    for (let y = t; y < base; y++) {
      const floor = (base - y) % 5;
      g.set(px, y, bay === 2 ? '@concreteLit' : bay > 2 && floor > 1 ? '@recess' : '@concrete');
    }
  }
  // Ramps climb the outside in zigzag, two flights between each floor.
  for (const rx of [x + 9, x + 39]) {
    for (let level = 0; level < 3; level++) {
      const y0 = base - 1 - 5 * level;
      const [from, to] = level % 2 ? [rx + 7, rx] : [rx, rx + 7];
      line(g, from, y0, to, y0 - 4, '@concreteLit');
    }
  }
  for (let px = x - 1; px <= x + w; px++) {
    const t = top + drop(px);
    g.set(px, t - 1, '@concrete');
    g.vline(px, t - 3, 2, '@roofWhite');
  }
  for (let px = x + 5; px < x + w - 4; px += 8) {
    const r = top - 4 + drop(px);
    line(g, px - 2, r, px, r - 3, '@steel');
    line(g, px, r - 3, px + 2, r, '@steel');
  }
}

/**
 * Hospicio Cabañas: a long balustraded front with end pavilions and a pedimented
 * portico. Behind it a central block rises from the roof and carries the tall
 * colonnaded drum, its ring of finials, the grey dome and the lantern.
 * @param {import('../graphics/pixel.js').Grid} g
 * @param {number} x left edge of the 60-pixel front
 * @param {number} base ground row
 */
export function hospicioCabanas(g, x, base) {
  const w = 60;
  const cx = x + 30;
  g.rect(cx - 10, base - 25, 21, 9, '@stone');
  g.rect(cx + 6, base - 25, 5, 9, '@stoneShade');
  g.hline(cx - 11, base - 26, 23, '@stoneLit');
  for (let px = cx - 11; px <= cx + 11; px += 2) g.set(px, base - 27, '@stoneLit');
  g.rect(cx - 7, base - 35, 15, 8, '@stone');
  g.rect(cx + 4, base - 35, 4, 8, '@stoneShade');
  for (const dx of [-5, -2, 2, 5]) g.vline(cx + dx, base - 33, 5, '@recess');
  for (const dx of [-6, -3, 0, 3, 6]) g.vline(cx + dx, base - 34, 7, '@stoneLit');
  // The drum's balustrade ring holds the corner urns, so none of them floats.
  g.hline(cx - 8, base - 36, 17, '@stoneLit');
  for (let px = cx - 8; px <= cx + 8; px += 2) g.set(px, base - 37, '@stoneLit');
  [7, 7, 6, 6, 5, 3].forEach((r, i) => {
    g.hline(cx - r, base - 38 - i, 2 * r + 1, '@slate');
    g.hline(cx - r, base - 38 - i, r, '@slateLit');
  });
  for (const dx of [-8, 8]) g.vline(cx + dx, base - 39, 2, '@stoneLit');
  g.rect(cx - 2, base - 47, 5, 4, '@stone');
  for (const dx of [-1, 1]) g.set(cx + dx, base - 46, '@recess');
  g.hline(cx - 2, base - 48, 5, '@stoneLit');
  g.hline(cx - 1, base - 49, 3, '@slate');
  g.vline(cx, base - 52, 3, '@recess');

  g.rect(x, base - 15, w, 15, '@stone');
  g.rect(x + w - 6, base - 15, 6, 15, '@stoneShade');
  for (const px of [x, x + w - 8]) {
    g.rect(px, base - 18, 8, 3, px > x ? '@stoneShade' : '@stone');
    g.hline(px - 1, base - 19, 10, '@stoneLit');
  }
  g.hline(x + 8, base - 16, w - 16, '@stoneLit');
  for (let px = x + 8; px < x + w - 8; px += 2) g.set(px, base - 17, '@stoneLit');
  for (let px = x + 10; px < x + w - 8; px += 10) g.vline(px, base - 19, 2, '@stoneLit');
  for (let dx = 3; dx < w - 3; dx += 6) {
    if (dx > 16 && dx < 44) continue;
    g.rect(x + dx, base - 12, 2, 7, '@recess');
    g.vline(x + dx, base - 11, 5, '@glassWarm');
  }
  polygon(g, [[cx-12,base-17],[cx,base-23],[cx+12,base-17]], '@stoneLit');
  polygon(g, [[cx-7,base-18],[cx,base-21],[cx+7,base-18]], '@stone');
  g.rect(cx - 11, base - 17, 23, 2, '@stoneLit');
  g.rect(cx - 10, base - 15, 21, 15, '@stoneShade');
  for (const dx of [-10, -6, -2, 1, 5, 9]) g.rect(cx + dx, base - 15, 2, 15, '@stoneLit');
  g.rect(cx - 1, base - 9, 2, 9, '@recess');
}

/**
 * La Minerva on her pedestal in the roundabout fountain, spear and shield in hand.
 * @param {import('../graphics/pixel.js').Grid} g
 * @param {number} cx statue axis
 * @param {number} base ground row
 */
export function laMinerva(g, cx, base) {
  for (const dx of [-11, -8, 8, 11]) {
    g.vline(cx + dx, base - 8, 3, '@water');
    g.set(cx + dx, base - 9, '@waterLit');
  }
  g.hline(cx - 14, base - 5, 29, '@stoneLit');
  g.rect(cx - 13, base - 4, 27, 4, '@stoneShade');
  g.hline(cx - 12, base - 4, 25, '@water');
  g.rect(cx - 6, base - 8, 13, 3, '@stone');
  g.rect(cx - 5, base - 10, 11, 2, '@stoneLit');
  g.rect(cx - 3, base - 24, 7, 14, '@stone');
  g.rect(cx + 2, base - 24, 2, 14, '@stoneShade');
  g.hline(cx - 2, base - 18, 4, '@recess');
  g.rect(cx - 4, base - 26, 9, 2, '@stoneLit');
  // The goddess: robe, helmeted head, shield at her side and the upright spear.
  g.hline(cx - 2, base - 27, 5, '@bronze');
  g.rect(cx - 1, base - 34, 3, 7, '@bronze');
  g.vline(cx - 1, base - 34, 7, '@bronzeLit');
  g.rect(cx - 1, base - 37, 3, 3, '@bronze');
  g.set(cx - 1, base - 36, '@bronzeLit');
  g.hline(cx - 1, base - 38, 2, '@bronzeLit');
  polygon(g, [[cx-4,base-32],[cx-2,base-33],[cx-2,base-28],[cx-4,base-29]], '@bronzeLit');
  g.set(cx + 2, base - 33, '@bronze');
  g.vline(cx + 3, base - 41, 15, '@bronzeLit');
}
