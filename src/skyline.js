// City backgrounds: a skyline described as a list of buildings, in pixel art and with
// little detail (the silhouette is recognizable, not individual windows). It uses
// the same theme variables as the procedural city (@city, @city2, @cityWin),
// so it changes only between light and dark and the windows light up at night.
//
// Like trains, JSON can come from outside: everything is validated here and
// problems are reported together. See docs/ai/skyline.md.

import { rng } from './pixel.js';
import { parseRegion } from './region.js';
import { REGIONS } from './regions.js';
import { CustomError, NOTE_KEYS, isInt, isObj, unknownKeys } from './validate.js';

const MAX_H = 84; // the city ends at row 88; leave 4 rows of sky
const MAX_BUILDINGS = 120;
const TOPS = ['flat', 'stepped', 'spire', 'antenna', 'dome', 'pyramid'];
const ART = '#w.';

// Included backgrounds. Coordinates on the 448 px scene; the ground is row 88.
// The station sign goes at the top left (up to x?90, y?23) and the sun or moon
// at the top right (x?392, y?20): avoid covering the sign with towers.
export const SKYLINES = {
  'new-york': {
    name: 'New York',
    fill: false,
    region: REGIONS['new-york'],
    buildings: [
      // Background: Midtown and Lower Manhattan in a lighter shade.
      { x: -2, w: 16, h: 22, layer: 'far' },
      { x: 12, w: 12, h: 30, layer: 'far' },
      { x: 30, w: 14, h: 36, layer: 'far', top: 'flat' },
      { x: 92, w: 14, h: 30, layer: 'far' },
      { x: 104, w: 10, h: 40, layer: 'far', top: 'pyramid' },
      { x: 128, w: 16, h: 34, layer: 'far' },
      { x: 150, w: 12, h: 44, layer: 'far', top: [{ type: 'stepped', steps: 2, h: 3 }] },
      { x: 232, w: 10, h: 38, layer: 'far' },
      { x: 272, w: 14, h: 30, layer: 'far' },
      { x: 300, w: 8, h: 52, layer: 'far', top: 'antenna' },
      { x: 316, w: 16, h: 36, layer: 'far' },
      { x: 418, w: 32, h: 8, layer: 'far' },
      // Foreground, with windows.
      { x: 0, w: 14, h: 16 },
      { x: 18, w: 10, h: 20 },
      // One World Trade Center: tower tapering to the antenna.
      { x: 50, w: 14, h: 34, top: [{ type: 'pyramid', h: 20, tip: 4 }, { type: 'antenna', h: 12 }] },
      { x: 68, w: 12, h: 24 },
      { x: 84, w: 10, h: 18 },
      { x: 112, w: 14, h: 22 },
      { x: 130, w: 10, h: 28, top: 'dome' },
      // Empire State: stepped, with mast and antenna.
      { x: 164, w: 20, h: 34, top: [{ type: 'stepped', steps: 3, h: 4 }, { type: 'spire', h: 5 }, { type: 'antenna', h: 8 }] },
      { x: 188, w: 12, h: 20 },
      // Chrysler: stepped crown and spire.
      { x: 204, w: 12, h: 36, top: [{ type: 'pyramid', h: 9, tip: 4 }, { type: 'spire', h: 12 }] },
      { x: 220, w: 10, h: 24 },
      { x: 244, w: 14, h: 26, top: 'pyramid' },
      // 432 Park Avenue: very tall and slender.
      { x: 262, w: 6, h: 64 },
      { x: 270, w: 12, h: 20 },
      { x: 286, w: 12, h: 30, top: 'stepped' },
      { x: 312, w: 14, h: 22 },
      { x: 328, w: 10, h: 30, top: 'antenna' },
      // Brooklyn Bridge: stone tower with two arches and cables down to the deck.
      {
        x: 340,
        rows: [
          '.........................#........#.........................',
          '.......................##############.......................',
          '.......................##############.......................',
          '.......................##############.......................',
          '...................####.############.####...................',
          '.................##...#.###.####.###.#...##.................',
          '..............###.#...#.##...##...##.#...#.###..............',
          '...........####...#...#.##...##...##.#...#...####...........',
          '.........##...#...#...#.##...##...##.#...#...#...##.........',
          '......###.#...#...#...#.##...##...##.#...#...#...#.###......',
          '....###...#...#...#...#.##...##...##.#...#...#...#...###....',
          '..##..#...#...#...#...#.##...##...##.#...#...#...#...#..##..',
          '###...#...#...#...#...#.##...##...##.#...#...#...#...#...###',
          '############################################################',
          '........................##...##...##........................',
          '........................############........................',
          '........................############........................',
          '........................############........................',
          '........................############........................',
          '........................############........................',
          '........................############........................',
          '........................############........................',
          '........................############........................',
          '........................############........................',
        ],
      },
      // Statue of Liberty: torch, crown, robe, and pedestal.
      {
        x: 404,
        rows: [
          '..#..........',
          '.###.........',
          '..#..........',
          '..#..........',
          '..#.#.#......',
          '..#..###.....',
          '..##.###.....',
          '...######....',
          '....####.....',
          '....#####....',
          '....#####....',
          '....####.....',
          '....####.....',
          '...#####.....',
          '...######....',
          '...######....',
          '..########...',
          '...######....',
          '...######....',
          '...######....',
          '...######....',
          '...######....',
          '..########...',
          '.##########..',
          '#############',
          '#############',
        ],
      },
    ],
  },
  // Osaka, based on a reference skyline: from left to right, with the
  // usual city filling the gaps.
  osaka: {
    name: 'Osaka',
    fill: true,
    region: REGIONS.osaka,
    buildings: [
      // Five-story pagoda of Shitenn?-ji.
      {
        x: 4,
        rows: [
          '..........#..........',
          '..........#..........',
          '..........#..........',
          '.........###.........',
          '..........#..........',
          '.........###.........',
          '..........#..........',
          '.........###.........',
          '..........#..........',
          '..........#..........',
          '..........#..........',
          '.....#.........#.....',
          '.....###########.....',
          '......#########......',
          '.......#######.......',
          '.......###w###.......',
          '.......#######.......',
          '.......#######.......',
          '....#...........#....',
          '....#############....',
          '.....###########.....',
          '......#########......',
          '......####w####......',
          '......#########......',
          '......#########......',
          '...#.............#...',
          '...###############...',
          '....#############....',
          '.....###########.....',
          '.....#####w#####.....',
          '.....###########.....',
          '.....###########.....',
          '..#...............#..',
          '..#################..',
          '...###############...',
          '....#############....',
          '....######w######....',
          '....#############....',
          '....#############....',
          '.#.................#.',
          '.###################.',
          '..#################..',
          '...###############...',
          '...#######w#######...',
          '...###############...',
          '...###############...',
          '..#################..',
          '..#################..',
          '..#################..',
        ],
      },
      // Ferris wheel on its support.
      {
        x: 30,
        rows: [
          '.....................................',
          '..............#########..............',
          '...........####.......####...........',
          '.........####...........####.........',
          '........##..#...........#..##........',
          '.......##....#.........#....##.......',
          '......#......#.........#......#......',
          '.....#........#.......#........#.....',
          '....##........#.......#........##....',
          '...##.........#.......#.........##...',
          '...#...........#.....#...........#...',
          '..##...........#.....#...........##..',
          '..###...........#...#...........###..',
          '..#..##.........#...#.........##..#..',
          '.##....###......#...#......###....##.',
          '.#........##.....#.#.....##........#.',
          '.#..........###..#.#..###..........#.',
          '.#.............#######.............#.',
          '.#...............###...............#.',
          '.#.............#######.............#.',
          '.#..........###..###..###..........#.',
          '.#........##....##.##....##........#.',
          '.##....###......##.##......###....##.',
          '..#..##.........##.##.........##..#..',
          '..###..........##...##..........###..',
          '..##...........##...##...........##..',
          '...#...........##...##...........#...',
          '...##.........###...###.........##...',
          '....##........##.....##........##....',
          '.....#........##.....##........#.....',
          '......#......###.....###......#......',
          '.......##....##.......##....##.......',
          '........##..###.......###..##........',
          '.........######.......######.........',
          '...........####.......####...........',
          '............#############............',
          '............##.........##............',
          '...........##...........##...........',
          '...........##...........##...........',
          '...........##...........##...........',
          '...........##...........##...........',
          '..........##.............##..........',
          '..........##.............##..........',
          '..........##.............##..........',
          '.........##...............##.........',
          '.........##...............##.........',
        ],
      },
      // Tsutenkaku: spire, observation deck, shaft, and arched legs.
      {
        x: 70,
        rows: [
          '........#........',
          '........#........',
          '........#........',
          '........#........',
          '........#........',
          '......#####......',
          '......#####......',
          '....#########....',
          '....#########....',
          '....#########....',
          '....#w#w#w#w#....',
          '....#########....',
          '....#########....',
          '....#########....',
          '....#########....',
          '.....#######.....',
          '.....#######.....',
          '.......###.......',
          '.......###.......',
          '.......###.......',
          '.......###.......',
          '.......###.......',
          '.......###.......',
          '.......###.......',
          '.......###.......',
          '.......###.......',
          '.......###.......',
          '......#####......',
          '......#####......',
          '......#####......',
          '......#####......',
          '......#####......',
          '......#####......',
          '......#####......',
          '......#####......',
          '......#####......',
          '......#####......',
          '.....#######.....',
          '......#####......',
          '......#####......',
          '.....###.###.....',
          '.....###.###.....',
          '....####.####....',
          '....####.####....',
          '...####...####...',
          '...####...####...',
          '...####...####...',
          '..####.....####..',
          '..####.....####..',
          '.#####.....#####.',
          '.#####.....#####.',
          '#####.......#####',
          '#####.......#####',
        ],
      },
      { x: 104, w: 12, h: 44 },
      { x: 118, w: 9, h: 40 },
      { x: 130, w: 12, h: 52, top: 'flat' },
      // Abeno Harukas, the tallest.
      { x: 145, w: 9, h: 68 },
      { x: 156, w: 14, h: 58, top: [{ type: 'stepped', steps: 2, h: 3 }] },
      { x: 172, w: 12, h: 62, top: 'antenna' },
      { x: 186, w: 12, h: 50, top: [{ type: 'stepped', steps: 1, h: 4 }] },
      // Umeda Sky Building: two towers joined at the top by the floating garden, with its opening.
      {
        x: 202,
        rows: [
          '###########################',
          '###########################',
          '############...############',
          '###########.....###########',
          '###########.....###########',
          '############...############',
          '###########################',
          '##########.......##########',
          '##########.......##########',
          '##########.......##########',
          '#####w##w#.......########w#',
          '##########.......##########',
          '##########.......##########',
          '##########.......##########',
          '##w#######.......##w##w####',
          '##########.......##########',
          '##########.......##########',
          '##########.......##########',
          '########w#.......##########',
          '##########.......##########',
          '##########.......##########',
          '##########.......##########',
          '##w##w################w##w#',
          '##########.......##########',
          '##########.......##########',
          '##########.......##########',
          '##########.......##w#######',
          '##########.......##########',
          '##########.......##########',
          '##########.......##########',
          '#####w##w#.......########w#',
          '##########.......##########',
          '##########.......##########',
          '##########.......##########',
          '##w#######.......##w##w####',
          '##########.......##########',
          '##########.......##########',
          '##########.......##########',
          '########w#.......##########',
          '##########.......##########',
          '##########.......##########',
          '##########.......##########',
          '##w##w####.......#####w##w#',
          '##########.......##########',
          '##########.......##########',
          '##########.......##########',
          '##########.......##########',
          '##########.......##########',
        ],
      },
      { x: 232, w: 10, h: 40 },
      // Cable-stayed bridge: two A-shaped pylons and cables down to the deck.
      {
        x: 246,
        rows: [
          '....................#.............................#...................',
          '....................#.............................#...................',
          '....................#.............................#...................',
          '....................#.............................#...................',
          '...................###...........................###..................',
          '...................###...........................###..................',
          '..................#####.........................#####.................',
          '..................##.##.........................##.##.................',
          '.................###.###.......................###.###................',
          '................##.#.#.##.....................##.#.#.##...............',
          '................####.####.....................####.####...............',
          '...............#.###.###.#...................#.###.###.#..............',
          '..............#.#.##.##.#.#.................#.#.##.##.#.#.............',
          '..............#.#.##.##.#.#.................#.#.##.##.#.#.............',
          '.............#.#.#.#.#.#.#.#...............#.#.#.#.#.#.#.#............',
          '.............#.#.#.#.#.#.#.#...............#.#.#.#.#.#.#.#............',
          '............#.#..#.#.#.#..#.#.............#.#..#.#.#.#..#.#...........',
          '...........#..#..#.#.#.#..#..#...........#..#..#.#.#.#..#..#..........',
          '...........#..#..#.#.#.#..#..#...........#..#..#.#.#.#..#..#..........',
          '..........#..#..#..#.#..#..#..#.........#..#..#..#.#..#..#..#.........',
          '..........#..#..#.#...#.#..#..#.........#..#..#.#...#.#..#..#.........',
          '.........#..#...#.#...#.#...#..#.......#..#...#.#...#.#...#..#........',
          '........#...#...#.#...#.#...#...#.....#...#...#.#...#.#...#...#.......',
          '........#...#..#..#...#..#..#...#.....#...#..#..#...#..#..#...#.......',
          '.......#...#...#..#####..#...#...#...#...#...#..#####..#...#...#......',
          '......#....#...#..#...#..#...#....#.#....#...#..#...#..#...#....#.....',
          '......#...#....#..#...#..#....#...#.#...#....#..#...#..#....#...#.....',
          '.....#....#...#...#...#...#...#....#....#...#...#...#...#...#....#....',
          '.....#...#....#...#...#...#....#...#...#....#...#...#...#....#...#....',
          '....#....#....#...#...#...#....#..#.#..#....#...#...#...#....#....#...',
          '######################################################################',
          '######################################################################',
          '..................#...#.........................#...#.................',
          '.................#.....#.......................#.....#................',
          '.................#.....#.......................#.....#................',
          '.................#.....#.......................#.....#................',
          '.................#.....#.......................#.....#................',
          '.................#.....#.......................#.....#................',
          '.................#.....#.......................#.....#................',
          '.................#.....#.......................#.....#................',
        ],
      },
      // Osaka Castle: stone base and five roofs with upturned eaves.
      {
        x: 320,
        rows: [
          '.............#.......#.............',
          '.............#########.............',
          '..............#######..............',
          '..............#######..............',
          '...........#...........#...........',
          '...........#############...........',
          '.............#########.............',
          '.............##w##w###.............',
          '.............#########.............',
          '.........#...............#.........',
          '.........#################.........',
          '...........#############...........',
          '...........##w##w##w####...........',
          '...........#############...........',
          '.......#...................#.......',
          '.......#####################.......',
          '.........#################.........',
          '.........##w##w##w##w##w##.........',
          '.........#################.........',
          '.....#.......................#.....',
          '.....#########################.....',
          '.......#####################.......',
          '.......##w##w##w##w##w##w###.......',
          '.......#####################.......',
          '...#...........................#...',
          '...#############################...',
          '.....#########################.....',
          '.....##w##w##w##w##w##w##w####.....',
          '.....#########################.....',
          '....###########################....',
          '.....#########################.....',
          '.....#########################.....',
          '....###########################....',
          '....###########################....',
          '...#############################...',
          '...#############################...',
          '..###############################..',
          '..###############################..',
          '.#################################.',
          '.#################################.',
          '###################################',
          '###################################',
        ],
      },
    ],
  },
};

function parseTop(t, where, errors) {
  if (typeof t === 'string') t = { type: t };
  if (!isObj(t) || !TOPS.includes(t.type)) {
    errors.push(`${where}: unknown top ${JSON.stringify(t?.type ?? t)} (valid: ${TOPS.join(', ')})`);
    return null;
  }
  unknownKeys(t, ['type', 'h', 'steps', 'tip'], where, errors);
  const out = { type: t.type };
  if (t.h !== undefined) {
    if (!isInt(t.h) || t.h < 1 || t.h > 40) errors.push(`${where}.h: an integer from 1 to 40`);
    else out.h = t.h;
  }
  if (t.steps !== undefined) {
    if (t.type !== 'stepped' || !isInt(t.steps) || t.steps < 1 || t.steps > 4) errors.push(`${where}.steps: only on "stepped", from 1 to 4`);
    else out.steps = t.steps;
  }
  if (t.tip !== undefined) {
    if (t.type !== 'pyramid' || !isInt(t.tip) || t.tip < 1 || t.tip > 20) errors.push(`${where}.tip: only on "pyramid", tip width from 1 to 20`);
    else out.tip = t.tip;
  }
  return out;
}

function parseBuilding(b, i, errors) {
  const where = `buildings[${i}]`;
  if (!isObj(b)) {
    errors.push(`${where}: must be an object { "x": ..., "w": ..., "h": ... }`);
    return null;
  }
  unknownKeys(b, ['x', 'w', 'h', 'layer', 'top', 'windows', 'rows', 'name'], where, errors);
  const before = errors.length;
  const out = { x: b.x, layer: b.layer ?? 'near' };
  if (!isInt(b.x) || b.x < -40 || b.x > 447) errors.push(`${where}.x: an integer from -40 to 447 (left column)`);
  if (out.layer !== 'near' && out.layer !== 'far') errors.push(`${where}.layer: "near" (in front, with windows) or "far" (behind, lighter)`);
  out.windows = b.windows ?? out.layer === 'near';
  if (typeof out.windows !== 'boolean') errors.push(`${where}.windows: true or false`);

  if (b.rows !== undefined) {
    // Free drawing: "#" building, "w" window, "." empty. The last row touches the ground.
    if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > MAX_H || !b.rows.every((r) => typeof r === 'string')) {
      errors.push(`${where}.rows: 1 to ${MAX_H} strings; the last row touches the ground`);
    } else {
      const longest = Math.max(...b.rows.map((r) => r.length));
      if (longest > 200) errors.push(`${where}.rows: at most 200 columns (the longest has ${longest})`);
      b.rows.forEach((r, y) => {
        const bad = [...r].filter((c) => !ART.includes(c));
        if (bad.length) errors.push(`${where}.rows[${y}]: unknown symbols "${[...new Set(bad)].join('')}" (valid: # w .)`);
      });
      out.rows = b.rows.map((r) => r.padEnd(longest, '.'));
    }
    if (b.w !== undefined || b.h !== undefined || b.top !== undefined) {
      errors.push(`${where}: with "rows", leave out "w", "h" and "top"`);
    }
  } else {
    if (!isInt(b.w) || b.w < 2 || b.w > 200) errors.push(`${where}.w: an integer from 2 to 200 (width)`);
    if (!isInt(b.h) || b.h < 2 || b.h > MAX_H) errors.push(`${where}.h: an integer from 2 to ${MAX_H} (body height, without the top)`);
    out.w = b.w;
    out.h = b.h;
    const tops = b.top === undefined ? [] : Array.isArray(b.top) ? b.top : [b.top];
    if (tops.length > 4) errors.push(`${where}.top: at most 4 stacked tops`);
    out.top = tops.map((t, k) => parseTop(t, `${where}.top${Array.isArray(b.top) ? `[${k}]` : ''}`, errors)).filter(Boolean);
  }
  return errors.length > before ? null : out;
}

// Earlier preset ids that are still accepted (the original Spanish ones).
export const SKYLINE_ALIASES = { ciudad: 'city', 'nueva-york': 'new-york' };

// Accepts a preset id ("new-york") or an object { name, fill, buildings }.
// Returns null for the procedural city ("city" or empty).
export function parseSkyline(raw) {
  if (typeof raw === 'string') raw = SKYLINE_ALIASES[raw] ?? raw;
  if (raw === undefined || raw === null || raw === '' || raw === 'city') return null;
  if (typeof raw === 'string') {
    const preset = SKYLINES[raw];
    if (!preset) throw new CustomError('The skyline', [`"${raw}" does not exist (options: city, ${Object.keys(SKYLINES).join(', ')} or the path to a .json file)`]);
    raw = preset;
  }
  const errors = [];
  if (!isObj(raw)) throw new CustomError('The skyline', ['the file must be a JSON object { ... }']);
  unknownKeys(raw, ['name', 'fill', 'buildings', 'region', ...NOTE_KEYS], 'skyline', errors);
  const fill = raw.fill ?? true;
  if (typeof fill !== 'boolean') errors.push('fill: true (fills the gaps with the procedural city) or false');
  const list = raw.buildings;
  if (!Array.isArray(list) || !list.length || list.length > MAX_BUILDINGS) {
    errors.push(`buildings: a list of 1 to ${MAX_BUILDINGS} buildings`);
  }
  const buildings = Array.isArray(list) ? list.map((b, i) => parseBuilding(b, i, errors)) : [];
  const region = raw.region === undefined ? undefined : parseRegion(raw.region, errors);
  if (errors.length) throw new CustomError('The skyline', errors);
  return {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 40) : 'Custom skyline',
    fill,
    buildings,
    ...(region ? { region } : {}),
  };
}

const odd = (n) => Math.max(1, n % 2 ? n : n - 1);

// Paint a top on the block { x, w, top } (top = highest occupied row) and
// return the new block, so the next top can be stacked on it.
function paintTop(g, blk, t, color) {
  const { x, w, top } = blk;
  const cx = x + (w - 1) / 2;
  if (t.type === 'flat') return blk;
  if (t.type === 'stepped') {
    const steps = t.steps ?? 2;
    const th = t.h ?? 3;
    let cur = blk;
    for (let s = 1; s <= steps; s++) {
      const inset = Math.max(1, Math.round((w * s) / (2 * (steps + 1))));
      const nw = Math.max(1, w - 2 * inset);
      cur = { x: x + Math.floor((w - nw) / 2), w: nw, top: cur.top - th };
      g.rect(cur.x, cur.top, cur.w, th, color);
    }
    return cur;
  }
  if (t.type === 'pyramid') {
    const tip = Math.min(t.tip ?? 1, w);
    const h = t.h ?? Math.max(1, Math.ceil((w - tip) / 2));
    let last = blk;
    for (let r = 1; r <= h; r++) {
      const rw = Math.max(tip, Math.round(w - ((w - tip) * r) / h));
      const rx = x + Math.floor((w - rw) / 2);
      g.rect(rx, top - r, rw, 1, color);
      last = { x: rx, w: rw, top: top - r };
    }
    return last;
  }
  if (t.type === 'dome') {
    const rad = w / 2;
    const h = t.h ?? Math.max(1, Math.ceil(rad * 0.8));
    let last = blk;
    for (let r = 1; r <= h; r++) {
      const dy = (r / h) * rad;
      const half = Math.sqrt(Math.max(0, rad * rad - dy * dy));
      const rw = Math.max(1, Math.round(half * 2));
      const rx = x + Math.floor((w - rw) / 2);
      g.rect(rx, top - r, rw, 1, color);
      last = { x: rx, w: rw, top: top - r };
    }
    return last;
  }
  if (t.type === 'spire') {
    const base = odd(Math.min(w, 3));
    const h = t.h ?? 6;
    for (let r = 1; r <= h; r++) {
      const rw = r <= Math.ceil(h / 3) ? base : 1;
      g.rect(Math.round(cx - (rw - 1) / 2), top - r, rw, 1, color);
    }
    return { x: Math.round(cx), w: 1, top: top - h };
  }
  // antenna
  const h = t.h ?? 5;
  g.rect(Math.round(cx), top - h, 1, h, color);
  return { x: Math.round(cx), w: 1, top: top - h };
}

// Windows as in the random city: a grid every 3 columns and 4 rows, with
// some lit at random (visible only at night).
function paintWindows(g, x, top, w, ground, seed) {
  const rand = rng(seed);
  for (let wy = top + 3; wy < ground - 3; wy += 4) {
    for (let wx = x + 2; wx < x + w - 2; wx += 3) if (rand() < 0.35) g.set(wx, wy, '@cityWin');
  }
}

// Columns occupied by buildings in a layer, with `margin` pixels on each side.
// The filler city is not drawn there so the custom buildings remain clear.
export function skylineColumns(sky, layer, margin = 0) {
  const cols = new Set();
  for (const b of sky.buildings) {
    if (b.layer !== layer) continue;
    const w = b.rows ? b.rows[0].length : b.w;
    for (let x = b.x - margin; x < b.x + w + margin; x++) cols.add(x);
  }
  return cols;
}

// Paint a skyline layer ('far' or 'near') on the scenery grid.
// `ground` is the ground row. Layers are painted separately so the filler city
// sits between them: behind nearby buildings and in front of distant ones.
export function paintSkyline(g, sky, ground, layer) {
  sky.buildings.forEach((b, i) => {
    if (b.layer === layer) paintBuilding(g, b, i, ground);
  });
}

function paintBuilding(g, b, i, ground) {
  const color = b.layer === 'far' ? '@city2' : '@city';
  if (b.rows) {
    // Free drawing: the last row touches the ground.
    const h = b.rows.length;
    b.rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== '.') g.set(b.x + c, ground - h + r, row[c] === 'w' ? '@cityWin' : color);
      }
    });
    return;
  }
  const top = ground - b.h;
  g.rect(b.x, top, b.w, b.h, color);
  if (b.windows) paintWindows(g, b.x, top, b.w, ground, 7000 + i * 131 + b.x);
  let blk = { x: b.x, w: b.w, top };
  for (const t of b.top) blk = paintTop(g, blk, t, color);
}
