// The community depot: trains and skylines that anyone adds with a pull request,
// as community/trains/<id>.json and community/skylines/<id>.json. Each file is
// checked with the Action's own validators plus the depot's rules (the file name
// is the id, an author, a description, 64 KB at most), and every problem is
// listed at once. The gallery (gallery/index.html) reads community/index.json.
//
//   npm run community                    check every file and write community/index.json
//   node scripts/community.js --check    check only (CI on pull requests)
//   node scripts/community.js preview --out <dir> [--since <git rev>] [files...]
//        PNG previews of the given (or changed) files and a report.json (CI)
//   node scripts/community.js report --out <dir>
//        that report as Markdown, for the job summary and the pull request comment (CI)

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { deflateRawSync } from 'node:zlib';
import { parseCustomModel } from '../src/custom.js';
import { parseSkyline } from '../src/skyline.js';
import { buildSpec } from '../src/compose.js';
import { sampleStats } from '../src/sample.js';
import { carsFor, stateFor } from '../src/stats.js';
import { renderCalendar, CALENDAR_THEMES } from '../src/calendar.js';
import { miniTrain, MINI_UP, MINI_H } from '../src/mini.js';
import { Grid } from '../src/pixel.js';
import { drawText, GLYPH_H } from '../src/font.js';
import { png, pngOf, rasterScene, renderFrame, timeAt } from './export.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const KINDS = { train: 'trains', skyline: 'skylines' };
export const MAX_BYTES = 64 * 1024;
const MAX_NAME = 40; // the validators cut names there
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

// --- Checks --------------------------------------------------------------------

const posix = (p) => p.split(sep).join('/');

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

const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function summaryLine({ files, trains, skylines, problems }) {
  const n = problems.reduce((a, p) => a + p.problems.length, 0);
  if (n) return `community: ${count(n, 'problem')} in ${count(problems.length, 'file')}`;
  return `community: ${count(files, 'file')} checked (${count(trains, 'train')}, ${count(skylines, 'skyline')}), no problems`;
}

export function indexJson(entries) {
  return `${JSON.stringify(entries, null, 2)}\n`;
}

// --- Previews ------------------------------------------------------------------

// Sample activity for the previews, with the numbers that matter set exactly.
export function previewStats({ total = 1400, streak = 12, yesterday = 6, user = 'octocat' } = {}) {
  const s = sampleStats({ total, streak, yesterday });
  return { ...s, user, total, streak, yesterday, cars: carsFor(total), state: stateFor(yesterday) };
}
const TRAIN_STATS = { total: 1400, streak: 12, yesterday: 6 }; // 5 cars, normal speed
const SKYLINE_STATS = { total: 200, streak: 12, yesterday: 6 }; // 3 cars: more of the city shows

// RGB canvases, in the same shape renderFrame returns ({ w, h, px }).
const canvas = (w, h, rgb = [0, 0, 0]) => {
  const px = new Uint8Array(w * h * 3);
  for (let i = 0; i < px.length; i += 3) px.set(rgb, i);
  return { w, h, px };
};
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
function blit(dst, src, ox, oy) {
  for (let y = 0; y < src.h; y++) dst.px.set(src.px.subarray(y * src.w * 3, (y + 1) * src.w * 3), ((oy + y) * dst.w + ox) * 3);
}
// Nearest-neighbor enlargement, pixel for pixel.
function grow(src, s) {
  if (s === 1) return src;
  const out = canvas(src.w * s, src.h * s);
  const row = new Uint8Array(out.w * 3);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const i = (y * src.w + ((x / s) | 0)) * 3;
      row[x * 3] = src.px[i];
      row[x * 3 + 1] = src.px[i + 1];
      row[x * 3 + 2] = src.px[i + 2];
    }
    for (let k = 0; k < s; k++) out.px.set(row, (y * s + k) * out.w * 3);
  }
  return out;
}
function paintGrid(dst, grid, ox, oy, color) {
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      const c = grid.cells[y * grid.w + x];
      const X = ox + x;
      const Y = oy + y;
      if (c && X >= 0 && Y >= 0 && X < dst.w && Y < dst.h) dst.px.set(color(c), (Y * dst.w + X) * 3);
    }
  }
}
const truecolor = (c, scale) => {
  const big = grow(c, scale);
  const rgba = new Uint8Array(big.w * big.h * 4);
  for (let i = 0, j = 0; i < big.px.length; i += 3, j += 4) rgba.set([big.px[i], big.px[i + 1], big.px[i + 2], 255], j);
  return png(big.w, big.h, rgba);
};

// The calendar's mini train (head and cars, as many as on the big train) on a
// rail, over the page color GitHub uses in each theme.
const PAGE = { light: '#ffffff', dark: '#0d1117' };
export function miniStrip(model, { cars, stripe, streak }, theme) {
  const mini = miniTrain(model, { stripe, streak });
  const units = [mini.head, ...Array.from({ length: Math.max(0, cars - 1) }, () => mini.car)];
  const length = units.reduce((a, u) => a + u.w + 1, -1);
  const c = canvas(length + 12, MINI_UP + MINI_H + 6, hex(PAGE[theme]));
  const rail = new Grid(c.w, c.h);
  rail.hline(0, 3 + MINI_UP + MINI_H, c.w, CALENDAR_THEMES[theme].rail);
  paintGrid(c, rail, 0, 0, hex);
  let front = 6 + length;
  for (const u of units) {
    paintGrid(c, u.grid, front - u.w, 3, hex);
    front -= u.w + 1;
  }
  return c;
}

// The files a pull request adds or changes in the depot, from git.
export function changedFiles(since, root = ROOT) {
  const out = execFileSync('git', ['diff', '--name-only', '-z', '--diff-filter=AMR', since, '--', 'community/trains', 'community/skylines'], { cwd: root });
  return out.toString('utf8').split('\0').filter(Boolean);
}

const SHEET = 'community-preview.png';
const SHEET_BG = '#f2f4f1';
const SHEET_INK = '#18201b';

// Draws every given file that passes the checks: the train in a scene with sample
// stats, or the skyline behind a catalog train, in light and dark, plus the
// calendar for trains (its mini train as PNG and the animated SVG). Writes them to
// `out`, one sheet with all of them (community-preview.png) and report.json.
export function preview(files, out, root = ROOT) {
  const depot = checkDepot(root);
  mkdirSync(out, { recursive: true });
  const inDepot = (f) => Object.values(KINDS).some((folder) => f.startsWith(`community/${folder}/`));
  const asked = [...new Set(files.map((f) => posix(relative(root, resolve(root, f)))))].filter(inDepot);
  const byFile = new Map(depot.entries.map((e) => [`community/${KINDS[e.kind]}/${e.id}.json`, e]));
  const save = (name, data) => {
    writeFileSync(join(out, name), data);
    return name;
  };
  const blocks = [];
  const previews = [];
  const skipped = [];
  for (const file of asked) {
    const entry = byFile.get(file);
    if (!entry) {
      skipped.push(file);
      continue;
    }
    const value = depot.values.get(file);
    const base = `${entry.kind}-${entry.id}`;
    const isTrain = entry.kind === 'train';
    const stats = previewStats(isTrain ? TRAIN_STATS : SKYLINE_STATS);
    const spec = buildSpec(stats, isTrain ? { train: value } : { skyline: value });
    const images = [];
    const scenes = {};
    const minis = {};
    for (const theme of ['light', 'dark']) {
      const scene = rasterScene({ ...spec, theme }, theme);
      scenes[theme] = renderFrame(scene, timeAt(scene));
      images.push(save(`${base}-${theme}.png`, pngOf(scenes[theme], 2)));
      if (isTrain) {
        const t = spec.tracks[0];
        minis[theme] = miniStrip(t.model, { cars: stats.cars, stripe: t.stripe, streak: stats.streak }, theme);
        images.push(save(`${base}-mini-${theme}.png`, pngOf(minis[theme], 6)));
        images.push(save(`${base}-calendar-${theme}.svg`, renderCalendar(stats, { model: t.model, stripe: t.stripe, label: t.label, theme })));
      }
    }
    blocks.push({ file, scenes, minis });
    previews.push({ ...entry, file, images });
  }

  let sheet = null;
  if (blocks.length) {
    // Light | dark side by side, a label above and the mini trains below, at 2x.
    const M = 8;
    const sw = blocks[0].scenes.light.w;
    const W = M * 3 + sw * 2;
    const MINI = 3;
    const height = (b) => M + GLYPH_H * 2 + 6 + b.scenes.light.h + (b.minis.light ? 6 + b.minis.light.h * MINI : 0);
    const H = blocks.reduce((a, b) => a + height(b), M);
    const c = canvas(W, H, hex(SHEET_BG));
    let y = M;
    for (const b of blocks) {
      const label = new Grid(W, GLYPH_H);
      drawText(label, b.file, 0, 0, SHEET_INK);
      paintGrid(c, grow2(label), M, y, hex);
      y += GLYPH_H * 2 + 6;
      blit(c, b.scenes.light, M, y);
      blit(c, b.scenes.dark, M * 2 + sw, y);
      y += b.scenes.light.h;
      if (b.minis.light) {
        y += 6;
        blit(c, grow(b.minis.light, MINI), M, y);
        blit(c, grow(b.minis.dark, MINI), M * 2 + sw, y);
        y += b.minis.light.h * MINI;
      }
      y += M;
    }
    sheet = save(SHEET, truecolor(c, 2));
  }

  const report = {
    files: depot.files,
    trains: depot.trains,
    skylines: depot.skylines,
    problems: depot.problems,
    changed: asked,
    previews,
    skipped,
    sheet,
    sample: { train: TRAIN_STATS, skyline: SKYLINE_STATS },
  };
  writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

// A label grid at twice its size (the sheet's labels are 2 px per dot).
function grow2(g) {
  const out = new Grid(g.w * 2, g.h * 2);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.cells[y * g.w + x]) out.rect(x * 2, y * 2, 2, 2, g.cells[y * g.w + x]);
  return out;
}

// --- Report --------------------------------------------------------------------

export const MARKER = '<!-- git-trains-community -->';
const COMMENT_MAX = 50000; // characters; GitHub allows 65,536 and some take several bytes

// The report as Markdown. links: { sheet, zip } artifact URLs; site: the Pages root
// for the studio links; readme: the depot rules. Long problem lists and studio
// links are dropped before the text outgrows a comment.
export function reportMarkdown(report, { sheet, zip, site, readme = 'community/README.md' } = {}) {
  const lines = [MARKER, '### Community depot', ''];
  const n = report.problems.reduce((a, p) => a + p.problems.length, 0);
  if (n) {
    lines.push(`**${count(n, 'problem')} in ${count(report.problems.length, 'file')}.** Fix ${n === 1 ? 'it' : 'them'} and push again; this comment updates itself. The list is worded so you can paste it back to the AI that wrote the file.`, '');
    lines.push('```text', formatProblems(report.problems), '```', '');
  } else {
    lines.push(`**All ${count(report.files, 'file')} in the depot pass the checks.**`, '');
  }

  if (report.previews.length) {
    lines.push('| | File | Name | Author | |', '| --- | --- | --- | --- | --- |');
    for (const p of report.previews) {
      const studio = site ? `[Open in the studio](${site}${p.share})` : '';
      // A profile link rather than an @mention: the comment should not ping anyone.
      lines.push(`| ${p.kind} | \`${p.file}\` | ${p.name.replace(/\|/g, '\\|')} | [${p.author}](https://github.com/${p.author}) | ${studio} |`);
    }
    lines.push('');
    const what = report.previews.some((p) => p.kind === 'train')
      ? 'light and dark scenes with sample stats, and the mini train from calendar mode'
      : 'light and dark scenes, behind a catalog train';
    const sheetLink = sheet ? `**[${report.sheet}](${sheet})**` : `\`${report.sheet}\``;
    const zipLink = zip ? `[every image on its own (zip)](${zip})` : 'every image on its own';
    lines.push(`Previews: ${sheetLink} (${what}) and ${zipLink}, with the animated calendar SVGs. Drawn with ${report.sample.train.total} contributions for trains and ${report.sample.skyline.total} for skylines, a ${report.sample.train.streak}-day streak.`, '');
  } else if (!report.changed.length) {
    lines.push('No train or skyline file changed in this pull request, so there is nothing to preview.', '');
  }
  if (report.skipped.length) {
    lines.push(`Not drawn because of the problems above: ${report.skipped.map((f) => `\`${f}\``).join(', ')}.`, '');
  }
  if (report.changed.length > 1) {
    lines.push(`This pull request changes ${count(report.changed.length, 'file')}; the depot asks for one train or skyline per pull request, so each one can be reviewed and credited on its own.`, '');
  }
  lines.push(`Before merging, check the [depot rules](${readme}): no logos or lettering, a description of the real train or city, one train or skyline per pull request.`);

  let text = lines.join('\n');
  if (text.length > COMMENT_MAX) text = text.replace(/\[Open in the studio\]\([^)]*\)/g, '');
  if (text.length > COMMENT_MAX) text = `${text.slice(0, COMMENT_MAX)}\n\n(cut short: see the job log for everything)`;
  return text;
}

// --- Command line ----------------------------------------------------------------

function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      check: { type: 'boolean', default: false },
      out: { type: 'string', default: 'sample/community' },
      since: { type: 'string' },
    },
  });
  const annotate = process.env.GITHUB_ACTIONS === 'true';
  const [command, ...files] = positionals;

  if (command === 'preview') {
    const list = values.since ? [...changedFiles(values.since), ...files] : files;
    const report = preview(list, resolve(values.out));
    if (report.problems.length) console.log(`${formatProblems(report.problems)}\n`);
    for (const p of report.previews) console.log(`${p.file}: ${p.images.length} image(s)`);
    if (report.sheet) console.log(posix(join(values.out, report.sheet)));
    console.log(summaryLine(report));
    return;
  }
  if (command === 'report') {
    const report = JSON.parse(readFileSync(join(values.out, 'report.json'), 'utf8'));
    const repo = process.env.GITHUB_REPOSITORY;
    const [owner, name] = repo ? repo.split('/') : [];
    const site = owner ? `https://${owner.toLowerCase()}.github.io/${name}/` : null;
    const readme = repo ? `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${repo}/blob/HEAD/community/README.md` : undefined;
    process.stdout.write(`${reportMarkdown(report, { sheet: process.env.SHEET_URL || null, zip: process.env.ZIP_URL || null, site, readme })}\n`);
    return;
  }
  if (command) throw new Error(`Unknown command "${command}" (preview, report, or none)`);

  const depot = checkDepot();
  if (depot.problems.length) {
    console.log(`${formatProblems(depot.problems, { annotate })}\n`);
    console.log(summaryLine(depot));
    process.exitCode = 1;
    return;
  }
  if (!values.check) {
    const path = join(ROOT, 'community', 'index.json');
    const next = indexJson(depot.entries);
    const prev = existsSync(path) ? readFileSync(path, 'utf8') : '';
    if (prev !== next) writeFileSync(path, next);
    console.log(`community/index.json ${prev === next ? 'is up to date' : 'written'} (${count(depot.entries.length, 'entry', 'entries')})`);
  }
  console.log(summaryLine(depot));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2));
