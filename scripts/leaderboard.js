// The AI leaderboard's data: merges the conductor's run logs into docs/leaderboard.json,
// the file leaderboard/index.html reads. Only safe fields are kept (date, task id,
// route, backend, model, effort, attempt, passed or failed and which gate failed,
// seconds, tokens), never prompts, paths or the user name, and a run that is already
// in the file is not added again, so logs from several machines can pile up.
//
//   npm run leaderboard                       merge the logs of every checkout of this
//                                             repository on this machine (git worktrees included)
//   npm run leaderboard -- --from <file>...   also merge these: another machine's runs.jsonl,
//                                             or another copy of docs/leaderboard.json
//   npm run leaderboard -- --dry-run          say what would change, write nothing
//
// On a merge conflict in docs/leaderboard.json keep both sides and run this again.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { mergeRuns, parseRuns, serialize } from '../leaderboard/board.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const BOARD = join(ROOT, 'docs', 'leaderboard.json');

// The conductor logs inside the checkout it runs from, and each session here works in
// its own git worktree, so the runs of a project are spread over its worktrees.
export function localLogs(root = ROOT) {
  const folders = [root];
  try {
    const list = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    for (const line of list.split('\n')) if (line.startsWith('worktree ')) folders.push(line.slice('worktree '.length).trim());
  } catch {} // no git here: this checkout's log only
  const files = folders.map((f) => join(f, '.conductor', 'runs.jsonl')).filter((f) => existsSync(f));
  return [...new Set(files.map((f) => resolve(f)))];
}

// The merge, without touching the disk: what the board would hold afterwards.
export function merge({ board = '', files = [] }) {
  const current = parseRuns(board);
  let dropped = current.dropped;
  const lists = [current.runs];
  for (const file of files) {
    const read = parseRuns(readFileSync(file, 'utf8'));
    dropped += read.dropped;
    lists.push(read.runs);
  }
  const runs = mergeRuns(...lists);
  return { runs, added: runs.length - current.runs.length, dropped, text: serialize(runs) };
}

function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: { from: { type: 'string', multiple: true }, 'dry-run': { type: 'boolean' }, out: { type: 'string' } },
  });
  const out = values.out ? resolve(values.out) : BOARD;
  const board = existsSync(out) ? readFileSync(out, 'utf8') : '';
  for (const f of values.from ?? []) if (!existsSync(resolve(f))) throw new Error(`No such file: ${f}`);
  const files = [...localLogs(), ...(values.from ?? []).map((f) => resolve(f))];
  const result = merge({ board, files });

  const changed = result.text !== board;
  if (changed && !values['dry-run']) writeFileSync(out, result.text);
  console.log(
    `leaderboard: ${files.length} log file${files.length === 1 ? '' : 's'} read, ${result.added} new run${result.added === 1 ? '' : 's'}, ` +
      `${result.runs.length} in total${result.dropped ? `, ${result.dropped} record${result.dropped === 1 ? '' : 's'} dropped (not in the safe shape)` : ''}. ` +
      `${changed ? (values['dry-run'] ? 'Would write' : 'Wrote') : 'Already up to date:'} ${relative(process.cwd(), out) || out}`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2));
