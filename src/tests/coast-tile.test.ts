import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {arrowGeom, arrowStepH, at, compass16, facingShore, landPath, periodStep, windowPath, PIN} from '../services/coastTile.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {isCaliforniaSpot} from '../ocean/regionGate.ts';

// forecast-visuals A: the coast tiles. The data is OpenStreetMap's (built by tools/coast-tiles/build-coast-tiles.py), credited, and every California spot has one.
const doc = JSON.parse(readFileSync(new URL('../data/coastTiles.json', import.meta.url), 'utf8')) as {source: string; grid: number; tileMetres: number; tiles: Record<string, {rings: number[][]; land: number}>};
const ca = evidenceSpots.filter((s) => isCaliforniaSpot(s));

test('the coastline data says where it comes from (OpenStreetMap, ODbL) and how it was made', () => {
  assert.match(doc.source, /OpenStreetMap/); assert.match(doc.source, /ODbL/); assert.equal(doc.grid, 1000); assert.equal(doc.tileMetres, 5000);
});
test('every California spot has a tile; every ring is a closed list of points inside the tile; each tile holds both land and sea', () => {
  const missing = ca.filter((s) => !doc.tiles[s.id]).map((s) => s.id);
  assert.deepEqual(missing, []);
  for (const [id, t] of Object.entries(doc.tiles)) {
    assert.ok(t.rings.length > 0, id); assert.ok(t.land > 0 && t.land < 0.985, `${id}: land share ${t.land}`);
    for (const r of t.rings) { assert.equal(r.length % 2, 0, id); assert.ok(r.length >= 6, id); assert.ok(r.every((v) => Number.isInteger(v) && v >= 0 && v <= 1000), id); }
  }
});
// distance from the pin to the nearest drawn shore segment, in tile units (1 unit = 5 m)
const segDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0; return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
test('every pin sits by its mapped shore: within 1 km of the OpenStreetMap coastline drawn in its tile (reef and rivermouth pins sit up to ~800 m off the beach; a wrong tile would be kilometres off)', () => {
  const far: string[] = [];
  for (const s of ca) {
    const t = doc.tiles[s.id]; if (!t) continue; let best = Infinity;
    for (const r of t.rings) for (let i = 0; i < r.length; i += 2) { const j = (i + 2) % r.length; const onEdge = (v: number) => v <= 1 || v >= 999; if (onEdge(r[i]) && onEdge(r[j]) && (r[i] === r[j] || r[i + 1] === r[j + 1])) continue; best = Math.min(best, segDist(PIN, PIN, r[i], r[i + 1], r[j], r[j + 1])); }
    if (best * 5 > 1000) far.push(`${s.id} ${Math.round(best * 5)} m`);
  }
  assert.deepEqual(far, []);
});
test('the arrow comes FROM the forecast direction and points at the pin', () => {
  for (const from of [0, 45, 90, 181, 270, 359]) {
    const g = arrowGeom(from), [sx, sy] = g.shaft.slice(1).split(' L')[0].split(',').map(Number), [ex, ey] = at(from, 430);
    assert.ok(Math.hypot(sx - ex, sy - ey) < 0.2, `starts on the ${from}° side`);
    const tip = g.head.split(' L')[1].split(',').map(Number), [tx, ty] = at(from, 92); assert.ok(Math.hypot(tip[0] - tx, tip[1] - ty) < 0.2, 'the head points at the pin');
  }
  assert.deepEqual(at(270, 100).map(Math.round), [400, 500], 'west is left'); assert.deepEqual(at(0, 100).map(Math.round), [500, 400], 'north is up');
});
test('the open-water window is the facing ±55°, and with no coastline data the facing line is square to the facing', () => {
  assert.match(windowPath(270), /^M500,500 L/); const [a, b] = facingShore(270).slice(1).split(' L').map((p) => p.split(',').map(Number));
  assert.ok(Math.abs(a[0] - b[0]) < 0.2, 'a west-facing beach: the shore runs north-south');
  assert.equal(landPath([[0, 0, 10, 0, 10, 10]]), 'M0,0L10,0L10,10Z'); assert.equal(compass16(281), 'W'); assert.equal(compass16(225), 'SW');
});
test('arrows: 3 period steps, and every 3 h on a wide chart, 6 h on a phone (12 h only when 6 h would crowd)', () => {
  assert.deepEqual([9.9, 10, 13.9, 14].map(periodStep), ['short', 'mid', 'mid', 'long']);
  assert.equal(arrowStepH(7.7, true), 3); assert.equal(arrowStepH(2, false), 6); assert.equal(arrowStepH(1.5, false), 12); assert.equal(arrowStepH(40, false), 6);
});
