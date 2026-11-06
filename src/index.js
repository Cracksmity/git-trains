// Entry point of the GitHub Action (and of `npm run sample`, which needs no network).
// Reads the inputs, fetches the activity, writes the SVGs and sets the outputs.

import { appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fetchActivity, fetchProfile } from './github.js';
import { summarize } from './stats.js';
import { sampleStats, sampleProfile } from './sample.js';
import { buildSpec, LANGUAGES } from './compose.js';
import { renderScene } from './scene.js';
import { renderStatsCard, renderLangsCard } from './cards.js';
import { renderCalendar } from './calendar.js';
import { parseCustomModel } from './custom.js';
import { parseSkyline } from './skyline.js';
import { HEMISPHERES } from './seasons.js';

// Action inputs arrive as INPUT_<NAME> (hyphens kept).
const raw = (name) => (process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] ?? '').trim();

// Before v1 the inputs had Spanish names. They still work, with a warning; when
// one is set it wins, because the English input may just be holding its default.
const LEGACY_INPUTS = {
  user: 'usuario',
  train: 'tren',
  skyline: 'fondo',
  mode: 'modo',
  theme: 'tema',
  language: 'idioma',
  label: 'etiqueta',
  scale: 'escala',
  'output-dir': 'salida',
  cards: 'tarjetas',
  rank: 'rango',
  border: 'borde',
  'max-languages': 'lenguajes-max',
  'color-background': 'color-fondo',
  'color-title': 'color-titulo',
  'color-icon': 'color-icono',
  'color-text': 'color-texto',
  'color-ring': 'color-anillo',
};
const LEGACY_VALUES = { rank: { letra: 'letter' } };

function input(name, fallback = '') {
  const old = LEGACY_INPUTS[name];
  const legacy = old ? raw(old) : '';
  if (legacy) console.log(`::warning::The input "${old}" is deprecated; rename it to "${name}".`);
  const value = legacy || raw(name) || fallback;
  return LEGACY_VALUES[name]?.[value] ?? value;
}

// Reads a JSON file from the repository (a custom train or skyline). Paths are
// relative to the repository root, which is where the Action runs.
function readJson(path, what) {
  const file = resolve(process.env.GITHUB_WORKSPACE || process.cwd(), path);
  let text;
  try {
    if (statSync(file).size > 256 * 1024) throw new Error('it is larger than 256 KB');
    text = readFileSync(file, 'utf8');
  } catch (err) {
    throw new Error(`Could not read ${what} "${path}": ${err.code === 'ENOENT' ? 'the file does not exist' : err.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${what} "${path}" is not valid JSON: ${err.message}`);
  }
}

const isJsonPath = (v) => /\.json$/i.test(v);
const list = (v) => v.split(',').map((s) => s.trim()).filter(Boolean);

const THEMES = ['light', 'dark', 'auto', 'both'];
const CARDS = ['none', 'stats', 'languages', 'both'];
const CARD_ALIASES = { langs: 'languages' };
const RANKS = ['letter', 'github'];
const BOOLEANS = ['true', 'false'];

function oneOf(name, value, options) {
  if (!options.includes(value)) throw new Error(`Unknown ${name}: "${value}". Options: ${options.join(', ')}`);
  return value;
}

async function main() {
  const sample = process.argv.includes('--sample');

  const theme = oneOf('theme', input('theme', 'both'), THEMES);
  const scale = Number(input('scale', '2'));
  if (!Number.isFinite(scale) || scale < 1 || scale > 6) throw new Error('"scale" must be between 1 and 6');
  const language = oneOf('language', input('language', 'en'), LANGUAGES);
  const cardsIn = input('cards', 'none');
  const cards = oneOf('cards', CARD_ALIASES[cardsIn] ?? cardsIn, CARDS);
  const rank = oneOf('rank', input('rank', 'letter'), RANKS);
  const outDir = input('output-dir', sample ? 'sample' : 'dist');
  // train and skyline take a catalog id or the path to a custom JSON file.
  const trainIn = input('train', 'auto');
  const skylineIn = input('skyline', 'city');
  const options = {
    train: isJsonPath(trainIn) ? parseCustomModel(readJson(trainIn, 'the train')) : trainIn,
    mode: input('mode', 'single'),
    language,
    label: input('label'),
    skyline: parseSkyline(isJsonPath(skylineIn) ? readJson(skylineIn, 'the skyline') : skylineIn),
    scale,
    // Seasons and holidays: the scene wears the decoration of the day the Action runs (UTC).
    seasons: oneOf('seasons', input('seasons', 'true'), BOOLEANS) === 'true',
    hemisphere: oneOf('hemisphere', input('hemisphere', 'north'), HEMISPHERES),
    date: new Date().toISOString().slice(0, 10),
  };
  const cardStyle = {
    language,
    rank,
    border: input('border', 'true') !== 'false',
    max: Number(input('max-languages', '6')),
    background: input('color-background'),
    title: input('color-title'),
    icon: input('color-icon'),
    text: input('color-text'),
    ring: input('color-ring'),
  };
  const exclude = list(input('exclude-languages'));
  const calendar = input('calendar', 'false') === 'true';

  let stats;
  let loadProfile;
  if (sample) {
    stats = sampleStats({ exclude });
    loadProfile = async () => sampleProfile();
  } else {
    const token = input('github-token') || process.env.GITHUB_TOKEN;
    const user = input('user') || process.env.GITHUB_REPOSITORY_OWNER;
    if (!token) throw new Error('Missing "github-token" (use ${{ github.token }} or a PAT)');
    if (!user) throw new Error('Missing "user" (or GITHUB_REPOSITORY_OWNER)');
    stats = summarize(await fetchActivity({ token, user }), { exclude });
    loadProfile = () => fetchProfile({ token, user });
  }

  mkdirSync(outDir, { recursive: true });
  const variants =
    theme === 'both'
      ? [['light', 'train-light.svg'], ['dark', 'train-dark.svg'], ['auto', 'train.svg']]
      : [[theme, 'train.svg']];
  const files = [];
  const write = (name, svg) => {
    const path = join(outDir, name);
    writeFileSync(path, svg);
    files.push(path);
    console.log(`${path} (${(svg.length / 1024).toFixed(1)} KB)`);
  };
  for (const [t, name] of variants) write(name, renderScene(buildSpec(stats, { ...options, theme: t })));

  // Calendar mode: the same train running through the contribution calendar.
  if (calendar) {
    const lead = buildSpec(stats, options).tracks[0];
    for (const [t, name] of variants) {
      const file = name.replace('train', 'train-calendar');
      write(file, renderCalendar(stats, { model: lead.model, stripe: lead.stripe, label: lead.label, language, theme: t }));
    }
  }

  // Profile cards. If they fail the scene still stands: warn and carry on.
  if (cards !== 'none') {
    try {
      if (cards === 'stats' || cards === 'both') write('card-stats.svg', renderStatsCard(await loadProfile(), cardStyle));
      if (cards === 'languages' || cards === 'both') write('card-languages.svg', renderLangsCard(stats.languages, cardStyle));
    } catch (err) {
      console.log(`::warning::Could not generate the cards: ${err.message}`);
    }
  }

  const main = buildSpec(stats, options).tracks[0];
  const modelId = typeof main.model === 'string' ? main.model : main.model.id;
  console.log(
    `${stats.user}: ${stats.total} contributions, streak ${stats.streak}, yesterday ${stats.yesterday} -> ` +
      `${main.cars} car(s) ${modelId}, state ${stats.state}`,
  );

  if (process.env.GITHUB_OUTPUT) {
    const out = { files: files.join(','), cars: main.cars, streak: stats.streak, state: stats.state, model: modelId };
    appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(out).map(([k, v]) => `${k}=${v}\n`).join(''));
  }
}

main().catch((err) => {
  // In a GitHub annotation newlines must be encoded; otherwise only the first
  // line of the list of problems shows up.
  console.log(`::error::${err.message.replace(/%/g, '%25').replace(/\r?\n/g, '%0A')}`);
  process.exitCode = 1;
});
