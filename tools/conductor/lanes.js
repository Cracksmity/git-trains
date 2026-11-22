#!/usr/bin/env node
// Lanes run several conductor chains at the same time. Each lane is a git worktree on
// its own branch, all cut from the same base. Inside a lane the tasks run one after
// another, and each task that passes its gates is committed before the next starts,
// so it builds on the last. Lanes never share files while they work: their results
// meet only when you merge the branches, once, at the end.
//
//   node tools/conductor/lanes.js <plan.json> [--dry-run] [--keep] [--trailer <line>]
//
// The plan (see lanes-plan.js) names the lanes and their tasks; give the tasks of one
// lane to one agent so the lanes don't share a rate limit. The base is HEAD, or a
// snapshot of the working tree when it has uncommitted changes. Lane worktrees live in
// .conductor/lanes/<plan>/, inside the checkout so the lint and typecheck checks find
// node_modules; the logs, patches and runs.jsonl lines go to the usual .conductor/.
// --dry-run only shows which agent each task would start. --keep leaves the lane
// worktrees in place. --trailer adds a line (such as Co-Authored-By) to each commit.

import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { agentOf, laneBranch, readPlan, summaryTable } from './lanes-plan.js';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const STATE = join(ROOT, '.conductor');

// Git's warnings (line endings, for one) stay out of the lanes' output.
const git = (args, cwd = ROOT, opts = {}) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28, stdio: 'pipe', ...opts }).trim();

// HEAD when the checkout is clean; otherwise a commit of the working tree as it is,
// built with a throwaway index, as the conductor does for a single task.
function baseCommit() {
  if (!git(['status', '--porcelain'])) return { base: git(['rev-parse', 'HEAD']), snapshot: false };
  const index = join(STATE, `lanes-index-${process.pid}`);
  const env = { ...process.env, GIT_INDEX_FILE: index };
  try {
    git(['read-tree', 'HEAD'], ROOT, { env });
    git(['add', '-A'], ROOT, { env });
    const tree = git(['write-tree'], ROOT, { env });
    return { base: git(['commit-tree', tree, '-p', 'HEAD', '-m', 'lanes snapshot (uncommitted changes)']), snapshot: true };
  } finally {
    rmSync(index, { force: true });
  }
}

// Runs a command, copying its output line by line to the console with a prefix and
// to a log file. Resolves with the exit code and everything it printed.
function runLogged(bin, args, { cwd, env, shell = false }, logFile, prefix) {
  return new Promise((done) => {
    const child = spawn(bin, args, { cwd, env, shell, windowsHide: true });
    let output = '';
    let pending = '';
    const take = (chunk) => {
      const text = chunk.toString();
      output += text;
      appendFileSync(logFile, text);
      const lines = (pending + text).split(/\r?\n/);
      pending = lines.pop() ?? '';
      for (const line of lines) console.log(`${prefix}${line}`);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', (error) => {
      output += `\n${error.message}`;
      done({ code: -1, output });
    });
    child.on('close', (code) => {
      if (pending) console.log(`${prefix}${pending}`);
      done({ code: code ?? -1, output });
    });
  });
}

// A task's path inside the repository, or null for a task file kept elsewhere.
function repoPath(planFile, task) {
  const rel = relative(ROOT, resolve(dirname(planFile), task));
  return rel.startsWith('..') || isAbsolute(rel) ? null : rel.replaceAll('\\', '/');
}

// The task file as the lane sees it: its own copy when the task lives in the repository.
function taskInLane(planFile, task, dir) {
  const rel = repoPath(planFile, task);
  return rel ? join(dir, rel) : resolve(dirname(planFile), task);
}

async function runLane(plan, lane, ctx) {
  const prefix = `[${lane.name}] `;
  const rows = [];
  let stopped = '';
  for (const task of lane.tasks) {
    const name = basename(task, '.json');
    if (stopped) {
      rows.push({ lane: lane.name, task: name, status: 'skipped', note: `after ${stopped} failed` });
      continue;
    }
    const dir = ctx.dirs[lane.name];
    const file = taskInLane(ctx.planFile, task, dir);
    if (!existsSync(file)) {
      rows.push({ lane: lane.name, task: name, status: 'failed', note: 'task file missing from the base' });
      if (lane.onFailure === 'stop') stopped = name;
      continue;
    }
    const logFile = join(ctx.logs, `${lane.name}-${name}.log`);
    writeFileSync(logFile, '');
    const started = Date.now();
    console.log(`${prefix}${name}: starting`);
    const conductor = join(dir, 'tools', 'conductor', 'conductor.js');
    const res = await runLogged(process.execPath, [conductor, 'run', file, ctx.dry ? '--dry-run' : '--apply'], { cwd: dir, env: { ...process.env, CONDUCTOR_STATE: STATE } }, logFile, prefix);
    const { agent, attempts } = agentOf(res.output);
    /** @type {import('./lanes-plan.js').TaskResult} */
    const row = { lane: lane.name, task: name, agent, attempts, minutes: +((Date.now() - started) / 60000).toFixed(1), status: res.code === 0 ? 'passed' : 'failed' };
    if (ctx.dry && res.code === 0) row.status = 'dry run';
    else if (res.code === 0) {
      row.checks = {};
      for (const check of plan.checks) row.checks[check] = (await runLogged(check, [], { cwd: dir, env: process.env, shell: true }, logFile, `${prefix}${check}: `)).code === 0;
      try {
        git(['add', '-A'], dir);
        if (git(['diff', '--cached', '--name-only'], dir)) {
          // Only a path inside the repository goes in the message, never a local folder.
          const body = `Applied as it passed its gates (${repoPath(ctx.planFile, task) ?? basename(task)}), in lane ${lane.name} of the ${plan.name} plan.`;
          const message = [`conductor: ${name} by ${agent}`, '', body, ...(ctx.trailer ? ['', ctx.trailer] : [])].join('\n');
          git(['-c', 'gc.auto=0', 'commit', '-q', '-m', message], dir);
          row.commit = git(['rev-parse', '--short', 'HEAD'], dir);
        } else row.note = 'no changes';
      } catch (error) {
        // The patch is still in .conductor/<task>.patch; the lane can't build on it.
        Object.assign(row, { status: 'failed', note: `commit failed: ${String(error.message).split('\n')[0]}` });
      }
    }
    if (row.status === 'failed' && lane.onFailure === 'stop') stopped = name;
    console.log(`${prefix}${name}: ${row.status} in ${row.minutes} min${row.commit ? `, committed ${row.commit}` : ''}`);
    rows.push(row);
  }
  return rows;
}

function parseArgs(argv) {
  const flags = { dry: false, keep: false, trailer: '' };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') flags.dry = true;
    else if (argv[i] === '--keep') flags.keep = true;
    else if (argv[i] === '--trailer') flags.trailer = argv[++i] ?? '';
    else rest.push(argv[i]);
  }
  return { flags, rest };
}

async function main() {
  const { flags, rest } = parseArgs(process.argv.slice(2));
  if (!rest[0]) {
    console.log('Usage: node tools/conductor/lanes.js <plan.json> [--dry-run] [--keep] [--trailer <line>]');
    return;
  }
  const planFile = resolve(rest[0]);
  const plan = readPlan(readFileSync(planFile, 'utf8'));
  const home = join(STATE, 'lanes', plan.name);
  const dirs = Object.fromEntries(plan.lanes.map((lane) => [lane.name, join(home, lane.name)]));
  const taken = plan.lanes.flatMap((lane) => {
    const branch = laneBranch(plan.name, lane.name);
    const out = [];
    if (existsSync(dirs[lane.name])) out.push(`git worktree remove --force "${dirs[lane.name]}"`);
    try {
      git(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]);
      out.push(`git branch -D ${branch}`);
    } catch {}
    return out;
  });
  if (taken.length) throw new Error(`A previous run of the "${plan.name}" plan is still here. Merge or keep what you need, then:\n${taken.map((c) => `  ${c}`).join('\n')}`);

  mkdirSync(home, { recursive: true });
  const { base, snapshot } = baseCommit();
  console.log(`Lanes for "${plan.name}" from ${base.slice(0, 10)}${snapshot ? ' (a snapshot with your uncommitted changes)' : ' (HEAD)'}`);
  for (const lane of plan.lanes) git(['worktree', 'add', '-q', '-b', laneBranch(plan.name, lane.name), dirs[lane.name], base]);

  const started = new Date();
  const results = await Promise.all(plan.lanes.map((lane) => runLane(plan, lane, { planFile, dirs, logs: home, dry: flags.dry, trailer: flags.trailer })));
  const rows = results.flat();
  const table = summaryTable(rows, plan.checks);
  const branches = plan.lanes.map((lane) => {
    const branch = laneBranch(plan.name, lane.name);
    return `- \`${branch}\`: ${git(['rev-list', '--count', `${base}..${branch}`])} commit(s)`;
  });
  const report = [`# Lanes: ${plan.name}`, '', `Started ${started.toISOString()}, base ${base}${snapshot ? ' (snapshot)' : ''}.`, '', table, '', '## Branches', '', ...branches, '',
    'Merge them into your branch one at a time (`git merge --no-ff <branch>`) and resolve the conflicts once.', ''].join('\n');
  writeFileSync(join(home, 'summary.md'), report);
  console.log(`\n${table}\n\n${branches.join('\n')}\nSummary: ${join(home, 'summary.md')}`);

  for (const lane of plan.lanes) {
    const dir = dirs[lane.name];
    if (flags.keep) continue;
    if (git(['status', '--porcelain'], dir)) {
      console.log(`[${lane.name}] has uncommitted changes, kept at ${dir}`);
      continue;
    }
    git(['worktree', 'remove', '--force', dir]);
    // A lane that committed nothing leaves no branch to merge (a dry run, say).
    const branch = laneBranch(plan.name, lane.name);
    if (git(['rev-list', '--count', `${base}..${branch}`]) === '0') git(['branch', '-D', branch]);
  }
  if (rows.some((r) => r.status === 'failed')) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
