import test from 'node:test';
import assert from 'node:assert/strict';
import {nextMorningKey, nextMorningHour, rankLabel} from '../services/homeDash.ts';

// T-099: after midnight the next daylight is THIS morning (Home's morning tab and Compare spots' night opening hour share the rule).
const pst = (s: string) => Date.parse(s + '-08:00');
test('next morning: today before 6 AM, tomorrow from 6 AM on', () => {
  assert.equal(nextMorningKey(pst('2026-11-03T00:30:00')), '2026-11-03');
  assert.equal(nextMorningKey(pst('2026-11-03T05:59:00')), '2026-11-03');
  assert.equal(nextMorningKey(pst('2026-11-03T06:00:00')), '2026-11-04');
  assert.equal(nextMorningKey(pst('2026-11-03T22:00:00')), '2026-11-04');
});
test('the morning tab says "This morning" before 6 AM, "Tomorrow AM" otherwise', () => {
  assert.equal(rankLabel('tomorrow-am', pst('2026-11-03T02:00:00')).tab, 'This morning');
  assert.equal(rankLabel('tomorrow-am', pst('2026-11-03T21:00:00')).tab, 'Tomorrow AM');
  assert.equal(rankLabel('now', pst('2026-11-03T02:00:00')).tab, 'Right now');
});
test('Compare at night opens on the next morning\'s first light hour (6–11 AM, not dark)', () => {
  const times = Array.from({length: 48}, (_, i) => new Date(pst('2026-11-03T00:00:00') + i * 36e5).toISOString());
  const dark = (iso: string) => { const h = Number(new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23'}).format(new Date(iso))); return h < 7 || h >= 18; };
  assert.equal(nextMorningHour(times, pst('2026-11-03T02:00:00'), dark), new Date(pst('2026-11-03T07:00:00')).toISOString(), '2 AM → this morning 7 AM');
  assert.equal(nextMorningHour(times, pst('2026-11-03T21:00:00'), dark), new Date(pst('2026-11-04T07:00:00')).toISOString(), '9 PM → tomorrow 7 AM');
});
