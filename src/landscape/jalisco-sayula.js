import { rng } from '../graphics/pixel.js';
import { line, polygon } from '../graphics/pixel-shapes.js';
import { sky, rancho, mesquite } from './jalisco-country.js';
import { kioskSayula, parroquiaSayula, santuarioSayula } from './jalisco-sayula-landmarks.js';

// Seen from the lake shore north of town, looking south: the lake in front, Sayula on
// its southern shore, the Nevado de Colima far behind the town and the sierra to the
// west (right) with the Santuario at its foot. From here the Nevado and the Volcán de
// Fuego merge into one massif: a sharp summit and a long shoulder easing west.
function colima(g, base) {
  const face = (points, ink) => polygon(g, points.map(([x, h]) => [x, base - h]), ink);
  face([[236,14],[250,19],[264,24],[279,30],[292,34],[300,37],[304,38],[307,38],[311,36],
    [317,34],[326,33],[340,32],[356,30],[372,27],[390,24],[410,21],[432,17],[432,14]], '@nevado');
  // Gullies down the eastern face, and the flank in shadow under the shoulder.
  face([[262,23],[279,30],[292,34],[300,37],[296,33],[288,29],[281,28],[286,31],[272,26]], '@nevadoShade');
  face([[318,32],[326,31],[334,29],[324,28],[320,30]], '@nevadoShade');
  // Snow only on the top rows of the summit.
  face([[296,35],[300,37],[304,38],[307,38],[311,36],[314,35],[310,34],[306,35],[302,34]], '@summitSnow');
}

// Low ridges east of the valley fade behind the lake. A nearer hill closes the gap on
// the volcano's east side and the sierra rises to the west, behind the town.
function valley(g, base) {
  for (let x = 0; x < g.w; x++) {
    const h = Math.round(18 + 1.6 * Math.sin(x / 41 + 0.6) + 0.8 * Math.sin(x / 17 + 1.3));
    g.vline(x, base - h, h, '@valleyHill');
  }
  for (let x = 150; x <= 302; x++) {
    const t = (x - 226) / 76;
    const h = Math.round(18 + 7 * Math.cos((t * Math.PI) / 2) ** 1.5 + 0.7 * Math.sin(x / 9));
    g.vline(x, base - h, h, '@valleyFoot');
  }
  for (let x = 344; x < g.w; x++) {
    const t = Math.min(1, (x - 344) / 104);
    const h = Math.round(17 + 14 * t * t * (3 - 2 * t) + 0.8 * Math.sin(x / 7));
    g.vline(x, base - h, h, '@valleyFoot');
  }
}

// American white pelican afloat: black flight feathers, the head raised on its neck and
// the long orange bill held forward under it. Seven pixels of plumage from tail to head.
function pelican(g, x, y, facing) {
  const span = (dx, dy, w, ink) => g.hline(x + (facing === 1 ? dx : -dx - w + 1), y + dy, w, ink);
  span(-3, 0, 6, '@lakeGlint');
  span(-3, -1, 6, '@plumage');
  span(-3, -2, 2, '@pinion');
  span(-1, -2, 4, '@plumage');
  span(2, -3, 1, '@plumage');
  span(2, -4, 2, '@plumage');
  span(3, -3, 3, '@bill');
}

// One pelican soaring high above the train, wingtips black and its bill pouch hanging.
function flyingPelican(g, x, y) {
  g.hline(x - 6, y - 3, 2, '@pinion');
  g.hline(x - 5, y - 2, 2, '@pinion');
  g.set(x - 4, y - 1, '@pinion');
  g.hline(x - 3, y - 1, 5, '@plumage');
  g.set(x + 1, y - 2, '@plumage');
  g.hline(x + 1, y - 3, 2, '@pinion');
  g.hline(x - 2, y, 6, '@plumage');
  g.hline(x + 4, y, 3, '@bill');
  g.hline(x + 4, y + 1, 2, '@bill');
}

function laguna(g, base) {
  const far = base - 18;
  const shore = 320;
  g.rect(0, far, shore, base - far, '@salt');
  const random = rng(822);
  // Shallow far water, deeper in the cove at the town's edge where the flock floats,
  // and a wide dry pan in front for the wind plumes and the heat mirage.
  const waterDepth = (x) => {
    const cove = 2.6 * Math.exp(-(((x - 302) / 24) ** 2));
    return Math.round(4.1 + cove + 0.8 * Math.sin(x / 44) + 0.5 * Math.sin(x / 19));
  };
  for (let x = 0; x < shore; x++) {
    g.vline(x, far, waterDepth(x), '@laguna');
  }
  // Broken reflections on the water and forked hairline cracks in the exposed salt flat.
  for (let x = 3; x < shore - 6; x += 8 + Math.floor(random() * 14)) {
    const y = far + 1 + Math.floor(random() * 3);
    if (g.get(x, y) === '@laguna') g.hline(x, y, 3 + Math.floor(random() * 6), '@lakeGlint');
  }
  for (let x = 10; x < shore - 8; x += 11 + Math.floor(random() * 13)) {
    const depth = waterDepth(x);
    const y = far + depth + 1 + Math.floor(random() * 5);
    const w = 4 + Math.floor(random() * 9);
    const slope = random() < 0.5 ? -1 : 1;
    for (let dx = 0; dx < w; dx++) {
      const row = y + slope * Math.floor(dx / 3);
      if (g.get(x + dx, row) === '@salt') g.set(x + dx, row, '@saltSeam');
      if (dx === 3 && g.get(x + dx, row - slope) === '@salt') g.set(x + dx, row - slope, '@saltSeam');
    }
  }
  // The flock floats in a loose row in the cove at the edge of town, where frame 0 shows it.
  for (const [x, facing] of [[281, 1], [292, 1], [303, -1], [314, 1]]) {
    pelican(g, x, far + 3, facing);
  }
  // Tule reeds cluster along the shore.
  for (const [left, count] of [[16, 4], [188, 4], [262, 4], [282, 3]]) {
    for (let i = 0; i < count; i++) {
      const x = left + i * 2;
      const y = far + waterDepth(x);
      const h = 1 + Math.floor(random() * 4);
      line(g, x, y, x + (i % 2 ? 1 : -1), y - h, '@tule');
    }
  }
}

function road(g, base) {
  // Low dirt road beside the salt flat, rising to a 6-row shoulder at the town's edge
  // so El Ánima stands on unbroken road and vanishes by day.
  for (let x = 0; x < g.w; x++) {
    const town = Math.max(0, Math.min(1, (x - 304) / 6));
    const h = Math.round(3.5 + 2.5 * town + 0.5 * (1 - town) * Math.sin(x / 35));
    g.vline(x, base - h, h, '@road');
  }
  const random = rng(824);
  for (let x = 3; x < g.w; x += 14 + Math.floor(random() * 16)) {
    const w = 3 + Math.floor(random() * 11);
    const y = base - 2 - Math.round(0.5 * Math.sin(x / 35));
    // El Ánima stands in an unbroken patch of road at the edge of town (x 314-319).
    if (x + w < 310 || x > 322) g.hline(x, y, w, '@wheelRut');
  }
}

function anima(g, x, b) {
  g.hline(x, b - 5, 2, '@shroud');
  g.rect(x - 1, b - 4, 3, 4, '@shroud');
  g.vline(x + 2, b - 3, 3, '@shroudFold');
  g.hline(x - 2, b, 5, '@shroud');
  g.set(x + 3, b - 3, '@shroud');
  g.set(x + 3, b - 4, '@candle');
}

/** Sayula from its lake: the plaza, the Santuario at the foot of the sierra, the Nevado behind. */
export function paintSayula(g, base, height) {
  sky(g, base, height, 821);
  colima(g, base);
  valley(g, base);
  santuarioSayula(g, 422, base);
  laguna(g, base);
  flyingPelican(g, 198, base - 33);
  // The green of the plaza and the gardens behind the houses.
  polygon(g, [[318, base], [322, base - 15], [336, base - 17], [398, base - 17], [404, base - 15], [448, base - 15], [448, base]], '@pasture');
  rancho(g, 319, base - 4, 14, '@limewash');
  parroquiaSayula(g, 370, base - 4);
  rancho(g, 431, base - 4, 16, '@ochreLit');
  road(g, base);
  kioskSayula(g, 345, base - 3);
  // Mesquites stand on grassy banks between the road and the salt.
  for (const [x, h] of [[28, 9], [116, 9], [220, 8], [272, 8]]) {
    polygon(g, [[x - 6, base - 2], [x - 3, base - 4], [x + 3, base - 4], [x + 6, base - 2]], '@pasture');
    mesquite(g, x, base - 2, h);
  }
  anima(g, 316, base - 1);
}
