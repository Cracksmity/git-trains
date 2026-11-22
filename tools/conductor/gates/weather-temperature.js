// Gate for the temperature in the Jalisco captions, shown for live readings only:
//   node tools/conductor/gates/weather-temperature.js
// It checks the contract in tools/conductor/tasks/weather-temperature.md: the caption
// format ("Tequila 20° / Rust 15%"), rounding, the degree glyph, captions that stay as
// they were without a reading, and the Action's sample run. weather-unchanged.js checks
// that fixed weather still draws exactly as before.
import { clean, textWidth } from '../../../src/graphics/font.js';
import { JALISCO_PLACES } from '../../../src/weather/places.js';
import { weatherFor } from '../../../src/action/weather.js';
import { parseSkyline } from '../../../src/landscape/skyline-parse.js';
import { sampleWeather } from '../../../src/demo/sample.js';
import { jaliscoSpec, jaliscoSvg, rasterProblems, report, sceneProblems } from './weather-checks.js';

const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); };
const names = JALISCO_PLACES.map((p) => p.name);
const captions = (weather, options) => jaliscoSpec(weather, options).tracks.map((t) => t.caption);

check(clean('20°').length === 3 && textWidth('20°') > textWidth('20'), 'the pixel font must draw a degree sign: clean("20°") drops it today');
check(textWidth('-3°') > textWidth('3°'), 'negative temperatures need the minus sign');

const live = [
  { state: 'cloudy', temperature: 19.8 },
  { state: 'rain', temperature: -2.6 },
  { state: 'storm', temperature: -0.4 },
];
const plain = captions(['cloudy', 'rain', 'storm']);
const shown = captions(live);
const expected = ['20', '-3', '0'];
shown.forEach((caption, i) => {
  const want = `${names[i]} ${expected[i]}° / `;
  check(caption?.startsWith(want), `caption ${i + 1} is "${caption}", it should start with "${want}" (rounded, no "-0")`);
  check(caption?.slice(want.length) === plain[i]?.slice(`${names[i]} / `.length), `caption ${i + 1} must keep the rest as it was: "${plain[i]}"`);
});
check(captions(live, { language: 'es' })[0]?.startsWith('Guadalajara 20° / '), 'the Spanish scene shows the same caption format');
check(captions(live, { mode: 'single' })[0]?.startsWith('Guadalajara 20° / '), 'one track shows its place temperature too');

const unread = captions([{ state: 'cloudy', temperature: null }, { state: 'rain' }, null]);
check(JSON.stringify(unread) === JSON.stringify(captions([null, null, null])) && unread[0] === `${names[0]} / ${plain[0].split(' / ')[1]}`,
  `without a temperature the caption stays "place / language %": ${JSON.stringify(unread)}`);
check(JSON.stringify(plain) === JSON.stringify(captions(null)), 'fixed states (names, no reading) keep the captions as they were');

const svg = jaliscoSvg(live);
check(svg !== jaliscoSvg(['cloudy', 'rain', 'storm']), 'the scene with live temperatures draws exactly like the one without');
check(/Weather: Guadalajara cloudy/.test(jaliscoSpec(live).title), 'the title still names the weather');
problems.push(...sceneProblems(live, 'live temperatures', ['cloudy', 'rain', 'storm']), ...rasterProblems(live, 'live temperatures'));

// The Action's sample run reads the demo weather, temperatures included.
const sample = await weatherFor({ mode: 'live' }, parseSkyline('jalisco'), { sample: true, log: () => {} });
const demo = sampleWeather().places.map((p) => Math.round(p.temperature));
captions(sample).forEach((caption, i) => {
  check(caption?.startsWith(`${names[i]} ${demo[i]}° / `), `the sample run's caption ${i + 1} is "${caption}"`);
});

report('weather-temperature', problems, 'live readings show each place temperature, everything else reads as before');
