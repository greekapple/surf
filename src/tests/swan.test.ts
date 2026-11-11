import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {allSpots} from '../data/catalog.ts';
import {SWAN_ENABLED} from '../ocean/swanFlag.ts';
import {SWAN_POINTS, SWAN_NO_POINT, SWAN_PROVENANCE} from '../ocean/swanPointsSourced.ts';
import {normalizeSwanPoint, pickSwan, swanCells, swanCellsFor, swanKey, swanProviderKey, swanURL, SWAN_LABEL} from '../ocean/swan.ts';
import {ingestionTargets} from '../../services/forecast-service.mjs';
import {headlineSurf} from '../services/headlineSurf.ts';

const hawaii = allSpots.filter((s) => /^w-hawaii-/.test(s.id) || s.id === 'w-hawaii-hookipa');
test('swan-hawaii: the flag is OFF and a test pins it (turning it on needs the buoy comparison, a reviewed table and a data-honesty review)', () => {
  assert.equal(SWAN_ENABLED, false);
  const targets = ingestionTargets(Date.parse('2026-11-11T12:00:00Z')).map((t: any) => t.key); assert.equal(targets.filter((k: string) => /swan/.test(k)).length, 0, 'no Worker target while the flag is off');
});
test('swan-hawaii: every one of the 152 Hawaii spots is either given ONE cell (8-20 m deep, within 1.5 km, unreviewed) or listed with the reason it has none', () => {
  const ids = new Set(allSpots.filter((s) => s.timeZone === 'Pacific/Honolulu' || /^w-hawaii-/.test(s.id)).map((s) => s.id));
  const pts = new Map(SWAN_POINTS.map((p) => [p.spotId, p])), none = new Map(SWAN_NO_POINT.map((p) => [p.spotId, p.reason]));
  assert.equal(SWAN_POINTS.length + SWAN_NO_POINT.length, 152); assert.equal(pts.size, SWAN_POINTS.length, 'one cell per spot');
  for (const id of pts.keys()) { assert.ok(!none.has(id), id); assert.ok(allSpots.some((s) => s.id === id), id); }
  for (const p of SWAN_POINTS) { assert.ok(p.depthM >= 8 && p.depthM <= 20, `${p.spotId} depth ${p.depthM}`); assert.ok(p.distanceKm <= 1.5, p.spotId); assert.equal(p.review, 'unreviewed'); assert.equal(p.status, 'sourced'); assert.equal(p.provenance, SWAN_PROVENANCE); assert.match(p.dataset, /^swan_(oahu|maui|bigi|kauai)$/); }
  for (const [id, why] of none) { assert.ok(allSpots.some((s) => s.id === id), id); assert.match(why, /^(no SWAN cell within 1\.5 km is seaward of the pin AND 8 to 20 m deep on the 50 m bathymetry: the pin has \d+ wet cells within 1\.5 km, \d+ of them on the seaward side|outside the PacIOOS SWAN grids|the model or bathymetry request returned no data)/, id); }
  assert.deepEqual([...ids].sort(), [...pts.keys(), ...none.keys()].sort(), 'the table covers exactly the Hawaii spots of the catalogue: no spot missing, none extra');
  assert.equal(swanCells().length, 0, 'with the flag off the accessors see no table'); assert.ok(swanCells(SWAN_POINTS).length <= SWAN_POINTS.length && swanCells(SWAN_POINTS).length > 80, 'spots share cells'); assert.ok(swanCellsFor(['w-hawaii-hookipa'], SWAN_POINTS).length <= 1);
  // the table is in neither bundle while the flag is off: no app or Worker file imports it (only types), and the entry points import swanEnable only when the flag is on
  const walk = (d: URL): string[] => fs.readdirSync(d, {withFileTypes: true}).flatMap((e) => (e.isDirectory() ? (e.name === 'tests' ? [] : walk(new URL(e.name + '/', d))) : [new URL(e.name, d).pathname]));
  const files = [...walk(new URL('../', import.meta.url)), ...walk(new URL('../../services/', import.meta.url)), ...walk(new URL('../../worker/', import.meta.url))].filter((f) => /\.(ts|tsx|mjs)$/.test(f));
  for (const f of files) { const src = fs.readFileSync(f, 'utf8'); if (/swanPointsSourced/.test(src) && !/swanEnable\.ts$|swanPointsSourced\.ts$/.test(f)) assert.ok(!/import\s+(?!type)[^;]*swanPointsSourced/.test(src), `${f} imports the SWAN table at run time`); }
  const entryImports = ['../main.tsx', '../../worker/index.mjs'].map((f) => /swanEnable/.test(fs.readFileSync(new URL(f, import.meta.url), 'utf8')));
  assert.deepEqual(entryImports, [SWAN_ENABLED, SWAN_ENABLED], 'the flag and the two entry imports of swanEnable must agree');
});
const table = (rows: unknown[][], units = ['UTC', 'm', 'degrees_north', 'degrees_east', 'meters', 's', 'degrees_true']) => ({table: {columnNames: ['time', 'depth', 'latitude', 'longitude', 'shgt', 'pper', 'pdir'], columnUnits: units, rows}});
const P = {dataset: 'swan_oahu', lat: 21.65, lon: -158.07, depthM: 12.3};
test('swan-hawaii: the reader keeps finite rows, drops missing ones (never fills), converts metres to feet, leaves times untouched, refuses a table with other units', () => {
  const j = table([['2026-11-11T00:00:00Z', 0, 21.65, -158.07, 1.5, 12, 320], ['2026-11-11T01:00:00Z', 0, 21.65, -158.07, null, 12, 320], ['2026-11-11T02:00:00Z', 0, 21.65, -158.07, 1.8, null, 315], ['2026-11-11T03:00:00Z', 0, 21.65, -158.07, 2, 13, 400]]);
  const f = normalizeSwanPoint(j, '2026-11-11T04:00:00Z', 'https://x/y', P)!; assert.equal(f.records.length, 1, 'rows with a missing or impossible value are dropped'); assert.equal(f.records[0].timestamp, '2026-11-11T00:00:00.000Z');
  assert.ok(Math.abs(f.records[0].height.value! - 1.5 / 0.3048) < 1e-9); assert.equal(f.records[0].period.value, 12); assert.equal(f.records[0].direction.value, 320); assert.equal(f.records[0].height.unit, 'ft'); assert.equal(f.records[0].height.source.kind, 'forecast');
  assert.match(f.records[0].height.source.provider, new RegExp(SWAN_LABEL)); assert.match(f.records[0].height.source.notes!, /not at the break/); assert.equal(f.runEnd, '2026-11-11T00:00:00.000Z'); assert.equal(f.pointKey, swanKey(P));
  assert.equal(normalizeSwanPoint(table([['2026-11-11T00:00:00Z', 0, 1, 2, 1.5, 12, 320]], ['UTC', 'm', 'x', 'x', 'feet', 's', 'degrees_true']), '2026-11-11T04:00:00Z', 'u', P), null, 'other units: refused'); assert.equal(normalizeSwanPoint({}, '2026-11-11T04:00:00Z', 'u', P), null);
});
test('swan-hawaii: an hour takes the record at that time or the nearest within 30 minutes; never interpolated', () => {
  const f = normalizeSwanPoint(table([['2026-11-11T00:00:00Z', 0, 0, 0, 1, 10, 300], ['2026-11-11T03:00:00Z', 0, 0, 0, 2, 10, 300]]), '2026-11-11T04:00:00Z', 'u', P)!;
  assert.equal(pickSwan(f.records, Date.parse('2026-11-11T00:20:00Z'))?.timestamp, '2026-11-11T00:00:00.000Z'); assert.equal(pickSwan(f.records, Date.parse('2026-11-11T01:30:00Z')), null, 'between two records 3 h apart: nothing, not a blend');
});
test('swan-hawaii: the Worker key and the request URL name the exact cell; the URL asks ERDDAP for the cell alone', () => {
  assert.equal(swanProviderKey(P), 'nearshore-swan-swan_oahu-21.65_-158.07-forecast'); const u = swanURL(P, Date.parse('2026-11-11T12:00:00Z'));
  assert.match(u, /^https:\/\/pae-paha\.pacioos\.hawaii\.edu\/erddap\/griddap\/swan_oahu_lon180\.json\?shgt%5B\(2026-11-11T06:00:00Z\):1:\(last\)%5D%5B\(0\)%5D%5B\(21\.65\)%5D%5B\(-158\.07\)%5D,pper/); assert.match(u, /pdir%5B/);
});
test('swan-hawaii: with the flag off a Hawaii spot\'s headline is unchanged by SWAN data in the bundle (the branch is never taken, nothing is labelled SWAN)', () => {
  const p = SWAN_POINTS[0], rec = (v: number) => ({value: v, unit: 'ft' as const, source: {provider: 'x', kind: 'forecast' as const, validAt: '', retrievedAt: '', issuedAt: null, updatedAt: null, url: '', nativeUnit: '', location: '', delivery: 'direct' as const}});
  const bundle = {nearshore: [], mop: {}, swan: {[swanKey(p)]: {pointKey: swanKey(p), dataset: p.dataset, lat: p.lat, lon: p.lon, depthM: p.depthM, retrievedAt: '2026-11-11T00:00:00Z', url: '', runEnd: null, records: [{timestamp: '2026-11-11T20:00:00.000Z', height: rec(6), period: rec(14), direction: rec(320), pointKey: swanKey(p)}]}}};
  const hour: any = {spotId: p.spotId, timestamp: '2026-11-11T20:00:00.000Z', hour: 12, day: 0, face: 5, offshore: 5, primary: {height: 5, period: 14, direction: 320}, secondary: null, availability: {}, wind: {}, tide: {}};
  const h = headlineSurf(p.spotId, hour, {bundle: bundle as never, nowMs: Date.parse('2026-11-11T12:00:00Z'), observations: [], felt: []}); assert.notEqual((h as {method?: string}).method, 'swan-v2'); assert.doesNotMatch(JSON.stringify(h), /SWAN/);
  const src = fs.readFileSync(new URL('../services/headlineSurf.ts', import.meta.url), 'utf8'); assert.match(src, /if \(SWAN_ENABLED && !a && ctx\.bundle && Number\.isFinite\(t\)\)/, 'the branch is behind the flag'); assert.match(src, /uncalibrated for this source/);
  for (const f of ['calibration.ts', 'feltRight.ts', 'forecastArchive.ts', 'similarSessions.ts']) assert.match(fs.readFileSync(new URL(`../services/${f}`, import.meta.url), 'utf8'), /swan-v2/, `${f} keeps SWAN out of pairs, felt predictions, the archive and similar sessions`);
});

import {swanEstimate} from '../services/headlineSurf.ts';
test('swan-hawaii: the estimate (reachable only through the flag) is labelled as the PacIOOS SWAN model, uncalibrated, never saved as a pair', () => {
  const rec = (v: number) => ({value: v, unit: 'ft' as const, source: {provider: 'x', kind: 'forecast' as const, validAt: '', retrievedAt: '', issuedAt: null, updatedAt: null, url: '', nativeUnit: '', location: '', delivery: 'direct' as const}});
  let found: any = null, spot = '';
  for (const p of SWAN_POINTS) for (const dir of [0, 45, 90, 135, 180, 225, 270, 315]) {
    if (found) break;
    const k = swanKey(p), bundle = {nearshore: [], mop: {}, swan: {[k]: {pointKey: k, dataset: p.dataset, lat: p.lat, lon: p.lon, depthM: p.depthM, retrievedAt: '2026-11-11T00:00:00Z', url: '', runEnd: '2026-11-16T18:00:00.000Z', records: [{timestamp: '2026-11-11T20:00:00.000Z', height: rec(6.5), period: rec(14), direction: rec(dir), pointKey: k}]}}};
    const hour: any = {spotId: p.spotId, timestamp: '2026-11-11T20:00:00.000Z', hour: 12, day: 0, face: 5, offshore: 5, primary: {height: 5, period: 14, direction: 320}, secondary: null, availability: {}, wind: {}, tide: {}};
    const ctx = {bundle: bundle as never, nowMs: Date.parse('2026-11-11T12:00:00Z'), observations: [], felt: [], spread: null}; assert.equal(swanEstimate(p.spotId, hour, ctx, Date.parse(hour.timestamp)), null, 'the function checks the flag itself'); const h = swanEstimate(p.spotId, hour, ctx, Date.parse(hour.timestamp), true, p); if (h) { found = h; spot = p.spotId; break; }
  }
  assert.ok(found, 'at least one spot with a cell and a breaking profile gives an estimate'); assert.equal(found.method, 'swan-v2'); assert.match(found.methodLabel, /PacIOOS SWAN nearshore model at the nearest wet cell chosen for this spot, about [\d.]+ m deep \(50 m bathymetry\), [\d.]+ km from the spot \(University of Hawaii; model estimate, unvalidated, uncalibrated for this source; confidence forced low: against the two Hawaii buoys SWAN read about 1\.5 ft low.*its past hours are model output, not observations\); the run covers up to 2026-11-16T18:00:00.000Z/); assert.equal(found.confidence, 'low');
  assert.equal(found.calibration, undefined, spot + ': never tuned to a person\'s reports'); assert.ok(found.hiFt > found.loFt);
});
