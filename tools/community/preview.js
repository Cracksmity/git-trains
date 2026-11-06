import { png } from '../export/png.js';
// community/preview.js: focused preview operations.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { buildSpec } from '../../src/scene/spec.js';
import { sampleStats } from '../../src/demo/sample.js';
import { carsFor, stateFor } from '../../src/activity/stats.js';
import { renderCalendar, CALENDAR_THEMES } from '../../src/calendar/render.js';
import { miniTrain, MINI_UP, MINI_H } from '../../src/trains/mini.js';
import { Grid } from '../../src/graphics/pixel.js';
import { drawText, GLYPH_H } from '../../src/graphics/font.js';
import { pngOf } from '../export/png.js';
import { rasterScene, renderFrame, timeAt } from '../export/raster.js';
import { ROOT, KINDS, checkDepot } from './validation.js';
import { posix } from './format.js';


// --- Previews ------------------------------------------------------------------

// Sample activity for the previews, with the numbers that matter set exactly.
export function previewStats({ total = 1400, streak = 12, yesterday = 6, user = 'octocat' } = {}) {
  const s = sampleStats({ total, streak, yesterday });
  return { ...s, user, total, streak, yesterday, cars: carsFor(total), state: stateFor(yesterday) };
}

const TRAIN_STATS = { total: 1400, streak: 12, yesterday: 6 };

// 5 cars, normal speed
const SKYLINE_STATS = { total: 200, streak: 12, yesterday: 6 };

function blit(dst, src, ox, oy) {
  for (let y = 0; y < src.h; y++) dst.px.set(src.px.subarray(y * src.w * 3, (y + 1) * src.w * 3), ((oy + y) * dst.w + ox) * 3);
}

// Nearest-neighbor enlargement, pixel for pixel.
export function grow(src, s) {
  if (s === 1) return src;
  const out = canvas(src.w * s, src.h * s);
  const row = new Uint8Array(out.w * 3);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const i = (y * src.w + ((x / s) | 0)) * 3;
      row[x * 3] = src.px[i];
      row[x * 3 + 1] = src.px[i + 1];
      row[x * 3 + 2] = src.px[i + 2];
    }
    for (let k = 0; k < s; k++) out.px.set(row, (y * s + k) * out.w * 3);
  }
  return out;
}

function paintGrid(dst, grid, ox, oy, color) {
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      const c = grid.cells[y * grid.w + x];
      const X = ox + x;
      const Y = oy + y;
      if (c && X >= 0 && Y >= 0 && X < dst.w && Y < dst.h) dst.px.set(color(c), (Y * dst.w + X) * 3);
    }
  }
}

// The calendar's mini train (head and cars, as many as on the big train) on a
// rail, over the page color GitHub uses in each theme.
const PAGE = { light: '#ffffff', dark: '#0d1117' };

export function miniStrip(model, { cars, stripe, streak }, theme) {
  const mini = miniTrain(model, { stripe, streak });
  const units = [mini.head, ...Array.from({ length: Math.max(0, cars - 1) }, () => mini.car)];
  const length = units.reduce((a, u) => a + u.w + 1, -1);
  const c = canvas(length + 12, MINI_UP + MINI_H + 6, hex(PAGE[theme]));
  const rail = new Grid(c.w, c.h);
  rail.hline(0, 3 + MINI_UP + MINI_H, c.w, CALENDAR_THEMES[theme].rail);
  paintGrid(c, rail, 0, 0, hex);
  let front = 6 + length;
  for (const u of units) {
    paintGrid(c, u.grid, front - u.w, 3, hex);
    front -= u.w + 1;
  }
  return c;
}

// The files a pull request adds or changes in the depot, from git.
export function changedFiles(since, root = ROOT) {
  const out = execFileSync('git', ['diff', '--name-only', '-z', '--diff-filter=AMR', since, '--', 'community/trains', 'community/skylines'], { cwd: root });
  return out.toString('utf8').split('\0').filter(Boolean);
}

const SHEET = 'community-preview.png';

const SHEET_BG = '#f2f4f1';

const SHEET_INK = '#18201b';

// Draws every given file that passes the checks: the train in a scene with sample
// stats, or the skyline behind a catalog train, in light and dark, plus the
// calendar for trains (its mini train as PNG and the animated SVG). Writes them to
// `out`, one sheet with all of them (community-preview.png) and report.json.
export function preview(files, out, root = ROOT) {
  const depot = checkDepot(root);
  mkdirSync(out, { recursive: true });
  const inDepot = (f) => Object.values(KINDS).some((folder) => f.startsWith(`community/${folder}/`));
  const asked = [...new Set(files.map((f) => posix(relative(root, resolve(root, f)))))].filter(inDepot);
  const byFile = new Map(depot.entries.map((e) => [`community/${KINDS[e.kind]}/${e.id}.json`, e]));
  const save = (name, data) => {
    writeFileSync(join(out, name), data);
    return name;
  };
  const blocks = [];
  const previews = [];
  const skipped = [];
  for (const file of asked) {
    const entry = byFile.get(file);
    if (!entry) {
      skipped.push(file);
      continue;
    }
    const value = depot.values.get(file);
    const base = `${entry.kind}-${entry.id}`;
    const isTrain = entry.kind === 'train';
    const stats = previewStats(isTrain ? TRAIN_STATS : SKYLINE_STATS);
    const spec = buildSpec(stats, isTrain ? { train: value } : { skyline: value });
    const images = [];
    const scenes = {};
    const minis = {};
    for (const theme of ['light', 'dark']) {
      const scene = rasterScene({ ...spec, theme }, theme);
      scenes[theme] = renderFrame(scene, timeAt(scene));
      images.push(save(`${base}-${theme}.png`, pngOf(scenes[theme], 2)));
      if (isTrain) {
        const t = spec.tracks[0];
        minis[theme] = miniStrip(t.model, { cars: stats.cars, stripe: t.stripe, streak: stats.streak }, theme);
        images.push(save(`${base}-mini-${theme}.png`, pngOf(minis[theme], 6)));
        images.push(save(`${base}-calendar-${theme}.svg`, renderCalendar(stats, { model: t.model, stripe: t.stripe, label: t.label, theme })));
      }
    }
    blocks.push({ file, scenes, minis });
    previews.push({ ...entry, file, images });
  }

  let sheet = null;
  if (blocks.length) {
    // Light | dark side by side, a label above and the mini trains below, at 2x.
    const M = 8;
    const sw = blocks[0].scenes.light.w;
    const W = M * 3 + sw * 2;
    const MINI = 3;
    const height = (b) => M + GLYPH_H * 2 + 6 + b.scenes.light.h + (b.minis.light ? 6 + b.minis.light.h * MINI : 0);
    const H = blocks.reduce((a, b) => a + height(b), M);
    const c = canvas(W, H, hex(SHEET_BG));
    let y = M;
    for (const b of blocks) {
      const label = new Grid(W, GLYPH_H);
      drawText(label, b.file, 0, 0, SHEET_INK);
      paintGrid(c, grow2(label), M, y, hex);
      y += GLYPH_H * 2 + 6;
      blit(c, b.scenes.light, M, y);
      blit(c, b.scenes.dark, M * 2 + sw, y);
      y += b.scenes.light.h;
      if (b.minis.light) {
        y += 6;
        blit(c, grow(b.minis.light, MINI), M, y);
        blit(c, grow(b.minis.dark, MINI), M * 2 + sw, y);
        y += b.minis.light.h * MINI;
      }
      y += M;
    }
    sheet = save(SHEET, truecolor(c, 2));
  }

  const report = {
    files: depot.files,
    trains: depot.trains,
    skylines: depot.skylines,
    problems: depot.problems,
    changed: asked,
    previews,
    skipped,
    sheet,
    sample: { train: TRAIN_STATS, skyline: SKYLINE_STATS },
  };
  writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

// A label grid at twice its size (the sheet's labels are 2 px per dot).
function grow2(g) {
  const out = new Grid(g.w * 2, g.h * 2);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.cells[y * g.w + x]) out.rect(x * 2, y * 2, 2, 2, g.cells[y * g.w + x]);
  return out;
}

// 3 cars: more of the city shows

// RGB canvases, in the same shape renderFrame returns ({ w, h, px }).
export const canvas = (w, h, rgb = [0, 0, 0]) => {
  const px = new Uint8Array(w * h * 3);
  for (let i = 0; i < px.length; i += 3) px.set(rgb, i);
  return { w, h, px };
};

export const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

export const truecolor = (c, scale) => {
  const big = grow(c, scale);
  const rgba = new Uint8Array(big.w * big.h * 4);
  for (let i = 0, j = 0; i < big.px.length; i += 3, j += 4) rgba.set([big.px[i], big.px[i + 1], big.px[i + 2], 255], j);
  return png(big.w, big.h, rgba);
};
