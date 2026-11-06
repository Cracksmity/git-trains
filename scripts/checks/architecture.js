// Parse the real ES modules without evaluating them; reject broken imports and dependency cycles.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SourceTextModule } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const roots = ['src', 'assets', 'config', 'bin', 'scripts', 'tools', 'tests'];
const core = new Set(['activity', 'graphics', 'trains', 'landscape', 'scene', 'cards', 'calendar', 'review', 'validation', 'demo', 'sharing']);
const graph = new Map();
const problems = [];
const key = (file) => relative(root, file).split(sep).join('/');

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(file) : file.endsWith('.js') ? [file] : [];
  });
}

for (const file of roots.flatMap((directory) => walk(resolve(root, directory)))) {
  const name = key(file);
  const source = readFileSync(file, 'utf8');
  if (source.split(/\r?\n/).length - 1 > 400) problems.push(`${name}: exceeds 400 lines; split by responsibility`);
  const module = new SourceTextModule(source, { identifier: name });
  const specifiers = [...module.dependencySpecifiers];
  // Literal dynamic imports are part of the browser dependency graph too.
  if (name.startsWith('src/') || name.startsWith('assets/')) {
    for (const match of source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) specifiers.push(match[1]);
  }
  const edges = [];
  for (const specifier of specifiers) {
    if (!specifier.startsWith('.')) {
      if ((name.startsWith('assets/') || (name.startsWith('src/') && !/^src\/(action|cli|github)\//.test(name))) && specifier.startsWith('node:')) {
        problems.push(`${name}: browser-compatible code imports ${specifier}`);
      }
      continue;
    }
    const target = resolve(dirname(file), specifier);
    try { if (!statSync(target).isFile()) throw new Error('not a file'); }
    catch { problems.push(`${name}: missing import ${specifier}`); continue; }
    const targetKey = key(target);
    if (name.startsWith('src/') && /^(tools|scripts|tests|assets)\//.test(targetKey)) problems.push(`${name}: imports outer-layer ${targetKey}`);
    if (name.startsWith('src/') && core.has(name.split('/')[1]) && /^src\/(action|cli|github|studio|browser)\//.test(targetKey)) problems.push(`${name}: core imports adapter ${targetKey}`);
    edges.push(targetKey);
  }
  graph.set(name, edges);
}

const active = new Set();
const complete = new Set();
function visit(name, chain = []) {
  if (active.has(name)) { problems.push(`cycle: ${[...chain.slice(chain.indexOf(name)), name].join(' -> ')}`); return; }
  if (complete.has(name)) return;
  active.add(name);
  for (const next of graph.get(name) ?? []) visit(next, [...chain, name]);
  active.delete(name);
  complete.add(name);
}
for (const name of graph.keys()) visit(name);
// Conductor tasks refer to source files in shell strings as well as normal imports.
for (const entry of readdirSync(resolve(root, 'tools/conductor/tasks')).filter((name) => name.endsWith('.json'))) {
  const task = JSON.parse(readFileSync(resolve(root, 'tools/conductor/tasks', entry), 'utf8'));
  for (const gate of task.gates ?? []) {
    for (const match of gate.matchAll(/(?:src|tests|scripts|tools)\/[\w./-]+\.(?:js|md)/g)) {
      try { if (!statSync(resolve(root, match[0])).isFile()) throw new Error('not a file'); }
      catch { problems.push(`${entry}: gate references missing ${match[0]}`); }
    }
  }
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`architecture: ${graph.size} modules; imports resolve, no cycles, layer boundaries and file lengths valid`);
}
