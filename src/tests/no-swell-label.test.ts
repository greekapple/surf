import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pointLine} from '../features/explore/pointLine.ts';
import {NO_SWELL_NOTE, type PointValue} from '../map/fieldData.ts';
import type {UserProfile} from '../models/index.ts';

const p = {heightUnit: 'ft', windUnit: 'mph'} as UserProfile;
const v = (value: number, note?: string): PointValue => ({value, note, unit: 'm', dirFrom: null, layer: 'SWELL', validAt: '2026-11-04T00:00:00Z', source: 'WW3'} as PointValue);

test('map-review (b): a no-swell cell never reads as calm: it names the wind sea and its height from the waves frame', () => {
  const l = pointLine(v(0, NO_SWELL_NOTE), 12, p, 'swell', 4.55)!;
  assert.match(l.main, /^No swell · wind sea 1[45](\.\d)? ft$/);
  assert.match(l.note, /no swell partition: wind sea only/);
  assert.doesNotMatch(l.main, /12 s/, 'no period: the empty partition has none');
});

test('map-review (b): without the waves value it still says no swell (wind sea only), never a bare "0 ft"', () => {
  for (const w of [null, undefined, 0]) {
    const l = pointLine(v(0, NO_SWELL_NOTE), null, p, 'swell', w)!;
    assert.equal(l.main, 'No swell (0 ft)'); assert.equal(l.note, NO_SWELL_NOTE);
  }
  // a measured swell is unchanged
  assert.match(pointLine(v(2, undefined), 14, p, 'swell')!.main, /ft · 14 s$/);
});
