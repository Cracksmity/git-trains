// Build a train as pixel layers (facing right) and, if needed,
// mirror it. The layers are animated separately in scene.js.

import { Grid } from './pixel.js';
import { drawText, textWidth } from './font.js';

export const TOP = 9; // free rows above the roof (pantograph and sparks)
export const BODY_ROWS = 20; // roof .. skirt
export const TRAIN_H = TOP + 25; // + wheel area
export const MID_W = 64;
export const LED_W = 39;
export const DOOR_W = 11;
export const MAX_CARS = 6;

// Locomotive (optional, for steam trains): a complete drawing at the front
// instead of the cab, with its driving wheels joined by a connecting rod. The cars
// follow behind and the last ends in a flat tail with a red light.
export const LOCO_ROWS = 30; // 5 above the car roofs + 20 for the body + 5 for wheels
export const LOCO_UP = 5; // drawing rows above the car roofs
export const LOCO_MIN_W = 16;
export const LOCO_MAX_W = 60;
export const LOCO_WHEELS = [7, 9, 11]; // driving wheel diameters
export const LOCO_SMALL = 5; // small wheel diameter (leading or trailing)
const COUPLER = 2; // coupler between the first car and the locomotive

// Side of an intermediate car: windows ('w', width) and doors ('d'), from back
// to front. With 3 doors per side (metro trains), the doors are narrower.
const LAYOUTS = {
  2: { doorW: DOOR_W, items: [['w', 7], ['d'], ['w', 14], ['d'], ['w', 7]] },
  3: { doorW: 9, items: [['w', 4], ['d'], ['w', 6], ['d'], ['w', 6], ['d'], ['w', 4]] },
};
const layoutOf = (model) => LAYOUTS[model.doors ?? 2];

// The tail nose is the same mirrored template; its lights are red.
const TAIL_LIGHT = { l: 'r', y: 'r', q: 'r' };
const TAIL_LAMP = '#ff4a4a';

const LED_X = 3;
const DOOR_Y0 = 3;
const DOOR_H = 15;
const INTERIOR = '#f2d98d';
const INTERIOR_FLOOR = '#b9a064';
const LED_BG = '#0a0a10';
export const LED_ON = '#ffb02e';

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
const BOGIE_HALF = 11;
const BOGIE_IN = 13; // from the car end to the bogie center
// Disc marks: three at 120? rotating 60? between frames (those that fall
// under the frame are not visible).
const WHEEL_MARKS = {
  wa: [[0, -2], [-2, 1], [2, 1]],
  wb: [[0, 2], [-2, -1], [2, -1]],
};

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

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function cabWidth(model) {
  return 3 + LED_W + 2 + layoutOf(model).doorW + 2 + (model.cabWindows ? model.cabWindows + 2 : 0) + model.nose.w;
}

// Intermediate cars + lead car + tail nose (cab at both ends).
// With a locomotive: the cars, coupler, and locomotive.
export function trainWidth(model, cars) {
  const n = clamp(cars, 1, MAX_CARS);
  if (model.loco) return n * MID_W + COUPLER + model.loco.w;
  return (n - 1) * MID_W + cabWidth(model) + model.nose.w;
}

function symbolColor(model, s, stripe) {
  const p = model.pal;
  switch (s) {
    case 'b': return p.body;
    case 'h': return p.bodyHi;
    case 'l': return p.bodyLo;
    case 't': return p.trim;
    case 'd': return p.dark;
    case 'u': return p.upper;
    case 'a': return stripe;
    default: return p.body;
  }
}

const NOSE_DARK = '#26242b';

// Color of a nose or locomotive symbol (see noses.js). `part` is
// model.nose or model.loco: it supplies the paint (n), panel (f), and, for the
// locomotive, the light and dark shades of its paint (h, m).
function partColor(model, part, sym, y, stripe) {
  const p = model.pal;
  switch (sym) {
    case 's': return rowColor(model, y, stripe);
    case 'n': return part.color ?? rowColor(model, y, stripe);
    case 'f': return part.face ?? p.dark;
    case 'o': return p.outline;
    case 'g': return p.glass;
    case 'G': return p.glassHi;
    case 'k': return NOSE_DARK;
    case 'a': return stripe;
    case 'l': return '#fff4b0';
    case 'y': return '#ffb02e';
    case 'i': return LED_ON;
    case 'r': return '#ff4a4a';
    case 'q': return '#7d2b30';
    case 'm': return part.lo ?? p.bodyLo;
    case 'h': return part.hi ?? p.bodyHi;
    case 't': return p.trim;
    case 'd': return p.dark;
    default: return rowColor(model, y, stripe);
  }
}

// Side color at body row y (0 roof .. 19 skirt). Above the
// roof the roof highlight continues, and below the skirt, the skirt continues.
function rowColor(model, y, stripe) {
  const p = model.pal;
  if (y <= 1) return p.roofHi;
  if (y === 2) return p.roof;
  if (y === 3) return symbolColor(model, model.row3, stripe);
  if (y <= 10) return p.upper;
  if (y <= 17) return symbolColor(model, model.bands[y - 11], stripe);
  return p.skirt;
}

export function buildTrain(model, opts = {}) {
  const {
    cars = 1,
    stripe = '#58a6ff',
    streak = 0,
    label = 'RACHA',
    dir = 1,
  } = opts;
  const n = clamp(Math.round(cars), 1, MAX_CARS);
  const cabW = model.loco ? 0 : cabWidth(model);
  const width = trainWidth(model, n);

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
  const ctx = { layers, model, stripe, panes: [], led: null, pantAnchor: null, shoeAnchor: null };

  let x = 0;
  if (model.loco) {
    // Cars (the front one carries the sign), coupler, and locomotive.
    for (let i = 0; i < n; i++) {
      drawCar(ctx, { ox: x, w: MID_W, isCab: false, isTail: i === 0, isLed: i === n - 1, frontIndex: n - 1 - i });
      x += MID_W;
    }
    layers.body.rect(x, TOP + 15, COUPLER, 2, NOSE_DARK);
    drawLoco(ctx, x + COUPLER);
  } else {
    for (let i = 0; i < n; i++) {
      const isCab = i === n - 1;
      const isTail = i === 0;
      const w = (isCab ? cabW : MID_W) + (isTail ? model.nose.w : 0);
      // Articulated models: cars run in pairs (from the head) sharing
      // the bogie at the joint.
      const f = n - 1 - i;
      const artFront = !!model.articulated && f % 2 === 1;
      const artRear = !!model.articulated && f % 2 === 0 && !isTail;
      drawCar(ctx, { ox: x, w, isCab, isTail, artFront, artRear, frontIndex: f });
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
  const { ox, w, isCab, isTail, isLed, artFront, artRear } = car;
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
  if (model.roofBoxes) {
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
  if (model.winBand) {
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

  if (isCab) {
    let x = door(ledSign()) + 2;
    if (model.cabWindows) x = windows(x, model.cabWindows) + 2;
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

// Blend two #rrggbb colors (t = 0 returns a, t = 1 returns b).
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

// Colors underneath the car (bogies and equipment boxes). They come from the
// model palette: skirt gray with a touch of body color, so the train
// and its wheels share a tone instead of all using the same gray.
function underColors(P) {
  const frame = mix(P.skirt, P.body, 0.06);
  const disc = mix(mix(P.wheel, P.skirt, 0.5), P.body, 0.05);
  return {
    frame,
    frameHi: mix(frame, '#ffffff', 0.18),
    box: mix(frame, '#ffffff', 0.06),
    boxLo: mix(frame, P.outline, 0.4),
    axle: mix(frame, '#ffffff', 0.3),
    axleLo: mix(frame, '#ffffff', 0.1),
    disc,
    discHi: mix(disc, '#ffffff', 0.1),
    mark: mix(disc, '#ffffff', 0.3),
  };
}

const TYRE = { hi: '#2a2a30', lo: '#141417', mark: '#4a4a52', hub: '#a3a6ad', hubLo: '#7c7f87' };

// Bogie centered at column bx (train coordinates).
function drawBogie(ctx, bx) {
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

// --- Locomotive --------------------------------------------------------------

const ROD = '#c9cdd4';
const ROD_PIN = '#7c828c';
const STEAM = { '#': '#f4f5f8', '%': '#cfd4dc', o: '#8f98a5' };

// Smoke puffs: [mask, dx, dy] with the mask centered on the chimney + dx
// and its bottom row at the chimney mouth + dy. "#" smoke, "%" shadow, "o"
// outline. Two frames: the puff emerges and the previous one stays behind (the train
// moves forward). Few rows remain above the chimney, so the smoke spreads out.
const PUFF_S = ['.oo.', 'o##o', 'o#%o', '.oo.'];
const PUFF_M = ['.ooo.', 'o###o', 'o#%%o', '.ooo.'];
const PUFF_L = ['..ooo..', '.o###oo', 'o######o', 'o##%%%%o', '.oooooo.'];
const PUFFS = {
  pa: [[PUFF_S, 0, -1], [PUFF_L, -10, -1]],
  pb: [[PUFF_M, -1, -1], [PUFF_L, -17, -2]],
};

// Pixels of a wheel with radius r: [dx, dy, tire?].
function wheelPixels(r) {
  const lim = (r + 0.5) ** 2;
  const inside = (dx, dy) => dx * dx + dy * dy <= lim;
  const out = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (!inside(dx, dy)) continue;
      const rim = !inside(dx - 1, dy) || !inside(dx + 1, dy) || !inside(dx, dy - 1) || !inside(dx, dy + 1);
      out.push([dx, dy, rim]);
    }
  }
  return out;
}

// Symmetric rounding (Math.round(-1.5) gives -1).
const sround = (v) => Math.sign(v) * Math.round(Math.abs(v));

// Locomotive wheel centered at (cx, cy). Disc marks rotate 60? between
// the wa and wb layers, as on the bogies.
function drawWheel(ctx, cx, cy, r, colors) {
  const { layers: L } = ctx;
  for (const [dx, dy, rim] of wheelPixels(r)) {
    L.body.set(cx + dx, cy + dy, rim ? colors.rim : dy < 0 ? colors.hi : colors.lo);
  }
  L.body.set(cx, cy, colors.hub);
  if (r >= 4) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) L.body.set(cx + dx, cy + dy, colors.hubLo);
  const rm = r - 1;
  const marks = { wa: [-90, 30, 150], wb: [-30, 90, 210] };
  for (const [layer, angles] of Object.entries(marks)) {
    for (const a of angles) {
      const t = (a * Math.PI) / 180;
      L[layer].set(cx + sround(rm * Math.cos(t)), cy + sround(rm * Math.sin(t)), colors.mark);
    }
  }
}

// Locomotive with its top-left corner at column ox of the train.
function drawLoco(ctx, ox) {
  const { layers: L, model, stripe } = ctx;
  const P = model.pal;
  const loco = model.loco;
  const y0 = TOP - LOCO_UP; // train row where the drawing begins
  const at = (x, y) => (y >= 0 && y < LOCO_ROWS && x >= 0 && x < loco.w ? loco.rows[y][x] : '.');
  const filled = (x, y) => at(x, y) !== '.';

  // 1. Drawing and automatic outline on the silhouette edges.
  for (let y = 0; y < LOCO_ROWS; y++) {
    for (let x = 0; x < loco.w; x++) {
      const sym = at(x, y);
      if (sym === '.') continue;
      const edge = !filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1);
      L.body.set(ox + x, y0 + y, edge ? P.outline : partColor(model, loco, sym, y - LOCO_UP, stripe));
    }
  }

  // 2. Wheels: driving wheels joined by the connecting rod and separate small wheels. All touch
  //    the rail on the last row of the drawing.
  const { wheels } = loco;
  const U = underColors(P);
  const disc = wheels.color ?? U.disc;
  const colors = {
    rim: P.outline,
    hi: mix(disc, '#ffffff', 0.1),
    lo: disc,
    hub: mix(disc, '#ffffff', 0.45),
    hubLo: mix(disc, '#ffffff', 0.2),
    mark: mix(disc, '#ffffff', 0.3),
  };
  const bottom = TOP + 24;
  const r = (wheels.d - 1) / 2;
  const rs = (LOCO_SMALL - 1) / 2;
  for (const x of wheels.small) drawWheel(ctx, ox + x, bottom - rs, rs, colors);
  for (const x of wheels.drive) drawWheel(ctx, ox + x, bottom - r, r, colors);

  // The connecting rod goes on the wa/wb layers: down and forward in one frame, up and back
  // in the other, like the crankpin turning with the wheel.
  if (wheels.rod && wheels.drive.length >= 2) {
    const q = Math.max(1, Math.round(Math.max(1, r - 2) * 0.7));
    const cy = bottom - r;
    const x0 = Math.min(...wheels.drive);
    const x1 = Math.max(...wheels.drive);
    for (const [layer, d] of [['wa', q], ['wb', -q]]) {
      L[layer].hline(ox + x0 + d, cy + d, x1 - x0 + 1, ROD);
      for (const x of wheels.drive) L[layer].set(ox + x + d, cy + d, ROD_PIN);
    }
  }

  // 3. Smoke above the chimney; sparks (fast train) emerge from there too. Without
  //    a chimney, they jump from the rail under the front driving wheel.
  if (loco.smoke !== undefined) {
    const sx = ox + loco.smoke;
    let top = 0;
    while (!filled(loco.smoke, top)) top++;
    const mouth = y0 + top;
    for (const [layer, puffs] of Object.entries(PUFFS)) {
      for (const [mask, dx, dy] of puffs) {
        const left = sx + dx - Math.floor(mask[0].length / 2);
        const yTop = mouth + dy - mask.length + 1;
        mask.forEach((row, j) => {
          for (let i = 0; i < row.length; i++) {
            if (row[i] !== '.') L[layer].set(left + i, yTop + j, STEAM[row[i]]);
          }
        });
      }
    }
    ctx.shoeAnchor = { x: sx, y: mouth - 1 };
  } else {
    ctx.shoeAnchor = { x: ox + Math.max(...wheels.drive) + r, y: bottom };
  }
}

function shouldHavePantograph(model, car) {
  if (!model.pant) return false;
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
