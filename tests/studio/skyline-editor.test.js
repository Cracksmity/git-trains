import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { formatSkyline } from '../../src/studio/skyline/format.js';
import { mountSkylineEditor } from '../../src/studio/skyline/controller.js';
import { parseSkyline, SKYLINES } from '../../src/landscape/skyline-parse.js';

test('the skyline editor can be imported without a DOM', () => {
  assert.equal(typeof mountSkylineEditor, 'function');
  assert.equal(typeof formatSkyline, 'function');
});

const examples = new URL('../../examples/skylines/', import.meta.url);
const skylines = [
  ...Object.entries(SKYLINES).map(([name, skyline]) => [`preset ${name}`, skyline]),
  ...readdirSync(examples).filter((name) => name.endsWith('.json')).map((name) => [
    `example ${name}`, JSON.parse(readFileSync(new URL(name, examples), 'utf8')),
  ]),
];

for (const [name, skyline] of skylines) {
  test(`formatSkyline round trips ${name} through parseSkyline`, () => {
    const before = structuredClone(skyline);
    const formatted = formatSkyline(skyline);
    const decoded = JSON.parse(formatted);
    assert.deepEqual(decoded, before, 'formatting preserves metadata and shorthand tops');
    assert.deepEqual(parseSkyline(decoded), parseSkyline(skyline));
    assert.deepEqual(skyline, before, 'formatting does not mutate the source');
    assert.equal(formatSkyline(decoded), formatted, 'formatting is stable');
    const normalized = parseSkyline(skyline);
    assert.deepEqual(parseSkyline(JSON.parse(formatSkyline(normalized))), normalized);
    for (const building of skyline.buildings) {
      for (const row of building.rows ?? []) {
        assert.ok(formatted.split('\n').some((line) => line.trim().replace(/,$/, '') === JSON.stringify(row)), 'each drawing row has its own line');
      }
    }
  });
}

test('formatSkyline keeps short numeric lists compact without changing strings or nested values', () => {
  const skyline = {
    name: 'A "quoted" skyline', description: 'Notes [1, 2]\nwith Unicode: México',
    buildings: [{ x: -40, rows: ['.#w', '###'] }],
    _numbers: [-40, 0, 2.5, 1e-7], _nested: [[1, 2], [3, 4]],
    _long: Array.from({ length: 40 }, (_, index) => index),
  };
  const formatted = formatSkyline(skyline);
  assert.match(formatted, /"_numbers": \[-40, 0, 2\.5, 1e-7\]/);
  assert.match(formatted, /\[1, 2\]/);
  assert.match(formatted, /"_long": \[\n/);
  assert.deepEqual(JSON.parse(formatted), skyline);
  assert.deepEqual(parseSkyline(JSON.parse(formatted)), parseSkyline(skyline));
});
