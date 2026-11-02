import test from 'node:test';
import assert from 'node:assert/strict';
import {pickMop} from '../services/nearshoreSelect.ts';
import type {NearshoreRecord} from '../ocean/nearshore.ts';

const rec = (iso: string, product: 'nowcast' | 'forecast'): NearshoreRecord => {
  const m = (unit: any) => ({value: 1, unit, source: {} as any});
  return {timestamp: new Date(iso).toISOString(), height: m('ft'), period: m('s'), direction: m('deg'), qualityFlag: 1, product};
};
const now = Date.parse('2026-11-01T12:00:00Z');
const nowcast = ['09', '10', '11', '12'].map((h) => rec(`2026-11-01T${h}:00:00Z`, 'nowcast'));
const forecast = ['12', '15', '18', '21'].map((h) => rec(`2026-11-01T${h}:00:00Z`, 'forecast')).concat(['00', '03'].map((h) => rec(`2026-11-02T${h}:00:00Z`, 'forecast')));

test('past and present hours use the nowcast; the forecast is the fallback only when it has the hour', () => {
  const a = pickMop(Date.parse('2026-11-01T10:00:00Z'), now, nowcast, forecast);
  assert.ok(a.state === 'ok' && a.product === 'nowcast' && a.offsetMin === 0);
  const b = pickMop(Date.parse('2026-11-01T12:00:00Z'), now, nowcast, forecast);
  assert.ok(b.state === 'ok' && b.product === 'nowcast');
  const c = pickMop(Date.parse('2026-11-01T12:00:00Z'), now, [], forecast);
  assert.ok(c.state === 'ok' && c.product === 'forecast');
});

test('future hours use the forecast at its 3-hourly step, with the offset reported and nothing interpolated', () => {
  const a = pickMop(Date.parse('2026-11-01T16:00:00Z'), now, nowcast, forecast);
  assert.ok(a.state === 'ok' && a.product === 'forecast' && a.record.timestamp === '2026-11-01T15:00:00.000Z' && a.offsetMin === -60);
  const b = pickMop(Date.parse('2026-11-01T19:30:00Z'), now, nowcast, forecast);
  assert.ok(b.state === 'ok' && b.record.timestamp === '2026-11-01T18:00:00.000Z' && b.offsetMin === -90, 'half a step is the limit');
});

test('outside coverage and empty data refuse instead of extrapolating', () => {
  const far = pickMop(Date.parse('2026-11-05T12:00:00Z'), now, nowcast, forecast);
  assert.deepEqual(far, {state: 'outside', first: '2026-11-01T09:00:00.000Z', last: '2026-11-02T03:00:00.000Z'});
  assert.deepEqual(pickMop(now, now, undefined, undefined), {state: 'no-data'});
  assert.deepEqual(pickMop(NaN, now, nowcast, forecast), {state: 'no-data'});
  const early = pickMop(Date.parse('2026-11-01T05:00:00Z'), now, nowcast, forecast);
  assert.equal(early.state, 'outside');
});
