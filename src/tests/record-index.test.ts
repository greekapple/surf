import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ahead, indexBySpot, near} from '../features/explore/recordIndex.ts';

// A fixture like the map's records: many spots, hourly, unsorted, with a duplicated timestamp and records right on the ±3 h and +12 h edges.
type R = {spotId: string; timestamp: string; offshore: number};
const T0 = Date.parse('2026-11-13T20:00:00Z'), spots = Array.from({length: 40}, (_, k) => `s${k}`);
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const recs: R[] = [];
for (const s of spots) for (let h = -30; h <= 40; h++) recs.push({spotId: s, timestamp: new Date(T0 + h * 36e5).toISOString(), offshore: Math.round(rnd() * 400) / 100});
recs.push({spotId: 's3', timestamp: new Date(T0 + 2 * 36e5).toISOString(), offshore: 9.99});   // a duplicate hour (the later one wins in a Map, as before)
recs.sort(() => rnd() - 0.5);   // the map's records are not in any particular order

// the old code, verbatim in shape: a filter over ALL records for each spot
const oldNear = (id: string, t0: number) => recs.filter((r) => r.spotId === id && Math.abs(Date.parse(r.timestamp) - t0) <= 3 * 36e5);
const oldAhead = (id: string, t0: number) => new Map(recs.filter((r) => r.spotId === id && Date.parse(r.timestamp) >= t0 && Date.parse(r.timestamp) < t0 + 12 * 36e5).map((r) => [Date.parse(r.timestamp), r]));

test('list-index: the indexed lookups return exactly what the full filters returned (same records, same order, same Map)', () => {
  const idx = indexBySpot(recs);
  for (const t0 of [T0, T0 + 30 * 60e3, T0 - 7 * 36e5, T0 + 35 * 36e5, T0 + 100 * 36e5]) for (const id of [...spots, 'nope']) {
    assert.equal(JSON.stringify(near(idx.get(id), t0, 3)), JSON.stringify(oldNear(id, t0)), `near ${id} @${t0}`);
    assert.equal(JSON.stringify([...new Map(ahead(idx.get(id), t0, 12).map((x) => [x.t, x.r]))]), JSON.stringify([...oldAhead(id, t0)]), `ahead ${id} @${t0}`);
  }
  // the list's offshore range text, both ways (rangeAt: floor of the min and ceil of the max of the hour's ±3 h, one decimal)
  const range = (rs: R[]) => { const hs = rs.map((r) => Number(r.offshore.toFixed(1))); if (!hs.length) return null; const lo = Math.floor(Math.min(...hs)), hi = Math.ceil(Math.max(...hs)); return `${lo === hi ? lo : `${lo}–${hi}`} ft offshore`; };
  for (const id of spots) assert.equal(range(near(idx.get(id), T0, 3)), range(oldNear(id, T0)));
});

test('list-index: ExploreView builds the index once per change of the records and reads only the spot\'s own records', () => {
  const ev = fs.readFileSync(new URL('../features/explore/ExploreView.tsx', import.meta.url), 'utf8');
  assert.match(ev, /const recBySpot = useMemo\(\(\) => indexBySpot\(view\.mapRecords\), \[view\.mapRecords\]\);/);
  assert.match(ev, /const hs = near\(recBySpot\.get\(id\), t0, 3\)/);
  assert.match(ev, /const byT = new Map\(ahead\(recBySpot\.get\(id\), t0, 12\)\.map\(\(x\) => \[x\.t, x\.r\]\)\);/);
  assert.doesNotMatch(ev, /view\.mapRecords\.filter\(\(r\) => r\.spotId === id/, 'no per-spot scan of all records left in the list');
});
