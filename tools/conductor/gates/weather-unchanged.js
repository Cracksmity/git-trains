// Gate: every weather scene that existed before the change still draws byte for byte
// the same, so a new design can only add.
//   node tools/conductor/gates/weather-unchanged.js
// It copies src/ as of HEAD (the commit the agent's worktree was cut from) to a
// temporary folder, through a throwaway index so the worktree is left alone. Then it
// renders the same scenes with that code and with the working tree: no weather, every
// state HEAD knows in every place, a mixed input in each theme and language, and every
// modifier HEAD knows (WEATHER_MODIFIERS, when it has any) with every state.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { report } from './weather-checks.js';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const dir = mkdtempSync(join(tmpdir(), 'git-trains-head-'));

// The scene-drawing code of one tree (HEAD's copy or the working tree's).
async function codeAt(base) {
  const load = (path) => import(pathToFileURL(join(base, path)).href);
  const [conditions, spec, render, skylines, sample] = await Promise.all(
    ['src/weather/conditions.js', 'src/scene/spec.js', 'src/scene/render.js', 'src/landscape/skyline-parse.js', 'src/demo/sample.js'].map(load),
  );
  const skyline = skylines.parseSkyline('jalisco');
  return {
    states: conditions.WEATHER_STATES,
    modifiers: conditions.WEATHER_MODIFIERS ?? [],
    parse: conditions.parseWeatherInput,
    svg: (weather, theme, language) =>
      render.renderScene(spec.buildSpec(sample.sampleStats(), { train: 'jalisco', skyline, mode: 'multi', theme, language, weather })),
  };
}

const problems = [];
try {
  const index = join(dir, '.index');
  const env = { ...process.env, GIT_INDEX_FILE: index };
  execFileSync('git', ['read-tree', 'HEAD'], { cwd: root, env });
  const files = execFileSync('git', ['ls-tree', '-r', '-z', '--name-only', 'HEAD', '--', 'src', 'package.json'], { cwd: root, encoding: 'utf8' });
  execFileSync('git', ['checkout-index', '-z', '--stdin', `--prefix=${dir}/`], { cwd: root, env, input: files });

  const before = await codeAt(dir);
  const now = await codeAt(root);
  const inputs = [
    ['off', 'auto', 'en'],
    ...before.states.map((state) => [state, 'auto', 'en']),
    ...['light', 'dark'].flatMap((theme) => ['en', 'es'].map((language) => ['cloudy,rain,storm', theme, language])),
    ...before.modifiers.flatMap((modifier) => before.states.map((state) => [`${state}+${modifier}`, 'auto', 'en'])),
  ];
  for (const [input, theme, language] of inputs) {
    const weather = (code) => {
      const parsed = code.parse(input);
      return parsed.mode === 'fixed' ? parsed.states : null;
    };
    let current;
    try {
      current = now.svg(weather(now), theme, language);
    } catch (error) {
      problems.push(`weather "${input}" (${theme}, ${language}) no longer draws: ${error.message}`);
      continue;
    }
    if (current !== before.svg(weather(before), theme, language)) {
      problems.push(`the scene with weather "${input}" (${theme}, ${language}) changed; leave the existing designs as they are`);
    }
  }
  report('weather-unchanged', problems, `${inputs.length} existing scenes draw exactly as before`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
