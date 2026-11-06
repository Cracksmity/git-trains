// What goes to the AI and what comes back: the prompt (the AI guide plus the
// person's request), pulling the JSON out of a chatty answer, and checking it
// with the same validators the Action uses.

import { readFileSync } from 'node:fs';
import { CustomError, parseCustomModel } from '../trains/parse.js';
import { parseSkyline } from '../landscape/skyline-parse.js';

export const KINDS = {
  train: { guide: 'train.md', parse: parseCustomModel, out: '.github/train.json', noun: 'train' },
  skyline: { guide: 'skyline.md', parse: parseSkyline, out: '.github/skyline.json', noun: 'skyline' },
};

// The Action refuses custom files larger than this (src/index.js).
export const MAX_BYTES = 256 * 1024;

// The guide from the package, without its "if you are a person" note.
export function readGuide(kind) {
  const text = readFileSync(new URL(`../../docs/ai/${KINDS[kind].guide}`, import.meta.url), 'utf8');
  return text.replace(/^> \*\*If you are a person:\*\*.*\n+/m, '').trim();
}

// photos: { names, attached } - how the agent finds the photos (see BACKENDS[x].photos).
// retry: { previous, problems } after a rejected answer, or { reason } when nothing usable came back.
export function buildPrompt({ kind, guide, description, photos, retry }) {
  const noun = KINDS[kind].noun;
  const parts = [guide, description || `(No description: design the ${noun} shown in the photo.)`];
  if (photos.names.length) {
    parts.push(
      photos.attached
        ? `${photos.names.length === 1 ? 'A photo is' : `${photos.names.length} photos are`} attached to this message.`
        : `Photos to design from, in this folder: ${photos.names.join(', ')}. Open each one with your file tool before you start.`,
    );
  }
  parts.push(
    [
      '## How this run works',
      '',
      `You run non-interactively inside an empty folder, started by \`git-trains design\`. Nobody can answer questions or approve anything, so do not ask: make your best design. Do not run commands and do not create or edit files; put the complete ${noun} JSON in your reply, in one \`json\` block, with at most two lines of explanation. The command checks it with the validator and, if there are problems, asks you again with the list.`,
    ].join('\n'),
  );
  if (retry?.problems) {
    const shown = retry.previous.length > 30_000 ? `${retry.previous.slice(0, 30_000)}\n... (cut)` : retry.previous;
    parts.push(
      [
        '## Your previous answer was rejected',
        '',
        'You answered with this JSON:',
        '',
        '```json',
        shown,
        '```',
        '',
        'The validator reported:',
        '',
        ...retry.problems.map((p) => `- ${p}`),
        '',
        `Fix every problem, keep the rest, and reply with the complete corrected ${noun} JSON in one \`json\` block.`,
      ].join('\n'),
    );
  } else if (retry?.reason) {
    parts.push(
      `## Your previous answer could not be used\n\n${retry.reason}\n\nReply with the complete ${noun} JSON in one \`json\` block, in your message itself.`,
    );
  }
  return `${parts.join('\n\n')}\n`;
}

// --- Pulling the JSON out of an answer ---------------------------------------------

// Commas before ] or }, outside strings: the usual slip.
function stripTrailingCommas(text) {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === '\\') out += text[++i] ?? '';
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === ',' && /^\s*[\]}]/.test(text.slice(i + 1))) {
      // dropped
    } else out += ch;
  }
  return out;
}

// Parses one candidate. Returns { value } for a JSON object, { error } otherwise.
function tryObject(text) {
  let failure;
  for (const source of [text, stripTrailingCommas(text)]) {
    try {
      const value = JSON.parse(source);
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) return { value };
      return { error: 'the JSON is not an object { ... }' };
    } catch (err) {
      failure ??= err.message;
    }
  }
  return { error: `it is not valid JSON (${failure})` };
}

// Top-level {...} spans of a text, aware of strings.
function braceSpans(text) {
  const spans = [];
  let misses = 0;
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0;
    let inString = false;
    let end = -1;
    for (let i = start; i < text.length && end === -1; i++) {
      const ch = text[i];
      if (inString) {
        if (ch === '\\') i++;
        else if (ch === '"') inString = false;
      } else if (ch === '"') inString = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) end = i;
    }
    if (end === -1) {
      if (++misses > 50) break; // a stray { in the prose: don't scan forever
      continue;
    }
    spans.push(text.slice(start, end + 1));
    start = end;
  }
  return spans;
}

// { value, raw } for the JSON object in an answer, or { error } saying what is wrong.
// Order: the largest fenced block that parses (the answer, not a snippet in the
// explanation), then the whole answer, then the largest {...} that parses.
export function extractJson(answer) {
  const text = String(answer ?? '');
  if (!text.trim()) return { error: 'the answer was empty' };
  const fenced = [...text.matchAll(/```[a-z]*[ \t]*\r?\n([\s\S]*?)```/gi)].map((m) => m[1].trim()).filter(Boolean);
  const whole = text.trim();
  const spans = braceSpans(text).sort((a, b) => b.length - a.length);
  const candidates = [...fenced.sort((a, b) => b.length - a.length), whole, ...spans];

  let firstError = null;
  for (const raw of candidates) {
    const got = tryObject(raw);
    if (got.value) return { value: got.value, raw };
    // The most useful complaint is about the biggest thing that looked like JSON.
    if (!firstError && raw.includes('{')) firstError = got.error;
  }
  return { error: firstError ?? 'the answer has no JSON object in it' };
}

// --- Checking it ---------------------------------------------------------------------

// { problems: [...], parsed } - problems is empty when the validator accepts it.
export function check(kind, value) {
  const problems = [];
  let parsed = null;
  try {
    parsed = KINDS[kind].parse(value);
  } catch (err) {
    if (err instanceof CustomError) problems.push(...err.errors);
    else problems.push(`the validator could not read it: ${err.message}`);
  }
  const bytes = Buffer.byteLength(JSON.stringify(value, null, 2));
  if (bytes > MAX_BYTES) problems.push(`the file is ${Math.round(bytes / 1024)} KB; the Action reads at most ${MAX_BYTES / 1024} KB. Draw fewer or smaller details.`);
  return { problems, parsed };
}
