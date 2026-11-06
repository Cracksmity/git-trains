// export/gif.js: focused gif operations.

import { palettize, upscale } from './palette.js';

// --- GIF ----------------------------------------------------------------------

// GIF's variable-width LZW: codes from minSize + 1 to 12 bits, packed LSB first,
// with a clear code when the 4096-entry table fills up.
export function lzw(minSize, data) {
  const clear = 1 << minSize;
  const eoi = clear + 1;
  const out = [];
  let acc = 0;
  let nbits = 0;
  let size = minSize + 1;
  let next = eoi + 1;
  let dict = new Map();
  const emit = (code) => {
    acc |= code << nbits;
    nbits += size;
    while (nbits >= 8) {
      out.push(acc & 255);
      acc >>>= 8;
      nbits -= 8;
    }
  };
  emit(clear);
  let prefix = data[0];
  for (let i = 1; i < data.length; i++) {
    const key = (prefix << 8) | data[i];
    const code = dict.get(key);
    if (code !== undefined) {
      prefix = code;
      continue;
    }
    emit(prefix);
    if (next === 4096) {
      emit(clear);
      dict = new Map();
      size = minSize + 1;
      next = eoi + 1;
    } else {
      if (next >= 1 << size) size++;
      dict.set(key, next++);
    }
    prefix = data[i];
  }
  emit(prefix);
  emit(eoi);
  if (nbits > 0) out.push(acc & 255);
  return out;
}

// frames: [{ canvas, delay }] (delay in hundredths of a second). Each frame only
// stores the rectangle that changed, with the unchanged pixels transparent.
export function gif(frames, scale = 1) {
  const { w, h } = frames[0].canvas;
  const { palette, indices } = palettize(frames.map((f) => f.canvas), 255);
  const clear = palette.length; // transparent index
  const bits = Math.max(2, Math.ceil(Math.log2(clear + 1)));
  const bytes = [...Buffer.from('GIF89a')];
  const u16 = (n) => bytes.push(n & 255, n >> 8);
  u16(w * scale);
  u16(h * scale);
  bytes.push(0x80 | ((bits - 1) << 4) | (bits - 1), 0, 0);
  for (let i = 0; i < 1 << bits; i++) bytes.push(...(palette[i] ?? [0, 0, 0]));
  bytes.push(0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0); // loop forever

  let prev = null;
  frames.forEach(({ delay }, f) => {
    const cur = indices[f];
    let [x0, y0, x1, y1] = prev ? [w, h, -1, -1] : [0, 0, w - 1, h - 1];
    if (prev) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (cur[y * w + x] === prev[y * w + x]) continue;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
      if (x1 < 0) [x0, y0, x1, y1] = [0, 0, 0, 0]; // nothing changed: one transparent pixel
    }
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    const block = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const i = (y0 + y) * w + x0 + x;
        block[y * bw + x] = prev && cur[i] === prev[i] ? clear : cur[i];
      }
    }
    bytes.push(0x21, 0xf9, 4, (1 << 2) | 1); // keep the previous frame below; transparency on
    u16(delay);
    bytes.push(clear, 0, 0x2c);
    u16(x0 * scale);
    u16(y0 * scale);
    u16(bw * scale);
    u16(bh * scale);
    bytes.push(0, bits);
    const data = lzw(bits, upscale(block, bw, bh, scale));
    for (let i = 0; i < data.length; i += 255) {
      const sub = data.slice(i, i + 255);
      bytes.push(sub.length, ...sub);
    }
    bytes.push(0);
    prev = cur;
  });
  bytes.push(0x3b);
  return Buffer.from(bytes);
}
