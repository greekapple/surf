import test from 'node:test';
import assert from 'node:assert/strict';
import {computeScope, nearIds, SCOPE_NEAR_N, SCOPE_MAX} from '../ocean/spotScope.ts';
import {loadOcean} from '../ocean/pipeline.ts';
import {evidenceSpots, evidenceSpot} from '../ocean/spots.ts';
import {assignmentFor} from '../ocean/mop.ts';

test('scope: the selected spot and favourites always load, then the spots near the selection, the pins in view and what a screen asked for; unknown ids are ignored, nothing repeats', () => {
  const s = computeScope('spot-2', ['spot-6', 'nope'], ['cs-crescent-city'], ['spot-0', 'spot-2']);
  assert.deepEqual(s.slice(0, 2), ['spot-2', 'spot-6'], 'selected, then favourites'); assert.equal(new Set(s).size, s.length); assert.ok(!s.includes('nope'));
  assert.ok(s.includes('cs-crescent-city') && s.includes('spot-0'), 'visible and requested spots are included');
  const near = nearIds('spot-2'); assert.ok(near.length <= SCOPE_NEAR_N && near.length > 5, 'Ocean Beach has many spots within 100 km'); assert.ok(near.every((id) => s.includes(id)));
  assert.ok(s.length < evidenceSpots.length, 'a subset, not the catalogue');
  const far = computeScope('w-us-mansion-beach', [], [], []); assert.ok(far.length < 10, 'a remote spot has few neighbours: ' + far.length);   // (Crescent City has 17 neighbours since the West Coast import)
});
test('scope: the cap never drops the selected spot or a favourite', () => {
  const favs = evidenceSpots.slice(0, 10).map((e) => e.id), s = computeScope('spot-2', favs, evidenceSpots.map((e) => e.id), [], evidenceSpots, 12);
  assert.equal(s.length >= 11, true); assert.ok(favs.every((f) => s.includes(f)) && s.includes('spot-2')); assert.ok(computeScope('spot-2', [], evidenceSpots.map((e) => e.id)).length <= SCOPE_MAX);
});
test('loadOcean(scope) asks for the forecast of the scoped spots only, and a wider scope adds only the spots not asked for before', async () => {
  const urls: string[] = [], t = Math.floor(Date.now() / 3600000) * 3600, times = Array.from({length: 48}, (_, i) => t + i * 3600);
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (u: any) => { const s = String(u); urls.push(s); if (/marine-api\.open-meteo\.com\/v1\/marine/.test(s)) return Response.json({hourly: {time: times, wave_height: times.map(() => 1.5), swell_wave_height: times.map(() => 1.4), swell_wave_direction: times.map(() => 270), swell_wave_period: times.map(() => 12)}});
    if (/api\.open-meteo\.com\/v1\/forecast/.test(s)) return Response.json({hourly: {time: times, wind_speed_10m: times.map(() => 5), wind_direction_10m: times.map(() => 90), wind_gusts_10m: times.map(() => 9)}}); return new Response('no', {status: 404}); }) as typeof fetch;
  try {
    const a = ['spot-2', 'spot-6'], first = await loadOcean(undefined, new Set(a));
    assert.deepEqual([...first.loadedSpotIds!].sort(), [...a].sort()); assert.ok(first.records.every((r) => a.includes(r.spotId)), 'records only for the scoped spots');
    const fc = urls.filter((u) => /open-meteo/.test(u)); assert.equal(fc.length, a.length * 2, 'one marine and one weather request per scoped spot: ' + fc.length);
    const mopUrls = urls.filter((u) => /MOP_alongshore/.test(u) && /forecast/.test(u)); const want = new Set(a.flatMap((id) => { const m = assignmentFor(id); return m ? [m.mopId] : []; })); assert.equal(mopUrls.length, want.size, 'MOP forecasts only for the assigned points of the scoped spots');
    const before = urls.length, b = [...a, 'spot-0'], second = await loadOcean(undefined, new Set(b));
    assert.deepEqual([...second.loadedSpotIds!].sort(), [...b].sort()); const added = urls.slice(before).filter((u) => /open-meteo/.test(u)); assert.equal(added.length, 2, 'the wider scope fetched only the new spot (marine + weather): ' + added.length);
    assert.ok(second.records.some((r) => r.spotId === 'spot-0') && !first.records.some((r) => r.spotId === 'spot-0'));
    const all = await loadOcean(); assert.equal(all.loadedSpotIds!.length, evidenceSpots.length, 'no scope loads every spot (the old behaviour)');
    void evidenceSpot;
  } finally { globalThis.fetch = realFetch; }
});
