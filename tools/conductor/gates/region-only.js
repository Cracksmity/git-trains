#!/usr/bin/env node
// Gate: skyline files differ from the committed ones only by their "region" key.
//   node tools/conductor/gates/region-only.js examples/skylines/mexico-city.json ...

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const problems = [];
for (const file of process.argv.slice(2)) {
  const before = JSON.parse(execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8', maxBuffer: 1 << 26 }));
  const after = JSON.parse(readFileSync(file, 'utf8'));
  const { region: _was, ...old } = before;
  const { region, ...rest } = after;
  if (!region) problems.push(`${file}: no "region" yet`);
  if (!isDeepStrictEqual(rest, old)) problems.push(`${file}: something other than "region" changed`);
}
if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
console.log('region-only: only "region" was added');
