import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {alertsFor, mapAlerts, alertsURL, clearAlertsCache, NWS_USER_AGENT, SURF_EVENTS} from '../services/nwsAlerts.ts';
import {NWS_ZONE, zoneFor, NWS_ZONE_APPROX} from '../services/nwsZones.ts';
import {evidenceSpots} from '../ocean/spots.ts';

// Recorded from https://api.weather.gov/alerts/active?area=CA on 2026-11-02 (geometry and long text trimmed): 2 Beach Hazards Statements, a Frost Advisory and a Lake Wind Advisory.
const feed = JSON.parse(fs.readFileSync(new URL('./fixtures/nws-alerts-CA-2026-11-02.json', import.meta.url), 'utf8'));
const NOW = Date.parse('2026-11-03T03:00:00Z'); // 7 PM PST Nov 2: the San Francisco Beach Hazards Statement is active until 8 PM PST Nov 3
const okFetch = (calls: string[]) => (async (url: any, init: any) => { calls.push(String(url)); return {ok: true, status: 200, json: async () => feed} as any; }) as unknown as typeof fetch;

test('zone table: every spot is either zoned, approximated within 15 km, or has none; Ocean Beach is CAZ006', () => {
  assert.equal(zoneFor('spot-2')?.zone, 'CAZ006'); assert.equal(zoneFor('spot-2')?.approx, false);
  for (const s of evidenceSpots) { const z = zoneFor(s.id); if (z) assert.match(z.zone, /^(CA|OR|WA|HI)Z\d{3}$/); }
  assert.ok(Object.values(NWS_ZONE_APPROX).every((a) => a.km <= 15)); assert.ok(Object.keys(NWS_ZONE).length === evidenceSpots.length);
  assert.equal(zoneFor('mavericks-unknown'), null);
});
test('mapping a recorded feed: only surf-relevant, active alerts; wording kept; dated; link to the NWS forecast page', () => {
  const a = mapAlerts(feed, 'spot-2', NOW);
  assert.equal(a.length, 2); assert.ok(a.every((x) => x.event === 'Beach Hazards Statement'));
  const sf = a.find((x) => x.ends?.startsWith('2026-11-03T20:00'))!; assert.ok(sf); assert.match(sf.headline, /Beach Hazards Statement issued/); assert.match(sf.sender, /NWS/); assert.match(sf.url, /^https:\/\/forecast\.weather\.gov\/MapClick\.php\?lat=37\.\d+&lon=-122\.\d+$/);
  assert.ok(!SURF_EVENTS.test('Frost Advisory') && !SURF_EVENTS.test('Lake Wind Advisory') && SURF_EVENTS.test('High Surf Advisory'));
  assert.equal(mapAlerts(feed, 'spot-2', Date.parse('2026-11-04T12:00:00Z')).length, 0, 'expired alerts are dropped');
  assert.equal(mapAlerts({features: 'x'}, 'spot-2', NOW).length, 0); assert.equal(mapAlerts(null, 'spot-2', NOW).length, 0);
});
test('alertsFor: requests the spot zone, returns dated alerts, caches per zone, sends no personal data', async () => {
  clearAlertsCache(); const calls: string[] = [];
  const r = await alertsFor('spot-2', undefined, okFetch(calls), NOW);
  assert.equal(r.status, 'ok'); if (r.status !== 'ok') return; assert.equal(r.alerts.length, 2); assert.equal(r.fetchedAt, new Date(NOW).toISOString());
  assert.deepEqual(calls, [alertsURL('CAZ006')]); assert.equal(alertsURL('CAZ006'), 'https://api.weather.gov/alerts/active?zone=CAZ006');
  await alertsFor('spot-2', undefined, okFetch(calls), NOW + 60000); assert.equal(calls.length, 1, 'cached for 15 minutes');
  await alertsFor('spot-2', undefined, okFetch(calls), NOW + 20 * 60000); assert.equal(calls.length, 2);
  assert.ok(!/@|\.com/.test(NWS_USER_AGENT) && NWS_USER_AGENT === 'SWELLO surf app');
});
test('alertsFor fails silently: HTTP error, network error and bad JSON all give unavailable, never a throw', async () => {
  clearAlertsCache();
  assert.deepEqual(await alertsFor('spot-2', undefined, (async () => ({ok: false, status: 503}) as any) as unknown as typeof fetch, NOW), {status: 'unavailable'});
  assert.deepEqual(await alertsFor('spot-2', undefined, (async () => { throw new Error('offline'); }) as unknown as typeof fetch, NOW), {status: 'unavailable'});
  assert.deepEqual(await alertsFor('spot-2', undefined, (async () => ({ok: true, json: async () => { throw new Error('bad'); }}) as any) as unknown as typeof fetch, NOW), {status: 'unavailable'});
  clearAlertsCache();
});
test('a spot with no zone has nothing to say: ok with no alerts, no request', async () => {
  clearAlertsCache(); const calls: string[] = []; const none = evidenceSpots.find((s) => !zoneFor(s.id));
  if (none) { const r = await alertsFor(none.id, undefined, okFetch(calls), NOW); assert.deepEqual(r.status === 'ok' ? r.alerts : null, []); assert.equal(calls.length, 0); }
  const r2 = await alertsFor('not-a-spot', undefined, okFetch(calls), NOW); assert.equal(r2.status, 'ok'); assert.equal(calls.length, 0);
});
test('land zone ids: any state, never a marine zone', async () => {
  const {isLandZoneId} = await import('../services/nwsZones.ts');
  for (const z of ['CAZ006', 'CAZ552', 'ORZ001', 'WAZ503', 'WAZ501', 'AKZ011', 'HIZ001']) assert.equal(isLandZoneId(z), true, z);
  for (const z of ['PZZ535', 'PZZ253', 'ANZ650', 'GMZ850', 'LSZ121', 'PHZ110', 'CAC001', 'CA006', '', 'caz006']) assert.equal(isLandZoneId(z), false, z);
});
