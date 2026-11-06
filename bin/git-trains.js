#!/usr/bin/env node
// git-trains command line. For now one command: `design`, which has your own AI
// coding CLI (Codex, Antigravity or Claude Code) draw a train or a skyline.
//
//   npx github:Cracksmity/git-trains design train "Osaka Metro 400 series" --photo train.jpg
//   npx github:Cracksmity/git-trains design skyline "Lisbon"

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { DesignError, design } from './design.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const HELP = `git-trains ${pkg.version}

Usage:
  git-trains design train <description> [options]
  git-trains design skyline <description> [options]

Has an AI coding CLI you already use design a train or a skyline from a description
and/or photos, and loops with the validator until the JSON passes. The agent works
in an empty temporary folder and only its final answer is read.

Options:
  --photo <file>    A photo to design from (png, jpg, webp, gif). Repeat for several.
  --ai <name>       codex, gemini (Antigravity's \`agy\`) or claude.
                    Default: the first one installed, in that order.
  --model <slug>    Model for that CLI (default: the CLI's own default).
  --out <file>      Where to write it (default .github/train.json or .github/skyline.json).
  --tries <n>       Attempts, each fed the validator's problems (default 3).
  --force           Replace --out if it already exists.
  --no-preview      Skip the picture in the terminal.
  -h, --help        This text.     -v, --version

Examples:
  git-trains design train "Osaka Metro 400 series" --photo train.jpg
  git-trains design train "red tram with a cream stripe" --ai claude --out my-train.json
  git-trains design skyline "Lisbon" --ai codex --model gpt-6.1-terra
`;

function fail(message, code = 1) {
  console.error(message);
  process.exitCode = code;
}

async function main(argv) {
  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        photo: { type: 'string', multiple: true },
        ai: { type: 'string' },
        model: { type: 'string' },
        out: { type: 'string' },
        tries: { type: 'string' },
        force: { type: 'boolean' },
        'no-preview': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (err) {
    return fail(`${err.message}\n\nRun git-trains --help for the options.`, 2);
  }
  const { values, positionals } = args;
  if (values.version) return console.log(pkg.version);
  const [command, kind, ...words] = positionals;
  if (values.help || !command) return console.log(HELP);
  if (command !== 'design') return fail(`Unknown command "${command}".\n\n${HELP}`, 2);
  if (!kind) return fail('Design a train or a skyline: git-trains design train "<description>"', 2);

  const tries = values.tries === undefined ? 3 : Number(values.tries);
  // The description is the rest of the words, so quoting it is optional.
  const preview = !values['no-preview'] && process.stdout.isTTY && !process.env.NO_COLOR;
  try {
    await design({
      kind,
      description: words.join(' '),
      photos: values.photo ?? [],
      ai: values.ai,
      model: values.model,
      out: values.out,
      tries,
      force: values.force,
      preview,
      columns: process.stdout.columns,
    });
  } catch (err) {
    if (err instanceof DesignError) return fail(`\n${err.message}`);
    throw err;
  }
}

await main(process.argv.slice(2));
