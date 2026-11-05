#!/usr/bin/env node
// Gate: an HTML page was restyled, not rewired. Compared with the base commit:
// every <script> block is byte for byte the same, every id still exists, and
// no data-* attribute was dropped (the scripts find their elements through them).
//
//   node tools/conductor/gates/restyle-only.js <page.html>... [--base <ref>]

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
let base = 'HEAD';
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--base') base = args[++i];
  else files.push(args[i]);
}

const scripts = (html) => [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[0]);
const ids = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const dataAttrs = (html) => {
  const count = new Map();
  for (const m of html.matchAll(/\s(data-[a-z-]+)="([^"]*)"/g)) {
    const key = `${m[1]}="${m[2]}"`;
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  return count;
};

const problems = [];
for (const file of files) {
  const before = execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8' });
  const after = readFileSync(file, 'utf8');

  const [sa, sb] = [scripts(before), scripts(after)];
  if (sa.length !== sb.length) problems.push(`${file}: had ${sa.length} <script> block(s), now ${sb.length}`);
  sa.forEach((s, i) => {
    if (sb[i] !== s) problems.push(`${file}: <script> block ${i + 1} changed; restyling must not touch the scripts`);
  });

  const now = ids(after);
  const lost = [...ids(before)].filter((id) => !now.has(id));
  if (lost.length) problems.push(`${file}: these ids are gone: ${lost.join(', ')}`);

  const da = dataAttrs(after);
  for (const [key, n] of dataAttrs(before)) {
    if ((da.get(key) ?? 0) < n) problems.push(`${file}: ${key} appeared ${n} time(s), now ${da.get(key) ?? 0}`);
  }
}

if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
console.log(`restyle-only: ${files.length} page(s): scripts, ids and data attributes intact`);
