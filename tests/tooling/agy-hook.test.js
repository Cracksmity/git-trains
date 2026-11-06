import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decide } from '../../tools/conductor/agy-hook.js';

const routes = JSON.parse(readFileSync(new URL('../../tools/conductor/routes.json', import.meta.url), 'utf8'));
const allowed = routes.backends.gemini.commands;
const verdict = (line) => decide(line, allowed).decision;

test('the Antigravity hook allows the listed commands with any arguments', () => {
  for (const line of ['node --version', 'node.exe --test', 'npm test', 'git status --short', 'git log -3', 'dir', 'Get-ChildItem examples/trains', 'GET-CONTENT package.json']) {
    assert.equal(verdict(line), 'allow', line);
  }
});

test('the Antigravity hook refuses other commands and chained ones', () => {
  for (const line of ['npm install left-pad', 'git push', 'git commit -m x', 'nodejs x', 'rm -rf smoke', 'node -e "1"; rm -rf x', 'cat package.json | head', 'type a > b', 'node $(whoami)', 'node `whoami`', 'node -e "unclosed', 'powershell -Command "dir"']) {
    const d = decide(line, allowed);
    assert.equal(d.decision, 'deny', line);
    assert.match(d.reason, /Not run/);
  }
});

test('operators inside quotes are fine, so the gates of every task can run', () => {
  const dir = new URL('../../tools/conductor/tasks/', import.meta.url);
  for (const name of ['gemini-smoke.json', 'regions-research.json', 'guides-en.json']) {
    for (const gate of JSON.parse(readFileSync(new URL(name, dir), 'utf8')).gates) assert.equal(verdict(gate), 'allow', gate);
  }
});
