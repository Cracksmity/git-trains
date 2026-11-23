// Gate for the Sayula variant of the Jalisco scene:
//   node tools/conductor/gates/jalisco-sayula.js
// It checks the contract in tools/conductor/tasks/jalisco-sayula.md: the skyline id, the
// places, a middle strip of its own that leaves Guadalajara and Tequila as they are, inks
// in both themes, the captions, a design for every weather and the docs that name it.
// weather-unchanged.js checks that `skyline: jalisco` still draws byte for byte the same.
import { readFileSync } from 'node:fs';
import { parseSkyline } from '../../../src/landscape/skyline-parse.js';
import { placesFor } from '../../../src/weather/places.js';
import * as conditions from '../../../src/weather/conditions.js';
import { JALISCO_WEATHER } from '../../../src/landscape/jalisco-weather.js';
import { buildSpec } from '../../../src/scene/spec.js';
import { renderScene } from '../../../src/scene/render.js';
import { paintBackdrop } from '../../../src/scene/backdrop.js';
import { scenePalette } from '../../../src/scene/themes.js';
import { BALLAST, GY0, PITCH, SCENE_W, sceneHeight } from '../../../src/scene/layout.js';
import { sampleStats } from '../../../src/demo/sample.js';
import { rasterScene, renderFrame } from '../../export/raster.js';
import { report } from './weather-checks.js';

const MAX_EXTRA_KB = 60;
const MIN_CHANGED = 0.2;
const ID = 'jalisco-sayula';
const { WEATHER_STATES, parseWeatherInput } = conditions;
// Haze arrived as a modifier after wind; read the list untyped in case it grows.
const modifiers = /** @type {string[]} */ (/** @type {any} */ (conditions).WEATHER_MODIFIERS ?? []);
const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); };
const attempt = (label, fn) => {
  try {
    return fn();
  } catch (error) {
    problems.push(`${label} throws: ${/** @type {Error} */ (error).message}`);
    return undefined;
  }
};

// The skyline id and the places behind its tracks.
const jalisco = parseSkyline('jalisco');
const sayula = /** @type {any} */ (attempt(`parseSkyline("${ID}")`, () => parseSkyline(ID)));
check(sayula?.preset === 'jalisco' && sayula?.variant === 'sayula' && sayula?.name === 'Jalisco',
  `parseSkyline("${ID}") gives ${JSON.stringify(sayula)}, not { name: "Jalisco", preset: "jalisco", variant: "sayula", ... }`);
check(/** @type {any} */ (jalisco).variant === undefined, 'parseSkyline("jalisco") must stay without a variant');

const places = sayula ? placesFor(sayula) : null;
check(JSON.stringify(places?.map((p) => p.id)) === '["guadalajara","sayula","tequila"]',
  `placesFor(${ID}) gives ${JSON.stringify(places?.map((p) => p.id))}, not guadalajara, sayula, tequila`);
const town = places?.[1];
check(town?.name === 'Sayula' && Math.abs(town.latitude - 19.883) < 0.03 && Math.abs(town.longitude + 103.6) < 0.03,
  `the second place must be Sayula at about 19.883, -103.600 (got ${JSON.stringify(town)})`);
check(JSON.stringify(placesFor(jalisco)?.map((p) => p.id)) === '["guadalajara","altos","tequila"]',
  'placesFor("jalisco") must keep Guadalajara, Los Altos and Tequila');

/** @param {any} skyline @param {unknown[] | null} weather @param {{ theme?: string, language?: string }} [options] */
const spec = (skyline, weather, { theme = 'auto', language = 'en' } = {}) =>
  buildSpec(sampleStats(), { train: 'jalisco', skyline, mode: 'multi', theme, language, weather });
/** @param {unknown[] | null} weather @param {{ theme?: string, language?: string }} [options] */
const svg = (weather, options) => renderScene(spec(sayula, weather, options));
const states = (input) => {
  const parsed = parseWeatherInput(input);
  return parsed.mode === 'fixed' ? parsed.states : null;
};

if (sayula && places) {
  // Captions name each place.
  const tracks = spec(sayula, null).tracks;
  ['Guadalajara', 'Sayula', 'Tequila'].forEach((name, i) => {
    check(String(tracks[i]?.caption).startsWith(`${name} / `), `track ${i + 1}'s caption "${tracks[i]?.caption}" must start with "${name} / "`);
  });

  // The middle strip is new; everything around it is the Jalisco scene as it was.
  const H = sceneHeight(tracks.length);
  const before = paintBackdrop(SCENE_W, H, tracks, 'octocat', jalisco);
  const after = attempt('paintBackdrop with the variant', () => paintBackdrop(SCENE_W, H, tracks, 'octocat', sayula));
  if (after) {
    const top = GY0 + BALLAST;
    const bottom = GY0 + PITCH;
    let changed = 0;
    const outside = new Set();
    /** @type {Set<string>} */
    const inks = new Set();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < SCENE_W; x++) {
        const now = after.get(x, y);
        if (y >= top && y < bottom) {
          if (now !== before.get(x, y)) changed++;
          if (typeof now === 'string' && now.startsWith('@')) inks.add(now.slice(1));
        } else if (now !== before.get(x, y)) outside.add(y);
      }
    }
    check(!outside.size, `the variant changed rows outside the Sayula strip (rows ${top}-${bottom - 1}): ${[...outside].slice(0, 8).join(', ')}${outside.size > 8 ? '...' : ''}; paint only inside the strip and leave the shared random numbers alone`);
    const share = changed / (SCENE_W * (bottom - top));
    check(share >= MIN_CHANGED, `only ${Math.round(share * 100)}% of the middle strip differs from Los Altos; Sayula needs its own landscape`);
    for (const theme of ['light', 'dark']) {
      const palette = scenePalette(theme, sayula);
      const missing = [...inks].filter((ink) => typeof palette[ink] !== 'string');
      check(!missing.length, `inks with no ${theme} color: ${missing.map((ink) => `@${ink}`).join(', ')} (add them to jalisco-palette.js)`);
    }
  }

  // Every theme and language draws, the same way twice, and stays light.
  for (const theme of ['light', 'dark', 'auto']) {
    for (const language of ['en', 'es']) {
      const first = attempt(`the variant (${theme}, ${language})`, () => svg(states('cloudy,rain,storm'), { theme, language }));
      if (first !== undefined) check(first === svg(states('cloudy,rain,storm'), { theme, language }), `the variant draws differently twice (${theme}, ${language})`);
    }
  }
  const plain = attempt('the variant without weather', () => svg(null));
  const base = renderScene(spec(jalisco, null));
  if (plain) {
    const extra = (plain.length - base.length) / 1024;
    check(extra <= MAX_EXTRA_KB, `the variant weighs ${Math.round(extra)} KB more than skyline: jalisco (at most ${MAX_EXTRA_KB})`);
  }
  check(attempt('the weather title', () => svg(states('rain,clear,storm'))?.includes('Sayula clear')) === true,
    'with weather "rain,clear,storm" the title must name "Sayula clear"');

  // Sayula has a design for every state, with and without each modifier.
  const art = /** @type {any} */ (JALISCO_WEATHER).sayula;
  check(typeof art?.paint === 'function' && typeof art?.heat === 'function' && art?.bolt && Array.isArray(art?.partly),
    'JALISCO_WEATHER.sayula needs paint, heat (the mirage over the salt flat), bolt and partly');
  const clear = svg(states('clear'));
  for (const state of WEATHER_STATES) {
    const drawn = attempt(`weather "clear,${state},clear"`, () => svg(states(`clear,${state},clear`)));
    if (state !== 'clear' && drawn !== undefined) check(drawn !== clear, `Sayula draws nothing for ${state}`);
    for (const modifier of modifiers) attempt(`weather "clear,${state}+${modifier},clear"`, () => svg(states(`clear,${state}+${modifier},clear`)));
  }
  if (modifiers.includes('wind')) {
    check(attempt('clear+wind', () => svg(states('clear,clear+wind,clear'))) !== clear,
      'wind in clear weather must lift dust off the dry lake in Sayula');
  }

  // The raster exporter draws the same scene.
  for (const theme of ['light', 'dark']) {
    for (const input of ['off', 'fog', 'heat', 'rain+wind']) {
      attempt(`the raster exporter (${theme}, ${input})`, () => {
        const scene = rasterScene(spec(sayula, input === 'off' ? null : states(input), { theme }), theme);
        for (const t of [0, 1.3, 4.7]) renderFrame(scene, t);
      });
    }
  }
}

// Interfaces and docs name the variant.
const root = new URL('../../../', import.meta.url);
const read = (path) => {
  try {
    return readFileSync(new URL(path, root), 'utf8');
  } catch {
    return '';
  }
};
for (const path of ['action.yml', 'docs/reference.md', 'docs/es/reference.md', 'docs/customization.md', 'docs/es/customization.md']) {
  check(read(path).includes(ID), `${path} must mention ${ID}`);
}
check(read('assets/preview/app.js').includes(`value="${ID}"`), `assets/preview/app.js needs a skyline option with value="${ID}"`);

report('jalisco-sayula', problems, `the Sayula variant keeps its contract (${WEATHER_STATES.length} states, ${modifiers.length} modifiers)`);
