// Minimal static server for the playground (no dependencies).
// node scripts/serve.js [port]

import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PUBLIC_DIRS = new Set(['preview', 'studio', 'src', 'gallery', 'community', 'leaderboard', 'docs', 'examples', 'benchmarks', 'comparativa', 'assets']);
const PUBLIC_FILES = new Set(['index.html', 'README.md', 'README.es.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'LICENSE']);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
  '.yml': 'text/plain; charset=utf-8',
};

function publicPath(base, file) {
  const rel = relative(base, file);
  const parts = rel.split(sep);
  return rel && !isAbsolute(rel) && !parts.some((p) => p.startsWith('.')) &&
    (PUBLIC_FILES.has(rel) || (PUBLIC_DIRS.has(parts[0]) && Object.hasOwn(TYPES, extname(file))));
}

export function createPreviewServer({ root: directory = root } = {}) {
  const base = realpathSync(directory);
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD', 'content-type': 'text/plain' });
      res.end('method not allowed');
      return;
    }
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (path.includes('\\') || path.includes('\0') || path.split('/').some((p) => p === '..' || p.startsWith('.'))) throw new Error('private path');
      if (path === '/') path = '/preview/index.html';
      else if (path.endsWith('/')) path += 'index.html'; // like GitHub Pages
      const file = resolve(base, `.${path}`);
      if (!publicPath(base, file)) throw new Error('not a public asset');
      // Check the resolved target too: a public symlink must not expose private files.
      const actual = await realpath(file);
      if (!publicPath(base, actual)) throw new Error('not a public asset');
      const data = await readFile(actual);
      res.writeHead(200, { 'content-type': TYPES[extname(actual)] ?? 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.argv[2] || process.env.PORT || 4173);
  const server = createPreviewServer();
  server.listen(port, '127.0.0.1', () => console.log(`Playground at http://127.0.0.1:${/** @type {import('node:net').AddressInfo} */ (server.address()).port}`));
}
