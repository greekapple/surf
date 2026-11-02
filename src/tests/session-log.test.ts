import test from 'node:test';
import assert from 'node:assert/strict';
import {checkObservation, addObservation, removeObservation, loadLog, saveLog, logToCsv, logToJson, SESSION_LOG_KEY, type ObservationInput} from '../services/sessionLog.ts';

const now = Date.parse('2026-11-02T20:00:00Z');
const ok: ObservationInput = {spotId: 'spot-2', observedAt: '2026-11-02T16:30:00Z', lo: 4, hi: 6, unit: 'ft', quality: 3, barNote: '  inside bar working, outside closing out  '};
const mem = () => { const m = new Map<string, string>(); return {m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }}; };

test('a valid observation is stored in feet of face height with a trimmed bar note', () => {
  const c = checkObservation(ok, now); assert.ok(c.ok); if (!c.ok) return;
  assert.deepEqual(c.value.rangeFt, [4, 6]); assert.equal(c.value.barNote, 'inside bar working, outside closing out'); assert.equal(c.value.observedAt, '2026-11-02T16:30:00.000Z');
  const m = checkObservation({...ok, unit: 'm', lo: 1, hi: 2}, now); assert.ok(m.ok && m.value.rangeFt[0] === 3.3 && m.value.rangeFt[1] === 6.6);
  assert.ok(checkObservation({...ok, barNote: undefined}, now).ok);
});

test('it refuses rather than repairs: future, ancient, reversed, out of range, unrated, missing', () => {
  const err = (o: Partial<ObservationInput>) => { const c = checkObservation({...ok, ...o}, now); return c.ok ? 'ok' : c.error; };
  assert.match(err({observedAt: '2026-11-03T16:30:00Z'}), /future/); assert.match(err({observedAt: '2025-01-01T00:00:00Z'}), /year ago/); assert.match(err({observedAt: 'soon'}), /when you surfed/);
  assert.match(err({lo: 6, hi: 4}), /below the lowest/); assert.match(err({lo: -1}), /between 0 and 60/); assert.match(err({hi: 61}), /between 0 and 60/);
  assert.match(err({lo: NaN}), /lowest and highest/); assert.match(err({quality: 0}), /1 to 5/); assert.match(err({quality: 3.5}), /1 to 5/); assert.match(err({spotId: ''}), /spot/);
  assert.equal(checkObservation({...ok, barNote: 'x'.repeat(500)}, now).ok && true, true);
  const long = checkObservation({...ok, barNote: 'x'.repeat(500)}, now); assert.ok(long.ok && long.value.barNote!.length === 200);
});

test('add, persist, reload, remove; malformed stored records are dropped, not repaired; refused writes are reported', () => {
  const s = mem(); const c = checkObservation(ok, now); assert.ok(c.ok); if (!c.ok) return;
  let log = addObservation([], c, {mop: {mopId: 'SF023', product: 'nowcast', validAt: '2026-11-02T17:00:00.000Z', hsFt: 4.5, tpS: 13, dpDeg: 266}, heightLabel: '5.2 ft offshore · not surf size'}, now, 'a1');
  const c2 = checkObservation({...ok, observedAt: '2026-11-01T16:30:00Z', quality: 5}, now); assert.ok(c2.ok); if (!c2.ok) return;
  log = addObservation(log, c2, undefined, now, 'a2');
  assert.deepEqual(log.map((o) => o.id), ['a1', 'a2'], 'newest session first');
  assert.equal(saveLog(log, s), true); assert.deepEqual(loadLog(s), log);
  s.m.set(SESSION_LOG_KEY, JSON.stringify([...log, {id: 'bad', schema: 1, spotId: 'x', observedAt: 'no', rangeFt: [3, 1], quality: 9}, 'junk']));
  assert.deepEqual(loadLog(s).map((o) => o.id), ['a1', 'a2']);
  assert.deepEqual(removeObservation(log, 'a1').map((o) => o.id), ['a2']);
  assert.equal(saveLog(log, {getItem: () => null, setItem: () => { throw new Error('quota'); }}), false); assert.equal(saveLog(log, null), false);
  assert.deepEqual(loadLog({getItem: () => '{not json', setItem: () => {}}), []); assert.deepEqual(loadLog(null), []);
});

test('exports say what the numbers are and keep the app context beside the observation', () => {
  const c = checkObservation(ok, now); assert.ok(c.ok); if (!c.ok) return;
  const log = addObservation([], c, {mop: {mopId: 'SF023', product: 'forecast', validAt: '2026-11-02T18:00:00.000Z', hsFt: 4.52, tpS: 13.3, dpDeg: 266}, estimateRangeFt: [3, 6], heightLabel: 'a, "b"'}, now, 'a1');
  const j = JSON.parse(logToJson(log, '2026-11-02T21:00:00Z')); assert.equal(j.kind, 'swello-session-log'); assert.match(j.heightQuantity, /face height/); assert.equal(j.count, 1); assert.equal(j.observations[0].context.mop.mopId, 'SF023');
  const lines = logToCsv(log).trim().split('\n'); assert.equal(lines.length, 2); assert.match(lines[0], /faceMinFt,faceMaxFt,waveQuality1to5/);
  assert.match(lines[1], /,4,6,3,/); assert.match(lines[1], /"a, ""b"""/); assert.match(lines[1], /SF023,forecast/); assert.equal(logToCsv([]).trim().split('\n').length, 1);
});
