// The weather over each place of a scene: an overcast sky, rain, a storm with
// lightning, and the wet ground each place paints itself (see jalisco-weather.js).
// Like decor.js it adds layers and only the inks it uses; like sky.js it keeps
// its grids, so scripts/export.js paints the same pixels with the same timing.
import { Grid, rng } from '../graphics/pixel.js';
import { BALLAST, GY0, PITCH } from './layout.js';
import { WEATHER_THEMES, skyInk, skyState } from '../weather/inks.js';
import { hailLayers } from './weather-hail.js';
import { fallTile, windTileCopies } from './weather-fall.js';
import { heatSky } from './weather-heat.js';
import { snowLayers } from './weather-snow.js';
import { swayKeyframe } from './snow.js';
import { JALISCO_WEATHER } from '../landscape/jalisco-weather.js';
import { jaliscoWind } from '../landscape/jalisco-weather-wind.js';
import { guadalajaraHaze } from '../landscape/jalisco-weather-haze.js';
import { showsHaze } from '../weather/conditions.js';
import { placesFor } from '../weather/places.js';

/**
 * Presets whose weather replaces the seasonal snow, blossom and leaves. Holidays
 * always stay. A scene left out keeps its seasons alongside the weather.
 */
export const WEATHER_OVER_SEASONS = ['jalisco'];

// Each place's own art, by place id.
const PLACE_ART = { ...JALISCO_WEATHER };

// Lightning: two quick flashes at the start of a 9-second cycle (well under three per second).
export const FLASH = { period: 9, keys: /** @type {Array<[number, number]>} */ ([[0, 0], [0.02, 1], [0.035, 0], [0.06, 1], [0.075, 0]]) };
// How far into its cycle each place's lightning starts: Guadalajara's first flash is
// on in frame 0, so the static PNG shows a storm over the Cathedral.
const FLASH_OFFSET = [0.225, 3, 6];
// A gust bends the trees for the first part of the cycle, then lets them settle.
export const SWAY = { period: 3, release: 0.4 };
// Pixels per second of the far and near drops.
const RAIN_SPEED = { drizzle: [24, 36], rain: [44, 64], storm: [60, 90] };
// Area per drop, in square pixels: smaller is denser.
const RAIN_SPACING = { drizzle: [1200, 1100], rain: [330, 520], storm: [170, 260] };
// Drop height in pixels, far and near.
const RAIN_LENGTH = { drizzle: [1, 1], rain: [2, 3], storm: [2, 4] };
// Seed offset per state so rain and storm keep their exact patterns.
const RAIN_SEED = { drizzle: 2, rain: 0, storm: 5 };

// The inks that paint the sky of a country strip.
const COUNTRY_SKY = new Set(['@dusk', '@haze', '@afterglow', '@starlight']);

/**
 * @typedef {object} WeatherLayer
 * @property {Grid} grid
 * @property {(used: Set<string>) => string} [svg] a lighter SVG drawing of the same pixels than grid.paths
 * @property {'sky' | 'ground'} z sky: behind the city and countryside; ground: over them, behind the trains
 * @property {number} y scene row of the grid's first row
 * @property {[number, number]} [clip] scene rows the layer may paint, end exclusive
 * @property {{ h: number, dur: number, dx?: number, flutter?: number }} [fall] drops h rows and drifts dx pixels every dur seconds,
 *   looping; flutter shifts the falling flakes one pixel and back over that many seconds
 * @property {boolean} [sway] moves a crown one pixel in the gust
 * @property {boolean} [drift] shares the clouds' loop: a 2W-wide grid sliding W pixels
 * @property {{ offset: number }} [blink] lightning, `offset` seconds into its cycle at frame 0
 */

/**
 * Where each track's place lies: its sky starts at `top`, its rail is `base`, its ballast ends at `bottom`.
 * @param {number} count tracks
 */
export function weatherBands(count) {
  return Array.from({ length: count }, (_, k) => {
    const base = GY0 + PITCH * k;
    return { k, top: k === 0 ? 0 : base - (PITCH - BALLAST), base, bottom: base + BALLAST };
  });
}

// The city's sky: four bands of the state's inks with the dithered seams of sky.js.
// The grid is for the raster exporter; the SVG draws the seams as dashed strokes, as skyLayer does.
function citySky(state, W) {
  const g = new Grid(W, GY0);
  const bh = GY0 / 4;
  for (let i = 0; i < 4; i++) g.rect(0, i * bh, W, bh, skyInk(state, i));
  for (let i = 1; i < 4; i++) {
    for (let x = 0; x < W; x++) {
      if (x % 4 === 0) g.set(x, i * bh - 3, skyInk(state, i));
      if (x % 2 === 1) g.set(x, i * bh - 2, skyInk(state, i));
      if (x % 4 !== 3) g.set(x, i * bh - 1, skyInk(state, i));
    }
  }
  /** @param {Set<string>} used */
  const svg = (used) => {
    let out = '';
    for (let i = 0; i < 4; i++) {
      const ink = skyInk(state, i).slice(1);
      used.add(ink);
      out += `<rect class="c-${ink}" y="${i * bh}" width="${W}" height="${bh}"/>`;
      if (!i) continue;
      /** @type {Array<[number, string, number]>} rows above the seam, dash pattern, shift */
      const seams = [[3, '1 3', 0], [2, '1 1', 1], [1, '3 1', 0]];
      for (const [dy, dash, shift] of seams) {
        out += `<path style="stroke:var(--${ink})" fill="none" stroke-dasharray="${dash}" stroke-dashoffset="${-shift}" d="M0 ${i * bh - dy + 0.5}H${W}"/>`;
      }
    }
    return out;
  };
  return { grid: g, svg };
}

// A cloud ceiling over the city, two scene widths long so it loops with the clouds.
// The heavier the weather, the lower and darker it hangs, with banks beneath it.
function cityDeck(state, W) {
  const g = new Grid(W * 2, GY0);
  const depth = { cloudy: 8, rain: 13, storm: 17 }[state];
  const wave = (x, k, a) => a * Math.sin((2 * Math.PI * k * x) / W);
  for (let x = 0; x < W * 2; x++) {
    const bottom = Math.round(depth + wave(x, 7, 2.6) + wave(x, 19, 1.6) + wave(x, 41, 0.8));
    g.vline(x, 0, bottom, skyInk(state, 'Cloud'));
    g.vline(x, bottom, 2, skyInk(state, 'CloudShade'));
  }
  const banks = { cloudy: 5, rain: 6, storm: 7 }[state];
  const rand = rng(5300 + depth);
  for (let i = 0; i < banks; i++) {
    const x = Math.floor((i + rand() * 0.6) * (W / banks));
    const y = depth + 7 + Math.floor(rand() * (state === 'cloudy' ? 18 : 12));
    const w = 24 + Math.floor(rand() * 30);
    const lumps = Array.from({ length: Math.max(2, Math.round(w / 10)) }, () => 2 + Math.floor(rand() * 3));
    const art = bank(w, lumps, state);
    // A bank that crosses either end is drawn a scene width away too, so the loop has no seam.
    for (const o of [-W, 0, W]) placeBank(g, art, x + o, y);
  }
  return g;
}

// A flat-bottomed bank of cloud with rounded lumps: a lit crown, a body and a shaded base.
// Its grid has a 6-pixel margin on each side and ends one row below the base.
function bank(w, lumps, state) {
  const top = Math.max(...lumps) + 1;
  const g = new Grid(w + 12, top + 2);
  lumps.forEach((r, i) => {
    const cx = 6 + Math.round(((i + 0.5) * w) / lumps.length);
    for (let dy = -r; dy <= 0; dy++) {
      const half = Math.round(Math.sqrt(r * r - dy * dy) * 1.4) + 1;
      g.hline(cx - half, top + dy, 2 * half + 1, skyInk(state, 'Cloud'));
    }
  });
  for (let x = 0; x < g.w; x++) {
    for (let y = 0; y <= top; y++) {
      if (!g.get(x, y)) continue;
      g.set(x, y, skyInk(state, 'CloudLit'));
      break;
    }
  }
  for (let x = 0; x < g.w; x++) if (g.get(x, top)) g.set(x, top + 1, skyInk(state, 'CloudShade'));
  return g;
}

const isCountrySky = (backdrop, x, y) => COUNTRY_SKY.has(backdrop.get(x, y));

/** Place a bank by its left edge and flat base.
 * @param {(x: number, y: number) => boolean} [visible] restricts the bank to exposed sky
 */
function placeBank(g, art, left, base, visible) {
  for (let by = 0; by < art.h; by++) {
    for (let bx = 0; bx < art.w; bx++) {
      const ink = art.get(bx, by);
      const x = left + bx - 6;
      const y = base - art.h + 2 + by;
      if (ink && (!visible || visible(x, y))) g.set(x, y, ink);
    }
  }
}

/** @returns {WeatherLayer} */
function partlyClouds(banks, band, backdrop, W) {
  const city = band.k === 0;
  const grid = new Grid(city ? 2 * W : W, band.base - band.top);
  const offsets = city ? [-W, 0, W] : [0];
  const visible = city ? undefined : (x, y) => isCountrySky(backdrop, x, band.top + y);
  for (const [left, base, width, lumps] of banks) {
    const art = bank(width, lumps, 'partly');
    for (const offset of offsets) placeBank(grid, art, left + offset, base, visible);
  }
  return { grid, z: city ? 'sky' : 'ground', y: band.top, drift: city };
}

// Rain and storms dim the light: one translucent veil over the place, behind its rain.
function veil(state, band, W) {
  const g = new Grid(W, (band.k === 0 ? GY0 : band.base) - band.top);
  g.rect(0, 0, W, g.h, state === 'storm' ? '@wDimStorm' : '@wDimRain');
  return g;
}

// A country strip's sky, recoloured pixel by pixel so the ridges and roofs stay in
// front: three flat bands of the state's inks (an overcast sky has no glow to dither),
// a ceiling along the top and a few banks beneath it, lower and more of them in heavier weather.
function countrySky(state, band, backdrop, W) {
  const clouds = new Grid(W, band.base - band.top);
  const depth = { cloudy: 2, rain: 4, storm: 6 }[state];
  for (let x = 0; x < W; x++) {
    const bottom = Math.round(depth + 1.2 * Math.sin(x / 19 + band.k) + 0.8 * Math.sin(x / 7 + 2 * band.k));
    clouds.vline(x, 0, bottom, skyInk(state, 'Cloud'));
    clouds.set(x, bottom, skyInk(state, 'CloudShade'));
  }
  const banks = { cloudy: 4, rain: 5, storm: 6 }[state];
  const rand = rng(6100 + 10 * band.k + depth);
  for (let i = 0; i < banks; i++) {
    const x = Math.floor((i + rand() * 0.7) * (W / banks));
    const w = 18 + Math.floor(rand() * 26);
    const lumps = Array.from({ length: Math.max(2, Math.round(w / 9)) }, () => 1 + Math.floor(rand() * 3));
    const art = bank(w, lumps, state);
    const y = depth + 6 + Math.floor(rand() * 5);
    placeBank(clouds, art, x, y);
  }
  const g = new Grid(W, band.base - band.top);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < W; x++) {
      if (isCountrySky(backdrop, x, band.top + y)) g.set(x, y, clouds.get(x, y) ?? skyInk(state, y < 7 ? 1 : y < 13 ? 2 : 3));
    }
  }
  return g;
}

// Two depths of falling streaks over the whole place, ballast included.
function rainLayers(state, band, W, wind) {
  const h = band.bottom - band.top;
  return [0, 1].map((near) => {
    const count = Math.round((W * h) / RAIN_SPACING[state][near]);
    const length = Math.max(wind ? 2 : 1, RAIN_LENGTH[state][near]);
    const rand = rng(7100 + 10 * band.k + near + RAIN_SEED[state]);
    const { grid, pixel } = fallTile(W, h, wind);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(((i + rand()) * W) / count);
      const y = Math.floor(rand() * h);
      for (let d = 0; d < length; d++) pixel(x, y + d, near ? '@wDrop' : '@wDropFar');
    }
    const dur = Math.round((h / RAIN_SPEED[state][near]) * 100) / 100;
    return { grid, z: /** @type {const} */ ('ground'), y: band.top, clip: /** @type {[number, number]} */ ([band.top, band.bottom]), fall: { h, dur, dx: wind ? h : 0 } };
  });
}

// A jagged bolt: short diagonal runs that turn back, with one branch.
function bolt(g, x, y0, y1, seed, paint) {
  const rand = rng(seed);
  let cx = x;
  let dir = 1;
  let branched = false;
  for (let y = y0; y < y1; ) {
    const run = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < run && y < y1; i++, y++) {
      if (i) cx += dir;
      paint(cx, y);
      if (!branched && y > y0 + (y1 - y0) / 3) {
        branched = true;
        for (let j = 1; j <= 6; j++) paint(cx - dir * Math.ceil(j * 0.7), y + j);
      }
    }
    dir = -dir;
  }
  return g;
}

// The lightning of a storm: the sky lights up behind the silhouettes, with the bolt in front of it.
function lightning(band, backdrop, W, art) {
  const h = (band.k === 0 ? GY0 : band.base) - band.top;
  const g = new Grid(W, h);
  const sky = (x, y) => band.k === 0 || isCountrySky(backdrop, x, band.top + y);
  for (let y = 0; y < h; y++) for (let x = 0; x < W; x++) if (sky(x, y)) g.set(x, y, '@wFlash');
  const { x, from, to } = art.bolt;
  bolt(g, x, from, to, 8800 + band.k, (px, py) => { if (sky(px, py)) g.set(px, py, '@wBolt'); });
  /** @type {'sky' | 'ground'} The city's flash goes behind its skyline; the countryside's is already masked. */
  const z = band.k === 0 ? 'sky' : 'ground';
  return { grid: g, z, y: band.top, blink: { offset: FLASH_OFFSET[band.k] ?? 0 } };
}

/**
 * The layers of a scene's weather, bottom to top within each depth.
 * @param {Array<string | null>} weather one state per track
 * @param {{ W: number, H: number, tracks: unknown[], backdrop: Grid, skyline?: { preset?: string, variant?: string } | null, sky?: Array<import('../weather/conditions.js').PlaceSky | null> }} scene each place's state and a live reading's extras (see placeSky)
 * @returns {WeatherLayer[]}
 */
export function weatherArt(weather, { W, H, tracks, backdrop, skyline, sky }) {
  const places = placesFor(skyline) ?? [];
  const bands = weatherBands(tracks.length);
  /** @type {WeatherLayer[]} */
  const layers = [];
  bands.forEach((band) => {
    const state = weather[band.k];
    const place = places[band.k]?.id;
    const art = PLACE_ART[place];
    if (!state || !art) return;
    const wind = sky?.[band.k]?.wind === true;
    const haze = showsHaze(place, sky?.[band.k]);
    const cover = skyState(state);
    // Fog hides the crowns and frost and snow rest on them: their wind goes over the painted ground.
    const settled = state === 'fog' || state === 'frost' || state === 'snow';
    if (state === 'heat') {
      layers.push(...heatSky(band, backdrop, art.heatDepth ? band.top + art.heatDepth : undefined));
      if (art.heat) layers.push(...art.heat(band, backdrop));
    } else if (state === 'partly') {
      layers.push(partlyClouds(art.partly, band, backdrop, W));
    } else if (state !== 'clear' && state !== 'frost') {
      if (band.k === 0) {
        layers.push({ ...citySky(cover, W), z: 'sky', y: 0 });
        layers.push({ grid: cityDeck(cover, W), z: 'sky', y: 0, drift: state !== 'hail' });
      } else {
        layers.push({ grid: countrySky(cover, band, backdrop, W), z: 'ground', y: band.top });
      }
    }
    if (haze) layers.push(guadalajaraHaze(band, backdrop));
    if (wind && !settled) layers.push(...jaliscoWind(place, band, backdrop, state));
    if (state === 'clear' || state === 'partly' || state === 'heat') return;
    if (cover === 'rain' || cover === 'storm') layers.push({ grid: veil(cover, band, W), z: 'ground', y: band.top });
    const ground = new Grid(W, H);
    // The flash lights the sky behind the place's own clouds, such as the volcano's cap.
    if (cover === 'storm') layers.push(lightning(band, backdrop, W, art));
    art.paint(ground, state, band, backdrop, haze);
    if (!ground.isEmpty()) layers.push({ grid: ground, z: 'ground', y: 0 });
    if (wind && settled) layers.push(...jaliscoWind(place, band, backdrop, state, state === 'fog' ? null : ground));
    if (state in RAIN_SPEED) layers.push(...rainLayers(state, band, W, wind));
    if (state === 'snow') layers.push(...snowLayers(band, W));
    if (state === 'hail') layers.push(...hailLayers(band, W, wind));
  });
  return layers;
}

/**
 * SVG for the weather, split by depth, with its CSS and the inks it used per theme.
 * @param {Array<string | null>} weather
 * @param {Parameters<typeof weatherArt>[1]} scene
 * @param {Set<string>} used
 */
export function weatherLayers(weather, scene, used) {
  const out = { sky: '', ground: '', css: '', vars: { light: {}, dark: {} } };
  const rules = [];
  const animated = new Set();
  weatherArt(weather, scene).forEach((layer, i) => {
    let body = layer.svg ? layer.svg(used) : layer.grid.paths(used);
    if (layer.fall) {
      const { h, dur, dx, flutter } = layer.fall;
      const cls = `w-fall${i}`;
      animated.add(cls);
      const from = dx ? `translate(-${dx}px,-${h}px)` : `translateY(-${h}px)`;
      const to = dx ? 'translate(0,0)' : 'translateY(0)';
      rules.push(`.${cls}{animation:${cls} ${dur}s steps(${h}) infinite}`, `@keyframes ${cls}{from{transform:${from}}to{transform:${to}}}`);
      if (dx) {
        const tile = `w-tile${i}`;
        body = `<g id="${tile}">${body}</g>` + windTileCopies(scene.W, h, dx)
          .map(([x, y]) => `<use href="#${tile}" x="${x}" y="${y}"/>`).join('');
      }
      // Flakes share one keyframe per period; the crowns' gust owns w-sway.
      if (flutter) {
        const flutterCls = `w-flutter${flutter}`;
        if (!animated.has(flutterCls)) {
          animated.add(flutterCls);
          rules.push(`.${flutterCls}{animation:w-flutter ${flutter}s step-end infinite}`);
        }
        body = `<g class="${flutterCls}">${body}</g>`;
      }
      const [top, end] = layer.clip;
      body = `<clipPath id="w-clip${i}"><rect y="${top}" width="${scene.W}" height="${end - top}"/></clipPath>` +
        `<g clip-path="url(#w-clip${i})"><g transform="translate(0 ${layer.y})"><g class="${cls}">${body}</g></g></g>`;
    } else {
      if (layer.sway) {
        animated.add('w-sway');
        body = `<g class="w-sway">${body}</g>`;
      }
      if (layer.y) body = `<g transform="translate(0 ${layer.y})">${body}</g>`;
      if (layer.drift) body = `<g class="cl">${body}</g>`;
      if (layer.blink) {
        const cls = `w-flash${i}`;
        animated.add(cls);
        rules.push(`.${cls}{opacity:0;animation:w-flash ${FLASH.period}s step-end -${layer.blink.offset}s infinite}`);
        body = `<g class="${cls}">${body}</g>`;
      }
    }
    out[layer.z] += body;
  });
  if (!animated.size && !out.sky && !out.ground) return out;
  if ([...animated].some((cls) => cls.startsWith('w-flutter'))) rules.unshift(swayKeyframe('w-flutter'));
  if (rules.some((r) => r.includes('w-flash'))) {
    rules.unshift(`@keyframes w-flash{${FLASH.keys.map(([at, v]) => `${+(at * 100).toFixed(1)}%{opacity:${v}}`).join('')}}`);
  }
  if (animated.has('w-sway')) {
    rules.push(`.w-sway{transform:translateX(1px);animation:w-sway ${SWAY.period}s step-end infinite}`,
      `@keyframes w-sway{0%{transform:translateX(1px)}${SWAY.release * 100}%{transform:translateX(0)}}`);
  }
  if (animated.size) rules.push(`@media (prefers-reduced-motion:reduce){${[...animated].map((c) => `.${c}`).join(',')}{animation:none!important}}`);
  out.css = rules.join('');
  for (const theme of /** @type {const} */ (['light', 'dark'])) {
    out.vars[theme] = Object.fromEntries(Object.entries(WEATHER_THEMES[theme]).filter(([name]) => used.has(name)));
  }
  return out;
}
