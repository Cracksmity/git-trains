import test from 'node:test';
import assert from 'node:assert/strict';
import { cropScene, zoomScene } from '../../tools/export/zoom.js';
import { buildSpec } from '../../src/scene/spec.js';
import { parseSkyline } from '../../src/landscape/skyline-parse.js';
import { sampleStats } from '../../src/demo/sample.js';

const spec = buildSpec(sampleStats(), { train: 'jalisco', skyline: parseSkyline('jalisco'), mode: 'multi' });

test('zoom crops the region in scene pixels and scales both themes', () => {
  const crop = cropScene(spec, 'dark', { region: { x0: 10, y0: 20, x1: 60, y1: 50 } });
  assert.deepEqual([crop.w, crop.h], [50, 30]);
  const files = zoomScene(spec, { region: { x0: 10, y0: 20, x1: 60, y1: 50 }, scale: 3 });
  for (const data of [files.light, files.dark]) {
    const view = new DataView(data.buffer, data.byteOffset);
    assert.deepEqual([view.getUint32(16), view.getUint32(20)], [150, 90]);
  }
});

test('zoom covers the whole scene by default and can leave the trains out', () => {
  const full = cropScene(spec, 'light');
  assert.ok(full.w > 400 && full.h > 100);
  const withTrains = cropScene(spec, 'light', { region: { y0: 50, y1: 90 } });
  const scenery = cropScene(spec, 'light', { region: { y0: 50, y1: 90 }, trains: false });
  assert.notDeepEqual(withTrains.px, scenery.px);
});

test('zoom rejects an empty region with the scene size in the message', () => {
  assert.throws(() => cropScene(spec, 'light', { region: { x0: 80, x1: 80 } }), /empty region .* in a 448x/);
});
