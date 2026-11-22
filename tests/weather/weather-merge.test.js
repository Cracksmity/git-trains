import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpec } from '../../src/scene/spec.js';
import { renderScene } from '../../src/scene/render.js';
import { parseSkyline } from '../../src/landscape/skyline-parse.js';
import { sampleStats } from '../../src/demo/sample.js';
import { Grid } from '../../src/graphics/pixel.js';
import { rasterScene, renderFrame } from '../../tools/export/raster.js';

// The wind and snow designs were drawn in parallel; these check how they meet.
const spec = (weather) => buildSpec(sampleStats(), { weather, train: 'jalisco', skyline: parseSkyline('jalisco'), mode: 'multi' });

test('the gust and the falling flakes keep keyframes of their own', () => {
  const svg = renderScene(spec(Array(3).fill({ state: 'snow', wind: true })));
  const frames = [...svg.matchAll(/@keyframes (w-[\w-]+)\{/g)].map((m) => m[1]);
  assert.equal(frames.length, new Set(frames).size, 'no keyframe is defined twice');
  assert.ok(frames.includes('w-sway') && frames.includes('w-flutter'));
  assert.match(svg, /\.w-flutter\d+\{animation:w-flutter /);
});

test('snow on a crown moves with the crown in the gust', () => {
  const { weather } = rasterScene(spec(['snow', 'snow', 'snow'].map((state) => ({ state, wind: true }))));
  const crowns = weather.filter((layer) => layer.sway);
  assert.ok(crowns.slice(0, 2).every(({ grid }) => grid.cells.includes('@wSnow')), 'the city and Los Altos crowns carry their snow');
  const ground = weather.find((layer) => layer.y === 0 && layer.grid.cells.includes('@wSnow'));
  const index = weather.indexOf(ground);
  for (const crown of crowns.slice(0, 2)) assert.ok(weather.indexOf(crown) > index, 'the swaying crowns are drawn over the painted snow');
});

// Paint one weather layer white on an empty frame, as the wind tests do.
function frameOf(plan, layer, time) {
  const empty = new Grid(0, 0);
  return renderFrame({
    plan, color: () => [255, 255, 255, 1], sky: empty, celestial: empty, stars: { a: empty, b: empty },
    clouds: empty, ground: empty, backdrop: empty, weather: [layer], trains: [],
  }, time);
}

test('the exported flakes flutter like the SVG: one pixel right in the second half of the period', () => {
  const { plan, weather } = rasterScene(spec(['snow', null, null]));
  const flakes = weather.filter((layer) => layer.fall?.flutter);
  assert.equal(flakes.length, 2);
  for (const layer of flakes) {
    const still = { ...layer, fall: { ...layer.fall, flutter: 0 } };
    const early = layer.fall.flutter * 0.25;
    const late = layer.fall.flutter * 0.75;
    assert.deepEqual(frameOf(plan, layer, early).px, frameOf(plan, still, early).px, 'first half: in place');
    const moved = frameOf(plan, layer, late).px;
    const rest = frameOf(plan, still, late).px;
    assert.notDeepEqual(moved, rest);
    for (let y = layer.clip[0]; y < layer.clip[1]; y++) {
      const row = y * plan.W * 3;
      assert.deepEqual(moved.subarray(row + 3, row + plan.W * 3), rest.subarray(row, row + plan.W * 3 - 3), `second half: row ${y} one pixel right`);
    }
  }
});
