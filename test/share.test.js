import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { encodeShare, decodeShare } from '../studio/share.js';
import { parseCustomModel } from '../src/custom.js';

const steam = readFileSync(new URL('../examples/trains/steam.json', import.meta.url), 'utf8');

test('a train survives a round trip through a share link', async () => {
  const hash = await encodeShare('train', JSON.parse(steam));
  assert.match(hash, /^#train=[A-Za-z0-9_-]+$/);
  const back = await decodeShare(hash);
  assert.equal(back.kind, 'train');
  assert.deepEqual(JSON.parse(back.text), JSON.parse(steam));
  assert.doesNotThrow(() => parseCustomModel(JSON.parse(back.text)));
});

test('share links are short enough to paste: compression helps a lot', async () => {
  const hash = await encodeShare('train', steam);
  assert.ok(hash.length < steam.length / 2, `${hash.length} vs ${steam.length}`);
});

test('the format is plain raw DEFLATE + base64url, so Node can write links too', async () => {
  const text = JSON.stringify({ name: 'x', buildings: [{ x: 1, w: 2, h: 3 }] });
  const fromNode = `#skyline=${deflateRawSync(text).toString('base64url')}`;
  assert.deepEqual(await decodeShare(fromNode), { kind: 'skyline', text });
});

test('anything else is ignored, and a broken link says so', async () => {
  assert.equal(await decodeShare(''), null);
  assert.equal(await decodeShare('#yours'), null);
  assert.equal(await decodeShare('#train='), null);
  await assert.rejects(decodeShare('#train=AAAA'), /broken or incomplete/);
});
