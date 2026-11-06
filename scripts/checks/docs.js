// Verify generated public assets without writing files, and run the existing content gates.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { execFileSync } from 'node:child_process';
import { checkDepot } from '../../tools/community/validation.js';
import { indexJson } from '../../tools/community/index.js';

const generated = new Map();
const original = { write: fs.writeFileSync, mkdir: fs.mkdirSync, log: console.log };
try {
  fs.writeFileSync = (file, data) => {
    const bytes = typeof data === 'string' ? Buffer.from(data) : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    generated.set(String(file), bytes);
  };
  fs.mkdirSync = () => undefined;
  console.log = () => {};
  syncBuiltinESMExports();
  await import('../docs.js');
  await import('../logo.js');
  const { main } = await import('../../tools/export/cli.js');
  main(['social']);
} finally {
  fs.writeFileSync = original.write;
  fs.mkdirSync = original.mkdir;
  console.log = original.log;
  syncBuiltinESMExports();
}

const changed = [...generated].filter(([file, data]) => !fs.existsSync(file) || !fs.readFileSync(file).equals(data)).map(([file]) => file);
if (changed.length) throw new Error(`Generated assets are stale: ${changed.join(', ')}. Run npm run docs, npm run logo and npm run export -- social.`);
console.log(`assets: ${generated.size} SVG/PNG files match their generators`);

const depot = checkDepot();
if (depot.problems.length) throw new Error('Community validation failed; run node scripts/community.js --check.');
if (fs.readFileSync('community/index.json', 'utf8') !== indexJson(depot.entries)) throw new Error('Community index is stale; run npm run community.');
const gates = [
  ['tools/conductor/gates/links.js', 'index.html', 'preview', 'studio', 'benchmarks', 'comparativa', 'gallery', 'community', 'leaderboard', 'docs', 'README.md', 'README.es.md', 'CONTRIBUTING.md', 'AGENTS.md', 'scripts/README.md'],
  ['tools/conductor/gates/guide-json.js', 'docs/ai/train.md', 'docs/ai/skyline.md'],
];
for (const args of gates) process.stdout.write(execFileSync(process.execPath, args, { encoding: 'utf8' }));
