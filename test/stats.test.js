import test from 'node:test';
import assert from 'node:assert/strict';
import { carsFor, stateFor, streakFrom, summarize } from '../src/stats.js';

const day = (date, count) => ({ date, count });

test('vagones crecen con las contribuciones del año', () => {
  assert.equal(carsFor(0), 1);
  assert.equal(carsFor(49), 1);
  assert.equal(carsFor(50), 2);
  assert.equal(carsFor(499), 3);
  assert.equal(carsFor(1000), 5);
  assert.equal(carsFor(99999), 6);
});

test('el estado depende de la actividad de ayer', () => {
  assert.equal(stateFor(0), 'idle');
  assert.equal(stateFor(1), 'slow');
  assert.equal(stateFor(3), 'slow');
  assert.equal(stateFor(4), 'normal');
  assert.equal(stateFor(9), 'normal');
  assert.equal(stateFor(10), 'fast');
});

test('la racha sigue viva si hoy todavía no hay actividad', () => {
  const days = [day('d1', 0), day('d2', 2), day('d3', 1), day('d4', 0)];
  assert.equal(streakFrom(days), 2);
});

test('la racha cuenta hoy cuando ya hay actividad', () => {
  const days = [day('d1', 0), day('d2', 2), day('d3', 1), day('d4', 5)];
  assert.equal(streakFrom(days), 3);
});

test('un día en cero rompe la racha', () => {
  const days = [day('d1', 4), day('d2', 0), day('d3', 1), day('d4', 1)];
  assert.equal(streakFrom(days), 2);
  assert.equal(streakFrom([]), 0);
});

test('summarize une lenguajes repetidos y los ordena por tamaño', () => {
  const s = summarize({
    user: 'ana',
    days: [day('a', 3), day('b', 5), day('c', 0)],
    languages: [
      { name: 'Go', color: null, bytes: 100 },
      { name: 'Rust', color: '#dea584', bytes: 300 },
      { name: 'Go', color: '#00ADD8', bytes: 250 },
    ],
  });
  assert.equal(s.total, 8);
  assert.equal(s.yesterday, 5);
  assert.deepEqual(s.languages.map((l) => l.name), ['Go', 'Rust']);
  assert.equal(s.languages[0].bytes, 350);
  assert.equal(s.languages[0].color, '#00ADD8');
  assert.ok(Math.abs(s.languages.reduce((a, l) => a + l.share, 0) - 1) < 1e-9);
});

test('sin color de la API se usa el oficial del lenguaje', () => {
  const s = summarize({
    user: 'ana',
    days: [day('a', 1), day('b', 1)],
    languages: [{ name: 'Python', color: null, bytes: 10 }],
  });
  assert.equal(s.languages[0].color, '#3572A5');
});
