// export/cli.js: focused cli operations.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { THEMES } from '../../src/scene/themes.js';
import { buildSpec } from '../../src/scene/spec.js';
import { sampleStats } from '../../src/demo/sample.js';
import { parseCustomModel } from '../../src/trains/parse.js';
import { parseSkyline } from '../../src/landscape/skyline-parse.js';
import { rasterScene, timeAt, renderFrame } from './raster.js';
import { pngOf } from './png.js';
import { gif } from './gif.js';
import { clip } from './animation.js';
import { socialImage } from './social.js';

// --- Command line ----------------------------------------------------------------

export function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: 'string', default: 'sample/train' },
      theme: { type: 'string', default: 'both' },
      scale: { type: 'string', default: '2' },
      seconds: { type: 'string', default: '4' },
      fps: { type: 'string', default: '25' },
      train: { type: 'string', default: 'auto' },
      skyline: { type: 'string', default: 'city' },
      mode: { type: 'string', default: 'single' },
      user: { type: 'string', default: 'octocat' },
      total: { type: 'string', default: '1400' },
      streak: { type: 'string', default: '12' },
      yesterday: { type: 'string', default: '6' },
      language: { type: 'string', default: 'en' },
    },
  });
  const save = (path, data) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data);
    console.log(`${path} ${(data.length / 1024).toFixed(1)} KB`);
  };

  if (positionals[0] === 'social') {
    // GitHub's repository social preview, and the Open Graph image for the site.
    for (const [path, opts] of /** @type {Array<[string, {width: number, height: number, scale: number, title: number, small: number}]>} */ ([
      ['docs/social.png', { width: 1280, height: 640, scale: 4, title: 3, small: 2 }],
      ['docs/og.png', { width: 1200, height: 630, scale: 3, title: 4, small: 3 }],
    ])) {
      const { canvas, fits } = socialImage(opts);
      if (!fits) throw new Error(`${path}: the title does not fit`);
      save(path, pngOf(canvas, opts.scale));
    }
    return;
  }

  const scale = Number(values.scale);
  if (!Number.isInteger(scale) || scale < 1 || scale > 6) throw new Error('--scale: a whole number from 1 to 6');
  const load = (v, parse) => (v.endsWith('.json') ? parse(JSON.parse(readFileSync(v, 'utf8'))) : v);
  const stats = sampleStats({ total: +values.total, streak: +values.streak, yesterday: +values.yesterday });
  stats.user = values.user;
  const spec = buildSpec(stats, {
    train: load(values.train, parseCustomModel),
    skyline: parseSkyline(load(values.skyline, (raw) => raw)),
    mode: values.mode,
    language: values.language,
  });
  const themes = values.theme === 'both' ? ['light', 'dark'] : [values.theme];
  for (const theme of themes) {
    if (!THEMES[theme]) throw new Error('--theme: light, dark or both');
    const scene = rasterScene(spec, theme);
    const frames = clip(scene, { seconds: +values.seconds, fps: +values.fps });
    const base = themes.length > 1 ? `${values.out}-${theme}` : values.out;
    save(`${base}.png`, pngOf(renderFrame(scene, timeAt(scene)), scale));
    save(`${base}.gif`, gif(frames, scale));
  }
}
