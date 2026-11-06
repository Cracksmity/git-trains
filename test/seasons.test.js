import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DECORATIONS, HEMISPHERES, decorationFor, holidayOf, parseDay, seasonOf } from '../src/seasons.js';
import { DECOR_THEMES } from '../src/decor.js';
import { renderScene } from '../src/scene.js';
import { buildSpec } from '../src/compose.js';
import { MODELS, MODEL_ORDER } from '../src/models.js';
import { sampleStats } from '../src/sample.js';
import { parseSkyline } from '../src/skyline.js';

// One ordinary day for each decoration.
const DAY = {
  winter: '2026-01-20',
  spring: '2026-04-10',
  autumn: '2026-09-20',
  muertos: '2026-11-01',
  christmas: '2026-12-20',
  hacktoberfest: '2026-10-10',
  newyear: '2026-12-31',
};
const KINDS = Object.keys(DECORATIONS);
const track = (model = 'metro-orange', extra = {}) => ({ model, cars: 2, stripe: '#3178c6', streak: 5, state: 'normal', ...extra });
const scene = (extra = {}, tracks = [track()]) => renderScene({ user: 'octocat', theme: 'auto', tracks, ...extra });

// --- Calendar logic ----------------------------------------------------------

test('every decoration has a day in the table above', () => {
  assert.deepEqual(Object.keys(DAY).sort(), KINDS.sort());
  for (const kind of KINDS) assert.equal(decorationFor(DAY[kind]), kind, kind);
});

test('the seasons follow the months, and the south has the opposite one', () => {
  const months = { '01': 'winter', '02': 'winter', '03': 'spring', '04': 'spring', '05': 'spring', '06': 'summer',
    '07': 'summer', '08': 'summer', '09': 'autumn', '10': 'autumn', '11': 'autumn', '12': 'winter' };
  const flip = { winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' };
  for (const [month, season] of Object.entries(months)) {
    assert.equal(seasonOf(`2026-${month}-10`), season, month);
    assert.equal(seasonOf(`2026-${month}-10`, 'north'), season, month);
    assert.equal(seasonOf(`2026-${month}-10`, 'south'), flip[season], month);
  }
});

test('summer has no decoration, winter has it in the north and the south alike on opposite months', () => {
  assert.equal(decorationFor('2026-07-15'), null);
  assert.equal(decorationFor('2026-01-15', 'south'), null);
  assert.equal(decorationFor('2026-01-15', 'north'), 'winter');
  assert.equal(decorationFor('2026-07-15', 'south'), 'winter');
  assert.equal(decorationFor('2026-04-10', 'north'), 'spring');
  assert.equal(decorationFor('2026-04-10', 'south'), 'autumn');
  assert.equal(decorationFor('2026-09-20', 'north'), 'autumn');
  assert.equal(decorationFor('2026-09-20', 'south'), 'spring');
});

test('the holidays have their dates, the same in both hemispheres', () => {
  const edges = [
    ['2026-09-30', null], ['2026-10-01', 'hacktoberfest'], ['2026-10-30', 'hacktoberfest'],
    ['2026-10-31', 'muertos'], ['2026-11-01', 'muertos'], ['2026-11-02', 'muertos'], ['2026-11-03', null],
    ['2026-12-14', null], ['2026-12-15', 'christmas'], ['2026-12-30', 'christmas'],
    ['2026-12-31', 'newyear'], ['2027-01-01', 'newyear'], ['2027-01-02', 'christmas'],
    ['2027-01-06', 'christmas'], ['2027-01-07', null],
  ];
  for (const [day, holiday] of edges) assert.equal(holidayOf(day), holiday, day);
  for (const [day, holiday] of edges.filter(([, h]) => h)) {
    for (const hemisphere of HEMISPHERES) assert.equal(decorationFor(day, hemisphere), holiday, `${day} ${hemisphere}`);
  }
});

test('a holiday wins over the season, and the more specific holiday wins over the longer one', () => {
  assert.equal(seasonOf('2026-10-10'), 'autumn');
  assert.equal(decorationFor('2026-10-10'), 'hacktoberfest');
  assert.equal(decorationFor('2026-12-20'), 'christmas'); // not winter
  assert.equal(decorationFor('2026-12-31'), 'newyear'); // not christmas
  assert.equal(decorationFor('2026-10-31'), 'muertos'); // not hacktoberfest
  assert.equal(decorationFor('2026-12-10'), 'winter');
});

test('days come as a Date, a plain date or a timestamp, always read in UTC', () => {
  const want = { year: 2026, month: 12, day: 31 };
  assert.deepEqual(parseDay('2026-12-31'), want);
  assert.deepEqual(parseDay('2026-12-31T23:59:59Z'), want);
  assert.deepEqual(parseDay(new Date('2026-12-31T23:59:59Z')), want);
  assert.equal(decorationFor(new Date('2026-12-31T23:59:59Z')), 'newyear');
});

test('wrong dates and hemispheres give a clear error', () => {
  for (const bad of ['', 'tomorrow', '2026-13-01', '2026-02-30', '31/12/2026', 20261231, null, new Date('nope')]) {
    assert.throws(() => decorationFor(bad), /date/i, String(bad));
  }
  assert.throws(() => decorationFor('2026-01-01', 'east'), /Unknown hemisphere: "east"/);
  assert.throws(() => scene({ date: 'yesterday' }), /Unknown date/);
});

// --- Drawing -------------------------------------------------------------------

const wellFormed = (svg, label) => {
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), label);
  assert.equal((svg.match(/<g[ >]/g) ?? []).length, (svg.match(/<\/g>/g) ?? []).length, `${label}: unbalanced <g>`);
  assert.ok(!/undefined|NaN|null|Infinity/.test(svg), `${label}: invalid values`);
};

test('a day without decoration draws exactly the same scene as no date at all', () => {
  const plain = scene();
  for (const date of ['2026-07-15', '2026-06-01', '2026-08-31']) {
    assert.equal(scene({ date }), plain, date);
  }
  assert.equal(scene({ date: '2026-01-15', hemisphere: 'south' }), plain);
  const multi = (extra) => scene(extra, [track('tram'), track('metro-white', { dir: -1 }), track('bullet')]);
  assert.equal(multi({ date: '2026-07-15' }), multi());
});

test('buildSpec only carries the day when seasons are on', () => {
  const stats = sampleStats();
  assert.equal(buildSpec(stats, {}).date, undefined);
  assert.deepEqual(Object.keys(buildSpec(stats, {})).sort(), ['scale', 'skyline', 'theme', 'title', 'tracks', 'user']);
  const spec = buildSpec(stats, { date: '2026-12-20', hemisphere: 'south' });
  assert.equal(spec.date, '2026-12-20');
  assert.equal(spec.hemisphere, 'south');
  assert.equal(buildSpec(stats, { date: '2026-12-20' }).hemisphere, 'north');
  const off = buildSpec(stats, { date: '2026-12-20', seasons: false });
  assert.equal(off.date, undefined);
  assert.equal(renderScene(off), renderScene(buildSpec(stats, {})));
});

test('every decoration renders, is well-formed and changes the scene', () => {
  const plain = scene();
  for (const kind of KINDS) {
    for (const theme of ['light', 'dark', 'auto']) {
      const svg = scene({ date: DAY[kind], theme });
      wellFormed(svg, `${kind}/${theme}`);
      assert.notEqual(svg, scene({ theme }), `${kind}/${theme} looks like a plain day`);
    }
    assert.notEqual(scene({ date: DAY[kind] }), plain, kind);
  }
});

test('decorations work with every train, with and without overhead wires, a sign or several tracks', () => {
  for (const kind of KINDS) {
    for (const id of MODEL_ORDER) {
      const svg = scene({ date: DAY[kind] }, [track(id, { state: id === 'tram' ? 'idle' : 'fast' })]);
      wellFormed(svg, `${kind}/${id}`);
      assert.notEqual(svg, scene({}, [track(id, { state: id === 'tram' ? 'idle' : 'fast' })]), `${kind}/${id} (${MODELS[id].pant ? 'overhead' : 'third rail'})`);
    }
    const nameless = renderScene({ date: DAY[kind], tracks: [track('metro-white')] });
    wellFormed(nameless, `${kind}/no user`);
    const multi = renderScene({ ...buildSpec(sampleStats(), { mode: 'multi', date: DAY[kind] }) });
    wellFormed(multi, `${kind}/multi`);
    wellFormed(renderScene(buildSpec(sampleStats(), { date: DAY[kind], skyline: parseSkyline('new-york') })), `${kind}/new-york`);
  }
});

test('decorations never touch the trains, which are the last thing drawn', () => {
  const plain = scene();
  const tail = plain.slice(plain.indexOf('<g transform="translate(0 '));
  assert.ok(tail.length > 2000);
  for (const kind of KINDS) assert.ok(scene({ date: DAY[kind] }).endsWith(tail), kind);
});

test('decorations only use theme colors, defined for both the light and the dark theme', () => {
  const fixed = (svg) => new Set(svg.match(/fill="#[0-9a-fA-F]{3,8}"/g));
  const plainFixed = fixed(scene());
  for (const kind of KINDS) {
    const svg = scene({ date: DAY[kind] });
    for (const f of fixed(svg)) assert.ok(plainFixed.has(f), `${kind} adds the fixed color ${f}`);
    const root = svg.match(/<style>:root\{([^}]*)\}@media \(prefers-color-scheme:dark\)\{:root\{([^}]*)\}\}/);
    assert.ok(root, kind);
    const defined = (css) => new Set([...css.matchAll(/--([A-Za-z0-9]+):/g)].map((m) => m[1]));
    const [light, dark] = [defined(root[1]), defined(root[2])];
    for (const [, name] of svg.matchAll(/class="c-([A-Za-z0-9]+)"/g)) {
      assert.ok(light.has(name) && dark.has(name), `${kind}: --${name} is missing in a theme`);
    }
  }
  for (const theme of ['light', 'dark']) {
    for (const [name, value] of Object.entries(DECOR_THEMES[theme])) assert.match(value, /^(#[0-9a-f]{3,8}|rgba?\(.*\))$/i, `${theme} ${name}`);
  }
  assert.deepEqual(Object.keys(DECOR_THEMES.light).sort(), Object.keys(DECOR_THEMES.dark).sort());
});

test('every animation of a decoration stops with prefers-reduced-motion', () => {
  const animated = (svg) => new Set([...svg.matchAll(/(?:^|[}s,])((?:.[w-]+)+){animation:/g)].map((m) => m[1]));
  const plain = animated(scene());
  for (const kind of KINDS) {
    const svg = scene({ date: DAY[kind] });
    const reduced = [...svg.matchAll(/@media (prefers-reduced-motion:reduce){((?:[^{}]|{[^{}]*})*)}/g)].map((m) => m[1]).join('');
    const still = new Set();
    for (const rule of reduced.split('}')) {
      const [selectors, body = ''] = rule.split('{');
      if (/animation:none!important/.test(body)) selectors.split(',').forEach((s) => still.add(s.trim()));
    }
    for (const sel of [...animated(svg)].filter((c) => !plain.has(c))) {
      const stopped = still.has(sel) || sel.split('.').filter(Boolean).some((c) => still.has('.' + c));
      assert.ok(stopped, `${kind}: ${sel} keeps moving with prefers-reduced-motion`);
    }
  }
});

test('the movement is in steps, like the rest of the scene', () => {
  const declared = (svg) => [...svg.matchAll(/animation:([^;}]*)/g)].map((m) => m[1]);
  const plain = new Set(declared(scene()));
  for (const kind of KINDS) {
    const own = declared(scene({ date: DAY[kind] })).filter((a) => !plain.has(a));
    assert.ok(own.length > 0, `${kind} does not move at all`);
    for (const a of own) assert.match(a, /steps(d+)|step-end|step-start/, `${kind}: "${a}" is not stepped`);
  }
});

test('a decoration adds a few pixels, not a new scene', () => {
  const plain = scene();
  for (const kind of KINDS) {
    const extra = scene({ date: DAY[kind] }).length - plain.length;
    assert.ok(extra > 0 && extra < 12 * 1024, `${kind} adds ${(extra / 1024).toFixed(1)} KB`);
  }
});

test('the same day always draws the same scene', () => {
  for (const kind of KINDS) assert.equal(scene({ date: DAY[kind] }), scene({ date: DAY[kind] }), kind);
});

// --- The Action ------------------------------------------------------------------

const entry = fileURLToPath(new URL('../src/index.js', import.meta.url));
function runSample(env) {
  const dir = mkdtempSync(join(tmpdir(), 'git-trains-seasons-'));
  const result = spawnSync(process.execPath, [entry, '--sample'], {
    env: { ...process.env, 'INPUT_OUTPUT-DIR': dir, INPUT_THEME: 'dark', ...env },
    encoding: 'utf8',
  });
  const svg = result.status === 0 ? readFileSync(join(dir, 'train.svg'), 'utf8') : null;
  rmSync(dir, { recursive: true, force: true });
  return { ...result, svg };
}

test('seasons: false keeps the scene plain, and the inputs are checked', () => {
  const plain = renderScene(buildSpec(sampleStats(), { theme: 'dark', skyline: parseSkyline('city') }));
  assert.equal(runSample({ INPUT_SEASONS: 'false', INPUT_UNLOCKS: 'false' }).svg, plain);
  assert.match(runSample({ INPUT_SEASONS: 'sometimes' }).stdout, /Unknown seasons: "sometimes"/);
  assert.match(runSample({ INPUT_HEMISPHERE: 'east' }).stdout, /Unknown hemisphere: "east"/);
  const south = runSample({ INPUT_HEMISPHERE: 'south' });
  assert.equal(south.status, 0);
  wellFormed(south.svg, 'south');
});
