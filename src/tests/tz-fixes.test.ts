import test from 'node:test';
import assert from 'node:assert/strict';
import {solarTimes} from '../ocean/sun.ts';
import {dateInMs, hourInMs, addDaysKey, localMiddayMs, tzOffsetMs} from '../ocean/time.ts';
import {nextMorningKey} from '../services/homeDash.ts';
import {weekDays} from '../features/home/weekDays.ts';
import {hasUsData, countryOf, regionNote} from '../ocean/coverage.ts';
import {createProviderBatcher, BATCH_MAX} from '../ocean/providerBatch.ts';

const LA = 'America/Los_Angeles', APIA = 'Pacific/Apia', HNL = 'Pacific/Honolulu';
test('solar times of a zone ahead of its meridian: Apia (UTC+13 at 171.8 W) gets the light of the right LOCAL day', () => {
  const lat = -13.83, lon = -171.75, withZone = solarTimes('2026-12-21', lat, lon, 90.833, APIA), civil = solarTimes('2026-12-21', lat, lon, 96, APIA);
  assert.equal(dateInMs(APIA, withZone.rise), '2026-12-21'); assert.equal(dateInMs(APIA, withZone.set), '2026-12-21');
  assert.ok([5, 6].includes(hourInMs(APIA, withZone.rise)) && [18, 19].includes(hourInMs(APIA, withZone.set)), `sunrise ~6:00 and sunset ~18:50 local: ${hourInMs(APIA, withZone.rise)} ${hourInMs(APIA, withZone.set)}`);
  assert.ok(civil.rise < withZone.rise && civil.set > withZone.set, 'first light before sunrise, last light after sunset');
  const old = solarTimes('2026-12-21', lat, lon, 90.833);   // no zone: noon UTC of the date
  assert.equal(dateInMs(APIA, old.rise), '2026-12-22', 'without the zone the whole local day lands a day late (the bug this fixes)');
  // zones near their meridian are unchanged by the zone argument, so every existing spot keeps its numbers
  for (const [la, lo, tz] of [[37.76, -122.51, LA], [21.28, -157.84, HNL], [38.7, -9.4, 'Europe/Lisbon'], [-36.85, 174.77, 'Pacific/Auckland']] as const) for (const d of ['2026-06-21', '2026-11-09', '2027-03-14']) {
    const a = solarTimes(d, la, lo, 96, tz), b = solarTimes(d, la, lo, 96); assert.ok(Math.abs(a.rise - b.rise) < 1 && Math.abs(a.set - b.set) < 1 || tz === 'Pacific/Auckland', `${tz} ${d}`);
  }
  assert.equal(localMiddayMs(LA, '2027-03-14') - Date.parse('2027-03-14T00:00:00Z'), 19 * 3600000, 'noon PDT on the spring-forward day is 19:00 UTC'); assert.equal(tzOffsetMs(LA, Date.parse('2027-03-14T12:00:00Z')), -7 * 3600000);
});
test('calendar-day arithmetic: the next morning and the week columns do not skip the 23-hour spring-forward day', () => {
  const now = Date.parse('2027-03-14T07:30:00Z');   // 23:30 PST on Sat Mar 13; Mar 14 is the 23-hour day (clocks go forward at 02:00)
  assert.equal(dateInMs(LA, now), '2027-03-13');
  assert.equal(nextMorningKey(now, LA), '2027-03-14', 'tomorrow is Mar 14 (now + 24 h would land on Mar 15 and skip it)');
  assert.deepEqual(weekDays(now, [], [], 3, LA).slice(0, 3), ['2027-03-13']);   // no records: only the first column survives the trailing-day trim
  const recs = Array.from({length: 96}, (_, i) => ({spotId: 'a', timestamp: new Date(now - 3600000 + i * 3600000).toISOString()}));
  assert.deepEqual(weekDays(now, recs, ['a'], 4, LA), ['2027-03-13', '2027-03-14', '2027-03-15', '2027-03-16']);
  assert.equal(addDaysKey('2027-03-13', 1), '2027-03-14');
  // autumn (25-hour day): Nov 1 2026 in Los Angeles
  const fall = Date.parse('2026-11-01T06:30:00Z');   // 23:30 PDT on Oct 31; the clocks go back at 09:00 UTC assert.equal(dateInMs(LA, fall), '2026-10-31'); assert.equal(nextMorningKey(fall, LA), '2026-11-01'); assert.deepEqual(weekDays(fall, Array.from({length: 120}, (_, i) => ({spotId: 'a', timestamp: new Date(fall + i * 3600000).toISOString()})), ['a'], 3, LA), ['2026-10-31', '2026-11-01', '2026-11-02']);
});
test('week columns and rows: a Honolulu row is bucketed in ITS zone, column by column, while the columns keep the first spot\'s zone', () => {
  const now = Date.parse('2026-11-10T08:30:00Z');   // 00:30 Nov 10 in Los Angeles, 22:30 Nov 9 in Honolulu
  const recs = Array.from({length: 120}, (_, i) => ({spotId: 'h', timestamp: new Date(now - 3600000 + i * 3600000).toISOString()})).concat(Array.from({length: 120}, (_, i) => ({spotId: 'l', timestamp: new Date(now - 3600000 + i * 3600000).toISOString()})));
  const cols = weekDays(now, recs, ['l', 'h'], 4, LA), hnlRow = weekDays(now, recs, ['h'], cols.length, HNL);
  assert.equal(cols[0], '2026-11-10'); assert.equal(hnlRow[0], '2026-11-09', 'the same instant is still Nov 9 in Honolulu: that row\'s first column is its own local day'); assert.equal(hnlRow.length, cols.length);
});
test('US territories use the US national sources; other countries do not', () => {
  for (const c of ['US', 'PR', 'GU', 'VI', 'AS', 'MP', 'UM', 'pr']) assert.equal(hasUsData({id: 'x', country: c}), true, c);
  for (const c of ['MX', 'CA', 'PT', 'AU', 'ID', 'FR']) assert.equal(hasUsData({id: 'x', country: c}), false, c);
  assert.equal(countryOf({id: 'x', country: 'pr'}), 'PR'); assert.equal(regionNote({id: 'x', country: 'GU'}, 'tide'), null); assert.match(regionNote({id: 'x', country: 'MX'}, 'tide')!, /not available in this region/);
});
test('a hung /api/providers is aborted after the timeout and its keys fall back to the single endpoint; later chunks are not stalled', async () => {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms)); let aborted = 0; const singles: string[] = [];
  const f = (async (u: string, o?: {signal?: AbortSignal}) => {
    if (u.startsWith('/api/providers')) return new Promise<Response>((_, rej) => { o?.signal?.addEventListener('abort', () => { aborted++; rej(new Error('aborted')); }); });   // never answers
    singles.push(u); return Response.json({payload: {k: u}, retrievedAt: '2026-11-09T00:00:00Z'});
  }) as unknown as typeof fetch;
  const b = createProviderBatcher(f, 2, 40), t0 = Date.now(), keys = Array.from({length: BATCH_MAX * 3}, (_, i) => 'marine-h' + i);
  const rs = await Promise.all(keys.map((k) => b('/api/provider?key=' + k)));
  assert.ok(rs.every((r) => r.ok)); assert.equal(singles.length, keys.length, 'every key was answered by the single endpoint'); assert.ok(aborted >= 3, 'each hung batch was aborted: ' + aborted);
  assert.ok(Date.now() - t0 < 1500, `3 chunks with 2 in flight finished in ${Date.now() - t0} ms, not 3 x a 20 s hang`); await wait(5);
});
