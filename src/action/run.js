import { createOutputWriter, writeActionOutputs } from './outputs.js';
// action/run.js: focused run operations.



import { fetchActivity, fetchProfile, fetchDepartures, fetchYear } from '../github/user.js';
import { parseRepo, fetchRepoActivity, fetchRepoProfile, fetchRepoReleases } from '../github/repository.js';
import { summarize } from '../activity/stats.js';
import { sampleStats, sampleProfile, sampleDepartures, sampleRepoStats, sampleRepoProfile, sampleReleases, sampleYear, SAMPLE_NOW } from '../demo/sample.js';
import { buildSpec, LANGUAGES } from '../scene/spec.js';
import { renderScene } from '../scene/render.js';
import { renderStatsCard, renderRepoStatsCard, renderLangsCard } from '../cards/profile.js';
import { renderDeparturesCard } from '../cards/departures.js';
import { unlockFor } from '../activity/unlocks.js';
import { renderCalendar } from '../calendar/render.js';
import { buildReview, parseReviewYear } from '../review/data.js';
import { renderReview } from '../review/render.js';
import { parseCustomModel } from '../trains/parse.js';
import { parseSkyline } from '../landscape/skyline-parse.js';
import { HEMISPHERES } from '../activity/seasons.js';
import { input, readJson, isJsonPath, list, oneOf, parseCards } from './inputs.js';
import { THEMES, RANKS, BOOLEANS } from '../../config/action-inputs.js';

export async function runAction() {
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
  // Repo mode: with `repo: owner/name` the train describes that repository, not a user (see repo.js).
  const repoIn = input('repo');
  const repo = repoIn ? parseRepo(repoIn) : null;

  let stats;
  let loadProfile;
  let loadDepartures;
  let loadYear;
  let now = new Date();
  if (sample) {
    stats = repo ? sampleRepoStats({ exclude }) : sampleStats({ exclude });
    loadProfile = async () => (repo ? sampleRepoProfile() : sampleProfile());
    loadDepartures = async () => (repo ? sampleReleases() : sampleDepartures());
    loadYear = async (year) => sampleYear(year, SAMPLE_NOW);
    now = SAMPLE_NOW;
  } else {
    const token = input('github-token') || process.env.GITHUB_TOKEN;
    if (!token) throw new Error('Missing "github-token" (use ${{ github.token }} or a PAT)');
    if (repo) {
      const onNotice = (message) => console.log(`::notice::${message}`);
      stats = summarize(await fetchRepoActivity({ token, repo, onNotice }), { exclude });
      let profile;
      loadProfile = () => (profile ??= fetchRepoProfile({ token, repo }));
      loadDepartures = () => fetchRepoReleases({ token, repo });
    } else {
      const user = input('user') || process.env.GITHUB_REPOSITORY_OWNER;
      if (!user) throw new Error('Missing "user" (or GITHUB_REPOSITORY_OWNER)');
      stats = summarize(await fetchActivity({ token, user }), { exclude });
      // The stats card and the unlockable cars both need the profile numbers: ask once.
      let profile;
      loadProfile = () => (profile ??= fetchProfile({ token, user }));
      loadDepartures = () => fetchDepartures({ token, user });
      loadYear = (year) => fetchYear({ token, user, year, today: now });
    }
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

  const { files, write } = createOutputWriter(outDir);
  // A repository's files carry "repo" in the name (train-repo.svg, card-repo-stats.svg...), so one
  // workflow can draw a profile and a repository into the same folder.
  const trainName = repo ? 'train-repo' : 'train';
  const cardName = repo ? 'card-repo' : 'card';
  const variants =
    theme === 'both'
      ? [['light', `${trainName}-light.svg`], ['dark', `${trainName}-dark.svg`], ['auto', `${trainName}.svg`]]
      : [[theme, `${trainName}.svg`]];
  for (const [t, name] of variants) write(name, renderScene(buildSpec(stats, { ...options, theme: t })));

  // Calendar mode: the same train running through the contribution calendar.
  if (calendar) {
    const lead = buildSpec(stats, options).tracks[0];
    for (const [t, name] of variants) {
      const file = name.replace(trainName, `${trainName}-calendar`);
      write(file, renderCalendar(stats, { model: lead.model, stripe: lead.stripe, label: lead.label, language, theme: t }));
    }
  }

  // The year in review: a poster of one calendar year, with the same train. It reads a user's year, so
  // in repo mode there is nothing to draw. Like the cards, if it fails the scene still stands: warn and carry on.
  if (yearInReview && repo) {
    console.log('::notice::year-in-review is a poster of a user, so it is skipped in repo mode');
  } else if (yearInReview) {
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
        const file = name.replace(trainName, 'year-in-review');
        write(file, renderReview(review, { ...cardStyle, theme: t, model: lead.model, stripe: lead.stripe }));
      }
    } catch (err) {
      console.log(`::warning::Could not generate the year in review: ${err.message}`);
    }
  }

  // Profile cards. If they fail the scene still stands: warn and carry on.
  if (cards.size) {
    try {
      if (cards.has('stats')) {
        const profile = await loadProfile();
        write(`${cardName}-stats.svg`, repo ? renderRepoStatsCard({ ...profile, commits: stats.total }, cardStyle) : renderStatsCard(profile, cardStyle));
      }
      if (cards.has('languages')) write(`${cardName}-languages.svg`, renderLangsCard(stats.languages, cardStyle));
      if (cards.has('departures')) {
        const board = await loadDepartures();
        write(`${cardName}-departures.svg`, renderDeparturesCard(board, repo ? repo.full : stats.user, { ...cardStyle, now, repo: !!repo }));
      }
    } catch (err) {
      console.log(`::warning::Could not generate the cards: ${err.message}`);
    }
  }

  const main = buildSpec(stats, options).tracks[0];
  const modelId = typeof main.model === 'string' ? main.model : main.model.id;
  console.log(
    `${stats.fullName ?? stats.user}: ${stats.total} ${repo ? 'commits' : 'contributions'}, streak ${stats.streak}, yesterday ${stats.yesterday} -> ` +
      `${main.cars} car(s) ${modelId}, state ${stats.state}${options.unlock ? `, ${options.unlock} car unlocked` : ''}`,
  );

  writeActionOutputs({ files: files.join(','), cars: main.cars, streak: stats.streak, state: stats.state, model: modelId });
}
