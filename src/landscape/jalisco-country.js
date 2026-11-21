import { rng } from '../graphics/pixel.js';
import { line, polygon } from '../graphics/pixel-shapes.js';

function ridge(g, base, mean, wave, color) {
  for (let x = 0; x < g.w; x++) {
    const h = Math.round(mean + 4 * Math.sin(x / 62 + wave) + 2 * Math.sin(x / 25 + wave));
    g.vline(x, base - h, h, color);
  }
}

function rancho(g, x, base, w) {
  g.rect(x, base - 9, w, 9, '@stone');
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

function mesquite(g, x, bottom, size) {
  const top = bottom - size;
  line(g, x, bottom, x - 1, top + 4, '@recess');
  line(g, x - 1, top + 6, x + 4, top + 1, '@recess');
  line(g, x, top + 7, x - 5, top + 3, '@recess');
  for (const [dx,dy,w] of [[-8,2,8],[-4,0,9],[2,2,9],[-2,4,7]]) {
    g.rect(x+dx, top+dy, w, 3, '@foliage');
    g.hline(x+dx+1, top+dy-1, w-2, '@foliageLit');
  }
}

function chapel(g, x, base) {
  rancho(g, x + 4, base, 22);
  g.rect(x, base - 18, 8, 18, '@stoneLit');
  g.rect(x + 5, base - 18, 3, 18, '@stoneShade');
  g.rect(x + 2, base - 16, 3, 5, '@recess');
  g.set(x + 3, base - 14, '@ochreLit');
  polygon(g, [[x-1,base-18],[x+3,base-23],[x+9,base-18]], '@tileLit');
  g.vline(x + 3, base - 26, 4, '@recess');
  g.hline(x + 2, base - 25, 3, '@recess');
}

/** The second track, with a stone boundary wall through the red-earth pasture. */
export function paintLosAltos(g, base, height) {
  g.rect(0, base-height, g.w, height, '@haze');
  g.rect(0, base - 27, g.w, 27, '@afterglow');
  ridge(g, base, 22, 0.8, '@ridge');
  ridge(g, base, 16, 2.4, '@grassland');
  polygon(g, [[111,base-12],[151,base-15],[171,base-14],[138,base-9],[103,base-7]], '@field');
  polygon(g, [[363,base-16],[391,base-18],[407,base-18],[385,base-13],[354,base-12]], '@field');
  ridge(g, base, 10, 4.2, '@pasture');
  for (const [x, y, w] of [[22,3,25],[74,5,17],[181,5,28],[307,5,32],[346,3,20],[421,3,22]]) {
    rancho(g, x, base-y, w);
  }
  chapel(g, 273, base-3);
  for (const x of [6, 62, 136, 229, 334, 391]) mesquite(g, x, base-4, 9 + x % 5);
  // A wooden corral between the chapel and the farmhouse.
  for (const x of [240, 372]) {
    for (const dy of [6, 3]) g.hline(x, base - dy, 22, '@stoneShade');
    for (let post = 0; post <= 21; post += 7) g.vline(x + post, base - 8, 8, '@recess');
    line(g, x + 1, base - 3, x + 7, base - 6, '@stone');
  }
  const random = rng(205);
  for (let x = -2; x < g.w; x++) {
    const y = base - 3 - Math.round(1.4 * Math.sin(x / 44));
    g.vline(x, y, base-y, '@recess');
    if (x % 5) g.set(x, y, '@stoneShade');
    if (random() < 0.5) g.set(x, y+1, '@field');
  }
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
      const color = distance < 2 && leaf === 'h' ? '@agave' : LEAVES[leaf];
      if (color) g.set(x0 + c, y0 + r, color);
    }
  }
}

/** A low volcanic ridge above a field of blue agave planted in receding furrows. */
export function paintTequila(g, base, height) {
  g.rect(0, base-height, g.w, height, '@haze');
  g.rect(0, base - 27, g.w, 27, '@afterglow');
  ridge(g, base, 20, 1.8, '@ridge');
  const horizon = base - 22;
  const peak = base - 38;
  polygon(g, [[40,horizon],[70,horizon-3],[89,horizon-7],[111,horizon-14],[122,peak+3],
    [128,peak+3],[131,peak],[136,peak],[137,peak+4],[149,peak+6],[167,horizon-7],
    [200,horizon-2],[229,horizon],[229,base],[40,base]], '@ridgeShade');
  polygon(g, [[130,peak+3],[134,peak+1],[137,peak+5],[149,peak+7],
    [165,horizon-6],[149,horizon-9],[139,peak+8]], '@ridge');
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
