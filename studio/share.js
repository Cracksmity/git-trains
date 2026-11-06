// Share links for the studio: a train or a skyline travels inside the URL, so
// sharing needs no server. The format, also used by the community gallery:
//
//   studio/#train=<data>   or   studio/#skyline=<data>
//
// <data> is the JSON text compressed with raw DEFLATE and encoded as base64url
// without padding. Works in browsers and in Node (both have CompressionStream).

const KINDS = ['train', 'skyline'];
export const MAX_SHARE_BYTES = 256 * 1024;
const MAX_PACKED_BYTES = MAX_SHARE_BYTES + 1024;
export const MAX_SHARE_LENGTH = Math.ceil(MAX_PACKED_BYTES / 3) * 4;

class ShareLimitError extends Error {
  constructor() { super('This share link is too large: use at most 256 KB of JSON.'); }
}

async function pipe(bytes, stream, limit) {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new ShareLimitError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength; }
  return out;
}

function toBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// value: a train or skyline object (or its JSON text). Returns the hash, e.g. "#train=...".
export async function encodeShare(kind, value) {
  if (!KINDS.includes(kind)) throw new Error(`Unknown kind "${kind}"`);
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text.length > MAX_SHARE_BYTES) throw new ShareLimitError();
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > MAX_SHARE_BYTES) throw new ShareLimitError();
  const packed = await pipe(bytes, new CompressionStream('deflate-raw'), MAX_PACKED_BYTES);
  return `#${kind}=${toBase64Url(packed)}`;
}

// hash: location.hash (with or without "#"). Returns { kind, text } or null when
// there is nothing to read. Throws with a readable message on a broken link.
export async function decodeShare(hash) {
  if (typeof hash === 'string' && /^#?(train|skyline)=/.test(hash) && hash.length > MAX_SHARE_LENGTH + 9) throw new ShareLimitError();
  const m = /^#?(train|skyline)=([A-Za-z0-9_-]+)$/.exec(hash ?? '');
  if (!m) return null;
  try {
    if (m[2].length > MAX_SHARE_LENGTH) throw new ShareLimitError();
    const bytes = await pipe(fromBase64Url(m[2]), new DecompressionStream('deflate-raw'), MAX_SHARE_BYTES);
    return { kind: m[1], text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch (err) {
    if (err instanceof ShareLimitError) throw err;
    throw new Error('This share link is broken or incomplete: copy it again in full.');
  }
}
