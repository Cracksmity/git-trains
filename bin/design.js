// `git-trains design`: asks an AI coding CLI for a train or a skyline and loops with
// the validator until the JSON passes, then writes the file, draws a preview and
// prints a studio link.
//
// The agent runs in a temporary empty folder and only its final answer is read, so it
// never touches the person's files. Every try is a fresh run: the retry prompt carries
// the previous JSON and the validator's list, the same thing a person would paste back.

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { encodeShare } from '../studio/share.js';
import { KINDS, buildPrompt, check, extractJson, readGuide } from './answer.js';
import { AI_ALIASES, AI_ORDER, BACKENDS, detect, runCli } from './backends.js';
import { previewSkyline, previewTrain } from './preview.js';

export const STUDIO = 'https://cracksmity.github.io/git-trains/studio/';
const PHOTO_TYPES = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const PHOTO_MAX = 20 * 1024 * 1024;
const TIMEOUT_MIN = 20; // per try; the strongest models think for several minutes

// Something the person can act on (bad option, nothing installed, no valid answer): printed without a stack.
export class DesignError extends Error {}

const seconds = (s) => (s >= 90 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${Math.round(s)} s`);
const tokens = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);
const clip = (text, n) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);

// Which AI CLI to use: the one asked for, or the first installed (codex, gemini, claude).
export function pickBackend(ai, env = process.env) {
  if (ai) {
    const name = AI_ALIASES[ai.toLowerCase()] ?? ai.toLowerCase();
    if (!BACKENDS[name]) throw new DesignError(`Unknown --ai "${ai}". Use codex, gemini or claude.`);
    const found = detect(name, env);
    if (!found) throw new DesignError(`${BACKENDS[name].label} isn't installed or doesn't answer \`${BACKENDS[name].bin} --version\`. Install it and sign in, or pick another with --ai.`);
    return found;
  }
  for (const name of AI_ORDER) {
    const found = detect(name, env);
    if (found) return found;
  }
  throw new DesignError(
    `No AI coding CLI found. Install one and sign in (git-trains uses your own subscription):\n` +
      AI_ORDER.map((n) => `  ${BACKENDS[n].label}: \`${BACKENDS[n].bin} --version\` should work`).join('\n'),
  );
}

// Copies the photos into the agent's folder under plain names (photo-1.jpg...).
function stagePhotos(photos, dir) {
  return photos.map((p, i) => {
    const name = `photo-${i + 1}${extname(p).toLowerCase()}`;
    copyFileSync(p, join(dir, name));
    return name;
  });
}

function checkPhotos(list) {
  return list.map((p) => {
    const file = resolve(p);
    let size;
    try {
      size = statSync(file).size;
    } catch {
      throw new DesignError(`Photo not found: ${p}`);
    }
    if (!PHOTO_TYPES.includes(extname(file).toLowerCase())) throw new DesignError(`${p}: photos must be ${PHOTO_TYPES.join(', ')}.`);
    if (size > PHOTO_MAX) throw new DesignError(`${p} is ${Math.round(size / 1048576)} MB; the limit is ${PHOTO_MAX / 1048576} MB.`);
    return file;
  });
}

function terminalPreview(kind, parsed, columns) {
  try {
    return kind === 'train' ? previewTrain(parsed, { columns }) : previewSkyline(parsed, { columns });
  } catch (err) {
    return `(no preview: ${err.message})`;
  }
}

// opts: { kind, description, photos[], ai, model, out, tries, force, preview, columns, env, timeoutMin }
// io:   { log, warn } (console by default). Returns { file, link, raw, tries, backend }.
export async function design(opts, io = {}) {
  const log = io.log ?? console.log;
  const { kind, photos: photoList = [], model = '', tries = 3, force = false, env = process.env } = opts;
  const description = (opts.description ?? '').trim();
  if (!KINDS[kind]) throw new DesignError(`Design a "train" or a "skyline", not "${kind}".`);
  if (!description && !photoList.length) throw new DesignError(`Say what to design: git-trains design ${kind} "<description>" and/or --photo <file>.`);
  if (description.length > 4000) throw new DesignError('The description is longer than 4000 characters.');
  if (!Number.isInteger(tries) || tries < 1 || tries > 10) throw new DesignError('--tries must be a whole number from 1 to 10.');
  if (model && !/^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,80}$/.test(model)) throw new DesignError(`"${model}" doesn't look like a model name.`);
  const photos = checkPhotos(photoList);
  const out = resolve(opts.out || KINDS[kind].out);
  if (existsSync(out) && !force) throw new DesignError(`${opts.out || KINDS[kind].out} already exists. Pass --force to replace it, or --out <file> to write somewhere else.`);

  const found = pickBackend(opts.ai, env);
  const be = BACKENDS[found.name];
  const guide = readGuide(kind);
  const dir = mkdtempSync(join(tmpdir(), 'git-trains-design-'));
  let child = null;
  const onSigint = () => {
    child?.kill();
    rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    process.exit(130);
  };
  process.once('SIGINT', onSigint);

  log(`Designing a ${kind} with ${be.label} (${model || 'its default model'}), ${found.version}`);
  log(`The agent works in an empty temporary folder and can't edit your files. Up to ${tries} ${tries === 1 ? 'try' : 'tries'}.`);

  try {
    const staged = { names: be.photos === 'files' ? stagePhotos(photos, dir) : photos.map((p) => basename(p)), attached: be.photos === 'attached' };
    let retry = null;
    let last = null; // { raw, problems } of the latest answer that parsed but didn't pass

    for (let attempt = 1; attempt <= tries; attempt++) {
      const prompt = buildPrompt({ kind, guide, description, photos: staged, retry });
      const spec = be.build({ model, dir, photos: be.photos === 'attached' ? photos : [], prompt });
      for (const [rel, content] of Object.entries(spec.files)) {
        mkdirSync(dirname(join(dir, rel)), { recursive: true });
        writeFileSync(join(dir, rel), content);
      }
      log(`\nTry ${attempt}/${tries}: asking ${be.label}...`);
      const run = await runCli(found, { args: spec.args, stdin: spec.stdin ? prompt : '' }, {
        cwd: dir,
        env,
        timeoutMs: (opts.timeoutMin ?? TIMEOUT_MIN) * 60_000,
        onChild: (c) => (child = c),
      });
      const answer = be.read(run.stdout);
      const took = seconds(run.seconds);

      // The CLI itself failed (not signed in, bad model name, timeout): trying again won't help.
      if (run.timedOut) throw new DesignError(`${be.label} took longer than ${opts.timeoutMin ?? TIMEOUT_MIN} minutes and was stopped.`);
      if (run.error || (run.code !== 0 && !answer.text)) {
        const detail = answer.error ?? run.error ?? clip(run.stderr.trim().split('\n').slice(-6).join('\n'), 700);
        throw new DesignError(`${be.label} failed (exit code ${run.code}): ${detail || 'no details'}`);
      }

      const stats = `${took}${answer.tokens ? `, ${tokens(answer.tokens)} output tokens` : ''}`;
      const got = answer.text ? extractJson(answer.text) : { error: answer.denied.length ? `your turn ended after it was refused ${answer.denied.join(', ')}` : 'the answer was empty' };
      if (!got.value) {
        log(`  No usable JSON (${stats}): ${got.error}`);
        retry = { reason: `The answer had no JSON that could be read: ${got.error}. You cannot run commands or write files here, so the JSON must be in your reply.` };
        continue;
      }
      const { problems, parsed } = check(kind, got.value);
      if (!problems.length) {
        log(`  Passed the validator (${stats}).`);
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, `${JSON.stringify(got.value, null, 2)}\n`);
        const link = `${STUDIO}${await encodeShare(kind, got.value)}`;
        const columns = Math.min(opts.columns || 100, 120);
        const result = { file: out, link, value: got.value, tries: attempt, backend: found.name };
        log(`\nWrote ${opts.out || KINDS[kind].out}${got.value.name ? ` ("${got.value.name}")` : ''}.`);
        if (opts.preview) log(`\n${terminalPreview(kind, parsed, columns)}`);
        log(`\nTweak it in the studio (it's all in the link):\n${link}`);
        log(`\nUse it in your workflow:\n  ${kind}: ${opts.out || KINDS[kind].out}`);
        return result;
      }
      log(`  ${problems.length} problem(s) (${stats}):`);
      for (const p of problems.slice(0, 6)) log(`    - ${clip(p, 140)}`);
      if (problems.length > 6) log(`    ...and ${problems.length - 6} more`);
      last = { raw: got.raw, problems };
      retry = { previous: got.raw, problems };
    }

    // Out of tries. Keep the last answer that parsed, so the work isn't lost.
    const lines = [`None of the ${tries} ${tries === 1 ? 'answer' : 'answers'} passed the validator.`];
    if (last) {
      const draft = `${out}.draft`;
      mkdirSync(dirname(draft), { recursive: true });
      writeFileSync(draft, `${last.raw}\n`);
      lines.push(`The last one is saved as ${draft} (not valid yet). Problems left:`, ...last.problems.map((p) => `  - ${p}`));
      lines.push('Paste that list back to your AI, or open the JSON in the studio, or run again with --tries <more>.');
    }
    throw new DesignError(lines.join('\n'));
  } finally {
    process.off('SIGINT', onSigint);
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
