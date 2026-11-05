#!/usr/bin/env node
// Gate: the complete JSON examples in the AI guides still pass the validator.
// A ```json block counts as a complete example when it parses and has the keys
// of a full train ("pal") or skyline ("buildings"); fragments are skipped.
//
//   node tools/conductor/gates/guide-json.js <guide.md>...

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { parseCustomModel } = await import(pathToFileURL(resolve(root, 'src/custom.js')));
const { parseSkyline } = await import(pathToFileURL(resolve(root, 'src/skyline.js')));

const problems = [];
let checked = 0;
for (const file of process.argv.slice(2)) {
  const text = readFileSync(file, 'utf8');
  for (const [i, m] of [...text.matchAll(/```json\n([\s\S]*?)```/g)].entries()) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const parse = data?.pal ? parseCustomModel : data?.buildings ? parseSkyline : null;
    if (!parse) continue;
    checked++;
    try {
      parse(data);
    } catch (err) {
      problems.push(`${file}, json block ${i + 1}: ${err.message}`);
    }
  }
}

if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
console.log(`guide-json: ${checked} complete example(s) valid`);
