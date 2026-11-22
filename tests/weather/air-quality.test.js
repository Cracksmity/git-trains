import test from 'node:test';
import assert from 'node:assert/strict';
import { AIR_QUALITY_URL, airQualityUrl, fetchAirQuality } from '../../src/weather/air-quality.js';

const place = { latitude: 20.67672, longitude: -103.3 };

test('the air-quality request asks for current PM2.5 at one coordinate pair', async () => {
  const url = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=20.6767&longitude=-103.3000&current=pm2_5';
  assert.equal(airQualityUrl(place), url);
  assert.equal(AIR_QUALITY_URL, url.split('?')[0]);
  for (const pm25 of [0, 37.5, 1000]) {
    const fetchImpl = async (request, init) => {
      assert.equal(request, url);
      assert.ok(init.signal instanceof AbortSignal);
      return Response.json({ current: { pm2_5: pm25 } });
    };
    assert.deepEqual(await fetchAirQuality({ place, fetchImpl }), { pm25, problems: [] });
  }
});

test('invalid or missing PM2.5 yields one problem', async () => {
  for (const value of [-0.1, 1000.1, '61', null, undefined]) {
    const fetchImpl = async () => Response.json({ current: { pm2_5: value } });
    const result = await fetchAirQuality({ place, fetchImpl });
    assert.equal(result.pm25, null);
    assert.equal(result.problems.length, 1);
    assert.match(result.problems[0], /pm2_5/);
  }
});

test('the air-quality adapter retries an outage or an unreadable answer once', async () => {
  for (const fail of [
    () => { throw new Error('offline'); },
    () => new Response('unavailable', { status: 503 }),
    () => new Response('invalid JSON'),
    () => ({ ok: true, status: 200, text: async () => { throw new Error('body interrupted'); } }),
  ]) {
    let calls = 0;
    const flaky = async () => ++calls === 1 ? fail() : Response.json({ current: { pm2_5: 61 } });
    assert.deepEqual(await fetchAirQuality({ place, fetchImpl: flaky, retryDelay: 0 }), { pm25: 61, problems: [] });
    assert.equal(calls, 2);
    calls = 0;
    const down = async () => { calls++; return fail(); };
    await assert.rejects(fetchAirQuality({ place, fetchImpl: down, retryDelay: 0 }));
    assert.equal(calls, 2);
  }
});
