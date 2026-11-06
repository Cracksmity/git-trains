// action/inputs.js: focused inputs operations.

import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { LEGACY_INPUTS, LEGACY_VALUES, CARDS, CARD_ALIASES } from '../../config/action-inputs.js';

// Action inputs arrive as INPUT_<NAME> (hyphens kept).
const raw = (name) => (process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] ?? '').trim();

export function input(name, fallback = '') {
  const old = LEGACY_INPUTS[name];
  const legacy = old ? raw(old) : '';
  if (legacy) console.log(`::warning::The input "${old}" is deprecated; rename it to "${name}".`);
  const value = legacy || raw(name) || fallback;
  return LEGACY_VALUES[name]?.[value] ?? value;
}

// Reads a JSON file from the repository (a custom train or skyline). Paths are
// relative to the repository root, which is where the Action runs.
export function readJson(path, what) {
  const file = resolve(process.env.GITHUB_WORKSPACE || process.cwd(), path);
  let text;
  try {
    if (statSync(file).size > 256 * 1024) throw new Error('it is larger than 256 KB');
    text = readFileSync(file, 'utf8');
  } catch (err) {
    throw new Error(`Could not read ${what} "${path}": ${err.code === 'ENOENT' ? 'the file does not exist' : err.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${what} "${path}" is not valid JSON: ${err.message}`);
  }
}

export const isJsonPath = (v) => /\.json$/i.test(v);

export const list = (v) => v.split(',').map((s) => s.trim()).filter(Boolean);

export function oneOf(name, value, options) {
  if (!options.includes(value)) throw new Error(`Unknown ${name}: "${value}". Options: ${options.join(', ')}`);
  return value;
}

// `cards` takes one name or a list ("stats, departures"). Returns the set of cards to write:
// stats, languages and departures; both means stats and languages.
export function parseCards(value) {
  const names = list(value).map((n) => CARD_ALIASES[n] ?? n);
  for (const n of names) oneOf('cards', n, CARDS);
  if (names.includes('none') && names.length > 1) throw new Error(`The card "none" can't be combined with other cards`);
  return new Set(names.flatMap((n) => (n === 'both' ? ['stats', 'languages'] : n === 'none' ? [] : [n])));
}
