import test from 'node:test';
import assert from 'node:assert/strict';
import {weekDays} from '../features/home/weekDays.ts';

// T-088b: just after midnight Pacific, the 8th day is beyond the forecast horizon and gets no column.
const recs = (from: string, hours: number, spotId = 'spot-2') => Array.from({length: hours}, (_, i) => ({spotId, timestamp: new Date(Date.parse(from) + i * 36e5).toISOString()}));
test('a trailing day with no records for any row is left out (clock just after midnight)', () => {
  const now = Date.parse('2026-11-03T08:05:00Z'); // 00:05 PST, Tue Nov 3
  const r = recs('2026-11-03T08:00:00Z', 7 * 24 - 2); // the model run reaches Mon Nov 9, not Tue Nov 10
  const days = weekDays(now, r, ['spot-2']);
  assert.equal(days.length, 7);
  assert.equal(days[0], '2026-11-03'); assert.equal(days[6], '2026-11-09');
});
test('all 8 days when the records reach the 8th day; only rows shown count', () => {
  const now = Date.parse('2026-11-02T20:00:00Z');
  assert.equal(weekDays(now, recs('2026-11-02T20:00:00Z', 8 * 24), ['spot-2']).length, 8);
  assert.equal(weekDays(now, recs('2026-11-02T20:00:00Z', 8 * 24, 'spot-9'), ['spot-2']).length, 1, 'records of a spot not in the grid do not count');
});
