import test from 'node:test';
import assert from 'node:assert/strict';
import {OBSERVING_BUOYS, nearestBuoy, relationOf, sameWaveClimate, buoyFeedURL, parseCdipSeries, parseNdbcSeries, pairSeries, score, regimeOf, regimesCovered, splitByTime, trialCorrection, CORRECTION_RULE, type Pair} from '../services/accuracy.ts';

const FT = 1 / 0.3048, H = 3600000;
const hdr = 'time,station,latitude[unit="degrees_north"],longitude[unit="degrees_east"],waveHs[unit="meter"],waveTp[unit="second"],waveDp[unit="degreeT"],waveFlagPrimary';

test('CDIP series: on-the-hour QC-good rows only, comma in the station name, metres to feet, nothing filled', () => {
  const csv = [hdr,
    '2026-11-02T04:00:00Z,SAN FRANCISCO BAR, CA BUOY - 142p1,37.788,-122.632,2.0,14.3,270.5,1',
    '2026-11-02T04:30:00Z,SAN FRANCISCO BAR, CA BUOY - 142p1,37.788,-122.632,9.0,14.3,270.5,1', // half-hour sample: not paired
    '2026-11-02T05:00:00Z,SAN FRANCISCO BAR, CA BUOY - 142p1,37.788,-122.632,2.2,14.3,270.5,4', // QC bad
    '2026-11-02T06:00:00Z,SAN FRANCISCO BAR, CA BUOY - 142p1,37.788,-122.632,,14.3,270.5,1', // blank Hs
    '2026-11-02T07:00:00Z,BP142,37.781,-122.609,1.5,,,1'].join('\n');
  const s = parseCdipSeries(csv), t4 = Date.parse('2026-11-02T04:00:00Z');
  assert.deepEqual([...s.keys()], [t4, t4 + 3 * H]);
  assert.ok(Math.abs(s.get(t4)!.hs - 2 * FT) < 1e-9);
  assert.equal(s.get(t4)!.tp, 14.3); assert.equal(s.get(t4)!.dp, 270.5);
  assert.equal(s.get(t4 + 3 * H)!.tp, undefined, 'a blank period stays absent');
  assert.equal(parseCdipSeries('time,station,waveHs\n2026-11-02T04:00:00Z,x,1').size, 0, 'an unexpected header is refused');
});

test('NDBC series: minute-00 readings only, MM skipped', () => {
  const txt = ['#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS PTDY  TIDE', '#yr  mo dy hr mn degT m/s  m/s     m   sec   sec degT   hPa  degC  degC  degC  nmi  hPa    ft',
    '2026 10 25 03 00  MM   MM   MM   2.0    10   6.9 315     MM  18.4  20.2    MM   MM   MM    MM',
    '2026 10 25 02 30  MM   MM   MM   2.5    10   6.9 315     MM  18.4  20.2    MM   MM   MM    MM',
    '2026 10 25 02 00  MM   MM   MM    MM    10   6.9 315     MM  18.4  20.2    MM   MM   MM    MM'].join('\n');
  const s = parseNdbcSeries(txt);
  assert.equal(s.size, 1);
  const v = s.get(Date.UTC(2026, 9, 25, 3))!; assert.ok(Math.abs(v.hs - 2 * FT) < 1e-9); assert.equal(v.tp, 10); assert.equal(v.dp, 315);
});

test('pairing is same-hour only and scores use model − observed', () => {
  const obs = new Map([[0, {hs: 4}], [H, {hs: 6}], [2 * H, {hs: 5}]]), model = new Map([[0, 5], [H, 4], [3 * H, 9]]);
  const p = pairSeries(obs, model);
  assert.deepEqual(p.map((x) => x.t), [0, H]);
  const s = score(p)!;
  assert.equal(s.n, 2); assert.equal(s.biasFt, (1 - 2) / 2); assert.equal(s.maeFt, 1.5); assert.equal(s.meanObsFt, 5);
  assert.equal(score([]), null);
});

test('regimes come from the observed period and direction', () => {
  assert.equal(regimeOf(15, 280), 'W long'); assert.equal(regimeOf(8, 300), 'NW short'); assert.equal(regimeOf(12, 200), 'S mid'); assert.equal(regimeOf(undefined, undefined), '? ?');
  const r = regimesCovered([...Array(20)].map(() => ({tp: 15, dp: 280})).concat([{tp: 8, dp: 300}]), 12);
  assert.deepEqual(r, [{regime: 'W long', n: 20}]);
});

test('held-out split is by time, never shuffled', () => {
  const p = [5, 1, 3, 2, 4, 0].map((t) => ({t}));
  const s = splitByTime(p, 2 / 3);
  assert.deepEqual(s.fit.map((x) => x.t), [0, 1, 2, 3]); assert.deepEqual(s.test.map((x) => x.t), [4, 5]); assert.equal(s.cutAt, 4);
});

const series = (n: number, model: (i: number) => number, obs: (i: number) => number): Pair[] =>
  [...Array(n)].map((_, i) => ({t: i * H, obs: obs(i), model: model(i), tp: i % 2 ? 15 : 11, dp: 270}));

test('a correction is accepted only when the held-out window improves by the rule', () => {
  // v1 reads 30% low everywhere: a factor near 1/0.7 must be found on the fit window and must help on the held-out window
  const low = trialCorrection(series(450, (i) => 0.7 * (4 + (i % 7)), (i) => 4 + (i % 7)));
  assert.equal(low.accepted, true); assert.ok(Math.abs(low.ratio! - 1 / 0.7) < 1e-9); assert.ok(low.after!.maeFt < 0.01);
  // too few hours: no factor at all
  const few = trialCorrection(series(120, (i) => 0.7 * (4 + (i % 7)), (i) => 4 + (i % 7)));
  assert.equal(few.accepted, false); assert.equal(few.ratio, null); assert.match(few.reason, /too few hours/);
  // already right: no factor needed
  const ok = trialCorrection(series(450, (i) => 4 + (i % 7), (i) => 4.1 + (i % 7)));
  assert.equal(ok.accepted, false); assert.match(ok.reason, /no correction needed/);
  // the bias flips between the fit and held-out windows: the fitted factor makes the held-out window worse, so it is refused
  const flip = trialCorrection(series(450, (i) => (i < 300 ? 0.7 : 1.3) * (4 + (i % 7)), (i) => 4 + (i % 7)));
  assert.equal(flip.accepted, false); assert.ok(flip.after!.maeFt > flip.before!.maeFt);
  // one swell regime only in the fit window: refused
  const one = trialCorrection(series(450, (i) => 0.7 * (4 + (i % 7)), (i) => 4 + (i % 7)).map((p) => ({...p, tp: 15})));
  assert.equal(one.accepted, false); assert.match(one.reason, /swell regimes/);
  assert.equal(CORRECTION_RULE.minGainFt, 0.3);
});

test('buoy registry: verified fields present, nearest-buoy preference and relations', () => {
  for (const x of OBSERVING_BUOYS) { assert.ok(x.depthM > 0 && Number.isFinite(x.lat) && Number.isFinite(x.lon), x.id); assert.ok(x.realtime || x.archiveEnd, `${x.id} has a feed`); }
  const sfBar = OBSERVING_BUOYS.find((x) => x.id === '142')!;
  assert.equal(sfBar.depthM, 16.46); assert.equal(sfBar.mopPoint!.id, 'BP142');
  // Ocean Beach: SF Bar (nearshore, ~11 km) is preferred over nothing closer
  const ob = nearestBuoy(37.7594, -122.5107)!; assert.equal(ob.buoy.id, '142'); assert.equal(ob.relation, 'nearby');
  assert.equal(relationOf(3, {depthM: 17}), 'co-located'); assert.equal(relationOf(3, {depthM: 133}), 'regional'); assert.equal(relationOf(30, {depthM: 17}), 'regional');
  assert.equal(nearestBuoy(0, 0), null, 'nothing within reach: null, never a far buoy');
  assert.ok(sameWaveClimate(1.03)); assert.ok(!sameWaveClimate(1.37)); assert.ok(!sameWaveClimate(null));
  assert.match(buoyFeedURL(sfBar, 'archive', '2025-11-01T00:00:00Z', '2026-05-01T00:00:00Z')!, /archive\/142p1\/142p1_historic\.nc/);
  assert.match(buoyFeedURL(sfBar, 'recent', '2026-10-07T00:00:00Z', '2026-11-06T00:00:00Z')!, /realtime\/142p1_rt\.nc/);
  assert.equal(buoyFeedURL(OBSERVING_BUOYS.find((x) => x.id === '285')!, 'archive', 'a', 'b'), null, 'no historic file, no archive URL');
});

test('size bins: a factor is kept only where its held-out hours improve and the later window does not get worse', async () => {
  const {checkBins, sizeBinOf} = await import('../services/accuracy.ts');
  assert.equal(sizeBinOf(3.9), 0); assert.equal(sizeBinOf(4), 1); assert.equal(sizeBinOf(12), 3); assert.equal(sizeBinOf(40), 3);
  // v1 reads 30% low under 8 ft but right at 8-12 ft; nothing above 12 ft
  const mk = (n: number, off: number, low: boolean) => [...Array(n)].map((_, i) => ({t: i * H, off, obs: off, model: low ? off * 0.7 : off, tp: 12, dp: 270}));
  const held = [...mk(40, 2, true), ...mk(40, 6, true), ...mk(40, 10, false), ...mk(5, 14, true)];
  const later = [...mk(40, 6, false)]; // the later window says the 4-8 ft factor overshoots
  const b = checkBins(held, later, 1 / 0.7);
  assert.deepEqual(b.map((x) => x.holds), [true, false, false, false]);
  assert.match(b[1].reason, /later window/); assert.match(b[2].reason, /not smaller/); assert.match(b[3].reason, /only 5/);
});
