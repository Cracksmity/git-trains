// The pixel art of the year in review (review.js lays the poster out and draws the text):
// the stat panels and their icons, the hills behind the line, the rail, and one station
// per month, drawn as a tower that stands as tall as that month was busy.
//
// Every function paints into a Grid in art pixels (the poster draws the grid at 2x, so one
// art pixel is 2 SVG units) and only uses the tones below, by name ('@tower'). A tone is one
// of the poster's five colors (background, title, icon, text, ring), as they are or at a
// lower opacity, so the colors the user picks, and the light and dark themes, reach all of it.
// The train is not here: it brings its own colors (see mini.js).

// name -> [role, opacity]. The roles are the five card colors.
export const TONES = {
  panel: ['text', 0.07], // neutral casing, with a quiet recessed number display
  display: ['text', 0.025],
  edge: ['text', 0.22],
  edgeHi: ['text', 0.34],
  edgeLo: ['text', 0.12],
  screw: ['text', 0.45],
  icon: ['icon', 1], // the icons on the panels
  iconLo: ['icon', 0.55],
  led: ['title', 1], // the big numbers
  hill: ['ring', 0.07], // distance is quieter than the station silhouettes
  hill2: ['ring', 0.13],
  tree: ['ring', 0.23],
  treeHi: ['ring', 0.32],
  distant: ['text', 0.17],
  distantHi: ['text', 0.28],
  lamp: ['title', 0.65],
  rail: ['icon', 0.85],
  railHi: ['text', 0.65],
  railLo: ['icon', 0.4],
  tie: ['text', 0.35],
  ballast: ['text', 0.1],
  gravel: ['text', 0.21],
  platform: ['text', 0.25],
  safety: ['title', 0.8],
  tower: ['ring', 0.68], // left edges catch the light; right walls recede
  towerHi: ['ring', 1],
  towerLo: ['ring', 0.4],
  towerGlass: ['ring', 0.2],
  towerWin: ['background', 1], // holes, not a fixed light or dark color
  star: ['title', 0.72], // every part of the busiest station has a matching tone
  starHi: ['title', 1],
  starLo: ['title', 0.44],
  starGlass: ['title', 0.22],
  starWin: ['background', 1],
};

export const STAT_ICONS = ['total', 'days', 'streak', 'busiest'];
export const ICON_SIZE = 7;
export const STATION_W = 14;
export const STATION_MIN_H = 8;
export const STATION_MAX_H = 54;

// How tall the station of a month is, in art pixels: 0 for a month with no contributions
// (it gets a closed hut instead), at least STATION_MIN_H for any other, and STATION_MAX_H for
// the busiest. Linear, so a month twice as busy stands twice as tall.
export function stationHeight(value, max) {
  if (!(value > 0) || !(max > 0)) return 0;
  return Math.max(STATION_MIN_H, Math.round((value / max) * STATION_MAX_H));
}

// The label and footer sit on the casing. The inset leaves the LED's full drawing
// area clear; a single bright upper edge suggests the bevel without stippling it.
export function paintPanel(g, x, y, w, h) {
  g.rect(x + 1, y, w - 2, h, '@panel');
  g.rect(x, y + 1, w, h - 2, '@panel');
  g.hline(x + 1, y, w - 2, '@edgeHi');
  g.hline(x + 1, y + h - 1, w - 2, '@edgeLo');
  g.vline(x, y + 1, h - 2, '@edgeHi');
  g.vline(x + w - 1, y + 1, h - 2, '@edge');
  g.rect(x + 3, y + 14, w - 6, h - 26, '@display');
  g.hline(x + 4, y + 13, w - 8, '@edgeLo');
  g.vline(x + 3, y + 14, h - 26, '@edgeLo');
  g.hline(x + 4, y + h - 12, w - 8, '@edge');
  for (const sx of [x + 2, x + w - 4]) {
    g.hline(sx, y + 2, 2, '@screw');
    g.hline(sx, y + h - 3, 2, '@edge');
  }
}

const ICONS = {
  // Ascending bars, a checked calendar, a hollow flame, and a handled trophy.
  total: ['......#', '......#', '...##.#', '...#+.#', '##.#+.#', '#+.#+.#', '+++++++'],
  days: ['.#...#.', '#######', '+.....+', '+....#+', '+.#.#.+', '+..#..+', '.+++++.'],
  streak: ['...#...', '..##...', '..###..', '.##.##.', '##...#+', '.#..#+.', '..+++..'],
  busiest: ['.#####.', '#+###+#', '#+###+#', '.+###+.', '..+++..', '...#...', '.#####.'],
};

export function paintStatIcon(g, kind, x, y) {
  const rows = ICONS[kind];
  if (!rows) throw new Error(`Unknown stat icon: "${kind}". Options: ${STAT_ICONS.join(', ')}`);
  rows.forEach((row, j) => [...row].forEach((s, i) => {
    if (s !== '.') g.set(x + i, y + j, s === '#' ? '@icon' : '@iconLo');
  }));
}

// Broad, stepped ridges merge into long runs in Grid.paths. All scenery is low:
// the sky above the tallest stations belongs to their numeric labels.
export function paintBackdrop(g, { width, railY }) {
  for (let x = 0; x < width; x += 4) {
    const far = railY - 26 + 2 * Math.round(4 * Math.sin(x / 32 + 1) + 2 * Math.sin(x / 17));
    const near = railY - 12 + 2 * Math.round(2 * Math.sin(x / 26 + 4));
    const w = Math.min(4, width - x);
    g.rect(x, far, w, railY - far, '@hill');
    g.rect(x, near, w, railY - near, '@hill2');
  }

  // A little hamlet and a water tank sit between the monthly columns.
  const village = Math.round(width * 0.41);
  for (const [dx, rise] of [[0, 0], [11, 3], [24, 1]]) {
    const x = village + dx;
    const y = railY - 24 - rise;
    g.rect(x, y, 8, 6, '@distant');
    g.hline(x + 2, y - 2, 4, '@distantHi');
    g.hline(x + 1, y - 1, 6, '@distantHi');
    g.rect(x + 2, y + 2, 2, 2, '@hill');
    g.vline(x + 6, y + 2, 4, '@distantHi');
  }
  const tank = Math.round(width * 0.8);
  const tankY = railY - 31;
  g.vline(tank - 3, tankY + 7, 13, '@distantHi');
  g.vline(tank + 3, tankY + 7, 13, '@distant');
  g.hline(tank - 3, tankY + 13, 7, '@distant');
  g.rect(tank - 5, tankY + 1, 10, 7, '@distant');
  g.hline(tank - 4, tankY, 8, '@distantHi');
  g.vline(tank - 4, tankY + 2, 4, '@distantHi');
  g.hline(tank - 5, tankY + 7, 10, '@distantHi');

  for (const [fraction, rise] of [[0.035, 0], [0.205, 5], [0.575, 2], [0.965, 4]]) {
    const x = Math.round(width * fraction);
    const y = railY - 20 - rise;
    g.rect(x, y + 8, 2, 7, '@distantHi');
    g.rect(x - 1, y, 4, 2, '@tree');
    g.rect(x - 3, y + 2, 8, 3, '@tree');
    g.rect(x - 4, y + 5, 10, 3, '@tree');
    g.hline(x - 2, y + 2, 4, '@treeHi');
    g.hline(x - 3, y + 5, 3, '@treeHi');
  }
  for (const fraction of [0.275, 0.725]) {
    const x = Math.round(width * fraction);
    g.vline(x, railY - 17, 17, '@distantHi');
    g.hline(x - 3, railY - 18, 4, '@distantHi');
    g.hline(x - 3, railY - 17, 2, '@lamp');
  }
}

// The line: the running rail, the ties under it, the second rail and the ballast, and a
// platform edge at every station (`stops` are their x centers).
export function paintRoute(g, { width, railY, stops }) {
  g.rect(0, railY + 1, width, 4, '@ballast');
  for (let x = 1; x < width; x += 8) {
    g.rect(x, railY + 1, Math.min(2, width - x), 2, '@tie');
  }
  for (let x = 4; x < width; x += 16) g.hline(x, railY + 5, Math.min(3, width - x), '@gravel');
  g.hline(0, railY, width, '@rail');
  g.hline(0, railY + 3, width, '@railLo');
  for (let x = 2; x < width; x += 24) g.hline(x, railY, Math.min(10, width - x), '@railHi');
  for (const x of stops) {
    g.rect(x - 7, railY + 1, 14, 2, '@platform');
    g.hline(x - 6, railY + 1, 12, '@safety');
    // These are near-side platform signs: their posts end above the month labels.
    g.vline(x + 8, railY + 2, 4, '@tie');
    g.hline(x + 7, railY + 1, 4, '@rail');
    g.hline(x + 7, railY + 2, 3, '@railLo');
  }
}

// One station: a tower standing on the rail row, `height` art pixels tall, windows in two
// columns. A `height` of 0 is the hut of a month nobody boarded in. The busiest month
// is drawn in the title color and flies a flag.
export function paintStation(g, { x, railY, height, busiest = false }) {
  const tone = busiest ? '@star' : '@tower';
  const hi = `${tone}Hi`;
  const lo = `${tone}Lo`;
  const win = `${tone}Win`;
  const glass = `${tone}Glass`;
  if (height <= 0) {
    g.rect(x - 4, railY - 4, 8, 4, lo);
    g.hline(x - 4, railY - 6, 8, hi);
    g.hline(x - 5, railY - 5, 10, tone);
    g.rect(x - 2, railY - 3, 4, 3, win);
    g.hline(x - 2, railY - 2, 4, lo); // shutter across the closed ticket hatch
    g.hline(x - 5, railY - 1, 10, tone);
    return;
  }
  const x0 = x - STATION_W / 2;
  const top = railY - height;
  // A stepped roof and projecting cornice keep the silhouette exactly height tall.
  g.rect(x0 + 1, top + 3, STATION_W - 2, height - 3, tone);
  g.vline(x0 + 1, top + 3, height - 3, hi);
  g.rect(x0 + 11, top + 3, 2, height - 3, lo);
  g.hline(x0 + 3, top, 8, hi);
  g.hline(x0 + 1, top + 1, 12, tone);
  g.hline(x0, top + 2, STATION_W, hi);
  g.hline(x0 + 2, top + 3, 10, lo);
  if (height >= 32) g.vline(x0 + 11, top, 2, lo); // chimney within the measured roofline

  // The clock and upper windows remain visible while the train hides the bottom 12 rows.
  if (height >= 23) {
    g.rect(x - 2, top + 5, 4, 4, win);
    g.vline(x, top + 6, 2, hi);
    g.hline(x - 1, top + 7, 2, hi);
  } else if (height >= 12) {
    g.hline(x0 + 4, top + 5, 6, win);
  }
  const firstWindow = top + (height >= 23 ? 13 : 7);
  // At most three widely spaced floors keep a year of tall towers legible and compact.
  const floorPitch = Math.max(6, Math.ceil((height - 19) / 3));
  const windowH = height >= 32 ? 4 : 3;
  for (let y = firstWindow, row = 0; y + windowH < railY - 7; y += floorPitch, row++) {
    for (const [col, dx] of [3, 8].entries()) {
      g.rect(x0 + dx, y, 2, windowH, (row + col) % 3 === 0 ? glass : win);
    }
  }

  const doorH = Math.min(4, height - 4);
  g.rect(x - 2, railY - doorH - 1, 4, doorH, win);
  g.vline(x, railY - doorH, doorH - 1, lo);
  if (height >= 12) {
    g.hline(x - 4, railY - 7, 8, hi);
    g.hline(x - 5, railY - 6, 10, lo);
    g.vline(x - 4, railY - 5, 4, hi);
  }
  g.hline(x0, railY - 1, STATION_W, lo);
  if (busiest) {
    g.vline(x - 1, top - 7, 7, lo);
    g.rect(x, top - 7, 6, 2, hi);
    g.hline(x, top - 5, 5, tone);
    g.hline(x, top - 4, 3, hi);
  }
}
