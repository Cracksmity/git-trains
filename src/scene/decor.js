// Seasonal pixel art. All layers sit behind the trains; fireworks also sit
// behind the city so its silhouette naturally hides their lowest sparks.
import { Grid, rng } from '../graphics/pixel.js';
import { clean, textWidth } from '../graphics/font.js';
import { GY0, PITCH } from './layout.js';
import { TRAIN_H } from '../trains/geometry.js';
import { DECORATIONS } from '../activity/seasons.js';

export { DECORATIONS };

export const DECOR_THEMES = {
  light: {
    dSnow: '#f8fcff', dIce: '#709ebc',
    dPetal: '#d35d91', dPetalShade: '#aa3f78',
    dLeaf: '#ce7028', dLeafShade: '#994734',
    dOrange: '#e99220', dPink: '#bd387f', dPurple: '#8056a9', dCord: '#657680',
    dRed: '#cb3e43', dAmber: '#b07814', dGreen: '#287c61', dBlue: '#2d76b7', dCyan: '#21869d',
    dPumpkin: '#df7d21', dPumpkinShade: '#a95325', dStem: '#416b3b',
    dFace: '#ffe39a', dFaceDim: '#8c4325',
  },
  dark: {
    dSnow: '#e7f3ff', dIce: '#8bb6dc',
    dPetal: '#ffadc9', dPetalShade: '#e974a9',
    dLeaf: '#efa34a', dLeafShade: '#cb6048',
    dOrange: '#ffad32', dPink: '#ed74bb', dPurple: '#b292ee', dCord: '#8d9ab0',
    dRed: '#ff685e', dAmber: '#ffd366', dGreen: '#72d4a1', dBlue: '#83c4ff', dCyan: '#7cdbec',
    dPumpkin: '#ed8f2d', dPumpkinShade: '#aa4f23', dStem: '#77a85d',
    dFace: '#ffe9a9', dFaceDim: '#d28136',
  },
};

const group = (g, art, cls) => `<g class="${cls}">${g.paths(art.used)}</g>`;
const grid = (art) => new Grid(art.W, art.H);
const signalX = (track, W) => track.dir === -1 ? 8 : W - 17;
const signWidth = (user) => {
  const name = clean(user ?? '').replace(/ /g, '').slice(0, 16);
  return name ? textWidth(name) + 8 : 0;
};

function animate(art, cls, timing, base = '') {
  art.rules.push(`.${cls}{${base}animation:${timing}}`);
  art.animated.add(cls);
}

function alternate(art, a, b, seconds) {
  art.rules.push('@keyframes d-on{0%{opacity:1}50%{opacity:0}}',
    '@keyframes d-off{0%{opacity:0}50%{opacity:1}}');
  animate(art, a, `d-on ${seconds}s step-end infinite`, 'opacity:1;');
  animate(art, b, `d-off ${seconds}s step-end infinite`, 'opacity:0;');
}

function falling(art, kind) {
  const snow = kind === 'winter';
  const leaf = kind === 'autumn';
  const rand = rng(snow ? 1201 : leaf ? 1203 : 1202);
  const counts = snow ? [16, 12] : [5, 5];
  const durations = snow ? [22, 29] : leaf ? [44, 52] : [36, 44];
  // Two identical H-row periods. Wrapping each pixel also preserves particles
  // that straddle the seam; steps(H) ends each step exactly one pixel lower.
  art.rules.push(`@keyframes d-fall-step-end{from{transform:translateY(-${art.H}px)}to{transform:translateY(0)}}`);
  art.rules.push('@keyframes d-sway{0%,100%{transform:translateX(0)}50%{transform:translateX(1px)}}');
  counts.forEach((count, layer) => {
    const g = new Grid(art.W, art.H * 2);
    for (let i = 0; i < count; i++) {
      const x = 3 + Math.floor((i + rand()) * (art.W - 7) / count);
      const y = Math.floor(rand() * art.H);
      const pixel = (dx, dy, color) => {
        const row = (y + dy) % art.H;
        for (const offset of [0, art.H]) g.set(x + dx, row + offset, color);
      };
      if (snow) {
        pixel(0, 0, '@dIce');
        if (i % 3 === 0) pixel(1, 0, '@dSnow');
      } else if (leaf) {
        pixel(0, 0, '@dLeaf');
        pixel(1, 1, '@dLeafShade');
        if (i % 2 === 0) pixel(1, 0, '@dLeaf');
      } else {
        pixel(0, 0, '@dPetal');
        if (i % 2 === 0) pixel(1, 0, '@dPetalShade');
      }
    }
    const cls = `d-fall${layer}`;
    art.front += `<g class="${cls}">${group(g, art, 'd-sway')}</g>`;
    animate(art, cls, `d-fall-step-end ${durations[layer]}s steps(${art.H}) infinite`);
  });
  animate(art, 'd-sway', `d-sway ${snow ? 8 : 6}s step-end infinite`);
}

function winter(art) {
  const g = grid(art);
  const b = art.backdrop;
  const city = new Set(['@city', '@city2', '@cityWin']);
  for (let x = 0; x < art.W; x++) {
    // Use the painted skyline, including custom spires, rather than guessing
    // roof heights. Do not paint over a mast or wire immediately above it.
    for (let y = 0; y < GY0 - 3; y++) {
      if (!city.has(b.get(x, y))) continue;
      if (y > 0 && !b.get(x, y - 1)) g.set(x, y - 1, '@dSnow');
      break;
    }
    for (let y = GY0; y < art.H; y++) {
      if (b.get(x, y) === '@houseRoof' && !b.get(x, y - 1)) g.set(x, y - 1, '@dSnow');
    }
    if (b.get(x, GY0 - 3) === '@hill') g.set(x, GY0 - 3, '@dSnow');
  }
  art.tracks.forEach((track, k) => {
    const gy = GY0 + PITCH * k;
    g.hline(0, gy + 11, art.W, '@dSnow');
    g.hline(signalX(track, art.W), gy - 33, 5, '@dSnow');
  });
  g.hline(14, 9, signWidth(art.user), '@dSnow');
  art.front += group(g, art, 'd-snowcap');
  falling(art, 'winter');
}

function spring(art) {
  const g = grid(art);
  for (let x = 20; x < art.W - 2; x += 43) {
    for (let y = GY0 - 8; y < GY0 - 2; y++) {
      if (!['@tree', '@tree2'].includes(art.backdrop.get(x, y))) continue;
      g.set(x, y, '@dPetal');
      g.set(x + 1, y, '@dPetalShade');
      break;
    }
  }
  art.front += group(g, art, 'd-blossom');
  falling(art, 'spring');
}

function flag(g, x, y, color, pose) {
  // A fixed top edge, two open paper cuts, and a scalloped hem. Only the
  // bottom half leans by one pixel in the second pose; the string stays put.
  for (let row = 0; row < 6; row++) {
    const dx = row >= 3 ? pose : 0;
    g.hline(x + dx, y + row, 5, color);
    if (row === 2) g.set(x + dx + 1, y + row, null);
    if (row === 3) g.set(x + dx + 3, y + row, null);
    if (row === 5) {
      g.set(x + dx + 1, y + row, null);
      g.set(x + dx + 3, y + row, null);
    }
  }
}

function muertos(art) {
  const cord = grid(art);
  const poses = [grid(art), grid(art)];
  const colors = ['@dOrange', '@dOrange', '@dPink', '@dOrange', '@dPurple'];
  let n = 0;
  art.tracks.forEach((track, k) => {
    const gy = GY0 + PITCH * k;
    const y = gy - TRAIN_H - 8;
    const spans = [];
    if (track.overhead) {
      for (let x = 30; x + 96 < art.W; x += 96) spans.push(x);
    } else {
      // Without catenary, two slim posts planted beside the track support a
      // short central garland. This also works when there is no station sign.
      const x = Math.floor(art.W / 2) - 48;
      spans.push(x);
      for (const post of [x, x + 96]) cord.vline(post, y, gy - y, '@dCord');
    }
    // More tracks share the same small visual budget, rather than tripling it.
    const offsets = !track.overhead || art.tracks.length === 1 ? [19, 46, 73]
      : art.tracks.length === 2 ? [26, 62] : [46];
    for (const x of spans) {
      cord.hline(x, y, 13, '@dCord');
      cord.hline(x + 13, y + 1, 71, '@dCord');
      cord.hline(x + 84, y, 13, '@dCord');
      for (const offset of offsets) {
        const color = colors[n++ % colors.length];
        poses.forEach((g, pose) => flag(g, x + offset, y + 2, color, pose));
      }
    }
  });
  art.front += group(cord, art, 'd-cord') + group(poses[0], art, 'd-flag0') + group(poses[1], art, 'd-flag1');
  alternate(art, 'd-flag0', 'd-flag1', 3.6);
}

function christmas(art) {
  const bulbs = [grid(art), grid(art)];
  const colors = ['@dRed', '@dAmber', '@dGreen', '@dBlue'];
  let n = 0;
  const bulb = (x, y) => {
    bulbs[n % 2].set(x, y, colors[n % colors.length]);
    n++;
  };
  const border = (x, y, w, h) => {
    for (let dx = 0; dx < w; dx += 6) {
      bulb(x + dx, y);
      bulb(x + dx, y + h - 1);
    }
    for (let dy = 4; dy < h - 1; dy += 6) {
      bulb(x, y + dy);
      bulb(x + w - 1, y + dy);
    }
  };
  art.tracks.forEach((track, k) => {
    const gy = GY0 + PITCH * k;
    if (track.overhead) {
      for (let mast = 30; mast + 96 < art.W; mast += 96) {
        // Each bulb hangs 2 px from the wire (a single pixel was too faint to read at 1x).
        for (let x = mast + 12; x < mast + 94; x += 5) {
          bulb(x, gy - TRAIN_H + 1);
          bulbs[(n - 1) % 2].set(x, gy - TRAIN_H + 2, colors[(n - 1) % colors.length]);
        }
      }
    } else if (k === 0 && signWidth(art.user)) {
      border(14, 10, signWidth(art.user), 13);
    } else {
      // Extra tracks and nameless stations have their own signal to decorate.
      border(signalX(track, art.W) - 1, gy - 33, 7, 15);
    }
  });
  art.front += group(bulbs[0], art, 'd-light0') + group(bulbs[1], art, 'd-light1');
  alternate(art, 'd-light0', 'd-light1', 1.8);
}

function hacktoberfest(art) {
  const body = grid(art);
  const faces = [grid(art), grid(art)];
  art.tracks.forEach((track, k) => {
    // The approach side of each signal, below the wheel band on the ballast.
    const x = signalX(track, art.W) + (track.dir === -1 ? 8 : -10);
    const y = GY0 + PITCH * k + 5;
    body.rect(x + 1, y + 1, 5, 5, '@dPumpkin');
    body.rect(x, y + 2, 7, 3, '@dPumpkin');
    body.vline(x, y + 2, 3, '@dPumpkinShade');
    body.hline(x + 1, y + 5, 5, '@dPumpkinShade');
    body.set(x + 3, y, '@dStem');
    for (const [dx, dy] of [[2, 2], [4, 2], [2, 4], [3, 4], [4, 4]]) {
      body.set(x + dx, y + dy, '@dFaceDim');
      faces[0].set(x + dx, y + dy, '@dFace');
      faces[1].set(x + dx, y + dy, dx === 3 ? '@dFace' : '@dFaceDim');
    }
  });
  art.front += group(body, art, 'd-pumpkin') + group(faces[0], art, 'd-flame0') + group(faces[1], art, 'd-flame1');
  art.rules.push('@keyframes d-candle0{0%,72%,88%{opacity:1}60%,82%{opacity:0}}',
    '@keyframes d-candle1{0%,72%,88%{opacity:0}60%,82%{opacity:1}}');
  animate(art, 'd-flame0', 'd-candle0 2.4s step-end infinite', 'opacity:1;');
  animate(art, 'd-flame1', 'd-candle1 2.4s step-end infinite', 'opacity:0;');
}

function newyear(art) {
  const rays = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  const phases = ['rise', 'open', 'full', 'fall'];
  /** @type {Array<[number, number, string]>} */
  const bursts = [[0.32, 26, '@dAmber'], [0.55, 17, '@dPink'], [0.76, 32, '@dCyan']];
  bursts.forEach(([fraction, y, color], i) => {
    const x = Math.floor(art.W * fraction);
    const frames = phases.map(() => grid(art));
    frames[0].vline(x, y + 14, 3, color);
    frames[0].set(x, y + 19, color);
    for (const [dx, dy] of rays) {
      const diagonal = dx && dy;
      frames[1].set(x + dx * (diagonal ? 3 : 4), y + dy * (diagonal ? 3 : 4), color);
      for (const r of [9, 10]) {
        const radius = diagonal ? r - 3 : r;
        frames[2].set(x + dx * radius, y + dy * radius, color);
      }
      const radius = diagonal ? 8 : 11;
      frames[3].vline(x + dx * radius, y + dy * radius + 5, 2, color);
    }
    frames[2].set(x, y, color);
    // Kept in back: tall buildings can occlude the bursts, never vice versa.
    art.back += `<g class="d-burst${i}">${frames.map((g, p) => group(g, art, `d-${phases[p]}`)).join('')}</g>`;
    art.rules.push(`.d-burst${i}{--d-delay:-${i * 3}s}`);
  });
  const windows = [[0, 8], [8, 16], [16, 28], [28, 36]];
  phases.forEach((phase, i) => {
    const [start, end] = windows[i];
    // Launch and falling embers also move one pixel per pose; the long gap
    // after 36% leaves each individual burst dark for most of its cycle.
    const travel = phase === 'rise' || phase === 'fall'
      ? Array.from({ length: 8 }, (_, step) =>
        `${start + step}%{transform:translateY(${phase === 'rise' ? -step : step}px)}`).join('') : '';
    art.rules.push(`@keyframes d-${phase}{${start ? '0%{opacity:0}' : ''}${start}%{opacity:1}${travel}${end}%,100%{opacity:0}}`);
    animate(art, `d-${phase}`, `d-${phase} 9s step-end var(--d-delay) infinite`, `opacity:${phase === 'full' ? 1 : 0};`);
  });
}

const painters = { winter, spring, autumn: (art) => falling(art, 'autumn'), muertos, christmas, hacktoberfest, newyear };

// Returns SVG layers, their CSS, and only the additional theme variables used.
export function decorLayers(kind, scene, used) {
  if (!Object.hasOwn(DECORATIONS, kind)) throw new Error(`Unknown decoration: "${kind}"`);
  const art = { ...scene, used, back: '', front: '', rules: [], animated: new Set() };
  painters[kind](art);
  art.rules.push(`@media (prefers-reduced-motion:reduce){${[...art.animated].map((cls) => `.${cls}`).join(',')}{animation:none!important}}`);
  const vars = Object.fromEntries(Object.entries(DECOR_THEMES).map(([theme, colors]) =>
    [theme, Object.fromEntries(Object.entries(colors).filter(([name]) => used.has(name)))],
  ));
  return { back: art.back, front: art.front, css: art.rules.join(''), vars };
}
