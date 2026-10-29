import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createForecastService, validatePoint} from '../../services/forecast-service.mjs';

test('point validation rounds to 0.1 degree and accepts the Pacific box', () => {
  assert.deepEqual(validatePoint('36.94', '-122.46'), {ok: true, lat: 36.9, lon: -122.5});
  assert.deepEqual(validatePoint(0, -170), {ok: true, lat: 0, lon: -170});
  assert.deepEqual(validatePoint(60, -110), {ok: true, lat: 60, lon: -110});
  assert.deepEqual(validatePoint('37', '238'), {ok: true, lat: 37, lon: -122}); // 0-360 longitude
});

test('point validation rejects missing, non-numeric and out-of-range values', () => {
  for (const [lat, lon] of [[null, '-122'], ['37', ''], ['abc', '-122'], ['37', 'NaN'], ['60.1', '-122'], ['-0.1', '-122'], ['37', '-109.9'], ['37', '-170.1'], ['37', '10']]) {
    assert.equal(validatePoint(lat, lon).ok, false, `${lat},${lon}`);
  }
});

test('/api/point rejects bad input without calling a provider and fetches only fixed hosts', async () => {
  const urls: string[] = [];
  const h = createForecastService({fetcher: async (u: any) => {
    urls.push(String(u));
    const t = [1, 2, 3];
    return Response.json(String(u).includes('marine') ? {hourly: {time: t, wave_height: [1, 2, 3], swell_wave_height: [1, 1, 1], swell_wave_period: [12, 12, 12], swell_wave_direction: [280, 280, 280]}} : {hourly: {time: t, wind_speed_10m: [4, 5, 6], wind_direction_10m: [10, 20, 30]}});
  }});
  assert.equal((await h(new Request('https://s.test/api/point?lat=80&lon=-122'))).status, 400);
  assert.equal(urls.length, 0);
  const ok = await h(new Request('https://s.test/api/point?lat=36.94&lon=-122.46'));
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.lat, 36.9);
  assert.deepEqual(body.windSpeed, [4, 5, 6]);
  assert.ok(urls.every((u) => u.startsWith('https://marine-api.open-meteo.com/') || u.startsWith('https://api.open-meteo.com/')));
  await h(new Request('https://s.test/api/point?lat=36.9&lon=-122.5'));
  assert.equal(urls.length, 2, 'second request is served from the cache');
});
