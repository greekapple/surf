import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import tiles from '../data/coastTiles.json' with {type: 'json'};
import {evidenceSpot} from '../ocean/spots.ts';
import {coastServiceSpots} from '../../services/forecast-service.mjs';
import {assignmentFor} from '../ocean/mop.ts';
import {NWS_ZONE} from '../services/nwsZones.ts';

// pin-check (2026-11-13): the catalogue pins were measured against the OSM shore (the coast-tile polygons); Carmel Beach's pin was 217 m inside land and moved to the mean of two agreeing guides
const G = tiles.grid, M = tiles.tileMetres / G;
const shoreOf = (id: string) => {
  const rings = ((tiles.tiles as any)[id].rings as number[][]).map((r) => Array.from({length: r.length / 2}, (_, i) => [r[2 * i], r[2 * i + 1]] as [number, number])), c = G / 2;
  let inside = false, best = Infinity;
  for (const ring of rings) for (let a = 0; a < ring.length; a++) {
    const [x1, y1] = ring[a], [x2, y2] = ring[(a + 1) % ring.length];
    if ((y1 > c) !== (y2 > c) && c < ((x2 - x1) * (c - y1)) / (y2 - y1) + x1) inside = !inside;
    if ((x1 === x2 && (x1 === 0 || x1 === G)) || (y1 === y2 && (y1 === 0 || y1 === G))) continue;
    const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy, t = L === 0 ? 0 : Math.max(0, Math.min(1, ((c - x1) * dx + (c - y1) * dy) / L));
    best = Math.min(best, Math.hypot(c - (x1 + t * dx), c - (y1 + t * dy)));
  }
  return {inside, metres: best * M};
};
test('pin-check: Carmel Beach\'s pin is now off the shore on the sea side (it was 217 m inside land), in the catalogue, the Worker copy and the tile', () => {
  const e = evidenceSpot('cs-carmel'); assert.equal(e.latitude, 36.554); assert.equal(e.longitude, -121.932);
  const w = (coastServiceSpots as {id: string; lat: number; lon: number}[]).find((s) => s.id === 'cs-carmel')!; assert.deepEqual([w.lat, w.lon], [36.554, -121.932]);
  const s = shoreOf('cs-carmel'); assert.equal(s.inside, false, 'the pin is not inside the OSM land polygon'); assert.ok(s.metres > 60 && s.metres < 200, `${Math.round(s.metres)} m off the shore`);
});
test('pin-check: the move changes no MOP or NWS choice for Carmel; the other spots\' tiles are untouched (a sample still sits where it did)', () => {
  assert.equal(assignmentFor('cs-carmel')?.mopId, 'MO646'); assert.equal((NWS_ZONE as Record<string, string | null>)['cs-carmel'], 'CAZ530');
  assert.equal(shoreOf('spot-2').inside, true, 'Ocean Beach\'s tile is the one built before (its pin 122 m inside the simplified polygon, a known small error)'); assert.ok(Math.abs(shoreOf('spot-2').metres - 122) < 3);
  const sheet = fs.readFileSync(new URL('../../docs/forecast/PIN-CHECK.md', import.meta.url), 'utf8');
  assert.match(sheet, /## Moved \(1\)/); assert.match(sheet, /cs-carmel.*36\.554, -121\.932/); assert.match(sheet, /\| `w-usw-shark-pit-marin`/); assert.equal((sheet.match(/^\| `(cs|w-usw)-[^`]+` /gm) ?? []).length, 46, 'all 46 pins over 200 m are on the sheet (1 moved + 45 kept)');
});
