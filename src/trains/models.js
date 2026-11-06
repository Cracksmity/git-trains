// Model catalog. Each describes how the same "chassis" is painted:
//   pal      body colors
//   bands    symbols for rows 11..17 (b body, h light, l dark, t fixed
//            stripe, d very dark, u upper part, a language-colored stripe)
//   row3     symbol for row 3 (roof edge)
//   win      window frame rows
//   winBand  color of a continuous band behind the windows (optional)
//   doors    doors per side on each car: 2 (default) or 3
//   nose     nose drawn as a template (see noses.js); color = nose paint (n),
//            face = front panel (f). The tail uses the same mirrored template.
//   pant     pantograph: 'lead' (lead only), 'alt' (every other car) or null (third rail)
//   articulated  cars run in pairs sharing the bogie at the joint
//   tyres    rubber-tired running gear (rubber tires)
//   loco     (custom trains only, for now) fully drawn locomotive that
//            replaces the cab and nose; see parseLoco in custom.js
// References come from /reference (the original PNG/WEBP files) and photos of the
// real trains that inspire each model.

import { buildNose } from './noses.js';

const common = {
  outline: '#16131a',
  gangway: '#2d2d35',
  wheel: '#25252b',
  skirt: '#3b3b43',
};

export const MODELS = {
  // SITEUR TEG-90 (Guadalajara, line 1): wine red with white stripes, dark gray
  // panels between windows and two-section units on a shared central bogie.
  tram: {
    id: 'tram',
    name: 'Tram',
    pal: {
      ...common,
      roofHi: '#a3a5ad', roof: '#82848c', roofVent: '#62646c',
      upper: '#8a1c2b', body: '#8a1c2b', bodyHi: '#a02a3b', bodyLo: '#701522',
      trim: '#f4f4f4', dark: '#2b2b30',
      glass: '#2f4048', glassHi: '#587481',
      door: '#8a1c2b', doorHi: '#a63446',
    },
    bands: ['b', 't', 't', 'b', 't', 't', 'a'],
    row3: 't',
    win: { y0: 4, y1: 10 },
    winBand: '#34343c',
    nose: buildNose(
      16,
      [9, 11, 12, 13, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 13],
      [
        ['r', 3, 3, 11, 3, 'g'], ['r', 3, 4, 12, 12, 'g'], // large windshield
        ['r', 2, 3, 2, 13, 'o'], ['r', 2, 13, 13, 13, 'm'], // windshield pillar and base
        ['p', 4, 11, 'G'], ['p', 5, 10, 'G'], ['p', 6, 9, 'G'], ['p', 7, 8, 'G'], ['p', 8, 7, 'G'],
        ['p', 9, 6, 'G'], ['p', 10, 5, 'G'], ['p', 6, 11, 'G'], ['p', 7, 10, 'G'], ['p', 8, 9, 'G'], // reflection
        ['r', 12, 15, 13, 16, 'y'], ['p', 13, 15, 'l'], // headlights
        ['r', 8, 17, 15, 18, 'k'], // bumper
      ],
    ),
    pant: 'lead',
    pantX: 24,
    roofBoxes: true,
    articulated: true,
  },

  // NC-82 of the Mexico City Metro: orange, steel doors, faceted front (the
  // windshield widens toward the headlights and the skirt tapers inward) and rubber tires.
  'metro-orange': {
    id: 'metro-orange',
    name: 'Orange metro',
    pal: {
      ...common,
      roofHi: '#ff8c33', roof: '#e2610a', roofVent: '#c4510a',
      upper: '#f26a0f', body: '#f26a0f', bodyHi: '#ff8638', bodyLo: '#d9560a',
      trim: '#f4efe4', dark: '#3a3a40',
      glass: '#272b42', glassHi: '#454c69',
      door: '#9b9ba1', doorHi: '#bcbcc2',
    },
    bands: ['b', 'b', 'a', 'a', 'b', 'l', 'l'],
    row3: 'u',
    win: { y0: 4, y1: 10 },
    doors: 3,
    nose: buildNose(
      15,
      [9, 10, 11, 11, 11, 12, 12, 12, 12, 13, 13, 13, 13, 14, 14, 13, 13, 12, 11, 10],
      [
        ['e', 3, 12, 6, 1, 'k'], ['e', 4, 11, 5, 2, 'g'], // sloped windshield with black frame
        ['e', 4, 4, 4, 3, 'i'], ['ep', 6, -4, 'G'], ['ep', 7, -3, 'G'], // route indicator and reflection
        ['ep', 13, -1, 'l'], ['ep', 14, -1, 'l'], // headlights on the edge
        ['e', 15, 17, 3, 0, 'm'], // tapered skirt, in shadow
        ['e', 18, 19, 5, 0, 'k'], // bumper
      ],
    ),
    pant: null,
    roofBoxes: true,
    tyres: true,
  },

  // Frota L of the Metr? de S?o Paulo (Mafersa modernized by Alstom/IESA, such as
  // the L43): stainless steel, ribbed below, nearly vertical front with black mask
  // and curves in the line color.
  'metro-gray': {
    id: 'metro-gray',
    name: 'Gray metro',
    pal: {
      ...common,
      roofHi: '#c3c8d0', roof: '#9aa0aa', roofVent: '#7d838e',
      upper: '#b7bcc5', body: '#b7bcc5', bodyHi: '#d2d6dd', bodyLo: '#959ba6',
      trim: '#f2f4f7', dark: '#2f3340',
      glass: '#1f2540', glassHi: '#3f4a75',
      door: '#c0c5ce', doorHi: '#dde0e6',
    },
    bands: ['a', 'a', 'b', 'l', 'b', 'l', 'b'],
    row3: 'h',
    win: { y0: 4, y1: 10 },
    doors: 3,
    nose: {
      ...buildNose(
        13,
        [7, 9, 10, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 11, 10],
        [
          ['e', 1, 11, 6, 1, 'f'], // black mask
          ['e', 3, 9, 5, 2, 'g'], ['e', 3, 3, 4, 3, 'i'], ['ep', 5, -4, 'G'], ['ep', 6, -3, 'G'], // windshield and sign
          ['e', 12, 17, 6, 0, 'n'], // smooth lower face
          ['e', 13, 13, 6, 3, 'a'], ['e', 14, 14, 4, 1, 'a'], // curve in the line color
          ['e', 15, 15, 2, 1, 'k'], ['ep', 15, -1, 'l'], ['ep', 16, -1, 'q'], // headlight and marker light
          ['e', 18, 19, 4, 0, 'd'], // anticlimber
        ],
      ),
      color: '#c9cdd5',
      face: '#1c1f26',
    },
    pant: null,
    roofBoxes: true,
  },

  // A650 of the L.A. Metro, refurbished: ribbed stainless steel, red line
  // on the roof and below the windows, yellow front with black mask and
  // a central emergency door.
  'metro-yellow': {
    id: 'metro-yellow',
    name: 'Yellow metro',
    pal: {
      ...common,
      roofHi: '#bbbec4', roof: '#90939a', roofVent: '#6f7279',
      upper: '#a8aaaf', body: '#a8aaaf', bodyHi: '#c2c4c9', bodyLo: '#8b8d93',
      trim: '#6d6f75', dark: '#2c2c32',
      glass: '#25283a', glassHi: '#474c69',
      door: '#b3b5ba', doorHi: '#d0d2d6',
    },
    bands: ['b', 'a', 'a', 'l', 'b', 'l', 'b'],
    row3: 'a',
    win: { y0: 4, y1: 10 },
    doors: 3,
    nose: {
      ...buildNose(
        16,
        [11, 13, 14, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 14],
        [
          ['e', 1, 17, 12, 0, 'n'], // yellow front
          ['e', 3, 10, 11, 1, 'k'], // black mask
          ['e', 4, 9, 10, 9, 'G'], ['e', 4, 10, 6, 5, 'G'], ['e', 4, 9, 2, 1, 'G'], // window, door, and window
          ['e', 5, 9, 9, 9, 'g'], ['e', 5, 10, 5, 5, 'g'], ['e', 5, 9, 1, 1, 'g'],
          ['e', 11, 16, 7, 7, 'o'], ['e', 11, 16, 4, 4, 'o'], // emergency door leaves
          ['e', 13, 13, 11, 11, 'q'], ['e', 13, 13, 10, 10, 'l'], // headlights and marker lights
          ['e', 13, 13, 2, 2, 'l'], ['e', 13, 13, 1, 1, 'q'],
          ['e', 17, 18, 10, 0, 'k'], // bumper
        ],
      ),
      color: '#f6d90c',
    },
    pant: null,
    roofBoxes: true,
  },

  // Alstom Metropolis of Guadalajara line 3: white, dark window band,
  // red stripe and black face framed in white; overhead wires.
  'metro-white': {
    id: 'metro-white',
    name: 'White metro',
    pal: {
      ...common,
      roofHi: '#cdd2da', roof: '#a5abb6', roofVent: '#8a909c',
      upper: '#e6e9ee', body: '#e6e9ee', bodyHi: '#f6f7f9', bodyLo: '#bfc5cf',
      trim: '#c4122f', dark: '#3a3f4b',
      glass: '#262b36', glassHi: '#4a5466',
      door: '#eef0f4', doorHi: '#ffffff',
    },
    bands: ['b', 't', 'b', 'a', 'b', 'l', 'l'],
    row3: 'u',
    win: { y0: 4, y1: 10 },
    winBand: '#2b2f38',
    doors: 3,
    nose: {
      ...buildNose(
        15,
        [6, 9, 10, 11, 12, 12, 13, 13, 13, 14, 14, 14, 14, 14, 14, 14, 14, 13, 12, 11],
        [
          ['e', 2, 14, 6, 1, 'f'], // black face
          ['e', 4, 10, 5, 2, 'g'], ['e', 3, 3, 4, 2, 'i'], ['ep', 5, -4, 'G'], ['ep', 6, -3, 'G'], // windshield and sign
          ['ep', 13, -1, 'l'], ['ep', 13, -2, 'l'], // headlights
          ['e', 18, 19, 5, 0, 'k'], // bumper
        ],
      ),
      face: '#17191f',
    },
    pant: 'alt',
    pantX: 28,
    roofBoxes: false,
  },

  bullet: {
    id: 'bullet',
    name: 'Bullet train',
    pal: {
      ...common,
      roofHi: '#e2e6eb', roof: '#b9bec7', roofVent: '#9ca2ac',
      upper: '#eceff2', body: '#eceff2', bodyHi: '#ffffff', bodyLo: '#c9cdd4',
      trim: '#8b9098', dark: '#5d626b',
      glass: '#2a2f38', glassHi: '#4d5662',
      door: '#f4f6f8', doorHi: '#ffffff',
      skirt: '#6c717a',
    },
    bands: ['b', 'b', 'a', 'a', 'b', 'l', 'd'],
    row3: 'u',
    win: { y0: 5, y1: 9 },
    nose: buildNose(
      24,
      [1, 4, 7, 9, 11, 13, 15, 16, 17, 18, 19, 20, 20, 21, 21, 21, 21, 20, 18, 15],
      [
        ['e', 2, 9, 9, 2, 'g'], ['e', 2, 9, 10, 10, 'o'], ['e', 2, 2, 9, 5, 'G'], // long windshield
        ['e', 10, 10, 10, 2, 'o'],
        ['ep', 15, -2, 'l'], // headlight
      ],
    ),
    cabWindows: 14,
    cabBogieOff: 30,
    pant: 'lead',
    pantX: 56,
    roofBoxes: false,
  },
};

// "Evolution" order: more contributions mean more cars and a faster model.
export const MODEL_ORDER = [
  'tram',
  'metro-orange',
  'metro-gray',
  'metro-yellow',
  'metro-white',
  'bullet',
];

// Earlier ids that are still accepted (the original Spanish ones).
export const MODEL_ALIASES = {
  tranvia: 'tram',
  'metro-naranja': 'metro-orange',
  'metro-gris': 'metro-gray',
  'metro-amarillo': 'metro-yellow',
  'metro-blanco': 'metro-white',
  suburbano: 'metro-white',
  bala: 'bullet',
};

export const modelId = (id) => MODEL_ALIASES[id] ?? id;

export function getModel(id) {
  const m = MODELS[modelId(id)];
  if (!m) {
    throw new Error(`Unknown train model: "${id}". Options: auto, ${MODEL_ORDER.join(', ')}`);
  }
  return m;
}
