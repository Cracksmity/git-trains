import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BACKENDS } from '../bin/backends.js';

test('the design hook only allows reads of staged task and photo files', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'git-trains-hook-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, 'work');
  mkdirSync(dir);
  const spec = BACKENDS.gemini.build({ prompt: 'Design a train.', model: '' });
  for (const [name, value] of Object.entries(spec.files)) {
    const file = join(dir, name);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, value);
  }
  writeFileSync(join(dir, 'photo-1.png'), 'photo fixture');
  writeFileSync(join(root, 'private.txt'), 'outside fixture');
  const hooks = JSON.parse(spec.files['.agents/hooks.json'])['git-trains-design'].PreToolUse;
  assert.equal(hooks[0].matcher, '*');
  const command = hooks[0].hooks[0].command.split(' ');
  assert.equal(command[0], 'node');
  const run = (input) => {
    // Antigravity executes workspace hooks from the .agents directory.
    const result = spawnSync(process.execPath, command.slice(1), { cwd: join(dir, '.agents'), input: typeof input === 'string' ? input : JSON.stringify(input), encoding: 'utf8', timeout: 5000, windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout).decision;
  };
  for (const name of ['task.md', 'photo-1.png']) {
    assert.equal(run({ toolCall: { name: 'view_file', args: { AbsolutePath: realpathSync(join(dir, name)) } } }), 'allow');
  }
  assert.equal(run({ toolCall: { name: 'view_file', args: { AbsolutePath: join(root, 'private.txt') } } }), 'deny');
  for (const name of ['run_command', 'write_to_file', 'replace_file_content', 'invoke_subagent', 'search_web', 'unknown_tool']) {
    assert.equal(run({ toolCall: { name, args: { CommandLine: 'echo fixture' } } }), 'deny', name);
  }
  for (const input of ['{broken', {}, { toolCall: { name: 'view_file', args: {} } }]) assert.equal(run(input), 'deny');
  try { symlinkSync(join(root, 'private.txt'), join(dir, 'photo-2.png')); }
  catch (err) { if (err.code === 'EPERM') { t.diagnostic('Symlink checks need permission to create symlinks on Windows.'); return; } throw err; }
  assert.equal(run({ toolCall: { name: 'view_file', args: { AbsolutePath: join(dir, 'photo-2.png') } } }), 'deny');
});
