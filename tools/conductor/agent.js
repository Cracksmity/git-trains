// Runs one agent CLI in its worktree, with a time limit and an idle watchdog.
//
// Headless Antigravity turns any command still running after a few seconds into
// a background task, and once its own turn is over it prints "root agent idle;
// waiting for N background task(s) to finish" and waits for them before exiting.
// A check that never finishes inside its sandbox (scripts/checks/docs.js did,
// twice) then holds a finished run until the time limit. The watchdog stops the
// agent a short grace period after that line, and the conductor runs the gates
// on whatever is in the worktree, as it would after a normal exit.
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';

export const IDLE_LINE = /root agent idle; waiting for \d+ background task/;
export const IDLE_GRACE_MS = 120_000;

/**
 * Watches an agent's output for the idle line, which may arrive split across chunks.
 * @param {{ graceMs?: number, onIdle: () => void }} options
 */
export function idleWatch({ graceMs = IDLE_GRACE_MS, onIdle }) {
  let tail = '';
  let timer = null;
  return {
    /** @param {string | Buffer} chunk */
    feed(chunk) {
      if (timer) return;
      tail = (tail + String(chunk)).slice(-400);
      if (IDLE_LINE.test(tail)) timer = setTimeout(onIdle, graceMs);
    },
    stop() {
      clearTimeout(timer);
    },
  };
}

/**
 * @param {{ bin: string, args: string[], env?: Record<string, string>, stdin: string | null }} cmd
 * @param {string} cwd
 * @param {number} timeoutMin
 * @param {string} logFile
 * @param {{ graceMs?: number }} [options]
 * @returns {Promise<{ code: number | null, stdout: string, seconds: number, error?: string, idle?: boolean }>}
 *   `idle` is true when the watchdog stopped an agent that had finished its turn.
 */
export function runAgent(cmd, cwd, timeoutMin, logFile, { graceMs } = {}) {
  return new Promise((done) => {
    const started = Date.now();
    const child = spawn(cmd.bin, cmd.args, { cwd, windowsHide: true, env: { ...process.env, ...cmd.env } });
    let stdout = '';
    let idle = false;
    const watch = idleWatch({ graceMs, onIdle: () => { idle = true; child.kill(); } });
    const log = (chunk) => appendFileSync(logFile, chunk);
    child.stdout.on('data', (c) => { stdout += c; log(c); watch.feed(c); });
    child.stderr.on('data', (c) => { log(c); watch.feed(c); });
    const timer = setTimeout(() => child.kill(), timeoutMin * 60_000);
    child.on('error', (err) => {
      clearTimeout(timer);
      watch.stop();
      done({ code: -1, stdout, seconds: (Date.now() - started) / 1000, error: err.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      watch.stop();
      done({ code, stdout, seconds: (Date.now() - started) / 1000, ...(idle ? { idle } : {}) });
    });
    if (cmd.stdin !== null) child.stdin.end(cmd.stdin);
    else child.stdin.end();
  });
}
