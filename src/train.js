// Construye un tren como capas de píxeles (mirando a la derecha) y, si hace
// falta, lo espeja. Las capas se animan por separado en scene.js.

import { Grid } from './pixel.js';
import { drawText, textWidth } from './font.js';

export const TOP = 9; // filas libres sobre el techo (pantógrafo y chispas)
export const BODY_ROWS = 20; // techo .. faldón
export const TRAIN_H = TOP + 25; // + zona de ruedas
export const MID_W = 64;
export const LED_W = 39;
export const DOOR_W = 11;
export const MAX_CARS = 6;

// Costado de un coche intermedio: ventanas ('w', ancho) y puertas ('d'), de atrás
// hacia adelante. Con 3 puertas por lado (los metros) las puertas son más angostas.
const LAYOUTS = {
  2: { doorW: DOOR_W, items: [['w', 7], ['d'], ['w', 14], ['d'], ['w', 7]] },
  3: { doorW: 9, items: [['w', 4], ['d'], ['w', 6], ['d'], ['w', 6], ['d'], ['w', 4]] },
};
const layoutOf = (model) => LAYOUTS[model.doors ?? 2];

// La trompa de cola es la misma plantilla espejada; ahí las luces van en rojo.
const TAIL_LIGHT = { l: 'r', y: 'r', q: 'r' };

const LED_X = 3;
const DOOR_Y0 = 3;
const DOOR_H = 15;
const INTERIOR = '#f2d98d';
const INTERIOR_FLOOR = '#b9a064';
const LED_BG = '#0a0a10';
export const LED_ON = '#ffb02e';

// Bogie visto de lado (filas 18..24: las ruedas asoman bajo el faldón), centrado en
// su eje. Dos ruedas de disco de 7 px unidas por el bastidor, que pasa POR DELANTE
// de ellas y termina en las cajas de grasa de cada eje.
// Luz desde arriba, igual que la carrocería.
//   o llanta (contorno)  v/w disco (luz/sombra)  F/f bastidor  x/X caja de grasa
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
const BOGIE_IN = 13; // del extremo del coche al centro del bogie
// Marcas del disco: tres a 120° que giran 60° entre fotogramas (las que caen
// bajo el bastidor no se ven).
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

// Coches intermedios + coche cabeza + la trompa de cola (cabina en ambos extremos).
export function trainWidth(model, cars) {
  return (clamp(cars, 1, MAX_CARS) - 1) * MID_W + cabWidth(model) + model.nose.w;
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

// Color de un símbolo de la plantilla de trompa (ver noses.js).
function noseColor(model, sym, y, stripe) {
  const p = model.pal;
  switch (sym) {
    case 's': return rowColor(model, y, stripe);
    case 'n': return model.nose.color ?? rowColor(model, y, stripe);
    case 'f': return model.nose.face ?? p.dark;
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
    case 'm': return p.bodyLo;
    case 'h': return p.bodyHi;
    case 't': return p.trim;
    case 'd': return p.dark;
    default: return rowColor(model, y, stripe);
  }
}

function rowColor(model, y, stripe) {
  const p = model.pal;
  if (y === 0) return p.roofHi;
  if (y === 1) return p.roofHi;
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
  const cabW = cabWidth(model);
  const width = trainWidth(model, n);

  const layers = {
    body: new Grid(width, TRAIN_H),
    open: new Grid(width, TRAIN_H), // puertas abiertas (se superpone)
    lit: new Grid(width, TRAIN_H), // ventanas iluminadas
    wa: new Grid(width, TRAIN_H), // marcas del disco de rueda, fotograma A
    wb: new Grid(width, TRAIN_H), // marcas del disco de rueda, fotograma B
    sa: new Grid(width, TRAIN_H), // chispas A
    sb: new Grid(width, TRAIN_H), // chispas B
    led: new Grid(width, TRAIN_H),
  };
  const ctx = { layers, model, stripe, panes: [], led: null, pantAnchor: null, shoeAnchor: null };

  let x = 0;
  for (let i = 0; i < n; i++) {
    const isCab = i === n - 1;
    const isTail = i === 0;
    const w = (isCab ? cabW : MID_W) + (isTail ? model.nose.w : 0);
    // Modelos articulados: los coches van en pares (desde la cabeza) que comparten
    // el bogie de la unión.
    const f = n - 1 - i;
    const artFront = !!model.articulated && f % 2 === 1;
    const artRear = !!model.articulated && f % 2 === 0 && !isTail;
    drawCar(ctx, { ox: x, w, isCab, isTail, artFront, artRear, frontIndex: f });
    x += w;
  }

  // Ventanas iluminadas: crecen con la racha (30 días = todas), de adelante hacia atrás.
  const panes = [...ctx.panes].sort((a, b) => b.x - a.x);
  const litCount =
    streak > 0 ? clamp(Math.round(panes.length * Math.min(1, streak / 30)), 1, panes.length) : 0;
  for (const p of panes.slice(0, litCount)) layers.lit.rect(p.x, p.y, p.w, p.h, '#ffd86b');

  drawSparks(ctx);

  // Letrero LED: el texto se dibuja DESPUÉS de espejar para que no salga invertido.
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
  const { ox, w, isCab, isTail, artFront, artRear } = car;
  const layout = layoutOf(model);
  // Las trompas vienen de una plantilla: la delantera en el coche cabeza y la misma,
  // espejada, en el de cola. El resto es un rectángulo.
  const art = isCab ? model.nose : null;
  const tail = isTail ? model.nose : null;
  const nx0 = art ? w - art.w : w; // columna donde empieza la trompa delantera
  const lx = tail ? tail.w : 0; // columna donde empieza la caja, tras la trompa de cola
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

  // 1. Silueta, franjas y trompa.
  for (let y = 0; y < BODY_ROWS; y++) {
    for (let x = 0; x < w; x++) {
      const sym = cell(x, y);
      if (sym === '.') continue;
      px(x, y, inNose(x) ? noseColor(model, sym, y, stripe) : rowColor(model, y, stripe));
    }
  }

  // 3. Fuelle entre coches.
  if (!isTail) for (let y = 2; y <= 17; y++) for (let x = 0; x < 2; x++) px(x, y, P.gangway);

  // 4. Contorno automático (bordes de la silueta).
  for (let y = 0; y < BODY_ROWS; y++) {
    for (let x = 0; x <= right(y); x++) {
      if (!inCar(x, y)) continue;
      const leftOpen = x === 0 ? isTail : !inCar(x - 1, y);
      if (leftOpen || !inCar(x + 1, y) || !inCar(x, y - 1) || !inCar(x, y + 1)) px(x, y, P.outline);
    }
  }

  // 5. Detalles de techo: unidades hundidas.
  if (model.roofBoxes) {
    const boxes = isCab ? [[8, 18]] : [[8, 18], [38, 18]];
    for (const [bx, bw] of boxes) {
      for (let x = lx + bx; x < lx + bx + bw && x <= right(1); x++) {
        px(x, 1, P.roofVent);
        px(x, 2, P.roofVent);
      }
    }
  }

  // 6. Ventanas, puertas y letrero. Algunos modelos llevan las ventanas sobre una
  //    banda oscura continua; se pinta primero y lo demás va encima.
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
    // cerrada: dos hojas, cada una con su brillo y su ventanilla
    B.rect(dx, dy, dw, DOOR_H, P.door);
    for (const leaf of [1, half + 1]) {
      B.vline(dx + leaf, dy + 1, DOOR_H - 2, P.doorHi);
      B.rect(dx + leaf + 1, dy + 2, 2, 6, P.glass);
    }
    B.vline(dx + half, dy, DOOR_H, P.outline);
    B.frame(dx, dy, dw, DOOR_H, P.outline);
    // abierta: interior iluminado y hojas recogidas a los lados
    const O = L.open;
    O.rect(dx, dy, dw, DOOR_H, P.outline);
    O.rect(dx + 2, dy + 1, dw - 4, DOOR_H - 2, INTERIOR);
    O.hline(dx + 2, dy + DOOR_H - 2, dw - 4, INTERIOR_FLOOR);
    O.vline(dx + 1, dy + 1, DOOR_H - 2, P.door);
    O.vline(dx + dw - 2, dy + 1, DOOR_H - 2, P.door);
    return x + dw;
  };

  if (isCab) {
    // Letrero LED (fondo; el texto va en la capa led).
    B.rect(ox + lx + LED_X, TOP + 4, LED_W, 7, LED_BG);
    B.frame(ox + lx + LED_X, TOP + 4, LED_W, 7, P.outline);
    ctx.led = { x: ox + lx + LED_X, y: TOP + 4 };
    let x = lx + LED_X + LED_W + 2;
    x = door(x) + 2;
    if (model.cabWindows) x = windows(x, model.cabWindows) + 2;
  } else {
    let x = lx + 3;
    for (const [kind, ww] of layout.items) x = (kind === 'd' ? door(x) : windows(x, ww)) + 2;
  }

  // 7. Bogies. El cuerpo es estático; las marcas del disco alternan entre las
  //    capas wa y wb para dar sensación de giro. Bajo las cabinas el bogie queda a
  //    la misma distancia de la punta en ambos extremos. En una articulación los dos
  //    coches comparten un bogie centrado en la unión; lo dibuja el de adelante.
  const cabOff = model.cabBogieOff ?? 18;
  const bogies = [
    artRear ? 0 : isTail ? cabOff - 1 : BOGIE_IN,
    artFront ? w : w - (isCab ? cabOff : BOGIE_IN + 1),
  ];
  for (const bx of artFront ? bogies.slice(0, 1) : bogies) drawBogie(ctx, ox + bx);
  // Cajas de equipo bajo el piso, entre bogies.
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

  // 8. Pantógrafo.
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

// Mezcla dos colores #rrggbb (t = 0 devuelve a, t = 1 devuelve b).
function mix(a, b, t) {
  const ca = parseInt(a.slice(1), 16);
  const cb = parseInt(b.slice(1), 16);
  let out = '#';
  for (const s of [16, 8, 0]) {
    const v = Math.round(((ca >> s) & 255) * (1 - t) + ((cb >> s) & 255) * t);
    out += v.toString(16).padStart(2, '0');
  }
  return out;
}

// Colores del bajo del coche (bogies y cajas de equipo). Salen de la paleta del
// modelo: el gris del faldón con un toque del color de la caja, para que el tren
// y sus ruedas compartan tono en vez de llevar todos el mismo gris.
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

// Bogie con centro en la columna bx (coordenadas del tren).
function drawBogie(ctx, bx) {
  const { layers: L, model } = ctx;
  const U = underColors(model.pal);
  // Rodadura neumática: llantas de goma negra con el cubo metálico a la vista, en
  // vez de ruedas de acero con caja de grasa.
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
