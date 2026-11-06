// Regenerates the example SVGs used by the README (sample data, no network).
// node scripts/docs.js

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { renderScene } from '../src/scene.js';
import { buildSpec } from '../src/compose.js';
import { sampleStats, sampleProfile, sampleDepartures, SAMPLE_NOW } from '../src/sample.js';
import { renderStatsCard, renderLangsCard } from '../src/cards.js';
import { renderDeparturesCard } from '../src/departures.js';
import { buildTrain, TRAIN_H } from '../src/train.js';
import { MODELS } from '../src/models.js';
import { parseCustomModel } from '../src/custom.js';
import { parseSkyline } from '../src/skyline.js';
import { renderCalendar } from '../src/calendar.js';

const example = (name) => parseCustomModel(JSON.parse(readFileSync(`examples/trains/${name}.json`, 'utf8')));
const newYork = example('new-york');
const osaka = example('osaka');
const steam = example('steam');

mkdirSync('docs', { recursive: true });

const scenes = [
  ['example-light', sampleStats({ total: 2400, yesterday: 6 }), { train: 'auto', mode: 'single', theme: 'light' }],
  ['example-dark', sampleStats({ total: 900, streak: 30, yesterday: 14 }), { train: 'auto', mode: 'single', theme: 'dark' }],
  ['example-multi', sampleStats({ total: 1500, yesterday: 5 }), { train: 'auto', mode: 'multi', theme: 'light' }],
  ['example-stopped', sampleStats({ total: 300, streak: 0, yesterday: 0 }), { train: 'tram', mode: 'single', theme: 'light' }],
  [
    'example-new-york',
    sampleStats({ total: 400, streak: 20, yesterday: 5 }),
    { train: newYork, mode: 'single', theme: 'auto', skyline: parseSkyline('new-york') },
  ],
  [
    'example-osaka',
    sampleStats({ total: 400, streak: 9, yesterday: 3 }),
    { train: osaka, mode: 'single', theme: 'auto', skyline: parseSkyline('osaka') },
  ],
  ['example-steam', sampleStats({ total: 600, streak: 15, yesterday: 3 }), { train: steam, mode: 'single', theme: 'auto' }],
];

for (const [name, stats, opts] of scenes) {
  const svg = renderScene(buildSpec(stats, opts));
  writeFileSync(`docs/${name}.svg`, svg);
  console.log(`docs/${name}.svg ${(svg.length / 1024).toFixed(1)} KB`);
}

// Calendar mode: the sample year with the white metro and with the steam engine.
const calendars = [
  ['example-calendar', sampleStats({ total: 1400, streak: 12, yesterday: 6 }), { model: 'metro-white', stripe: '#3178c6', theme: 'auto' }],
  ['example-calendar-steam', sampleStats({ total: 900, streak: 30, yesterday: 3 }), { model: steam, stripe: '#f1e05a', theme: 'auto' }],
];
for (const [name, stats, opts] of calendars) {
  const svg = renderCalendar(stats, opts);
  writeFileSync(`docs/${name}.svg`, svg);
  console.log(`docs/${name}.svg ${(svg.length / 1024).toFixed(1)} KB`);
}

// The three special cars, one on each of three models, with no scene behind them (so the
// picture reads on a light or a dark page): dining, observation and mail.
{
  const rows = [
    ['dining', 'metro-orange', '#3178c6'],
    ['observation', 'bullet', '#f1e05a'],
    ['mail', 'metro-white', '#dea584'],
  ].map(([extra, model, stripe]) => buildTrain(MODELS[model], { cars: 2, extra, stripe, streak: 120, label: 'STREAK' }));
  const gap = 4;
  const width = Math.max(...rows.map((t) => t.width)) + 8;
  const height = rows.length * (TRAIN_H + gap) + 4;
  const layers = ['body', 'lit', 'wa', 'led'];
  const trains = rows
    .map((t, k) => `<g transform="translate(4 ${2 + k * (TRAIN_H + gap)})">${layers.map((l) => t.layers[l].paths()).join('')}</g>`)
    .join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * 2}" height="${height * 2}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="The dining car, the observation car and the mail car, each on its own train">` +
    `<title>The dining car, the observation car and the mail car</title>${trains}</svg>`;
  writeFileSync('docs/example-cars.svg', svg);
  console.log(`docs/example-cars.svg ${(svg.length / 1024).toFixed(1)} KB`);
}

// Example profile cards (default colors, GitHub's dark theme).
const demo = sampleStats();
const cards = [
  ['card-stats', renderStatsCard(sampleProfile(), { language: 'en' })],
  ['card-languages', renderLangsCard(demo.languages, { language: 'en', max: 6 })],
  ['card-departures', renderDeparturesCard(sampleDepartures(), 'octocat', { language: 'en', now: SAMPLE_NOW })],
];
for (const [name, svg] of cards) {
  writeFileSync(`docs/${name}.svg`, svg);
  console.log(`docs/${name}.svg ${(svg.length / 1024).toFixed(1)} KB`);
}
