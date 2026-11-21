import { Grid } from '../graphics/pixel.js';
import { line } from '../graphics/pixel-shapes.js';
import { LOCO_ROWS } from './geometry.js';

// Side elevations facing right. The letters are paint, shared with the mini renderer.
const metal = {
  o: '#19242b', k: '#28353b', d: '#3a484d', m: '#56666b', h: '#839296',
  t: '#d0d3c9', g: '#25383d', G: '#577477', l: '#fff3bb',
};

function rowsOf(grid) {
  return Array.from({ length: grid.h }, (_, y) =>
    grid.cells.slice(y * grid.w, (y + 1) * grid.w).map((pixel) => pixel ?? '.').join(''));
}

function fuelTank(g, x, w) {
  g.rect(x, 23, w, 4, 'k');
  g.hline(x + 1, 27, w - 2, 'o');
  g.hline(x + 1, 23, w - 2, 'm');
  for (const strap of [x + 2, x + w - 4]) g.vline(strap, 24, 3, 'd');
}

export function ferromexFreight() {
  const g = new Grid(84, LOCO_ROWS);
  // The radiator overhang and the wide cab meet at nearly the same roofline.
  g.rect(5, 7, 57, 15, 'f');
  g.hline(4, 6, 58, 'h');
  g.rect(3, 7, 20, 4, 'd');
  g.rect(5, 8, 17, 2, 'k');
  g.hline(7, 5, 12, 'm');
  g.hline(26, 5, 11, 'm');
  g.rect(48, 4, 4, 2, 'o');
  g.rect(55, 7, 21, 15, 'n');
  g.rect(61, 5, 15, 5, 'C');
  g.hline(60, 5, 17, 'n');
  g.hline(61, 4, 14, 'C');
  // Two broad diagonal gray bands wrap around the dark hood, spaced so they still
  // read at README size. The narrower silver chevrons continue across the red
  // equipment doors ahead of it.
  for (let y = 7; y < 21; y++) {
    const offset = Math.floor((y - 7) * 0.55);
    for (const x of [18, 40]) g.hline(x - offset, y, 6, 'm');
    const elbow = 3 - Math.floor(Math.abs(y - 14) / 2);
    for (const x of [52, 58]) g.hline(x + elbow, y, 2, 't');
  }
  for (const x of [6, 27, 46]) {
    g.hline(x, 8, 5, 'o');
    g.hline(x, 10, 5, 'k');
    g.vline(x + 1, 17, 4, 'd');
  }
  g.rect(64, 8, 11, 6, 'o');
  g.rect(65, 9, 4, 4, 'G');
  g.rect(70, 9, 4, 4, 'g');
  g.hline(65, 13, 9, 'R');
  g.rect(75, 13, 5, 9, 'n');
  g.hline(75, 12, 4, 'C');
  g.vline(79, 14, 7, 'R');
  g.set(78, 15, 'l');
  g.rect(2, 21, 80, 3, 'k');
  g.hline(2, 21, 80, 't');
  g.hline(3, 23, 78, 'o');
  fuelTank(g, 27, 28);
  for (const x of [6, 58]) {
    g.rect(x, 24, 19, 4, 'o');
    g.hline(x + 2, 25, 15, 'm');
  }
  for (const x of [3, 22, 42, 61]) g.vline(x, 16, 5, 'k');
  g.hline(3, 16, 59, 'k');
  g.hline(3, 15, 3, 'm');
  g.vline(81, 16, 6, 't');
  for (const y of [23, 25, 27]) g.hline(77, y, 5, 'm');
  return {
    w: g.w, rows: rowsOf(g), diesel: true,
    inks: { ...metal, f: '#33414a', m: '#64747c', n: '#c3333b', C: '#e34e4a', R: '#96303c' },
    wheels: { d: 5, drive: [8, 15, 22, 60, 67, 74], small: [], rod: false, color: '#394348' },
  };
}

// A narrower hood, two fan housings, a cab visor, a low blunt nose and a
// side walkway identify the passenger locomotive in profile.
export function cuervoLocomotive() {
  const g = new Grid(76, LOCO_ROWS);
  g.rect(3, 8, 47, 14, 'f');
  g.hline(3, 7, 47, 'm');
  for (const x of [8, 22]) {
    g.hline(x, 6, 8, 'k');
    g.hline(x + 1, 5, 6, 'm');
    g.rect(x + 1, 10, 6, 3, 'k');
    g.hline(x + 1, 11, 6, 'd');
  }
  for (const x of [6, 17, 28, 39, 46]) {
    g.vline(x, 14, 5, 'k');
    g.set(x + 1, 16, 'm');
  }
  g.rect(37, 6, 8, 2, 'd');
  g.rect(48, 6, 15, 17, 'n');
  g.hline(48, 5, 16, 'd');
  g.hline(50, 4, 12, 'm');
  g.rect(49, 7, 13, 7, 'o');
  g.rect(50, 8, 5, 5, 'g');
  g.hline(50, 8, 4, 'G');
  g.rect(56, 8, 4, 5, 'g');
  g.hline(56, 8, 3, 'G');
  g.vline(61, 8, 2, 'l');
  g.rect(63, 14, 9, 9, 'n');
  g.hline(63, 13, 9, 'h');
  g.vline(71, 14, 7, 'd');
  g.rect(1, 21, 73, 4, 'd');
  g.hline(1, 22, 73, 't');
  // The gold band rises from the sill to the bottom of the cab windows.
  line(g, 33, 21, 48, 14, 't');
  line(g, 35, 21, 50, 14, 't');
  g.hline(48, 14, 14, 't');
  g.hline(1, 24, 73, 'o');
  for (const x of [8, 21, 33, 46, 59, 70]) g.set(x, 23, 'm');
  fuelTank(g, 26, 24);
  for (const x of [6, 51]) {
    g.rect(x, 24, 19, 4, 'k');
    g.hline(x + 1, 25, 17, 'm');
  }
  // Fine continuous handrail. Both the walkway and the front steps are square.
  for (const x of [2, 13, 25, 37]) g.vline(x, 18, 4, 'h');
  for (const x of [49, 62, 72]) g.vline(x, 20, 2, 'h');
  g.hline(2, 18, 40, 't');
  line(g, 42, 18, 48, 20, 't');
  g.hline(48, 20, 25, 't');
  for (const y of [24, 26]) g.hline(71, y, 4, 't');
  return {
    w: g.w, rows: rowsOf(g), diesel: true,
    inks: { o: '#1c2028', k: '#26242b', f: '#363c3c', n: '#282a2b', d: '#313639',
      m: '#514d4a', h: '#ceaa69', t: '#d3a353', g: '#374d56', G: '#91a7a4', l: '#fff4b0' },
    wheels: { d: 7, drive: [10, 20, 55, 65], small: [], rod: false, color: '#3d4145' },
  };
}
