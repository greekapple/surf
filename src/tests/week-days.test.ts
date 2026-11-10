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
test('round 3 data-honesty: every row is bucketed by the COLUMN dates in its own zone (a CA row and an EST row around midnight)', async () => {
  const {bucketByColumn, weekDays: wd} = await import('../features/home/weekDays.ts');
  const now = Date.parse('2026-11-10T05:30:00Z');   // Mon 9:30 PM PST = Tue 12:30 AM EST
  const recs = [
    {spotId: 'ca', timestamp: '2026-11-10T07:00:00Z'},   // Mon 11 PM PST
    {spotId: 'ca', timestamp: '2026-11-10T08:00:00Z'},   // Tue 12 AM PST
    {spotId: 'ca', timestamp: '2026-11-11T20:00:00Z'},   // Wed 12 PM PST
    {spotId: 'east', timestamp: '2026-11-10T04:00:00Z'}, // Mon 11 PM EST
    {spotId: 'east', timestamp: '2026-11-10T05:00:00Z'}, // Tue 12 AM EST
    {spotId: 'east', timestamp: '2026-11-11T05:00:00Z'}, // Wed 12 AM EST
  ];
  const keys = wd(now, recs, ['ca', 'east'], 3, 'America/Los_Angeles');
  assert.deepEqual(keys, ['2026-11-09', '2026-11-10', '2026-11-11']);
  const ca = bucketByColumn(recs, 'ca', 'America/Los_Angeles', keys), east = bucketByColumn(recs, 'east', 'America/New_York', keys);
  assert.deepEqual(ca.map((c) => c.map((r) => r.timestamp)), [['2026-11-10T07:00:00Z'], ['2026-11-10T08:00:00Z'], ['2026-11-11T20:00:00Z']]);
  // the column headed Mon 9 holds the East spot's Monday (11 PM EST), Tue 10 its Tuesday, Wed 11 its Wednesday: never its "k-th local day"
  assert.deepEqual(east.map((c) => c.map((r) => r.timestamp)), [['2026-11-10T04:00:00Z'], ['2026-11-10T05:00:00Z'], ['2026-11-11T05:00:00Z']]);
});
