import test from 'node:test';
import assert from 'node:assert/strict';
import { carsFor, stateFor, streakFrom, summarize } from '../../src/activity/stats.js';

const day = (date, count) => ({ date, count });

test('cars grow with the year of contributions', () => {
  assert.equal(carsFor(0), 1);
  assert.equal(carsFor(49), 1);
  assert.equal(carsFor(50), 2);
  assert.equal(carsFor(499), 3);
  assert.equal(carsFor(1000), 5);
  assert.equal(carsFor(99999), 6);
});

test('the state depends on yesterday', () => {
  assert.equal(stateFor(0), 'idle');
  assert.equal(stateFor(1), 'slow');
  assert.equal(stateFor(3), 'slow');
  assert.equal(stateFor(4), 'normal');
  assert.equal(stateFor(9), 'normal');
  assert.equal(stateFor(10), 'fast');
});

test('the streak stays alive when there is nothing yet today', () => {
  const days = [day('d1', 0), day('d2', 2), day('d3', 1), day('d4', 0)];
  assert.equal(streakFrom(days), 2);
});

test('the streak counts today once there is activity', () => {
  const days = [day('d1', 0), day('d2', 2), day('d3', 1), day('d4', 5)];
  assert.equal(streakFrom(days), 3);
});

test('a day at zero breaks the streak', () => {
  const days = [day('d1', 4), day('d2', 0), day('d3', 1), day('d4', 1)];
  assert.equal(streakFrom(days), 2);
  assert.equal(streakFrom([]), 0);
});

test('summarize merges repeated languages and sorts them by size', () => {
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

test('without a color from the API the official language color is used', () => {
  const s = summarize({
    user: 'ana',
    days: [day('a', 1), day('b', 1)],
    languages: [{ name: 'Python', color: null, bytes: 10 }],
  });
  assert.equal(s.languages[0].color, '#3572A5');
});

test('excluded languages are left out, in any case, and the shares add up again', () => {
  const s = summarize(
    {
      user: 'ana',
      days: [day('a', 1)],
      languages: [
        { name: 'HTML', color: '#e34c26', bytes: 900 },
        { name: 'Jupyter Notebook', color: '#DA5B0B', bytes: 500 },
        { name: 'Go', color: '#00ADD8', bytes: 100 },
      ],
    },
    { exclude: ['html', ' jupyter notebook '] },
  );
  assert.deepEqual(s.languages.map((l) => l.name), ['Go']);
  assert.equal(s.languages[0].share, 1);
});
