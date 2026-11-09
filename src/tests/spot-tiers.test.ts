import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ADDED_2026_11_08, spotTier} from '../data/spotTiers.ts';
import {evidenceSpots} from '../ocean/spots.ts';

test('the added-spot tier list equals the Phase A research rows, and every listed id is a live spot', () => {
  const rows = JSON.parse(fs.readFileSync('docs/forecast/data/phase-a-spots.json', 'utf8')).rows as {id: string}[];
  assert.deepEqual([...ADDED_2026_11_08].sort(), rows.map((r) => r.id).sort());
  const ids = new Set(evidenceSpots.map((e) => e.id));
  for (const id of ADDED_2026_11_08) assert.ok(ids.has(id), id);
  assert.equal(spotTier('spot-2'), 1); assert.equal(spotTier('cs-sloat'), 0);
});
