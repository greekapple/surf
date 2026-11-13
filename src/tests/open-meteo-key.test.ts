import test from 'node:test';
import assert from 'node:assert/strict';
import {withOpenMeteoKey, openMeteoFetcher} from '../../services/open-meteo-key.mjs';

test('with a key, Open-Meteo URLs go to the customer endpoints with apikey; without one nothing changes', () => {
  const m = 'https://marine-api.open-meteo.com/v1/marine?latitude=1&longitude=2', w = 'https://api.open-meteo.com/v1/forecast?latitude=1';
  assert.equal(withOpenMeteoKey(m, null), m); assert.equal(withOpenMeteoKey(w, ''), w);
  assert.equal(withOpenMeteoKey(m, 'k 1'), 'https://customer-marine-api.open-meteo.com/v1/marine?latitude=1&longitude=2&apikey=k%201');
  assert.equal(withOpenMeteoKey(w, 'k'), 'https://customer-api.open-meteo.com/v1/forecast?latitude=1&apikey=k');
  assert.equal(withOpenMeteoKey('https://api.weather.gov/x', 'k'), 'https://api.weather.gov/x');   // only Open-Meteo hosts
});

test('the fetcher uses the paid URL, falls back to the free one on 401/403, and callers never see the key', async () => {
  const seen: string[] = [];
  const base = async (u: string) => { seen.push(u); return new Response('{}', {status: u.includes('customer-') ? 401 : 200}); };
  const f = openMeteoFetcher(() => 'secret', base as unknown as typeof fetch);
  const r = await f('https://api.open-meteo.com/v1/forecast?a=1');
  assert.equal(r.status, 200); assert.equal(seen.length, 2); assert.ok(seen[0].startsWith('https://customer-api.') && seen[1] === 'https://api.open-meteo.com/v1/forecast?a=1');
  seen.length = 0; const g = openMeteoFetcher(() => null, base as unknown as typeof fetch); await g('https://api.open-meteo.com/v1/forecast?a=1'); assert.deepEqual(seen, ['https://api.open-meteo.com/v1/forecast?a=1']);
});
