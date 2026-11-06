import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { checkDepot, checkFile, shareLink, preview, reportMarkdown, formatProblems, indexJson, MARKER, MAX_BYTES } from '../scripts/community.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const json = (p) => JSON.parse(read(p).toString('utf8'));
const NYC = json('community/trains/nyc-subway.json');
const MEXICO = json('community/skylines/mexico-city.json');
const bytes = (v) => Buffer.from(JSON.stringify(v, null, 2));

// A depot of its own in a temporary folder: { 'trains/x.json': value or string }.
function depot(files) {
  const root = mkdtempSync(join(tmpdir(), 'git-trains-depot-'));
  for (const [path, value] of Object.entries(files)) {
    const file = join(root, 'community', path);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, typeof value === 'string' || Buffer.isBuffer(value) ? value : bytes(value));
  }
  return root;
}
const problemsOf = (result) => result.problems.flatMap((p) => p.problems.map((m) => `${p.file}: ${m}`));

test('every file in community/ passes, and community/index.json lists nothing that is gone', () => {
  const result = checkDepot();
  assert.deepEqual(problemsOf(result), []);
  assert.ok(result.entries.length >= 6);
  for (const e of result.entries) {
    assert.deepEqual(Object.keys(e), ['id', 'name', 'description', 'author', 'kind', 'share']);
    if (e.kind === 'train') assert.equal(json(`community/trains/${e.id}.json`).id, e.id);
  }
  // This function checks source files independently of the generated index, but
  // never by an entry that was already there.
  const index = json('community/index.json');
  for (const old of index) assert.ok(result.entries.some((e) => e.kind === old.kind && e.id === old.id), `${old.kind} ${old.id} is in the index but not in community/`);
});

test('the seed files are the examples, plus an author', () => {
  const pairs = [
    ['examples/trains/medellin.json', 'community/trains/metro-medellin-caf.json'],
    ['examples/trains/new-york.json', 'community/trains/nyc-subway.json'],
    ['examples/trains/osaka.json', 'community/trains/osaka-metro-400.json'],
    ['examples/trains/steam.json', 'community/trains/steam-tank-engine.json'],
    ['examples/skylines/medellin.json', 'community/skylines/medellin.json'],
    ['examples/skylines/mexico-city.json', 'community/skylines/mexico-city.json'],
  ];
  for (const [example, copy] of pairs) {
    const { author, ...rest } = json(copy);
    assert.equal(author, 'Cracksmity');
    assert.deepEqual(rest, json(example), copy);
  }
});

test('share links use the studio format and carry the file', () => {
  for (const [kind, raw] of [['train', NYC], ['skyline', MEXICO]]) {
    const link = shareLink(kind, raw);
    // The same pattern studio/share.js reads.
    const m = /^studio\/#(train|skyline)=([A-Za-z0-9_-]+)$/.exec(link);
    assert.ok(m, link.slice(0, 40));
    assert.equal(m[1], kind);
    assert.deepEqual(JSON.parse(inflateRawSync(Buffer.from(m[2], 'base64url')).toString('utf8')), raw);
  }
  assert.throws(() => shareLink('tram', NYC), /Unknown kind/);
});

test('the depot rules: id = file name, author, name, description, size', () => {
  const check = (kind, name, raw) => checkFile(kind, `community/${kind}s/${name}`, Buffer.isBuffer(raw) ? raw : bytes(raw)).problems;
  assert.deepEqual(check('train', 'nyc-subway.json', NYC), []);
  assert.deepEqual(check('skyline', 'mexico-city.json', MEXICO), []);

  assert.match(check('train', 'nyc.json', NYC).join('\n'), /id: "nyc-subway" does not match the file name; name the file nyc-subway\.json/);
  const { id, ...noId } = NYC;
  assert.match(check('train', 'nyc-subway.json', noId).join('\n'), /id: required, the same as the file name \("nyc-subway"\)/);
  assert.match(check('skyline', 'Mexico City.json', MEXICO).join('\n'), /the file name is the skyline's id/);

  const { author, ...anonymous } = MEXICO;
  assert.match(check('skyline', 'mexico-city.json', anonymous).join('\n'), /author: required, your GitHub username/);
  assert.match(check('skyline', 'mexico-city.json', { ...anonymous, autor: 'x' }).join('\n'), /rename "autor" to "author"/);
  assert.match(check('skyline', 'mexico-city.json', { ...MEXICO, author: '@octocat' }).join('\n'), /without "@" \("octocat"\)/);
  assert.match(check('skyline', 'mexico-city.json', { ...MEXICO, author: 'not a user' }).join('\n'), /is not a GitHub username/);
  assert.match(check('skyline', 'mexico-city.json', { ...MEXICO, author: 7 }).join('\n'), /7 is not a GitHub username/);

  assert.match(check('train', 'nyc-subway.json', { ...NYC, name: '' }).join('\n'), /name: required/);
  assert.match(check('train', 'nyc-subway.json', { ...NYC, name: 'x'.repeat(41) }).join('\n'), /name: 41 characters; 40 at most/);
  assert.match(check('train', 'nyc-subway.json', { ...NYC, description: undefined }).join('\n'), /description: required, which real train/);

  const big = bytes({ ...MEXICO, _padding: 'x'.repeat(MAX_BYTES) });
  assert.match(check('skyline', 'mexico-city.json', big).join('\n'), /KB; the limit is 64 KB/);
  assert.match(check('train', 'nyc-subway.json', Buffer.from('{ "id": ')).join('\n'), /not valid JSON/);
  assert.match(check('train', 'nyc-subway.json', Buffer.from('[1, 2]')).join('\n'), /must be a JSON object/);
  // A BOM from a Windows editor is fine.
  assert.deepEqual(check('train', 'nyc-subway.json', Buffer.concat([Buffer.from('﻿'), bytes(NYC)])), []);
});

test("the Action's own validators run too, with their messages", () => {
  const problems = checkFile('train', 'community/trains/nyc-subway.json', bytes({ ...NYC, pal: { body: 'red' }, doors: 4 })).problems;
  assert.ok(problems.includes('pal.body: "red" is not a hex color (#rrggbb)'), problems.join('\n'));
  assert.ok(problems.includes('doors: 2 or 3 doors per side'));
  const sky = checkFile('skyline', 'community/skylines/mexico-city.json', bytes({ ...MEXICO, id: 'mexico-city', buildings: [] })).problems;
  assert.ok(sky.some((p) => p.includes('unknown key "id"')), sky.join('\n'));
  assert.ok(sky.some((p) => p.startsWith('buildings: a list of 1 to')));
});

test('a whole depot: every problem at once, stray files and an index in order', () => {
  const root = depot({
    'trains/nyc-subway.json': NYC,
    'trains/broken.json': { ...NYC, id: 'broken', author: '' },
    'trains/notes.txt': 'hello',
    'trains/old/x.json': NYC,
    'skylines/mexico-city.json': MEXICO,
    'skylines/zz-top.json': { ...MEXICO, name: 'Aztec skyline' },
  });
  try {
    const result = checkDepot(root);
    assert.deepEqual(result.problems.map((p) => p.file), ['community/trains/broken.json', 'community/trains/notes.txt', 'community/trains/old']);
    assert.match(result.problems[0].problems[0], /author: required/);
    assert.equal(result.files, 4);
    // Trains first, then skylines, each by name.
    assert.deepEqual(result.entries.map((e) => `${e.kind}:${e.id}`), ['train:nyc-subway', 'skyline:zz-top', 'skyline:mexico-city']);
    const text = formatProblems(result.problems);
    assert.match(text, /^community\/trains\/broken\.json has 1 problem\(s\):\n- author: required/);
    const annotated = formatProblems(result.problems, { annotate: true });
    assert.match(annotated, /^::error file=community\/trains\/broken\.json::community\/trains\/broken\.json has 1 problem\(s\):%0A- author/);
    assert.equal(JSON.parse(indexJson(result.entries)).length, 3);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('previews: PNGs for each changed file, a sheet, the calendar SVG and a report', () => {
  const root = depot({
    'trains/nyc-subway.json': NYC,
    'skylines/mexico-city.json': MEXICO,
    'skylines/broken.json': { name: 'Broken' },
  });
  const out = join(root, 'out');
  try {
    const report = preview(['community/trains/nyc-subway.json', 'community/skylines/mexico-city.json', 'community/skylines/broken.json', 'community/README.md'], out, root);
    const files = readdirSync(out).sort();
    for (const name of [
      'community-preview.png', 'report.json',
      'train-nyc-subway-light.png', 'train-nyc-subway-dark.png',
      'train-nyc-subway-mini-light.png', 'train-nyc-subway-calendar-dark.svg',
      'skyline-mexico-city-light.png', 'skyline-mexico-city-dark.png',
    ]) assert.ok(files.includes(name), `${name} in ${files.join(', ')}`);
    assert.ok(!files.some((f) => f.startsWith('skyline-mexico-city-mini')), 'skylines have no mini train');
    const png = readFileSync(join(out, 'community-preview.png'));
    assert.deepEqual([...png.subarray(1, 4)], [...Buffer.from('PNG')]);
    assert.ok(readFileSync(join(out, 'train-nyc-subway-calendar-dark.svg'), 'utf8').startsWith('<svg'));
    assert.deepEqual(report.changed, ['community/trains/nyc-subway.json', 'community/skylines/mexico-city.json', 'community/skylines/broken.json']);
    assert.deepEqual(report.skipped, ['community/skylines/broken.json']);
    assert.equal(report.previews.length, 2);

    const md = reportMarkdown(report, { sheet: 'https://example.com/sheet', zip: 'https://example.com/zip', site: 'https://cracksmity.github.io/git-trains/', readme: 'https://example.com/rules' });
    assert.ok(md.startsWith(MARKER));
    assert.match(md, /problem/);
    assert.match(md, /\*\*\[community-preview\.png\]\(https:\/\/example\.com\/sheet\)\*\*/);
    assert.match(md, /\[Open in the studio\]\(https:\/\/cracksmity\.github\.io\/git-trains\/studio\/#train=/);
    assert.match(md, /\[Cracksmity\]\(https:\/\/github\.com\/Cracksmity\)/);
    assert.ok(!/@Cracksmity/.test(md), 'no @mentions');
    assert.match(md, /Not drawn because of the problems above: `community\/skylines\/broken\.json`/);
    assert.match(md, /one train or skyline per pull request, so each one/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the report when nothing changed and nothing is wrong', () => {
  const md = reportMarkdown({ files: 6, problems: [], changed: [], previews: [], skipped: [], sheet: null, sample: {} }, { readme: 'x' });
  assert.match(md, /All 6 files in the depot pass the checks/);
  assert.match(md, /nothing to preview/);
});
