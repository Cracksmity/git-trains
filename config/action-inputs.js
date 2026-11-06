// config/action-inputs.js: focused action-inputs operations.



// Before v1 the inputs had Spanish names. They still work, with a warning; when
// one is set it wins, because the English input may just be holding its default.
export const LEGACY_INPUTS = {
  user: 'usuario',
  train: 'tren',
  skyline: 'fondo',
  mode: 'modo',
  theme: 'tema',
  language: 'idioma',
  label: 'etiqueta',
  scale: 'escala',
  'output-dir': 'salida',
  cards: 'tarjetas',
  rank: 'rango',
  border: 'borde',
  'max-languages': 'lenguajes-max',
  'color-background': 'color-fondo',
  'color-title': 'color-titulo',
  'color-icon': 'color-icono',
  'color-text': 'color-texto',
  'color-ring': 'color-anillo',
};

export const LEGACY_VALUES = { rank: { letra: 'letter' } };

export const THEMES = ['light', 'dark', 'auto', 'both'];

export const CARDS = ['none', 'stats', 'languages', 'departures', 'both'];

export const CARD_ALIASES = { langs: 'languages' };

export const RANKS = ['letter', 'github'];

export const BOOLEANS = ['true', 'false'];
