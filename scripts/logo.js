// The project logo, drawn on a 120x120 pixel grid and written with no dependencies.
//
//   npm run logo     docs/logo.{svg,png}      the sign-car mark (README, avatar)
//                    docs/favicon.{svg,png}   the simpler "gt over commits" mark
//
// Both share the palette of the trains: night blue, white body, yellow stripe, green signal.

import { writeFileSync } from 'node:fs';
import { png } from './export.js';

const C = {
  night: '#0b1026',
  panel: '#1a2347',
  white: '#f1f3f8',
  yellow: '#f5c518',
  green: '#34d058',
  rail: '#8b93b8',
};

// "gt" in a 4-column pixel font on an 8px grid, relative to (24, 18).
const GT = [
  [32, 26, 24, 8], [24, 34, 8, 16], [48, 34, 8, 16], [32, 50, 24, 8], [48, 58, 8, 8], [32, 66, 24, 8],
  [72, 18, 8, 40], [64, 26, 24, 8], [80, 50, 16, 8],
];
const place = (rects, color, move) => rects.map((r) => [...move(r), color]);

// F: a train car whose LED sign spells "gt", with commits for wheels.
const logo = [
  [0, 0, 120, 120, C.night],
  [10, 30, 88, 48, C.white],
  [98, 34, 4, 44, C.white],
  [102, 40, 4, 38, C.white],
  [106, 50, 4, 28, C.white],
  [18, 36, 64, 30, C.panel],
  ...place(GT, C.yellow, ([x, y, w, h]) => [20 + x / 2, 28 + y / 2, w / 2, h / 2]),
  [10, 70, 88, 4, C.green],
  [20, 90, 76, 4, C.rail],
  [16, 86, 12, 12, C.green],
  [48, 86, 12, 12, C.green],
  [80, 86, 12, 12, C.green],
];

// E: "gt" over a line of commits. Reads at 16px, where the car loses its detail.
const favicon = [
  [0, 0, 120, 120, C.night],
  ...place(GT, C.white, ([x, y, w, h]) => [x, y - 6, w, h]),
  [20, 90, 80, 4, C.yellow],
  [14, 86, 12, 12, C.green],
  [54, 86, 12, 12, C.green],
  [94, 86, 12, 12, C.green],
];

const svg = (title, rects) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" shape-rendering="crispEdges" role="img">\n` +
  `<title>${title}</title>\n` +
  rects
    .map(([x, y, w, h, fill], i) => `<rect${i ? '' : ' rx="12"'} x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`)
    .join('\n') +
  `\n</svg>\n`;

// The first rect is the tile: it gets rounded corners, with the outside left transparent.
function raster(rects, scale) {
  const n = 120 * scale;
  const out = Buffer.alloc(n * n * 4);
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (const [x, y, w, h, fill] of rects) {
    const [r, g, b] = rgb(fill);
    for (let py = y * scale; py < (y + h) * scale; py++) {
      for (let px = x * scale; px < (x + w) * scale; px++) out.set([r, g, b, 255], (py * n + px) * 4);
    }
  }
  const rad = 12 * scale;
  for (let py = 0; py < n; py++) {
    for (let px = 0; px < n; px++) {
      const dx = Math.max(rad - (px + 0.5), px + 0.5 - (n - rad), 0);
      const dy = Math.max(rad - (py + 0.5), py + 0.5 - (n - rad), 0);
      const a = Math.min(1, Math.max(0, rad - Math.hypot(dx, dy) + 0.5));
      out[(py * n + px) * 4 + 3] = Math.round(a * 255);
    }
  }
  return png(n, n, out);
}

writeFileSync('docs/logo.svg', svg('git-trains', logo));
writeFileSync('docs/logo.png', raster(logo, 5));
writeFileSync('docs/favicon.svg', svg('git-trains', favicon));
writeFileSync('docs/favicon.png', raster(favicon, 2));
console.log('docs/logo.{svg,png} docs/favicon.{svg,png}');
