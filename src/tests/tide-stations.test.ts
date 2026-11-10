import test from 'node:test';
import assert from 'node:assert/strict';
import {tideStations, tideStation, extraTideStationIds, hiloTideStationIds, tideAssignments, nearestTideStations, tideStationForSpot, SF_STATION} from '../ocean/tideStations.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {tideURL, tideExtremaURL, normalizeTides, normalizeTideExtrema, stationOf} from '../ocean/noaa.ts';
import {serverProviderPath} from '../ocean/server.ts';
import {ingestionTargets, tideServiceStationIds, tideHiloServiceStationIds} from '../../services/forecast-service.mjs';

const payload = {predictions: [{t: '2026-11-01 05:26', v: '-0.437', type: 'L'}, {t: '2026-11-01 12:51', v: '4.251', type: 'H'}]};

test('registry holds the three stations; the two new ones are ingested but assigned to no spot until review', () => {
  assert.deepEqual(tideStations.slice(0, 3).map((s) => s.id), ['9414290', '9414131', '9415020']); // T-082 appends the nearest station of every covered spot
  assert.deepEqual(extraTideStationIds, ['9414131', '9415020']);
  assert.deepEqual(tideServiceStationIds, extraTideStationIds, 'service and registry agree');
  assert.deepEqual(tideAssignments, []);
  assert.equal(tideStation('9414131')?.name, 'Pillar Point Harbor'); assert.equal(tideStation('9415020')?.name, 'Point Reyes'); assert.equal(tideStation('0000000'), null);
});

test('URLs are station-specific; default stays San Francisco', () => {
  assert.equal(stationOf(tideURL('predictions')), '9414290');
  assert.equal(stationOf(tideURL('predictions', new Date('2026-11-01T00:00:00Z'), '9414131')), '9414131');
  const hilo = new URL(tideExtremaURL(new Date('2026-11-01T00:00:00Z'), '9415020'));
  assert.equal(hilo.searchParams.get('station'), '9415020'); assert.equal(hilo.searchParams.get('interval'), 'hilo'); assert.equal(hilo.searchParams.get('datum'), 'MLLW');
});

test('normalizers keep the station id and say "station tide, not a beach tide"; San Francisco wording is unchanged', () => {
  const pp = normalizeTides(payload, '2026-11-01T01:00:00Z', tideURL('predictions', new Date('2026-11-01T00:00:00Z'), '9414131'));
  const m = [...pp.values()][0]; assert.equal(m.source.provider, 'NOAA CO-OPS 9414131'); assert.match(m.source.location, /Pillar Point Harbor station 9414131; station tide, not a beach tide/); assert.equal(m.source.nativeUnit, 'ft MLLW');
  const sf = [...normalizeTides(payload, '2026-11-01T01:00:00Z', tideURL('predictions')).values()][0];
  assert.equal(sf.source.provider, 'NOAA CO-OPS 9414290'); assert.equal(sf.source.location, 'San Francisco station 9414290; regional reference, not a beach tide');
  const ex = normalizeTideExtrema(payload, '2026-11-01T01:00:00Z', tideExtremaURL(new Date('2026-11-01T00:00:00Z'), '9415020'));
  assert.deepEqual(ex.map((e) => e.type), ['Low', 'High']); assert.equal(ex[0].height.source.provider, 'NOAA CO-OPS 9415020');
});

test('server routes the new stations by fixed keys and nothing else', () => {
  assert.equal(serverProviderPath(tideURL('predictions', new Date(), '9414131')), '/api/provider?key=tides-9414131');
  assert.equal(serverProviderPath(tideExtremaURL(new Date(), '9415020')), '/api/provider?key=tide-extrema-9415020');
  assert.equal(serverProviderPath(tideURL('predictions')), '/api/provider?key=tides');
  assert.equal(serverProviderPath(tideURL('predictions', new Date(), '9413745')), null, 'an unregistered station is never proxied');
  assert.equal(serverProviderPath(tideURL('water_level', new Date(), '9414131')), null, 'water level exists only for the SF gauge');
  const keys = ingestionTargets(Date.parse('2026-11-01T12:00:00Z')).map((t: any) => t.key);
  for (const id of extraTideStationIds) { assert.ok(keys.includes('tides-' + id)); assert.ok(keys.includes('tide-extrema-' + id)); }
});

test('nearest stations for the review list: Linda Mar is closest to Pillar Point; the list never assigns', () => {
  const near = nearestTideStations(37.6, -122.5);
  assert.equal(near[0].station.id, '9414131'); assert.ok(near[0].distanceKm < 15 && near[0].distanceKm < near[1].distanceKm);
  assert.deepEqual(tideAssignments, []);
});

// T-082: Home's "Next tide" must never be a dash where a CO-OPS prediction station is within 40 km.
test('every covered spot has its nearest prediction station within 40 km, and that station is ingested', () => {
  const ingested = new Set([SF_STATION, ...extraTideStationIds, ...hiloTideStationIds]);
  const none: string[] = [], eastNone: string[] = [];
  for (const e of evidenceSpots) {
    const near = tideStationForSpot(e.latitude, e.longitude);
    if (!near) { (e.id.startsWith('w-us-') ? eastNone : none).push(e.name); continue; }
    assert.ok(ingested.has(near.station.id), `${e.name}: nearest station ${near.station.id} (${near.distanceKm} km) is not ingested`);
  }
  assert.deepEqual(none, [], 'spots with no station within 40 km');
  // US East: a spot has a tide station only where a reviewed OPEN-coast station is within 40 km (most East stations sit in bays, harbours and the Intracoastal Waterway); the rest honestly have none
  assert.ok(eastNone.length > 0 && eastNone.length < evidenceSpots.filter((e) => e.id.startsWith('w-us-')).length / 2, `East spots without a tide station: ${eastNone.length}`);
  assert.ok(evidenceSpots.length >= 45, 'the check above covers every spot, however many there are');
});
test('the high/low stations: registry and service agree, the server routes their high/low only, and they have hilo targets', () => {
  assert.deepEqual(tideHiloServiceStationIds, hiloTideStationIds);
  for (const id of hiloTideStationIds) assert.ok(tideStation(id), id);
  assert.equal(serverProviderPath(tideExtremaURL(new Date(), '9413745')), '/api/provider?key=tide-extrema-9413745');
  const keys = ingestionTargets(Date.parse('2026-11-01T12:00:00Z')).map((t: any) => t.key);
  for (const id of hiloTideStationIds) { assert.ok(keys.includes('tide-extrema-' + id), id); assert.ok(!keys.includes('tides-' + id), id + ' has no hourly series'); }
});
test('open-coast rule: the stations the OR/WA and California reviews rejected are closed, entrances and jetties are open, a town name is allowed', async () => {
  const {tideStationExposure, pickTideStation, tideStationForSpot} = await import('../ocean/tideStations.ts');
  const x = (n: string) => tideStationExposure(n).exposure;
  for (const n of ['Cathcart Landing, Youngs River', 'Tarlatt Slough', 'North Fork, Nehalem River', 'Warrenton, Skipanon River, Oreg.', 'Greenhead Slough', 'Quivira Basin, Mission Bay', 'Santa Ana River entrance (inside)', 'Bolinas Lagoon', 'Elkhorn Slough railroad bridge', 'Astoria (Port Docks), Oreg.', 'La Push, Quillayute River', 'Gold Beach, Rogue River', 'Astoria (Youngs Bay), Oreg.', 'Ilwaco, Baker Bay, Wash.', 'Depoe Bay']) assert.equal(x(n), 'closed', n);
  for (const n of ['Cape Disappointment', 'Columbia River entrance (N. Jetty)', 'North Jetty, Tillamook Bay', 'Point Adams, Oreg.', 'James Island', 'Newport Bay Entrance, Corona del Mar', 'La Jolla (Scripps Institution Wharf)', 'Santa Monica, Municipal Pier', 'Mugu Lagoon (ocean pier)', 'Ocean Beach, outer coast', 'Siuslaw River Entrance', 'Nestucca Bay entrance', 'Westport, Point Chehalis', 'Humboldt Bay (North Spit)']) assert.equal(x(n), 'open', n);
  for (const n of ['Nehalem', 'Brighton', 'San Francisco', 'Ventura', 'Port San Luis', 'Brookings, Chetco Cove', 'CHARLESTON', 'Makah Bay', 'Santa Cruz, Monterey Bay', 'El Segundo, Santa Monica Bay']) assert.equal(x(n), 'unknown', n);
  // the pick: never a closed station, nearest otherwise; a spot with only closed stations in range gets none
  const st = [{name: 'Cathcart Landing, Youngs River', lat: 46.15, lon: -123.88}, {name: 'Point Adams, Oreg.', lat: 46.2, lon: -123.98}, {name: 'Hammond, Oregon', lat: 46.2, lon: -123.95}];
  assert.equal(pickTideStation(45.976, -123.947, st)!.station.name, 'Hammond, Oregon'); assert.equal(pickTideStation(45.976, -123.947, [st[0]]), null); assert.equal(pickTideStation(45.976, -123.947, st, 10), null, 'beyond 40 km / the given range');
  // the Phase B review cases, on the real registry: Blackies, Pacific Beach, Sunset Cliffs and Bolinas leave their river/basin/lagoon stations
  assert.equal(tideStationForSpot(33.598, -117.9)!.station.id, '9410580', 'Blackies: Newport Bay Entrance, not the Santa Ana River (inside)');
  assert.equal(tideStationForSpot(32.794, -117.256)!.station.id, '9410230', 'Pacific Beach: La Jolla, not Quivira Basin'); assert.equal(tideStationForSpot(32.72, -117.26)!.station.id, '9410230', 'Sunset Cliffs/OB San Diego: La Jolla');
  assert.equal(tideStationForSpot(37.908, -122.682)!.station.id, '9414275', 'Bolinas: the outer coast Ocean Beach station, not Bolinas Lagoon');
});
test('OR/WA review: reviewed overrides beat the words, one station per spot near San Francisco, and the map point uses the same open-coast pick', async () => {
  const {TIDE_EXPOSURE_OVERRIDES, tideStationExposure, tideStationFor, tideStationForSpot, pickTideStation} = await import('../ocean/tideStations.ts');
  const {evidenceSpots} = await import('../ocean/spots.ts'), {pointInUs} = await import('../ocean/coverage.ts');
  for (const [id, o] of Object.entries(TIDE_EXPOSURE_OVERRIDES)) assert.match(o.reason, /^.+https:\/\/tidesandcurrents\.noaa\.gov\/stationhome\.html\?id=/, `${id}: a reason with the CO-OPS page`);
  assert.equal(tideStationExposure('Nehalem', '9437908').exposure, 'closed'); assert.equal(tideStationExposure('Nehalem').exposure, 'unknown', 'without the reviewed id the word rule cannot tell');
  assert.equal(tideStationExposure('YAQUINA USCG STA, NEWPORT', '9435385').exposure, 'closed'); assert.equal(tideStationExposure('Southbeach', '9435380').exposure, 'open');
  const spot = (n: string) => evidenceSpots.find((s) => s.name === n)!, id = (n: string) => tideStationFor(spot(n))?.station.id;
  assert.equal(id('Short Sands'), '9437585', 'Short Sands: North Jetty, Tillamook Bay, not Nehalem'); assert.equal(id('Cannon Beach'), 'TWC0881'); assert.notEqual(id('Cannon Beach'), '9437908');
  assert.equal(id('Agate Beach'), '9435380', 'Newport: the active South Beach station, not the 1982 USCG one'); assert.equal(id('Otter Rock'), '9435380');
  assert.equal(id('Bastendorff Beach'), '9432436', 'Charleston is dropped because an open-coast station (Coquille River entrance) is within 40 km');
  // Charleston is kept when it is the only choice
  const lone = [{id: '9432780', name: 'CHARLESTON', lat: 43.345, lon: -124.322}, {id: 'x', name: 'Empire', lat: 43.38, lon: -124.3}]; assert.equal(pickTideStation(43.347, -124.347, [lone[0]])!.station.id, '9432780', 'kept: no open alternative in range');
  // one station per spot: Bolinas and Stinson use the SF regional reference (their hourly series), spots with a local station keep it, and SF is not used beyond 40 km
  assert.equal(id('Bolinas'), '9414290'); assert.equal(id('Stinson Beach'), '9414290'); assert.equal(id('Ocean Beach'), '9414275'); assert.equal(id('Pescadero State Beach'), tideStationForSpot(spot('Pescadero State Beach').latitude, spot('Pescadero State Beach').longitude)?.station.id);
  // the map point panel's pick: US points only, never a closed station
  assert.equal(pointInUs(45.976, -123.947), true); assert.equal(pointInUs(38.7, -9.4), false); assert.equal(tideStationForSpot(45.976, -123.947)?.station.id, 'TWC0881');
});

test('Hawaii review round: harbour gauges whose predicted times match their open-coast neighbours are open, so Maui north shore uses Kahului (not Makena, 70+ min later), Lahaina spots use Lahaina and Oahu west uses Waianae; a harbour-gauge fallback is labelled as one', async () => {
  const {pickTideStation, tideStations: st, fallbackLabel, tideStationExposure} = await import('../ocean/tideStations.ts');
  const pick = (lat: number, lon: number) => pickTideStation(lat, lon, st)!;
  assert.equal(pick(20.934, -156.356).station.name.toUpperCase(), 'KAHULUI');   // Hookipa
  assert.equal(pick(20.8756, -156.6785).station.name, 'Lahaina');   // Mala Wharf
  assert.equal(pick(21.45, -158.19).station.name, 'Waianae');   // Makaha Point area
  assert.equal(tideStationExposure('x', '1615680').exposure, 'open'); assert.match(tideStationExposure('x', '1615680').why, /Hana|Lahaina|Makena/);
  assert.equal(tideStationExposure('x', '1611347').exposure, 'closed-if-alternative');
  assert.equal(fallbackLabel('1611347'), 'Harbour gauge'); assert.equal(fallbackLabel('8515186'), 'Inlet or bay-side station');
});
