#!/usr/bin/env node
// Gate: a file draws only with theme colors ('@name'). Fixed colors (#hex,
// rgb(), rgba()) may live in one object, which holds the light and dark values.
//
//   node tools/conductor/gates/theme-colors.js src/decor.js DECOR_THEMES
//
// A heuristic, not a parser: the object starts at `const <NAME> = {` and ends where its
// braces close. Comments are ignored.

import { readFileSync } from 'node:fs';

const [file, name] = process.argv.slice(2);
if (!file || !name) {
  console.log('usage: theme-colors.js <file> <ObjectName>');
  process.exit(2);
}

let text = readFileSync(file, 'utf8');
const block = new RegExp(`const ${name}\\s*=\\s*\\{`).exec(text);
if (!block) {
  console.log(`${file} has no "const ${name} = {"`);
  process.exit(1);
}
let depth = 0;
let end = block.index + block[0].length - 1;
do {
  if (text[end] === '{') depth++;
  else if (text[end] === '}') depth--;
  end++;
} while (depth > 0 && end < text.length);
text = text.slice(0, block.index) + text.slice(end);
text = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');

const found = text.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g);
if (found) {
  console.log(`fixed colors in ${file} outside ${name}: ${[...new Set(found)].join(', ')}`);
  process.exit(1);
}
console.log(`${file}: theme colors only`);
