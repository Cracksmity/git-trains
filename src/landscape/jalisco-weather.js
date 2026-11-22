// What the weather does to each Jalisco place beyond its sky: wet plazas and
// ballast, shining roofs and furrows, a scarf of cloud on the Volcán de Tequila, and
// where each place's lightning strikes. src/scene/weather.js adds the sky,
// the rain and the flashes; these painters only touch the ground they own.
import { skyInk } from '../weather/inks.js';

const wet = (state) => state === 'rain' || state === 'storm';

/**
 * Swap inks inside a band, reading the painted backdrop and writing to the weather grid.
 * @param {(x: number, y: number) => boolean} [pick] which of the matching pixels to swap
 */
function recolor(g, backdrop, band, swaps, pick = (x, y) => true) {
  for (let y = band.top; y < band.base; y++) {
    for (let x = 0; x < g.w; x++) {
      const ink = backdrop.get(x, y);
      if (Object.hasOwn(swaps, ink) && pick(x, y)) g.set(x, y, swaps[ink]);
    }
  }
}

// Water standing between the sleepers: short glints on the ballast, kept off the captions.
function puddles(g, backdrop, band, seed) {
  const y = band.base + 9;
  for (let x = 6 + (seed % 7); x < g.w - 6; x += 17 + ((x * seed) % 13)) {
    const w = 2 + ((x + seed) % 4);
    let clear = true;
    for (let dx = -1; dx <= w; dx++) {
      const ink = backdrop.get(x + dx, y);
      if (ink && ink !== '@ballast2') clear = false;
    }
    if (clear) g.hline(x, y, w, '@wPuddle');
  }
}

// A lens of cloud: a lit crown, a body and a shaded base, centred on cx.
function lens(g, cx, top, rows, state) {
  rows.forEach((half, i) => {
    const part = i === 0 ? 'CloudLit' : i === rows.length - 1 ? 'CloudShade' : 'Cloud';
    g.hline(cx - half, top + i, 2 * half + 1, skyInk(state, part));
  });
}

/**
 * Guadalajara: under a low ceiling a wisp drifts across the tallest tower, below its
 * red sign; the plaza in front of the Cathedral shines with rain and the lamps reflect in it.
 */
function guadalajara(g, state, band, backdrop) {
  if (!wet(state)) return;
  lens(g, 340, band.base - 61, state === 'storm' ? [9, 15, 13] : [7, 12, 9], state);
  const row = band.base - 1;
  for (let x = 0; x < g.w; x++) if (backdrop.get(x, row) === '@stoneShade' && (x * 7) % 12 < 3) g.set(x, row, '@wPuddle');
  for (const x of [88, 194, 258, 326, 380]) g.set(x, row, '@glassWarm');
  puddles(g, backdrop, band, 3);
}

/** Los Altos: the tile roofs shine and the furrows of red earth hold water. */
function altos(g, state, band, backdrop) {
  if (!wet(state)) return;
  recolor(g, backdrop, band, { '@tileLit': '@wTileWet' });
  recolor(g, backdrop, band, { '@earthLit': '@wPuddle' }, (x, y) => (x * 5 + y * 3) % 23 === 0);
  puddles(g, backdrop, band, 5);
}

const VOLCANO = new Set(['@ridgeShade', '@ridge', '@rimLit', '@rimShade']);

// A scarf of cloud hugging the volcano: each row follows the mountain's width at
// that height and trails a little past its slopes, so it wraps it rather than floats.
function scarf(g, backdrop, top, trails, state) {
  trails.forEach(([left, right], i) => {
    const y = top + i;
    let from = -1;
    let to = -1;
    for (let x = 40; x <= 229; x++) {
      if (!VOLCANO.has(backdrop.get(x, y))) continue;
      if (from < 0) from = x;
      to = x;
    }
    if (from < 0) return;
    const part = i === 0 ? 'CloudLit' : i === trails.length - 1 ? 'CloudShade' : 'Cloud';
    g.hline(from - left, y, to - from + 1 + left + right, skyInk(state, part));
  });
}

/**
 * Tequila: a scarf of cloud wraps the volcano's upper slopes with the summit above it,
 * thicker and lower in heavier weather. In rain water lines the nearer furrows.
 */
function tequila(g, state, band, backdrop) {
  const peak = band.base - 38;
  const trails = {
    cloudy: [[-6, -3], [2, 4], [3, 6]],
    rain: [[-6, -2], [2, 4], [4, 7], [3, 5]],
    storm: [[-4, -1], [3, 5], [5, 8], [6, 9], [4, 6]],
  }[state];
  if (trails) scarf(g, backdrop, peak + 4, trails, state);
  if (!wet(state)) return;
  const horizon = band.base - 22;
  recolor(g, backdrop, band, { '@furrow': '@wPuddle' }, (x, y) => y > horizon + 8 && (x + 2 * y) % 9 === 0);
  puddles(g, backdrop, band, 9);
}

/**
 * Per place: its painter, and where its lightning strikes, in rows from the top of its strip.
 * @type {Record<string, { paint: Function, bolt: { x: number, from: number, to: number } }>}
 */
export const JALISCO_WEATHER = {
  guadalajara: { paint: guadalajara, bolt: { x: 118, from: 0, to: 46 } },
  altos: { paint: altos, bolt: { x: 398, from: 2, to: 26 } },
  tequila: { paint: tequila, bolt: { x: 62, from: 3, to: 24 } },
};
