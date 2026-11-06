import { posix, count } from './format.js';
// community/cli.js: focused cli operations.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { parseArgs } from 'node:util';

import { ROOT, checkDepot, formatProblems, summaryLine } from './validation.js';
import { indexJson } from './index.js';
import { changedFiles, preview } from './preview.js';
import { reportMarkdown } from './report.js';

// --- Command line ----------------------------------------------------------------

export function main(argv) {
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
