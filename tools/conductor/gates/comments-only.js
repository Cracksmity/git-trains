#!/usr/bin/env node
// Gate: in the changed .js files, only comments and the text inside string
// literals may change; the code itself must stay the same line for line.
//
//   node tools/conductor/gates/comments-only.js [base]   (base defaults to HEAD)
//
// It is a heuristic, not a parser: it is meant to catch an agent that "also
// fixed" something while translating comments. The tests catch the rest.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const base = process.argv[2] ?? 'HEAD';
const files = execFileSync('git', ['diff', '--name-only', base, '--', '*.js'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

// Strips a line down to its code: drops full-line comments, trailing // comments
// and the contents of '...', "..." and `...` literals.
function codeOf(line) {
  const t = line.trim();
  if (!t || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return '';
  let out = '';
  let quote = null;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) {
        quote = null;
        out += c;
      }
      continue;
    }
    if (c === '/' && t[i + 1] === '/' && /\s|^$/.test(t[i - 1] ?? '')) break;
    if (c === "'" || c === '"' || c === '`') quote = c;
    out += c;
  }
  return out.trim();
}

const problems = [];
for (const file of files) {
  const before = (() => {
    try {
      return execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8' });
    } catch {
      return null; // new file: nothing to compare
    }
  })();
  if (before === null || !existsSync(file)) continue;
  const after = readFileSync(file, 'utf8');
  const a = before.split('\n').map(codeOf).filter(Boolean);
  const b = after.split('\n').map(codeOf).filter(Boolean);
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      problems.push(`${file}: code changed near code line ${i + 1}\n  before: ${a[i] ?? '(nothing)'}\n  after:  ${b[i] ?? '(nothing)'}`);
      break;
    }
  }
}

if (problems.length) {
  console.log(`Only comments and string text may change, but code changed in ${problems.length} file(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`comments-only: ${files.length} file(s) checked, code unchanged`);
