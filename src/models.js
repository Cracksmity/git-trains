// Catálogo de modelos. Cada uno describe cómo se pinta el mismo "chasis":
//   pal      colores de la carrocería
//   bands    símbolos de las filas 11..17 (b cuerpo, h claro, l oscuro, t franja
//            fija, d muy oscuro, u parte alta, a franja del color del lenguaje)
//   row3     símbolo de la fila 3 (borde de techo)
//   win      filas del marco de las ventanas
//   winBand  color de una banda continua detrás de las ventanas (opcional)
//   doors    puertas por lado en cada coche: 2 (por defecto) o 3
//   nose     trompa dibujada como plantilla (ver noses.js); color = pintura de trompa (n),
//            face = panel frontal (f). La cola usa la misma plantilla espejada.
//   pant     pantógrafo: 'lead' (solo cabeza), 'alt' (cada dos coches) o null (tercer riel)
//   articulated  los coches van en pares que comparten el bogie de la unión
//   tyres    rodadura neumática (llantas de goma)
// Las referencias vienen de /reference (los PNG/WEBP originales) y de fotos de los
// trenes reales que inspiran cada modelo.

import { buildNose } from './noses.js';

const common = {
  outline: '#16131a',
  gangway: '#2d2d35',
  wheel: '#25252b',
  skirt: '#3b3b43',
};

export const MODELS = {
  // TEG-90 de SITEUR (Guadalajara, línea 1): vino con franjas blancas, paneles gris
  // oscuro entre ventanas y unidades de dos cuerpos sobre un bogie central compartido.
  tranvia: {
    id: 'tranvia',
    name: 'Tranvía',
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
        ['r', 3, 3, 11, 3, 'g'], ['r', 3, 4, 12, 12, 'g'], // parabrisas grande
        ['r', 2, 3, 2, 13, 'o'], ['r', 2, 13, 13, 13, 'm'], // pilar y base del parabrisas
        ['p', 4, 11, 'G'], ['p', 5, 10, 'G'], ['p', 6, 9, 'G'], ['p', 7, 8, 'G'], ['p', 8, 7, 'G'],
        ['p', 9, 6, 'G'], ['p', 10, 5, 'G'], ['p', 6, 11, 'G'], ['p', 7, 10, 'G'], ['p', 8, 9, 'G'], // reflejo
        ['r', 12, 15, 13, 16, 'y'], ['p', 13, 15, 'l'], // faros
        ['r', 8, 17, 15, 18, 'k'], // defensa
      ],
    ),
    pant: 'lead',
    pantX: 24,
    roofBoxes: true,
    articulated: true,
  },

  // NC-82 del Metro de la CDMX: naranja, puertas de acero, frente facetado (el
  // parabrisas se abre hacia los faros y el faldón se recoge) y rodadura neumática.
  'metro-naranja': {
    id: 'metro-naranja',
    name: 'Metro naranja',
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
        ['e', 3, 12, 6, 1, 'k'], ['e', 4, 11, 5, 2, 'g'], // parabrisas inclinado con marco negro
        ['e', 4, 4, 4, 3, 'i'], ['ep', 6, -4, 'G'], ['ep', 7, -3, 'G'], // indicador de ruta y reflejo
        ['ep', 13, -1, 'l'], ['ep', 14, -1, 'l'], // faros en la arista
        ['e', 15, 17, 3, 0, 'm'], // faldón recogido, en sombra
        ['e', 18, 19, 5, 0, 'k'], // defensa
      ],
    ),
    pant: null,
    roofBoxes: true,
    tyres: true,
  },

  // Frota L del Metrô de São Paulo (Mafersa modernizado por Alstom/IESA, como el
  // L43): acero inoxidable, acanalado abajo, frente casi vertical con máscara negra
  // y curvas del color de la línea.
  'metro-gris': {
    id: 'metro-gris',
    name: 'Metro gris',
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
          ['e', 1, 11, 6, 1, 'f'], // máscara negra
          ['e', 3, 9, 5, 2, 'g'], ['e', 3, 3, 4, 3, 'i'], ['ep', 5, -4, 'G'], ['ep', 6, -3, 'G'], // parabrisas y letrero
          ['e', 12, 17, 6, 0, 'n'], // cara inferior lisa
          ['e', 13, 13, 6, 3, 'a'], ['e', 14, 14, 4, 1, 'a'], // curva del color de la línea
          ['e', 15, 15, 2, 1, 'k'], ['ep', 15, -1, 'l'], ['ep', 16, -1, 'q'], // faro y piloto
          ['e', 18, 19, 4, 0, 'd'], // antitrepador
        ],
      ),
      color: '#c9cdd5',
      face: '#1c1f26',
    },
    pant: null,
    roofBoxes: true,
  },

  // A650 del Metro de Los Ángeles, ya renovado: acero inoxidable acanalado, línea
  // roja en el techo y bajo las ventanas, frente amarillo con máscara negra y puerta
  // de emergencia al centro.
  'metro-amarillo': {
    id: 'metro-amarillo',
    name: 'Metro amarillo',
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
          ['e', 1, 17, 12, 0, 'n'], // frente amarillo
          ['e', 3, 10, 11, 1, 'k'], // máscara negra
          ['e', 4, 9, 10, 9, 'G'], ['e', 4, 10, 6, 5, 'G'], ['e', 4, 9, 2, 1, 'G'], // ventana, puerta y ventana
          ['e', 5, 9, 9, 9, 'g'], ['e', 5, 10, 5, 5, 'g'], ['e', 5, 9, 1, 1, 'g'],
          ['e', 11, 16, 7, 7, 'o'], ['e', 11, 16, 4, 4, 'o'], // hojas de la puerta de emergencia
          ['e', 13, 13, 11, 11, 'q'], ['e', 13, 13, 10, 10, 'l'], // faros y pilotos
          ['e', 13, 13, 2, 2, 'l'], ['e', 13, 13, 1, 1, 'q'],
          ['e', 17, 18, 10, 0, 'k'], // defensa
        ],
      ),
      color: '#f6d90c',
    },
    pant: null,
    roofBoxes: true,
  },

  // Alstom Metropolis de la línea 3 de Guadalajara: blanco, banda de ventanas
  // oscura, franja roja y cara negra enmarcada en blanco; catenaria.
  'metro-blanco': {
    id: 'metro-blanco',
    name: 'Metro blanco',
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
          ['e', 2, 14, 6, 1, 'f'], // cara negra
          ['e', 4, 10, 5, 2, 'g'], ['e', 3, 3, 4, 2, 'i'], ['ep', 5, -4, 'G'], ['ep', 6, -3, 'G'], // parabrisas y letrero
          ['ep', 13, -1, 'l'], ['ep', 13, -2, 'l'], // faros
          ['e', 18, 19, 5, 0, 'k'], // defensa
        ],
      ),
      face: '#17191f',
    },
    pant: 'alt',
    pantX: 28,
    roofBoxes: false,
  },

  bala: {
    id: 'bala',
    name: 'Tren bala',
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
        ['e', 2, 9, 9, 2, 'g'], ['e', 2, 9, 10, 10, 'o'], ['e', 2, 2, 9, 5, 'G'], // parabrisas largo
        ['e', 10, 10, 10, 2, 'o'],
        ['ep', 15, -2, 'l'], // faro
      ],
    ),
    cabWindows: 14,
    cabBogieOff: 30,
    pant: 'lead',
    pantX: 56,
    roofBoxes: false,
  },
};

// Orden de "evolución": con más contribuciones, más vagones y un modelo más veloz.
export const MODEL_ORDER = [
  'tranvia',
  'metro-naranja',
  'metro-gris',
  'metro-amarillo',
  'metro-blanco',
  'bala',
];

// Nombres anteriores que se siguen aceptando en la entrada `tren`.
const ALIASES = { suburbano: 'metro-blanco' };

export function getModel(id) {
  const m = MODELS[ALIASES[id] ?? id];
  if (!m) {
    throw new Error(`Modelo de tren desconocido: "${id}". Opciones: auto, ${MODEL_ORDER.join(', ')}`);
  }
  return m;
}
