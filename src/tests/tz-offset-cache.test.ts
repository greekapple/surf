import test from 'node:test';
import assert from 'node:assert/strict';
import {tzOffsetMs, localMiddayMs} from '../ocean/time.ts';

// tzOffsetMs reuses one cached formatter per zone (T-091: constructing it per call cost ~0.9 s of Home's main thread on a phone at 384 spots); the answer must not change.
const ref = (tz: string, ms: number) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'}).formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000; };
test('cached tzOffsetMs equals the uncached formula across zones, DST edges and years', () => {
  const zones = ['America/Los_Angeles', 'Pacific/Honolulu', 'America/New_York', 'Europe/Paris', 'Australia/Sydney', 'Asia/Kolkata'];
  for (const tz of zones) for (let t = Date.UTC(2025, 0, 1); t < Date.UTC(2027, 0, 1); t += 3 * 3600e3 + 1234) assert.equal(tzOffsetMs(tz, t), ref(tz, t), tz + ' ' + new Date(t).toISOString());
  assert.equal(localMiddayMs('America/New_York', '2026-03-08'), Date.UTC(2026, 2, 8, 16));
});
