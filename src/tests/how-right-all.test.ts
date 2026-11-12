import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseBuoy, scoringBuoys, scoringBuoy, windowOf, inArc, bearingDeg, type ScoringBuoy} from '../ocean/scoringBuoys.ts';
import {evidenceSpots, evidenceSpot} from '../ocean/spots.ts';
import {leanText} from '../services/howRight.ts';
import {HRA_RULE, sliceHourly, captureSpot, captureBuoy, parseSpec, parseNdbcWind, parseAsosWind, shownIndex, offshoreWindow, offshorePairs, errStat, spotResult, ratingWindow, observedRating, offshoreLine, ratingLine, collectingText, leanOf, ratingBasis, type ShownCapture, type OffshorePair, type RatingPair, type BuoyHour} from '../services/howRightAll.ts';
import {createHowRightAll, spotPicks, HRA_KEYS, HRA_BUDGET, marineBatchURL} from '../../services/how-right-all.mjs';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {callWeight} from '../../docs/forecast/data/open-meteo-budget.ts';

const N = evidenceSpots.length;   // every catalogued spot is captured: the tests follow the catalogue
const HOUR = 3600000, DAY = 86400000, T0 = Date.UTC(2026, 10, 10, 0, 20);
const B = (id: string, lat: number, lon: number, sheltered = false): ScoringBuoy => ({id, name: 'Buoy ' + id, lat, lon, sheltered});

/* ---------- which buoy ---------- */
test('buoy eligibility: nearest open-ocean buoy within 100 km whose bearing from the spot is inside the swell window; never borrowed', () => {
  const spot = {lat: 21.6, lon: -158.1}, win = {fromDeg: 270, toDeg: 360};   // swell from the west through north
  const north = B('N', 21.9, -158.1), west = B('W', 21.6, -158.5), east = B('E', 21.6, -157.7), farNorth = B('FN', 22.7, -158.1);
  const r = chooseBuoy(spot, win, [east, north, west, farNorth]);
  assert.ok(r.ok); if (r.ok) { assert.equal(r.pick.buoy.id, 'N'); assert.ok(r.pick.km < 40 && r.pick.km > 30); assert.ok(Math.abs(r.pick.bearing - 0) <= 1 || r.pick.bearing >= 359); }
  const noBorrow = chooseBuoy(spot, win, [east]);    // the only buoy near sees the sea from the east: outside the window
  assert.equal(noBorrow.ok, false); if (!noBorrow.ok) assert.match(noBorrow.reason, /outside this spot's swell window/);
  const far = chooseBuoy(spot, win, [farNorth]); assert.equal(far.ok, false); if (!far.ok) assert.match(far.reason, /no wave buoy within 100 km/);
  const sh = chooseBuoy(spot, win, [B('S', 21.6, -158.4, true)]); assert.equal(sh.ok, false); if (!sh.ok) assert.match(sh.reason, /every buoy within 100 km of this spot .* is inside a bay, sound or harbour/);
  const open = chooseBuoy(spot, win, [B('S', 21.62, -158.12, true), west]); assert.ok(open.ok); if (open.ok) assert.equal(open.pick.buoy.id, 'W', 'a sheltered buoy is skipped, the open one is used');
  const nowin = chooseBuoy(spot, null, [west]); assert.equal(nowin.ok, false); if (!nowin.ok) assert.match(nowin.reason, /no sourced swell window/);
});
test('arcs wrap through north and the bearing is a compass bearing', () => {
  assert.ok(inArc(350, 300, 40)); assert.ok(inArc(10, 300, 40)); assert.ok(!inArc(100, 300, 40)); assert.ok(inArc(180, 90, 270));
  assert.ok(Math.abs(bearingDeg(0, 0, 1, 0) - 0) < 0.01); assert.ok(Math.abs(bearingDeg(0, 0, 0, 1) - 90) < 0.01); assert.ok(Math.abs(bearingDeg(0, 0, -1, 0) - 180) < 0.01);
});
test('the real catalogue: every pick is open-ocean, within 100 km and inside the spot\'s own window; the buoy universe has no CDIP twins; the rest say why', () => {
  const picks = spotPicks(); assert.equal(picks.length, N);
  let ok = 0; const reasons = new Set<string>();
  for (const p of picks) {
    if (p.choice.ok) { ok++; const b = scoringBuoy(p.choice.pick.buoy.id)!; assert.ok(!b.sheltered); assert.ok(p.choice.pick.km <= 100); const w = windowOf(p.id)!; assert.ok(inArc(p.choice.pick.bearing, w.fromDeg, w.toDeg) || Math.abs(p.choice.pick.bearing - bearingDeg(p.lat, p.lon, b.lat, b.lon)) < 1); }
    else { assert.ok(p.choice.reason.length > 20); reasons.add(p.choice.reason.replace(/[\d.]+/g, '#').slice(0, 30)); }
  }
  assert.ok(ok > 120 && ok < N, `${ok} spots have a buoy`);
  for (const id of ['029p1', '098p1', '106p1']) assert.equal(scoringBuoy(id), null);
  assert.ok(scoringBuoys.length >= 50 && new Set(scoringBuoys.map((b) => b.id)).size === scoringBuoys.length);
  for (const id of ['51207', '51210', '44022', '44064']) assert.equal(scoringBuoy(id)!.sheltered, true);
  if (process.env.SHOW) console.log(`${ok} of ${N} spots have an eligible buoy`);
});

/* ---------- what the buoy says ---------- */
const SPEC = `#YY  MM DD hh mm WVHT  SwH  SwP  WWH  WWP SwD WWD  STEEPNESS  APD MWD
#yr  mo dy hr mn    m    m  sec    m  sec  -  degT     -      sec degT
2026 11 10 06 26  2.1  1.6 11.8  1.4  9.9 NNW NNW      SWELL  8.1 337
2026 11 10 05 56  2.0  1.5 11.1  1.5  8.3 NNW NNE      SWELL  7.9 334
2026 11 10 05 26  MM   MM  MM   MM   MM  MM  MM         MM   MM  MM
2026 11 10 03 56  1.8  1.2 10.0  1.1  7.0   W   W    AVERAGE  7.0 300
`;
test('.spec parsing: metres and seconds, compass points to degrees, MM is null, the reading nearest the hour within 30 minutes', () => {
  const m = parseSpec(SPEC), at = (h: number) => m.get(Date.UTC(2026, 10, 10, h));
  assert.deepEqual(at(6), {hsM: 2.0, swH: 1.5, swP: 11.1, wwH: 1.5, wwP: 8.3, swD: 337.5, wwD: 22.5}, '05:56 is 4 min from 06:00, 06:26 is 26 min: the nearer wins');
  assert.deepEqual(at(5), {hsM: null, swH: null, swP: null, wwH: null, wwP: null, swD: null, wwD: null}, 'MM stays null, never filled from another hour');
  assert.equal(at(4)!.swD, 270); assert.equal(at(7), undefined);
});
test('shore wind parsing: NDBC .txt (m/s to mph, on-hour reading) and IEM ASOS (knots to mph; calm / missing dropped)', () => {
  const txt = `#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS PTDY  TIDE
#yr  mo dy hr mn degT m/s  m/s     m   sec   sec degT    hPa  degC  degC  degC  nmi  hPa    ft
2026 11 10 06 00 270  5.0  7.0    MM    MM    MM  MM 1016.0  14.0  15.0  MM   MM   MM    MM
2026 11 10 05 40 260  4.0  6.0    MM    MM    MM  MM 1016.0  14.0  15.0  MM   MM   MM    MM
2026 11 10 05 00 MM  4.0  6.0    MM    MM    MM  MM 1016.0  14.0  15.0  MM   MM   MM    MM`;
  const w = parseNdbcWind(txt); assert.equal(w.size, 1); const x = w.get(Date.UTC(2026, 10, 10, 6))!; assert.ok(Math.abs(x.mph - 11.18) < 0.05); assert.equal(x.dir, 270); assert.ok(Math.abs(x.gust! - 15.66) < 0.05);
  const csv = `station,valid,drct,sknt,gust\nHAF,2026-11-10 06:00,300,10.00,M\nHAF,2026-11-10 07:00,M,3.00,M\nHAF,2026-11-10 08:15,200,8.00,M\nHAF,2026-11-10 09:00,200,M,M`;
  const a = parseAsosWind(csv); assert.equal(a.size, 1); assert.ok(Math.abs(a.get(Date.UTC(2026, 10, 10, 6))!.mph - 11.51) < 0.02); assert.equal(a.get(Date.UTC(2026, 10, 10, 6))!.gust, null);
});

/* ---------- which shown copy ---------- */
const mk = (retrievedMs: number, hours: number[], extra: object = {}): ShownCapture => ({schema: 2, date: '', capturedAt: new Date(retrievedMs).toISOString(), spots: {}, buoys: {B: {lat: 0, lon: 0, retrievedAt: new Date(retrievedMs).toISOString(), marineUnits: {}, marine: {time: hours.map((h) => h / 1000), wave_height: hours.map((_, i) => i)} as never, ...extra}}});
test('what we showed for an hour: the latest copy retrieved at least 12 h before it; a younger copy is never used', () => {
  const h = (n: number) => T0 + n * HOUR, a = mk(T0 - 30 * HOUR, [h(0), h(1), h(2)]), b = mk(T0 - 6 * HOUR, [h(0), h(1), h(5), h(7)]), c = mk(T0 - 15 * HOUR, [h(0), h(1)]);
  const idx = shownIndex([a, b, c], (x) => ({time: x.buoys.B.marine.time, retrievedAt: x.buoys.B.retrievedAt}));
  assert.equal(idx.get(h(0))!.cap, 2, 'c (15 h ahead) beats a (30 h ahead); b (6 h) is too young'); assert.equal(idx.get(h(0))!.leadH, 15);
  assert.equal(idx.get(h(2))!.cap, 0); assert.equal(idx.has(h(5)), false, 'b, retrieved 11 h before h(5), is too young'); assert.equal(idx.get(h(7))!.cap, 1, 'b is 13 h ahead of h(7): old enough');
});

/* ---------- scoring ---------- */
test('error statistics: typical = median |forecast - measured|, bias sign = forecast - measured (negative = ran low), direction is circular', () => {
  const e = errStat([{fc: 1, ob: 1.5}, {fc: 2, ob: 2.4}, {fc: 3, ob: 3.2}])!; assert.equal(e.typical, 0.4); assert.equal(e.bias, -0.37); assert.equal(e.n, 3);
  assert.equal(errStat([{fc: 355, ob: 5}, {fc: 10, ob: 350}], true)!.typical, 15); assert.equal(errStat([], false), null);
});
const NOW = Date.UTC(2026, 10, 20, 12);
/** n days of hourly pairs ending at NOW: forecast hs = ob - 0.3 m (ran low by 0.3), swell 0.2 m low, period 2 s short, direction 10 degrees off. */
const pairsFor = (days: number, from = 0): OffshorePair[] => Array.from({length: days * 24}, (_, i) => { const t = NOW - (i + from) * HOUR; return {t, leadH: 20, fcHs: 1.2, obHs: 1.5, fcSw: 1.0, obSw: 1.2, fcSwP: 12, obSwP: 14, fcSwD: 290, obSwD: 300}; }).reverse();
test('offshore window: typical error, lean, the published-swell split, and the days of data it rests on', () => {
  const w = offshoreWindow(pairsFor(10), NOW, 7);
  assert.equal(w.daysWithData, 7); assert.equal(w.n, 168); assert.equal(w.hs!.typical, 0.3); assert.equal(w.hs!.bias, -0.3);
  assert.equal(w.swell!.height!.typical, 0.2); assert.equal(w.swell!.periodS!.typical, 2); assert.equal(w.swell!.directionDeg!.typical, 10);
  const thin = offshoreWindow(pairsFor(3).slice(0, 40), NOW, 7); assert.ok(thin.daysWithData <= 2, 'a day needs 12 paired hours');
  const flat = offshoreWindow(pairsFor(2).map((p) => ({...p, fcSw: 0.2, obSw: 0.3})), NOW, 7); assert.equal(flat.swell!.directionDeg, null, 'no direction score at flat: below 0.5 m it is noise');
});
const PICK = {buoy: B('51201', 21.67, -158.12), km: 18.2, bearing: 355, window: {fromDeg: 270, toDeg: 30}};
const noRating = {pairs: [] as RatingPair[], windHours: 0};
test('"collecting": fewer than 3 days of paired hours gives no number at all, with the day count; 7 days need 3, 30 days need 14', () => {
  const none = spotResult('s', PICK, true, [], noRating, null, NOW); assert.equal(none.status, 'collecting'); if (none.status === 'collecting') assert.equal(none.haveDays, 0);
  const two = spotResult('s', PICK, true, pairsFor(2), noRating, null, NOW); assert.equal(two.status, 'collecting'); if (two.status === 'collecting') assert.equal(two.haveDays, 2);
  for (const s of [none, two]) { const l = offshoreLine(s), r = ratingLine(s)!; assert.equal(l.hasNumber, false); assert.equal(r.hasNumber, false); assert.doesNotMatch(l.text + r.text, /\d\.\d (m|ft)|typical error \d|of \d days within/); assert.match(l.text, /collecting: \d days? checked so far/); }
  const five = spotResult('s', PICK, true, pairsFor(5), noRating, null, NOW); assert.equal(five.status, 'ok'); if (five.status === 'ok') { assert.ok(five.d7); assert.equal(five.d30, null, '30 days need 14'); assert.equal(five.haveDays, 5); }
  const twenty = spotResult('s', PICK, true, pairsFor(20), noRating, null, NOW); if (twenty.status === 'ok') { assert.ok(twenty.d7 && twenty.d30); assert.equal(twenty.d30!.daysWithData, 20); } else assert.fail();
});
test('the labels say exactly what was compared: buoy id, name, km, "not surf at the spot", typical difference, lean; the metric lean is tested after rounding', () => {
  const s = spotResult('s', PICK, true, pairsFor(10), {pairs: [], windHours: 0}, null, NOW), line = offshoreLine(s, 'm');
  assert.equal(line.text, "Offshore wave height at the buoy (not surf at the spot): Hs forecast at buoy 51201's position (Buoy 51201) vs the buoy, 18 km from this spot: typical difference 0.3 m, ran 0.3 m low (last 7 days).");
  assert.equal(offshoreLine(s, 'ft').text, "Offshore wave height at the buoy (not surf at the spot): Hs forecast at buoy 51201's position (Buoy 51201) vs the buoy, 18 km from this spot: typical difference 1.0 ft, ran 1.0 ft low (last 7 days).");
  assert.equal(leanOf(0.02, 'm'), 'no lean high or low'); assert.equal(leanOf(0.04, 'm'), 'no lean high or low', '0.04 m rounds to 0.0 m: not "ran 0.0 m"'); assert.equal(leanOf(0.06, 'm'), 'ran 0.1 m high'); assert.equal(leanOf(-0.4, 'm'), 'ran 0.4 m low'); assert.equal(leanText(0.1, 'm'), 'no lean high or low', 'the MOP line too: 0.1 ft is 0.03 m');
  assert.equal(collectingText(1), 'collecting: 1 day checked so far (a day counts once 12 of its hours are checked against the buoy; we need 3 before showing a number)');
  const nb = offshoreLine({status: 'no-buoy', spotId: 'x', reason: 'no wave buoy within 100 km', nearest: null}); assert.equal(nb.hasNumber, false); assert.equal(nb.text, 'No offshore check: no wave buoy within 100 km.');
  assert.equal(ratingLine({status: 'no-buoy', spotId: 'x', reason: 'r', nearest: null}), null);
  const both = spotResult('s', PICK, true, pairsFor(20), noRating, null, NOW); assert.match(offshoreLine(both, 'm').text, /\(last 7 days\); last 30 days: typical difference 0\.3 m, ran 0\.3 m low\.$/, 'when the 30-day figure exists it is shown too');
});
/** `days` local days of daylight pairs (8 hours), shown vs measured scores. */
const ratingPairsFor = (days: number, shown: (d: number) => number, observed: (d: number) => number): RatingPair[] => Array.from({length: days * 8}, (_, i) => { const d = Math.floor(i / 8), t = NOW - (days - d) * DAY + (i % 8) * HOUR; return {t, day: new Date(t - 8 * HOUR).toISOString().slice(0, 10), shown: shown(d), observed: observed(d)}; });
const p0 = {pairs: [] as RatingPair[], windHours: 0};
test('rating window: days within one band, better / worse than the buoy-readings rating, needs enough daylight hours per day', () => {
  // band edges: 25 WEAK, 40 SURFABLE, 55 NOT BAD, 65 SOLID
  const p = ratingPairsFor(7, (d) => (d === 0 ? 70 : 45), (d) => (d === 0 ? 30 : d === 1 ? 45 : 50));   // day0: SOLID vs WEAK (3 bands better), day1: exact, days 2-6: SURFABLE vs SURFABLE/NOT BAD
  const w = ratingWindow(p, NOW, 7); assert.equal(w.daysScored, 7); assert.equal(w.withinOneBand, 6); assert.equal(w.high, 1); assert.equal(w.low, 0); assert.ok(w.exact >= 1);
  assert.equal(ratingWindow(p.slice(0, 3), NOW, 7).daysScored, 0, 'a day with 3 daylight hours is not scored');
  const s = spotResult('s', PICK, true, pairsFor(10), {pairs: p, windHours: 0}, null, NOW); assert.equal(s.status, 'ok');
  assert.equal(ratingLine(s)!.text, "Rating vs the rating from buoy 51201's readings (+ our forecast wind), offshore, not at the break: 6 of 7 scored days within one band (last 7 days, daylight hours); 1 day we showed a better band.");
  if (s.status === 'ok') { assert.equal(s.rating.wind, 'forecast'); assert.match(ratingBasis(s), /our forecast wind \(no shore station within 4 km\)/); }
  const st = spotResult('s', PICK, true, pairsFor(10), {pairs: p, windHours: 20}, {id: 'HAF', name: 'Half Moon Bay', km: 3.7}, NOW); if (st.status === 'ok') { assert.equal(st.rating.wind, 'mixed', '20 of 56 hours had the station: "station" is only for every hour'); assert.match(ratingBasis(st), /Half Moon Bay \(HAF, 3\.7 km\) for 20 of 56 hours and our forecast wind for the rest/); assert.match(ratingLine(st)!.text, /\(\+ HAF wind for 20 of 56 hours, our forecast wind for the rest\)/);
    const all = spotResult('s', PICK, true, pairsFor(10), {pairs: p, windHours: p.length}, {id: 'HAF', name: 'Half Moon Bay', km: 3.7}, NOW); if (all.status === 'ok') { assert.equal(all.rating.wind, 'station'); assert.match(ratingLine(all)!.text, /\(\+ HAF wind\)/); } }
  const nosplit = spotResult('s', PICK, false, pairsFor(10), noRating, null, NOW); assert.match(ratingLine(nosplit)!.text, /not compared, this buoy publishes no swell split/);
  const failed = spotResult('s', PICK, true, pairsFor(10), p0, {id: 'HAF', name: 'Half Moon Bay', km: 3.7}, NOW, {stationFailed: true}); if (failed.status === 'ok') { assert.equal(failed.rating.wind, 'forecast'); assert.match(ratingBasis(failed), /the station's data \(HAF\) could not be fetched/); assert.doesNotMatch(ratingBasis(failed), /no shore station/); }
});

/* ---------- capture: what we showed ---------- */
const hourly = (n: number, from: number, units: Record<string, string>, f: (k: string, i: number) => number) => ({hourly_units: units, hourly: {time: Array.from({length: n}, (_, i) => from / 1000 + i * 3600), ...Object.fromEntries(Object.keys(units).filter((k) => k !== 'time').map((k) => [k, Array.from({length: n}, (_, i) => f(k, i))]))}});
const MU = {wave_height: 'm', swell_wave_height: 'm', swell_wave_direction: '°', swell_wave_period: 's', secondary_swell_wave_height: 'm', secondary_swell_wave_direction: '°', secondary_swell_wave_period: 's', sea_surface_temperature: '°C'};
const WU = {wind_speed_10m: 'mp/h', wind_direction_10m: '°', wind_gusts_10m: 'mp/h'};
const marineAt = (from: number, n = 72) => hourly(n, from, MU, (k, i) => ({wave_height: 1.5 + 0.5 * Math.sin((from / 1000 + i * 3600) / 21600), swell_wave_height: 1.2, swell_wave_direction: 290, swell_wave_period: 12, secondary_swell_wave_height: 0.3, secondary_swell_wave_direction: 200, secondary_swell_wave_period: 8, sea_surface_temperature: 15}[k] as number));
const windAt = (from: number, n = 72) => hourly(n, from, WU, (k, i) => ({wind_speed_10m: 4 + (i % 10), wind_direction_10m: (i * 20) % 360, wind_gusts_10m: 12}[k] as number));
test('capture of a spot: the next 48 whole hours from the capture, only the fields we keep, the rating of every hour from the same engine as the page', () => {
  const from = Math.ceil(T0 / HOUR) * HOUR, e = captureSpot('spot-1', marineAt(from - 6 * HOUR), windAt(from - 6 * HOUR), 'm', 'w', 'cache', T0)!;
  assert.equal(e.marine.time.length, 48); assert.equal(e.marine.time[0], from / 1000); assert.equal(e.wind.time.length, 48); assert.equal(e.rating.length, 48); assert.ok(e.rating.every((r) => r !== null && r >= 0 && r <= 100));
  assert.deepEqual(Object.keys(e.marine).sort(), ['sea_surface_temperature', 'secondary_swell_wave_direction', 'secondary_swell_wave_height', 'secondary_swell_wave_period', 'swell_wave_direction', 'swell_wave_height', 'swell_wave_period', 'time', 'wave_height']);
  // the same record the page builds, rated by the same engine -> the stored rating (independent re-computation)
  const recs = normalizeOpenMeteo(evidenceSpot('spot-1'), {hourly: e.marine, hourly_units: {time: 'unixtime', ...e.marineUnits}} as never, {hourly: e.wind, hourly_units: {time: 'unixtime', ...e.windUnits}} as never, 'm');
  assert.equal(recs.length, 48); assert.ok(recs.every((r) => r.offshore.value !== null && r.windSpeed.value !== null));
  assert.equal(captureSpot('spot-1', marineAt(from + 100 * HOUR), windAt(from), 'm', 'w', 'cache', T0), null, 'no hours in range: no entry');
  const b = captureBuoy(21.6, -158.1, marineAt(from), 'm', T0)!; assert.equal(b.marine.time.length, 48); assert.equal(sliceHourly(null, ['wave_height'], from), null);
});
test('the observed-fed rating: the buoy\'s measured height and swell feed the same engine; wind from the station replaces the forecast wind; no split = no rating', () => {
  const from = Math.ceil(T0 / HOUR) * HOUR, e = captureSpot('spot-1', marineAt(from), windAt(from), 'm', 'w', 'fetched', T0)!, ev = evidenceSpot('spot-1');
  const recs = normalizeOpenMeteo(ev, {hourly: e.marine, hourly_units: {time: 'unixtime', ...e.marineUnits}} as never, {hourly: e.wind, hourly_units: {time: 'unixtime', ...e.windUnits}} as never, 'm'), base = recs[10];
  const big: BuoyHour = {hsM: 2.5, swH: 2.2, swP: 15, swD: 290, wwH: 0.5, wwP: 5, wwD: 200}, small: BuoyHour = {hsM: 0.3, swH: 0.2, swP: 6, swD: 290, wwH: 0.2, wwP: 4, wwD: 200};
  const calm = {mph: 2, dir: 90, gust: 3}, gale = {mph: 25, dir: 270, gust: 35};
  const a = observedRating('spot-1', base, big, calm, T0)!, b = observedRating('spot-1', base, small, calm, T0)!, c = observedRating('spot-1', base, big, gale, T0)!;
  assert.ok(Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c)); assert.notEqual(a, b, 'the measured size changes the rating'); assert.ok(a >= c, 'a 25 mph wind does not rate better than a calm one');
  assert.equal(observedRating('spot-1', base, {...big, swH: null}, calm, T0), null); assert.equal(observedRating('spot-1', base, {...big, hsM: null}, null, T0), null);
  assert.ok(Number.isFinite(observedRating('spot-1', base, big, null, T0)!), 'no station: the forecast wind of the shown record is kept');
});

/* ---------- the daily job: capture (resumable, budgeted), then score ---------- */
function fakeR2(store = new Map<string, string>(), o: {failGet?: (k: string) => boolean} = {}) {
  const ops = {n: 0, puts: 0}; return {store, ops, bucket: {get: async (k: string) => { ops.n++; if (o.failGet?.(k)) throw new Error('R2 down'); const v = store.get(k); return v === undefined ? null : {json: async () => JSON.parse(v)}; }, put: async (k: string, v: string) => { ops.n++; ops.puts++; store.set(k, v); }}};
}
/** A fake Open-Meteo + NDBC: marine and wind at any time are a fixed function of the absolute hour, so a forecast made on any day agrees with every other; the buoy reads the model + 0.3 m (ran low by 0.3). */
const hsAt = (tMs: number) => 1.5 + 0.5 * Math.sin(tMs / 21600000);
function world(clock: {t: number}, log: string[] = [], opts: {failMarine?: boolean; poison?: {lat: number; lon: number}; failSpec?: () => boolean} = {}) {
  const payload = (kind: 'marine' | 'wind', n: number) => { const from = Math.floor(clock.t / HOUR) * HOUR, time = Array.from({length: 72}, (_, i) => from / 1000 + i * 3600), u = kind === 'marine' ? MU : WU; return {hourly_units: u, hourly: {time, ...Object.fromEntries(Object.keys(u).map((k) => [k, time.map((t) => (kind === 'marine' ? ({wave_height: hsAt(t * 1000), swell_wave_height: 1.2, swell_wave_direction: 290, swell_wave_period: 12, secondary_swell_wave_height: 0.3, secondary_swell_wave_direction: 200, secondary_swell_wave_period: 8, sea_surface_temperature: 15} as Record<string, number>)[k] : ({wind_speed_10m: 4, wind_direction_10m: 90, wind_gusts_10m: 8} as Record<string, number>)[k]))]))}, n}; };
  const fetcher = (async (url: string) => {
    log.push(url); const u = new URL(url);
    if (/open-meteo/.test(u.host)) { if (opts.failMarine && /marine/.test(u.host)) return new Response('', {status: 429}); const lats = u.searchParams.get('latitude')!.split(','), lons = u.searchParams.get('longitude')!.split(','), n = lats.length, kind = /marine/.test(u.host) ? 'marine' : 'wind', arr = lats.map((la, i) => ({...payload(kind, n), latitude: +la + 0.05, longitude: +lons[i]})); if (opts.poison && lats.some((la, i) => Math.abs(+la - opts.poison!.lat) < 1e-9 && Math.abs(+lons[i] - opts.poison!.lon) < 1e-9)) return new Response('', {status: 500}); return Response.json(n === 1 ? arr[0] : arr); }
    const m = /realtime2\/(\w+)\.spec$/.exec(url); if (m && opts.failSpec?.()) return new Response('', {status: 503}); if (m) { const rows: string[] = []; for (let t = Math.floor(clock.t / HOUR) * HOUR; t > clock.t - 45 * DAY; t -= HOUR) { const d = new Date(t); rows.push(`${d.getUTCFullYear()} ${String(d.getUTCMonth() + 1).padStart(2, '0')} ${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')} 00  ${(hsAt(t) + 0.3).toFixed(2)}  1.40 14.0  0.5  5.0 WNW   S    SWELL  7.0 300`); } return new Response('#YY  MM DD hh mm WVHT  SwH  SwP  WWH  WWP SwD WWD  STEEPNESS  APD MWD\n#yr  mo dy hr mn    m    m  sec    m  sec  -  degT     -      sec degT\n' + rows.join('\n') + '\n'); }
    return new Response('', {status: 404});
  }) as unknown as typeof fetch;
  return {fetcher};
}
const picks = spotPicks(), HOT = new Set(picks.slice(0, 150).map((p) => p.id));
const cachedCopy = (kind: 'marine' | 'wind', t: number) => { const w = world({t}); void w; const from = Math.floor(t / HOUR) * HOUR, time = Array.from({length: 72}, (_, i) => from / 1000 + i * 3600), u = kind === 'marine' ? MU : WU; return {payload: {hourly_units: u, hourly: {time, ...Object.fromEntries(Object.keys(u).map((k) => [k, time.map((tt) => (kind === 'marine' ? ({wave_height: hsAt(tt * 1000), swell_wave_height: 1.2, swell_wave_direction: 290, swell_wave_period: 12, secondary_swell_wave_height: 0.3, secondary_swell_wave_direction: 200, secondary_swell_wave_period: 8, sea_surface_temperature: 15} as Record<string, number>)[k] : ({wind_speed_10m: 4, wind_direction_10m: 90, wind_gusts_10m: 8} as Record<string, number>)[k]))]))}}, retrievedAt: new Date(t - 30 * 60000).toISOString()}; };
const makeJob = (clock: {t: number}, r2: ReturnType<typeof fakeR2>, log: string[], extra: object = {}, wo: Parameters<typeof world>[2] = {}) => createHowRightAll({fetcher: world(clock, log, wo).fetcher, now: () => clock.t, sleep: async () => {}, readLatest: async (_e: unknown, key: string) => (HOT.has(key.replace(/^(marine|weather)-/, '')) ? cachedCopy(key.startsWith('marine') ? 'marine' : 'wind', clock.t) : null), hotIds: async () => HOT, ...extra});

test('capture: the hot spots come from the cached copy (no fetch), the cold ones from batched Open-Meteo requests; one tick stays under the budget; the day object holds all 492 spots and every buoy', async () => {
  const clock = {t: T0}, r2 = fakeR2(), log: string[] = [], job = makeJob(clock, r2, log);
  const rep = await job.capture({BUCKET: r2.bucket}) as any;
  assert.equal(rep.ok, true); assert.equal(rep.complete, true, JSON.stringify(rep)); assert.equal(rep.spots, N); assert.equal(rep.cached, 150); assert.equal(rep.fetched, N - 150);
  assert.ok(rep.used <= HRA_BUDGET, `${rep.used} subrequests`);
  const om = log.filter((u) => /open-meteo/.test(u)); const cold = N - 150, buoys = new Set(picks.filter((p) => p.choice.ok).map((p) => (p.choice as any).pick.buoy.id)).size;
  assert.equal(om.length, 2 * Math.ceil(cold / 10) + Math.ceil(buoys / 10), 'marine + wind per 10 cold spots, marine per 10 buoys'); assert.ok(om.every((u) => /forecast_days=3/.test(u)));
  const day = JSON.parse(r2.store.get(HRA_KEYS.shown('2026-11-10'))!); assert.equal(Object.keys(day.spots).length, N); assert.equal(Object.keys(day.buoys).length, buoys);
  const sources = Object.values(day.spots).map((s: any) => s.source); assert.equal(sources.filter((s) => s === 'cache').length, 150);
  for (const s of Object.values(day.spots) as any[]) { assert.equal(s.rating.length, 48); assert.ok(s.rating.every((x: number | null) => x !== null)); }
  const st = JSON.parse(r2.store.get(HRA_KEYS.status)!); assert.equal(st.captureComplete, true); assert.equal(st.captureSpots, N);
  if (process.env.SHOW) console.log(`capture: ${rep.used} subrequests (${om.length} Open-Meteo requests, ${log.length} fetches), object ${(r2.store.get(HRA_KEYS.shown('2026-11-10'))!.length / 1024 / 1024).toFixed(1)} MB`);
});
test('capture is resumable and idempotent: a tick that runs out of budget stops at a chunk, the next tick fills only what is missing, and a finished day changes nothing', async () => {
  const clock = {t: T0}, r2 = fakeR2(), log: string[] = [];
  const small = makeJob(clock, r2, log, {budget: 330}), r1 = await small.capture({BUCKET: r2.bucket}) as any;
  assert.equal(r1.complete, false); assert.ok(r1.spots > 0 && r1.spots < N); assert.ok(r1.used <= 330); assert.equal(r1.stopped, 'budget');
  const before = Object.keys(JSON.parse(r2.store.get(HRA_KEYS.shown('2026-11-10'))!).spots).length;
  let last = r1, n = 1; while (!last.complete && n < 8) { last = await small.capture({BUCKET: r2.bucket}); n++; }
  assert.equal(last.complete, true); assert.ok(n >= 2 && n <= 6, `${n} ticks`); assert.equal(Object.keys(JSON.parse(r2.store.get(HRA_KEYS.shown('2026-11-10'))!).spots).length, N); assert.ok(before < 492);
  const snapshot = r2.store.get(HRA_KEYS.shown('2026-11-10')); log.length = 0; const again = await small.capture({BUCKET: r2.bucket}) as any;
  assert.equal(again.complete, true); assert.equal(log.length, 0, 'nothing left to fetch'); assert.equal(r2.store.get(HRA_KEYS.shown('2026-11-10')), snapshot);
});
test('a spot whose fetch fails is simply missing from the day (retried by the next tick), never filled from somewhere else; an R2 read error aborts with no write', async () => {
  const clock = {t: T0}, r2 = fakeR2(), log: string[] = [], job = createHowRightAll({fetcher: world(clock, log, {failMarine: true}).fetcher, now: () => clock.t, sleep: async () => {}, readLatest: async () => null, hotIds: async () => new Set()});
  const rep = await job.capture({BUCKET: r2.bucket}) as any; assert.equal(rep.complete, false); assert.equal(rep.spots, 0); assert.ok(rep.failed > 0);
  const bad = fakeR2(new Map(), {failGet: () => true}), r = await makeJob(clock, bad, []).capture({BUCKET: bad.bucket}) as any; assert.equal(r.ok, false); assert.match(r.reason, /R2 read/); assert.equal(bad.ops.puts, 0);
});
test('over 5 daily captures the card goes from collecting to numbers: offshore forecast ran 0.3 m low everywhere; the rating compares, the wind says where it came from', async () => {
  const clock = {t: T0}, r2 = fakeR2(), log: string[] = [], job = makeJob(clock, r2, log); let card: any = null;
  const cards: any[] = [];
  for (let d = 0; d < 5; d++) {
    clock.t = T0 + d * DAY; let rep: any, n = 0;
    do { rep = await job.daily({BUCKET: r2.bucket}); n++; } while (rep.step !== 'idle' && n < 12);
    assert.equal(rep.step, 'idle', `day ${d}: capture, then score once, then idle`); cards.push(JSON.parse(r2.store.get(HRA_KEYS.card)!));
  }
  card = cards.at(-1);
  const all = Object.values(card.spots) as any[], ok = all.filter((s) => s.status === 'ok'), col = all.filter((s) => s.status === 'collecting'), nb = all.filter((s) => s.status === 'no-buoy');
  assert.equal(all.length, N); assert.ok(ok.length > 100, `${ok.length} scored`); assert.equal(ok.length + col.length + nb.length, N);
  assert.ok(nb.every((s) => s.reason.length > 10 && s.nearest !== undefined));
  const s = ok[0]; assert.ok(s.d7.hs.n > 24); assert.ok(Math.abs(s.d7.hs.bias + 0.3) < 0.02, `bias ${s.d7.hs.bias}`); assert.ok(Math.abs(s.d7.hs.typical - 0.3) < 0.02);
  assert.ok(Math.abs(s.d7.swell.height.bias + 0.2) < 0.02, 'buoy SwH 1.4 vs forecast 1.2'); assert.ok(Math.abs(s.d7.swell.periodS.typical - 2) < 0.01); assert.ok(s.d7.swell.directionDeg.typical > 0);
  assert.equal(s.d30, null, 'five days is not 14: no 30-day number yet'); assert.equal(s.rating.wind, 'forecast'); assert.ok(s.rating.d7 && s.rating.d7.daysScored >= 3 && s.rating.d7.daysScored <= 7, JSON.stringify(s.rating)); assert.equal(s.rating.d30, null);
  assert.equal(card.captureDays, 5);
  // the first day: nothing to compare yet (a capture only has hours not yet observed), so every buoy spot is collecting with its day count
  const first = cards[0]; assert.equal(Object.values(first.spots).filter((x: any) => x.status === 'ok').length, 0); assert.ok(Object.values(first.spots).some((x: any) => x.status === 'collecting' && x.haveDays <= 1));
  assert.ok(Object.values(first.spots).every((x: any) => x.status !== 'ok' || false));
  for (const c of cards) assert.ok(c.budget.used <= HRA_BUDGET);
  const bytes = r2.store.get(HRA_KEYS.card)!.length; assert.ok(bytes < 600000, `card ${bytes} bytes`);
  const unit = offshoreLine(s.status === 'ok' ? s : (null as never), 'm'); assert.match(unit.text, /^Offshore wave height at the buoy \(not surf at the spot\): Hs forecast at buoy \w+'s position \(.+\) vs the buoy, \d+ km from this spot: typical difference 0\.3 m, ran 0\.3 m low \(last 7 days\)\.$/);
  assert.ok(s.buoy.gridKm > 5 && s.buoy.gridKm < 6, `model cell ${s.buoy.gridKm} km from the buoy`);
  if (process.env.SHOW) console.log(`scored ${ok.length}, collecting ${col.length}, no buoy ${nb.length}; card ${(bytes / 1024).toFixed(0)} KB; score budget ${card.budget.used}`);
}, {timeout: 240000});

test('service: /api/how-right-all is pending until the daily job has scored; a page view never fetches upstream; the service tick runs capture then score', async () => {
  const {createForecastService} = await import('../../services/forecast-service.mjs'), clock = {t: T0}, log: string[] = [], r2 = fakeR2();
  const svc = createForecastService({fetcher: world(clock, log).fetcher, now: () => clock.t, sleep: async () => {}}) as any, env = {BUCKET: r2.bucket};
  const pending = await (await svc(new Request('https://x/api/how-right-all'), env)).json(); assert.equal(pending.pending, true); assert.equal(log.length, 0);
  let rep: any, n = 0; do { rep = await svc.howRightAll(env); n++; } while (rep.step !== 'idle' && n < 12);
  assert.equal(rep.step, 'idle'); assert.ok(r2.store.has(HRA_KEYS.card));
  const card = await (await svc(new Request('https://x/api/how-right-all'), env)).json(); assert.equal(card.schema, 2); assert.equal(Object.keys(card.spots).length, N);
  const noBucket = await (await svc(new Request('https://x/api/how-right-all'), {})).json(); assert.equal(noBucket.pending, true);
});
test('the worker: its own cron expression, hourly 00:20-06:20 UTC, in wrangler.jsonc; it never takes a refresh tick', async () => {
  const {HRA_CRON} = await import('../../worker/cloudflare.mjs'), {readFileSync} = await import('node:fs');
  assert.equal(HRA_CRON, '20 0-6 * * *'); assert.ok(readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8').includes(`"${HRA_CRON}"`));
});
test('Open-Meteo budget: the capture (cold spots + buoy points) plus the hot refresh stays under the 10,000 free calls a day at every hot-set size up to the cap', async () => {
  const {captureBudget} = await import('../../docs/forecast/data/how-right-all-budget.ts');
  for (const h of [0, 100, 150, 180, 500]) { const b = captureBudget(h); assert.ok(b.total < 9000, `hot ${h}: ${b.total}`); assert.equal(b.refreshCalls + b.captureCalls, b.total); }
  const b = captureBudget(150); assert.equal(b.cold, N - 150); assert.equal(b.coldMarine, N - 150); assert.equal(b.coldWind, N - 150); assert.equal(b.requests, 2 * Math.ceil((N - 150) / 10) + Math.ceil(b.buoys / 10), 'the same Open-Meteo requests the capture test counts');
  assert.equal(callWeight(marineBatchURL(Array.from({length: 10}, () => ({lat: 1, lon: 1})))), 10, 'weighted: a 10-location request counts 10, batching saves requests not quota');
  if (process.env.SHOW) console.log(JSON.stringify(captureBudget(150)));
});

/* ---------- review round: honest words, lead consistency, collecting counts, swell minimums, streaming, batch isolation, failed reads ---------- */
test('no label says "measured" for the rating: it names what fed it (the buoy\'s readings + which wind) and that it is offshore, not at the break', () => {
  const ok = spotResult('s', PICK, true, pairsFor(10), {pairs: ratingPairsFor(7, () => 45, () => 45), windHours: 0}, null, NOW), col = spotResult('s', PICK, true, [], noRating, null, NOW);
  const sk = {status: 'skipped' as const, spotId: 's', buoy: ok.buoy, reason: 'x', last: ok, lastAt: '2026-11-09T01:00:00Z'};
  for (const s of [ok, col, sk]) { const r = ratingLine(s)!.text; assert.doesNotMatch(r, /measured/i); assert.match(r, /^Rating vs the rating from buoy 51201's readings/); }
  assert.match(ratingLine(ok)!.text, /offshore, not at the break/); assert.doesNotMatch(ratingBasis(ok as never), /measured/i); assert.match(ratingBasis(ok as never), /describes the water at the buoy, not the break/);
  assert.match(ratingLine(ok)!.text, /\(\+ our forecast wind\)/);
});
const eqRecord = (from: number) => ({hourly_units: MU, hourly: {time: Array.from({length: 72}, (_, i) => from / 1000 + i * 3600), wave_height: Array(72).fill(1.8), swell_wave_height: Array(72).fill(1.5), swell_wave_direction: Array(72).fill(290), swell_wave_period: Array(72).fill(12), secondary_swell_wave_height: Array(72).fill(null), secondary_swell_wave_direction: Array(72).fill(null), secondary_swell_wave_period: Array(72).fill(null), sea_surface_temperature: Array(72).fill(15)}});
test('lead consistency: the observed-fed rating is judged at the `now` the shown rating was judged at (ratedAt), and a buoy that read exactly what we forecast gives exactly the rating we showed', () => {
  const from = Math.ceil(T0 / HOUR) * HOUR, cap0 = captureSpot('spot-1', eqRecord(from), windAt(from), 'r', 'r', 'fetched', T0)!;
  assert.equal(cap0.ratedAt, new Date(T0).toISOString());
  const c: ShownCapture = {schema: 2, date: '2026-11-10', capturedAt: new Date(T0 - 5 * HOUR).toISOString(), spots: {'spot-1': {...cap0, retrievedAt: new Date(T0 - 20 * HOUR).toISOString()}}, buoys: {}};
  const obs = new Map<number, BuoyHour>(); for (let h = 0; h < 48; h++) obs.set(from + h * HOUR, {hsM: 1.8, swH: 1.5, swP: 12, swD: 290, wwH: null, wwP: null, wwD: null});
  const {ratingRows} = awaitedModule; const rows = ratingRows('spot-1', c, obs, () => null, new Set(), from - HOUR, from + 60 * HOUR);
  assert.ok(rows.length > 5, `${rows.length} daylight pairs`); for (const r of rows) assert.equal(r.shown, r.observed, 'same record, same lead: the same rating');
});
import * as awaitedModule from '../services/howRightAll.ts';
test('collecting counts are the real ones: the 7-day rating count is carried and printed while d7 is null; the 30-day rating figure is shown when it exists', () => {
  const two = spotResult('s', PICK, true, pairsFor(10), {pairs: ratingPairsFor(2, () => 45, () => 45), windHours: 0}, null, NOW);
  assert.equal(two.status, 'ok'); if (two.status === 'ok') { assert.equal(two.rating.d7, null); assert.equal(two.rating.daysScored7, 2); }
  assert.equal(ratingLine(two)!.text, "Rating vs the rating from buoy 51201's readings (+ our forecast wind), offshore, not at the break: collecting: 2 days checked so far (a day counts once 12 of its hours are checked against the buoy; we need 3 before showing a number).");
  const long = spotResult('s', PICK, true, pairsFor(20), {pairs: ratingPairsFor(20, () => 45, () => 45), windHours: 0}, null, NOW);
  if (long.status === 'ok') { assert.ok(long.rating.d7 && long.rating.d30); assert.match(ratingLine(long)!.text, /; last 30 days: 20 of 20 scored days$|; last 30 days: \d+ of \d+ scored days\.$/); } else assert.fail();
});
test('swell detail needs the same minimum days as the height; otherwise it is null ("too few hours"); period and direction use only hours above 0.5 m', () => {
  const full = pairsFor(10), oneDaySwell = full.map((p, i) => (i >= full.length - 24 ? p : {...p, fcSw: null, obSw: null}));
  const w = offshoreWindow(oneDaySwell, NOW, 7); assert.ok(w.hs && w.daysWithData >= 3); assert.equal(w.swell!.height, null); assert.equal(w.swell!.periodS, null); assert.equal(w.swell!.directionDeg, null);
  const ok = offshoreWindow(full, NOW, 7); assert.ok(ok.swell!.height && ok.swell!.periodS && ok.swell!.directionDeg);
  const small = offshoreWindow(full.map((p) => ({...p, fcSw: 0.3, obSw: 0.4})), NOW, 7); assert.ok(small.swell!.height, 'height has no 0.5 m floor'); assert.equal(small.swell!.periodS, null); assert.equal(small.swell!.directionDeg, null);
});
test('streaming gives the same pairs as holding every capture: the newest-first claim equals the latest-old-enough rule, an hour is never filled from an older copy', async () => {
  const {offshoreRows, newestFirst} = awaitedModule, h = (n: number) => T0 + n * HOUR;
  const caps = [mk(T0 - 30 * HOUR, [h(0), h(1), h(2), h(3)]), mk(T0 - 15 * HOUR, [h(0), h(1)]), mk(T0 - 6 * HOUR, [h(0), h(1), h(5), h(7)])];
  const obs = new Map<number, BuoyHour>(); for (let i = 0; i < 10; i++) obs.set(h(i), {hsM: 1, swH: null, swP: null, swD: null, wwH: null, wwP: null, wwD: null});
  const idx = shownIndex(caps, (c) => ({time: c.buoys.B.marine.time, retrievedAt: c.buoys.B.retrievedAt})), claimed = new Set<number>(), got = new Map<number, number>();
  newestFirst(caps).forEach((c) => { for (const r of offshoreRows(c, 'B', obs, claimed, h(-5), h(20))) got.set(r.t, caps.indexOf(c)); });
  assert.deepEqual([...got].sort((a, b) => a[0] - b[0]), [...idx].map(([t, r]) => [t, r.cap]).sort((a, b) => (a[0] as number) - (b[0] as number)));
  // an hour claimed by the newest old-enough copy is not given to an older one even when the buoy had no reading for it
  const gap = new Map(obs); gap.delete(h(0)); const c2 = new Set<number>(); const all = newestFirst(caps).flatMap((c) => offshoreRows(c, 'B', gap, c2, h(-5), h(20))); assert.ok(!all.some((r) => r.t === h(0)));
});
test('batch isolation: when a batch fails its members are retried singly; a point that keeps failing is set aside after 3 ticks, flagged in _status, and no longer blocks "complete" and scoring', async () => {
  const clock = {t: T0}, r2 = fakeR2(), log: string[] = [], poisonSpot = picks.find((p) => !HOT.has(p.id))!, ev = evidenceSpot(poisonSpot.id);
  const job = makeJob(clock, r2, log, {}, {poison: {lat: ev.marineLatitude, lon: ev.marineLongitude}});
  const r1 = await job.capture({BUCKET: r2.bucket}) as any;
  assert.equal(r1.complete, false); assert.equal(r1.spots, N - 1, 'only the poisoned spot is missing: its batch-mates were retried one by one'); assert.ok(log.some((u) => /open-meteo/.test(u) && !new URL(u).searchParams.get('latitude')!.includes(',')), 'single-location retries happened');
  assert.deepEqual(JSON.parse(r2.store.get(HRA_KEYS.status)!).fails, {[poisonSpot.id]: 1});
  await job.capture({BUCKET: r2.bucket}); const r3 = await job.capture({BUCKET: r2.bucket}) as any;
  assert.equal(r3.complete, true, 'set aside after 3 ticks'); assert.deepEqual(r3.excluded, [poisonSpot.id]);
  const st = JSON.parse(r2.store.get(HRA_KEYS.status)!); assert.deepEqual(st.excluded, [poisonSpot.id]); assert.equal(st.captureComplete, true);
  log.length = 0; const again = await job.capture({BUCKET: r2.bucket}) as any; assert.ok(!log.some((u) => u.includes(String(ev.marineLatitude))), 'a set-aside spot is not retried');
  assert.match(((await job.daily({BUCKET: r2.bucket})) as any).step, /^score/, 'the day now scores');
});
test('status and capture reads that throw abort the tick before any write (no overwrite of the status, the card or a capture); a failed buoy fetch skips that buoy today and keeps its last check', async () => {
  const clock = {t: T0}, r2 = fakeR2(), log: string[] = [], job = makeJob(clock, r2, log);
  const badStatus = fakeR2(new Map(r2.store), {failGet: (k) => k === HRA_KEYS.status}), j1 = makeJob(clock, badStatus, []);
  for (const r of [await j1.capture({BUCKET: badStatus.bucket}), await j1.score({BUCKET: badStatus.bucket}), await j1.daily({BUCKET: badStatus.bucket})] as any[]) { assert.equal(r.ok, false); assert.match(r.reason, /R2 read/); }
  assert.equal(badStatus.ops.puts, 0);
  // two days: the second day's buoy fetches fail
  let rep: any, n = 0; do { rep = await job.daily({BUCKET: r2.bucket}); n++; } while (rep.step !== 'idle' && n < 12);
  for (let d = 1; d < 6; d++) { clock.t = T0 + d * DAY; n = 0; do { rep = await job.daily({BUCKET: r2.bucket}); n++; } while (rep.step !== 'idle' && n < 12); }
  const good = JSON.parse(r2.store.get(HRA_KEYS.card)!), withNumber = Object.values(good.spots).find((s: any) => s.status === 'ok') as any; assert.ok(withNumber, 'a scored spot exists after 6 days');
  const jf = makeJob(clock, r2, [], {}, {failSpec: () => true}); clock.t = T0 + 6 * DAY; n = 0; do { rep = await jf.daily({BUCKET: r2.bucket}); n++; } while (rep.step !== 'idle' && n < 12);
  const card = JSON.parse(r2.store.get(HRA_KEYS.card)!), s = card.spots[withNumber.spotId]; assert.equal(s.status, 'skipped'); assert.equal(s.last.status, 'ok'); assert.equal(s.last.d7.hs.n, withNumber.d7.hs.n);
  assert.match(offshoreLine(s, 'm').text, new RegExp(`^Offshore check skipped today: buoy ${s.buoy.id}'s data could not be fetched\\. Last check \\(2026-11-1\\d UTC\\): Offshore wave height at the buoy`)); assert.ok(ratingLine(s)); assert.ok(Object.values(card.buoys).every((b: any) => !b.ok));
  const status = JSON.parse(r2.store.get(HRA_KEYS.status)!); assert.ok(status.failedBuoys.length > 0);
  const badCard = fakeR2(new Map(r2.store), {failGet: (k) => k === HRA_KEYS.card}), before = badCard.store.get(HRA_KEYS.card); clock.t = T0 + 7 * DAY; const jb = makeJob(clock, badCard, []);
  const r = await jb.score({BUCKET: badCard.bucket}) as any; assert.equal(r.ok, false); assert.equal(badCard.store.get(HRA_KEYS.card), before);
}, {timeout: 240000});

test('scoring runs in stages: each stage keeps a partial in R2, the last one writes the card, the staged card equals one done in a single stage, and a stage never holds more than one parsed capture', async () => {
  const clock = {t: T0}, mk2 = (stage: number, r2: ReturnType<typeof fakeR2>, onCapture?: () => void) => makeJob(clock, r2, [], {stageSize: stage, onCapture});
  const a = fakeR2(), b = fakeR2(); let live = 0, maxLive = 0;
  const ja = mk2(70, a, () => { live++; maxLive = Math.max(maxLive, live); }), jb = mk2(1000, b);
  const days = async (j: ReturnType<typeof mk2>, r2: ReturnType<typeof fakeR2>) => { const steps: string[] = []; for (let d = 0; d < 6; d++) { clock.t = T0 + d * DAY; let rep: any, n = 0; do { rep = await j.daily({BUCKET: r2.bucket}); steps.push(rep.step); n++; } while (rep.step !== 'idle' && n < 12); } return steps; };
  const sa = await days(ja, a), sb = await days(jb, b);
  assert.ok(sa.includes('score-stage') && !sb.includes('score-stage')); assert.equal(sa.filter((x) => x === 'score').length, 6); assert.ok(sa.filter((x) => x === 'score-stage').length >= 12, 'about 2 stages before the last, each day');
  const ca = JSON.parse(a.store.get(HRA_KEYS.card)!), cb = JSON.parse(b.store.get(HRA_KEYS.card)!);
  assert.deepEqual(ca.spots, cb.spots); assert.equal(ca.captureDays, cb.captureDays); assert.deepEqual(Object.keys(ca.buoys).sort(), Object.keys(cb.buoys).sort());
  assert.ok(JSON.parse(a.store.get(HRA_KEYS.status)!).cardDate === '2026-11-15');
}, {timeout: 400000});

test('buoys with no realtime `.spec` file are not offered to any spot; a score re-run on a finished day starts again instead of reading its empty partial', async () => {
  const {NO_SPEC_FILE} = await import('../ocean/scoringBuoys.ts'); for (const id of NO_SPEC_FILE) assert.equal(scoringBuoy(id), null, id);
  assert.ok(spotPicks().every((p) => !p.choice.ok || !NO_SPEC_FILE.has(p.choice.pick.buoy.id)));
  const clock = {t: T0}, r2 = fakeR2(), job = makeJob(clock, r2, []); let rep: any, n = 0;
  do { rep = await job.daily({BUCKET: r2.bucket}); n++; } while (rep.step !== 'idle' && n < 12);
  const again = await job.score({BUCKET: r2.bucket}) as any; for (let i = 0; i < Math.ceil(N / 70) + 2 && again.step === 'score-stage'; i++) Object.assign(again, await job.score({BUCKET: r2.bucket}));   // 70 spots a stage: enough turns to finish the whole catalogue as it grows
  assert.equal(again.ok, true); assert.equal(again.spots, N);
}, {timeout: 120000});
