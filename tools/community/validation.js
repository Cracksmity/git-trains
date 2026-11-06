// community/validation.js: focused validation operations.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { parseCustomModel } from '../../src/trains/parse.js';
import { parseSkyline } from '../../src/landscape/skyline-parse.js';
import { posix, count } from './format.js';

export const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

export const KINDS = { train: 'trains', skyline: 'skylines' };

export const MAX_BYTES = 64 * 1024;

const MAX_NAME = 40;

// the validators cut names there
const MAX_DESCRIPTION = 500;

const ID = /^[a-z0-9][a-z0-9-]{0,31}$/;

const GITHUB_USER = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

const PARSE = { train: parseCustomModel, skyline: parseSkyline };

// --- Share links ---------------------------------------------------------------

// The studio's share format: studio/#train=<data> or studio/#skyline=<data>, where
// <data> is the JSON text compressed with raw DEFLATE, in base64url without padding
// (CompressionStream('deflate-raw') in browsers). Relative to the site's root.
export function shareLink(kind, raw) {
  if (!KINDS[kind]) throw new Error(`Unknown kind "${kind}"`);
  return `studio/#${kind}=${deflateRawSync(Buffer.from(JSON.stringify(raw))).toString('base64url')}`;
}

// One file: its bytes and its path relative to the repository. Returns the
// gallery entry (null when it has problems), the validated model or skyline,
// and the list of problems.
export function checkFile(kind, path, bytes) {
  const problems = [];
  const id = basename(path, '.json');
  if (bytes.length > MAX_BYTES) {
    problems.push(`the file is ${(bytes.length / 1024).toFixed(1)} KB; the limit is 64 KB (simplify the drawing)`);
  }
  if (!ID.test(id)) {
    problems.push(`the file name is the ${kind}'s id: lowercase letters, digits and hyphens (32 at most), for example "${kind === 'train' ? 'nyc-subway' : 'mexico-city'}.json"`);
  }
  let raw;
  try {
    raw = JSON.parse(bytes.toString('utf8').replace(/^﻿/, ''));
  } catch (err) {
    problems.push(`it is not valid JSON: ${err.message}`);
    return { entry: null, value: null, problems };
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    problems.push('the file must be a JSON object { ... }');
    return { entry: null, value: null, problems };
  }

  const text = (key, max, hint) => {
    const v = raw[key];
    if (typeof v !== 'string' || !v.trim()) problems.push(`${key}: required, ${hint}`);
    else if (v.trim().length > max) problems.push(`${key}: ${v.trim().length} characters; ${max} at most`);
  };
  text('name', MAX_NAME, `the name shown in the gallery (${MAX_NAME} characters at most), for example "${kind === 'train' ? 'Medellín Metro' : 'Mexico City'}"`);
  text('description', MAX_DESCRIPTION, `which real ${kind === 'train' ? 'train' : 'city'} this is and what the drawing shows`);
  if (raw.author === undefined || raw.author === '') {
    problems.push(`author: required, your GitHub username, for example "octocat"${raw.autor !== undefined ? ' (rename "autor" to "author")' : ''}`);
  } else if (typeof raw.author !== 'string' || !GITHUB_USER.test(raw.author.replace(/^@/, ''))) {
    problems.push(`author: ${JSON.stringify(raw.author)} is not a GitHub username`);
  } else if (raw.author.startsWith('@')) {
    problems.push(`author: write the username without "@" ("${raw.author.slice(1)}")`);
  }
  if (kind === 'train') {
    if (raw.id === undefined) problems.push(`id: required, the same as the file name ("${id}")`);
    else if (raw.id !== id) problems.push(`id: "${raw.id}" does not match the file name; name the file ${raw.id}.json or set "id": "${id}"`);
  }

  let value = null;
  try {
    value = PARSE[kind](raw);
  } catch (err) {
    problems.push(...(err.errors ?? [err.message]));
  }
  if (problems.length) return { entry: null, value: null, problems };
  return {
    entry: { id, name: raw.name.trim(), description: raw.description.trim(), author: raw.author, kind, share: shareLink(kind, raw) },
    value,
    problems,
  };
}

// Every file in the depot. Returns { entries, files, problems: [{ file, problems }] },
// with entries sorted for the gallery: trains, then skylines, by name.
export function checkDepot(root = ROOT) {
  const entries = [];
  const failed = [];
  const values = new Map();
  let files = 0;
  const seen = new Map();
  for (const [kind, folder] of Object.entries(KINDS)) {
    const dir = join(root, 'community', folder);
    if (!existsSync(dir)) continue;
    for (const d of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = posix(relative(root, join(dir, d.name)));
      if (d.isDirectory()) {
        failed.push({ file, problems: [`community/${folder}/ holds .json files only; move the files out of this folder`] });
        continue;
      }
      if (!d.name.endsWith('.json')) {
        failed.push({ file, problems: [`community/${folder}/ holds one .json file per ${kind}; this one does not end in .json`] });
        continue;
      }
      files++;
      const result = checkFile(kind, file, readFileSync(join(dir, d.name)));
      const id = basename(d.name, '.json').toLowerCase();
      const key = `${kind}:${id}`;
      if (seen.has(key)) result.problems.push(`the id "${id}" is already taken by ${seen.get(key)}`);
      else seen.set(key, file);
      if (result.problems.length) failed.push({ file, problems: result.problems });
      else {
        entries.push(result.entry);
        values.set(file, result.value);
      }
    }
  }
  const order = Object.keys(KINDS);
  entries.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id));
  const trains = entries.filter((e) => e.kind === 'train').length;
  return { entries, files, trains, skylines: entries.length - trains, problems: failed, values };
}

// The problems as the Action prints them: one block per file. In GitHub Actions
// each file also gets an ::error annotation, shown on the pull request's diff.
export function formatProblems(problems, { annotate = false } = {}) {
  const esc = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  const escProp = (s) => esc(s).replace(/,/g, '%2C').replace(/:/g, '%3A');
  return problems
    .map(({ file, problems: list }) => {
      const block = `${file} has ${list.length} problem(s):\n- ${list.join('\n- ')}`;
      return annotate ? `::error file=${escProp(file)}::${esc(block)}` : block;
    })
    .join('\n\n');
}

export function summaryLine({ files, trains, skylines, problems }) {
  const n = problems.reduce((a, p) => a + p.problems.length, 0);
  if (n) return `community: ${count(n, 'problem')} in ${count(problems.length, 'file')}`;
  return `community: ${count(files, 'file')} checked (${count(trains, 'train')}, ${count(skylines, 'skyline')}), no problems`;
}
