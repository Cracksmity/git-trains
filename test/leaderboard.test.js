import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import {
  cleanRun, gateTag, runKey, parseRuns, mergeRuns, serialize, outcome, taskRuns, fallbacks, median, sumTokens,
  summarize, totals, SORTS, reasons, fmtSeconds, fmtTokens, fmtPercent, modelName,
} from '../leaderboard/board.js';
import { merge, localLogs } from '../scripts/leaderboard.js';

// A run as the conductor logs it, with the parts that must never be published.
const logged = (over = {}) => ({
  at: '2026-11-05T00:44:28.898Z', task: 'comments-en', route: 'mechanical', rung: 1, attempt: 1,
  backend: 'codex', model: 'gpt-6.1-terra', effort: 'high', seconds: 139.6,
  usage: { input: 309413, output: 5845, reasoning: 218 }, passed: true, failures: [],
  prompt: 'Rename everything in C:\\Users\\someone\\secret', cwd: 'C:\\Users\\someone\\git-trains', user: 'someone',
  ...over,
});
// A run as the leaderboard stores it.
const stored = (over = {}) => cleanRun({ ...logged(), ...over });
// Minutes after the first run, to keep a story in order.
const at = (min) => new Date(Date.parse('2026-11-05T00:00:00.000Z') + min * 60_000).toISOString();

// --- Safe fields ---------------------------------------------------------------

test('a conductor record keeps only the safe fields', () => {
  const run = cleanRun(logged());
  assert.deepEqual(Object.keys(run).sort(), ['at', 'attempt', 'backend', 'effort', 'failed', 'model', 'passed', 'route', 'rung', 'seconds', 'task', 'tokens']);
  assert.equal(run.seconds, 140);
  assert.deepEqual(run.tokens, { input: 309413, output: 5845, reasoning: 218 });
  const text = JSON.stringify(run);
  assert.ok(!/someone|Users|secret|prompt|cwd/.test(text), text);
});

test('failure lines boil down to the name of the check, with no command, path or output', () => {
  const lines = [
    ['No files were changed.', 'no-changes'],
    ['Changed files outside the allowed paths (src/**):', 'outside-allow'],
    ['$ node tools/conductor/gates/links.js benchmarks/medellin/index.html', 'links'],
    ['$ node tools/conductor/gates/no-spanish.js --max 4 C:\\Users\\someone\\x.html', 'no-spanish'],
    ['$ node .\\tools\\conductor\\gates\\region-art.js osaka:mountains', 'region-art'],
    ['$ node --test test/custom.test.js test/region.test.js', 'tests'],
    ['$ npm test', 'tests'],
    ['$ node -e "const t=require(\'fs\').readFileSync(\'docs/research/regions.md\')"', 'check'],
    ['$ node --check src/decor.js', 'check'],
    ['The agent exited with code 1 (log: C:\\Users\\someone\\git-trains\\.conductor\\x.log)', 'agent-exit'],
    ['The agent was denied these actions: RunCommand (see D:\\Trenes\\.conductor\\x.log)', 'denied'],
    ["The agent changed the conductor's hook (.agents/hooks.json or tools/conductor/agy-hook.js); both were restored.", 'hook-tampered'],
    ['something nobody planned for in /home/someone/x', 'other'],
  ];
  for (const [line, tag] of lines) assert.equal(gateTag(line), tag, line);
  const run = cleanRun(logged({ passed: false, failures: lines.map(([line]) => line) }));
  assert.ok(run.failed.every((t) => /^[a-z0-9-]+$/.test(t)), run.failed.join());
  assert.ok(!/someone|Users|\\|\//.test(JSON.stringify(run)));
});

test('a passing run has no failed checks, and a failing run always names one', () => {
  assert.deepEqual(cleanRun(logged({ passed: true, failures: ['No files were changed.'] })).failed, []);
  assert.deepEqual(cleanRun(logged({ passed: false, failures: [] })).failed, ['other']);
});

test('a value that does not look like a slug, a date or a number drops the record', () => {
  assert.ok(cleanRun(logged()));
  for (const over of [
    { task: 'C:\\Users\\someone\\task' }, { task: '../secret' }, { task: 'two words' }, { model: 'gpt/6' }, { route: 'Mechanical!' },
    { backend: '' }, { effort: 'very high' }, { at: 'yesterday' }, { at: 5 }, { rung: 0 }, { attempt: 1.5 }, { seconds: -1 },
    { seconds: 'fast' }, { passed: 'yes' },
  ]) assert.equal(cleanRun(logged(over)), null, JSON.stringify(over));
  assert.equal(cleanRun(null), null);
  assert.equal(cleanRun('{"at":1}'), null);
});

test('tokens that are missing stay unknown instead of becoming zero', () => {
  const run = cleanRun(logged({ usage: { output: 7000 } }));
  assert.deepEqual(run.tokens, { input: null, output: 7000, reasoning: null });
  assert.deepEqual(cleanRun(logged({ usage: undefined })).tokens, { input: null, output: null, reasoning: null });
});

test('cleaning a stored run changes nothing, so a leaderboard can be merged into another', () => {
  const run = stored({ passed: false, failures: ['No files were changed.', '$ node tools/conductor/gates/links.js x.html'] });
  assert.deepEqual(cleanRun(run), run);
  assert.deepEqual(parseRuns(JSON.stringify({ version: 1, runs: [run] })).runs, [run]);
});

// --- Merging -------------------------------------------------------------------

test('the same run from two machines is kept once, even when its failure text differs', () => {
  const a = stored({ passed: false, failures: ['The agent exited with code 1 (log: C:\\Users\\ann\\x.log)'] });
  const b = stored({ passed: false, failures: ['The agent exited with code 1 (log: /home/bob/x.log)'] });
  assert.equal(runKey(a), runKey(b));
  assert.equal(mergeRuns([a], [b]).length, 1);
});

test('runs that differ in model, attempt or time are all kept, oldest first', () => {
  const runs = [
    stored({ at: at(30), attempt: 2 }),
    stored({ at: at(10), model: 'gpt-6.1-sol' }),
    stored({ at: at(30), attempt: 1 }),
    stored({ at: at(5) }),
  ];
  const merged = mergeRuns(runs, runs.slice(0, 2));
  assert.equal(merged.length, 4);
  assert.deepEqual(merged.map((r) => r.at), [at(5), at(10), at(30), at(30)]);
  assert.deepEqual(merged.slice(2).map((r) => r.attempt), [1, 2]);
});

test('when two copies disagree, the first list (the committed board) wins', () => {
  const old = stored({ seconds: 100 });
  const newer = stored({ seconds: 999 });
  assert.equal(mergeRuns([old], [newer])[0].seconds, 100);
});

test('a conductor log reads line by line: blank lines are skipped, broken ones counted', () => {
  const text = [JSON.stringify(logged()), '', '{"at": broken', JSON.stringify(logged({ task: 'bad task name' })), JSON.stringify(logged({ at: at(1), task: 'guides-en' }))].join('\n');
  const { runs, dropped } = parseRuns(text);
  assert.deepEqual(runs.map((r) => r.task), ['comments-en', 'guides-en']);
  assert.equal(dropped, 2);
});

test('the file is one run per line, ends with a newline and writes the same text every time', () => {
  const runs = mergeRuns([stored({ at: at(2) }), stored({ at: at(1), task: 'guides-en' })]);
  const text = serialize(runs);
  assert.ok(text.endsWith('\n'));
  assert.equal(text.split('\n').filter((l) => l.trim().startsWith('{"at"')).length, 2);
  assert.deepEqual(JSON.parse(text), { version: 1, runs });
  assert.equal(serialize(parseRuns(text).runs), text);
  assert.deepEqual(JSON.parse(serialize([])), { version: 1, runs: [] });
});

test('a board a merge conflict left markers in still reads, keeping both sides', () => {
  const mine = stored({ at: at(1), task: 'guides-en' });
  const theirs = stored({ at: at(2), task: 'regions-mexico' });
  const base = stored({ at: at(0) });
  const text = [
    '{', '  "version": 1,', '  "runs": [', `    ${JSON.stringify(base)},`,
    '<<<<<<< HEAD', `    ${JSON.stringify(mine)}`, '=======', `    ${JSON.stringify(theirs)}`, '>>>>>>> origin/main', '  ]', '}', '',
  ].join('\n');
  assert.throws(() => JSON.parse(text));
  const { runs, dropped } = parseRuns(text);
  assert.equal(dropped, 0);
  assert.deepEqual(runs.map((r) => r.task), ['comments-en', 'guides-en', 'regions-mexico']);
  JSON.parse(serialize(mergeRuns(runs))); // and writes back clean
});

// --- The script ----------------------------------------------------------------

function machine(...records) {
  const dir = mkdtempSync(join(tmpdir(), 'git-trains-board-'));
  mkdirSync(join(dir, '.conductor'));
  const file = join(dir, '.conductor', 'runs.jsonl');
  writeFileSync(file, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return { dir, file };
}

test('logs from several machines pile up in the board without repeats, and a second run adds nothing', () => {
  const first = logged();
  const second = logged({ at: at(10), task: 'guides-en' });
  const third = logged({ at: at(20), task: 'regions-mexico', model: 'gpt-6.1-sol', effort: 'xhigh' });
  const laptop = machine(first, second);
  const desktop = machine(second, third); // overlaps with the laptop

  const once = merge({ board: '', files: [laptop.file, desktop.file] });
  assert.equal(once.runs.length, 3);
  assert.equal(once.added, 3);
  assert.equal(once.dropped, 0);

  const again = merge({ board: once.text, files: [laptop.file, desktop.file] });
  assert.equal(again.added, 0);
  assert.equal(again.text, once.text);

  // Another copy of the board is a valid source too.
  const copy = join(desktop.dir, 'leaderboard.json');
  writeFileSync(copy, once.text);
  assert.equal(merge({ board: '', files: [copy] }).text, once.text);
});

test('a local log the safe shape rejects is counted and left out', () => {
  const laptop = machine(logged(), logged({ at: at(1), task: 'C:\\Users\\someone\\x' }));
  const result = merge({ board: '', files: [laptop.file] });
  assert.equal(result.runs.length, 1);
  assert.equal(result.dropped, 1);
});

test('the logs of this machine are found in the folder it runs from', () => {
  const laptop = machine(logged());
  assert.deepEqual(localLogs(laptop.dir).map((f) => f.toLowerCase()), [laptop.file.toLowerCase()]);
  assert.deepEqual(localLogs(mkdtempSync(join(tmpdir(), 'git-trains-empty-'))), []);
});

// --- Reading the runs ----------------------------------------------------------

test('a run passes, fails, or crashes before it did anything (which is no verdict)', () => {
  assert.equal(outcome(stored()), 'pass');
  assert.equal(outcome(stored({ passed: false, failures: ['No files were changed.'] })), 'fail');
  assert.equal(outcome(stored({ passed: false, failures: ['The agent exited with code 1'], usage: { input: 0, output: 0, reasoning: 0 } })), 'error');
  // It exited non-zero after real work (a timeout, say): that is a fail.
  assert.equal(outcome(stored({ passed: false, failures: ['The agent exited with code null'], usage: { input: 5000, output: 900, reasoning: 0 } })), 'fail');
});

// benchmark-en: Flash fails twice, Terra takes over. Then the same task again on its own.
const ladder = [
  stored({ at: at(0), task: 'benchmark-en', route: 'bulk', backend: 'gemini', model: 'gemini-3.8-flash-high', effort: null, seconds: 11, passed: false, failures: ['No files were changed.', '$ node tools/conductor/gates/links.js a.html'] }),
  stored({ at: at(1), task: 'benchmark-en', route: 'bulk', attempt: 2, backend: 'gemini', model: 'gemini-3.8-flash-high', effort: null, seconds: 22, passed: false, failures: ['No files were changed.'] }),
  stored({ at: at(5), task: 'benchmark-en', route: 'bulk', rung: 2, model: 'gpt-6.1-terra', seconds: 125 }),
  stored({ at: at(3), task: 'comments-en', seconds: 140 }),
  stored({ at: at(60), task: 'benchmark-en', route: 'bulk', model: 'gpt-6.1-terra', seconds: 100 }),
];

test('attempts group into the runs of a task, in order, whatever else ran in between', () => {
  const runs = taskRuns(ladder);
  assert.deepEqual(runs.map((t) => [t.task, t.attempts.length, t.passed]), [
    ['benchmark-en', 3, true], ['comments-en', 1, true], ['benchmark-en', 1, true],
  ]);
  assert.equal(runs[0].seconds, 158);
  assert.equal(runs[0].model, 'gpt-6.1-terra');
  assert.equal(runs[0].tokens.output, 5845 * 3);
});

test('a ladder that moves on to the next model is a fallback, with the reason', () => {
  const events = fallbacks(ladder);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], { task: 'benchmark-en', route: 'bulk', at: at(5), from: 'gemini-3.8-flash-high', to: 'gpt-6.1-terra', ran: true, because: ['no-changes', 'links'] });
});

test('a rung that only crashed gave up nothing, so it is not a fallback', () => {
  const crash = { passed: false, failures: ['The agent exited with code 1'], usage: { input: 0, output: 0, reasoning: 0 } };
  const runs = [
    stored({ at: at(0), task: 'regions-presets', model: 'gpt-6-astra', ...crash }),
    stored({ at: at(1), task: 'regions-presets', rung: 2, model: 'gpt-6.1-sol', ...crash }),
  ];
  assert.equal(taskRuns(runs).length, 1);
  assert.deepEqual(fallbacks(runs), []);
});

// --- Aggregating ---------------------------------------------------------------

test('the median is the middle value, or the mean of the two in the middle', () => {
  assert.equal(median([]), null);
  assert.equal(median([9]), 9);
  assert.equal(median([30, 10, 20]), 20);
  assert.equal(median([10, 20, 30, 41]), 25);
});

test('tokens add up what was reported, leave reasoning out of the total, and say when a floor', () => {
  const t = sumTokens([stored(), stored({ usage: { input: 1000, output: 500, reasoning: 100 } })]);
  assert.deepEqual(t, { input: 310413, output: 6345, reasoning: 318, total: 316758, partial: false });
  assert.equal(sumTokens([stored(), stored({ usage: { output: 7000 } })]).partial, true);
});

test('a model row: tasks, first-try rate, median time of passes, tokens, routes and fallbacks', () => {
  const rows = summarize(ladder);
  const by = Object.fromEntries(rows.map((m) => [m.model, m]));

  const flash = by['gemini-3.8-flash-high'];
  assert.equal(flash.name, 'Gemini 3.8 Flash (high)');
  assert.deepEqual([flash.tasks, flash.attempts, flash.errors], [1, 2, 0]);
  assert.deepEqual(flash.firstTry, { passed: 0, total: 1, rate: 0 });
  assert.equal(flash.medianSeconds, null); // nothing passed
  assert.equal(flash.medianAllSeconds, 17); // (11 + 22) / 2, rounded
  assert.deepEqual(flash.fellBackTo, [{ task: 'benchmark-en', to: 'gpt-6.1-terra', because: ['no-changes', 'links'] }]);

  const terra = by['gpt-6.1-terra'];
  assert.deepEqual([terra.tasks, terra.attempts], [2, 3]);
  assert.deepEqual(terra.firstTry, { passed: 3, total: 3, rate: 1 });
  assert.equal(terra.medianSeconds, 125); // 100, 125, 140
  assert.deepEqual(terra.efforts, { high: 3 });
  assert.deepEqual(terra.routes.map((r) => [r.route, r.attempts, r.asFallback]), [['bulk', 2, false], ['mechanical', 1, false]]);
  assert.deepEqual(terra.tookOver, [{ task: 'benchmark-en', from: 'gemini-3.8-flash-high' }]);
});

test('a model that only ran as a fallback says so on that route', () => {
  const rows = summarize(ladder.slice(0, 3));
  assert.deepEqual(rows.find((m) => m.model === 'gpt-6.1-terra').routes, [{ route: 'bulk', attempts: 1, tasks: 1, asFallback: true }]);
});

test('crashed attempts leave the rates, the medians and the tokens, and show up as errors', () => {
  const crash = { passed: false, failures: ['The agent exited with code 1'], usage: { input: 0, output: 0, reasoning: 0 } };
  const runs = [stored({ at: at(0), model: 'gpt-6-astra', seconds: 300 }), stored({ at: at(1), task: 'x-task', model: 'gpt-6-astra', seconds: 3, ...crash })];
  const [astra] = summarize(runs);
  assert.deepEqual([astra.attempts, astra.errors, astra.tasks], [1, 1, 1]);
  assert.deepEqual(astra.firstTry, { passed: 1, total: 1, rate: 1 });
  assert.equal(astra.medianSeconds, 300);
  const all = totals(runs);
  assert.deepEqual([all.attempts, all.errors, all.tasks, all.runs], [1, 1, 1, 1]);
});

test('totals count tasks once however many times they ran, and say what period they cover', () => {
  const all = totals(ladder);
  assert.deepEqual([all.tasks, all.runs, all.attempts, all.models], [2, 3, 5, 2]);
  assert.deepEqual(all.firstTry, { passed: 3, total: 4 });
  assert.equal(all.since, at(0));
  assert.equal(all.until, at(60));
});

test('the models table sorts by first-try rate, tasks, speed or tokens, with the unknown last', () => {
  const rows = summarize(ladder);
  const order = (key) => rows.sort(SORTS[key]).map((m) => m.model);
  assert.deepEqual(order('firstTry'), ['gpt-6.1-terra', 'gemini-3.8-flash-high']);
  assert.deepEqual(order('tasks'), ['gpt-6.1-terra', 'gemini-3.8-flash-high']);
  assert.deepEqual(order('speed'), ['gpt-6.1-terra', 'gemini-3.8-flash-high']); // no passing time goes last
  assert.deepEqual(order('tokens'), ['gemini-3.8-flash-high', 'gpt-6.1-terra']);
});

// --- Words and numbers ---------------------------------------------------------

test('times, tokens and rates read like the rest of the site', () => {
  assert.equal(fmtSeconds(22), '22 s');
  assert.equal(fmtSeconds(60), '1 min');
  assert.equal(fmtSeconds(140), '2 min 20 s');
  assert.equal(fmtSeconds(387), '6 min 27 s');
  assert.equal(fmtSeconds(367), '6 min 07 s');
  assert.equal(fmtSeconds(null), '–');
  assert.equal(fmtTokens(850), '850');
  assert.equal(fmtTokens(5845), '5.8k');
  assert.equal(fmtTokens(17411), '17k');
  assert.equal(fmtTokens(999999), '1.00M');
  assert.equal(fmtTokens(1244156), '1.24M');
  assert.equal(fmtTokens(12_400_000), '12.4M');
  assert.equal(fmtTokens(null), '–');
  assert.equal(fmtPercent(0.8), '80%');
  assert.equal(fmtPercent(null), '–');
  assert.equal(modelName('gpt-6.1-terra'), 'GPT-6.1 Terra');
  assert.equal(modelName('some-new-model'), 'some-new-model');
});

test('failures are explained once: a run that changed nothing does not also fail every check', () => {
  assert.equal(reasons(['no-changes', 'links', 'no-spanish', 'denied']), 'changed nothing, a command was denied');
  assert.equal(reasons(['links', 'tests']), 'the links check failed, tests failed');
});

// --- The committed board and the page ------------------------------------------

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('docs/leaderboard.json is clean, sorted, free of repeats, and holds only safe values', () => {
  const text = read('docs/leaderboard.json');
  const { runs, dropped } = parseRuns(text);
  assert.equal(dropped, 0);
  assert.ok(runs.length > 0);
  assert.equal(text, serialize(runs), 'not normalized: run `npm run leaderboard` or keep one run per line, sorted by date');
  assert.equal(new Set(runs.map(runKey)).size, runs.length);
  assert.deepEqual(Object.keys(JSON.parse(text)).sort(), ['runs', 'version']);

  const strings = [];
  (function walk(v) {
    if (typeof v === 'string') strings.push(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  })(JSON.parse(text).runs);
  for (const s of strings) assert.ok(!/[\\/]/.test(s), `looks like a path: ${s}`);
  const user = userInfo().username.toLowerCase();
  if (user.length >= 5) assert.ok(!text.toLowerCase().includes(user), 'the machine user name is in the file');
});

test('the page loads the board and its module from files that exist, and links to them', () => {
  const html = read('leaderboard/index.html');
  assert.match(html, /from '\.\/board\.js'/);
  assert.match(html, /fetch\('\.\.\/docs\/leaderboard\.json'/);
  assert.ok(read('leaderboard/board.js').length > 0);
  assert.ok(read('docs/leaderboard.json').length > 0);
  assert.match(html, /<title>[^<]*leaderboard/i);
});
