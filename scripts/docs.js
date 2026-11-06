// Regenerates the example SVGs used by the README (sample data, no network).
// node scripts/docs.js

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { renderScene } from '../src/scene.js';
import { buildSpec } from '../src/compose.js';
import { sampleStats, sampleProfile } from '../src/sample.js';
import { renderStatsCard, renderLangsCard } from '../src/cards.js';
import { parseCustomModel } from '../src/custom.js';
import { parseSkyline } from '../src/skyline.js';
import { renderCalendar } from '../src/calendar.js';

const example = (name) => parseCustomModel(JSON.parse(readFileSync(`examples/trains/${name}.json`, 'utf8')));
const newYork = example('new-york');
const osaka = example('osaka');
const steam = example('steam');
const skylineFile = (name) => parseSkyline(JSON.parse(readFileSync(`examples/skylines/${name}.json`, 'utf8')));

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
  // The region's countryside shows between the tracks of the multi mode.
  [
    'example-osaka-countryside',
    sampleStats({ total: 1500, streak: 9, yesterday: 5 }),
    { train: osaka, mode: 'multi', theme: 'auto', skyline: parseSkyline('osaka') },
  ],
  [
    'example-guadalajara',
    sampleStats({ total: 1500, streak: 14, yesterday: 5 }),
    { train: 'auto', mode: 'multi', theme: 'auto', skyline: skylineFile('guadalajara') },
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

// Example profile cards (default colors, GitHub's dark theme).
const demo = sampleStats();
const cards = [
  ['card-stats', renderStatsCard(sampleProfile(), { language: 'en' })],
  ['card-languages', renderLangsCard(demo.languages, { language: 'en', max: 6 })],
];
for (const [name, svg] of cards) {
  writeFileSync(`docs/${name}.svg`, svg);
  console.log(`docs/${name}.svg ${(svg.length / 1024).toFixed(1)} KB`);
}
