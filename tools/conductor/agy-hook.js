#!/usr/bin/env node
// Antigravity PreToolUse hook: the command allowlist for headless `agy -p` runs.
//
// The conductor runs agy with `--sandbox` and the `proceed-in-sandbox`
// permission mode, so every terminal command would run (inside the sandbox)
// without asking. This hook narrows that down to the commands in routes.json
// (backends.gemini.commands, passed in CONDUCTOR_AGY_COMMANDS): a command runs
// only if its first words match an entry and it is one plain command, with no
// `;`, `&&`, `||`, pipes, redirections, `$( )` or backticks outside quotes.
// Anything else is refused with a reason the agent can read, and the run
// goes on (a refusal from a hook doesn't end a headless turn).
//
// The conductor writes <worktree>/.agents/hooks.json to point here while the
// agent runs. Input and output follow Antigravity's hook contract: a JSON
// object on stdin, {"decision": "allow" | "deny", "reason": ...} on stdout.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Splits a command line into words, keeping quoted text inside its word, and
// returns the text outside quotes too so operators there can be spotted.
export function split(line) {
  const words = [];
  let word = '';
  let quote = null;
  let outside = '';
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null;
      else word += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (/\s/.test(ch)) {
      outside += ch;
      if (word) words.push(word);
      word = '';
    } else {
      outside += ch;
      word += ch;
    }
  }
  if (word) words.push(word);
  return { words, outside, unclosed: quote !== null };
}

const OPERATORS = /[;&|<>(){}\n\r]/;

export function decide(commandLine, allowed) {
  const { words, outside, unclosed } = split(commandLine.trim());
  const rule = `Only these commands run here: ${allowed.map((c) => `\`${c} ...\``).join(', ')}, one plain command per call (no ;, &&, ||, pipes, redirections, $( ) or backticks). Read, list and write files with your file tools instead.`;
  if (unclosed || OPERATORS.test(outside) || /`|\$\(/.test(commandLine)) {
    return { decision: 'deny', reason: `Not run: \`${commandLine}\` is not one plain command. ${rule}` };
  }
  // node.exe, npm.cmd and the like count as node and npm.
  const got = words.map((w, i) => (i === 0 ? w.replace(/\.(exe|cmd|bat)$/i, '') : w).toLowerCase());
  const ok = allowed.some((entry) => {
    const want = entry.toLowerCase().split(/\s+/);
    return want.length <= got.length && want.every((w, i) => w === got[i]);
  });
  return ok ? { decision: 'allow' } : { decision: 'deny', reason: `Not run: \`${commandLine}\` is not on the conductor's list. ${rule}` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let allowed = [];
  try {
    allowed = JSON.parse(process.env.CONDUCTOR_AGY_COMMANDS ?? '[]');
  } catch {}
  let call = {};
  try {
    call = JSON.parse(readFileSync(0, 'utf8')).toolCall ?? {};
  } catch {}
  const line = call.args?.CommandLine;
  let out = {}; // not a command: no opinion
  if (typeof line === 'string') {
    out = allowed.length ? decide(line, allowed) : { decision: 'deny', reason: 'Not run: the conductor gave no command list (CONDUCTOR_AGY_COMMANDS).' };
  }
  process.stdout.write(JSON.stringify(out));
}
