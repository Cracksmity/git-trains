#!/usr/bin/env node
// Gate: every relative link in the given HTML or Markdown files points to a file
// that exists (src/href attributes and Markdown [text](path) links).
//
//   node tools/conductor/gates/links.js <file or folder>...

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function* walk(p) {
  if (statSync(p).isDirectory()) {
    for (const e of readdirSync(p)) yield* walk(join(p, e));
  } else if (/\.(html|md)$/i.test(p)) yield p;
}

const problems = [];
let count = 0;
for (const arg of process.argv.slice(2)) {
  for (const file of walk(arg)) {
    // Code blocks in Markdown are examples for the reader's own repository, not links.
    const raw = readFileSync(file, 'utf8');
    const text = file.endsWith('.md') ? raw.replace(/^\s*```[\s\S]*?^\s*```/gm, '') : raw;
    const links = [
      ...[...text.matchAll(/\s(?:src|href|srcset)="([^"]+)"/g)].map((m) => m[1]),
      ...[...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]),
    ];
    for (const raw of links) {
      const link = raw.split(/[?#]/)[0].split(' ')[0];
      if (!link || /^(?:[a-z]+:|\/\/|\$)/i.test(raw) || raw.startsWith('#')) continue;
      count++;
      const target = resolve(dirname(file), decodeURI(link));
      if (!existsSync(target)) problems.push(`${file}: "${raw}" does not exist`);
    }
  }
}

if (problems.length) {
  console.log(`${problems.length} broken link(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`links: ${count} relative link(s) checked`);
