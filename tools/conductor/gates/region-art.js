#!/usr/bin/env node
// Gate: each skyline has a region with enough pixel art in it, and it passes the validator.
// An item is a built-in skyline id or the path to a .json, optionally followed by
// ":terrain" to require that terrain:
//
//   node tools/conductor/gates/region-art.js osaka:mountains new-york:hills examples/skylines/medellin.json
//
// Checks beyond parseSkyline (which already lists every format problem): at least one house,
// three trees and one plant, a landmark, a terrain, no drawing twice, no drawing of a single
// symbol (a flat block is not pixel art), and the drawings are neither tiny nor huge.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { parseSkyline } = await import(pathToFileURL(resolve(root, 'src/skyline.js')));

const problems = [];
let checked = 0;
for (const item of process.argv.slice(2)) {
  const [target, terrain] = item.split(/:(?=[a-z]+$)/);
  const tag = target.replace(/^.*[\\/]/, '');
  let sky;
  try {
    sky = parseSkyline(target.endsWith('.json') ? JSON.parse(readFileSync(resolve(root, target), 'utf8')) : target);
  } catch (err) {
    problems.push(`${tag}: ${err.message}`);
    continue;
  }
  checked++;
  const r = sky?.region;
  if (!r) {
    problems.push(`${tag}: no "region"`);
    continue;
  }
  if (terrain && r.terrain !== terrain) problems.push(`${tag}: terrain is "${r.terrain}", expected "${terrain}"`);
  const need = [['houses', 1], ['trees', 3], ['plants', 1]];
  for (const [kind, min] of need) if ((r[kind]?.length ?? 0) < min) problems.push(`${tag}: needs at least ${min} in region.${kind}, has ${r[kind]?.length ?? 0}`);
  if (!r.landmark) problems.push(`${tag}: no region.landmark`);
  const seen = new Set();
  const all = [...(r.houses ?? []).map((d, i) => [`houses[${i}]`, d, 8, 6]), ...(r.trees ?? []).map((d, i) => [`trees[${i}]`, d, 5, 6]), ...(r.plants ?? []).map((d, i) => [`plants[${i}]`, d, 5, 3]), ...(r.landmark ? [['landmark', r.landmark, 5, 6]] : [])];
  for (const [name, d, minW, minH] of all) {
    const key = d.rows.join('/');
    if (seen.has(key)) problems.push(`${tag}: region.${name} is a copy of another drawing`);
    seen.add(key);
    const symbols = new Set(d.rows.join('').replace(/\./g, ''));
    if (symbols.size < 2) problems.push(`${tag}: region.${name} uses a single symbol; give it at least two (body and detail, crown and trunk)`);
    if (d.rows[0].length < minW || d.rows.length < minH) problems.push(`${tag}: region.${name} is only ${d.rows[0].length} x ${d.rows.length}; at least ${minW} x ${minH}`);
  }
}

if (problems.length) {
  console.log(problems.join('\n'));
  process.exit(1);
}
console.log(`region-art: ${checked} skyline(s) with a region, valid`);
