import test from 'node:test';
import assert from 'node:assert/strict';
import { GLYPH_H, clean, drawText, textWidth } from '../../src/graphics/font.js';
import { Grid } from '../../src/graphics/pixel.js';

const render = (text) => {
  const w = textWidth(text);
  const g = new Grid(w, GLYPH_H);
  const drawn = drawText(g, text, 0, 0, '#fff');
  assert.equal(drawn, w);
  return Array.from({ length: GLYPH_H }, (_, y) =>
    Array.from({ length: w }, (_, x) => (g.get(x, y) ? '#' : '.')).join(''),
  );
};

test('clean keeps the degree sign and preserves existing character handling', () => {
  assert.equal(clean('Tequila 20° / Rust 15%'), 'TEQUILA 20° / RUST 15%');
  assert.equal(clean('-3°'), '-3°');
  assert.equal(clean('Guadalajara: 0°C!'), 'GUADALAJARA: 0°C');
  assert.equal(clean('Día 1º @user?'), 'DIA 1 USER');
  assert.equal(clean('aéíóúñ_+-.,:/#%'), 'AEIOUN_+-.,:/#%');
  assert.equal(clean(''), '');
});

test('the degree glyph is a small hollow ring in the top rows', () => {
  assert.deepEqual(render('°'), [
    '.#.',
    '#.#',
    '.#.',
    '...',
    '...',
  ]);
  assert.equal(textWidth('°'), 3);
  assert.equal(textWidth('20°'), textWidth('20') + 4);
  assert.equal(textWidth('-3°'), textWidth('3°') + 4);
  assert.equal(textWidth('STREAK 12 DAYS'), 53);
});
