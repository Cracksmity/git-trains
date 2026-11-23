import { Grid } from '../graphics/pixel.js';

/** @import { WeatherLayer } from '../scene/weather.js' */

const leaf = (ink) => ink === '@foliage' || ink === '@foliageLit';
const furniture = (ink) => ink === '@mast' || ink === '@wire' || ink?.startsWith('#');

// The crowns move right by one pixel while their trunks stay rooted. Fill the
// exposed left edge from the adjacent backdrop. Signs and poles stay in front.
// Frost or snow painted on the ground grid (cover) moves with the crown it rests
// on, and the edge the crown exposes shows the painted ground too.
function treeCrowns(still, sway, backdrop, top, cover) {
  const seen = (x, row) => cover?.get(x, row) ?? backdrop.get(x, row);
  for (let y = 0; y < sway.h; y++) {
    for (let x = 0; x < sway.w; x++) {
      const row = top + y;
      const ink = backdrop.get(x, row);
      if (!leaf(ink) || furniture(backdrop.get(x + 1, row))) continue;
      const left = backdrop.get(x - 1, row);
      if (!leaf(left)) still.set(x, y, furniture(left) ? seen(x, row - 1) : seen(x - 1, row));
      sway.set(x, y, seen(x, row));
    }
  }
}

// Two piruls at the far edge of the agave field, with drooping sprays.
function pirul(still, sway, x, ground) {
  still.vline(x, ground - 5, 6, '@recess');
  sway.hline(x - 2, ground - 8, 4, '@foliageLit');
  sway.hline(x - 4, ground - 7, 8, '@foliage');
  sway.hline(x - 3, ground - 6, 9, '@foliage');
  for (const [dx, length] of [[-3, 2], [-1, 3], [2, 2], [5, 3]]) {
    sway.vline(x + dx, ground - 5, length, '@foliage');
  }
}

// Lift a broken red streak from the top of each exposed parcel. The wall at
// the foot of the hill uses the same earth inks, so stop well above it.
function parcelDust(sway, backdrop, top, base) {
  for (const x of [50, 113, 154, 245, 375]) {
    for (let row = base - 20; row <= base - 10; row++) {
      const ink = backdrop.get(x, row);
      if (ink !== '@earth' && ink !== '@earthLit') continue;
      const y = row - top;
      sway.hline(x, y - 1, 2, '@earthLit');
      sway.hline(x + 2, y - 2, 3 + x % 3, '@wDust');
      sway.hline(x + 8, y - 3, 2, '@wDust');
      break;
    }
  }
}

// Tolvaneras lift leaning dust plumes from the exposed crust (thick at the foot,
// thinning as they rise). Clip to the open lake so birds, reeds and town stay in front.
function saltDust(sway, backdrop, top, base) {
  const lake = new Set(['@salt', '@saltSeam', '@laguna', '@lakeGlint']);
  const tall = [[0, 6], [2, 7], [5, 6], [9, 5], [13, 4], [17, 2]];
  const low = [[0, 5], [2, 6], [5, 5], [9, 3], [13, 2]];
  for (const { x, shape } of [
    { x: 48, shape: tall }, { x: 108, shape: low }, { x: 166, shape: tall }, { x: 224, shape: low },
    { x: 262, shape: tall }, { x: 285, shape: low }, { x: 302, shape: tall },
  ]) {
    let row = base - 1;
    while (row > base - 12 && backdrop.get(x, row) !== '@salt') row--;
    if (backdrop.get(x, row) !== '@salt') continue;
    shape.forEach(([shift, width], dy) => {
      const y = row - dy;
      for (let i = 0; i < width; i++) {
        const px = x + shift + i;
        if (dy >= 3 && i === 2) continue;
        if (lake.has(backdrop.get(px, y))) sway.set(px, y - top, '@saltDust');
      }
    });
  }
}

/**
 * Wind in the landscape of one Jalisco track.
 * @param {string} place
 * @param {{ base: number }} band
 * @param {Grid} backdrop
 * @param {string} state
 * @param {Grid | null} [cover] the place's painted ground, when frost or snow rests on the crowns
 * @returns {WeatherLayer[]}
 */
export function jaliscoWind(place, band, backdrop, state, cover = null) {
  const top = band.base - 32;
  const still = new Grid(backdrop.w, band.base - top);
  const sway = new Grid(still.w, still.h);
  if (place === 'tequila') {
    for (const x of [72, 329]) pirul(still, sway, x, band.base - 22 - top);
  } else {
    treeCrowns(still, sway, backdrop, top, cover);
    // Snow covers the parcels: no dust to lift.
    if (place === 'altos' && state !== 'snow') parcelDust(sway, backdrop, top, band.base);
    if (place === 'sayula' && state !== 'snow') saltDust(sway, backdrop, top, band.base);
  }
  return [
    { grid: still, z: 'ground', y: top },
    { grid: sway, z: 'ground', y: top, sway: true },
  ];
}
