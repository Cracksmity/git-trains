// The AI coding CLIs that `git-trains design` can drive: Codex, Antigravity (Gemini)
// and Claude Code. Each one runs headless, in an empty temporary folder, with its
// file-writing and command tools off or denied: all we read is its final answer.
//
// Same ground as tools/conductor (routes.json and agy-hook.js), but for end users:
// the conductor edits a worktree and checks it with gates; here the agent edits
// nothing and the check is the validator, so every backend is configured read-only.

import { spawn, spawnSync } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import { delimiter, join } from 'node:path';

// Antigravity reads PreToolUse hooks from <folder>/.agents/hooks.json, even in
// print mode. A denied tool call in headless mode ends the whole turn with an
// empty answer; a *hook* refusal does not: the agent reads the reason and goes on.
// Only reads of the staged task and photos are allowed. Unknown tools, writes,
// commands, web requests and subagents are denied, including malformed calls.
const AGY_HOOK = `// Restricts git-trains design to reading its staged inputs.
const { realpathSync } = require('node:fs');
const { basename, dirname, resolve } = require('node:path');
let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  let allowed = false;
  try {
    const call = JSON.parse(input).toolCall;
    if (call?.name === 'view_file' && typeof call.args?.AbsolutePath === 'string') {
      const base = realpathSync(resolve(__dirname, '..'));
      const file = realpathSync(call.args.AbsolutePath);
      allowed = dirname(file) === base && (basename(file) === 'task.md' || /^photo-[1-9][0-9]*\\.(png|jpg|jpeg|webp|gif)$/.test(basename(file)));
    }
  } catch {}
  process.stdout.write(JSON.stringify(allowed
    ? { decision: 'allow' }
    : { decision: 'deny', reason: 'Only view_file of task.md and the staged photo files is allowed. Do not run commands, edit files, browse the web or delegate; put the complete JSON in your reply.' }));
});
`;

const AGY_HOOKS = JSON.stringify(
  { 'git-trains-design': { PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'node read-inputs.cjs', timeout: 10 }] }] } },
  null,
  2,
);

// photos: 'attached' = passed to the CLI as images; 'files' = copied into the folder
// for the agent to open with its file tool.
export const BACKENDS = {
  codex: {
    label: 'Codex',
    bin: 'codex',
    photos: 'attached',
    // The prompt travels on stdin. -s read-only: the agent can look, not touch.
    // The -i options go before -C so no variadic option sits next to the prompt.
    build: ({ model, dir, photos }) => ({
      args: [
        'exec', '--json', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only',
        ...(model ? ['-m', model] : []),
        ...photos.flatMap((p) => ['-i', p]),
        '-C', dir,
      ],
      stdin: true,
      files: {},
    }),
    read: readCodex,
  },
  gemini: {
    label: 'Antigravity (Gemini)',
    bin: 'agy',
    photos: 'files',
    // `agy -p` takes the prompt as an argument, and the guide is longer than a
    // Windows command line can be, so the task goes in a file the agent opens.
    build: ({ model, prompt }) => ({
      args: [
        '--output-format', 'json',
        ...(model ? ['--model', model] : []),
        '-p', 'Your whole task is in the file task.md in this folder (it also names any photos). Open it, do what it says, and reply with the answer it asks for.',
      ],
      stdin: false,
      files: { 'task.md': prompt, '.agents/hooks.json': AGY_HOOKS, '.agents/read-inputs.cjs': AGY_HOOK },
    }),
    read: readAgy,
  },
  claude: {
    label: 'Claude Code',
    bin: 'claude',
    photos: 'files',
    // Only the Read tool exists (for the photos); no commands, no edits, no MCP.
    build: ({ model }) => ({
      args: [
        '-p', '--output-format', 'json', '--tools', 'Read', '--strict-mcp-config',
        '--disable-slash-commands', '--no-session-persistence',
        ...(model ? ['--model', model] : []),
      ],
      stdin: true,
      files: {},
    }),
    read: readClaude,
  },
};

// What the user may type for --ai.
export const AI_ALIASES = { agy: 'gemini', antigravity: 'gemini' };
export const AI_ORDER = ['codex', 'gemini', 'claude'];

// --- Reading the answers ----------------------------------------------------------

// Each reader returns { text, tokens, error, denied }: the final answer (or null),
// output tokens when reported, an error message, and the actions a headless
// agent was refused.

function jsonLines(stdout) {
  const out = [];
  for (const line of stdout.split('\n')) {
    if (!line.startsWith('{')) continue;
    try {
      out.push(JSON.parse(line));
    } catch {}
  }
  return out;
}

function readCodex(stdout) {
  let text = null;
  let tokens = 0;
  let error = null;
  for (const ev of jsonLines(stdout)) {
    if (ev.type === 'item.completed' && ev.item?.type === 'agent_message' && typeof ev.item.text === 'string') text = ev.item.text;
    else if (ev.type === 'turn.completed') tokens += ev.usage?.output_tokens ?? 0;
    else if (ev.type === 'turn.failed') error = ev.error?.message ?? 'the turn failed';
    else if (ev.type === 'error') error ??= ev.message;
  }
  return { text, tokens, error: text ? null : error, denied: [] };
}

// agy prints one JSON object; a warning line may come before it.
function lastObject(stdout) {
  const lines = stdout.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].startsWith('{')) continue;
    try {
      return JSON.parse(lines[i]);
    } catch {}
  }
  try {
    return JSON.parse(stdout.slice(stdout.indexOf('{')));
  } catch {
    return null;
  }
}

function readAgy(stdout) {
  const res = lastObject(stdout);
  if (!res) return { text: null, tokens: 0, error: 'it printed no JSON result', denied: [] };
  const denied = (res.denied_actions ?? []).map((d) => d.display_name ?? d.action).filter(Boolean);
  const failed = res.status && res.status !== 'SUCCESS';
  return {
    text: typeof res.response === 'string' && res.response.trim() ? res.response : null,
    tokens: res.usage?.output_tokens ?? 0,
    error: failed ? `status ${res.status}` : null,
    denied,
  };
}

function readClaude(stdout) {
  const res = lastObject(stdout);
  if (!res) return { text: null, tokens: 0, error: 'it printed no JSON result', denied: [] };
  const denied = (res.permission_denials ?? []).map((d) => d.tool_name).filter(Boolean);
  return {
    text: typeof res.result === 'string' && res.result.trim() && !res.is_error ? res.result : null,
    tokens: res.usage?.output_tokens ?? 0,
    error: res.is_error ? String(res.result ?? 'it reported an error') : null,
    denied,
  };
}

// --- Finding and running a CLI ------------------------------------------------------

// Absolute path of an executable on PATH, or null. On Windows tries PATHEXT, so
// the .cmd shims that npm makes for a global install are found too.
export function findBin(name, env = process.env) {
  const win = process.platform === 'win32';
  const exts = win ? ['', ...(env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)] : [''];
  for (const dir of (env.PATH ?? env.Path ?? '').split(delimiter).filter(Boolean)) {
    for (const ext of exts) {
      const file = join(dir, name + ext);
      try {
        if (!statSync(file).isFile()) continue;
        if (!win) accessSync(file, constants.X_OK);
        return file;
      } catch {}
    }
  }
  return null;
}

// How to start `file` with `args`. Node can't start a .cmd shim without a shell,
// and a shell would read the arguments, so on Windows they are quoted for cmd and
// anything it could misread is refused. (The prompt never travels as an argument
// to a shim: it goes on stdin.)
export function launch(file, args) {
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(file)) {
    for (const a of [file, ...args]) {
      if (/["%^&|<>\r\n]/.test(a)) throw new Error(`Can't pass "${a}" through ${file} on Windows: rename the folder or file to avoid ", %, ^, &, | < >`);
    }
    const quote = (a) => (/^[\w.:/\\@+=,-]+$/.test(a) ? a : `"${a}"`);
    return { file: quote(file), args: args.map(quote), opts: { shell: true } };
  }
  return { file, args, opts: {} };
}

// { name, path, version } when the CLI is installed and answers `--version`, else null.
export function detect(name, env = process.env) {
  const be = BACKENDS[name];
  const path = findBin(be.bin, env);
  if (!path) return null;
  const run = launch(path, ['--version']);
  const r = spawnSync(run.file, run.args, { encoding: 'utf8', timeout: 30_000, windowsHide: true, env, ...run.opts });
  if (r.error || r.status !== 0) return null;
  const version = `${r.stdout || r.stderr}`.trim().split('\n')[0];
  return { name, path, version };
}

// Runs the CLI in `cwd`. Resolves (never rejects) with { code, stdout, stderr, seconds, timedOut, error }.
export function runCli(found, { args, stdin }, { cwd, timeoutMs, onChild, env = process.env } = {}) {
  return new Promise((done) => {
    const started = Date.now();
    const finish = (extra) => done({ stdout, stderr, seconds: (Date.now() - started) / 1000, timedOut, ...extra });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let run;
    try {
      run = launch(found.path, args);
    } catch (err) {
      return finish({ code: -1, error: err.message });
    }
    const child = spawn(run.file, run.args, { cwd, env, windowsHide: true, ...run.opts });
    onChild?.(child);
    child.stdout.setEncoding('utf8').on('data', (c) => (stdout += c));
    child.stderr.setEncoding('utf8').on('data', (c) => (stderr += c));
    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill();
        }, timeoutMs)
      : null;
    child.on('error', (err) => {
      clearTimeout(timer);
      finish({ code: -1, error: err.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      finish({ code });
    });
    // Always close stdin, so a CLI that waits for input can't hang.
    child.stdin.on('error', () => {});
    child.stdin.end(stdin ?? '');
  });
}
