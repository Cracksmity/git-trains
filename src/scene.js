// Compose the SVG scene: background, tracks, and one or more animated trains.
// All movement is CSS inside the SVG (works when embedded with <img>
// in a README) and advances 1 px at a time with steps() to preserve the pixel art.

import { Grid } from './pixel.js';
import { buildTrain, TRAIN_H, TOP } from './train.js';
import { getModel } from './models.js';
import {
  SCENE_W,
  GY0,
  PITCH,
  THEMES,
  rng,
  sceneHeight,
  skyLayer,
  celestialLayer,
  starsLayers,
  cloudsLayer,
  bandsLayer,
  railsLayer,
  paintBackdrop,
} from './scenery.js';
import { decorationFor } from './seasons.js';
import { decorLayers } from './decor.js';

export { SCENE_W, sceneHeight };

// Speed based on yesterday?s activity.
export const STATES = {
  idle: { dur: 0 },
  slow: { dur: 34, wheel: 0.34 },
  normal: { dur: 17, wheel: 0.18 },
  fast: { dur: 8, wheel: 0.09, sparks: true, lines: true },
};

export function speedLines(seed) {
  const g = new Grid(48, TRAIN_H);
  const rand = rng(seed);
  for (const row of [TOP + 3, TOP + 7, TOP + 11, TOP + 15, TOP + 19, TOP + 23]) {
    const len = 14 + Math.floor(rand() * 26);
    const gap = 2 + Math.floor(rand() * 8);
    g.hline(48 - gap - len, row, len, '@speed');
  }
  return g;
}

// Periods, in seconds, of the animations that don't depend on the speed.
export const TIMING = { clouds: 240, twinkle: 5, led: 2.4, doors: 14, doorStagger: 4.5, sparks: 0.2, steam: 3 };
const sec = (v) => `${v}`.replace(/^0\./, '.');

// Where each train stands and how it moves. renderScene writes it as CSS;
// scripts/export.js samples the same numbers frame by frame for PNG and GIF.
export function planScene(spec) {
  if (!spec.tracks?.length) throw new Error('renderScene needs at least one track');
  // Each track knows whether its train draws power from overhead wires (pantograph) or a third rail.
  const tracks = spec.tracks.map((t) => {
    const model = typeof t.model === 'string' ? getModel(t.model) : t.model;
    return { ...t, model, overhead: !!model.pant };
  });
  const W = SCENE_W;
  const trains = tracks.map((t, k) => {
    const dir = t.dir === -1 ? -1 : 1;
    const train = buildTrain(t.model, { cars: t.cars, stripe: t.stripe, streak: t.streak, label: t.label, dir, extra: t.extra });
    const st = STATES[t.state] ?? STATES.idle;
    const moving = st.dur > 0;
    const center = Math.round((W - train.width) / 2);
    const margin = Math.min(10, Math.floor((W - train.width) / 2));
    const parked = tracks.length === 1 ? center : dir === 1 ? W - train.width - margin : margin;
    return {
      train,
      dir,
      st,
      moving,
      y0: GY0 + PITCH * k - TRAIN_H,
      rest: moving ? center : t.parkAt ?? parked,
      // Moving: `steps` jumps of 1 px from `from` to `to` every st.dur seconds, `delay` seconds in.
      from: dir === 1 ? -train.width : W,
      to: dir === 1 ? W : -train.width,
      steps: W + train.width,
      delay: moving ? -(st.dur * ((0.12 + 0.37 * k) % 1)).toFixed(2) : 0,
      // Locomotive smoke: puffs come more often the faster it goes; when stopped,
      // it releases steam slowly.
      puff: moving ? +(st.wheel * 4).toFixed(2) : TIMING.steam,
    };
  });
  return { W, H: sceneHeight(tracks.length), tracks, trains };
}

export function renderScene(spec) {
  // spec.skyline: background already validated with parseSkyline (null = the random city).
  const { theme = 'auto', scale = 2, user = '', title = 'GitHub train' } = spec;
  const { W, H, tracks, trains } = planScene(spec);
  const used = new Set();
  const css = [];
  let svg = '';

  const stars = starsLayers(W, used);
  const backdrop = paintBackdrop(W, H, tracks, user, spec.skyline ?? null);
  // Season or holiday of spec.date (see seasons.js); no date or a plain day adds nothing.
  const kind = spec.date ? decorationFor(spec.date, spec.hemisphere) : null;
  const decor = kind && decorLayers(kind, { W, H, tracks, user, backdrop }, used);
  svg +=
    skyLayer(W, used) +
    celestialLayer(W, used) +
    `<g class="tw twa">${stars.a}</g><g class="tw twb">${stars.b}</g>` +
    `<g class="cl">${cloudsLayer(W, used)}</g>` +
    (decor?.back ?? '') +
    bandsLayer(W, tracks, used) +
    railsLayer(W, tracks, used) +
    backdrop.paths(used) +
    (decor?.front ?? '');
  used.add('shadow');

  trains.forEach(({ train, dir, st, moving, y0, rest, from, to, steps, delay, puff }, k) => {
    const L = train.layers;
    const group = (name, cls) => (L[name].isEmpty() ? '' : `<g class="${cls}">${L[name].paths(used)}</g>`);

    // Shadow on the ballast, beneath the wheels.
    let inner = `<rect class="c-shadow" y="${TRAIN_H + 2}" width="${train.width}" height="2"/>`;
    if (moving && st.lines) {
      const lg = dir === 1 ? speedLines(900 + k) : speedLines(900 + k).mirror();
      inner += `<g transform="translate(${dir === 1 ? -48 : train.width} 0)">${lg.paths(used)}</g>`;
    }
    inner += group('body', 'b');
    inner += group('lit', 'lit');
    inner += group('wa', `wa wa${k}`);
    inner += group('wb', `wb wb${k}`);
    inner += group('open', `do do${k}`);
    inner += group('led', 'led');
    if (!L.pa.isEmpty()) {
      inner += group('pa', `sm pa${k}`) + group('pb', `sm pb pb${k}`);
      css.push(`.pa${k}{animation:sa ${puff}s step-end infinite}`, `.pb${k}{animation:sb ${puff}s step-end infinite}`);
    }
    if (moving && st.sparks) inner += group('sa', `sp sa${k}`) + group('sb', `sp sb${k}`);

    if (moving) {
      css.push(
        `.tr${k}{transform:translateX(${rest}px);animation:d${k} ${st.dur}s steps(${steps}) ${delay}s infinite}`,
        `@keyframes d${k}{from{transform:translateX(${from}px)}to{transform:translateX(${to}px)}}`,
        `.wa${k}{animation:wa ${st.wheel}s step-end infinite}`,
        `.wb${k}{animation:wb ${st.wheel}s step-end infinite}`,
      );
      if (st.sparks) {
        const s = sec(TIMING.sparks);
        css.push(`.sa${k}{animation:sa ${s}s step-end infinite}`, `.sb${k}{animation:sb ${s}s step-end infinite}`);
      }
      svg += `<g transform="translate(0 ${y0})"><g class="tr tr${k}">${inner}</g></g>`;
    } else {
      const doors = `dopen ${TIMING.doors}s step-end ${-(k * TIMING.doorStagger)}s infinite`;
      css.push(`.wb${k}{opacity:0}`, `.do${k}{animation:${doors}}`);
      svg += `<g transform="translate(${rest} ${y0})">${inner}</g>`;
    }
  });

  const themeVars = (name) =>
    Object.entries({ ...THEMES[name], ...decor?.vars[name] }).map(([key, v]) => `--${key}:${v}`).join(';');
  const rootCss =
    theme === 'auto'
      ? `:root{${themeVars('light')}}@media (prefers-color-scheme:dark){:root{${themeVars('dark')}}}`
      : `:root{${themeVars(theme === 'dark' ? 'dark' : 'light')}}`;

  const classCss =
    [...used].sort().map((n) => `.c-${n}{fill:var(--${n})}`).join('') +
    [1, 2, 3].map((i) => `.s-sky${i}{stroke:var(--sky${i});fill:none}`).join('') +
    '.s-sleeper{stroke:var(--sleeper);fill:none}';
  // scripts/export.js samples these keyframes for the GIF frames: change both together.
  const shared = [
    '.do{opacity:0}',
    `.cl{animation:cl ${TIMING.clouds}s steps(${W}) infinite}`,
    `@keyframes cl{from{transform:translateX(0)}to{transform:translateX(-${W}px)}}`,
    `.twa{animation:twa ${TIMING.twinkle}s step-end infinite}`,
    `.twb{animation:twb ${TIMING.twinkle}s step-end infinite}`,
    '@keyframes twa{0%{opacity:1}50%{opacity:.2}}',
    '@keyframes twb{0%{opacity:.2}50%{opacity:1}}',
    `.led{animation:led ${TIMING.led}s step-end infinite}`,
    '@keyframes led{0%{opacity:1}90%{opacity:.35}95%{opacity:1}}',
    '@keyframes wa{0%{opacity:1}50%{opacity:0}}',
    '@keyframes wb{0%{opacity:0}50%{opacity:1}}',
    '@keyframes sa{0%{opacity:1}50%{opacity:0}}',
    '@keyframes sb{0%{opacity:0}50%{opacity:1}}',
    '@keyframes dopen{0%{opacity:0}8%{opacity:1}78%{opacity:0}}',
    '@media (prefers-reduced-motion:reduce){.tr,.wa,.wb,.sp,.sm,.led,.do,.cl,.tw{animation:none!important}.pb{opacity:0}}',
  ].join('');

  const safeTitle = String(title).replace(/[<&>"]/g, '');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * scale}" height="${H * scale}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="${safeTitle}">` +
    `<title>${safeTitle}</title><style>${rootCss}${classCss}${shared}${css.join('')}${decor?.css ?? ''}</style>${svg}</svg>`
  );
}
