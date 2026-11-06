// trains/render.js: focused render operations.

import { Grid } from '../graphics/pixel.js';
import { drawText, textWidth } from '../graphics/font.js';
import { SPECIAL_CARS, paintSpecialCar } from './special-cars.js';
import { TOP, BODY_ROWS, TRAIN_H, MID_W, LED_W, MAX_CARS, COUPLER, layoutOf, clamp, cabWidth, trainWidth } from './geometry.js';
import { LED_ON, NOSE_DARK, partColor, rowColor, underColors } from './palette.js';
import { BOGIE_HALF, BOGIE_IN, drawBogie } from './running-gear.js';
import { drawLoco } from './locomotive.js';

// The tail nose is the same mirrored template; its lights are red.
const TAIL_LIGHT = { l: 'r', y: 'r', q: 'r' };

const TAIL_LAMP = '#ff4a4a';

const LED_X = 3;

const DOOR_Y0 = 3;

const DOOR_H = 15;

const INTERIOR = '#f2d98d';

const INTERIOR_FLOOR = '#b9a064';

const LED_BG = '#0a0a10';

const PANTOGRAPH = [
  '..#####..',
  '....#....',
  '...#.#...',
  '..#...#..',
  '...#.#...',
  '....#....',
  '....#....',
  '.#######.',
];

export function buildTrain(model, opts = {}) {
  const {
    cars = 1,
    stripe = '#58a6ff',
    streak = 0,
    label = 'RACHA',
    dir = 1,
    extra = null,
  } = opts;
  if (extra && !SPECIAL_CARS.includes(extra)) {
    throw new Error(`Unknown special car: "${extra}". Options: ${SPECIAL_CARS.join(', ')}`);
  }
  const n = clamp(Math.round(cars), 1, MAX_CARS);
  const cabW = model.loco ? 0 : cabWidth(model);
  const width = trainWidth(model, n, !!extra);

  const layers = {
    body: new Grid(width, TRAIN_H),
    open: new Grid(width, TRAIN_H), // open doors (overlay)
    lit: new Grid(width, TRAIN_H), // lit windows
    wa: new Grid(width, TRAIN_H), // wheel disc marks, frame A
    wb: new Grid(width, TRAIN_H), // wheel disc marks, frame B
    sa: new Grid(width, TRAIN_H), // sparks A
    sb: new Grid(width, TRAIN_H), // sparks B
    pa: new Grid(width, TRAIN_H), // locomotive smoke A
    pb: new Grid(width, TRAIN_H), // locomotive smoke B
    led: new Grid(width, TRAIN_H),
  };
  const ctx = { layers, model, stripe, streak, panes: [], led: null, pantAnchor: null, shoeAnchor: null };

  let x = 0;
  if (model.loco) {
    // Cars (the front one carries the sign), coupler, and locomotive.
    for (let i = 0; i < n; i++) {
      drawCar(ctx, { ox: x, w: MID_W, isCab: false, isTail: i === 0, isLed: i === n - 1, frontIndex: n - 1 - i });
      x += MID_W;
    }
    // The special car, if any, right behind the locomotive.
    if (extra) {
      drawCar(ctx, { ox: x, w: MID_W, isCab: false, isTail: false, frontIndex: 0, special: extra });
      x += MID_W;
    }
    layers.body.rect(x, TOP + 15, COUPLER, 2, NOSE_DARK);
    drawLoco(ctx, x + COUPLER);
  } else {
    // The special car, if any, sits right behind the cab. With a single car it
    // becomes the tail, so the train is the special car followed by the cab.
    const count = n + (extra ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const isCab = i === count - 1;
      const isTail = i === 0;
      const w = (isCab ? cabW : MID_W) + (isTail ? model.nose.w : 0);
      // Articulated models: cars run in pairs (from the head) sharing
      // the bogie at the joint.
      const f = count - 1 - i;
      const artFront = !!model.articulated && f % 2 === 1;
      const artRear = !!model.articulated && f % 2 === 0 && !isTail;
      const special = extra && i === count - 2 ? extra : null;
      drawCar(ctx, { ox: x, w, isCab, isTail, artFront, artRear, frontIndex: f, special });
      x += w;
    }
  }

  // Lit windows: increase with the streak (30 days = all), from front to back.
  const panes = [...ctx.panes].sort((a, b) => b.x - a.x);
  const litCount =
    streak > 0 ? clamp(Math.round(panes.length * Math.min(1, streak / 30)), 1, panes.length) : 0;
  for (const p of panes.slice(0, litCount)) layers.lit.rect(p.x, p.y, p.w, p.h, '#ffd86b');

  drawSparks(ctx);

  // LED sign: the text is drawn AFTER mirroring so it is not reversed.
  const text = `${label} ${streak}`;
  let ledBox = { ...ctx.led, w: LED_W, h: 7 };
  /** @type {Record<string, Grid>} */
  let out = layers;
  if (dir === -1) {
    out = {};
    for (const k of Object.keys(layers)) out[k] = layers[k].mirror();
    ledBox = { ...ledBox, x: width - ledBox.x - LED_W };
  }
  const tw = Math.min(textWidth(text), LED_W - 4);
  drawText(out.led, text, ledBox.x + Math.floor((LED_W - tw) / 2), ledBox.y + 1, LED_ON);

  return { width, height: TRAIN_H, cars: n, layers: out, hasPantograph: !!ctx.pantAnchor, dir, led: ledBox };
}

function drawCar(ctx, car) {
  const { layers: L, model, stripe } = ctx;
  const P = model.pal;
  const B = L.body;
  const { ox, w, isCab, isTail, isLed, artFront, artRear, special } = car;
  const layout = layoutOf(model);
  // The noses come from a template: the front one on the lead car and the same one,
  // mirrored, on the tail car. The rest is a rectangle. Behind a locomotive
  // there are no cabs: the tail is flat.
  const art = isCab ? model.nose : null;
  const tail = isTail && !model.loco ? model.nose : null;
  const nx0 = art ? w - art.w : w; // column where the front nose begins
  const lx = tail ? tail.w : 0; // column where the body begins, after the tail nose
  const cell = (x, y) => {
    if (x < lx) {
      const s = tail.rows[y]?.[lx - 1 - x] ?? '.';
      return TAIL_LIGHT[s] ?? s;
    }
    if (art && x >= nx0) return art.rows[y]?.[x - nx0] ?? '.';
    return x < w ? 's' : '.';
  };
  const inNose = (x) => x < lx || x >= nx0;
  const inCar = (x, y) => y >= 0 && y < BODY_ROWS && x >= 0 && cell(x, y) !== '.';
  const right = (y) => {
    for (let x = w - 1; x >= 0; x--) if (inCar(x, y)) return x;
    return -1;
  };
  const px = (x, y, c, g = B) => g.set(ox + x, TOP + y, c);

  // 1. Silhouette, stripes, and nose.
  for (let y = 0; y < BODY_ROWS; y++) {
    for (let x = 0; x < w; x++) {
      const sym = cell(x, y);
      if (sym === '.') continue;
      px(x, y, inNose(x) ? partColor(model, model.nose, sym, y, stripe) : rowColor(model, y, stripe));
    }
  }

  // 3. Gangway between cars.
  if (!isTail) for (let y = 2; y <= 17; y++) for (let x = 0; x < 2; x++) px(x, y, P.gangway);

  // 4. Automatic outline (silhouette edges).
  for (let y = 0; y < BODY_ROWS; y++) {
    for (let x = 0; x <= right(y); x++) {
      if (!inCar(x, y)) continue;
      const leftOpen = x === 0 ? isTail : !inCar(x - 1, y);
      if (leftOpen || !inCar(x + 1, y) || !inCar(x, y - 1) || !inCar(x, y + 1)) px(x, y, P.outline);
    }
  }
  // Flat tail of the last car (train with locomotive): red light by the edge.
  if (isTail && model.loco) for (const y of [14, 15]) px(1, y, TAIL_LAMP);

  // 5. Roof details: recessed units.
  if (model.roofBoxes && !special) {
    const boxes = isCab ? [[8, 18]] : [[8, 18], [38, 18]];
    for (const [bx, bw] of boxes) {
      for (let x = lx + bx; x < lx + bx + bw && x <= right(1); x++) {
        px(x, 1, P.roofVent);
        px(x, 2, P.roofVent);
      }
    }
  }

  // 6. Windows, doors, and sign. Some models have windows on a
  //    continuous dark band; it is painted first and the rest goes on top.
  if (model.winBand && !special) {
    const { y0, y1 } = model.win;
    for (let y = y0; y <= y1; y++) for (let x = isTail ? lx : 2; x < nx0 - 1; x++) px(x, y, model.winBand);
  }

  const windows = (x, ww) => {
    const { y0, y1 } = model.win;
    const panes = ww >= 12 ? 2 : 1;
    const pw = panes === 2 ? (ww - 2) / 2 : ww;
    for (let p = 0; p < panes; p++) {
      const wx = x + p * (pw + 2);
      B.frame(ox + wx, TOP + y0, pw, y1 - y0 + 1, P.outline);
      B.rect(ox + wx + 1, TOP + y0 + 1, pw - 2, y1 - y0 - 1, P.glass);
      B.hline(ox + wx + 1, TOP + y0 + 1, Math.min(3, pw - 2), P.glassHi);
      ctx.panes.push({ x: ox + wx + 1, y: TOP + y0 + 1, w: pw - 2, h: y1 - y0 - 1 });
    }
    return x + ww;
  };

  const door = (x) => {
    const dw = layout.doorW;
    const half = (dw - 1) / 2;
    const dx = ox + x;
    const dy = TOP + DOOR_Y0;
    // closed: two leaves, each with its own highlight and window
    B.rect(dx, dy, dw, DOOR_H, P.door);
    for (const leaf of [1, half + 1]) {
      B.vline(dx + leaf, dy + 1, DOOR_H - 2, P.doorHi);
      B.rect(dx + leaf + 1, dy + 2, 2, 6, P.glass);
    }
    B.vline(dx + half, dy, DOOR_H, P.outline);
    B.frame(dx, dy, dw, DOOR_H, P.outline);
    // open: lit interior and leaves retracted to the sides
    const O = L.open;
    O.rect(dx, dy, dw, DOOR_H, P.outline);
    O.rect(dx + 2, dy + 1, dw - 4, DOOR_H - 2, INTERIOR);
    O.hline(dx + 2, dy + DOOR_H - 2, dw - 4, INTERIOR_FLOOR);
    O.vline(dx + 1, dy + 1, DOOR_H - 2, P.door);
    O.vline(dx + dw - 2, dy + 1, DOOR_H - 2, P.door);
    return x + dw;
  };

  // LED sign (background; text goes on the led layer). Returns where the side continues.
  const ledSign = () => {
    B.rect(ox + lx + LED_X, TOP + 4, LED_W, 7, LED_BG);
    B.frame(ox + lx + LED_X, TOP + 4, LED_W, 7, P.outline);
    ctx.led = { x: ox + lx + LED_X, y: TOP + 4 };
    return lx + LED_X + LED_W + 2;
  };

  if (special) {
    // Special cars (cars.js) draw their own roof, windows and details.
    paintSpecialCar(special, {
      layers: L, model, stripe, streak: ctx.streak, panes: ctx.panes, ox, top: TOP, w, left: lx + 3,
    });
  } else if (isCab) {
    let x = door(ledSign()) + 2;
    if (model.cabWindows) windows(x, model.cabWindows);
  } else if (isLed) {
    // First car behind the locomotive: sign, one door, and one window in
    // the remaining space.
    const x = door(ledSign()) + 2;
    windows(x, w - 2 - x);
  } else {
    let x = lx + 3;
    for (const [kind, ww] of layout.items) x = (kind === 'd' ? door(x) : windows(x, ww)) + 2;
  }

  // 7. Bogies. The body is static; disc marks alternate between the
  //    wa and wb layers to suggest rotation. Under the cabs the bogie is at
  //    the same distance from the tip at both ends. At an articulation the two
  //    cars share a bogie centered on the joint; the front car draws it.
  const cabOff = model.cabBogieOff ?? 18;
  const bogies = [
    artRear ? 0 : tail ? cabOff - 1 : BOGIE_IN,
    artFront ? w : w - (isCab ? cabOff : BOGIE_IN + 1),
  ];
  for (const bx of artFront ? bogies.slice(0, 1) : bogies) drawBogie(ctx, ox + bx);
  // Equipment boxes under the floor, between bogies.
  const U = underColors(model.pal);
  const eEnd = bogies[1] - BOGIE_HALF - 2;
  for (let x = bogies[0] + BOGIE_HALF + 2; x <= eEnd; ) {
    const ew = Math.min(9, eEnd - x + 1);
    if (ew >= 4) {
      B.rect(ox + x, TOP + 20, ew, 4, U.box);
      B.hline(ox + x, TOP + 20, ew, U.frameHi);
      B.hline(ox + x, TOP + 23, ew, U.boxLo);
    }
    x += ew + 2;
  }
  if (isCab) ctx.shoeAnchor = { x: ox + bogies[1] + BOGIE_HALF + 1, y: TOP + 23 };

  // 8. Pantograph.
  if (shouldHavePantograph(model, car)) {
    const pxo = lx + (model.pant === 'lead' ? model.pantX ?? 24 : 28);
    const top = TOP - PANTOGRAPH.length;
    PANTOGRAPH.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] === '#') B.set(ox + pxo + c, top + r, r === 0 ? '#d3d6dc' : '#2a2a31');
      }
    });
    if (!ctx.pantAnchor) ctx.pantAnchor = { x: ox + pxo + 4, y: top };
  }
}

function shouldHavePantograph(model, car) {
  if (!model.pant || car.special) return false;
  if (model.pant === 'lead') return car.isCab;
  return car.frontIndex % 2 === 0; // 'alt'
}

function drawSparks(ctx) {
  const { layers: L } = ctx;
  const a = ctx.pantAnchor ?? ctx.shoeAnchor;
  if (!a) return;
  const W = '#fff6b8';
  const O = '#ffb02e';
  const sets = {
    sa: [[0, -1, W], [-2, -1, O], [3, 0, O], [-3, 0, W]],
    sb: [[1, -1, W], [-1, -1, O], [-4, 0, O], [4, 0, W]],
  };
  for (const [layer, pts] of Object.entries(sets)) {
    for (const [dx, dy, c] of pts) L[layer].set(a.x + dx, a.y + dy, c);
  }
}
