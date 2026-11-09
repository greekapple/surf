import test from 'node:test';
import assert from 'node:assert/strict';
import {hasUsData, countryOf, regionNote, NOT_AVAILABLE_IN_REGION} from '../ocean/coverage.ts';
import {nearestTideStationsFor, nearestTideStations} from '../ocean/tideStations.ts';
import {assignmentFor, mopAssignments} from '../ocean/mop.ts';
import {shoreAssignmentFor, shoreWindRegistry} from '../ocean/shoreWind.ts';
import {zoneFor, NWS_ZONE} from '../services/nwsZones.ts';
import {alertsFor, clearAlertsCache} from '../services/nwsAlerts.ts';
import {loadShoreWindNow} from '../services/shoreWindNow.ts';
import {evidenceSpots, evidenceSpot} from '../ocean/spots.ts';
import {allSpots} from '../data/catalog.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {rateForecast} from '../ratings/adapters.ts';
import {spotReport} from '../services/spotReport.ts';
import {dashCard} from '../services/homeDash.ts';
import {headlineSurf} from '../services/headlineSurf.ts';
import {defaultProfile} from '../data/demo.ts';

const profile = {...defaultProfile, heightUnit: 'ft' as const, scale: 'Face height' as const};
const base = evidenceSpot('cs-imperial');   // a US spot with a CO-OPS station, an NWS zone and a shore wind station near it
const mk = (id: string, lat: number, lon: number, country: string | undefined, tz: string) => ({...base, id, name: id, latitude: lat, longitude: lon, marineLatitude: lat, marineLongitude: lon - 0.08, timeZone: tz, ...(country ? {country} : {})});
// a Baja beach 20 km from the Imperial Beach tide station and 15 km from its ASOS/NWS area; a Lisbon beach; a Honolulu beach (US data, own zone)
const syn = [mk('zz-baja', 32.46, -117.12, 'MX', 'America/Tijuana'), mk('zz-lisbon2', 38.70, -9.42, 'PT', 'Europe/Lisbon'), mk('zz-us-same-spot', 32.46, -117.12, undefined, 'America/Los_Angeles'), mk('zz-honolulu2', 21.28, -157.84, 'US', 'Pacific/Honolulu')];
const cleanups: (() => void)[] = [];
test.before(() => {
  for (const s of syn) { evidenceSpots.push(s as any); allSpots.push({...allSpots.find((x) => x.id === 'cs-imperial')!, id: s.id, name: s.id, country: s.country, timeZone: s.timeZone} as any); }
  // registry rows that WOULD match the Baja spot if nothing gated them: a MOP assignment, an NWS zone, a shore-wind station 5 km away
  mopAssignments.push({...mopAssignments[0], spotId: 'zz-baja'}); NWS_ZONE['zz-baja'] = 'CAZ043'; NWS_ZONE['zz-lisbon2'] = 'CAZ043';
  shoreWindRegistry.assignments.push({spotId: 'zz-baja', spotName: 'zz', stationId: 'NRS', stationName: 'Imperial Beach', kind: 'asos', lat: 32.57, lon: -117.11, distanceKm: 5, url: 'x'});
  cleanups.push(() => { mopAssignments.pop(); delete NWS_ZONE['zz-baja']; delete NWS_ZONE['zz-lisbon2']; shoreWindRegistry.assignments.pop(); });
});
test.after(() => { cleanups.forEach((f) => f()); for (const s of syn) { evidenceSpots.splice(evidenceSpots.findIndex((x) => x.id === s.id), 1); allSpots.splice(allSpots.findIndex((x) => x.id === s.id), 1); } });

test('coverage: a spot has US data only in the US (absent country = US); the note names the source and says "not available in this region"', () => {
  assert.equal(countryOf('spot-2'), 'US'); assert.equal(countryOf('zz-baja'), 'MX'); assert.equal(countryOf({id: 'x', country: 'pt'}), 'PT'); assert.equal(countryOf('nope'), 'US');
  assert.equal(hasUsData('zz-honolulu2'), true); assert.equal(hasUsData('zz-lisbon2'), false);
  assert.ok(evidenceSpots.filter((s) => !s.id.startsWith('zz-')).every((s) => hasUsData(s.id)), 'every existing spot keeps its US data');
  assert.equal(regionNote('spot-2', 'tide'), null); assert.equal(regionNote('zz-honolulu2', 'alerts'), null);
  assert.equal(NOT_AVAILABLE_IN_REGION, 'not available in this region');
  assert.deepEqual((['tide', 'alerts', 'nearshore', 'shoreWind'] as const).map((k) => regionNote('zz-lisbon2', k)), ['Tide predictions: not available in this region', 'Weather alerts: not available in this region', 'Nearshore wave model: not available in this region', 'Measured shore wind: not available in this region']);
});
test('nothing is borrowed across a border: a Baja spot next to Imperial Beach gets no tide station, NWS zone, MOP point or shore station, the same place in the US does', () => {
  const baja = evidenceSpots.find((s) => s.id === 'zz-baja')!, us = evidenceSpots.find((s) => s.id === 'zz-us-same-spot')!;
  assert.ok(nearestTideStations(baja.latitude, baja.longitude)[0].distanceKm < 40, 'a US station really is within 40 km of the Baja beach');
  assert.deepEqual(nearestTideStationsFor(baja), []); assert.ok(nearestTideStationsFor(us).length > 0 && nearestTideStationsFor(us)[0].distanceKm < 40);
  assert.equal(zoneFor('zz-baja'), null);
  assert.equal(assignmentFor('zz-baja'), null, 'no CDIP MOP point'); assert.equal(shoreAssignmentFor('zz-baja'), null, 'no NDBC/ASOS station');
  assert.equal(zoneFor('zz-lisbon2'), null); assert.equal(assignmentFor('zz-lisbon2'), null); assert.equal(shoreAssignmentFor('zz-lisbon2'), null); assert.deepEqual(nearestTideStationsFor({...evidenceSpots.find((s) => s.id === 'zz-lisbon2')!}), []);
});
test('no request is made for a source that does not cover the region (alerts, shore wind)', async () => {
  clearAlertsCache(); let calls = 0; const f = (async () => { calls++; throw new Error('must not be called'); }) as unknown as typeof fetch;
  const a = await alertsFor('zz-baja', undefined, f); assert.deepEqual(a.status === 'ok' && a.alerts, []); assert.equal(await loadShoreWindNow('zz-baja', Date.now(), f), null); assert.equal(await loadShoreWindNow('zz-lisbon2', Date.now(), f), null);
  assert.equal(calls, 0);
});
test('the rating and the forecast still run for a spot outside the US data: surf estimate or labelled offshore height, wind, a rating, a report with no tide and no invented source', () => {
  const t0 = Date.parse('2026-11-09T00:00:00Z') / 1000, times = Array.from({length: 48}, (_, i) => t0 + i * 3600);
  const marine = {latitude: 38.7, longitude: -9.5, hourly_units: {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'}, hourly: {time: times, wave_height: times.map(() => 1.8), swell_wave_height: times.map(() => 1.7), swell_wave_direction: times.map(() => 290), swell_wave_period: times.map(() => 13), secondary_swell_wave_height: times.map(() => 0.2), secondary_swell_wave_direction: times.map(() => 200), secondary_swell_wave_period: times.map(() => 9), sea_surface_temperature: times.map(() => 16)}};
  const weather = {hourly_units: {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'}, hourly: {time: times, wind_speed_10m: times.map(() => 6), wind_direction_10m: times.map(() => 80), wind_gusts_10m: times.map(() => 10)}};
  const ev = evidenceSpots.find((s) => s.id === 'zz-lisbon2')!, spot = allSpots.find((s) => s.id === 'zz-lisbon2')!, recs = normalizeOpenMeteo(ev as any, marine, weather, '2026-11-09T00:00:00Z'), legacy = recs.map(toLegacy), now = Date.parse('2026-11-09T11:10:00Z');
  const mid = legacy.find((f) => Date.parse(f.timestamp) === Date.parse('2026-11-09T11:00:00Z'))!, r = rateForecast(spot as any, mid, now);
  assert.ok(r.score !== null && Number.isFinite(r.score), 'the rating runs: ' + r.category); assert.ok(r.sources.every((s) => /Open-Meteo/.test(s.provider)), 'its sources are the global model only');
  const h = headlineSurf('zz-lisbon2', mid, {nowMs: now}); assert.ok(h.kind === 'offshore' || h.kind === 'estimate', 'a labelled height, never a nearshore-model value: ' + h.kind); assert.notEqual((h as any).method, 'mop-v2');
  const rep = spotReport(spot as any, legacy, now, profile); assert.equal(rep.days.length, 7); assert.equal(rep.tides, null, 'no tide and no tide station invented');
  const card = dashCard(spot as any, legacy, now, profile); assert.ok(card.rating); assert.ok(legacy.every((f) => !Number.isFinite(f.tide?.height)), 'no hourly tide attached outside the Bay');
});

// a spot with no country (or 'US') gets the US lookups, so it must really be in the US: lower-48 West Coast, Hawaii or Alaska
const US_BOXES: [string, number, number, number, number][] = [['West Coast', 32.4, 49.1, -125.0, -117.0], ['Hawaii', 18.5, 22.5, -160.8, -154.5], ['Alaska', 51.0, 72.0, -180.0, -129.9], ['Aleutians (east of the date line)', 51.0, 55.5, 167.0, 180.0]];
const inUs = (lat: number, lon: number) => US_BOXES.some(([, a, b, c, d]) => lat >= a && lat <= b && lon >= c && lon <= d);
test('guard: every spot whose country is US (or absent) lies inside a US bounding box, so a mislabelled world spot cannot get US lookups', () => {
  const bad = evidenceSpots.filter((s) => !s.id.startsWith('zz-') && hasUsData(s.id) && !inUs(s.latitude, s.longitude)).map((s) => `${s.name} (${s.latitude}, ${s.longitude})`);
  assert.deepEqual(bad, [], 'US-labelled spots outside the US boxes: ' + bad.join('; '));
  assert.equal(inUs(32.46, -117.12), true, 'the box edge is the border: Imperial Beach is in'); assert.equal(inUs(32.30, -117.1), false, 'a Baja point is out'); assert.equal(inUs(38.7, -9.4), false); assert.equal(inUs(21.28, -157.84), true); assert.equal(inUs(57.0, -135.0), true);
});
