import { cuervoLocomotive, ferromexFreight } from './jalisco-diesels.js';

const base = {
  outline: '#1c2028', gangway: '#343239', wheel: '#3d4145', skirt: '#514e51',
  roof: '#888588', roofHi: '#c2b9a7', roofVent: '#5c6064', dark: '#313639',
  glass: '#374d56', glassHi: '#91a7a4', door: '#854340', doorHi: '#b65c56',
};

// Driver's side window, broad windscreen and inset rectangular headlights.
// Only the roof corner and the skirt recede, by a single pixel. The windscreen
// keeps the black surround (o); the silhouette uses the softer edge (e).
const tegEdge = '#4b4449';
const tegNose = [
  'sssssssssssss.', 'ssssssssssssss', 'nnnnnnnnnnnnnn', 'oooooonnnooooo',
  'oggggonnoGGggo', 'ogGggonnoGgggo', 'oggggonnoGgggo', 'oggggonnoggggo',
  'oggggonnogggGo', 'oggggonnoggggo', 'oooooonnooooog', 'tttttttttttttt',
  'tttttttttttttt', 'nnnnnnnnnnnnnn', 'nnnnnnnnnoooon', 'nnnnnnnnnollon',
  'nnnnnnnnnoooon', 'mmmmmmmmmmmmmm', 'nnnnnnnnnnnnnn', 'eeeeeeeeeeeee.',
];

export const JALISCO_TRAINS = [
  {
    id: 'teg-90', name: 'SITEUR TEG-90', coach: 'teg',
    pal: { ...base, body: '#c95d60', bodyHi: '#db7977', bodyLo: '#9e4c53', upper: '#332f34',
      trim: '#ece5db', door: '#a6a9a9', glass: '#384747', glassHi: '#748b8b', roofHi: '#bcb5ad',
      // A light car outlined in near-black looked inked next to the diesels.
      edge: tegEdge, seal: '#5c5e64' },
    bands: [...'ttbbblb'], row3: 'u', win: { y0: 3, y1: 10 },
    nose: { w: 14, rows: tegNose, color: '#cc6366', lo: '#a0a6a6', inks: { e: tegEdge } },
    pant: 'lead', articulated: true, doors: 2, roofBoxes: false,
  },
  {
    id: 'ferromex', name: 'Carguero de Los Altos', coach: 'hopper', carWidth: 60,
    pal: { ...base, body: '#c5b696', bodyHi: '#d8c9ae', bodyLo: '#99836d', upper: '#c5b696', trim: '#eee1c3' },
    bands: [...'hhbblll'], row3: 'h', win: { y0: 4, y1: 10 }, loco: ferromexFreight(),
  },
  {
    id: 'jose-cuervo-express', name: 'José Cuervo Express', coach: 'saloon', carWidth: 56,
    pal: { ...base, body: '#292c32', bodyHi: '#424247', bodyLo: '#22252b', upper: '#363638',
      trim: '#d3a353', glass: '#c79b62', glassHi: '#e5c38c', roof: '#737278', roofHi: '#9a9389', door: '#56504a' },
    bands: [...'tbbbltl'], row3: 't', win: { y0: 4, y1: 10 }, loco: cuervoLocomotive(),
  },
];
