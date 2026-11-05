// Share links for the studio: a train or a skyline travels inside the URL, so
// sharing needs no server. The format, also used by the community gallery:
//
//   studio/#train=<data>   or   studio/#skyline=<data>
//
// <data> is the JSON text compressed with raw DEFLATE and encoded as base64url
// without padding. Works in browsers and in Node (both have CompressionStream).

const KINDS = ['train', 'skyline'];

async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
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
  const packed = await pipe(new TextEncoder().encode(text), new CompressionStream('deflate-raw'));
  return `#${kind}=${toBase64Url(packed)}`;
}

// hash: location.hash (with or without "#"). Returns { kind, text } or null when
// there is nothing to read. Throws with a readable message on a broken link.
export async function decodeShare(hash) {
  const m = /^#?(train|skyline)=([A-Za-z0-9_-]+)$/.exec(hash ?? '');
  if (!m) return null;
  try {
    const bytes = await pipe(fromBase64Url(m[2]), new DecompressionStream('deflate-raw'));
    return { kind: m[1], text: new TextDecoder().decode(bytes) };
  } catch {
    throw new Error('This share link is broken or incomplete: copy it again in full.');
  }
}
