// Checks the weather gates share: a Jalisco scene with some weather, rendered and
// exported, must be complete, deterministic, colored in both themes and still for
// reduced motion. Each check returns a list of problems; an empty list passes.
import { WEATHER_THEMES } from '../../../src/weather/inks.js';
import { buildSpec } from '../../../src/scene/spec.js';
import { renderScene } from '../../../src/scene/render.js';
import { parseSkyline } from '../../../src/landscape/skyline-parse.js';
import { sampleStats } from '../../../src/demo/sample.js';
import { rasterScene, renderFrame } from '../../export/raster.js';

const skyline = parseSkyline('jalisco');

/**
 * The sample profile's three-track Jalisco scene with this weather.
 * @param {unknown[] | null} weather one entry per place, as buildSpec takes it
 * @param {{ theme?: string, language?: string, mode?: string }} [options]
 */
export const jaliscoSpec = (weather, { theme = 'auto', language = 'en', mode = 'multi' } = {}) =>
  buildSpec(sampleStats(), { train: 'jalisco', skyline, mode, theme, language, weather });

/** @param {unknown[] | null} weather @param {{ theme?: string, language?: string }} [options] */
export const jaliscoSvg = (weather, options) => renderScene(jaliscoSpec(weather, options));

// The text inside every `@media (prefers-reduced-motion:reduce){...}` block.
function stillRules(svg) {
  const out = [];
  const head = '@media (prefers-reduced-motion:reduce){';
  for (let at = svg.indexOf(head); at >= 0; at = svg.indexOf(head, at + 1)) {
    let depth = 1;
    let i = at + head.length;
    for (; i < svg.length && depth; i++) {
      if (svg[i] === '{') depth++;
      else if (svg[i] === '}') depth--;
    }
    out.push(svg.slice(at + head.length, i - 1));
  }
  return out.join('\n');
}

const animatedClasses = (svg) => new Set([...svg.matchAll(/\.([\w-]+)\{[^{}]*animation:/g)].map((m) => m[1]));

/**
 * A scene with the weather: complete in every theme, inks with both colors, the same on
 * every render, and every animation it adds over `plain` stopped for reduced motion.
 * @param {unknown[]} weather
 * @param {string} label how the problems name this scene
 * @param {unknown[] | null} [plain] the scene to compare animations with (default: no weather)
 */
export function sceneProblems(weather, label, plain = null) {
  const problems = [];
  for (const theme of ['light', 'dark', 'auto']) {
    const svg = jaliscoSvg(weather, { theme });
    if (!/^<svg [^>]+>[\s\S]*<\/svg>$/.test(svg)) problems.push(`${label}, ${theme}: not a complete SVG`);
    if ((svg.match(/<g\b/g) ?? []).length !== (svg.match(/<\/g>/g) ?? []).length) problems.push(`${label}, ${theme}: unbalanced <g> groups`);
    for (const [, ink] of svg.matchAll(/class="c-(w[A-Z][A-Za-z0-9]*)"/g)) {
      if (!svg.includes(`--${ink}:`)) problems.push(`${label}, ${theme}: the ink ${ink} has no color in the SVG`);
      if (!WEATHER_THEMES.light[ink] || !WEATHER_THEMES.dark[ink]) problems.push(`the ink ${ink} needs a light and a dark value in src/weather/inks.js`);
    }
    if (svg !== jaliscoSvg(weather, { theme })) problems.push(`${label}, ${theme}: two renders differ (use seeded randomness only)`);
  }
  const svg = jaliscoSvg(weather);
  const before = animatedClasses(jaliscoSvg(plain));
  const still = stillRules(svg);
  for (const cls of animatedClasses(svg)) {
    if (!before.has(cls) && !new RegExp(`\\.${cls}(?![\\w-])`).test(still)) {
      problems.push(`${label}: the animated class .${cls} does not stop for prefers-reduced-motion`);
    }
  }
  return [...new Set(problems)];
}

/**
 * The raster exporter paints the scene in both themes at a few moments.
 * @param {unknown[]} weather
 * @param {string} label
 */
export function rasterProblems(weather, label) {
  const problems = [];
  for (const theme of ['light', 'dark']) {
    try {
      const scene = rasterScene(jaliscoSpec(weather, { theme }), theme);
      for (const t of [0, 1.3, 4.7]) renderFrame(scene, t);
    } catch (error) {
      problems.push(`${label}: the raster exporter fails in the ${theme} theme: ${/** @type {Error} */ (error).message}`);
    }
  }
  return problems;
}

/**
 * A fake fetch that answers each URL prefix with its own JSON (or throws for an Error),
 * and records every URL it was asked for.
 * @param {Array<[string, unknown]>} routes
 */
export function fakeFetch(routes) {
  /** @type {string[]} */
  const asked = [];
  const impl = async (/** @type {string} */ url) => {
    asked.push(String(url));
    const route = routes.find(([prefix]) => String(url).startsWith(prefix));
    if (!route) throw new Error(`unexpected request ${url}`);
    const [, answer] = route;
    if (answer instanceof Error) throw answer;
    const body = JSON.stringify(answer);
    return { ok: true, status: 200, headers: new Map([['content-type', 'application/json']]), text: async () => body, json: async () => JSON.parse(body) };
  };
  return { impl: /** @type {typeof fetch} */ (/** @type {unknown} */ (impl)), asked };
}

/**
 * Prints the gate's verdict and sets the exit code.
 * @param {string} name
 * @param {string[]} problems
 * @param {string} success
 */
export function report(name, problems, success) {
  if (problems.length) {
    console.error(`${name}: ${problems.length} problem(s)\n${problems.map((p) => `- ${p}`).join('\n')}`);
    process.exitCode = 1;
  } else console.log(`${name}: ${success}`);
}
