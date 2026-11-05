#!/usr/bin/env node
// The conductor hands a task to another coding agent (Codex or Antigravity),
// checks the result with gates, feeds failures back, and climbs to a stronger
// model when a rung of the ladder keeps failing (see routes.json).
//
// Every run works in its own git worktree outside the repository, cut from a
// snapshot of the current working tree (uncommitted changes included), so the
// agent never touches your checkout. What comes back is a patch: review it,
// then apply it with --apply or `git apply --3way`.
//
//   node tools/conductor/conductor.js run <task.json> [--apply] [--keep] [--route <name>] [--dry-run]
//   node tools/conductor/conductor.js routes
//   node tools/conductor/conductor.js log [n]

import { spawn, execFileSync, execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const STATE = join(ROOT, '.conductor');
const ROUTES = JSON.parse(readFileSync(join(HERE, 'routes.json'), 'utf8'));

const git = (args, opts = {}) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, ...opts });

// --- Snapshot and worktree --------------------------------------------------

// A commit with the working tree as it is right now (tracked changes and new
// files, minus ignored ones), built with a throwaway index so HEAD, the index
// and the working tree stay untouched.
function snapshot() {
  const index = join(STATE, `index-${process.pid}`);
  const env = { ...process.env, GIT_INDEX_FILE: index };
  try {
    git(['read-tree', 'HEAD'], { env });
    git(['add', '-A'], { env });
    const tree = git(['write-tree'], { env }).trim();
    return git(['commit-tree', tree, '-p', 'HEAD', '-m', 'conductor snapshot']).trim();
  } finally {
    rmSync(index, { force: true });
  }
}

function makeWorktree(name, base) {
  const dir = join(tmpdir(), 'git-trains-conductor', `${name}-${Date.now().toString(36)}`);
  mkdirSync(dirname(dir), { recursive: true });
  git(['worktree', 'add', '--detach', dir, base]);
  return dir;
}

function dropWorktree(dir) {
  try {
    git(['worktree', 'remove', '--force', dir]);
  } catch {
    rmSync(dir, { recursive: true, force: true });
    git(['worktree', 'prune']);
  }
}

// --- Agents -----------------------------------------------------------------

function fill(arg, vars) {
  return arg.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

// Session settings for agy. Each gate is also granted as an exact command:
// exact grants are the only kind headless agy matches outside its sandbox, so
// the gates still run if the terminal sandbox is unavailable.
function settingsFor(be, gates) {
  if (!be.settings) return '';
  const settings = structuredClone(be.settings);
  if (settings.permissions?.allow) settings.permissions.allow.push(...gates.map((g) => `command(${g})`));
  return JSON.stringify(settings);
}

function buildCommand(rung, vars) {
  const be = ROUTES.backends[rung.backend];
  if (!be) throw new Error(`Unknown backend "${rung.backend}"`);
  const args = [];
  vars = { ...vars, settings: settingsFor(be, vars.gates) };
  for (const a of be.args) {
    if (a === '{images}') {
      for (const image of vars.images) args.push(...be.image.map((x) => fill(x, { image })));
    } else args.push(fill(a, vars));
  }
  return {
    bin: be.bin,
    args,
    stdin: be.stdin === 'prompt' ? vars.prompt : null,
    usage: be.usage,
    hook: be.hook ? join(HERE, be.hook) : null,
    env: be.commands ? { CONDUCTOR_AGY_COMMANDS: JSON.stringify(be.commands) } : {},
  };
}

// Antigravity reads hooks from <workspace>/.agents/hooks.json. The conductor's
// hook (the command allowlist, see agy-hook.js) sits there only while the agent
// runs, so it never reaches the gates or the patch. The hook command runs from
// .agents/ without a shell, hence the relative path with no quotes. Returns a
// function that removes it again and reports whether the agent touched it.
function installHook(dir, hook) {
  if (!hook) return () => [];
  const file = join(dir, '.agents', 'hooks.json');
  const script = relative(ROOT, hook).replaceAll('\\', '/');
  const scriptFile = join(dir, script);
  const before = existsSync(file) ? readFileSync(file, 'utf8') : null;
  const scriptBefore = readFileSync(scriptFile, 'utf8');
  const mine = JSON.stringify(
    {
      ...(before ? JSON.parse(before) : {}),
      'git-trains-conductor': {
        PreToolUse: [{ matcher: 'run_command', hooks: [{ type: 'command', command: `node ../${script}`, timeout: 10 }] }],
      },
    },
    null,
    2,
  );
  const created = !existsSync(dirname(file));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, mine);
  return () => {
    const tampered =
      (existsSync(file) ? readFileSync(file, 'utf8') : null) !== mine ||
      (existsSync(scriptFile) ? readFileSync(scriptFile, 'utf8') : null) !== scriptBefore;
    mkdirSync(dirname(scriptFile), { recursive: true });
    writeFileSync(scriptFile, scriptBefore);
    if (before !== null) writeFileSync(file, before);
    else {
      rmSync(file, { force: true });
      if (created) try { rmdirSync(dirname(file)); } catch {} // only if the agent left nothing else there
    }
    return tampered ? [`The agent changed the conductor's hook (.agents/hooks.json or ${script}); both were restored.`] : [];
  };
}

// Token counts, normalized: { input, output, reasoning }.
function readUsage(kind, stdout) {
  const u = { input: 0, output: 0, reasoning: 0 };
  if (kind === 'codex') {
    for (const line of stdout.split('\n')) {
      if (!line.startsWith('{')) continue;
      try {
        const ev = JSON.parse(line);
        if (ev.type === 'turn.completed' && ev.usage) {
          u.input += ev.usage.input_tokens ?? 0;
          u.output += ev.usage.output_tokens ?? 0;
          u.reasoning += ev.usage.reasoning_output_tokens ?? 0;
        }
      } catch {}
    }
  } else if (kind === 'agy') {
    try {
      const res = JSON.parse(stdout.slice(stdout.indexOf('{')));
      u.input = res.usage?.input_tokens ?? 0;
      u.output = res.usage?.output_tokens ?? 0;
      u.reasoning = res.usage?.thinking_tokens ?? 0;
    } catch {}
  }
  return u;
}

// Actions a headless agent wanted but was not allowed to take (Antigravity reports them).
function deniedActions(kind, stdout) {
  if (kind !== 'agy') return [];
  try {
    const res = JSON.parse(stdout.slice(stdout.indexOf('{')));
    return (res.denied_actions ?? []).map((d) => d.display_name ?? d.action);
  } catch {
    return [];
  }
}

function runAgent(cmd, cwd, timeoutMin, logFile) {
  return new Promise((done) => {
    const started = Date.now();
    const child = spawn(cmd.bin, cmd.args, { cwd, windowsHide: true, env: { ...process.env, ...cmd.env } });
    let stdout = '';
    const log = (chunk) => appendFileSync(logFile, chunk);
    child.stdout.on('data', (c) => { stdout += c; log(c); });
    child.stderr.on('data', log);
    const timer = setTimeout(() => child.kill(), timeoutMin * 60_000);
    child.on('error', (err) => {
      clearTimeout(timer);
      done({ code: -1, stdout, seconds: (Date.now() - started) / 1000, error: err.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      done({ code, stdout, seconds: (Date.now() - started) / 1000 });
    });
    if (cmd.stdin !== null) child.stdin.end(cmd.stdin);
    else child.stdin.end();
  });
}

// --- Gates ------------------------------------------------------------------

const globRe = (g) =>
  new RegExp(
    '^' +
      g
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*\/?/g, '\u0000')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
        .replace(/\u0000/g, '.*') +
      '$',
  );

function changedPaths(dir) {
  const out = execFileSync('git', ['status', '--porcelain=v1', '-uall', '-z'], { cwd: dir, encoding: 'utf8' });
  return out.split('\0').filter(Boolean).map((l) => l.slice(3));
}

function runGates(task, dir) {
  const failures = [];
  const paths = changedPaths(dir);
  if (!paths.length) failures.push('No files were changed.');
  if (task.allow?.length) {
    const res = task.allow.map(globRe);
    const outside = paths.filter((p) => !res.some((r) => r.test(p)));
    if (outside.length) failures.push(`Changed files outside the allowed paths (${task.allow.join(', ')}):\n${outside.join('\n')}`);
  }
  for (const gate of task.gates ?? []) {
    try {
      execSync(gate, { cwd: dir, encoding: 'utf8', stdio: 'pipe', timeout: 10 * 60_000, maxBuffer: 1 << 26 });
    } catch (err) {
      const out = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim();
      failures.push(`$ ${gate}\n${out.length > 6000 ? '...' + out.slice(-6000) : out}`);
    }
  }
  return failures;
}

// --- Run --------------------------------------------------------------------

const HOUSE_RULES = (task) =>
  [
    'You are working in a git worktree of git-trains, a dependency-free Node GitHub Action that draws pixel-art trains as animated SVG.',
    'Do only the task below. Do not commit, do not create branches, do not touch files outside the allowed paths.',
    task.allow?.length ? `Allowed paths: ${task.allow.join(', ')}` : '',
    task.gates?.length ? `When you finish, these checks run in this folder and must pass:\n${task.gates.map((g) => `  ${g}`).join('\n')}\nRun them yourself before you stop.` : '',
    'Finish with a summary of at most three lines.',
  ]
    .filter(Boolean)
    .join('\n');

const RETRY = (failures) =>
  `Your previous attempt in this same folder failed these checks. Fix every problem and keep the rest of your work.\n\n${failures.join('\n\n')}`;

function loadTask(file) {
  const path = resolve(file);
  const task = JSON.parse(readFileSync(path, 'utf8'));
  if (task.promptFile) task.prompt = readFileSync(resolve(dirname(path), task.promptFile), 'utf8');
  if (!task.name || !task.prompt) throw new Error('A task needs "name" and "prompt" (or "promptFile")');
  task.images = (task.images ?? []).map((p) => resolve(dirname(path), p));
  return task;
}

async function run(file, flags) {
  const task = loadTask(file);
  const routeName = flags.route ?? task.route ?? 'mechanical';
  const route = ROUTES.routes[routeName];
  if (!route) throw new Error(`Unknown route "${routeName}" (${Object.keys(ROUTES.routes).join(', ')})`);
  const attempts = task.attempts ?? 2;
  const ladder = task.ladder ?? route.ladder;

  mkdirSync(STATE, { recursive: true });
  const base = snapshot();
  const dir = makeWorktree(task.name, base);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  console.log(`[${task.name}] route ${routeName}, worktree ${dir}`);

  let failures = null;
  let passed = false;
  try {
    for (const [r, rung] of ladder.entries()) {
      for (let attempt = 1; attempt <= attempts && !passed; attempt++) {
        // Each backend may add its own rules (Antigravity's headless mode, for one).
        const backendRules = ROUTES.backends[rung.backend]?.rules;
        const prompt =
          `${HOUSE_RULES(task)}${backendRules ? `\n${backendRules}` : ''}\n\n## Task\n\n${task.prompt}` +
          `${failures ? `\n\n## Previous attempt\n\n${RETRY(failures)}` : ''}`;
        const cmd = buildCommand(rung, { model: rung.model, effort: rung.effort ?? 'high', dir, prompt, images: task.images, gates: task.gates ?? [] });
        const label = `${rung.backend}/${rung.model}${rung.effort ? ` (${rung.effort})` : ''}`;
        if (flags['dry-run']) {
          console.log(`[${task.name}] would run ${label}: ${cmd.bin} ${cmd.args.map((a) => (a === prompt ? '<prompt>' : a)).join(' ')}`);
          passed = true;
          break;
        }
        console.log(`[${task.name}] rung ${r + 1}/${ladder.length}, attempt ${attempt}/${attempts}: ${label}`);
        const logFile = join(STATE, `${stamp}-${task.name}-${r + 1}.${attempt}.log`);
        const removeHook = installHook(dir, cmd.hook);
        const res = await runAgent(cmd, dir, task.timeoutMin ?? 30, logFile);
        const tampered = removeHook();
        failures = res.code === 0 ? runGates(task, dir) : [`The agent exited with code ${res.code}${res.error ? `: ${res.error}` : ''} (log: ${logFile})`];
        failures.push(...tampered);
        const denied = deniedActions(cmd.usage, res.stdout);
        if (denied.length && failures.length) failures.push(`The agent was denied these actions: ${denied.join(', ')} (see ${logFile})`);
        passed = failures.length === 0;
        const usage = readUsage(cmd.usage, res.stdout);
        appendFileSync(
          join(STATE, 'runs.jsonl'),
          JSON.stringify({
            at: new Date().toISOString(), task: task.name, route: routeName, rung: r + 1, attempt,
            backend: rung.backend, model: rung.model, effort: rung.effort ?? null,
            seconds: Math.round(res.seconds), usage, passed, failures: failures.map((f) => f.split('\n')[0]),
          }) + '\n',
        );
        console.log(
          `[${task.name}]   ${passed ? 'passed' : `failed ${failures.length} check(s)`} in ${Math.round(res.seconds)} s, ` +
            `${usage.output} output / ${usage.reasoning} reasoning tokens`,
        );
        if (!passed) for (const f of failures) console.log(`    - ${f.split('\n')[0]}`);
      }
      if (passed) break;
    }

    if (!passed) {
      console.log(`[${task.name}] every rung failed. Worktree kept for inspection: ${dir}`);
      flags.keep = true;
      process.exitCode = 1;
      return;
    }
    if (flags['dry-run']) return;

    execFileSync('git', ['add', '-A'], { cwd: dir });
    const patch = execFileSync('git', ['diff', '--cached', '--binary', '-M', base], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 28 });
    const patchFile = join(STATE, `${task.name}.patch`);
    writeFileSync(patchFile, patch);
    const stat = execFileSync('git', ['diff', '--cached', '--stat', '-M', base], { cwd: dir, encoding: 'utf8' });
    console.log(`[${task.name}] patch: ${patchFile}\n${stat}`);
    if (flags.apply) {
      // Plain apply works when the touched files haven't changed since the
      // snapshot; --3way can merge when they have, but it needs them staged.
      try {
        git(['apply', '--whitespace=nowarn', patchFile], { stdio: 'pipe' });
      } catch {
        git(['apply', '--3way', '--whitespace=nowarn', patchFile]);
      }
      console.log(`[${task.name}] applied to ${ROOT}`);
    }
  } finally {
    if (!flags.keep) dropWorktree(dir);
  }
}

// --- CLI --------------------------------------------------------------------

function parseFlags(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--route') flags.route = argv[++i];
    else if (a.startsWith('--')) flags[a.slice(2)] = true;
    else rest.push(a);
  }
  return { flags, rest };
}

const [cmd, ...argv] = process.argv.slice(2);
const { flags, rest } = parseFlags(argv);

if (cmd === 'run' && rest[0]) {
  run(rest[0], flags).catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
} else if (cmd === 'routes') {
  for (const [name, r] of Object.entries(ROUTES.routes)) {
    console.log(`${name}: ${r.about}`);
    for (const rung of r.ladder) console.log(`  ${rung.backend}/${rung.model}${rung.effort ? ` (${rung.effort})` : ''}: ${rung.why}`);
  }
} else if (cmd === 'log') {
  const file = join(STATE, 'runs.jsonl');
  const lines = existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean) : [];
  for (const l of lines.slice(-(Number(rest[0]) || 20))) {
    const r = JSON.parse(l);
    console.log(`${r.at.slice(0, 16)} ${r.task} ${r.model} #${r.attempt} ${r.passed ? 'PASS' : 'FAIL'} ${r.seconds}s out ${r.usage.output} reason ${r.usage.reasoning}`);
  }
} else {
  console.log('Usage:\n  conductor.js run <task.json> [--apply] [--keep] [--route <name>] [--dry-run]\n  conductor.js routes\n  conductor.js log [n]');
}
