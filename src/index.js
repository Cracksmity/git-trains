// Entry point of the GitHub Action (and of `npm run sample`, which needs no network).
// Reads the inputs, fetches the activity, writes the SVGs and sets the outputs.

import { appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fetchActivity, fetchProfile, fetchDepartures, fetchYear } from './github.js';
import { summarize } from './stats.js';
import { sampleStats, sampleProfile, sampleDepartures, sampleYear, SAMPLE_NOW } from './sample.js';
import { buildSpec, LANGUAGES } from './compose.js';
import { renderScene } from './scene.js';
import { renderStatsCard, renderLangsCard } from './cards.js';
import { renderDeparturesCard } from './departures.js';
import { unlockFor } from './unlocks.js';
import { renderCalendar } from './calendar.js';
import { buildReview, parseReviewYear, renderReview } from './review.js';
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
const CARDS = ['none', 'stats', 'languages', 'departures', 'both'];
const CARD_ALIASES = { langs: 'languages' };
const RANKS = ['letter', 'github'];
const BOOLEANS = ['true', 'false'];

function oneOf(name, value, options) {
  if (!options.includes(value)) throw new Error(`Unknown ${name}: "${value}". Options: ${options.join(', ')}`);
  return value;
}

// `cards` takes one name or a list ("stats, departures"). Returns the set of cards to write:
// stats, languages and departures; both means stats and languages.
function parseCards(value) {
  const names = list(value).map((n) => CARD_ALIASES[n] ?? n);
  for (const n of names) oneOf('cards', n, CARDS);
  if (names.includes('none') && names.length > 1) throw new Error(`The card "none" can't be combined with other cards`);
  return new Set(names.flatMap((n) => (n === 'both' ? ['stats', 'languages'] : n === 'none' ? [] : [n])));
}

async function main() {
  const sample = process.argv.includes('--sample');

  const theme = oneOf('theme', input('theme', 'both'), THEMES);
  const scale = Number(input('scale', '2'));
  if (!Number.isFinite(scale) || scale < 1 || scale > 6) throw new Error('"scale" must be between 1 and 6');
  const language = oneOf('language', input('language', 'en'), LANGUAGES);
  const cards = parseCards(input('cards', 'none'));
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
  const yearInReview = oneOf('year-in-review', input('year-in-review', 'false'), BOOLEANS) === 'true';
  const unlocks = input('unlocks', 'true') !== 'false';

  let stats;
  let loadProfile;
  let loadDepartures;
  let loadYear;
  let now = new Date();
  if (sample) {
    stats = sampleStats({ exclude });
    loadProfile = async () => sampleProfile();
    loadDepartures = async () => sampleDepartures();
    loadYear = async (year) => sampleYear(year, SAMPLE_NOW);
    now = SAMPLE_NOW;
  } else {
    const token = input('github-token') || process.env.GITHUB_TOKEN;
    const user = input('user') || process.env.GITHUB_REPOSITORY_OWNER;
    if (!token) throw new Error('Missing "github-token" (use ${{ github.token }} or a PAT)');
    if (!user) throw new Error('Missing "user" (or GITHUB_REPOSITORY_OWNER)');
    stats = summarize(await fetchActivity({ token, user }), { exclude });
    // The stats card and the unlockable cars both need the profile numbers: ask once.
    let profile;
    loadProfile = () => (profile ??= fetchProfile({ token, user }));
    loadDepartures = () => fetchDepartures({ token, user });
    loadYear = (year) => fetchYear({ token, user, year, today: now });
  }
  // The year in review: `review-year`, or the current year so far (the last one in January). A year
  // that can't be reviewed stops the run before anything is fetched.
  const reviewYear = yearInReview ? parseReviewYear(input('review-year'), now) : null;

  // Special cars the profile earned (a 100-day streak, 100+ stars, 500+ PRs). They need
  // the profile numbers; if those can't be read the scene still stands, without them.
  if (unlocks) {
    try {
      const { stars, prs } = await loadProfile();
      options.unlock = unlockFor({ streak: stats.streak, stars, prs });
    } catch (err) {
      console.log(`::notice::Could not check the unlockable cars: ${err.message}`);
    }
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

  // The year in review: a poster of one calendar year, with the same train. Like the cards, if it
  // fails the scene still stands: warn and carry on.
  if (yearInReview) {
    try {
      const review = buildReview(await loadYear(reviewYear), { year: reviewYear, exclude });
      // The special car is judged on that year: its longest streak, and the profile's stars and PRs.
      if (unlocks) {
        try {
          const { stars, prs } = await loadProfile();
          review.unlock = unlockFor({ streak: review.streak, stars, prs });
        } catch (err) {
          console.log(`::notice::Could not check the unlockable cars for the year in review: ${err.message}`);
        }
      }
      const lead = buildSpec(review, { ...options, unlock: null }).tracks[0];
      for (const [t, name] of variants) {
        const file = name.replace('train', 'year-in-review');
        write(file, renderReview(review, { ...cardStyle, theme: t, model: lead.model, stripe: lead.stripe }));
      }
    } catch (err) {
      console.log(`::warning::Could not generate the year in review: ${err.message}`);
    }
  }

  // Profile cards. If they fail the scene still stands: warn and carry on.
  if (cards.size) {
    try {
      if (cards.has('stats')) write('card-stats.svg', renderStatsCard(await loadProfile(), cardStyle));
      if (cards.has('languages')) write('card-languages.svg', renderLangsCard(stats.languages, cardStyle));
      if (cards.has('departures')) {
        write('card-departures.svg', renderDeparturesCard(await loadDepartures(), stats.user, { ...cardStyle, now }));
      }
    } catch (err) {
      console.log(`::warning::Could not generate the cards: ${err.message}`);
    }
  }

  const main = buildSpec(stats, options).tracks[0];
  const modelId = typeof main.model === 'string' ? main.model : main.model.id;
  console.log(
    `${stats.user}: ${stats.total} contributions, streak ${stats.streak}, yesterday ${stats.yesterday} -> ` +
      `${main.cars} car(s) ${modelId}, state ${stats.state}${options.unlock ? `, ${options.unlock} car unlocked` : ''}`,
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
