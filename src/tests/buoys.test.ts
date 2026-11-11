import test from 'node:test';
import assert from 'node:assert/strict';
import {contextBuoys, ndbcBuoyURL, cdipBuoyURL, normalizeCdipBuoy} from '../ocean/buoys.ts';
import {normalizeBuoy} from '../ocean/noaa.ts';
import {serverProviderPath} from '../ocean/server.ts';
import {ingestionTargets, contextBuoyKeys} from '../../services/forecast-service.mjs';

const hdr = 'time,station,latitude[unit="degrees_north"],longitude[unit="degrees_east"],waveHs[unit="meter"],waveTp[unit="second"],waveDp[unit="degreeT"]';
const cdip = [hdr, '2026-11-02T04:30:00Z,POINT REYES, CA BUOY - 029p1,37.941,-123.464,2.21,15.384616,188.78', '2026-11-02T05:00:00Z,POINT REYES, CA BUOY - 029p1,37.941,-123.464,2.17,6.6666665,325.19', '2026-11-02T05:30:00Z,POINT REYES, CA BUOY - 029p1,37.941,-123.464,,22.2,294.25'].join('\n');
const AT = '2026-11-02T06:00:00Z';
const ndbc = (cols: string) => ['#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS PTDY  TIDE', '#yr  mo dy hr mn degT m/s  m/s     m   sec   sec degT   hPa  degC  degC  degC  nmi  hPa    ft', cols].join('\n');

test('registry: five Pacific context buoys (three Bay Area, two Oahu) plus 24 Atlantic NDBC buoys; 46214 and CDIP 029 are flagged as the same instrument', () => {
  assert.deepEqual(contextBuoys.slice(0, 5).map((b) => b.label), ['NDBC 46012', 'NDBC 46214', 'CDIP 029', 'CDIP 098', 'CDIP 106']);
  const east = contextBuoys.slice(5, 29), west = contextBuoys.slice(29, 54), pnw = contextBuoys.slice(54, 64), batch3 = contextBuoys.slice(64); assert.equal(east.length, 24); assert.ok(east.every((b) => b.provider === 'NDBC' && b.lon > -83 && b.lon < -65 && b.lat > 24 && b.lat < 46), 'every extra buoy floats in the Atlantic');
  assert.equal(west.length, 25); assert.ok(west.every((b) => b.provider === 'NDBC' && !b.sheltered && b.lon > -125 && b.lon < -117 && b.lat > 32 && b.lat < 41 && b.fetchKey === 'ndbc-' + b.id), 'the US West buoys float off California, none inside a bay'); assert.equal(new Set(contextBuoys.map((b) => b.id)).size, contextBuoys.length);
  assert.equal(pnw.length, 10); assert.ok(pnw.every((b) => b.provider === 'NDBC' && b.lon > -137 && b.lon < -123 && b.lat > 42 && b.lat < 58 && b.fetchKey === 'ndbc-' + b.id), 'the Oregon, Washington and Sitka buoys'); assert.deepEqual(pnw.filter((b) => b.sheltered).map((b) => b.id).sort(), ['46088', '46267'], 'the two Strait of Juan de Fuca buoys are sheltered');
  assert.equal(batch3.length, 9); assert.ok(batch3.every((x) => x.provider === 'NDBC' && x.fetchKey === 'ndbc-' + x.id && x.lon > -98 && x.lon < -64 && x.lat > 17 && x.lat < 38), 'batch 3: Atlantic, Gulf of Mexico and Caribbean NDBC buoys'); assert.deepEqual(batch3.filter((x) => x.sheltered).map((x) => [x.id, x.shelterWhy]), [['44058', 'inside the Chesapeake Bay']], 'only Stingray Point is sheltered, and says why'); assert.deepEqual(contextBuoys.filter((x) => x.sheltered).map((x) => !!x.shelterWhy), contextBuoys.filter((x) => x.sheltered).map(() => true), 'every sheltered buoy says why');
  assert.match(contextBuoys[1].note!, /Same buoy as CDIP 029/); assert.match(contextBuoys[2].note!, /second feed, not an independent/);
});
test('CDIP buoy CSV: comma in the station name is handled, each value keeps its own time, a blank Hs is not filled', () => {
  const s = normalizeCdipBuoy(cdip, AT, 'https://x.test/029')!;
  assert.equal(s.station, 'CDIP 029'); assert.match(s.location, /Point Reyes/);
  const hs = s.values['Offshore significant height'], tp = s.values['Dominant wave period'], dp = s.values['Peak wave direction'];
  assert.ok(Math.abs(hs.value! - 2.17 / 0.3048) < 1e-9); assert.equal(hs.source.validAt, '2026-11-02T05:00:00.000Z', 'newest row WITH a height');
  assert.equal(tp.value, 22.2); assert.equal(tp.source.validAt, '2026-11-02T05:30:00.000Z'); assert.equal(dp.value, 294.25);
  assert.equal(hs.source.kind, 'observation'); assert.match(hs.source.notes!, /not an independent reading/);
});
test('CDIP buoy CSV: wrong units, stale, future, empty and malformed input give nothing', () => {
  assert.equal(normalizeCdipBuoy(cdip.replace('unit="meter"', 'unit="feet"'), AT, 'x'), null);
  assert.equal(normalizeCdipBuoy(cdip, '2026-11-04T06:00:00Z', 'x'), null, 'older than 24 h');
  assert.equal(normalizeCdipBuoy(cdip, '2026-11-02T03:00:00Z', 'x')?.values['Offshore significant height']?.source.validAt, undefined, 'rows after the retrieval time are future');
  assert.equal(normalizeCdipBuoy(hdr, AT, 'x'), null); assert.equal(normalizeCdipBuoy('error', AT, 'x'), null); assert.equal(normalizeCdipBuoy(cdip, 'bad', 'x'), null);
});
test('NDBC buoys: station-specific provider, URL and label; 46026 output unchanged; missing columns stay out', () => {
  const t = ndbc('2026 11 02 05 26  MM   MM   MM   2.2     7   6.7 325     MM    MM  18.8    MM   MM   MM    MM');
  const s = normalizeBuoy(t, AT, 'direct', '46214')!;
  assert.equal(s.station, '46214'); assert.match(s.location, /Point Reyes/); assert.equal(s.values['Offshore significant height'].source.provider, 'NOAA NDBC 46214'); assert.equal(s.values['Offshore significant height'].source.url, ndbcBuoyURL('46214'));
  assert.ok(Math.abs(s.values['Offshore significant height'].value! - 2.2 / 0.3048) < 1e-9); assert.equal(s.values['Mean wave direction'].value, 325); assert.equal(s.values['Wind speed'], undefined);
  const sf = normalizeBuoy(ndbc('2026 11 02 05 00 310  7.0  8.0   1.8     9    MM  MM 1018.8  16.7  18.6  13.0   MM +2.0    MM'), AT)!;
  assert.equal(sf.station, '46026'); assert.equal(sf.location, 'Offshore San Francisco buoy'); assert.equal(sf.values['Wind speed'].source.provider, 'NOAA NDBC 46026');
  assert.equal(normalizeBuoy('nothing', AT, 'direct', '46012'), null);
});
test('server routes exactly these buoys by fixed keys and the service ingests the same keys', () => {
  assert.equal(serverProviderPath(ndbcBuoyURL('46012')), '/api/provider?key=ndbc-46012'); assert.equal(serverProviderPath(ndbcBuoyURL('46214')), '/api/provider?key=ndbc-46214');
  assert.equal(serverProviderPath(cdipBuoyURL('029p1')), '/api/provider?key=cdip-029'); assert.equal(serverProviderPath(ndbcBuoyURL('46026')), '/api/provider?key=buoy');
  assert.equal(serverProviderPath(ndbcBuoyURL('46999')), null, 'unregistered station never proxied'); assert.equal(serverProviderPath(cdipBuoyURL('999p1')), null);
  assert.deepEqual(contextBuoyKeys, contextBuoys.map((b) => b.fetchKey));
  const keys = ingestionTargets(Date.parse('2026-11-02T12:00:00Z')).map((t: any) => t.key);
  for (const k of contextBuoyKeys) assert.ok(keys.includes(k), k);
});

test('buoysNear: the Hawaii spots get the two Oahu buoys and never the Point Reyes buoy; a Bay Area spot gets the Bay Area ones', async () => {
  const {buoysNear} = await import('../ocean/buoys.ts');
  assert.deepEqual(buoysNear(21.665, -158.053).map((b) => b.id).sort(), ['098p1', '106p1']); assert.equal(buoysNear(21.665, -158.053)[0].id, '106p1', 'Pipeline: Waimea Bay buoy is nearest');
  assert.deepEqual(buoysNear(21.28, -157.84).map((b) => b.id)[0], '098p1', 'Waikiki: Mokapu Point is nearest');
  assert.deepEqual(buoysNear(37.759, -122.51).map((b) => b.id), ['46237', '46026', '46012', '46214'], 'Ocean Beach: the San Francisco Bar buoy (12 km) and 46026 come first; Point Reyes is one buoy, shown once (the NDBC feed, not also the CDIP 029 second feed); Port Orford is past the 500 km cap');
  assert.deepEqual(buoysNear(45.976, -123.947).map((b) => b.id), ['46243', '46278', '46211', '46050'], 'Seaside sees its Oregon and Washington buoys (the Bay Area ones are 860 km away)'); assert.deepEqual(buoysNear(32.7, -117.2).map((b) => b.id), ['46254', '46232', '46266', '46274'], 'San Diego now sees its own buoys, not the Bay Area ones; the La Jolla pier gauge LJPC1 gives way to the Scripps Nearshore buoy 1 km away'); assert.deepEqual(buoysNear(-33.9, 151.2), [], 'Sydney: none registered'); const {nearSfBuoy} = await import('../ocean/buoys.ts'); assert.equal(nearSfBuoy(37.76, -122.51), true); assert.equal(nearSfBuoy(21.28, -157.84), false, 'Hawaii does not read the San Francisco buoy');
});

test('buoysNear shows one of a twin pair: Point Reyes is one buoy (46214 or CDIP 029, never both), and the La Jolla pier gauge gives way to the Scripps buoy', async () => {
  const {buoysNear, contextBuoys} = await import('../ocean/buoys.ts');
  for (const [la, lo] of [[40.44, -124.41], [37.76, -122.51], [45.98, -123.95], [34.03, -118.68], [32.87, -117.26]] as const) { const ids = buoysNear(la, lo).map((b) => b.id); assert.ok(!(ids.includes('46214') && ids.includes('029p1')), `${la},${lo}: ${ids}`); assert.ok(!(ids.includes('LJPC1') && ids.includes('46254')), ids.join()); }
  assert.ok(!buoysNear(32.87, -117.26).some((b) => b.id === 'LJPC1')); assert.match(contextBuoys.find((b) => b.id === 'LJPC1')!.note!, /no wave direction/);
  assert.equal(contextBuoys.filter((b) => b.twinOf).length, 3, 'Point Reyes, the La Jolla pier gauge, and the co-located Port Aransas Spotters 42033 and 42034'); for (const b of contextBuoys.filter((b) => b.twinOf)) assert.ok(contextBuoys.some((x) => x.id === b.twinOf), b.id);
});

test('the co-located Port Aransas Spotters (42033, 42034) show as one buoy, and a sheltered buoy with no observation says why once', async () => {
  const {buoysNear, contextBuoys} = await import('../ocean/buoys.ts'); const ids = buoysNear(27.84, -97.05).map((b) => b.id);
  assert.ok(ids.includes('42033') && !ids.includes('42034'), 'one of the pair: ' + ids); assert.equal(contextBuoys.find((b) => b.id === '42034')!.twinOf, '42033');
  const stingray = contextBuoys.find((b) => b.id === '44058')!; assert.equal(stingray.shelterWhy, 'inside the Chesapeake Bay');
});

test('context buoys: within 500 km of the spot (the three Bay Area buoys keep 1,500 km); Sitka shows only its own buoy; a spot in the Strait of Juan de Fuca or Admiralty Inlet sees the strait buoys first; the shelter note names the water', async () => {
  const {buoysNear, contextBuoys, CONTEXT_BUOY_KM, BAY_AREA_CONTEXT_KM} = await import('../ocean/buoys.ts'); assert.equal(CONTEXT_BUOY_KM, 500); assert.equal(BAY_AREA_CONTEXT_KM, 1500);
  assert.deepEqual(buoysNear(57.301, -135.831).map((b) => b.id), ['46084'], 'Sitka: not the Washington buoys 1,100 km away');
  assert.deepEqual(buoysNear(48.161, -123.711).map((b) => b.id).slice(0, 2), ['46267', '46087'], 'Crescent Beach (strait): Angeles Point first although it is sheltered'); assert.equal(buoysNear(48.217, -122.768)[0].id, '46088', 'Fort Ebey (Admiralty Inlet): New Dungeness first');
  assert.equal(buoysNear(48.493, -124.727)[0].id, '46087', 'Neah Bay: the open-ocean buoy is nearer than any strait buoy, so it stays first'); assert.equal(buoysNear(41.77, -70.5)[0].id, '44090', 'Cape Cod Bay (Sandwich): its own bay buoy, nearest and in the same water');
  for (const id of ['46088', '46267']) { const b = contextBuoys.find((x) => x.id === id)!; assert.equal(b.sheltered, true); assert.equal(b.shelterWhy, 'inside the Strait of Juan de Fuca'); }
});
