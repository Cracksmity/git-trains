import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUNRISE_ELEVATION, localTheme, solarElevation } from '../../src/weather/sun.js';
import { themeFor } from '../../src/action/weather.js';
import { parseSkyline } from '../../src/landscape/skyline-parse.js';
import { JALISCO_PLACES } from '../../src/weather/places.js';

const [{ latitude, longitude }] = JALISCO_PLACES;
const jalisco = parseSkyline('jalisco');
const at = (iso) => new Date(iso);

// The minute the sun crosses the horizon, searched from `from` for a day.
function crossing(from, rising) {
  for (let m = 0; m < 1440; m++) {
    const date = new Date(Date.parse(from) + m * 60000);
    const up = solarElevation(date, latitude, longitude) > SUNRISE_ELEVATION;
    if (up === rising) return date;
  }
  return null;
}

test('sunrise and sunset in Guadalajara match Open-Meteo to within three minutes', () => {
  // Open-Meteo, 21 November 2026, America/Mexico_City (UTC-6): sunrise 07:07, sunset 18:11.
  const sunrise = crossing('2026-11-21T11:00:00Z', true);
  const sunset = crossing('2026-11-21T20:00:00Z', false);
  assert.ok(Math.abs(sunrise - at('2026-11-21T13:07:00Z')) <= 3 * 60000, sunrise.toISOString());
  assert.ok(Math.abs(sunset - at('2026-11-22T00:11:00Z')) <= 3 * 60000, sunset.toISOString());
});

test('the sun is highest near noon and far below the horizon at midnight', () => {
  const noon = solarElevation(at('2026-11-21T18:40:00Z'), latitude, longitude);
  assert.ok(noon > 48 && noon < 50.5, `noon elevation ${noon}`);
  assert.ok(solarElevation(at('2026-11-21T06:40:00Z'), latitude, longitude) < -60);
  // On the equinox the sun passes almost overhead at the equator.
  assert.ok(solarElevation(at('2026-03-20T12:07:00Z'), 0, 0) > 88);
});

test('local is light while the sun is up and dark after sunset, only for skylines with places', () => {
  assert.equal(localTheme(jalisco, at('2026-11-21T18:00:00Z')).theme, 'light');
  assert.equal(localTheme(jalisco, at('2026-11-21T14:00:00Z')).theme, 'light', '08:00, just after sunrise');
  assert.equal(localTheme(jalisco, at('2026-11-21T12:30:00Z')).theme, 'dark', '06:30, before sunrise');
  assert.equal(localTheme(jalisco, at('2026-11-22T01:30:00Z')).theme, 'dark', '19:30, after sunset');
  assert.equal(localTheme(jalisco, at('2026-11-21T18:00:00Z')).place, 'Guadalajara');
  assert.equal(localTheme(parseSkyline('osaka'), at('2026-11-21T18:00:00Z')), null);
  assert.equal(localTheme(null, at('2026-11-21T18:00:00Z')), null);
});

test('themeFor keeps the other themes and explains what local chose', () => {
  const lines = [];
  const log = (line) => lines.push(line);
  for (const theme of ['light', 'dark', 'auto', 'both']) assert.equal(themeFor(theme, jalisco, at('2026-11-21T06:00:00Z'), log), theme);
  assert.deepEqual(lines, []);
  assert.equal(themeFor('local', jalisco, at('2026-11-22T04:00:00Z'), log), 'dark');
  assert.match(lines[0], /^Theme local: the sun is \d+° below the horizon in Guadalajara -> dark$/);
  assert.equal(themeFor('local', parseSkyline('osaka'), at('2026-11-21T18:00:00Z'), log), 'auto');
  assert.match(lines[1], /^::notice::theme local needs a skyline with real places/);
});

test('the Action writes one fixed-theme scene for local, chosen at its run time', () => {
  const entry = fileURLToPath(new URL('../../src/index.js', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'git-trains-local-'));
  try {
    const env = { ...process.env, 'INPUT_OUTPUT-DIR': dir, INPUT_TRAIN: 'jalisco', INPUT_SKYLINE: 'jalisco', INPUT_MODE: 'multi', INPUT_THEME: 'local' };
    const r = spawnSync(process.execPath, [entry, '--sample'], { env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    // The sample runs at 2026-11-02 16:40 UTC: 10:40 in Guadalajara, so daytime.
    assert.match(r.stdout, /Theme local: the sun is \d+° above the horizon in Guadalajara -> light/);
    assert.ok(existsSync(join(dir, 'train.svg')) && !existsSync(join(dir, 'train-light.svg')));
    const svg = readFileSync(join(dir, 'train.svg'), 'utf8');
    assert.ok(!svg.includes('prefers-color-scheme'), 'a fixed theme, not the viewer\'s');
    assert.match(svg, /--sky0:#83b4c4/, 'the daytime Jalisco sky');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
