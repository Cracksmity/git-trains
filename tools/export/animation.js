// export/animation.js: focused animation operations.

import { timeAt, renderFrame } from './raster.js';

// A clip of `seconds` sampled every `delay` hundredths: centered on the moment the
// first train passes its resting place, so a moving one crosses the middle.
export function clip(scene, { seconds = 4, fps = 25 } = {}) {
  const delay = Math.max(2, Math.round(100 / fps));
  const n = Math.max(1, Math.round((seconds * 100) / delay));
  const t0 = scene.trains[0].moving ? timeAt(scene) - (n * delay) / 200 : 0;
  const frames = [];
  for (let i = 0; i < n; i++) {
    const canvas = renderFrame(scene, t0 + (i * delay) / 100);
    const last = frames.at(-1);
    if (last && last.canvas.px.every((v, j) => v === canvas.px[j])) last.delay += delay;
    else frames.push({ canvas, delay });
  }
  return frames;
}
