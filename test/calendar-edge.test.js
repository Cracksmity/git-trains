import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calendarCells, calendarGeometry, renderCalendar } from '../src/calendar.js';
import { parseCustomModel } from '../src/custom.js';
import { sampleStats } from '../src/sample.js';

const year = (y, busy = {}) => {
  const days = [];
  for (let t = Date.UTC(y, 0, 1); t < Date.UTC(y + 1, 0, 1); t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    days.push({ date, count: busy[date] ?? 0 });
  }
  return days;
};
const stats = (days, total, cars) => ({ ...sampleStats(), days, total, cars });
const checkSvg = (svg) => {
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*>/);
  assert.ok(svg.endsWith('</svg>'));
  assert.equal((svg.match(/<g[ >]/g) ?? []).length, (svg.match(/<\/g>/g) ?? []).length);
  assert.ok(!/undefined|NaN|null/.test(svg));
};
const count = (svg, pattern) => (svg.match(pattern) ?? []).length;

test('a year without contributions has empty cells and one train unit', () => {
  const days = year(2026);
  const { cells, weeks } = calendarCells(days);
  assert.equal(cells.length, 365);
  assert.equal(weeks, 53);
  assert.ok(cells.every((cell) => cell.level === 0));
  const svg = renderCalendar(stats(days, 0, 1));
  checkSvg(svg);
  assert.equal(count(svg, /@keyframes e\d+\{/g), 0);
  assert.equal(count(svg, /class="u u\d+"/g), 1);
});

test('a single busy day is the only cell eaten and grows the train', () => {
  const days = year(2026, { '2026-06-15': 1000 });
  const { cells } = calendarCells(days);
  assert.deepEqual(cells.filter((cell) => cell.level > 0).map(({ date, level }) => [date, level]), [['2026-06-15', 1]]);
  const svg = renderCalendar(stats(days, 1000, 5));
  checkSvg(svg);
  assert.equal(count(svg, /@keyframes e\d+\{/g), 1);
  assert.equal(count(svg, /class="u u\d+"/g), 5);
  const joins = [...svg.matchAll(/@keyframes v\d+\{0%\{opacity:0\}([\d.]+)%/g)].map((m) => Number(m[1]));
  assert.equal(joins.length, 4);
  assert.ok(joins.every((at) => at > 0 && at === joins[0]));
});

test('a leap year starting Saturday occupies 54 week columns', () => {
  const days = year(2000, { '2000-01-01': 1, '2000-12-31': 2 });
  const { cells, weeks } = calendarCells(days);
  assert.equal(cells.length, 366);
  assert.equal(weeks, 54);
  assert.deepEqual([cells[0].col, cells[0].row], [0, 6]);
  assert.deepEqual([cells.at(-1).col, cells.at(-1).row], [53, 0]);
  const svg = renderCalendar(stats(days, 3, 1));
  checkSvg(svg);
  assert.match(svg, new RegExp(`viewBox="0 0 ${calendarGeometry(54).W} ${calendarGeometry(54).H}"`));
  assert.equal(count(svg, /@keyframes e\d+\{/g), 2);
});

test('every example custom train renders a calendar', () => {
  const dir = fileURLToPath(new URL('../examples/trains/', import.meta.url));
  const files = readdirSync(dir).filter((name) => name.endsWith('.json'));
  assert.ok(files.length > 0);
  for (const file of files) {
    const model = parseCustomModel(JSON.parse(readFileSync(join(dir, file), 'utf8')));
    const svg = renderCalendar(sampleStats(), { model });
    checkSvg(svg);
    assert.match(svg, /class="u u0"/, file);
  }
});

test('the Action writes calendar variants only when enabled', () => {
  const entry = fileURLToPath(new URL('../src/index.js', import.meta.url));
  const names = ['train-calendar.svg', 'train-calendar-light.svg', 'train-calendar-dark.svg'];
  for (const enabled of [true, false]) {
    const dir = mkdtempSync(join(tmpdir(), 'git-trains-calendar-'));
    try {
      const env = { ...process.env, 'INPUT_OUTPUT-DIR': dir, INPUT_THEME: 'both' };
      delete env.INPUT_CALENDAR;
      if (enabled) env.INPUT_CALENDAR = 'true';
      const result = spawnSync(process.execPath, [entry, '--sample'], { env, encoding: 'utf8' });
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert.ok(existsSync(join(dir, 'train.svg')));
      for (const name of names) {
        assert.equal(existsSync(join(dir, name)), enabled, name);
        if (enabled) checkSvg(readFileSync(join(dir, name), 'utf8'));
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});
