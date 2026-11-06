import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { lzw, gif } from '../../tools/export/gif.js';
import { png, pngOf } from '../../tools/export/png.js';
import { rasterScene, renderFrame, trainX, timeAt } from '../../tools/export/raster.js';
import { clip } from '../../tools/export/animation.js';
import { socialImage } from '../../tools/export/social.js';
import { buildSpec } from '../../src/scene/spec.js';
import { sampleStats } from '../../src/demo/sample.js';

// GIF LZW decoder, written from the spec, to check the encoder against.
function unlzw(minSize, bytes) {
  const clear = 1 << minSize;
  const eoi = clear + 1;
  let size = minSize + 1;
  let table = [];
  const reset = () => {
    table = Array.from({ length: clear }, (_, i) => [i]);
    table.push(null, null);
    size = minSize + 1;
  };
  reset();
  const out = [];
  let pos = 0;
  let prev = null;
  const read = () => {
    let code = 0;
    for (let i = 0; i < size; i++, pos++) code |= ((bytes[pos >> 3] >> (pos & 7)) & 1) << i;
    return code;
  };
  for (;;) {
    const code = read();
    if (code === clear) {
      reset();
      prev = null;
      continue;
    }
    if (code === eoi) break;
    let entry;
    if (code < table.length) entry = table[code];
    else if (code === table.length && prev) entry = [...prev, prev[0]];
    else throw new Error(`bad code ${code}`);
    out.push(...entry);
    if (prev && table.length < 4096) table.push([...prev, entry[0]]);
    if (table.length === 1 << size && size < 12) size++;
    prev = entry;
  }
  return out;
}

test('LZW round-trips runs, noise and tables that fill up', () => {
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cases = [
    [2, [0, 1, 2, 3, 3, 3, 3, 0]],
    [2, new Array(5000).fill(1)],
    [8, Array.from({ length: 30000 }, () => Math.floor(rand() * 256))],
    [5, Array.from({ length: 20000 }, (_, i) => (rand() < 0.9 ? (i >> 6) & 31 : Math.floor(rand() * 32)))],
  ];
  for (const [bits, data] of cases) assert.deepEqual(unlzw(bits, lzw(bits, data)), [...data], `${bits} bits`);
});

// The blocks of a GIF: screen size, global palette and each frame's rectangle and pixels.
function readGif(buf) {
  assert.equal(buf.subarray(0, 6).toString(), 'GIF89a');
  const w = buf.readUInt16LE(6);
  const h = buf.readUInt16LE(8);
  let pos = 13 + 3 * (1 << ((buf[10] & 7) + 1));
  const frames = [];
  let delay = 0;
  const blocks = () => {
    const parts = [];
    while (buf[pos]) {
      parts.push(buf.subarray(pos + 1, pos + 1 + buf[pos]));
      pos += buf[pos] + 1;
    }
    pos++;
    return Buffer.concat(parts);
  };
  while (buf[pos] !== 0x3b) {
    if (buf[pos] === 0x21) {
      if (buf[pos + 1] === 0xf9) delay = buf.readUInt16LE(pos + 4);
      pos += 2;
      blocks();
    } else {
      assert.equal(buf[pos], 0x2c);
      const [x, y, fw, fh] = [1, 3, 5, 7].map((o) => buf.readUInt16LE(pos + o));
      const bits = buf[pos + 10];
      pos += 11;
      const px = unlzw(bits, blocks());
      assert.equal(px.length, fw * fh);
      frames.push({ x, y, w: fw, h: fh, px, delay });
    }
  }
  return { w, h, frames };
}

const spec = (yesterday, theme = 'light') =>
  buildSpec(sampleStats({ total: 900, streak: 8, yesterday }), { train: 'metro-orange', theme });

test('the GIF is a few seconds of the scene, scaled pixel for pixel', () => {
  const scene = rasterScene(spec(6));
  const frames = clip(scene, { seconds: 2, fps: 20 });
  const out = readGif(gif(frames, 2));
  assert.equal(out.w, 448 * 2);
  assert.equal(out.h, 100 * 2);
  assert.equal(out.frames.length, frames.length);
  assert.equal(out.frames.reduce((s, f) => s + f.delay, 0), 200);
  assert.deepEqual([out.frames[0].w, out.frames[0].h], [896, 200]);
  // Every 2x2 block is one color.
  for (const f of out.frames) {
    assert.ok(f.x % 2 === 0 && f.y % 2 === 0 && f.w % 2 === 0 && f.h % 2 === 0);
    for (let y = 0; y < f.h; y += 2) {
      for (let x = 0; x < f.w; x += 2) {
        const v = f.px[y * f.w + x];
        assert.ok(f.px[y * f.w + x + 1] === v && f.px[(y + 1) * f.w + x] === v && f.px[(y + 1) * f.w + x + 1] === v);
      }
    }
  }
  // Later frames store only what changed: the rest of their rectangle is transparent.
  const clear = out.frames[0].px.reduce((a, b) => Math.max(a, b)) + 1;
  assert.ok(out.frames.slice(1).every((f) => f.px.includes(clear)));
});

test('frames follow the SVG timing: 1 px steps, centered on the resting place', () => {
  const scene = rasterScene(spec(14));
  const tr = scene.trains[0];
  assert.equal(trainX(tr, timeAt(scene)), tr.rest);
  const step = tr.st.dur / tr.steps;
  const t = timeAt(scene);
  assert.equal(trainX(tr, t + step), tr.rest + 1);
  assert.equal(trainX(tr, t + tr.st.dur), tr.rest);
  // A stopped train stays put, and opens its doors.
  const idle = rasterScene(spec(0));
  assert.equal(trainX(idle.trains[0], 5), idle.trains[0].rest);
  const closed = renderFrame(idle, 0).px;
  const open = renderFrame(idle, 3).px;
  assert.notDeepEqual(closed, open);
});

test('the train is painted with its own colors where the SVG puts it', () => {
  const scene = rasterScene(spec(0));
  const tr = scene.trains[0];
  const frame = renderFrame(scene, 0);
  const g = tr.train.layers.body;
  let checked = 0;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const c = g.get(x, y);
      // Skip pixels that other layers (lit windows, sign text, wheel marks) cover.
      if (!c || ['lit', 'led', 'wa'].some((l) => tr.train.layers[l].get(x, y))) continue;
      const i = ((tr.y0 + y) * frame.w + tr.rest + x) * 3;
      assert.equal('#' + [...frame.px.subarray(i, i + 3)].map((v) => v.toString(16).padStart(2, '0')).join(''), c.toLowerCase());
      checked++;
    }
  }
  assert.ok(checked > 1000);
});

test('PNGs: an indexed image at the asked size, and the social images', () => {
  const read = (buf) => {
    assert.deepEqual([...buf.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: buf[25] };
  };
  const scene = rasterScene(spec(6, 'dark'), 'dark');
  assert.deepEqual(read(pngOf(renderFrame(scene, 1), 3)), { w: 1344, h: 300, type: 3 });
  assert.deepEqual(read(png(2, 1, new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]))), { w: 2, h: 1, type: 6 });
  const tiny = png(2, 1, new Uint8Array([1, 0]), [[0, 0, 0], [9, 9, 9]]);
  const idat = tiny.indexOf('IDAT');
  assert.deepEqual([...inflateSync(tiny.subarray(idat + 4, idat + 4 + tiny.readUInt32BE(idat - 4)))], [0, 1, 0]);
  for (const [width, height, scale, title, small] of [[1280, 640, 4, 3, 2], [1200, 630, 3, 4, 3]]) {
    const { canvas, fits } = socialImage({ width, height, scale, title, small });
    assert.ok(fits);
    assert.deepEqual(read(pngOf(canvas, scale)), { w: width, h: height, type: 3 });
  }
});
