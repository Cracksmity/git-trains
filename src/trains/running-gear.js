// trains/running-gear.js: focused running-gear operations.

import { TOP } from './geometry.js';
import { underColors } from './palette.js';

// Bogie viewed from the side (rows 18..24: wheels protrude below the skirt), centered on
// its axle. Two 7 px disc wheels joined by the frame, which passes IN FRONT
// of them and ends at the axle boxes on each axle.
// Light from above, as on the body.
//   o tire (outline)  v/w disc (light/shadow)  F/f frame  x/X axle box
const BOGIE = [
  '...ooo...........ooo...',
  '..ovvvo.........ovvvo..',
  '.ovvvvvFFFFFFFFFvvvvvo.',
  '.owxxxfffffffffffxxxwo.',
  '.owXXXwo..fff..owXXXwo.',
  '..owwwo.........owwwo..',
  '...ooo...........ooo...',
];

export const BOGIE_HALF = 11;

export const BOGIE_IN = 13;

// from the car end to the bogie center
// Disc marks: three at 120? rotating 60? between frames (those that fall
// under the frame are not visible).
const WHEEL_MARKS = {
  wa: [[0, -2], [-2, 1], [2, 1]],
  wb: [[0, 2], [-2, -1], [2, -1]],
};

const TYRE = { hi: '#2a2a30', lo: '#141417', mark: '#4a4a52', hub: '#a3a6ad', hubLo: '#7c7f87' };

// Bogie centered at column bx (train coordinates).
export function drawBogie(ctx, bx) {
  const { layers: L, model } = ctx;
  const U = underColors(model.pal);
  // Rubber-tired running gear: black rubber tires with exposed metal hubs,
  // instead of steel wheels with axle boxes.
  const wheel = model.tyres ? TYRE : { hi: U.discHi, lo: U.disc, mark: U.mark, hub: U.axle, hubLo: U.axleLo };
  const colors = {
    o: model.pal.outline,
    v: wheel.hi,
    w: wheel.lo,
    F: U.frameHi,
    f: U.frame,
    x: wheel.hub,
    X: wheel.hubLo,
  };
  BOGIE.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== '.') L.body.set(bx - BOGIE_HALF + c, TOP + 18 + r, colors[row[c]]);
    }
  });
  for (const cx of [bx - 7, bx + 7]) {
    for (const [layer, pts] of Object.entries(WHEEL_MARKS)) {
      for (const [dx, dy] of pts) L[layer].set(cx + dx, TOP + 21 + dy, wheel.mark);
    }
  }
}
