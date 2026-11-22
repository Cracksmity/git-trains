// Gate for a new Jalisco weather state:
//   node tools/conductor/gates/weather-state.js <state> [--reads 51:18,53:18] [--others 0:20=clear,61:18=rain]
//     [--same rain:47d8cee530e60922,...]
// --reads: Open-Meteo readings (WMO code:°C) that must come out as <state>.
// --others: readings that must keep the state after "=", so a new rule doesn't swallow its neighbours.
// --same: approved states whose scene must not change (the first 16 hex of the SHA-256 of the
//   auto-theme SVG with that state in every place).
// It also checks that the state is wired through the input, the title and both themes,
// that it draws deterministically, differs from every other state, stays light,
// stops its animations for reduced motion, and paints in the raster exporter.
import { WEATHER_NAMES, WEATHER_STATES, parseWeatherInput, readCurrentWeather } from '../../../src/weather/conditions.js';
import { WEATHER_THEMES } from '../../../src/weather/inks.js';
import { buildSpec } from '../../../src/scene/spec.js';
import { renderScene } from '../../../src/scene/render.js';
import { parseSkyline } from '../../../src/landscape/skyline-parse.js';
import { sampleStats } from '../../../src/demo/sample.js';
import { rasterScene, renderFrame } from '../../export/raster.js';
import { createHash } from 'node:crypto';

const MAX_EXTRA_KB = 120;
const args = process.argv.slice(2);
const state = args[0];
const option = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? [] : String(args[i + 1] ?? '').split(',').filter(Boolean);
};
const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); };

check(WEATHER_STATES.includes(state), `"${state}" is not in WEATHER_STATES (${WEATHER_STATES.join(', ')})`);
check(Boolean(WEATHER_NAMES.en?.[state] && WEATHER_NAMES.es?.[state]), `WEATHER_NAMES needs an English and a Spanish name for "${state}"`);
try {
  const parsed = parseWeatherInput(state);
  check(parsed.mode === 'fixed' && parsed.states.every((s) => s === state), `parseWeatherInput("${state}") does not fix every place to it`);
} catch (error) {
  problems.push(`parseWeatherInput("${state}") throws: ${error.message}`);
}

const read = (pair) => {
  const [code, temperature] = pair.split(':').map(Number);
  return readCurrentWeather([{ current: { weather_code: code, temperature_2m: temperature } }], 1).places[0].state;
};
for (const pair of option('--reads')) check(read(pair) === state, `the reading ${pair} (code:°C) gives "${read(pair)}", not "${state}"`);
for (const entry of option('--others')) {
  const [pair, expected] = entry.split('=');
  check(read(pair) === expected, `the reading ${pair} (code:°C) gives "${read(pair)}", it should stay "${expected}"`);
}

const skyline = parseSkyline('jalisco');
const spec = (weather, theme = 'auto', language = 'en') =>
  buildSpec(sampleStats(), { train: 'jalisco', skyline, mode: 'multi', theme, language, weather });
const all = [state, state, state];
if (!problems.length) {
  const base = renderScene(spec(null));
  for (const theme of ['light', 'dark', 'auto']) {
    const svg = renderScene(spec(all, theme));
    check(/^<svg [^>]+>[\s\S]*<\/svg>$/.test(svg), `${theme}: not a complete SVG`);
    check((svg.match(/<g\b/g) ?? []).length === (svg.match(/<\/g>/g) ?? []).length, `${theme}: unbalanced <g> groups`);
    for (const [, ink] of svg.matchAll(/class="c-(w[A-Z][A-Za-z0-9]*)"/g)) {
      check(svg.includes(`--${ink}:`), `${theme}: the ink ${ink} has no color in the SVG`);
      check(Boolean(WEATHER_THEMES.light[ink] && WEATHER_THEMES.dark[ink]), `the ink ${ink} needs a light and a dark value in src/weather/inks.js`);
    }
    check(svg === renderScene(spec(all, theme)), `${theme}: two renders differ (use seeded randomness only)`);
  }
  const svg = renderScene(spec(all));
  check(svg !== base, `"${state}" draws nothing: the scene equals the one without weather`);
  for (const other of WEATHER_STATES) {
    if (other !== state) check(svg !== renderScene(spec([other, other, other])), `"${state}" draws exactly like "${other}"`);
  }
  const extra = (svg.length - base.length) / 1024;
  check(extra <= MAX_EXTRA_KB, `"${state}" adds ${extra.toFixed(1)} KB to the scene; keep it under ${MAX_EXTRA_KB} KB`);
  const still = [...svg.matchAll(/@media \(prefers-reduced-motion:reduce\)\{([^{}]*)\{animation:none!important\}\}/g)].map((m) => m[1]).join(',');
  for (const [, cls] of svg.matchAll(/\.(w-[\w-]+)\{[^}]*animation:/g)) {
    check(still.split(',').includes(`.${cls}`), `the animated class .${cls} does not stop for prefers-reduced-motion`);
  }
  for (const entry of option('--same')) {
    const [approved, hash] = entry.split(':');
    const now = createHash('sha256').update(renderScene(spec([approved, approved, approved]))).digest('hex').slice(0, 16);
    check(now === hash, `the approved "${approved}" scene changed; leave the existing states as they are`);
  }
  check(spec(all).title.includes(`Weather: Guadalajara ${WEATHER_NAMES.en[state]}`), 'the English title does not name the weather');
  check(spec(all, 'auto', 'es').title.includes(`Clima: Guadalajara ${WEATHER_NAMES.es[state]}`), 'the Spanish title does not name the weather');
  for (const theme of ['light', 'dark']) {
    try {
      const scene = rasterScene(spec(all, theme), theme);
      for (const t of [0, 1.3, 4.7]) renderFrame(scene, t);
    } catch (error) {
      problems.push(`the raster exporter fails in the ${theme} theme: ${error.message}`);
    }
  }
}

if (problems.length) {
  console.error(`weather-state ${state}: ${problems.length} problem(s)\n${problems.map((p) => `- ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`weather-state ${state}: wired, drawn in both themes, distinct, deterministic and exportable`);
