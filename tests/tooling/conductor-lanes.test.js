import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { agentOf, laneBranch, readPlan, summaryTable } from '../../tools/conductor/lanes-plan.js';

const plan = (lanes, extra = {}) => JSON.stringify({ name: 'weather', lanes, ...extra });

test('a plan lists lanes of tasks; a lane stops at its first failure unless told to go on', () => {
  const read = readPlan(plan([{ name: 'astra', tasks: ['a.json', 'b.json'] }, { name: 'neon', tasks: ['c.json'], onFailure: 'continue' }], { checks: ['npm run lint'] }));
  assert.deepEqual(read, {
    name: 'weather',
    lanes: [
      { name: 'astra', tasks: ['a.json', 'b.json'], onFailure: 'stop' },
      { name: 'neon', tasks: ['c.json'], onFailure: 'continue' },
    ],
    checks: ['npm run lint'],
  });
  assert.equal(laneBranch('weather', 'astra'), 'lanes/weather/astra');
});

test('every problem in a plan is reported at once', () => {
  assert.throws(() => readPlan('{'), /not JSON/);
  assert.throws(() => readPlan('[]'), /JSON object/);
  const bad = plan([
    { name: 'Astra Lane', tasks: [] },
    { name: 'neon', tasks: ['a.json', 'notes.md'], onFailure: 'retry' },
    { name: 'neon', tasks: ['a.json'] },
  ], { name: 'Weather!', checks: [''] });
  assert.throws(() => readPlan(bad), (error) => {
    for (const part of [
      /8 problem\(s\)/, /"name" must be a lower-case slug such as/, /lane 1: "name" must be/, /lane 1: "tasks" must list/, /"checks" must be/,
      /lane 2: "notes.md" is not a task file/, /lane 2: "onFailure"/, /lane 3: the name "neon" is used twice/, /lane 3: a\.json is already in lane 2/,
    ]) assert.match(error.message, part);
    return true;
  });
  assert.throws(() => readPlan(plan([{ name: 'a', tasks: ['x.json'] }, { name: 'b', tasks: ['x.json'] }])), /lane 2: x\.json is already in lane 1/);
  assert.throws(() => readPlan(plan(Array.from({ length: 9 }, (_, i) => ({ name: `l${i}`, tasks: [`t${i}.json`] })))), /1 to 8 lanes/);
});

test('the agent and its attempts come from the conductor output', () => {
  const out = [
    '[weather-wind] route design, worktree /tmp/x',
    '[weather-wind] rung 1/1, attempt 1/2: codex/gpt-6.2-astra (xhigh)',
    '[weather-wind]   failed 1 check(s) in 300 s, 9000 output / 0 reasoning tokens',
    '[weather-wind] rung 1/1, attempt 2/2: codex/gpt-6.2-astra (xhigh)\r',
  ].join('\n');
  assert.deepEqual(agentOf(out), { agent: 'codex/gpt-6.2-astra (xhigh)', attempts: 2 });
  assert.deepEqual(agentOf('[weather-snow] would run gemini/gemini-4-neon-xhigh: agy --output-format json'), { agent: 'gemini/gemini-4-neon-xhigh', attempts: 0 });
  assert.deepEqual(agentOf('Unknown route "x"'), { agent: 'unknown', attempts: 0 });
});

test('the summary has one row per task and a column per check', () => {
  const table = summaryTable([
    { lane: 'astra', task: 'weather-wind', status: 'passed', agent: 'codex/a', attempts: 1, minutes: 7.5, checks: { lint: true, types: false }, commit: 'abc1234' },
    { lane: 'astra', task: 'weather-haze', status: 'skipped', note: 'after weather-wind failed' },
  ], ['lint', 'types']);
  assert.equal(table, [
    '| Lane | Task | Agent | Result | Attempts | Minutes | lint | types | Commit |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| astra | weather-wind | codex/a | passed | 1 | 7.5 | ok | FAILED | abc1234 |',
    '| astra | weather-haze | - | skipped (after weather-wind failed) | - | - | - | - | - |',
  ].join('\n'));
});

test('the weather plan splits the pending designs into one lane per agent', () => {
  const file = new URL('../../tools/conductor/tasks/weather-lanes.json', import.meta.url);
  const { lanes } = readPlan(readFileSync(file, 'utf8'));
  const backends = lanes.map((lane) => lane.tasks.map((task) => {
    const path = new URL(task, file);
    assert.ok(existsSync(path), `${task} exists`);
    const { ladder } = JSON.parse(readFileSync(path, 'utf8'));
    return ladder.map((rung) => `${rung.backend}/${rung.model}`).join(',');
  }));
  for (const lane of backends) assert.equal(new Set(lane).size, 1, 'one agent per lane, so the lanes never share a rate limit');
  assert.equal(new Set(backends.map((lane) => lane[0])).size, lanes.length, 'a different agent in each lane');
});
