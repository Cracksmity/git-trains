import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeShare } from '../studio/share.js';
import { buildPrompt, check, extractJson, readGuide } from '../bin/answer.js';
import { previewSkyline, previewTrain } from '../bin/preview.js';
import { parseCustomModel } from '../src/custom.js';
import { parseSkyline } from '../src/skyline.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', 'bin', 'git-trains.js');
const FAKE = join(HERE, 'fixtures', 'fake-ai.js');

const GOOD_TRAIN = { name: 'Green test train', pal: { body: '#1a7f37' }, nose: 'metro-white' };
const BAD_TRAIN = { pal: { body: 'green' }, nose: 'rocket' };
const GOOD_SKYLINE = { name: 'Testville', buildings: [{ x: 100, w: 12, h: 40, top: 'spire' }] };
const fence = (value, before = 'Here it is.') => `${before}\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n\nShort and simple.`;

// --- The pieces ---------------------------------------------------------------------

test('the JSON is found in a chatty answer, fenced or not, even with a trailing comma', () => {
  const plain = extractJson(fence(GOOD_TRAIN));
  assert.deepEqual(plain.value, GOOD_TRAIN);
  assert.deepEqual(extractJson(`Sure! ${JSON.stringify(GOOD_TRAIN)} Hope it helps {sic}`).value, GOOD_TRAIN);
  assert.deepEqual(extractJson('```\n{ "a": [1, 2,], "b": "x,}", }\n```').value, { a: [1, 2], b: 'x,}' });
  // The answer is the biggest block, not a snippet the AI quoted in its explanation.
  const two = `\`\`\`json\n${JSON.stringify(GOOD_TRAIN)}\n\`\`\`\nThe color is \`\`\`json\n{"body":"#fff"}\n\`\`\``;
  assert.deepEqual(extractJson(two).value, GOOD_TRAIN);
});

test('an answer without usable JSON says why, so the AI can fix it', () => {
  assert.match(extractJson('').error, /empty/);
  assert.match(extractJson('I would paint it green.').error, /no JSON/);
  assert.match(extractJson('```json\n{ "pal": { "body": }\n```').error, /not valid JSON/);
  assert.match(extractJson('[1, 2]').error, /no JSON object/);
});

test('the validator problems come back as a list to paste, the same ones the Action prints', () => {
  assert.deepEqual(check('train', GOOD_TRAIN).problems, []);
  assert.equal(check('train', GOOD_TRAIN).parsed.name, 'Green test train');
  const bad = check('train', BAD_TRAIN).problems;
  assert.equal(bad.length, 2);
  assert.match(bad[0], /pal\.body/);
  assert.match(bad[1], /nose\.base/);
  assert.deepEqual(check('skyline', GOOD_SKYLINE).problems, []);
  assert.match(check('skyline', { buildings: [{ x: 1, w: 5 }] }).problems[0], /buildings\[0\]\.h/);
  const huge = { ...GOOD_TRAIN, description: 'x'.repeat(300 * 1024) };
  assert.ok(check('train', huge).problems.some((p) => /KB/.test(p)));
});

test('the prompt is the AI guide plus the request, and a retry carries the previous JSON and the problems', () => {
  const guide = readGuide('train');
  assert.ok(!guide.includes('If you are a person'), 'the note for people is dropped');
  assert.match(guide, /Design a train for git-trains/);
  const first = buildPrompt({ kind: 'train', guide, description: 'Osaka Metro 400 series', photos: { names: [], attached: false } });
  assert.ok(first.startsWith('# Design a train'));
  assert.match(first, /Osaka Metro 400 series/);
  assert.match(first, /Do not run commands and do not create or edit files/);
  assert.ok(!first.includes('previous answer'));

  const photoFiles = buildPrompt({ kind: 'train', guide, description: '', photos: { names: ['photo-1.jpg', 'photo-2.png'], attached: false } });
  assert.match(photoFiles, /No description: design the train shown in the photo/);
  assert.match(photoFiles, /photo-1\.jpg, photo-2\.png/);
  assert.match(buildPrompt({ kind: 'skyline', guide: 'G', description: 'Lisbon', photos: { names: ['a.png'], attached: true } }), /A photo is attached/);

  const retry = buildPrompt({ kind: 'train', guide, description: 'x', photos: { names: [], attached: false }, retry: { previous: '{"pal":1}', problems: ['pal: nope', 'nose: missing'] } });
  assert.match(retry, /rejected/);
  assert.match(retry, /"pal":1/);
  assert.match(retry, /- pal: nope\n- nose: missing/);
});

test('the terminal preview draws the real pixels with half blocks, within the window', () => {
  const train = previewTrain(parseCustomModel(GOOD_TRAIN), { columns: 80 });
  const lines = train.split('\n');
  assert.ok(lines.length >= 4 && lines.length <= 20, `${lines.length} lines`);
  for (const line of lines) {
    const cells = [...line.replace(/\x1b\[[0-9;]*m/g, '')];
    assert.ok(cells.length <= 80 && cells.every((c) => c === '▀'), 'only half blocks, 80 columns at most');
  }
  assert.match(train, /\x1b\[38;2;\d+;\d+;\d+;48;2;\d+;\d+;\d+m/);
  const sky = previewSkyline(parseSkyline(GOOD_SKYLINE), { columns: 100 });
  assert.ok(sky.split('\n').length >= 6);
  assert.ok(sky.split('\n').every((l) => [...l.replace(/\x1b\[[0-9;]*m/g, '')].length <= 100));
});

// --- The command, with a fake CLI standing in for the real ones ---------------------

// A folder with `codex`, `agy` and `claude` that run test/fixtures/fake-ai.js. PATH holds
// only that folder and node's, so the real CLIs on this machine are never touched.
function sandbox(t, { installed = ['codex', 'agy', 'claude'], answers = [fence(GOOD_TRAIN)], fail } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'git-trains-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  const work = join(root, 'work');
  mkdirSync(bin);
  mkdirSync(work);
  const kinds = { codex: 'codex', agy: 'gemini', claude: 'claude' };
  for (const name of installed) {
    if (process.platform === 'win32') writeFileSync(join(bin, `${name}.cmd`), `@"${process.execPath}" "${FAKE}" ${kinds[name]} %*\r\n`);
    else {
      writeFileSync(join(bin, name), `#!/bin/sh\nexec "${process.execPath}" "${FAKE}" ${kinds[name]} "$@"\n`);
      chmodSync(join(bin, name), 0o755);
    }
  }
  const scenario = join(root, 'scenario.json');
  const log = join(root, 'runs.jsonl');
  writeFileSync(scenario, JSON.stringify({ answers, fail }));
  writeFileSync(log, '');
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toLowerCase() !== 'path'));
  env.PATH = [bin, dirname(process.execPath)].join(delimiter);
  Object.assign(env, { FAKE_AI_SCENARIO: scenario, FAKE_AI_LOG: log });
  return {
    work,
    runs: () => readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => !r.args.includes('--version')),
    run: (...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: work, env, encoding: 'utf8', timeout: 60_000 }),
  };
}

test('one bad answer, one with problems, then a good one: the loop retries and writes the file', async (t) => {
  const s = sandbox(t, { answers: ['I will draw it now: { "pal": { "body": }', fence(BAD_TRAIN), fence(GOOD_TRAIN, 'Fixed both.')] });
  const res = s.run('design', 'train', 'a', 'green', 'metro', '--ai', 'codex', '--model', 'gpt-test');
  assert.equal(res.status, 0, res.stderr + res.stdout);

  // The file holds the valid JSON, in the default place, and nothing else was written.
  const file = join(s.work, '.github', 'train.json');
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), GOOD_TRAIN);
  assert.match(res.stdout, /Passed the validator/);

  // The share link opens the studio with the same train.
  const link = res.stdout.match(/https:\/\/cracksmity\.github\.io\/git-trains\/studio\/(#train=[A-Za-z0-9_-]+)/);
  assert.ok(link, res.stdout);
  assert.deepEqual(JSON.parse((await decodeShare(link[1])).text), GOOD_TRAIN);

  const runs = s.runs();
  assert.equal(runs.length, 3);
  // Codex: read-only sandbox, the right model, the prompt on stdin, and an empty folder that is not ours.
  assert.deepEqual(runs[0].args.slice(0, 6), ['exec', '--json', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only']);
  assert.ok(runs[0].args.join(' ').includes('-m gpt-test'));
  assert.ok(!runs[0].args.includes('--dangerously-bypass-approvals-and-sandbox'));
  assert.deepEqual(runs[0].files, []);
  assert.notEqual(runs[0].cwd, s.work);
  assert.ok(!existsSync(runs[0].cwd), 'the temporary folder is removed');
  assert.match(runs[0].stdin, /Design a train for git-trains/);
  assert.match(runs[0].stdin, /a green metro/);
  // Try 2 hears that nothing could be read; try 3 gets the previous JSON and the validator's list.
  assert.match(runs[1].stdin, /could not be used/);
  assert.match(runs[2].stdin, /rejected/);
  assert.match(runs[2].stdin, /- pal\.body: "green" is not a hex color/);
  assert.match(runs[2].stdin, /- nose\.base: "rocket" does not exist/);
  assert.match(runs[2].stdin, /"body": "green"/);
});

test('out of tries: nothing is written to --out, the last answer is kept as a draft, the exit code is 1', (t) => {
  const s = sandbox(t, { answers: [fence(BAD_TRAIN)] });
  const res = s.run('design', 'train', 'x', '--ai', 'codex', '--tries', '2', '--out', 'mine/train.json');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /None of the 2 answers passed/);
  assert.match(res.stderr, /pal\.body/);
  assert.ok(!existsSync(join(s.work, 'mine', 'train.json')));
  assert.deepEqual(JSON.parse(readFileSync(join(s.work, 'mine', 'train.json.draft'), 'utf8')), BAD_TRAIN);
  assert.equal(s.runs().length, 2);
});

test('Antigravity: the task goes in a file, photos are staged, and a hook restricts tools', (t) => {
  const s = sandbox(t, { answers: [fence(GOOD_SKYLINE)] });
  const photo = join(s.work, 'my skyline.PNG');
  writeFileSync(photo, 'not really a png');
  const res = s.run('design', 'skyline', 'Lisbon', '--ai', 'agy', '--photo', photo);
  assert.equal(res.status, 0, res.stderr + res.stdout);
  assert.deepEqual(JSON.parse(readFileSync(join(s.work, '.github', 'skyline.json'), 'utf8')), GOOD_SKYLINE);
  const [run] = s.runs();
  assert.deepEqual(run.files.filter((f) => !f.includes('.agents')).sort(), ['photo-1.png', 'task.md']);
  assert.ok(run.files.includes('.agents/hooks.json') && run.files.includes('.agents/read-inputs.cjs'));
  assert.match(run.task, /Design a skyline for git-trains/);
  assert.match(run.task, /Lisbon/);
  assert.match(run.task, /photo-1\.png/);
  const prompt = run.args[run.args.indexOf('-p') + 1];
  assert.ok(prompt.length < 300 && prompt.includes('task.md'), 'the prompt argument is short: the guide would not fit a Windows command line');
  assert.deepEqual(run.args.slice(0, 2), ['--output-format', 'json']);
  assert.ok(!run.args.includes('--dangerously-skip-permissions'));
});

test('Antigravity with an empty answer (a refused action) is retried with advice, not fatal', (t) => {
  const s = sandbox(t, { answers: [null, fence(GOOD_SKYLINE)] });
  const res = s.run('design', 'skyline', 'Lisbon', '--ai', 'gemini');
  assert.equal(res.status, 0, res.stderr + res.stdout);
  assert.match(res.stdout, /refused RunCommand/);
  assert.match(s.runs()[1].task, /could not be used/);
});

test('Claude Code: prompt on stdin, only the Read tool, photos opened from the folder', (t) => {
  const s = sandbox(t, { answers: [fence(GOOD_TRAIN)] });
  writeFileSync(join(s.work, 'front.jpg'), 'jpg');
  const res = s.run('design', 'train', '--ai', 'claude', '--model', 'sonnet', '--photo', 'front.jpg', '--photo', 'front.jpg');
  assert.equal(res.status, 0, res.stderr + res.stdout);
  const [run] = s.runs();
  const args = run.args.join(' ');
  assert.match(args, /^-p --output-format json --tools Read /);
  assert.match(args, /--model sonnet/);
  assert.ok(!run.args.includes('--dangerously-skip-permissions') && !run.args.includes('--permission-mode'));
  assert.deepEqual(run.files, ['photo-1.jpg', 'photo-2.jpg']);
  assert.match(run.stdin, /No description: design the train shown in the photo/);
  assert.match(run.stdin, /photo-1\.jpg, photo-2\.jpg/);
});

test('Codex gets photos as attachments, and the first CLI installed is the default', (t) => {
  const s = sandbox(t, { installed: ['claude', 'agy', 'codex'] });
  writeFileSync(join(s.work, 'osaka.webp'), 'webp');
  const res = s.run('design', 'train', 'Osaka Metro', '--photo', 'osaka.webp');
  assert.equal(res.status, 0, res.stderr + res.stdout);
  const [run] = s.runs();
  assert.equal(run.kind, 'codex', 'codex comes first, then gemini, then claude');
  const at = run.args.indexOf('-i');
  assert.ok(run.args[at + 1].endsWith('osaka.webp'));
  assert.ok(run.args.indexOf('-C') > at, 'the last option is not the variadic -i');
  assert.deepEqual(run.files, []);
  assert.match(run.stdin, /A photo is attached/);
});

test('with only Claude installed it is used; with none, or a missing --ai, the message says what to do', (t) => {
  const onlyClaude = sandbox(t, { installed: ['claude'] });
  assert.equal(onlyClaude.run('design', 'train', 'x').status, 0);
  assert.equal(onlyClaude.runs()[0].kind, 'claude');

  const none = sandbox(t, { installed: [] });
  const res = none.run('design', 'train', 'x');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /No AI coding CLI found/);
  assert.match(res.stderr, /codex --version/);

  const wrong = onlyClaude.run('design', 'train', 'x', '--ai', 'codex', '--out', 'other.json');
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /Codex isn't installed/);
  assert.match(onlyClaude.run('design', 'train', 'x', '--ai', 'nope', '--out', 'other.json').stderr, /Unknown --ai "nope"/);
});

test('a CLI that fails (not signed in) stops at once with its message; trying again would not help', (t) => {
  const s = sandbox(t, { fail: { code: 3, stderr: 'Not signed in. Run codex login.' } });
  const res = s.run('design', 'train', 'x', '--ai', 'codex', '--tries', '5');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /Codex failed \(exit code 3\).*Not signed in/s);
  assert.equal(s.runs().length, 1);
});

test('it never overwrites a file without --force, and checks before spending any tokens', (t) => {
  const s = sandbox(t);
  mkdirSync(join(s.work, '.github'));
  writeFileSync(join(s.work, '.github', 'train.json'), '{"mine":true}');
  const res = s.run('design', 'train', 'x', '--ai', 'codex');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /already exists.*--force/);
  assert.equal(s.runs().length, 0);
  assert.equal(readFileSync(join(s.work, '.github', 'train.json'), 'utf8'), '{"mine":true}');
  assert.equal(s.run('design', 'train', 'x', '--ai', 'codex', '--force').status, 0);
  assert.deepEqual(JSON.parse(readFileSync(join(s.work, '.github', 'train.json'), 'utf8')), GOOD_TRAIN);
});

test('bad options are refused before anything runs', (t) => {
  const s = sandbox(t);
  writeFileSync(join(s.work, 'notes.txt'), 'x');
  const cases = [
    [['design'], /Design a train or a skyline/],
    [['design', 'plane', 'x'], /"train" or a "skyline"/],
    [['design', 'train'], /Say what to design/],
    [['design', 'train', 'x', '--tries', '0'], /--tries/],
    [['design', 'train', 'x', '--model=-yolo'], /model name/],
    [['design', 'train', 'x', '--model', '--yolo'], /ambiguous/],
    [['design', 'train', 'x', '--photo', 'missing.png'], /Photo not found/],
    [['design', 'train', 'x', '--photo', 'notes.txt'], /photos must be/],
    [['bake', 'cake'], /Unknown command/],
    [['design', 'train', 'x', '--nope'], /Unknown option/],
  ];
  for (const [args, message] of cases) {
    const res = s.run(...args);
    assert.notEqual(res.status, 0, args.join(' '));
    assert.match(res.stderr, message, args.join(' '));
  }
  assert.equal(s.runs().length, 0);
  assert.match(s.run('--help').stdout, /git-trains design train/);
  assert.match(s.run('--version').stdout, /^\d+\.\d+\.\d+/);
});
