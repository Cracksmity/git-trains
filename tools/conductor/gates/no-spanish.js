#!/usr/bin/env node
// Gate: no Spanish left in the given files. In .js files only comments are
// checked (Spanish UI strings such as the `es` card labels are legitimate); in
// .md and .html files the visible text is checked, minus code blocks and tags.
// Proper nouns ("Palacio de la Cultura") are why it looks for function words
// that rarely appear in names, and why a few hits are tolerated.
//
//   node tools/conductor/gates/no-spanish.js [--max N] <file or folder>...

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WORDS = /\b(que|para|con|una|los|las|del|más|cada|pero|sus|este|esta|fue|sin|tiene|hace|aquí|así|cuando|porque|también|según|después|antes|entre|sobre|hasta|desde|todo|todos|nada|solo|sólo|puede|debe|vagón|vagones|trompa|letrero|fondo|ruedas)\b/i;

const args = process.argv.slice(2);
let max = 0;
const roots = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--max') max = Number(args[++i]);
  else roots.push(args[i]);
}

function* walk(p) {
  if (statSync(p).isDirectory()) {
    for (const e of readdirSync(p)) yield* walk(join(p, e));
  } else if (/\.(js|md|html)$/i.test(p)) yield p;
}

function textLines(file, text) {
  const lines = text.split('\n');
  if (file.endsWith('.js')) {
    return lines.map((l, i) => {
      const t = l.trim();
      if (/^(\/\/|\/\*|\*)/.test(t)) return [i + 1, t];
      const m = /\s(\/\/.*)$/.exec(l);
      return [i + 1, m ? m[1] : ''];
    });
  }
  let fenced = false;
  return lines.map((l, i) => {
    if (/^\s*```/.test(l)) {
      fenced = !fenced;
      return [i + 1, ''];
    }
    if (fenced) return [i + 1, ''];
    return [i + 1, l.replace(/<style[\s\S]*?<\/style>|<[^>]+>|`[^`]*`/g, ' ')];
  });
}

const hits = [];
for (const root of roots) {
  for (const file of walk(root)) {
    for (const [n, line] of textLines(file, readFileSync(file, 'utf8'))) {
      const m = WORDS.exec(line);
      if (m) hits.push(`${file}:${n}: "${m[0]}" in: ${line.trim().slice(0, 120)}`);
    }
  }
}

if (hits.length > max) {
  console.log(`${hits.length} line(s) still look Spanish (allowed: ${max}):\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`no-spanish: ${hits.length} hit(s), allowed ${max}`);
