import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { idleWatch, runAgent } from '../../tools/conductor/agent.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const node = (script) => ({ bin: process.execPath, args: ['-e', script], stdin: null });

test('the idle watchdog fires once, a grace period after the idle line, even when it arrives split', async () => {
  let fired = 0;
  const watch = idleWatch({ graceMs: 20, onIdle: () => fired++ });
  watch.feed('working on it\nroot agent idle; wai');
  watch.feed(Buffer.from('ting for 2 background task(s) to finish\n'));
  assert.equal(fired, 0, 'not before the grace period');
  await wait(60);
  watch.feed('root agent idle; waiting for 1 background task(s) to finish\n');
  await wait(60);
  assert.equal(fired, 1);

  let quiet = 0;
  const other = idleWatch({ graceMs: 20, onIdle: () => quiet++ });
  other.feed('the root agent is thinking\n');
  const stopped = idleWatch({ graceMs: 20, onIdle: () => quiet++ });
  stopped.feed('root agent idle; waiting for 3 background task(s) to finish');
  stopped.stop();
  await wait(60);
  assert.equal(quiet, 0, 'other text and a stopped watch never fire');
});

test('an agent stuck waiting on background tasks is stopped and reported idle; a normal one is not', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'conductor-agent-'));
  try {
    const stuck = node("process.stderr.write('root agent idle; waiting for 2 background task(s) to finish\\n'); setInterval(() => {}, 1000)");
    const started = Date.now();
    const res = await runAgent(stuck, dir, 1, join(dir, 'stuck.log'), { graceMs: 50 });
    assert.equal(res.idle, true);
    assert.ok(Date.now() - started < 20_000, 'stopped long before the time limit');
    assert.match(readFileSync(join(dir, 'stuck.log'), 'utf8'), /root agent idle/);

    const done = await runAgent(node("process.stdout.write('{\"ok\":true}')"), dir, 1, join(dir, 'done.log'), { graceMs: 50 });
    assert.equal(done.code, 0);
    assert.equal(done.idle, undefined);
    assert.equal(done.stdout, '{"ok":true}');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
