// Compone la escena SVG: fondo, vías y uno o varios trenes animados.
// Todo el movimiento es CSS dentro del SVG (funciona al incrustarlo con <img>
// en un README) y avanza de 1 px en 1 px con steps() para conservar el pixel art.

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

export { SCENE_W, sceneHeight };

// Velocidad según la actividad de ayer.
export const STATES = {
  idle: { dur: 0 },
  slow: { dur: 34, wheel: 0.34 },
  normal: { dur: 17, wheel: 0.18 },
  fast: { dur: 8, wheel: 0.09, sparks: true, lines: true },
};

function speedLines(seed) {
  const g = new Grid(48, TRAIN_H);
  const rand = rng(seed);
  for (const row of [TOP + 3, TOP + 7, TOP + 11, TOP + 15, TOP + 19, TOP + 23]) {
    const len = 14 + Math.floor(rand() * 26);
    const gap = 2 + Math.floor(rand() * 8);
    g.hline(48 - gap - len, row, len, '@speed');
  }
  return g;
}

export function renderScene(spec) {
  const { theme = 'auto', scale = 2, user = '', title = 'Tren de GitHub' } = spec;
  if (!spec.tracks?.length) throw new Error('renderScene necesita al menos una vía');
  // Cada vía sabe si su tren toma corriente de catenaria (pantógrafo) o de tercer riel.
  const tracks = spec.tracks.map((t) => {
    const model = typeof t.model === 'string' ? getModel(t.model) : t.model;
    return { ...t, model, overhead: !!model.pant };
  });
  const W = SCENE_W;
  const H = sceneHeight(tracks.length);
  const used = new Set();
  const css = [];
  let svg = '';

  const stars = starsLayers(W, used);
  svg +=
    skyLayer(W, used) +
    celestialLayer(W, used) +
    `<g class="tw twa">${stars.a}</g><g class="tw twb">${stars.b}</g>` +
    `<g class="cl">${cloudsLayer(W, used)}</g>` +
    bandsLayer(W, tracks, used) +
    railsLayer(W, tracks, used) +
    paintBackdrop(W, H, tracks, user).paths(used);
  used.add('shadow');

  tracks.forEach((t, k) => {
    const dir = t.dir === -1 ? -1 : 1;
    const train = buildTrain(t.model, { cars: t.cars, stripe: t.stripe, streak: t.streak, label: t.label, dir });
    const st = STATES[t.state] ?? STATES.idle;
    const gy = GY0 + PITCH * k;
    const y0 = gy - TRAIN_H;
    const L = train.layers;
    const group = (name, cls) => (L[name].isEmpty() ? '' : `<g class="${cls}">${L[name].paths(used)}</g>`);
    const moving = st.dur > 0;
    const center = Math.round((W - train.width) / 2);
    const margin = Math.min(10, Math.floor((W - train.width) / 2));
    const parked = tracks.length === 1 ? center : dir === 1 ? W - train.width - margin : margin;
    const rest = moving ? center : t.parkAt ?? parked;

    // Sombra sobre el balasto, bajo las ruedas.
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
    if (moving && st.sparks) inner += group('sa', `sp sa${k}`) + group('sb', `sp sb${k}`);

    if (moving) {
      const from = dir === 1 ? -train.width : W;
      const to = dir === 1 ? W : -train.width;
      const steps = W + train.width;
      const delay = -(st.dur * ((0.12 + 0.37 * k) % 1)).toFixed(2);
      css.push(
        `.tr${k}{transform:translateX(${rest}px);animation:d${k} ${st.dur}s steps(${steps}) ${delay}s infinite}`,
        `@keyframes d${k}{from{transform:translateX(${from}px)}to{transform:translateX(${to}px)}}`,
        `.wa${k}{animation:wa ${st.wheel}s step-end infinite}`,
        `.wb${k}{animation:wb ${st.wheel}s step-end infinite}`,
      );
      if (st.sparks) {
        css.push(`.sa${k}{animation:sa .2s step-end infinite}`, `.sb${k}{animation:sb .2s step-end infinite}`);
      }
      svg += `<g transform="translate(0 ${y0})"><g class="tr tr${k}">${inner}</g></g>`;
    } else {
      css.push(`.wb${k}{opacity:0}`, `.do${k}{animation:dopen 14s step-end ${-(k * 4.5)}s infinite}`);
      svg += `<g transform="translate(${rest} ${y0})">${inner}</g>`;
    }
  });

  const themeVars = (name) =>
    Object.entries(THEMES[name]).map(([key, v]) => `--${key}:${v}`).join(';');
  const rootCss =
    theme === 'auto'
      ? `:root{${themeVars('light')}}@media (prefers-color-scheme:dark){:root{${themeVars('dark')}}}`
      : `:root{${themeVars(theme === 'dark' ? 'dark' : 'light')}}`;

  const classCss =
    [...used].sort().map((n) => `.c-${n}{fill:var(--${n})}`).join('') +
    [1, 2, 3].map((i) => `.s-sky${i}{stroke:var(--sky${i});fill:none}`).join('') +
    '.s-sleeper{stroke:var(--sleeper);fill:none}';
  const shared = [
    '.do{opacity:0}',
    `.cl{animation:cl 240s steps(${W}) infinite}`,
    `@keyframes cl{from{transform:translateX(0)}to{transform:translateX(-${W}px)}}`,
    '.twa{animation:twa 5s step-end infinite}',
    '.twb{animation:twb 5s step-end infinite}',
    '@keyframes twa{0%{opacity:1}50%{opacity:.2}}',
    '@keyframes twb{0%{opacity:.2}50%{opacity:1}}',
    '.led{animation:led 2.4s step-end infinite}',
    '@keyframes led{0%{opacity:1}90%{opacity:.35}95%{opacity:1}}',
    '@keyframes wa{0%{opacity:1}50%{opacity:0}}',
    '@keyframes wb{0%{opacity:0}50%{opacity:1}}',
    '@keyframes sa{0%{opacity:1}50%{opacity:0}}',
    '@keyframes sb{0%{opacity:0}50%{opacity:1}}',
    '@keyframes dopen{0%{opacity:0}8%{opacity:1}78%{opacity:0}}',
    '@media (prefers-reduced-motion:reduce){.tr,.wa,.wb,.sp,.led,.do,.cl,.tw{animation:none!important}}',
  ].join('');

  const safeTitle = String(title).replace(/[<&>"]/g, '');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * scale}" height="${H * scale}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="${safeTitle}">` +
    `<title>${safeTitle}</title><style>${rootCss}${classCss}${shared}${css.join('')}</style>${svg}</svg>`
  );
}
