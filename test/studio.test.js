import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { formatTrain } from '../studio/train-editor.js';
import { parseCustomModel } from '../src/custom.js';
import { MODELS, MODEL_ORDER } from '../src/models.js';

const dir = new URL('../examples/trains/', import.meta.url);

test('the studio writes trains the way the examples are written', () => {
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const raw = readFileSync(new URL(f, dir), 'utf8');
    const text = formatTrain(JSON.parse(raw));
    assert.deepEqual(JSON.parse(text), JSON.parse(raw), f);
    assert.doesNotThrow(() => parseCustomModel(JSON.parse(text)), f);
    // Drawing rows stay one per line; short number lists stay on one line.
    assert.doesNotMatch(text, /\[\n\s+\d/, f);
  }
});

test('every catalog model can be loaded into the studio and saved back as a valid train', () => {
  for (const id of MODEL_ORDER) {
    const draft = JSON.parse(JSON.stringify(MODELS[id]));
    draft.bands = draft.bands.join('');
    assert.doesNotThrow(() => parseCustomModel(JSON.parse(formatTrain(draft))), id);
  }
});

test('the studio page loads its editors as modules and offers both tabs', () => {
  const html = readFileSync(new URL('../studio/index.html', import.meta.url), 'utf8');
  assert.match(html, /import \{ mountTrainEditor \} from '\.\/train-editor\.js'/);
  assert.match(html, /import\('\.\/skyline-editor\.js'\)/);
  assert.match(html, /id="tab-train"[\s\S]*id="tab-skyline"/);
});
