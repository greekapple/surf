import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evidenceSpots} from '../ocean/spots.ts';
import {distanceKm} from '../ocean/mop.ts';
import {isEnclosedWater} from '../map/enclosed.ts';
import {serverProviderPath} from '../ocean/server.ts';
import {shoreWindRegistry, exposureOf, exposureShown, shoreAssignmentFor, shoreStations, shoreFeedKey, stationsWithin, normalizeNdbcWind, normalizeNwsWind, ndbcWindURL, nwsObservationURL, SHORE_WIND_MAX_KM, SHORE_WIND_STALE_MS, type ShoreStation} from '../ocean/shoreWind.ts';
import {loadShoreWindNow} from '../services/shoreWindNow.ts';
import {ingestionTargets, shoreWindServiceStations, createForecastService} from '../../services/forecast-service.mjs';

const fx = (n: string) => fs.readFileSync(new URL('./fixtures/shore-wind/' + n, import.meta.url), 'utf8');
// real captures from 2026-11-09 05:20 UTC (CECC1 calm with no direction; ANVC1 and LJAC1 moving air; KHAF with a fog-only report first, then 14.76 km/h from 350)
const T = (s: string) => Date.parse(s);
const st = (id: string, kind: 'ndbc' | 'asos', distanceKm = 1): ShoreStation => ({id, name: id + ' test', kind, lat: 0, lon: 0, distanceKm});

test('NDBC: m/s become mph, gust kept only when >= speed, the newest row with a speed, observation time in UTC', () => {
  const ndbc = '#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS PTDY  TIDE\n#yr  mo dy hr mn degT m/s  m/s     m   sec   sec degT   hPa  degC  degC  degC  nmi  hPa    ft\n';
  const r = normalizeNdbcWind(ndbc + '2026 11 09 05 00 320  7.0  9.0   MM    MM    MM  MM 1018.4  17.0  19.1  16.1   MM +0.4    MM\n', st('X', 'ndbc', 2.1), T('2026-11-09T05:20:00Z'))!;
  assert.equal(r.mph, 15.7); assert.equal(r.gustMph, 20.1); assert.equal(r.dirDeg, 320); assert.equal(r.observedAt, '2026-11-09T05:00:00.000Z'); assert.equal(r.distanceKm, 2.1);
  assert.equal(r.kind, 'ndbc'); assert.equal(r.source.kind, 'observation'); assert.equal(r.source.nativeUnit, 'm/s'); assert.equal(r.source.validAt, r.observedAt); assert.equal(r.source.url, ndbcWindURL('X'));
  // a newest row with a missing speed falls back to the next row that has one, inside the window
  const skip = normalizeNdbcWind(ndbc + '2026 11 09 05 10 MM MM MM MM MM MM MM MM MM MM MM MM MM MM\n2026 11 09 05 00 250  4.0  MM   MM    MM    MM  MM 1018.4  17.0  19.1  16.1   MM +0.4    MM\n', st('X', 'ndbc'), T('2026-11-09T05:20:00Z'))!;
  assert.equal(skip.mph, 8.9); assert.equal(skip.gustMph, null, 'a missing gust is null, not the speed'); assert.equal(skip.observedAt, '2026-11-09T05:00:00.000Z');
});
test('NDBC real fixtures: a calm reading has a null direction (MM), a moving one keeps its direction', () => {
  const calm = normalizeNdbcWind(fx('ndbc-CECC1.txt'), st('CECC1', 'ndbc'), T('2026-11-09T05:20:00Z'))!;
  assert.equal(calm.mph, 0); assert.equal(calm.dirDeg, null, 'WDIR MM is not 0 degrees'); assert.equal(calm.gustMph, 2.2);
  for (const id of ['ANVC1', 'LJAC1']) { const r = normalizeNdbcWind(fx(`ndbc-${id}.txt`), st(id, 'ndbc'), T('2026-11-09T05:20:00Z')); assert.ok(r && r.mph !== null && r.mph >= 0, id); if (r.dirDeg !== null) assert.ok(r.dirDeg >= 0 && r.dirDeg <= 360); }
});
test('NDBC: stale (older than 2 h), future, headerless and garbage input are null', () => {
  const f = fx('ndbc-ANVC1.txt');
  assert.ok(normalizeNdbcWind(f, st('A', 'ndbc'), T('2026-11-09T06:30:00Z')), 'newest reading is under two hours old');
  assert.equal(normalizeNdbcWind(f, st('A', 'ndbc'), T('2026-11-09T09:00:00Z')), null, 'older than 2 h is missing, never now');
  assert.equal(normalizeNdbcWind(f, st('A', 'ndbc'), T('2026-11-09T03:00:00Z')), null, 'a reading from the future is refused');
  assert.equal(normalizeNdbcWind('nothing here', st('A', 'ndbc'), T('2026-11-09T05:20:00Z')), null); assert.equal(normalizeNdbcWind('', st('A', 'ndbc'), 0), null);
  assert.equal(SHORE_WIND_STALE_MS, 7200000);
});
test('NWS: km/h converted by unitCode, the fog-only report is skipped for the newest one with a speed, a missing direction is null', () => {
  const j = fx('nws-KHAF.json'), r = normalizeNwsWind(j, st('HAF', 'asos', 2.1), T('2026-11-09T05:20:00Z'))!;
  assert.equal(r.observedAt, '2026-11-09T04:55:00.000Z'); assert.equal(r.mph, 9.2); assert.equal(r.dirDeg, 350); assert.equal(r.gustMph, null); assert.equal(r.source.nativeUnit, 'km/h'); assert.equal(r.kind, 'asos'); assert.equal(r.source.url, nwsObservationURL('HAF'));
  const one = (speed: any, dir: any, gust: any = {value: null, unitCode: 'wmoUnit:km_h-1'}) => ({type: 'Feature', properties: {timestamp: '2026-11-09T05:00:00+00:00', windSpeed: speed, windDirection: dir, windGust: gust}});
  const v = normalizeNwsWind(one({value: 18, unitCode: 'wmoUnit:km_h-1'}, {value: null, unitCode: 'wmoUnit:degree_(angle)'}, {value: 30, unitCode: 'wmoUnit:km_h-1'}), st('X', 'asos'), T('2026-11-09T05:20:00Z'))!;
  assert.equal(v.dirDeg, null, 'variable or missing direction'); assert.equal(v.mph, 11.2); assert.equal(v.gustMph, 18.6);
  const ms = normalizeNwsWind(one({value: 5, unitCode: 'wmoUnit:m_s-1'}, {value: 270, unitCode: 'wmoUnit:degree_(angle)'}), st('X', 'asos'), T('2026-11-09T05:20:00Z'))!; assert.equal(ms.mph, 11.2); assert.equal(ms.dirDeg, 270);
  assert.equal(ms.source.nativeUnit, 'm/s', 'the native unit is the one NWS sent');
  assert.equal(normalizeNwsWind(one({value: 18, unitCode: 'wmoUnit:km_h-1', qualityControl: 'X'}, {value: 270, unitCode: 'wmoUnit:degree_(angle)'}), st('X', 'asos'), T('2026-11-09T05:20:00Z')), null, 'a value NWS rejected (X) is never shown');
  assert.equal(normalizeNwsWind(one({value: 18, unitCode: 'wmoUnit:km_h-1'}, {value: 270, unitCode: 'wmoUnit:degree_(angle)', qualityControl: 'Q'}), st('X', 'asos'), T('2026-11-09T05:20:00Z'))!.dirDeg, null, 'a questioned direction is dropped');
  assert.equal(normalizeNwsWind(one({value: 5, unitCode: 'wmoUnit:furlong_fortnight-1'}, {value: 270, unitCode: 'x'}), st('X', 'asos'), T('2026-11-09T05:20:00Z')), null, 'an unknown unit is refused, never guessed');
  assert.equal(normalizeNwsWind(one({value: 0, unitCode: 'wmoUnit:km_h-1'}, {value: null}), st('X', 'asos'), T('2026-11-09T05:20:00Z'))!.mph, 0, 'calm is 0, not missing');
});
test('NWS: stale, no wind speed anywhere, garbage and wrong shapes are null', () => {
  const j = fx('nws-KHAF.json');
  assert.equal(normalizeNwsWind(j, st('HAF', 'asos'), T('2026-11-09T08:00:00Z')), null, 'older than 2 h'); assert.equal(normalizeNwsWind(j, st('HAF', 'asos'), T('2026-11-09T04:00:00Z')), null, 'future');
  const none = {type: 'FeatureCollection', features: [{properties: {timestamp: '2026-11-09T05:15:00+00:00', windSpeed: {value: null, unitCode: 'wmoUnit:km_h-1'}, windDirection: {value: null}}}]};
  assert.equal(normalizeNwsWind(none, st('HAF', 'asos'), T('2026-11-09T05:20:00Z')), null, 'a report with no wind speed shows nothing');
  for (const bad of ['', 'not json', '{}', '[]', 'null', {features: 'x'}]) assert.equal(normalizeNwsWind(bad as any, st('HAF', 'asos'), T('2026-11-09T05:20:00Z')), null);
});
test('selection rule core: nearest first, nothing beyond 4 km, and a spot with no station in range gets an empty list', () => {
  const sts = [{id: 'far', lat: 37.60, lon: -122.45}, {id: 'near', lat: 37.502, lon: -122.50}, {id: 'mid', lat: 37.52, lon: -122.50}, {id: 'out', lat: 37.55, lon: -122.50}];   // 0.2, 2.2, 5.6 km from the spot, and one 11 km away
  const r = stationsWithin(37.5, -122.5, sts, distanceKm); assert.deepEqual(r.map((x) => x.s.id), ['near', 'mid']); assert.ok(r[0].km < r[1].km && r[1].km <= SHORE_WIND_MAX_KM);
  assert.deepEqual(stationsWithin(36.0, -121.0, sts, distanceKm), []);
});
test('selection rule: every assignment is within 4 km of its spot, outside enclosed water, and a spot without one gets none', () => {
  const reg = shoreWindRegistry; assert.equal(reg.maxKm, SHORE_WIND_MAX_KM); assert.ok(reg.assignments.length >= 4, 'at least four spots have a station'); assert.match(reg.rule, /4 km/); assert.ok(Number.isFinite(Date.parse(reg.builtAt)));
  const ids = new Set<string>();
  for (const a of reg.assignments) {
    const sp = evidenceSpots.find((s) => s.id === a.spotId)!; assert.ok(sp, a.spotId); assert.ok(!ids.has(a.spotId), 'one station per spot'); ids.add(a.spotId);
    const km = distanceKm(sp.latitude, sp.longitude, a.lat, a.lon); assert.ok(km <= SHORE_WIND_MAX_KM, `${a.spotName} ${km}`); assert.ok(Math.abs(km - a.distanceKm) < 0.06, `${a.spotName}: distance matches the coordinates`);
    assert.ok(!isEnclosedWater(a.lat, a.lon), `${a.stationName} is in enclosed water`); assert.ok(a.kind === 'ndbc' || a.kind === 'asos');
  }
  assert.equal(shoreAssignmentFor('nope'), null);
  for (const name of ['Ocean Beach', 'Linda Mar', 'Bolinas']) { const sp = evidenceSpots.find((s) => s.name === name)!; assert.equal(shoreAssignmentFor(sp.id), null, name + ' has no station within 4 km (spec acceptance)'); }
  for (const name of ['Mavericks', 'Point Arena']) { const sp = evidenceSpots.find((s) => s.name === name)!; assert.ok(shoreAssignmentFor(sp.id), name); }
  assert.equal(shoreAssignmentFor(evidenceSpots.find((s) => s.name === 'Mavericks')!.id)!.stationId, 'HAF'); assert.equal(shoreAssignmentFor(evidenceSpots.find((s) => s.name === 'Point Arena')!.id)!.kind, 'ndbc');
  // Exposure (lead, 2026-11-08): no harbour-basin or estuary station is shown as the wind at the beach, and no NDBC station whose siting is unchecked.
  for (const a of reg.assignments) { assert.ok(exposureShown(exposureOf({id: a.stationId, kind: a.kind})), `${a.stationName} exposure`); assert.equal(a.exposure, exposureOf({id: a.stationId, kind: a.kind})); }
  assert.equal(shoreAssignmentFor(evidenceSpots.find((s) => s.name === 'Crescent City')!.id), null, 'Crescent City: its gauge is inside the harbour');
  assert.equal(exposureShown('harbour'), false); assert.equal(exposureShown('estuary'), false); assert.equal(exposureShown(exposureOf({id: 'UNCHECKED1', kind: 'ndbc'})), false);
});
test('service: ingests exactly the registry stations (ASOS with a generic User-Agent and no contact), and the browser routes only those URLs', () => {
  assert.deepEqual(shoreWindServiceStations.map((s: any) => `${s.kind}:${s.id}`).sort(), shoreStations().map((s) => `${s.kind}:${s.id}`).sort());
  const targets = ingestionTargets(T('2026-11-09T05:00:00Z')) as any[];
  for (const s of shoreStations()) {
    const t = targets.find((x) => x.key === shoreFeedKey(s))!; assert.ok(t, s.id); assert.equal(t.ttl, 600000);
    assert.equal(t.url, s.kind === 'ndbc' ? ndbcWindURL(s.id) : nwsObservationURL(s.id)); assert.equal(serverProviderPath(t.url), '/api/provider?key=' + t.key);
    if (s.kind === 'asos') { assert.equal(t.headers['User-Agent'], 'SWELLO surf forecast prototype'); assert.ok(!JSON.stringify(t.headers).includes('@'), 'no email or contact'); }
  }
  assert.equal(serverProviderPath(nwsObservationURL('ZZZ')), null, 'an unregistered station is never proxied'); assert.equal(serverProviderPath(ndbcWindURL('99999')), null);
});
test('service: the Worker forwards the User-Agent and the geo+json Accept to NWS and refuses a response without features', async () => {
  const seen: any[] = [], svc = createForecastService({fetcher: async (u: any, o: any) => { seen.push({u: String(u), h: o?.headers}); return new Response(JSON.stringify({type: 'FeatureCollection', features: []}), {status: 200}); }, now: () => T('2026-11-09T05:00:00Z'), sleep: async () => {}});
  const r = await svc(new Request('http://x.test/api/provider?key=shore-asos-HAF'), {});
  assert.equal(r.status, 200); const h = seen[0].h; assert.equal(h['User-Agent'], 'SWELLO surf forecast prototype'); assert.equal(h.Accept, 'application/geo+json');
  const bad = createForecastService({fetcher: async () => new Response('{"nope":1}', {status: 200}), now: () => T('2026-11-09T05:00:00Z'), sleep: async () => {}});
  assert.equal((await bad(new Request('http://x.test/api/provider?key=shore-asos-HAF'), {})).status, 502, 'not an observation response');
});
test('access: loadShoreWindNow returns a reading, null for a spot with no station (no request), null on a failed feed or a stale reading', async () => {
  const sp = (n: string) => evidenceSpots.find((s) => s.name === n)!.id, now = T('2026-11-09T05:20:00Z');
  let calls = 0; const ok: typeof fetch = async (u: any) => { calls++; return new Response(String(u).includes('weather.gov') ? fx('nws-KHAF.json') : fx('ndbc-CECC1.txt'), {status: 200}); };
  const mav = await loadShoreWindNow(sp('Mavericks'), now, ok); assert.ok(mav && mav.stationId === 'HAF' && mav.mph === 9.2 && mav.dirDeg === 350 && mav.distanceKm === 2.1);
  assert.equal(await loadShoreWindNow(sp('Ocean Beach'), now, ok), null); assert.equal(calls <= 1, true, 'no request for a spot without a station');
  assert.equal(await loadShoreWindNow(sp('Black’s Beach'), now, async () => { throw new Error('down'); }), null, 'a failed feed shows nothing');
  assert.equal(await loadShoreWindNow(sp('Imperial Beach'), now + 5 * 3600000, ok), null, 'a stale reading shows nothing');
});
