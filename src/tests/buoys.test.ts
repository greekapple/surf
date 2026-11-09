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

test('registry: five context buoys (three Bay Area, two Oahu); 46214 and CDIP 029 are flagged as the same instrument', () => {
  assert.deepEqual(contextBuoys.map((b) => b.label), ['NDBC 46012', 'NDBC 46214', 'CDIP 029', 'CDIP 098', 'CDIP 106']);
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
  assert.ok(buoysNear(37.759, -122.51).every((b) => ['46012', '46214', '029p1'].includes(b.id)) && buoysNear(37.759, -122.51).length === 3);
  assert.equal(buoysNear(45.976, -123.947).length, 3, 'Seaside (860 km) and San Diego (1,000 km) keep the Bay Area context buoys, as before'); assert.equal(buoysNear(32.7, -117.2).length, 3); assert.deepEqual(buoysNear(-33.9, 151.2), [], 'Sydney: none registered'); const {nearSfBuoy} = await import('../ocean/buoys.ts'); assert.equal(nearSfBuoy(37.76, -122.51), true); assert.equal(nearSfBuoy(21.28, -157.84), false, 'Hawaii does not read the San Francisco buoy');
});
