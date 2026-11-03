import test from 'node:test';
import assert from 'node:assert/strict';
import {pacificDate, pacificHour, pacificDateMs, pacificHourMs} from '../ocean/time.ts';
import {marineURL, weatherURL} from '../ocean/openMeteo.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {staleSource, rememberRetrieval, forgetRetrieval} from '../ocean/server.ts';

const refDate = (iso: string) => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(iso));
const refHour = (iso: string) => Number(new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23'}).format(new Date(iso)));
test('cached Pacific date and hour equal a fresh Intl formatter, across both DST changes, midnight and repeated calls (T-091)', () => {
  const isos = ['2026-03-08T09:59:00Z', '2026-03-08T10:00:00Z', '2026-03-08T11:00:00Z', '2026-11-01T08:30:00Z', '2026-11-01T09:30:00Z', '2026-11-01T10:30:00Z', '2026-11-03T07:59:00Z', '2026-11-03T08:00:00Z', '2026-11-03T00:00:00Z', '2026-12-31T23:59:59Z'];
  for (let k = 0; k < 2; k++) for (const iso of isos) { assert.equal(pacificDate(iso), refDate(iso), iso); assert.equal(pacificHour(iso), refHour(iso), iso); const ms = Date.parse(iso); assert.equal(pacificDateMs(ms), refDate(iso)); assert.equal(pacificHourMs(ms), refHour(iso) % 24); }
});
test('provider URLs are stable per spot (memoised) and differ between spots', () => {
  const [a, b] = evidenceSpots; assert.equal(marineURL(a), marineURL(a)); assert.equal(weatherURL(a), weatherURL(a)); assert.notEqual(marineURL(a), marineURL(b)); assert.match(marineURL(a), new RegExp(`latitude=${String(a.marineLatitude).replace('.', '\\.')}`));
});
test('staleSource is O(1) and tracks remember/forget', () => {
  const meta = (cache: string) => ({retrievedAt: '2026-11-03T00:00:00Z', issuedAt: null, sourceURL: 'https://x.test/a', cache, model: 'm'});
  assert.equal(staleSource('https://x.test/a'), false); rememberRetrieval('req-a', meta('stale')); assert.equal(staleSource('https://x.test/a'), true);
  rememberRetrieval('req-a', meta('fresh')); assert.equal(staleSource('https://x.test/a'), false); rememberRetrieval('req-a', meta('stale')); forgetRetrieval('req-a'); assert.equal(staleSource('https://x.test/a'), false);
});
