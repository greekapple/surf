import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createForecastService, ingestionTargets, serviceSpots} from '../../services/forecast-service.mjs';
import {serverProviderPath} from '../ocean/server.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {modelSpreadURL} from '../ocean/openMeteo.ts';

// T-114: the multi-model spread request used to go from the browser straight to marine-api.open-meteo.com (no saved copy, a 429 reached the console).
const instant = Date.parse('2026-10-20T06:00:00Z');
const req = (key: string) => new Request('https://surf.test/api/provider?key=' + key);
const spread = () => Response.json({hourly: {time: [instant / 1000], swell_wave_height_ncep_gfswave016: [1.4], swell_wave_period_ncep_gfswave016: [12]}});

test('every spot\'s model-spread URL is routed to the Worker\'s saved-copy provider, and the Worker has that target with the same request', () => {
  const keys = new Map(ingestionTargets(instant).map((t: any) => [t.key, t.url as string]));
  for (const s of evidenceSpots) {
    assert.equal(serverProviderPath(modelSpreadURL(s)), '/api/provider?key=spread-' + s.id, `${s.id} routed`);
    const url = keys.get('spread-' + s.id); assert.ok(url, `${s.id} has a spread target`);
    const a = new URL(url!), b = new URL(modelSpreadURL(s)); assert.equal(a.searchParams.get('models'), b.searchParams.get('models')); assert.equal(a.searchParams.get('hourly'), b.searchParams.get('hourly'));
  }
  assert.equal(serviceSpots.length, [...keys.keys()].filter((k) => k.startsWith('spread-')).length);
});
test('Open-Meteo 429 on the spread feed: the proxy serves its saved copy, labelled stale, with the original retrieval time', async () => {
  let now = instant, fail = false;
  const h = createForecastService({now: () => now, fetcher: async () => (fail ? new Response('rate limited', {status: 429, headers: {'retry-after': '60'}}) : spread())});
  const first = await (await h(req('spread-spot-2'))).json();
  now += 1800001; fail = true;
  const stale = await (await h(req('spread-spot-2'))).json();
  assert.equal(stale.cache, 'stale'); assert.equal(stale.retrievedAt, first.retrievedAt); assert.deepEqual(stale.payload, first.payload); assert.match(stale.warning, /429/);
});
