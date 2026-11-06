import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPreviewServer } from '../scripts/serve.js';

function get(server, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: server.address().port, path, method }, (res) => {
      let text = '';
      res.setEncoding('utf8').on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('the preview serves public assets and rejects private paths, traversal and other methods', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'git-trains-serve-'));
  const root = join(dir, 'repo');
  for (const p of ['preview', 'src', '.git', '.claude', 'repo-other']) mkdirSync(join(root, p), { recursive: true });
  mkdirSync(join(dir, 'repo-other'));
  writeFileSync(join(root, 'preview/index.html'), '<h1>Preview</h1>');
  writeFileSync(join(root, 'src/public.js'), 'export const publicValue = 1;');
  for (const p of ['.env', '.git/config', '.claude/settings.json', 'private.json', 'src/.secret.json']) writeFileSync(join(root, p), 'private fixture');
  writeFileSync(join(dir, 'repo-other/secret.json'), 'sibling fixture');
  const server = createPreviewServer({ root });
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); rmSync(dir, { recursive: true, force: true }); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  assert.equal((await get(server, '/')).text, '<h1>Preview</h1>');
  const asset = await get(server, '/src/public.js');
  assert.equal(asset.status, 200);
  assert.equal(asset.headers['x-content-type-options'], 'nosniff');
  assert.equal((await get(server, '/src/public.js', 'HEAD')).text, '');
  for (const path of ['/.env', '/.git/config', '/.claude/settings.json', '/private.json', '/src/.secret.json', '/..%2frepo-other/secret.json', '/src/%2e%2e%5c.git/config', '/src/%00.js', '/%ZZ']) {
    assert.equal((await get(server, path)).status, 404, path);
  }
  assert.equal((await get(server, '/', 'POST')).status, 405);
  try {
    symlinkSync(join(root, '.git/config'), join(root, 'src/link.json'));
    symlinkSync(join(dir, 'repo-other/secret.json'), join(root, 'src/external.json'));
  } catch (err) {
    if (err.code === 'EPERM') { t.diagnostic('Symlink checks need permission to create symlinks on Windows.'); return; }
    throw err;
  }
  for (const path of ['/src/link.json', '/src/external.json']) assert.equal((await get(server, path)).status, 404, path);
});
