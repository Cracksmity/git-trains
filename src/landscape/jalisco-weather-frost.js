// Morning frost over Jalisco: rime on Guadalajara's plaza trees, Los Altos's
// hills, ranch roofs and dry-stone wall, and the tips of Tequila's agave.

const SKY = ['@dusk', '@haze', '@afterglow', '@starlight'];
const GRASSLAND_ABOVE = new Set([...SKY, '@ridge']);
const PASTURE_ABOVE = new Set([...GRASSLAND_ABOVE, '@grassland', '@earth', '@earthLit']);
const ROOF_ABOVE = new Set([...PASTURE_ABOVE, '@pasture']);
const TILE = new Set(['@tile', '@tileLit']);
const EARTH = new Set(['@earth', '@earthLit']);
const AGAVE = new Set(['@agave', '@agaveLit', '@agaveFar', '@agaveShade']);
const AGAVE_BODY = new Set(['@agave', '@agaveLit', '@agaveFar']);

/** Guadalajara: frost only on the top edge of the plaza trees. */
export function cityFrost(g, band, backdrop) {
  for (let y = band.top; y < band.base; y++) {
    for (let x = 0; x < g.w; x++) {
      if (backdrop.get(x, y) === '@foliageLit') g.set(x, y, '@wFrost');
    }
  }
}

/**
 * Los Altos: pale blue-white frost on the top pixel of the grassland and pasture
 * ridges and the ranch roofs, plus a thin white line along the dry-stone wall.
 */
export function altosFrost(g, band, backdrop) {
  for (let y = band.top + 1; y < band.base; y++) {
    for (let x = 0; x < g.w; x++) {
      const ink = backdrop.get(x, y);
      const above = backdrop.get(x, y - 1);
      if (ink === '@grassland' && GRASSLAND_ABOVE.has(above)) {
        g.set(x, y, '@wFrost');
      } else if (ink === '@pasture' && PASTURE_ABOVE.has(above)) {
        g.set(x, y, '@wFrost');
      } else if (
        TILE.has(ink) &&
        ROOF_ABOVE.has(above) &&
        TILE.has(backdrop.get(x, y + 1)) &&
        (TILE.has(backdrop.get(x - 1, y + 1)) || TILE.has(backdrop.get(x + 1, y + 1)))
      ) {
        g.set(x, y, '@wFrost');
      }
    }
  }
  // Scan upward from the earth strip along the track so buildings behind the wall never fool it.
  for (let x = 0; x < g.w; x++) {
    let y = band.base - 1;
    if (!EARTH.has(backdrop.get(x, y))) continue;
    while (y >= band.top && EARTH.has(backdrop.get(x, y))) y--;
    const top = y - 3;
    if (top >= band.top && backdrop.get(x, top) === '@stone') g.set(x, top, '@wFrostLine');
  }
}

/** Tequila: frost on the exposed tips of the agave leaves. */
export function tequilaFrost(g, band, backdrop) {
  for (let y = band.top; y < band.base; y++) {
    for (let x = 0; x < g.w; x++) {
      if (backdrop.get(x, y) !== '@agaveLit') continue;
      if (AGAVE_BODY.has(backdrop.get(x, y - 1))) continue;
      if (AGAVE.has(backdrop.get(x - 1, y)) || AGAVE.has(backdrop.get(x + 1, y))) continue;
      g.set(x, y, '@wFrost');
    }
  }
}
