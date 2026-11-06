// Special cars that join the train when the profile earns them (see unlocks.js):
//   dining       round windows and a roof lantern       (100-day streak)
//   observation  a raised glass canopy and panorama     (100+ stars)
//   mail         cargo door, envelope, stripe and vents (500+ pull requests)
// train.js paints the silhouette, gangway and outline, then hands the roof,
// side and details to paintSpecialCar before adding bogies and equipment boxes.
// Paint comes from the model palette and language stripe, except warm light,
// so a special car looks like it belongs to the train it joins.

import { mix } from '../graphics/colors.js';

export const SPECIAL_CARS = ['dining', 'observation', 'mail'];

// car: {
//   layers   the train's pixel layers: body, lit (windows that glow), ...
//   model    the train model; model.pal has the colors
//   stripe   the language color of the stripe
//   streak   the streak in days
//   panes    list for windows that light up with the streak: push { x, y, w, h }
//            in TRAIN coordinates (the lit layer is painted from it afterward).
//            Round windows paint masked light directly to keep their shape.
//   ox, top  train column of the car's left edge, and train row of its roof row
//   w        car width (MID_W, plus the tail nose when the car is the tail)
//   left     first column (car coordinates) inside the body, past the outline and gangway
// }
// Car coordinates: x counts from the car's left edge, y from the roof row (0), so
// y < 0 is above the roof (9 free rows) and y 18..19 is the skirt. The usual
// side is: rows 0-1 roof highlight, 2 roof, 3 roof edge, 4-10 upper body (the
// window rows), 11-17 bands, 18-19 skirt. Column w - 1 is the outline.
// Painters receive pal, put(layer, x, y, color) and rect(layer, x, y, w, h, color).
// Both helpers clip to the car's columns. Art stays at/after left, before the
// right outline and above row 18, leaving the gangway and running gear alone.
export function paintSpecialCar(kind, car) {
  const painters = { dining, observation, mail };
  const paint = painters[kind];
  if (!paint) throw new Error(`Unknown special car: "${kind}". Options: ${SPECIAL_CARS.join(', ')}`);
  // put() never leaves the car's own columns, so a car can't spoil its neighbours.
  const put = (layer, x, y, c) => {
    if (x >= 0 && x < car.w) car.layers[layer].set(car.ox + x, car.top + y, c);
  };
  const rect = (layer, x, y, w, h, c) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(layer, x + i, y + j, c);
  };
  paint({ ...car, put, rect, pal: car.model.pal });
}

function dining({ left, w, put, rect, pal, streak }) {
  // Seven-pixel portholes: the glass itself has clipped corners as well as the rim.
  const porthole = ['..ooo..', '.ogggo.', 'ogggggo', 'ogggggo', 'ogggggo', '.ogggo.', '..ooo..'];
  const start = left + 4;
  const step = Math.floor((w - 6 - start - 7) / 4);
  rect('body', left + 2, 3, w - left - 5, 1, pal.trim);
  for (let i = 0; i < 5; i++) {
    const x = start + i * step;
    porthole.forEach((row, y) => {
      for (let dx = 0; dx < row.length; dx++) {
        if (row[dx] === '.') continue;
        const glass = row[dx] === 'g';
        const highlight = (y === 1 && dx === 2) || (y === 2 && dx === 1);
        put('body', x + dx, 4 + y, glass ? (highlight ? pal.glassHi : pal.glass) : pal.outline);
        if (glass && streak > 0) {
          put('lit', x + dx, 4 + y, highlight ? '#fff4b0' : y === 5 ? '#f2d98d' : '#ffd86b');
        }
      }
    });
  }

  // A squat lantern with a metal cap and foot; its glow stays inside the frame.
  const lamp = start + 2 * step + 3;
  rect('body', lamp - 1, -4, 3, 1, pal.outline);
  rect('body', lamp - 2, -3, 5, 1, pal.outline);
  rect('body', lamp - 1, -3, 3, 1, pal.trim);
  rect('body', lamp - 2, -2, 5, 3, pal.outline);
  rect('body', lamp - 1, -2, 3, 3, pal.trim);
  rect('body', lamp - 2, 1, 5, 1, pal.outline);
  rect('lit', lamp - 1, -2, 3, 3, '#ffd86b');
  rect('lit', lamp, -2, 1, 2, '#fff4b0');
}

function observation({ left, w, put, rect, pal, panes, ox, top }) {
  const x = left + 2;
  const width = w - left - 5;
  // The stepped ends rise four rows; glass continues through the old roof line.
  rect('body', x + 4, -4, width - 8, 1, pal.outline);
  for (let y = -3; y <= 2; y++) {
    const inset = y === -3 ? 2 : y === -2 ? 1 : 0;
    rect('body', x + inset, y, width - 2 * inset, 1, pal.outline);
    rect('body', x + inset + 1, y, width - 2 * inset - 2, 1, y === -3 ? pal.glassHi : pal.glass);
  }
  rect('body', x, 3, width, 8, pal.outline);
  rect('body', x + 1, 4, width - 2, 6, pal.glass);

  // Three broad bays, with canopy ribs aligned to the side window mullions.
  for (let i = 0; i < 3; i++) {
    const a = x + Math.floor(i * (width - 1) / 3);
    const b = x + Math.floor((i + 1) * (width - 1) / 3);
    if (i > 0) rect('body', a, -3, 1, 13, pal.outline);
    rect('body', a + 4, -2, 5, 1, pal.glassHi);
    rect('body', a + 3, -1, 3, 1, pal.glassHi);
    put('body', a + 2, 0, pal.glassHi);
    rect('body', a + 2, 4, 5, 1, pal.glassHi);
    panes.push({ x: ox + a + 1, y: top + 5, w: b - a - 1, h: 5 });
  }
}

function mail({ left, w, put, rect, pal, stripe }) {
  // Low roof vents, with a single highlight along each metal cover.
  for (const x of [left + 6, left + 25, left + 44]) {
    rect('body', x, -1, 9, 1, pal.outline);
    rect('body', x, 0, 9, 2, pal.roofVent);
    rect('body', x + 1, 0, 7, 1, pal.roofHi);
    for (let dx = 2; dx < 8; dx += 2) put('body', x + dx, 1, pal.outline);
  }

  // A single sliding cargo door below its long runner, with recessed panels.
  const door = left + 22;
  const recess = mix(pal.door, pal.outline, 0.22);
  rect('body', door - 4, 3, 29, 1, pal.outline);
  rect('body', door - 3, 4, 27, 1, pal.roofVent);
  rect('body', door, 4, 20, 14, pal.outline);
  rect('body', door + 1, 5, 18, 12, pal.door);
  rect('body', door + 1, 5, 1, 12, pal.doorHi);
  rect('body', door + 3, 6, 13, 1, pal.doorHi);
  for (const y of [7, 10, 16]) rect('body', door + 3, y, 13, 1, recess);

  // The language stripe crosses the door; its jambs keep the sliding leaf legible.
  rect('body', left, 12, w - left - 2, 3, stripe);
  for (const x of [door, door + 19]) rect('body', x, 12, 1, 3, pal.outline);
  rect('body', door + 16, 8, 2, 4, pal.outline);
  rect('body', door + 17, 9, 1, 2, pal.trim);

  // A trim-colored envelope badge: solid paper and a dark folded flap, no glass.
  const badge = left + 5;
  rect('body', badge, 5, 11, 7, pal.outline);
  rect('body', badge + 1, 6, 9, 5, pal.trim);
  for (let i = 0; i < 5; i++) {
    const y = 6 + Math.min(i, 3);
    put('body', badge + 1 + i, y, pal.outline);
    put('body', badge + 9 - i, y, pal.outline);
  }
}
