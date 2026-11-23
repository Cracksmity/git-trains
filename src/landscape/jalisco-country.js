import { Grid, rng } from '../graphics/pixel.js';
import { line, polygon } from '../graphics/pixel-shapes.js';

// Night falls from the top of each country strip with the same 25/50/75% dither
// as the city sky. The faint stars share the daytime haze ink in the light theme.
export function sky(g, base, height, seed) {
  const bands = [['@dusk', height], ['@haze', 33], ['@afterglow', 27]];
  for (const [color, top] of bands) g.rect(0, base - top, g.w, top, color);
  for (const [color, top] of bands.slice(1)) {
    const y = base - top;
    for (let x = 0; x < g.w; x++) {
      if (x % 4 === 0) g.set(x, y - 3, color);
      if (x % 2 === 1) g.set(x, y - 2, color);
      if (x % 4 !== 3) g.set(x, y - 1, color);
    }
  }
  const random = rng(seed);
  for (let i = 0; i < 14; i++) {
    g.set(Math.floor(random() * g.w), base - height + 1 + Math.floor(random() * 9), '@starlight');
  }
}

export function ridge(g, base, mean, wave, color) {
  for (let x = 0; x < g.w; x++) {
    const h = Math.round(mean + 4 * Math.sin(x / 62 + wave) + 2 * Math.sin(x / 25 + wave));
    g.vline(x, base - h, h, color);
  }
}

export function rancho(g, x, base, w, wall = '@stone') {
  g.rect(x, base - 9, w, 9, wall);
  g.rect(x + w - 5, base - 9, 5, 9, '@stoneShade');
  polygon(g, [[x-2,base-9],[x+4,base-15],[x+w-5,base-15],[x+w+2,base-9]], '@tile');
  for (let dx = 3; dx < w - 1; dx += 4) line(g, x+dx+2, base-14, x+dx, base-10, '@tileLit');
  g.hline(x - 2, base - 9, w + 4, '@recess');
  for (let dx = 3; dx < w - 4; dx += 8) {
    g.rect(x + dx, base - 6, 3, 3, '@recess');
    g.vline(x + dx, base - 6, 2, '@glassWarm');
  }
  g.rect(x + w - 9, base - 7, 4, 7, '@recess');
}

export function mesquite(g, x, bottom, size) {
  const top = bottom - size;
  line(g, x, bottom, x - 1, top + 4, '@recess');
  line(g, x - 1, top + 6, x + 4, top + 1, '@recess');
  line(g, x, top + 7, x - 5, top + 3, '@recess');
  for (const [dx,dy,w] of [[-8,2,8],[-4,0,9],[2,2,9],[-2,4,7]]) {
    g.rect(x+dx, top+dy, w, 3, '@foliage');
    g.hline(x+dx+1, top+dy-1, w-2, '@foliageLit');
  }
}

// The parish church of a Los Altos town: a domed nave behind a tall bell tower.
// It rises 32 rows, the most the 40-row strip allows above the stone wall.
function parroquia(g, x, b) {
  g.rect(x + 9, b - 13, 25, 13, '@stone');
  g.rect(x + 29, b - 13, 5, 13, '@stoneShade');
  g.hline(x + 8, b - 14, 27, '@stoneLit');
  for (const dx of [12, 18, 25]) {
    g.rect(x + dx, b - 10, 2, 5, '@recess');
    g.vline(x + dx, b - 9, 3, '@glassWarm');
  }
  const cx = x + 22;
  g.rect(cx - 4, b - 17, 9, 3, '@stone');
  g.rect(cx + 2, b - 17, 3, 3, '@stoneShade');
  [4, 4, 3, 2].forEach((r, i) => {
    g.hline(cx - r, b - 18 - i, 2 * r + 1, '@tile');
    g.hline(cx - r, b - 18 - i, r, '@tileLit');
  });
  g.rect(cx - 1, b - 24, 3, 2, '@stoneLit');
  g.vline(cx, b - 27, 3, '@recess');
  g.hline(cx - 1, b - 26, 3, '@recess');

  g.rect(x, b - 22, 9, 22, '@stoneLit');
  g.rect(x + 6, b - 22, 3, 22, '@stoneShade');
  for (const y of [b - 22, b - 15]) g.hline(x - 1, y, 11, '@stone');
  for (const dx of [2, 5]) g.rect(x + dx, b - 20, 2, 4, '@recess');
  g.set(x + 2, b - 18, '@ochreLit');
  g.set(x + 5, b - 18, '@ochre');
  g.rect(x + 3, b - 12, 3, 3, '@ochreLit');
  g.set(x + 4, b - 11, '@recess');
  g.rect(x + 2, b - 7, 4, 7, '@recess');
  g.rect(x + 2, b - 26, 5, 4, '@stoneLit');
  g.rect(x + 5, b - 26, 2, 4, '@stoneShade');
  g.vline(x + 3, b - 25, 2, '@recess');
  polygon(g, [[x+1,b-26],[x+4,b-29],[x+7,b-26]], '@tileLit');
  g.vline(x + 4, b - 32, 3, '@recess');
  g.hline(x + 3, b - 31, 3, '@recess');
}

// A plowed parcel of red earth with diagonal furrows, kept on the grassland hill.
function parcel(g, points, slope) {
  const shape = new Grid(g.w, g.h);
  polygon(shape, points, '@earth');
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (!shape.get(x, y) || g.get(x, y) !== '@grassland') continue;
      g.set(x, y, (x + slope * 2 * y) % 5 ? '@earth' : '@earthLit');
    }
  }
}

// Two courses of a dry-stone wall over the red earth beside the track.
function stoneWall(g, base) {
  const random = rng(205);
  const stones = [0, 2];
  for (let x = -2; x < g.w; x++) {
    const top = base - 6 - Math.round(1.4 * Math.sin(x / 44));
    g.vline(x, top, base - top, '@earth');
    if (random() < 0.3) g.set(x, base - 1, '@earthLit');
    stones.forEach((left, course) => {
      const y = top + 2 * course;
      if (left > 0) {
        g.set(x, y, '@stone');
        g.set(x, y + 1, '@stoneShade');
        stones[course] = left - 1;
      } else {
        g.vline(x, y, 2, '@recess');
        stones[course] = 2 + Math.floor(random() * 3);
      }
    });
  }
}

/** @type {Array<[Array<[number, number]>, number]>} Outline above the rail and furrow slope. */
const PARCELS = [
  [[[14,11],[30,17],[62,19],[70,15],[40,10]], -1],
  [[[103,7],[111,12],[151,15],[171,14],[138,9]], 1],
  [[[196,10],[214,16],[246,18],[258,13],[226,9]], -1],
  [[[354,12],[363,16],[391,18],[407,18],[385,13]], 1],
];

/** The second track: red-earth parcels, a parish church and a dry-stone wall. */
export function paintLosAltos(g, base, height) {
  sky(g, base, height, 311);
  ridge(g, base, 22, 0.8, '@ridge');
  ridge(g, base, 16, 2.4, '@grassland');
  for (const [points, slope] of PARCELS) parcel(g, points.map(([x, y]) => [x, base - y]), slope);
  ridge(g, base, 10, 4.2, '@pasture');
  for (const [x, y, w] of [[22,5,25],[74,7,17],[181,7,28],[307,7,32],[346,5,20],[421,5,22]]) {
    rancho(g, x, base-y, w);
  }
  parroquia(g, 273, base - 6);
  for (const x of [6, 62, 136, 229, 334, 391]) mesquite(g, x, base-6, 9 + x % 5);
  // A wooden corral between the church and the farmhouse, half behind the wall.
  for (const x of [240, 372]) {
    const y = base - 3;
    for (const dy of [6, 3]) g.hline(x, y - dy, 22, '@stoneShade');
    for (let post = 0; post <= 21; post += 7) g.vline(x + post, y - 8, 8, '@recess');
    line(g, x + 1, y - 3, x + 7, y - 6, '@stone');
  }
  stoneWall(g, base);
}

// Each symbol is a different face of a fleshy leaf. The three distances keep
// the nearest rosettes legible while the horizon stays fine-grained.
const ROSETTES = [
  ['.h.', 'sbs'],
  ['..h..','h.b.h','.hbs.','ssbss'],
  ['.....h.....','.h...b...h.','.bh..hb.hs.','h.bh.hbhb.h',
   '.hbbhbbhbh.','..hbsbbbsb.','...sbbhbs..','....ssss...'],
  ['.......h.......','..h....h....h..','..bh...hb..hb..','h.bh...hb..hb.h',
   'bh.bh.hhb.hb.hb','.bh.bh.hb.hbhb.','h.bbbhhbbhbhb.h','bh.bbhbsbhbh.hb',
   '.bhhbbhbsbbhhb.','..bsbbhsbhbbbs.','...ssbbhsbbss..','.....ssbsss....'],
];
const LEAVES = { h: '@agaveLit', b: '@agave', s: '@agaveShade' };

function agave(g, cx, bottom, distance) {
  const rows = ROSETTES[distance];
  const x0 = cx - Math.floor(rows[0].length / 2);
  const y0 = bottom - rows.length + 1;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const leaf = rows[r][c];
      const color = distance < 2 && leaf !== 's' ? '@agaveFar' : LEAVES[leaf];
      if (color) g.set(x0 + c, y0 + r, color);
    }
  }
}

// Light from the east traces the crest of the volcano, brighter past its summit.
// Columns whose crest is no higher than the background ridge stay untouched.
function crest(g, from, to, top, limit, summit) {
  for (let x = from; x <= to; x++) {
    let y = top;
    while (y < limit && !String(g.get(x, y)).startsWith('@ridge')) y++;
    if (y < limit) g.set(x, y, x >= summit ? '@rimLit' : '@rimShade');
  }
}

/** A low volcanic ridge above a field of blue agave planted in receding furrows. */
export function paintTequila(g, base, height) {
  sky(g, base, height, 419);
  ridge(g, base, 20, 1.8, '@ridge');
  const horizon = base - 22;
  const peak = base - 38;
  polygon(g, [[40,horizon],[70,horizon-3],[89,horizon-7],[111,horizon-14],[122,peak+3],
    [128,peak+3],[131,peak],[136,peak],[137,peak+4],[149,peak+6],[167,horizon-7],
    [200,horizon-2],[229,horizon],[229,base],[40,base]], '@ridgeShade');
  polygon(g, [[130,peak+3],[134,peak+1],[137,peak+5],[149,peak+7],
    [165,horizon-6],[149,horizon-9],[139,peak+8]], '@ridge');
  crest(g, 40, 229, peak, horizon - 4, 131);
  g.rect(0, horizon, g.w, base-horizon, '@field');
  g.hline(0, horizon, g.w, '@pasture');
  // A continuous fan: the same furrow passes through all four sizes of plant.
  const focus = 190;
  const levels = [[2,0], [6,1], [12,2], [21,3]];
  const position = (row, depth) => Math.round(focus + row * (13 + 0.92 * depth) + depth * 0.8);
  for (let row = -19; row <= 25; row++) {
    line(g, position(row, 0), horizon + 1, position(row, 21), base-1, '@furrow');
  }
  for (const [depth, size] of levels) {
    for (let row = -19; row <= 25; row++) {
      if (row === 3) continue; // footpath for the jimadores
      const x = position(row, depth);
      if (x < -8 || x > g.w + 8) continue;
      agave(g, x, horizon + depth, size);
    }
  }
}
