import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {pickNearestMop, NEAREST_MOP} from '../ocean/spotFactsRules.ts';
import {NEAREST_MOP_PROVENANCE, mopRefused, mopAssignments, assignmentFor, mopCandidates, mopPoints, mopPoint, assignedMopIds, mopURL, mopDasURL, parseMopDas, distanceKm} from '../ocean/mop.ts';
import {normalizeNearshore} from '../ocean/nearshore.ts';
import {serverProviderPath} from '../ocean/server.ts';
import {ingestionTargets, mopServiceIds} from '../../services/forecast-service.mjs';

const hdr = 'time,station,latitude[unit="degrees_north"],longitude[unit="degrees_east"],waveHs[unit="meter"],waveTp[unit="second"],waveDp[unit="degreeT"],waveFlagPrimary';
const fc = [hdr, '2026-11-01T00:00:00Z,SF023,37.748,-122.518,1.5,14.2,226,1', '2026-11-01T03:00:00Z,SF023,37.748,-122.518,1.4,14.2,227,2', '2026-11-01T06:00:00Z,SF023,37.748,-122.518,,13.3,229,1'].join('\n');

const T130 = ['spot-5', 'spot-7', 'cs-shelter-cove', 'cs-rincon', 'spot-0']; // T-130: reviewed points for the four spots the facing-match rule refused
test('only reviewed assignments feed the app; candidates stay out of it', () => {
  assert.deepEqual(assignedMopIds().slice(0, 2), ['SF023', 'SM382']); // SM382 by the T-071 facing-match rule (Linda Mar faces NW, SM382 normal 312°; its own beach transects SM380–SM385)
  assert.ok(assignedMopIds().length >= 40, `T-073: the facing-match rule over every spot's scanned points (${assignedMopIds().length})`);
  assert.ok(!assignedMopIds().includes('MA140') && assignmentFor('spot-0')?.mopId === 'MA137' && /not owner-reviewed/.test(assignmentFor('spot-0')!.provenance ?? ''), 'Bolinas: no point within 25° of its facing, so T-130 assigns MA137 (the best southerly normal among the bay-mouth points), labelled as our choice');
  for (const a of mopAssignments) assert.ok(['sourced', 'owner-reviewed'].includes(a.status) && a.sourceUrl.startsWith('https://'));
  for (const c of mopCandidates) for (const id of c.mopIds) assert.ok(!mopAssignments.some((a) => a.mopId === id) || mopAssignments.some((a) => a.mopId === id && (/facing-match rule/.test(a.note) || T130.includes(a.spotId) || a.provenance === NEAREST_MOP_PROVENANCE)), `${id} is a candidate unless the T-071 facing-match rule (or T-130's reviewed list) assigned it`);
});

test('every registry point matches the measured candidate file (lookup script output)', () => {
  const read = (f: string) => JSON.parse(fs.readFileSync(new URL(`../../docs/forecast/data/${f}`, import.meta.url), 'utf8'));
  const measured = new Map<string, any>([...read('mop-candidates-all.json').spots, ...read('mop-candidates.json').spots].flatMap((s: any) => s.nearest).map((p: any) => [p.id, p]));
  for (const p of mopPoints) {
    const m = measured.get(p.id);
    assert.ok(m, `${p.id} is in mop-candidates.json or mop-candidates-all.json (scripts/mop-scan.mjs)`);
    assert.ok(p.shoreNormalDeg >= 0 && p.shoreNormalDeg < 360, `${p.id} has a valid shore normal (CDIP's -999.99 fill is never used)`);
    assert.equal(m.depthM, p.depthM); assert.equal(m.shoreNormalDeg, p.shoreNormalDeg); assert.equal(m.lat, p.lat); assert.equal(m.lon, p.lon);
  }
  for (const c of mopCandidates) for (const id of c.mopIds) assert.ok(mopPoint(id), `${id} has recorded metadata`);
});

test('forecast and nowcast URLs: 3-hourly forecast horizon about 10 days, fixed host, no free-form input', () => {
  const now = Date.parse('2026-11-01T12:00:00Z');
  const f = new URL(mopURL('SF023', 'forecast', now)), n = new URL(mopURL('SF023', 'nowcast', now));
  assert.equal(f.hostname, 'thredds.cdip.ucsd.edu'); assert.ok(f.pathname.endsWith('/SF023_forecast.nc')); assert.ok(n.pathname.endsWith('/SF023_nowcast.nc'));
  assert.equal(f.searchParams.get('time_end'), '2026-11-12T12:00:00.000Z'); assert.equal(n.searchParams.get('time_end'), '2026-11-02T12:00:00.000Z');
  assert.ok(mopDasURL('SF023').endsWith('SF023_forecast.nc.das'));
});

test('forecast normalizer keeps native provenance, drops unaccepted QC, leaves missing values null', () => {
  const rows = normalizeNearshore(fc, '2026-11-01T01:00:00Z', 'https://thredds.cdip.ucsd.edu/x', 'forecast');
  assert.equal(rows.length, 2, 'QC flag 2 dropped');
  assert.equal(rows[0].product, 'forecast'); assert.equal(rows[0].mopId, 'SF023');
  assert.ok(Math.abs(rows[0].height.value! - 1.5 / 0.3048) < 1e-9);
  assert.equal(rows[0].height.source.provider, 'CDIP MOP SF023'); assert.match(rows[0].height.source.notes!, /forecast/); assert.match(rows[0].height.source.location, /10 m depth/);
  assert.equal(rows[1].height.value, null); assert.ok(rows[1].height.reason);
  assert.equal(rows[1].period.value, 13.3, 'a missing height does not blank the other columns');
});

test('DAS parser reads issue time, coverage and run start only when stated', () => {
  const das = 'NC_GLOBAL {\n String history "2026-11-02T01:47:16Z: dataset created; Net_model version 2.1. Runtime arguments: /x -s 202610300000 -h 240 -g 3";\n String date_issued "2026-11-02T01:47:16Z";\n String time_coverage_start "2026-10-29T23:30:00Z";\n String time_coverage_end "2026-11-08T23:30:00Z";\n String time_coverage_resolution "PT03H00M";\n}';
  assert.deepEqual(parseMopDas(das), {issuedAt: '2026-11-02T01:47:16.000Z', coverageStart: '2026-10-29T23:30:00.000Z', coverageEnd: '2026-11-08T23:30:00.000Z', runStart: '2026-10-30T00:00:00.000Z', resolution: 'PT03H00M'});
  assert.deepEqual(parseMopDas('nothing'), {issuedAt: null, coverageStart: null, coverageEnd: null, runStart: null, resolution: null});
  assert.equal(parseMopDas('String date_issued "not a date";').issuedAt, null);
});

test('service ingests exactly the assigned MOP ids, and the browser routes only those through it', () => {
  assert.deepEqual(mopServiceIds, assignedMopIds());
  const keys = ingestionTargets(Date.parse('2026-11-01T12:00:00Z')).map((t: any) => t.key);
  for (const id of assignedMopIds()) { assert.ok(keys.includes(`nearshore-${id}-forecast`)); assert.ok(keys.includes(`nearshore-${id}-das`)); }
  assert.ok(keys.includes('nearshore-SF023'), 'nowcast target unchanged');
  assert.equal(serverProviderPath(mopURL('SF023', 'forecast')), '/api/provider?key=nearshore-SF023-forecast');
  assert.equal(serverProviderPath(mopURL('SF023', 'nowcast')), '/api/provider?key=nearshore-SF023');
  assert.equal(serverProviderPath(mopDasURL('SF023')), '/api/provider?key=nearshore-SF023-das');
  assert.equal(serverProviderPath(mopURL('SM376', 'forecast')), null, 'unassigned candidate is not ingested');
  // T-073: one-letter county prefixes with four digits (San Diego D0457, Santa Barbara B1084) route through the server too
  assert.equal(serverProviderPath(mopURL('D0457', 'forecast')), '/api/provider?key=nearshore-D0457-forecast');
  assert.equal(serverProviderPath(mopDasURL('B1084')), '/api/provider?key=nearshore-B1084-das');
});

test('distance helper', () => { assert.ok(Math.abs(distanceKm(37.759, -122.51, 37.74811, -122.51886) - 1.44) < 0.05); });

// ca-mop: the nearest-point rule for California spots the facing-match rule could not place
const sha = (x: unknown) => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
test('ca-mop: Ocean Beach, Linda Mar and Bolinas (assignments and candidate lists) are byte-identical to forecast-trust', () => {
  assert.equal(sha(assignmentFor('spot-2')), 'b5efb24081687d44');
  assert.equal(sha(assignmentFor('spot-3')), '867b845794afd39d'); assert.equal(sha(mopCandidates.find((c) => c.spotId === 'spot-3')), '286a4ce127880a10');
  assert.equal(sha(assignmentFor('spot-0')), '8e20f083a89185be'); assert.equal(sha(mopCandidates.find((c) => c.spotId === 'spot-0')), 'c07ffa2fada0d750');
});
test('ca-mop: every nearest-rule assignment is within 1 km, 10 to 20 m deep, in California, labelled "chosen by us", and never replaces a reviewed or facing-matched one', () => {
  const mine = mopAssignments.filter((a) => a.provenance === NEAREST_MOP_PROVENANCE); assert.ok(mine.length >= 40, `${mine.length} nearest-rule assignments`);
  for (const a of mine) {
    const p = mopPoint(a.mopId)!, m = a.note.match(/([\d.]+) km from the spot pin/); assert.ok(p && m, a.spotId);
    assert.ok(Number(m![1]) <= NEAREST_MOP.maxKm, `${a.spotId} ${m![1]} km`); assert.ok(p.depthM >= NEAREST_MOP.minDepthM && p.depthM <= NEAREST_MOP.maxDepthM, `${a.spotId} ${p.depthM} m`);
    assert.equal(a.status, 'sourced'); assert.ok(/not owner-reviewed/.test(a.note) && /nearest CDIP point/.test(a.provenance!));
    assert.equal(mopAssignments.filter((x) => x.spotId === a.spotId).length, 1, `${a.spotId} has one assignment`);
  }
  for (const id of ['spot-2', 'spot-3', 'spot-0', 'spot-5', 'spot-7', 'cs-shelter-cove', 'cs-rincon']) assert.notEqual(assignmentFor(id)?.provenance, NEAREST_MOP_PROVENANCE, id);
  assert.equal(assignmentFor('spot-2')!.mopId, 'SF023'); assert.equal(assignmentFor('spot-3')!.mopId, 'SM382'); assert.equal(assignmentFor('spot-0')!.mopId, 'MA137');
  for (const r of mopRefused) assert.ok(!assignmentFor(r.spotId), `${r.spotId} was refused (${r.reason}) and is not assigned`);
});
test('ca-mop: pickNearestMop bounds (distance, depth, breakwater, normal agreement)', () => {
  const c = (id: string, n: number, depthM: number, distanceKm: number) => ({id, shoreNormalDeg: n, depthM, distanceKm});
  const line = [c('A', 270, 15, 0.4), c('B', 268, 15, 0.5), c('C', 272, 15, 0.6)];
  const ok = pickNearestMop(null, line); assert.ok('pick' in ok && ok.pick.id === 'A' && ok.pick.agreed === 'neighbours');
  assert.ok('pick' in pickNearestMop(250, [c('A', 270, 15, 0.4)]), 'within 30° of a known facing needs no neighbours');
  assert.deepEqual(pickNearestMop(null, [c('A', 270, 15, 1.2), ...line.slice(1)]).hasOwnProperty('pick'), true, 'the 1.2 km point is ignored, the nearest within 1 km is used');
  assert.equal(('refused' in pickNearestMop(null, [c('A', 270, 15, 1.01), c('B', 270, 15, 2)]) && (pickNearestMop(null, [c('A', 270, 15, 1.01)]) as any).refused), 'none within 1 km');
  assert.match((pickNearestMop(250, [c('A', 270, 6, 0.3)]) as any).refused, /breakwater or in a harbour/);
  assert.match((pickNearestMop(250, [c('A', 270, 25, 0.3)]) as any).refused, /10 to 20 m/);
  assert.match((pickNearestMop(null, [c('A', 270, 15, 0.3), c('B', 350, 15, 0.5), c('C', 355, 15, 0.6)]) as any).refused, /disagrees with the coast/, 'a normal 80° off its neighbours points into a harbour or bay');
  assert.match((pickNearestMop(null, [c('A', 270, 15, 0.3)]) as any).refused, /no neighbours/);
  assert.ok('pick' in pickNearestMop(null, [c('A', 359, 15, 0.3), c('B', 5, 15, 0.5), c('C', 352, 15, 0.6)]), 'the check wraps around north');
});
