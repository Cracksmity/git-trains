// export/png.js: focused png operations.

import { crc32, deflateSync } from 'node:zlib';
import { palettize, upscale } from './palette.js';

// --- PNG ----------------------------------------------------------------------

// data: palette indices (with `palette`, [[r, g, b], ...]) or RGBA bytes (without it).
export function png(w, h, data, palette = null) {
  const bpp = palette ? 1 : 4;
  const raw = Buffer.alloc((w * bpp + 1) * h);
  for (let y = 0; y < h; y++) raw.set(data.subarray(y * w * bpp, (y + 1) * w * bpp), y * (w * bpp + 1) + 1);
  const chunk = (type, body) => {
    const typed = Buffer.concat([Buffer.from(type), body]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([len, typed, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = palette ? 3 : 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    ...(palette ? [chunk('PLTE', Buffer.from(palette.flat()))] : []),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function pngOf(canvas, scale = 1) {
  const { palette, indices } = palettize([canvas], 256);
  return png(canvas.w * scale, canvas.h * scale, upscale(indices[0], canvas.w, canvas.h, scale), palette);
}
