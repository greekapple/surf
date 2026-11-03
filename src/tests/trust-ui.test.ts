import test from 'node:test';
import assert from 'node:assert/strict';
import {activeAlerts, estimateBand, feltForHour, hasEstimateBand} from '../features/forecast/trustRules.ts';
import {PERIOD_KIND, periodKind, rankBoards} from '../features/quiver/fit.ts';
import {periodFit} from '../services/boardPeriod.ts';
import type {SurfBandPoint} from '../services/surfSeries.ts';
import type {Surfboard} from '../models/index.ts';

// Codex P1 (4cb6b48): offshore-only and demonstration hours carry lo/hi too, but they are not surf estimates and must never become the graph's band.
const pt = (kind: SurfBandPoint['kind'], lo: number | null, hi: number | null): SurfBandPoint => ({t: '2026-11-03T15:00:00Z', lo, hi, kind, offshoreFt: 6.1, dark: false});

test('only a surf estimate is a band; offshore and demonstration points are not', () => {
  assert.deepEqual(estimateBand(pt('estimate', 4, 7))?.lo, 4);
  assert.equal(estimateBand(pt('offshore', 6.1, 6.1)), undefined);
  assert.equal(estimateBand(pt('demonstration', 5, 5)), undefined);
  assert.equal(estimateBand(pt('none', null, null)), undefined);
  assert.equal(estimateBand(undefined), undefined);
});

test('a series of offshore-only hours has no band at all (the chart falls back to the labelled offshore line)', () => {
  assert.equal(hasEstimateBand([pt('offshore', 6, 6), pt('offshore', 7, 7), pt('demonstration', 5, 5)]), false);
  assert.equal(hasEstimateBand([pt('offshore', 6, 6), pt('estimate', 4, 7)]), true);
});

// Codex P2: every SWELLO board type maps to a periodFit kind, and the board's length reaches periodFit.
test('every board type maps to a supported periodFit kind', () => {
  for (const [type, kind] of Object.entries(PERIOD_KIND)) assert.ok(['shortboard', 'fish', 'midlength', 'longboard', 'stepup', 'gun'].includes(kind), `${type} → ${kind}`);
  assert.equal(periodKind('Performance shortboard'), 'shortboard');
  assert.equal(periodKind('Step-up'), 'stepup');
});

const board = (type: Surfboard['type'], length: number): Surfboard => ({id: `${type}-${length}`, name: type, manufacturer: '', model: '', type, length, width: 20, thickness: 2.5, volume: 30, favorite: false} as Surfboard);

test('rankBoards passes the shortboard kind (10 s minimum), not the 9 s default', () => {
  const p9 = rankBoards([board('Performance shortboard', 72)], [3, 5], 9.5)[0].period;
  assert.deepEqual(p9, periodFit('shortboard', 9.5, 72));
  assert.equal(p9?.fit, 'short', 'a 9.5 s swell is short for a shortboard (10 s minimum)');
});

test('rankBoards passes the board length, so the small-board long-period note can fire', () => {
  const small = rankBoards([board('Fish', 64)], [2, 4], 17)[0].period, long = rankBoards([board('Fish', 74)], [2, 4], 17)[0].period;
  assert.deepEqual(small, periodFit('fish', 17, 64));
  assert.deepEqual(long, periodFit('fish', 17, 74));
});

// Codex P2: hazard alerts past their end or expiry are not shown.
test('activeAlerts drops alerts past their end (else expiry)', () => {
  const now = Date.parse('2026-11-03T03:00:00Z');
  const a = (ends: string | null, expires: string | null) => ({event: 'Beach Hazards Statement', headline: '', onset: null, ends, expires, url: 'https://www.weather.gov/', sender: 'NWS', severity: null, approxZone: false});
  assert.equal(activeAlerts([a('2026-11-03T04:00:00Z', null)], now).length, 1);
  assert.equal(activeAlerts([a('2026-11-03T02:00:00Z', '2026-11-03T05:00:00Z')], now).length, 0, 'ends wins over expires');
  assert.equal(activeAlerts([a(null, '2026-11-03T02:59:00Z')], now).length, 0);
  assert.equal(activeAlerts([a(null, null)], now).length, 1);
});

// Codex P2: the Felt-right answer belongs to one spot-hour.
test('feltForHour returns only the selected hour\'s answer, newest first', () => {
  const e = (hour: string, felt: 'low' | 'right' | 'high', loggedAt: string, spotId = 'spot-2') => ({id: hour + loggedAt, spotId, hour, felt, loggedAt, predicted: {loFt: 4, hiFt: 7, method: 'mop-v2' as const}}) as never;
  const log = [e('2026-11-03T15:00:00Z', 'low', '2026-11-03T15:10:00Z'), e('2026-11-03T15:00:00Z', 'high', '2026-11-03T15:20:00Z'), e('2026-11-03T18:00:00Z', 'right', '2026-11-03T18:05:00Z'), e('2026-11-03T15:00:00Z', 'right', '2026-11-03T15:30:00Z', 'spot-3')];
  assert.equal(feltForHour(log, 'spot-2', '2026-11-03T15:00:00Z'), 'high');
  assert.equal(feltForHour(log, 'spot-2', '2026-11-03T18:00:00Z'), 'right');
  assert.equal(feltForHour(log, 'spot-2', '2026-11-03T21:00:00Z'), null, 'another hour has no answer');
  assert.equal(feltForHour(log, 'spot-0', '2026-11-03T15:00:00Z'), null);
});

// T-069: the line under the call's verdict must add something.
import {firstNewReason, restatesHeadline} from '../features/forecast/trustRules.ts';
test('a why that only restates the verdict and window is dropped; one that adds a reason is kept', () => {
  const head = 'Dark next window 6 AM–2 PM tomorrow';
  assert.equal(restatesHeadline('It is dark. The next window is tomorrow 6 AM–2 PM.', head), true);
  assert.equal(restatesHeadline('It is dark: before first light or after last light, so there is no rating.', head), false);
  assert.equal(firstNewReason(['It is dark. The next window is tomorrow 6 AM–2 PM.', 'Onshore wind 12 mph.'], head), 'Onshore wind 12 mph.');
  assert.equal(firstNewReason(['It is dark. The next window is tomorrow 6 AM–2 PM.'], head), null);
  assert.equal(firstNewReason(['Plunging and 6–9 ft: experienced surfers only.'], 'Skip 7–9 AM'), 'Plunging and 6–9 ft: experienced surfers only.');
});
test('T-088: a same-day "today" in the why does not count as new', () => {
  assert.equal(restatesHeadline('It is dark. The next window is today 6–11 AM.', 'Dark next window 6–11 AM'), true);
});
import {uniqueReasons} from '../features/forecast/trustRules.ts';
test('T-088: the reason list drops reasons already inside an earlier one', () => {
  assert.deepEqual(uniqueReasons(['Light offshore wind: clean face. The estimated 3–5 ft is within range.', 'The estimated 3–5 ft is within range.', 'Light offshore wind: clean face.', 'Swell is a plus.']),
    ['Light offshore wind: clean face. The estimated 3–5 ft is within range.', 'Swell is a plus.']);
});
