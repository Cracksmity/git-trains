import { Grid } from '../graphics/pixel.js';

/** @import { WeatherLayer } from '../scene/weather.js' */

const leaf = (ink) => ink === '@foliage' || ink === '@foliageLit';
const furniture = (ink) => ink === '@mast' || ink === '@wire' || ink?.startsWith('#');

// The crowns move right by one pixel while their trunks stay rooted. Fill the
// exposed left edge from the adjacent backdrop. Signs and poles stay in front.
function treeCrowns(still, sway, backdrop, top, frosted) {
  for (let y = 0; y < sway.h; y++) {
    for (let x = 0; x < sway.w; x++) {
      const row = top + y;
      const ink = backdrop.get(x, row);
      if (!leaf(ink) || furniture(backdrop.get(x + 1, row))) continue;
      const left = backdrop.get(x - 1, row);
      if (!leaf(left)) {
        const background = furniture(left) ? backdrop.get(x, row - 1) : left;
        still.set(x, y, background);
      }
      sway.set(x, y, frosted && ink === '@foliageLit' ? '@wFrost' : ink);
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

/** Wind in the landscape of one Jalisco track. @returns {WeatherLayer[]} */
export function jaliscoWind(band, backdrop, state) {
  const top = band.base - 32;
  const still = new Grid(backdrop.w, band.base - top);
  const sway = new Grid(still.w, still.h);
  if (band.k === 2) {
    for (const x of [72, 329]) pirul(still, sway, x, band.base - 22 - top);
  } else {
    treeCrowns(still, sway, backdrop, top, band.k === 0 && state === 'frost');
    if (band.k === 1) parcelDust(sway, backdrop, top, band.base);
  }
  return [
    { grid: still, z: 'ground', y: top },
    { grid: sway, z: 'ground', y: top, sway: true },
  ];
}
