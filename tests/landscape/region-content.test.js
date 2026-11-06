import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseSkyline } from '../../src/landscape/skyline-parse.js';

const read = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');

test('the built-in skylines and the region examples carry their countryside', () => {
  for (const id of ['osaka', 'new-york']) {
    const r = parseSkyline(id).region;
    assert.ok(r && r.houses.length && r.trees.length >= 3 && r.landmark, id);
  }
  const files = readdirSync(new URL('../../examples/skylines/', import.meta.url)).filter((f) => f.endsWith('.json'));
  for (const f of ['mexico-city.json', 'medellin.json', 'guadalajara.json', 'malmo.json']) {
    assert.ok(files.includes(f), f);
    const sky = parseSkyline(JSON.parse(read(`examples/skylines/${f}`)));
    assert.ok(sky.region && sky.region.houses.length && sky.region.trees.length >= 3 && sky.region.landmark, f);
  }
});
